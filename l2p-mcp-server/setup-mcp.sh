#!/bin/bash

# Configuration for the MCP server
MCP_DIR="/home/patrick/projects/l2p-mcp-server"
CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"

echo "Configuring l2p-postgres-mcp..."

# Ensure the server is built
cd "$MCP_DIR"
./node_modules/.bin/tsc

# Output the configuration snippet for the user
echo ""
echo "Please add the following to your Claude Desktop configuration ($CLAUDE_CONFIG):"
echo ""
cat <<EOF
{
  "mcpServers": {
    "l2p-postgres": {
      "command": "node",
      "args": ["$MCP_DIR/build/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://l2p_user:06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581@localhost:5432/l2p_db"
      }
    }
  }
}
EOF
echo ""
echo "After adding this, restart Claude Desktop."
