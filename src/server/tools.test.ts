/**
 * Unit tests for MCP tools
 */

import { describe, it, expect } from "vitest";
import { GetArrivalsSchema, GetStatusSchema } from "./tools.js";

describe("GetArrivalsSchema", () => {
    it("should accept valid minimal input", () => {
        const input = { station: "Retiro" };
        const result = GetArrivalsSchema.parse(input);

        expect(result.station).toBe("Retiro");
        expect(result.limit).toBe(5); // default
    });

    it("should accept valid full input", () => {
        const input = {
            station: "Plaza de Mayo",
            line: "A",
            direction: "San Pedrito",
            limit: 10,
        };
        const result = GetArrivalsSchema.parse(input);

        expect(result).toEqual(input);
    });

    it("should accept train lines", () => {
        const input = { station: "Retiro", line: "Mitre" };
        const result = GetArrivalsSchema.parse(input);

        expect(result.line).toBe("Mitre");
    });

    it("should reject empty station", () => {
        expect(() => GetArrivalsSchema.parse({ station: "" })).toThrow();
    });

    it("should reject invalid line", () => {
        expect(() =>
            GetArrivalsSchema.parse({ station: "Test", line: "InvalidLine" })
        ).toThrow();
    });

    it("should reject limit out of range", () => {
        expect(() =>
            GetArrivalsSchema.parse({ station: "Test", limit: 0 })
        ).toThrow();
        expect(() =>
            GetArrivalsSchema.parse({ station: "Test", limit: 100 })
        ).toThrow();
    });
});

describe("GetStatusSchema", () => {
    it("should accept empty input", () => {
        const result = GetStatusSchema.parse({});
        expect(result).toEqual({});
    });

    it("should accept valid line filter", () => {
        const result = GetStatusSchema.parse({ line: "B" });
        expect(result.line).toBe("B");
    });

    it("should accept valid type filter", () => {
        const result = GetStatusSchema.parse({ type: "subte" });
        expect(result.type).toBe("subte");
    });

    it("should accept both filters", () => {
        const result = GetStatusSchema.parse({ line: "Sarmiento", type: "train" });
        expect(result).toEqual({ line: "Sarmiento", type: "train" });
    });

    it("should reject invalid type", () => {
        expect(() => GetStatusSchema.parse({ type: "bus" })).toThrow();
    });
});
