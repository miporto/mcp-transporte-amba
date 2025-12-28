/**
 * BA-Transit MCP Server
 *
 * Main entrypoint with conditional transport selection
 */

import { createClientFromEnv } from "./client/index.js";
import { createMcpServer } from "./server/index.js";
import { startStdioTransport, startHttpTransport } from "./transport/index.js";

async function main(): Promise<void> {
    // Create the API client
    const client = createClientFromEnv();

    // Create the MCP server
    const server = createMcpServer(client);

    // Determine transport mode from environment
    const transport = process.env.TRANSPORT?.toLowerCase() ?? "stdio";

    if (transport === "http") {
        const port = parseInt(process.env.PORT ?? "3000", 10);
        await startHttpTransport(server, port);
    } else {
        await startStdioTransport(server);
    }
}

// Run the server
main().catch((error) => {
    console.error("[ba-transit] Fatal error:", error);
    process.exit(1);
});
