/**
 * Unit tests for BAClient
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BAClient } from "./BAClient.js";
import type {
    GCBASubteForecastResponse,
    GCBATrainTripUpdateResponse,
    GCBAServiceAlertsResponse,
} from "./types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("BAClient", () => {
    let client: BAClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new BAClient({
            clientId: "test_client_id",
            clientSecret: "test_client_secret",
        });
    });

    describe("getArrivals", () => {
        it("should fetch and parse subte arrivals correctly", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000); // 5 minutes from now

            const mockSubteResponse: GCBASubteForecastResponse = {
                entity: [
                    {
                        id: "1",
                        tripUpdate: {
                            trip: {
                                tripId: "trip-001",
                                routeId: "LineaA",
                                directionId: 0,
                            },
                            stopTimeUpdate: [
                                {
                                    stopSequence: 1,
                                    stopId: "Plaza_de_Mayo",
                                    arrival: {
                                        delay: 0,
                                        time: futureTime,
                                    },
                                },
                            ],
                        },
                    },
                ],
            };

            const mockTrainResponse: GCBATrainTripUpdateResponse = {
                entity: [],
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSubteResponse),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockTrainResponse),
                });

            const arrivals = await client.getArrivals({ station: "Plaza" });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]).toMatchObject({
                station: {
                    id: "Plaza_de_Mayo",
                    line: "A",
                    type: "subte",
                },
                destination: "Plaza de Mayo",
                tripId: "trip-001",
            });
            expect(arrivals[0]?.minutesAway).toBeGreaterThan(0);
        });

        it("should filter by line when specified", async () => {
            const now = Date.now();
            const futureTime = Math.floor((now + 5 * 60 * 1000) / 1000);

            const mockSubteResponse: GCBASubteForecastResponse = {
                entity: [
                    {
                        id: "1",
                        tripUpdate: {
                            trip: {
                                tripId: "trip-001",
                                routeId: "LineaA",
                                directionId: 0,
                            },
                            stopTimeUpdate: [
                                {
                                    stopSequence: 1,
                                    stopId: "Test_Station",
                                    arrival: { time: futureTime },
                                },
                            ],
                        },
                    },
                    {
                        id: "2",
                        tripUpdate: {
                            trip: {
                                tripId: "trip-002",
                                routeId: "LineaB",
                                directionId: 0,
                            },
                            stopTimeUpdate: [
                                {
                                    stopSequence: 1,
                                    stopId: "Test_Station",
                                    arrival: { time: futureTime },
                                },
                            ],
                        },
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubteResponse),
            });

            const arrivals = await client.getArrivals({
                station: "Test",
                line: "A",
            });

            expect(arrivals).toHaveLength(1);
            expect(arrivals[0]?.station.line).toBe("A");
        });

        it("should respect limit parameter", async () => {
            const now = Date.now();
            const mockSubteResponse: GCBASubteForecastResponse = {
                entity: Array.from({ length: 10 }, (_, i) => ({
                    id: `${i}`,
                    tripUpdate: {
                        trip: {
                            tripId: `trip-${i}`,
                            routeId: "LineaA",
                            directionId: 0,
                        },
                        stopTimeUpdate: [
                            {
                                stopSequence: 1,
                                stopId: "Test_Station",
                                arrival: {
                                    time: Math.floor((now + (i + 1) * 60 * 1000) / 1000),
                                },
                            },
                        ],
                    },
                })),
            };

            const mockTrainResponse: GCBATrainTripUpdateResponse = { entity: [] };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSubteResponse),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockTrainResponse),
                });

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
            });

            await expect(client.getArrivals({ station: "Test" })).rejects.toThrow(
                "API request failed: 401 Unauthorized"
            );
        });
    });

    describe("getStatus", () => {
        it("should return all subte line statuses", async () => {
            const mockSubteAlerts: GCBAServiceAlertsResponse = {
                entity: [
                    {
                        id: "alert-1",
                        alert: {
                            informedEntity: [{ routeId: "LineaA" }],
                            headerText: {
                                translation: [
                                    { text: "Servicio limitado", language: "es" },
                                ],
                            },
                            descriptionText: {
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
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSubteAlerts),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockTrainAlerts),
                });

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

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSubteAlerts),
            });

            const statuses = await client.getStatus({ type: "subte" });

            // Should only have subte lines
            expect(statuses.every((s) => s.type === "subte")).toBe(true);
            expect(statuses.length).toBe(7);
        });
    });

    describe("authentication", () => {
        it("should include client_id and client_secret in requests", async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ entity: [] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ entity: [] }),
                });

            await client.getArrivals({ station: "test" });

            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain("client_id=test_client_id");
            expect(calledUrl).toContain("client_secret=test_client_secret");
        });
    });
});
