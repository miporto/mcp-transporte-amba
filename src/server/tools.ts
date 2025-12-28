/**
 * MCP Tool definitions for BA-Transit
 *
 * Defines the get_arrivals and get_status tools with Zod schemas
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
]);

/** All transit lines */
export const TransitLineSchema = z.union([SubteLineSchema, TrainLineSchema]);

/** Transit type */
export const TransitTypeSchema = z.enum(["subte", "train"]);

/**
 * Schema for get_arrivals tool parameters
 */
export const GetArrivalsSchema = z.object({
    station: z
        .string()
        .min(1)
        .describe(
            "Station name or partial name to search for (e.g., 'Retiro', 'Plaza de Mayo')"
        ),
    line: TransitLineSchema.optional().describe(
        "Specific transit line to filter by (e.g., 'A', 'Mitre')"
    ),
    direction: z
        .string()
        .optional()
        .describe("Direction of travel (e.g., 'San Pedrito', 'Tigre')"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Maximum number of arrivals to return (default: 5)"),
});

export type GetArrivalsInput = z.infer<typeof GetArrivalsSchema>;

/**
 * Schema for get_status tool parameters
 */
export const GetStatusSchema = z.object({
    line: TransitLineSchema.optional().describe(
        "Specific line to check status for"
    ),
    type: TransitTypeSchema.optional().describe(
        "Filter by transit type: 'subte' or 'train'"
    ),
});

export type GetStatusInput = z.infer<typeof GetStatusSchema>;

/**
 * Tool metadata for MCP registration
 */
export const TOOLS = {
    get_arrivals: {
        name: "get_arrivals",
        description:
            "Get real-time arrival predictions for a specific transit station in Buenos Aires. " +
            "Returns upcoming train/subte arrivals with estimated times and any delays. " +
            "Covers Subte (Lines A, B, C, D, E, H, Premetro) and Trains (Mitre, Sarmiento, Roca, San Martín, Belgrano Sur, Belgrano Norte).",
        inputSchema: GetArrivalsSchema,
    },
    get_status: {
        name: "get_status",
        description:
            "Get current service status and alerts for Buenos Aires transit lines. " +
            "Returns operational status and any active service alerts for each line. " +
            "Can filter by specific line or transit type (subte/train).",
        inputSchema: GetStatusSchema,
    },
} as const;
