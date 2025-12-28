/**
 * MCP Server setup for BA-Transit
 *
 * Creates and configures the McpServer instance with tool handlers
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BAClient } from "../client/BAClient.js";
import { TOOLS, GetArrivalsSchema, GetStatusSchema } from "./tools.js";
import type { GetArrivalsInput, GetStatusInput } from "./tools.js";
import type { Arrival, LineStatus } from "../client/types.js";

/**
 * Format arrivals for human-readable output
 */
function formatArrivals(arrivals: Arrival[]): string {
    if (arrivals.length === 0) {
        return "No upcoming arrivals found for the specified station.";
    }

    const lines = arrivals.map((a) => {
        const delay = a.delaySeconds > 0 ? ` (${Math.round(a.delaySeconds / 60)} min delay)` : "";
        return `• ${a.station.line} → ${a.destination}: ${a.minutesAway} min${delay}`;
    });

    return `Upcoming arrivals:\n${lines.join("\n")}`;
}

/**
 * Format status for human-readable output
 */
function formatStatus(statuses: LineStatus[]): string {
    if (statuses.length === 0) {
        return "No status information available.";
    }

    const lines = statuses.map((s) => {
        const status = s.isOperational ? "✓ Operational" : "✗ Not operational";
        const alertCount = s.alerts.length;
        const alertText = alertCount > 0 ? ` (${alertCount} alert${alertCount > 1 ? "s" : ""})` : "";

        let result = `• ${s.line} (${s.type}): ${status}${alertText}`;

        if (s.alerts.length > 0) {
            const alertDetails = s.alerts.map((a) => `  - ${a.title}: ${a.description}`);
            result += "\n" + alertDetails.join("\n");
        }

        return result;
    });

    return `Service Status:\n${lines.join("\n")}`;
}

/**
 * Create and configure the MCP server
 */
export function createMcpServer(client: BAClient): McpServer {
    const server = new McpServer({
        name: "ba-transit",
        version: "0.1.0",
    });

    // Register get_arrivals tool
    server.tool(
        TOOLS.get_arrivals.name,
        TOOLS.get_arrivals.description,
        TOOLS.get_arrivals.inputSchema.shape,
        async (params: GetArrivalsInput) => {
            const validated = GetArrivalsSchema.parse(params);

            const arrivals = await client.getArrivals({
                station: validated.station,
                line: validated.line,
                direction: validated.direction,
                limit: validated.limit,
            });

            return {
                content: [
                    {
                        type: "text" as const,
                        text: formatArrivals(arrivals),
                    },
                ],
            };
        }
    );

    // Register get_status tool
    server.tool(
        TOOLS.get_status.name,
        TOOLS.get_status.description,
        TOOLS.get_status.inputSchema.shape,
        async (params: GetStatusInput) => {
            const validated = GetStatusSchema.parse(params);

            const statuses = await client.getStatus({
                line: validated.line,
                type: validated.type,
            });

            return {
                content: [
                    {
                        type: "text" as const,
                        text: formatStatus(statuses),
                    },
                ],
            };
        }
    );

    return server;
}
