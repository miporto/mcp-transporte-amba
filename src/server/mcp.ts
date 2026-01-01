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
    ListTrainLinesSchema,
    ListTrainRamalesSchema,
    ListTrainStationsSchema,
    SearchTrainStationsSchema,
    GetSubteArrivalsSchema,
    GetTrainArrivalsSchema,
    GetSubteStatusSchema,
    GetTrainStatusSchema,
} from "./tools.js";
import type {
    ListTrainLinesInput,
    ListTrainRamalesInput,
    ListTrainStationsInput,
    SearchTrainStationsInput,
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
        const ramal = a.ramalName ? ` / ${a.ramalName}` : "";
        const platform = a.platform ? ` (andén ${a.platform})` : "";
        return `• ${a.station.line}${ramal} → ${a.destination}: ${a.minutesAway} min${delay}${platform}`;
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

        if (s.ramales && s.ramales.length > 0) {
            const ramalLines = s.ramales.map((r) => {
                const rStatus = r.isOperational ? "✓ Operational" : "✗ Not operational";
                const rAlertCount = r.alerts.length;
                const rAlertText = rAlertCount > 0 ? ` (${rAlertCount} alert${rAlertCount > 1 ? "s" : ""})` : "";
                return `  - Ramal ${r.ramalId} (${r.ramalName}): ${rStatus}${rAlertText}`;
            });
            result += "\n" + ramalLines.join("\n");
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

    // Register list_train_lines tool
    server.tool(
        TOOLS.list_train_lines.name,
        TOOLS.list_train_lines.description,
        TOOLS.list_train_lines.inputSchema.shape,
        async (params: ListTrainLinesInput) => {
            const validated = ListTrainLinesSchema.parse(params);
            void validated.empresaId;

            const lines = await client.listTrainLines();
            const text = lines.length === 0
                ? "No train lines found."
                : `Train lines:\n${lines
                    .map((l) => `• ${l.line} (lineId=${l.lineId}): ${l.statusMessage} (${l.alertsCount} alert${l.alertsCount === 1 ? "" : "s"})`)
                    .join("\n")}`;

            return { content: [{ type: "text" as const, text }] };
        }
    );

    // Register list_train_ramales tool
    server.tool(
        TOOLS.list_train_ramales.name,
        TOOLS.list_train_ramales.description,
        TOOLS.list_train_ramales.inputSchema.shape,
        async (params: ListTrainRamalesInput) => {
            const validated = ListTrainRamalesSchema.parse(params);

            if (!validated.line && !validated.lineId) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Must provide either 'line' or 'lineId'.",
                        },
                    ],
                };
            }

            const ramales = await client.listTrainRamales({
                line: validated.line,
                lineId: validated.lineId,
            });

            const text = ramales.length === 0
                ? "No ramales found."
                : `Ramales:\n${ramales
                    .map((r) => `• ${r.line} / ${r.ramalName} (ramalId=${r.ramalId}) ${r.cabeceraInicial} ↔ ${r.cabeceraFinal}`)
                    .join("\n")}`;

            return { content: [{ type: "text" as const, text }] };
        }
    );

    // Register list_train_stations tool
    server.tool(
        TOOLS.list_train_stations.name,
        TOOLS.list_train_stations.description,
        TOOLS.list_train_stations.inputSchema.shape,
        async (params: ListTrainStationsInput) => {
            const validated = ListTrainStationsSchema.parse(params);

            const stations = await client.listTrainStations(validated.ramalId);
            const text = stations.length === 0
                ? "No stations found for the given ramalId."
                : `Stations:\n${stations
                    .map((s) => `• ${s.stationName} (stationId=${s.stationId})`)
                    .join("\n")}`;

            return { content: [{ type: "text" as const, text }] };
        }
    );

    // Register search_train_stations tool
    server.tool(
        TOOLS.search_train_stations.name,
        TOOLS.search_train_stations.description,
        TOOLS.search_train_stations.inputSchema.shape,
        async (params: SearchTrainStationsInput) => {
            const validated = SearchTrainStationsSchema.parse(params);

            const candidates = await client.searchTrainStations({
                query: validated.query,
                line: validated.line,
                ramalId: validated.ramalId,
                limit: validated.limit,
            });

            const text = candidates.length === 0
                ? "No matching stations found."
                : `Station candidates:\n${candidates
                    .map((c) => `• ${c.stationName} (stationId=${c.stationId}) [lines=${c.lines.join(", ")}]`)
                    .join("\n")}`;

            return { content: [{ type: "text" as const, text }] };
        }
    );

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

            if (!validated.stationId && !validated.station) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Must provide either 'stationId' (recommended) or 'station'.",
                        },
                    ],
                };
            }

            if (!validated.stationId && validated.station) {
                const resolved = await client.resolveTrainStation({
                    station: validated.station,
                    line: validated.line,
                    ramalId: validated.ramalId,
                });

                if (!resolved.station) {
                    const candidatesText = resolved.candidates.length > 0
                        ? `\n\nCandidates:\n${resolved.candidates
                            .map((c) => `• ${c.stationName} (stationId=${c.stationId}) [lines=${c.lines.join(", ")}]`)
                            .join("\n")}`
                        : "";

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `${resolved.issues.join("\n")}${candidatesText}`,
                            },
                        ],
                    };
                }

                const arrivals = await client.getTrainArrivals({
                    stationId: resolved.station.stationId,
                    line: validated.line,
                    ramalId: validated.ramalId,
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

            const arrivals = await client.getTrainArrivals({
                stationId: validated.stationId!,
                line: validated.line,
                ramalId: validated.ramalId,
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

            const includeRamales = validated.includeRamales ?? Boolean(validated.line);

            const statuses = await client.getTrainStatus({
                line: validated.line,
                includeRamales,
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
