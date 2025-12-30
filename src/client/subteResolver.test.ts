/**
 * Unit tests for subteResolver
 */

import { describe, it, expect } from "vitest";
import { resolveSubteStation } from "./subteResolver.js";

describe("resolveSubteStation", () => {
    describe("exact matches", () => {
        it("should resolve exact station name", () => {
            const result = resolveSubteStation("Catedral");
            expect(result.station?.name).toBe("Catedral");
            expect(result.station?.line).toBe("D");
            expect(result.issues).toHaveLength(0);
        });

        it("should resolve station with accent variations", () => {
            const result = resolveSubteStation("Constitucion");
            expect(result.station?.name).toBe("Constitución");
            expect(result.station?.line).toBe("C");
        });

        it("should resolve station by alias", () => {
            const result = resolveSubteStation("Gardel");
            expect(result.station).toBeDefined();
            expect(result.station?.name).toBe("Carlos Gardel");
            expect(result.station?.line).toBe("B");
        });
    });

    describe("line filtering", () => {
        it("should filter by correct line", () => {
            const result = resolveSubteStation("Retiro", "C");
            expect(result.station?.name).toBe("Retiro");
            expect(result.station?.line).toBe("C");
            expect(result.issues).toHaveLength(0);
        });

        it("should correct wrong line with warning", () => {
            const result = resolveSubteStation("Catedral", "A");
            expect(result.station?.name).toBe("Catedral");
            expect(result.station?.line).toBe("D");
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.issues.some((i) => i.includes("línea A"))).toBe(true);
        });

        it("should handle station existing on multiple lines", () => {
            // Retiro exists on both C and E
            const resultC = resolveSubteStation("Retiro", "C");
            expect(resultC.station?.line).toBe("C");

            const resultE = resolveSubteStation("Retiro", "E");
            expect(resultE.station?.line).toBe("E");
        });
    });

    describe("partial matches", () => {
        it("should match partial station names", () => {
            const result = resolveSubteStation("Plaza de Mayo");
            expect(result.station?.name).toBe("Plaza de Mayo");
            expect(result.station?.line).toBe("A");
        });

        it("should match partial with line filter", () => {
            const result = resolveSubteStation("Independencia", "C");
            expect(result.station?.line).toBe("C");
        });

        it("should match partial with line filter on E", () => {
            const result = resolveSubteStation("Independencia", "E");
            expect(result.station?.line).toBe("E");
        });
    });

    describe("ambiguous matches", () => {
        it("should report ambiguous matches when no line specified", () => {
            // Callao exists on both B and D
            const result = resolveSubteStation("Callao");
            expect(result.candidates.length).toBeGreaterThan(1);
            expect(result.issues.some((i) => i.includes("ambigua"))).toBe(true);
        });

        it("should resolve ambiguous match when line is specified", () => {
            const result = resolveSubteStation("Callao", "B");
            expect(result.station?.name).toBe("Callao");
            expect(result.station?.line).toBe("B");
            expect(result.issues).toHaveLength(0);
        });
    });

    describe("no matches", () => {
        it("should return error for non-existent station", () => {
            const result = resolveSubteStation("Estación Fantasma");
            expect(result.station).toBeUndefined();
            expect(result.candidates).toHaveLength(0);
            expect(result.issues.some((i) => i.includes("No se encontró"))).toBe(true);
        });
    });

    describe("normalization", () => {
        it("should handle spaces vs underscores", () => {
            const result = resolveSubteStation("Plaza de Mayo");
            expect(result.station?.name).toBe("Plaza de Mayo");
        });

        it("should be case insensitive", () => {
            const result = resolveSubteStation("CATEDRAL");
            expect(result.station?.name).toBe("Catedral");
        });

        it("should handle accents", () => {
            const result = resolveSubteStation("Jose Hernandez");
            expect(result.station?.name).toBe("José Hernández");
            expect(result.station?.line).toBe("D");
        });
    });
});
