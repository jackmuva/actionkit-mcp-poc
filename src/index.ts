import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import jwt from "jsonwebtoken"

const USER_AGENT = "actionkit-app/1.0";

//helper functions
async function getActions<T>(jwt: string): Promise<T | null> {
	try {
		const response = await fetch("https://actionkit.useparagon.com/projects/" + process.env.NEXT_PUBLIC_PARAGON_PROJECT_ID + "/actions", {
			method: "GET",
			headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jwt },
		});
		if (!response.ok) {
			throw new Error(`HTTP error; status: ${response.status}`)
		}
		return (await response.json()) as T;
	} catch (error) {
		console.error("Could not make ActionKit POST request: " + error);
		return null;
	}
}

async function performAction(actionName: string, actionParams: any, jwt: string): Promise<any | null> {
	try {
		const response = await fetch("https://actionkit.useparagon.com/projects/" + process.env.PARAGON_PROJECT_ID + "/actions", {
			method: "POST",
			headers: { "Content-Type": "application/json", "Authorization": "Bearer " + jwt },
			body: JSON.stringify({ action: actionName, parameters: actionParams })
		});
		if (!response.ok) {
			throw new Error(`HTTP error; status: ${response.status}`)
		}
		return (await response.json());
	} catch (error) {
		console.error("Could not make ActionKit POST request: " + error);
		return null;
	}
}


function signJwt(userId: string): string {
	const currentTime = Math.floor(Date.now() / 1000);

	return jwt.sign(
		{
			sub: userId,
			iat: currentTime,
			exp: currentTime + (60 * 60 * 24 * 7), // 1 week from now
		},
		process.env.SIGNING_KEY?.replaceAll("\\n", "\n") ?? "",
		{
			algorithm: "RS256",
		},
	);
}

async function hydrateTools(jwt: string): Promise<McpServer | null> {
	// Create server instance
	const server = new McpServer({
		name: "actionkit-mcp",
		version: "1.0.0",
	});


	const actions: any = await getActions(jwt);
	const actionsBody: any = actions.body;
	try {
		for (const integration of Object.keys(actionsBody)) {
			for (const action of actionsBody[integration]) {
				const zodSchema: Record<string, z.ZodTypeAny> = createZodSchema(action);
				const toolParameters = getParameters(action);
				type parameterType = MapSchema<typeof toolParameters>;
				server.tool(
					action.function.name,
					action.function.description,
					zodSchema,
					async (parameters: parameterType) => {
						const actionResponse = await performAction(action.function.name, parameters, jwt);
						return actionResponse;
					}
				);
			}
		}
		return server;
	} catch (error) {
		console.log(`Could not create all ActionKit tools: ${error}`);
		return null;
	}

}

function createZodSchema(action: Action): Record<string, z.ZodTypeAny> {
	const resultSchema: Record<string, z.ZodTypeAny> = {};
	const properties = action.function.parameters.properties
	const required: Set<string> = new Set(action.function.parameters.required)

	for (const property of Object.keys(properties)) {
		if (properties[property].type === "string" ||
			properties[property].type === "object") {
			if (required.has(property)) {
				resultSchema[property] = z.string().length(255).describe(properties[property].description)
			} else {
				resultSchema[property] = z.string().length(255).nullable().describe(properties[property].description)
			}
		} else if (properties[property].type === "boolean") {
			if (required.has(property)) {
				resultSchema[property] = z.boolean().describe(properties[property].description)
			} else {
				resultSchema[property] = z.boolean().nullable().describe(properties[property].description)
			}
		} else if (properties[property].type === "array") {
			if (required.has(property)) {
				resultSchema[property] = z.string().array().describe(properties[property].description)
			} else {
				resultSchema[property] = z.string().array().nullable().describe(properties[property].description)
			}
		}
	}
	return resultSchema;
}

type MapSchemaTypes = {
	string: string;
	integer: number;
	boolean: boolean;
	array: Array<string>;
	// others?
}

type MapSchema<T extends Record<string, keyof MapSchemaTypes>> = {
	-readonly [K in keyof T]: MapSchemaTypes[T[K]]
}


const getParameters = (action: any) => {
	const toolParameters = {};
	for (const parameterName of Object.keys(action.function.parameters.properties)) {
		//@ts-ignore
		toolParameters[parameterName] = action.function.parameters.properties[parameterName].type
	}
	return toolParameters;
}

//types
interface Action {
	type: string;
	function: {
		name: string;
		description: string;
		parameters: {
			type: string;
			properties: any;
			required: Array<string>;
			additionalProperties?: Boolean;
		}
	}
}

async function main() {
	const jwt = signJwt("jack.mu@useparagon.com")
	const server = await hydrateTools(jwt);
	if (server === null) {
		throw new Error("Server unable to be created")
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("ActionKit MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});
