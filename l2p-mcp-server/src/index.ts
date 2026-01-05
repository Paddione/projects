import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const server = new Server(
    {
        name: "l2p-postgres-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

let pool: pg.Pool;

function initializePool(connectionString?: string) {
    const url = connectionString || process.env.DATABASE_URL;
    if (!url) {
        console.error("DATABASE_URL not provided");
        return;
    }

    if (pool) {
        pool.end();
    }

    pool = new pg.Pool({
        connectionString: url,
        // Add some safety
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
}

// Initial initialization
initializePool();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query",
                description: "Run a SQL query on the PostgreSQL database. Primarily for SELECT but allows other potentially useful commands.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sql: {
                            type: "string",
                            description: "The SQL query to execute",
                        },
                    },
                    required: ["sql"],
                },
            },
            {
                name: "list_tables",
                description: "List all tables in the public schema",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "describe_table",
                description: "Get the schema and column details for a specific table",
                inputSchema: {
                    type: "object",
                    properties: {
                        table: {
                            type: "string",
                            description: "The name of the table to describe",
                        },
                    },
                    required: ["table"],
                },
            },
            {
                name: "get_database_stats",
                description: "Get general database statistics (number of rows in tables, etc.)",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            }
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!pool) {
        return {
            content: [{ type: "text", text: "Database pool not initialized. Check DATABASE_URL environment variable." }],
            isError: true
        };
    }

    try {
        switch (name) {
            case "query": {
                const sql = args?.sql as string;
                const result = await pool.query(sql);
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }

            case "list_tables": {
                const result = await pool.query(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
                );
                return {
                    content: [{ type: "text", text: result.rows.map(r => r.table_name).join("\n") }],
                };
            }

            case "describe_table": {
                const table = args?.table as string;
                const result = await pool.query(
                    `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position`,
                    [table]
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }

            case "get_database_stats": {
                const result = await pool.query(`
          SELECT 
            relname as table_name, 
            n_live_tup as row_count 
          FROM pg_stat_user_tables 
          ORDER BY n_live_tup DESC`
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `PostgreSQL Error: ${error.message}` }],
            isError: true,
        };
    }
});

const transport = new StdioServerTransport();
server.connect(transport).catch(error => {
    console.error("Failed to connect to transport:", error);
});

console.error("L2P Postgres MCP Server running on Stdio");
