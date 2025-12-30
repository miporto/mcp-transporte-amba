/**
 * String utility functions for transit data matching
 */

/**
 * Normalize station string for matching
 * Handles underscores vs spaces, accents, and case differences
 */
export function normalizeStationString(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_]+/g, "");
}
