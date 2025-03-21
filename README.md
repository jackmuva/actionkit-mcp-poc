# actionkit-mcp-poc
## Setting Up
1) Clone the repo
2) input necessary env variables
```
PARAGON_PROJECT_ID=
SIGNING_KEY=
```
3) Run `npm run build`
4) Download Claude Desktop if you don't already have it
5) Create the Claude Desktop config file `vi ~/Library/Application\ Support/Claude/claude_desktop_config.json`
```
{
    "mcpServers": {
        "actionkit-mcp": {
            "command": "node",
            "args": [
                "/ABSOLUTE/PATH/TO/PARENT/FOLDER/actionkit-mpc-poc/build/index.js"
            ]
        }
    }
}
```
6) Launch Claude Desktop
