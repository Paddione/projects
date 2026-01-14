#!/bin/bash

# Configuration for the MCP server
MCP_DIR="/home/patrick/projects/shared-infrastructure/shared/postgres-mcp"
CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"

echo "Configuring shared-postgres-mcp..."

# Ensure the server is built
cd "$MCP_DIR"
node.exe ./node_modules/typescript/bin/tsc

# Output the configuration snippet for the user
echo ""
echo "Please add/update the following in your Claude Desktop configuration ($CLAUDE_CONFIG):"
echo ""
cat <<EOF
{
  "mcpServers": {
    "shared-postgres": {
      "command": "node",
      "args": ["$MCP_DIR/build/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/postgres"
      }
    }
  }
}
EOF
echo ""
echo "Note: If 'postgres' password is different, please update the DATABASE_URL above."
echo "The server now supports listing all databases and switching between them."
echo ""
echo "After adding this, restart Claude Desktop."
