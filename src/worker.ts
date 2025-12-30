/**
 * Cloudflare Workers entry point for MCP Transporte AMBA
 *
 * Uses Streamable HTTP transport for stateless MCP server deployment
 */

/// <reference types="@cloudflare/workers-types" />

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { BAClient } from "./client/BAClient.js";
import { createMcpServer } from "./server/index.js";

export interface Env {
    BA_CLIENT_ID: string;
    BA_CLIENT_SECRET: string;
    BA_API_URL?: string;
}

const MAX_BODY_BYTES = 64 * 1024; // 64 KB

const SECURITY_HEADERS = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
} as const;

function createClientFromEnv(env: Env): BAClient {
    if (!env.BA_CLIENT_ID || !env.BA_CLIENT_SECRET) {
        throw new Error(
            "Missing BA_CLIENT_ID or BA_CLIENT_SECRET environment variables"
        );
    }

    return new BAClient({
        clientId: env.BA_CLIENT_ID,
        clientSecret: env.BA_CLIENT_SECRET,
        baseUrl: env.BA_API_URL,
    });
}

export default {
    async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Health check endpoint
        if (url.pathname === "/health") {
            return new Response(
                JSON.stringify({
                    status: "ok",
                    service: "mcp-transporte-amba",
                    version: "0.1.0",
                    transport: "streamable-http",
                }),
                { headers: SECURITY_HEADERS }
            );
        }

        // Info endpoint
        if (url.pathname === "/" && request.method === "GET") {
            return new Response(
                JSON.stringify({
                    name: "mcp-transporte-amba",
                    description: "Buenos Aires Metropolitan Area Transit MCP Server",
                    version: "0.1.0",
                    mcp_endpoint: "/mcp",
                    tools: [
                        "get_subte_arrivals",
                        "get_train_arrivals",
                        "get_subte_status",
                        "get_train_status",
                    ],
                }),
                { headers: SECURITY_HEADERS }
            );
        }

        // MCP endpoint (Streamable HTTP transport)
        if (url.pathname === "/mcp") {
            // Only accept POST for stateless MCP (no SSE streaming via GET)
            if (request.method === "GET") {
                return new Response(
                    JSON.stringify({
                        error: "GET not supported for stateless MCP. Use POST to send JSON-RPC messages.",
                        endpoint: "/mcp",
                        method: "POST",
                        content_type: "application/json",
                    }),
                    {
                        status: 405,
                        headers: {
                            ...SECURITY_HEADERS,
                            "Allow": "POST",
                        },
                    }
                );
            }

            if (request.method !== "POST") {
                return new Response(
                    JSON.stringify({ error: "Method Not Allowed" }),
                    {
                        status: 405,
                        headers: {
                            ...SECURITY_HEADERS,
                            "Allow": "POST",
                        },
                    }
                );
            }

            // Content-Type validation
            const contentType = request.headers.get("content-type") || "";
            if (!contentType.toLowerCase().includes("application/json")) {
                return new Response(
                    JSON.stringify({ error: "Unsupported Media Type. Use application/json." }),
                    {
                        status: 415,
                        headers: SECURITY_HEADERS,
                    }
                );
            }

            // Request size limit
            const contentLength = request.headers.get("content-length");
            if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
                return new Response(
                    JSON.stringify({ error: "Request body too large." }),
                    {
                        status: 413,
                        headers: SECURITY_HEADERS,
                    }
                );
            }

            try {
                const client = createClientFromEnv(env);
                const mcpServer = createMcpServer(client);

                // Stateless transport - no session management, JSON responses only
                const transport = new WebStandardStreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                    enableJsonResponse: true,
                });

                // Connect server to transport
                await mcpServer.connect(transport);

                try {
                    // Handle the request
                    return await transport.handleRequest(request);
                } finally {
                    // Clean up transport after request
                    await transport.close();
                }
            } catch (err) {
                console.error("Error handling /mcp request", err);
                return new Response(
                    JSON.stringify({ error: "Internal server error" }),
                    {
                        status: 500,
                        headers: SECURITY_HEADERS,
                    }
                );
            }
        }

        return new Response(
            JSON.stringify({ error: "Not Found" }),
            {
                status: 404,
                headers: SECURITY_HEADERS,
            }
        );
    },
};
