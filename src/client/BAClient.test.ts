/**
 * Unit tests for BAClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BAClient } from "./BAClient.js";
import type {
    GCBASubteForecastResponse,
    GCBAServiceAlertsResponse,
} from "./types.js";
import type { SOFSEArribosResponse, SOFSEGerencia } from "./sofse/index.js";

// Mock fetch globally
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

/**
 * Helper to create mock Response objects with proper headers
 */
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

/**
 * Helper to create a mock subte response entity
 */
function createMockSubteEntity(
    tripId: string,
    routeId: string,
    directionId: number,
    stations: Array<{ stopId: string; stopName: string; arrivalTime: number; delay?: number }>
): GCBASubteForecastResponse["Entity"][0] {
    return {
        ID: `${routeId}_${tripId}`,
        Linea: {
            Trip_Id: tripId,
            Route_Id: routeId,
            Direction_ID: directionId,
            start_time: "10:00:00",
            start_date: "20251230",
            Estaciones: stations.map((s) => ({
                stop_id: s.stopId,
                stop_name: s.stopName,
                arrival: {
                    time: s.arrivalTime,
                    delay: s.delay ?? 0,
                },
                departure: {
                    time: s.arrivalTime + 24,
                    delay: s.delay ?? 0,
                },
            })),
        },
    };
}

/**
 * Helper to create a mock subte forecast response
 */
function createMockSubteForecast(
    entities: GCBASubteForecastResponse["Entity"]
): GCBASubteForecastResponse {
    return {
        Header: { timestamp: Math.floor(Date.now() / 1000) },
        Entity: entities,
    };
}

/**
 * Helper to create a mock SOFSE token response
 */
function createMockSOFSEToken(): { token: string } {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64");
    return { token: `${header}.${payload}.signature` };
}

function createMockSOFSEArribosWithResults(results: SOFSEArribosResponse["results"]): SOFSEArribosResponse {
    return {
        timestamp: Math.floor(Date.now() / 1000),
        results,
        total: results.length,
    };
}

/**
 * Helper to create mock SOFSE gerencias response
 */
function createMockSOFSEGerencias(gerencias: Partial<SOFSEGerencia>[]): SOFSEGerencia[] {
    return gerencias.map((g) => ({
        id: g.id ?? 5,
        id_empresa: g.id_empresa ?? 1,
        nombre: g.nombre ?? "Mitre",
        estado: g.estado ?? { id: 13, mensaje: "Servicio Normal", color: "#00aa00" },
        alerta: g.alerta ?? [],
    }));
}

