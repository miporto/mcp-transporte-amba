/**
 * Unit tests for MCP tools
 */

import { describe, it, expect } from "vitest";
import {
    GetSubteArrivalsSchema,
    GetTrainArrivalsSchema,
    GetSubteStatusSchema,
    GetTrainStatusSchema,
} from "./tools.js";

describe("GetSubteArrivalsSchema", () => {
    it("should accept valid minimal input", () => {
        const input = { station: "Plaza de Mayo" };
        const result = GetSubteArrivalsSchema.parse(input);

        expect(result.station).toBe("Plaza de Mayo");
        expect(result.limit).toBe(5); // default
    });

    it("should accept valid full input", () => {
        const input = {
            station: "Plaza de Mayo",
            line: "A",
            direction: "San Pedrito",
            limit: 10,
        };
        const result = GetSubteArrivalsSchema.parse(input);

        expect(result).toEqual(input);
    });

    it("should accept all subte lines", () => {
        const lines = ["A", "B", "C", "D", "E", "H", "Premetro"] as const;
        for (const line of lines) {
            const result = GetSubteArrivalsSchema.parse({ station: "Test", line });
            expect(result.line).toBe(line);
        }
    });

    it("should reject train lines", () => {
        expect(() =>
            GetSubteArrivalsSchema.parse({ station: "Test", line: "Mitre" })
        ).toThrow();
    });

    it("should reject empty station", () => {
        expect(() => GetSubteArrivalsSchema.parse({ station: "" })).toThrow();
    });

    it("should reject invalid line", () => {
        expect(() =>
            GetSubteArrivalsSchema.parse({ station: "Test", line: "InvalidLine" })
        ).toThrow();
    });

    it("should reject limit out of range", () => {
        expect(() =>
            GetSubteArrivalsSchema.parse({ station: "Test", limit: 0 })
        ).toThrow();
        expect(() =>
            GetSubteArrivalsSchema.parse({ station: "Test", limit: 100 })
        ).toThrow();
    });
});

describe("GetTrainArrivalsSchema", () => {
    it("should accept valid minimal input", () => {
        const input = { station: "Retiro" };
        const result = GetTrainArrivalsSchema.parse(input);

        expect(result.station).toBe("Retiro");
        expect(result.limit).toBe(5); // default
    });

    it("should accept valid full input", () => {
        const input = {
            station: "Retiro",
            line: "Mitre",
            direction: "Tigre",
            limit: 10,
        };
        const result = GetTrainArrivalsSchema.parse(input);

        expect(result).toEqual(input);
    });

    it("should accept all train lines", () => {
        const lines = ["Mitre", "Sarmiento", "Roca", "San Martín", "Belgrano Sur", "Belgrano Norte"] as const;
        for (const line of lines) {
            const result = GetTrainArrivalsSchema.parse({ station: "Test", line });
            expect(result.line).toBe(line);
        }
    });

    it("should reject subte lines", () => {
        expect(() =>
            GetTrainArrivalsSchema.parse({ station: "Test", line: "A" })
        ).toThrow();
    });

    it("should reject empty station", () => {
        expect(() => GetTrainArrivalsSchema.parse({ station: "" })).toThrow();
    });

    it("should reject limit out of range", () => {
        expect(() =>
            GetTrainArrivalsSchema.parse({ station: "Test", limit: 0 })
        ).toThrow();
        expect(() =>
            GetTrainArrivalsSchema.parse({ station: "Test", limit: 100 })
        ).toThrow();
    });
});

describe("GetSubteStatusSchema", () => {
    it("should accept empty input", () => {
        const result = GetSubteStatusSchema.parse({});
        expect(result).toEqual({});
    });

    it("should accept valid subte line filter", () => {
        const result = GetSubteStatusSchema.parse({ line: "B" });
        expect(result.line).toBe("B");
    });

    it("should accept all subte lines", () => {
        const lines = ["A", "B", "C", "D", "E", "H", "Premetro"] as const;
        for (const line of lines) {
            const result = GetSubteStatusSchema.parse({ line });
            expect(result.line).toBe(line);
        }
    });

    it("should reject train lines", () => {
        expect(() => GetSubteStatusSchema.parse({ line: "Mitre" })).toThrow();
    });

    it("should reject invalid line", () => {
        expect(() => GetSubteStatusSchema.parse({ line: "InvalidLine" })).toThrow();
    });
});

describe("GetTrainStatusSchema", () => {
    it("should accept empty input", () => {
        const result = GetTrainStatusSchema.parse({});
        expect(result).toEqual({});
    });

    it("should accept valid train line filter", () => {
        const result = GetTrainStatusSchema.parse({ line: "Sarmiento" });
        expect(result.line).toBe("Sarmiento");
    });

    it("should accept all train lines", () => {
        const lines = ["Mitre", "Sarmiento", "Roca", "San Martín", "Belgrano Sur", "Belgrano Norte"] as const;
        for (const line of lines) {
            const result = GetTrainStatusSchema.parse({ line });
            expect(result.line).toBe(line);
        }
    });

    it("should reject subte lines", () => {
        expect(() => GetTrainStatusSchema.parse({ line: "A" })).toThrow();
    });

    it("should reject invalid line", () => {
        expect(() => GetTrainStatusSchema.parse({ line: "InvalidLine" })).toThrow();
    });
});
