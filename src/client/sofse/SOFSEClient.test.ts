/**
 * Unit tests for SOFSEClient and authentication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SOFSEClient } from "./SOFSEClient.js";
import { generateCredentials, generateUsername, encodePassword } from "./auth.js";

// Mock fetch globally
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

function mockJsonResponse<T>(data: T, ok = true, status = 200, statusText = "OK") {
    return {
        ok,
        status,
        statusText,
        headers: {
            get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: () => Promise.resolve(data),
    };
}

function createMockToken(): { token: string } {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64");
    return { token: `${header}.${payload}.signature` };
}

describe("SOFSE Authentication", () => {
    describe("generateUsername", () => {
        it("should generate a base64 encoded username with date and sofse suffix", () => {
            const username = generateUsername();
            expect(username).toBeTruthy();

            // Decode and check format
            const decoded = Buffer.from(username, "base64").toString();
            expect(decoded).toMatch(/^\d{8}sofse$/);
        });
    });

    describe("encodePassword", () => {
        it("should encode a username into a password", () => {
            const username = "dGVzdA==";
            const password = encodePassword(username);
            expect(password).toBeTruthy();
            expect(password).not.toBe(username);
        });
    });

    describe("generateCredentials", () => {
        it("should generate username and password pair", () => {
            const { username, password } = generateCredentials();
            expect(username).toBeTruthy();
            expect(password).toBeTruthy();
            expect(username).not.toBe(password);
        });
    });
});

describe("SOFSEClient", () => {
    let client: SOFSEClient;

    beforeEach(() => {
        vi.resetAllMocks();
        // @ts-expect-error - mocking global fetch
        globalThis.fetch = mockFetch;
        client = new SOFSEClient();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe("searchStations", () => {
        it("should search for stations and return results", async () => {
            const mockStations = [
                {
                    nombre: "Retiro (LGM)",
                    id_estacion: "332",
                    id_tramo: "1",
                    orden: "1",
                    id_referencia: "3653",
                    latitud: "-34.5909122",
                    longitud: "-58.3750538",
                    referencia_orden: "1",
                    radio: "",
                    andenes_habilitados: "8",
                    visibilidad: { totem: 1, app_mobile: 1 },
                    incluida_en_ramales: [141, 151, 9, 5, 7, 171],
                    operativa_en_ramales: [141, 151, 9, 5, 7, 171],
                },
            ];

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(createMockToken()))
                .mockResolvedValueOnce(mockJsonResponse(mockStations));

            const stations = await client.searchStations("Retiro");

            expect(stations).toHaveLength(1);
            expect(stations[0]?.nombre).toBe("Retiro (LGM)");
        });
    });

    describe("getGerencias", () => {
        it("should fetch train lines (gerencias)", async () => {
            const mockGerencias = [
                {
                    id: 5,
                    id_empresa: 1,
                    nombre: "Mitre",
                    estado: { id: 13, mensaje: "Servicio Normal", color: "#00aa00" },
                    alerta: [],
                },
            ];

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(createMockToken()))
                .mockResolvedValueOnce(mockJsonResponse(mockGerencias));

            const gerencias = await client.getGerencias();

            expect(gerencias).toHaveLength(1);
            expect(gerencias[0]?.nombre).toBe("Mitre");
        });
    });

    describe("getArrivals", () => {
        it("should fetch arrivals for a station", async () => {
            const mockArrivals = {
                timestamp: Date.now(),
                results: [],
                total: 0,
            };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(createMockToken()))
                .mockResolvedValueOnce(mockJsonResponse(mockArrivals));

            const arrivals = await client.getArrivals("332");

            expect(arrivals.results).toEqual([]);
            expect(arrivals.total).toBe(0);
        });
    });

    describe("authentication", () => {
        it("should retry with new token on 403", async () => {
            const mockStations = [
                {
                    nombre: "Test",
                    id_estacion: "1",
                    id_tramo: "1",
                    orden: "1",
                    id_referencia: "1",
                    latitud: "-34.5",
                    longitud: "-58.5",
                    referencia_orden: "1",
                    radio: "",
                    andenes_habilitados: "2",
                    visibilidad: { totem: 1, app_mobile: 1 },
                    incluida_en_ramales: [],
                    operativa_en_ramales: [],
                },
            ];

            // First token, first request (403), new token, retry success
            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(createMockToken()))
                .mockResolvedValueOnce({ ok: false, status: 403, statusText: "Forbidden", headers: { get: () => null } })
                .mockResolvedValueOnce(mockJsonResponse(createMockToken()))
                .mockResolvedValueOnce(mockJsonResponse(mockStations));

            const stations = await client.searchStations("Test");

            expect(stations).toHaveLength(1);
            expect(mockFetch).toHaveBeenCalledTimes(4);
        });
    });
});
