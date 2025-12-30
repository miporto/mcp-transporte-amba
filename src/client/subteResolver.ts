/**
 * Subte station resolver for validating and matching station/line combinations
 */

import type { SubteLine } from "./types.js";
import { SUBTE_STATIONS, type SubteStation } from "./subteStations.js";
import { normalizeStationString } from "./stringUtils.js";

export interface ResolvedSubteStationResult {
    station?: SubteStation;
    candidates: SubteStation[];
    issues: string[];
}

/**
 * Resolve a station name and optional line to a validated SubteStation
 *
 * Handles:
 * - Partial name matching
 * - Line mismatch correction
 * - Ambiguous station detection
 * - Missing station errors
 */
export function resolveSubteStation(
    rawStation: string,
    requestedLine?: SubteLine
): ResolvedSubteStationResult {
    const normalizedQuery = normalizeStationString(rawStation);
    const issues: string[] = [];

    // Find all matching stations (by name or alias)
    const matches = SUBTE_STATIONS.filter((s) => {
        const normalizedName = normalizeStationString(s.name);

        // Check exact match first
        if (normalizedName === normalizedQuery) {
            return true;
        }

        // Check partial match on name
        if (normalizedName.includes(normalizedQuery)) {
            return true;
        }

        // Check aliases
        if (s.aliases?.some((alias) => {
            const normalizedAlias = normalizeStationString(alias);
            return normalizedAlias === normalizedQuery || normalizedAlias.includes(normalizedQuery);
        })) {
            return true;
        }

        return false;
    });

    // No matches found
    if (matches.length === 0) {
        issues.push(`No se encontró ninguna estación que coincida con "${rawStation}".`);
        return { station: undefined, candidates: [], issues };
    }

    // If a line is specified, filter matches by that line
    let lineFilteredMatches = matches;
    if (requestedLine) {
        lineFilteredMatches = matches.filter((m) => m.line === requestedLine);

        if (lineFilteredMatches.length === 0) {
            // Station exists but not on the requested line
            const availableLines = [...new Set(matches.map((m) => m.line))].join(", ");
            issues.push(
                `La estación "${rawStation}" no existe en la línea ${requestedLine}. ` +
                `Está disponible en: ${availableLines}.`
            );

            // Return the first match with a correction
            if (matches.length === 1) {
                const correctedStation = matches[0]!;
                issues.push(
                    `Usando la estación "${correctedStation.name}" de la línea ${correctedStation.line}.`
                );
                return { station: correctedStation, candidates: matches, issues };
            }

            // Multiple matches on different lines - ambiguous
            issues.push(
                `Coincide con: ${matches.map((m) => `"${m.name}" (línea ${m.line})`).join(", ")}. ` +
                `Por favor especifica la línea correcta.`
            );
            return { station: undefined, candidates: matches, issues };
        }
    }

    // Use the line-filtered matches (or all matches if no line specified)
    const candidates = lineFilteredMatches;

    // Single match - success!
    if (candidates.length === 1) {
        return { station: candidates[0], candidates, issues };
    }

    // Multiple matches - check if they're the same station on different lines
    const uniqueNames = [...new Set(candidates.map((c) => normalizeStationString(c.name)))];
    if (uniqueNames.length === 1 && requestedLine) {
        // Same station name, line was specified - use it
        const match = candidates.find((c) => c.line === requestedLine);
        if (match) {
            return { station: match, candidates, issues };
        }
    }

    // Truly ambiguous - multiple different stations match
    issues.push(
        `La estación "${rawStation}" es ambigua. Coincide con: ` +
        candidates.map((c) => `"${c.name}" (línea ${c.line})`).join(", ") +
        `. Por favor especifica el nombre completo o la línea.`
    );

    return { station: undefined, candidates, issues };
}
