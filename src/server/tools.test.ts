/**
 * Unit tests for MCP tools
 */

import { describe, it, expect } from "vitest";
import {
    ListTrainLinesSchema,
    ListTrainRamalesSchema,
    ListTrainStationsSchema,
    SearchTrainStationsSchema,
    GetSubteArrivalsSchema,
    GetTrainArrivalsSchema,
    GetSubteStatusSchema,
    GetTrainStatusSchema,
} from "./tools.js";

describe("ListTrainLinesSchema", () => {
    it("should default empresaId to 1", () => {
        const result = ListTrainLinesSchema.parse({});
        expect(result.empresaId).toBe(1);
    });
});

describe("ListTrainRamalesSchema", () => {
    it("should accept line", () => {
        const result = ListTrainRamalesSchema.parse({ line: "Mitre" });
        expect(result.line).toBe("Mitre");
    });

    it("should accept lineId", () => {
        const result = ListTrainRamalesSchema.parse({ lineId: 5 });
        expect(result.lineId).toBe(5);
    });
});

describe("ListTrainStationsSchema", () => {
    it("should require ramalId", () => {
        const result = ListTrainStationsSchema.parse({ ramalId: 9 });
        expect(result.ramalId).toBe(9);
    });
});

describe("SearchTrainStationsSchema", () => {
    it("should default limit to 10", () => {
        const result = SearchTrainStationsSchema.parse({ query: "Retiro" });
        expect(result.limit).toBe(10);
    });
});

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

    it("should accept stationId input", () => {
        const input = { stationId: 123 };
        const result = GetTrainArrivalsSchema.parse(input);
        expect(result.stationId).toBe(123);
        expect(result.limit).toBe(5);
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
        const lines = [
            "Mitre",
            "Sarmiento",
            "Roca",
            "San Martín",
            "Belgrano Sur",
            "Belgrano Norte",
            "Tren de la Costa",
        ] as const;
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
        const lines = [
            "Mitre",
            "Sarmiento",
            "Roca",
            "San Martín",
            "Belgrano Sur",
            "Belgrano Norte",
            "Tren de la Costa",
        ] as const;
        for (const line of lines) {
            const result = GetTrainStatusSchema.parse({ line });
            expect(result.line).toBe(line);
        }
    });

    it("should accept includeRamales", () => {
        const result = GetTrainStatusSchema.parse({ line: "Mitre", includeRamales: true });
        expect(result.includeRamales).toBe(true);
    });

    it("should reject subte lines", () => {
        expect(() => GetTrainStatusSchema.parse({ line: "A" })).toThrow();
    });

    it("should reject invalid line", () => {
        expect(() => GetTrainStatusSchema.parse({ line: "InvalidLine" })).toThrow();
    });
});
