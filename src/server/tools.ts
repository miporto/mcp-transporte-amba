/**
 * MCP Tool definitions for BA-Transit
 *
 * Defines separate tools for subte and train arrivals/status
 */

import { z } from "zod";

/** Valid subte line values */
export const SubteLineSchema = z.enum([
    "A",
    "B",
    "C",
    "D",
    "E",
    "H",
    "Premetro",
]);

/** Valid train line values */
export const TrainLineSchema = z.enum([
    "Mitre",
    "Sarmiento",
    "Roca",
    "San Martín",
    "Belgrano Sur",
    "Belgrano Norte",
    "Tren de la Costa",
]);

/**
 * Schema for listing available train lines (líneas)
 */
export const ListTrainLinesSchema = z.object({
    // Future-proofing: SOFSE uses empresaId, but we currently default to metropolitan (1)
    empresaId: z.number().int().optional().describe("SOFSE empresaId (default: 1)").default(1),
});

export type ListTrainLinesInput = z.infer<typeof ListTrainLinesSchema>;

/**
 * Schema for listing ramales for a train line
 */
export const ListTrainRamalesSchema = z
    .object({
        line: TrainLineSchema.optional().describe("Train line (línea), e.g. 'Mitre'"),
        lineId: z.number().int().optional().describe("SOFSE lineId/gerenciaId"),
    });

export type ListTrainRamalesInput = z.infer<typeof ListTrainRamalesSchema>;

/**
 * Schema for listing stations of a ramal
 */
export const ListTrainStationsSchema = z.object({
    ramalId: z.number().int().describe("SOFSE ramalId"),
});

export type ListTrainStationsInput = z.infer<typeof ListTrainStationsSchema>;

/**
 * Schema for searching train stations
 */
export const SearchTrainStationsSchema = z.object({
    query: z.string().min(1).describe("Station name or partial name to search for"),
    line: TrainLineSchema.optional().describe("Optional train line (línea) filter"),
    ramalId: z.number().int().optional().describe("Optional SOFSE ramalId filter"),
    limit: z.number().int().min(1).max(25).default(10).describe("Max candidates to return (default: 10)"),
});

export type SearchTrainStationsInput = z.infer<typeof SearchTrainStationsSchema>;

/**
 * Schema for get_subte_arrivals tool parameters
 */
export const GetSubteArrivalsSchema = z.object({
    station: z
        .string()
        .min(1)
        .describe(
            "Station name or partial name to search for (e.g., 'Plaza de Mayo', 'Catedral')"
        ),
    line: SubteLineSchema.optional().describe(
        "Specific subte line to filter by (A, B, C, D, E, H, or Premetro)"
    ),
    direction: z
        .string()
        .optional()
        .describe("Direction of travel (e.g., 'San Pedrito', 'Plaza de Mayo')"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Maximum number of arrivals to return (default: 5)"),
});

export type GetSubteArrivalsInput = z.infer<typeof GetSubteArrivalsSchema>;

/**
 * Schema for get_train_arrivals tool parameters
 */
export const GetTrainArrivalsSchema = z.object({
    station: z
        .string()
        .min(1)
        .optional()
        .describe(
            "Station name or partial name to search for (fallback if stationId not provided)"
        ),
    stationId: z
        .union([z.number().int(), z.string()])
        .optional()
        .describe("SOFSE stationId (recommended; deterministic)"),
    line: TrainLineSchema.optional().describe(
        "Specific train line to filter by (Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte, or Tren de la Costa)"
    ),
    ramalId: z
        .number()
        .int()
        .optional()
        .describe("Optional SOFSE ramalId to filter arrivals to a specific branch"),
    direction: z
        .string()
        .optional()
        .describe("Direction of travel (e.g., 'Tigre', 'Moreno')"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Maximum number of arrivals to return (default: 5)"),
});

export type GetTrainArrivalsInput = z.infer<typeof GetTrainArrivalsSchema>;

/**
 * Schema for get_subte_status tool parameters
 */
export const GetSubteStatusSchema = z.object({
    line: SubteLineSchema.optional().describe(
        "Specific subte line to check status for (A, B, C, D, E, H, or Premetro). If omitted, returns status for all subte lines."
    ),
});

export type GetSubteStatusInput = z.infer<typeof GetSubteStatusSchema>;

/**
 * Schema for get_train_status tool parameters
 */
export const GetTrainStatusSchema = z.object({
    line: TrainLineSchema.optional().describe(
        "Specific train line to check status for (Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte, or Tren de la Costa). If omitted, returns status for all train lines."
    ),
    includeRamales: z
        .boolean()
        .optional()
        .describe(
            "Include per-ramal breakdown. Defaults to true when a single line is provided."
        ),
});

export type GetTrainStatusInput = z.infer<typeof GetTrainStatusSchema>;

/**
 * Tool metadata for MCP registration
 */
export const TOOLS = {
    list_train_lines: {
        name: "list_train_lines",
        description:
            "List available Buenos Aires metropolitan train lines (líneas), backed by SOFSE (Trenes Argentinos). " +
            "Returns IDs and current status message to support deterministic follow-up calls.",
        inputSchema: ListTrainLinesSchema,
    },
    list_train_ramales: {
        name: "list_train_ramales",
        description:
            "List ramales (branches) for a given train line (línea). " +
            "Use this to choose a specific ramalId for arrivals or station listing.",
        inputSchema: ListTrainRamalesSchema,
    },
    list_train_stations: {
        name: "list_train_stations",
        description:
            "List stations for a specific ramal (branch) using SOFSE infrastructure data.",
        inputSchema: ListTrainStationsSchema,
    },
    search_train_stations: {
        name: "search_train_stations",
        description:
            "Search train stations by name and return deterministic stationId candidates (optionally filtered by line or ramalId).",
        inputSchema: SearchTrainStationsSchema,
    },
    get_subte_arrivals: {
        name: "get_subte_arrivals",
        description:
            "Get real-time arrival predictions for Buenos Aires Subte (subway/metro) stations. " +
            "The tool validates station names and line combinations, auto-correcting common mistakes " +
            "(e.g., wrong line for a station) and returning warnings if the input is ambiguous or invalid. " +
            "Covers Lines A, B, C, D, E, H, and Premetro.",
        inputSchema: GetSubteArrivalsSchema,
    },
    get_train_arrivals: {
        name: "get_train_arrivals",
        description:
            "Get real-time arrival predictions for Buenos Aires metropolitan train stations. " +
            "Returns upcoming train arrivals with estimated times and any delays. " +
            "Covers Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte, and Tren de la Costa lines.",
        inputSchema: GetTrainArrivalsSchema,
    },
    get_subte_status: {
        name: "get_subte_status",
        description:
            "Get current service status and alerts for Buenos Aires Subte (Metro) lines. " +
            "Returns operational status and any active service alerts. " +
            "Covers Lines A, B, C, D, E, H, and Premetro.",
        inputSchema: GetSubteStatusSchema,
    },
    get_train_status: {
        name: "get_train_status",
        description:
            "Get current service status and alerts for Buenos Aires metropolitan train lines. " +
            "Returns operational status and any active service alerts. " +
            "Covers Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte, and Tren de la Costa lines.",
        inputSchema: GetTrainStatusSchema,
    },
} as const;
