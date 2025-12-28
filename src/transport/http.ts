/**
 * HTTP transport for remote MCP access
 *
 * Uses Bun's native HTTP server with a simple JSON-RPC endpoint.
 * For production deployments, consider using a reverse proxy for SSE support.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Create a Hono app for HTTP-based MCP access
 * 
 * This provides a simple JSON-RPC over HTTP endpoint.
 * For full bidirectional streaming, use stdio transport or
 * deploy behind a reverse proxy that supports SSE.
 */
export function createHttpApp(_server: McpServer): Hono {
    const app = new Hono();

    // Enable CORS for remote access
    app.use("*", cors());

    // Health check endpoint
    app.get("/health", (c) => {
        return c.json({
            status: "ok",
            service: "ba-transit",
            version: "0.1.0",
            transport: "http",
        });
    });

    // Info endpoint
    app.get("/", (c) => {
        return c.json({
            name: "ba-transit",
            description: "Buenos Aires Transit MCP Server",
            version: "0.1.0",
            tools: ["get_arrivals", "get_status"],
            documentation: {
                note: "For MCP clients, use stdio transport for full functionality.",
                stdio_command: "bun run src/index.ts",
            },
        });
    });

    // Simple RPC endpoint for testing
    app.post("/rpc", async (c) => {
        const body = await c.req.json();

        // This is a simplified endpoint for testing
        // Full MCP protocol requires stdio transport
        return c.json({
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: {
                code: -32601,
                message: "HTTP transport provides limited functionality. Use stdio for full MCP support.",
            },
        });
    });

    return app;
}

/**
 * Start the HTTP server
 */
export async function startHttpTransport(
    server: McpServer,
    port: number
): Promise<void> {
    const app = createHttpApp(server);

    console.log(`[ba-transit] Starting HTTP server on port ${port}...`);
    console.log(`[ba-transit] Note: HTTP transport has limited functionality.`);
    console.log(`[ba-transit] For full MCP support, use: TRANSPORT=stdio bun run src/index.ts`);

    // Use Bun.serve for optimal performance
    Bun.serve({
        port,
        fetch: app.fetch,
    });

    console.log(`[ba-transit] Server listening at http://localhost:${port}`);
    console.log(`[ba-transit] Health: GET http://localhost:${port}/health`);
    console.log(`[ba-transit] Info: GET http://localhost:${port}/`);
}
