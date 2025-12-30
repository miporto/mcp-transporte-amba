/**
 * MCP Server setup for BA-Transit
 *
 * Creates and configures the McpServer instance with tool handlers
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BAClient } from "../client/BAClient.js";
import { resolveSubteStation } from "../client/subteResolver.js";
import {
    TOOLS,
    GetSubteArrivalsSchema,
    GetTrainArrivalsSchema,
    GetSubteStatusSchema,
    GetTrainStatusSchema,
} from "./tools.js";
import type {
    GetSubteArrivalsInput,
    GetTrainArrivalsInput,
    GetSubteStatusInput,
    GetTrainStatusInput,
} from "./tools.js";
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

        let result = `• ${s.line}: ${status}${alertText}`;

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

    // Register get_subte_arrivals tool
    server.tool(
        TOOLS.get_subte_arrivals.name,
        TOOLS.get_subte_arrivals.description,
        TOOLS.get_subte_arrivals.inputSchema.shape,
        async (params: GetSubteArrivalsInput) => {
            const validated = GetSubteArrivalsSchema.parse(params);

            // Resolve and validate station/line combination
            const { station: resolvedStation, issues } = resolveSubteStation(
                validated.station,
                validated.line
            );

            // If station couldn't be resolved, return the issues
            if (!resolvedStation) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: issues.join("\n"),
                        },
                    ],
                };
            }

            // Use the resolved station name and line
            const arrivals = await client.getArrivals({
                station: resolvedStation.name,
                line: resolvedStation.line,
                direction: validated.direction,
                limit: validated.limit,
            });

            // Build response with any correction warnings
            let responseText = "";
            if (issues.length > 0) {
                responseText += `⚠️ ${issues.join("\n")}\n\n`;
            }
            responseText += formatArrivals(arrivals);

            return {
                content: [
                    {
                        type: "text" as const,
                        text: responseText,
                    },
                ],
            };
        }
    );

    // Register get_train_arrivals tool
    server.tool(
        TOOLS.get_train_arrivals.name,
        TOOLS.get_train_arrivals.description,
        TOOLS.get_train_arrivals.inputSchema.shape,
        async (params: GetTrainArrivalsInput) => {
            const validated = GetTrainArrivalsSchema.parse(params);

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

    // Register get_subte_status tool
    server.tool(
        TOOLS.get_subte_status.name,
        TOOLS.get_subte_status.description,
        TOOLS.get_subte_status.inputSchema.shape,
        async (params: GetSubteStatusInput) => {
            const validated = GetSubteStatusSchema.parse(params);

            const statuses = await client.getStatus({
                line: validated.line,
                type: "subte",
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

    // Register get_train_status tool
    server.tool(
        TOOLS.get_train_status.name,
        TOOLS.get_train_status.description,
        TOOLS.get_train_status.inputSchema.shape,
        async (params: GetTrainStatusInput) => {
            const validated = GetTrainStatusSchema.parse(params);

            const statuses = await client.getStatus({
                line: validated.line,
                type: "train",
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
