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
        name: "shared-postgres-mcp",
        version: "1.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

let pool: pg.Pool | null = null;
let currentDbName: string = "unknown";

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
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    try {
        const u = new URL(url);
        currentDbName = u.pathname.split("/")[1] || "postgres";
    } catch (e) {
        currentDbName = "custom";
    }
}

// Initial initialization
initializePool();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query",
                description: "Run a SQL query on the current PostgreSQL database.",
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
                description: "List all tables in the current database",
                inputSchema: {
                    type: "object",
                    properties: {
                        schema: {
                            type: "string",
                            description: "Schema to list tables from (default: public)",
                        }
                    },
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
                        schema: {
                            type: "string",
                            description: "The schema of the table (default: public)",
                        }
                    },
                    required: ["table"],
                },
            },
            {
                name: "list_databases",
                description: "List all databases in the PostgreSQL instance",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "switch_database",
                description: "Switch to a different database on the same host",
                inputSchema: {
                    type: "object",
                    properties: {
                        database: {
                            type: "string",
                            description: "The name of the database to switch to",
                        }
                    },
                    required: ["database"],
                },
            },
            {
                name: "get_database_stats",
                description: "Get general database statistics",
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

    if (!pool && name !== "switch_database") {
        return {
            content: [{ type: "text", text: "Database pool not initialized. Check DATABASE_URL environment variable." }],
            isError: true
        };
    }

    try {
        switch (name) {
            case "query": {
                const sql = args?.sql as string;
                const result = await pool!.query(sql);
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }

            case "list_tables": {
                const schema = (args?.schema as string) || 'public';
                const result = await pool!.query(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
                    [schema]
                );
                return {
                    content: [{ type: "text", text: `Tables in ${currentDbName} (${schema}):\n` + result.rows.map(r => r.table_name).join("\n") }],
                };
            }

            case "describe_table": {
                const table = args?.table as string;
                const schema = (args?.schema as string) || 'public';
                const result = await pool!.query(
                    `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = $2
          ORDER BY ordinal_position`,
                    [table, schema]
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
                };
            }

            case "list_databases": {
                const result = await pool!.query(
                    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
                );
                return {
                    content: [{ type: "text", text: "Available databases:\n" + result.rows.map(r => r.datname).join("\n") }],
                };
            }

            case "switch_database": {
                const newDb = args?.database as string;
                const currentUrl = process.env.DATABASE_URL;
                if (!currentUrl) {
                    // Try to construct from components if available
                    throw new Error("Base DATABASE_URL not found in environment. Cannot switch database automatically.");
                }

                try {
                    const url = new URL(currentUrl);
                    url.pathname = `/${newDb}`;
                    initializePool(url.toString());
                    return {
                        content: [{ type: "text", text: `Switched to database: ${newDb}` }],
                    };
                } catch (e: any) {
                    throw new Error(`Failed to switch database: ${e.message}`);
                }
            }

            case "get_database_stats": {
                const result = await pool!.query(`
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

console.error(`Shared Postgres MCP Server running on Stdio (Current DB: ${currentDbName})`);
