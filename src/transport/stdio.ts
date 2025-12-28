/**
 * Stdio transport wrapper
 *
 * Connects the MCP server to stdin/stdout for local IDE usage
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Start the MCP server with stdio transport
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
    const transport = new StdioServerTransport();

    console.error("[ba-transit] Starting with stdio transport...");

    await server.connect(transport);

    console.error("[ba-transit] Server connected and ready.");
}
