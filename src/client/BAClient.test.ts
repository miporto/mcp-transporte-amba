/**
 * Unit tests for BAClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BAClient } from "./BAClient.js";
import type {
    GCBASubteForecastResponse,
    GCBATrainTripUpdateResponse,
    GCBAServiceAlertsResponse,
} from "./types.js";

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

describe("BAClient", () => {
    let client: BAClient;

    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-expect-error - mocking global fetch
        globalThis.fetch = mockFetch;
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

            const mockTrainResponse: GCBATrainTripUpdateResponse = {
                entity: [],
            };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            const arrivals = await client.getArrivals({ station: "Plaza" });

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

            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            const arrivals = await client.getArrivals({
                station: "Test",
                limit: 3,
            });

            expect(arrivals).toHaveLength(3);
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                headers: {
                    get: () => null,
                },
            });

            await expect(client.getArrivals({ station: "Test" })).rejects.toThrow(
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

            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            const arrivals = await client.getArrivals({ station: "Plaza de Mayo" });

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

            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            const arrivals = await client.getArrivals({ station: "Saenz Pena" });

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

            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            const arrivals = await client.getArrivals({ station: "Plaza de Mayo" });

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

            const mockTrainAlerts: GCBAServiceAlertsResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteAlerts))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainAlerts));

            const statuses = await client.getStatus({});

            // Should have all lines (7 subte + 6 train)
            expect(statuses.length).toBe(13);

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
            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce(mockJsonResponse(mockSubteResponse))
                .mockResolvedValueOnce(mockJsonResponse(mockTrainResponse));

            await client.getArrivals({ station: "test" });

            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain("client_id=test_client_id");
            expect(calledUrl).toContain("client_secret=test_client_secret");
        });
    });
});