describe("BAClient", () => {
    let client: BAClient;

    beforeEach(() => {
        vi.resetAllMocks();
        // @ts-expect-error - mocking global fetch
        globalThis.fetch = mockFetch;
        // Create a fresh client for each test
        client = new BAClient({
            clientId: "test_client_id",
            clientSecret: "test_client_secret",
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe("getArrivals", () => {
        it("should fetch and parse subte arrivals correctly", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000); // 5 minutes from now

            const mockSubteResponse = createMockSubteForecast([
                createMockSubteEntity("A11", "LineaA", 0, [
                    { stopId: "1076N", stopName: "Plaza de Mayo", arrivalTime: futureTime, delay: 0 },
                ]),
            ]);

            // Filter by subte line to avoid SOFSE calls
            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({ station: "Plaza", line: "A" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]).toMatchObject({
                station: {
                    id: "1076N",
                    name: "Plaza de Mayo",
                    line: "A",
                    type: "subte",
                },
                destination: "Plaza de Mayo",
                tripId: "A11",
            });
            expect(arrivals[0]?.minutesAway).toBeGreaterThan(0);
        });

        it("should filter by line when specified", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000);

            const mockSubteResponse = createMockSubteForecast([
                createMockSubteEntity("A11", "LineaA", 0, [
                    { stopId: "1001", stopName: "Test Station", arrivalTime: futureTime },
                ]),
                createMockSubteEntity("B22", "LineaB", 0, [
                    { stopId: "2001", stopName: "Test Station", arrivalTime: futureTime },
                ]),
            ]);

            // Only subte API is called when filtering by subte line
            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({
                station: "Test",
                line: "A",
            });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.station.line).toBe("A");
        });

        it("should respect limit parameter", async () => {
            const now = Date.now();

            const mockSubteResponse = createMockSubteForecast(
                Array.from({ length: 10 }, (_, i) =>
                    createMockSubteEntity(`A${i}`, "LineaA", 0, [
                        {
                            stopId: `100${i}`,
                            stopName: "Test Station",
                            arrivalTime: Math.floor((now + (i + 1) * 60 * 1000) / 1000),
                        },
                    ])
                )
            );

            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({
                station: "Test",
                line: "A",
                limit: 3,
            });

            expect(arrivals).toHaveLength(3);
        });

        it("should handle API errors gracefully", async () => {
            // Request a specific subte line to avoid SOFSE calls
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                headers: {
                    get: () => null,
                },
            });

            await expect(client.getArrivals({ station: "Test", line: "A" })).rejects.toThrow(
                "API request failed: 401 Unauthorized"
            );
        });

        it("should match station names with spaces correctly", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000);

            const mockSubteResponse = createMockSubteForecast([
                createMockSubteEntity("A11", "LineaA", 0, [
                    { stopId: "1076N", stopName: "Plaza de Mayo", arrivalTime: futureTime },
                ]),
            ]);

            // Filter by subte line to avoid SOFSE calls
            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({ station: "Plaza de Mayo", line: "A" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.station.name).toBe("Plaza de Mayo");
        });

        it("should match station names with accents when query omits them", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000);

            const mockSubteResponse = createMockSubteForecast([
                createMockSubteEntity("A11", "LineaA", 0, [
                    { stopId: "1072N", stopName: "Sáenz Peña", arrivalTime: futureTime },
                ]),
            ]);

            // Filter by subte line to avoid SOFSE calls
            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({ station: "Saenz Pena", line: "A" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.station.name).toBe("Sáenz Peña");
        });

        it("should include delay information", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000);

            const mockSubteResponse = createMockSubteForecast([
                createMockSubteEntity("A11", "LineaA", 0, [
                    { stopId: "1076N", stopName: "Plaza de Mayo", arrivalTime: futureTime, delay: 120 },
                ]),
            ]);

            // Filter by subte line to avoid SOFSE calls
            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            const arrivals = await client.getArrivals({ station: "Plaza de Mayo", line: "A" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.delaySeconds).toBe(120);
        });
    });

    describe("getStatus", () => {
        it("should return all subte line statuses", async () => {
            const mockSubteAlerts: GCBAServiceAlertsResponse = {
                entity: [
                    {
                        id: "alert-1",
                        alert: {
                            informed_entity: [{ route_id: "LineaA" }],
                            header_text: {
                                translation: [
                                    { text: "Servicio limitado", language: "es" },
                                ],
                            },
                            description_text: {
                                translation: [
                                    { text: "Por obras en la estación", language: "es" },
                                ],
                            },
                        },
                    },
                ],
            };

            const mockSOFSEGerencias = createMockSOFSEGerencias([
                { id: 1, nombre: "Sarmiento" },
                { id: 5, nombre: "Mitre" },
                { id: 11, nombre: "Roca" },
                { id: 21, nombre: "Belgrano Sur" },
                { id: 31, nombre: "San Martín" },
                { id: 41, nombre: "Tren de la Costa" },
                { id: 51, nombre: "Belgrano Norte" },
            ]);

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteAlerts))
                .mockResolvedValueOnce(mockJsonResponse(createMockSOFSEToken()))
                .mockResolvedValueOnce(mockJsonResponse(mockSOFSEGerencias));

            const statuses = await client.getStatus({});

            // Should have all lines (7 subte + 7 train)
            expect(statuses.length).toBe(14);

            // Line A should have an alert
            const lineA = statuses.find((s) => s.line === "A");
            expect(lineA?.alerts).toHaveLength(1);
            expect(lineA?.alerts[0]?.title).toBe("Servicio limitado");
        });

        it("should filter by type", async () => {
            const mockSubteAlerts: GCBAServiceAlertsResponse = { entity: [] };

            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteAlerts));

            const statuses = await client.getStatus({ type: "subte" });

            // Should only have subte lines
            expect(statuses.every((s) => s.type === "subte")).toBe(true);
            expect(statuses.length).toBe(7);
        });
    });

    describe("authentication", () => {
        it("should include client_id and client_secret in requests", async () => {
            const mockSubteResponse = createMockSubteForecast([]);

            mockFetch.mockResolvedValueOnce(mockJsonResponse(mockSubteResponse));

            await client.getArrivals({ station: "test", line: "A" });

            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain("client_id=test_client_id");
            expect(calledUrl).toContain("client_secret=test_client_secret");
        });
    });

    describe("getTrainArrivals", () => {
        it("should map SOFSE ramal_id to train line via live index", async () => {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, "0");
            const mm = String((now.getMinutes() + 5) % 60).padStart(2, "0");
            const arrivalTime = `${hh}:${mm}:00`;

            const mockRamales = [
                {
                    id: 9,
                    id_estacion_inicial: 1,
                    id_estacion_final: 2,
                    id_gerencia: 5,
                    nombre: "Retiro - Tigre",
                    estaciones: 10,
                    operativo: 1,
                    es_electrico: 1,
                    tipo_id: 1,
                    puntualidad_tolerancia: 0,
                    siglas: "MIT",
                    publico: true,
                    orden_ramal: 1,
                    mostrar_en_panel_cumplimiento: true,
                    cabecera_inicial: {
                        id: 1,
                        nombre: "Retiro",
                        siglas: "RET",
                        nombre_corto: "Retiro",
                        visibilidad: "1",
                    },
                    cabecera_final: {
                        id: 2,
                        nombre: "Tigre",
                        siglas: "TIG",
                        nombre_corto: "Tigre",
                        visibilidad: "1",
                    },
                    alerta: [],
                },
            ];

            const mockArribos = createMockSOFSEArribosWithResults([
                {
                    id: 1,
                    ramal_id: 9,
                    ramal_nombre: "Retiro - Tigre",
                    cabecera: "Retiro",
                    destino: "Tigre",
                    estacion_id: 100,
                    estacion_nombre: "Retiro",
                    anden: "1",
                    hora_llegada: arrivalTime,
                    hora_salida: arrivalTime,
                    tiempo_estimado: 300,
                    estado: "EN HORARIO",
                    tren_id: "T123",
                    formacion_id: null,
                    en_viaje: true,
                },
            ]);

            mockFetch
                // SOFSE auth
                .mockResolvedValueOnce(mockJsonResponse(createMockSOFSEToken()))
                // getGerencias (Mitre only)
                .mockResolvedValueOnce(mockJsonResponse(createMockSOFSEGerencias([{ id: 5, nombre: "Mitre" }])))
                // getRamales (Mitre)
                .mockResolvedValueOnce(mockJsonResponse(mockRamales))
                // getArrivals
                .mockResolvedValueOnce(mockJsonResponse(mockArribos));

            const arrivals = await client.getTrainArrivals({ stationId: 100, line: "Mitre" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.station.line).toBe("Mitre");
            expect(arrivals[0]?.ramalId).toBe(9);
            expect(arrivals[0]?.ramalName).toBe("Retiro - Tigre");
        });
    });
});
