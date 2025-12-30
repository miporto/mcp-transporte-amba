/**
 * BAClient - API client for GCBA Unified Transit API
 *
 * Handles authentication and fetches real-time transit data
 * for Subte (Metro) and Train systems in Buenos Aires.
 */

import type {
    Arrival,
    BAClientConfig,
    GCBASubteForecastResponse,
    GCBATrainTripUpdateResponse,
    GCBAServiceAlertsResponse,
    GetArrivalsParams,
    GetStatusParams,
    LineStatus,
    TransitLine,
} from "./types.js";

const DEFAULT_BASE_URL = "https://apitransporte.buenosaires.gob.ar";

/** Map route IDs to line names */
const SUBTE_ROUTE_MAP: Record<string, TransitLine> = {
    "LineaA": "A",
    "LineaB": "B",
    "LineaC": "C",
    "LineaD": "D",
    "LineaE": "E",
    "LineaH": "H",
    "Premetro": "Premetro",
};

const TRAIN_ROUTE_MAP: Record<string, TransitLine> = {
    "Mitre": "Mitre",
    "Sarmiento": "Sarmiento",
    "Roca": "Roca",
    "SanMartin": "San Martín",
    "BelgranoSur": "Belgrano Sur",
    "BelgranoNorte": "Belgrano Norte",
};

export class BAClient {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly baseUrl: string;

    constructor(config: BAClientConfig) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    }

    /**
     * Build URL with authentication query params
     */
    private buildUrl(endpoint: string): string {
        const url = new URL(endpoint, this.baseUrl);
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("client_secret", this.clientSecret);
        return url.toString();
    }

    /**
     * Make authenticated GET request
     */
    private async fetch<T>(endpoint: string): Promise<T> {
        const url = this.buildUrl(endpoint);
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status} ${response.statusText}`
            );
        }

        // Validate content-type is JSON
        const contentType = response.headers.get("content-type");
        if (!contentType?.startsWith("application/json")) {
            const text = await response.text();
            throw new Error(
                `API returned non-JSON response (${contentType}): ${text.slice(0, 200)}`
            );
        }

        let data: unknown;
        try {
            data = await response.json();
        } catch {
            throw new Error("Failed to parse JSON response from API");
        }

        // Check for API error responses
        if (data && typeof data === "object" && "error" in data) {
            throw new Error(`API error: ${String((data as { error: unknown }).error)}`);
        }

        return data as T;
    }

    /**
     * Get real-time arrivals for a station
     */
    async getArrivals(params: GetArrivalsParams): Promise<Arrival[]> {
        const arrivals: Arrival[] = [];
        const limit = params.limit ?? 5;

        // Fetch subte data
        if (!params.line || this.isSubteLine(params.line)) {
            const subteData = await this.fetchSubteForecasts();
            arrivals.push(...this.parseSubteArrivals(subteData, params));
        }

        // Fetch train data
        if (!params.line || this.isTrainLine(params.line)) {
            const trainData = await this.fetchTrainTripUpdates();
            arrivals.push(...this.parseTrainArrivals(trainData, params));
        }

        // Sort by arrival time and limit
        return arrivals
            .sort((a, b) => a.minutesAway - b.minutesAway)
            .slice(0, limit);
    }

    /**
     * Get service status for lines
     */
    async getStatus(params: GetStatusParams): Promise<LineStatus[]> {
        const statuses: LineStatus[] = [];

        // Fetch subte alerts
        if (!params.type || params.type === "subte") {
            const alerts = await this.fetchSubteAlerts();
            statuses.push(...this.parseSubteStatus(alerts, params.line));
        }

        // Fetch train alerts
        if (!params.type || params.type === "train") {
            const alerts = await this.fetchTrainAlerts();
            statuses.push(...this.parseTrainStatus(alerts, params.line));
        }

        return statuses;
    }

    /**
     * Fetch subte GTFS-RT forecast data
     */
    private async fetchSubteForecasts(): Promise<GCBASubteForecastResponse> {
        return this.fetch<GCBASubteForecastResponse>("/subtes/forecastGTFS");
    }

    /**
     * Fetch train GTFS-RT trip updates
     */
    private async fetchTrainTripUpdates(): Promise<GCBATrainTripUpdateResponse> {
        return this.fetch<GCBATrainTripUpdateResponse>("/trenes/tripUpdates");
    }

    /**
     * Fetch subte service alerts
     */
    private async fetchSubteAlerts(): Promise<GCBAServiceAlertsResponse> {
        return this.fetch<GCBAServiceAlertsResponse>("/subtes/serviceAlerts?json=1");
    }

    /**
     * Fetch train service alerts
     */
    private async fetchTrainAlerts(): Promise<GCBAServiceAlertsResponse> {
        return this.fetch<GCBAServiceAlertsResponse>("/trenes/serviceAlerts?json=1");
    }

    /**
     * Parse subte forecast data into arrivals
     */
    private parseSubteArrivals(
        data: GCBASubteForecastResponse,
        params: GetArrivalsParams
    ): Arrival[] {
        const arrivals: Arrival[] = [];
        const now = Date.now();

        for (const entity of data.entity ?? []) {
            if (!entity.tripUpdate?.stopTimeUpdate) continue;

            const routeId = entity.tripUpdate.trip.routeId;
            const line = SUBTE_ROUTE_MAP[routeId];
            if (!line) continue;

            // Filter by line if specified
            if (params.line && line !== params.line) continue;

            for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
                const stopId = stopUpdate.stopId;

                // Filter by station (case-insensitive partial match)
                if (!stopId.toLowerCase().includes(params.station.toLowerCase())) {
                    continue;
                }

                const arrivalTime = stopUpdate.arrival?.time
                    ? new Date(stopUpdate.arrival.time * 1000)
                    : null;

                if (!arrivalTime || arrivalTime.getTime() < now) continue;

                const delaySeconds = stopUpdate.arrival?.delay ?? 0;
                const minutesAway = Math.round((arrivalTime.getTime() - now) / 60000);

                arrivals.push({
                    station: {
                        id: stopId,
                        name: stopId, // Would need station name lookup
                        line,
                        type: "subte",
                    },
                    destination: this.getDirectionName(
                        entity.tripUpdate.trip.directionId,
                        line
                    ),
                    arrivalTime: arrivalTime.toISOString(),
                    delaySeconds,
                    minutesAway,
                    tripId: entity.tripUpdate.trip.tripId,
                });
            }
        }

        return arrivals;
    }

    /**
     * Parse train trip updates into arrivals
     */
    private parseTrainArrivals(
        data: GCBATrainTripUpdateResponse,
        params: GetArrivalsParams
    ): Arrival[] {
        const arrivals: Arrival[] = [];
        const now = Date.now();

        for (const entity of data.entity ?? []) {
            if (!entity.tripUpdate?.stopTimeUpdate) continue;

            const routeId = entity.tripUpdate.trip.routeId;
            const line = TRAIN_ROUTE_MAP[routeId];
            if (!line) continue;

            // Filter by line if specified
            if (params.line && line !== params.line) continue;

            for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
                const stopId = stopUpdate.stopId;

                // Filter by station
                if (!stopId.toLowerCase().includes(params.station.toLowerCase())) {
                    continue;
                }

                const arrivalTime = stopUpdate.arrival?.time
                    ? new Date(stopUpdate.arrival.time * 1000)
                    : null;

                if (!arrivalTime || arrivalTime.getTime() < now) continue;

                const delaySeconds = stopUpdate.arrival?.delay ?? 0;
                const minutesAway = Math.round((arrivalTime.getTime() - now) / 60000);

                arrivals.push({
                    station: {
                        id: stopId,
                        name: stopId,
                        line,
                        type: "train",
                    },
                    destination: this.getDirectionName(
                        entity.tripUpdate.trip.directionId,
                        line
                    ),
                    arrivalTime: arrivalTime.toISOString(),
                    delaySeconds,
                    minutesAway,
                    tripId: entity.tripUpdate.trip.tripId,
                });
            }
        }

        return arrivals;
    }

    /**
     * Parse subte alerts into line status
     */
    private parseSubteStatus(
        data: GCBAServiceAlertsResponse,
        filterLine?: TransitLine
    ): LineStatus[] {
        const statusMap = new Map<TransitLine, LineStatus>();

        // Initialize all subte lines
        const subteLines: TransitLine[] = ["A", "B", "C", "D", "E", "H", "Premetro"];
        for (const line of subteLines) {
            if (filterLine && line !== filterLine) continue;
            statusMap.set(line, {
                line,
                type: "subte",
                isOperational: true,
                alerts: [],
            });
        }

        // Parse alerts
        for (const entity of data.entity ?? []) {
            if (!entity.alert) continue;

            const routeIds = entity.alert.informed_entity
                ?.map((e) => e.route_id)
                .filter(Boolean) ?? [];

            for (const routeId of routeIds) {
                if (!routeId) continue;
                const line = SUBTE_ROUTE_MAP[routeId];
                if (!line) continue;

                const status = statusMap.get(line);
                if (!status) continue;

                const title =
                    entity.alert.header_text?.translation.find((t) => t.language === "es")
                        ?.text ?? "Alerta de servicio";
                const description =
                    entity.alert.description_text?.translation.find(
                        (t) => t.language === "es"
                    )?.text ?? "";

                status.alerts.push({
                    line,
                    type: "subte",
                    severity: "warning",
                    title,
                    description,
                });
            }
        }

        return Array.from(statusMap.values());
    }

    /**
     * Parse train alerts into line status
     */
    private parseTrainStatus(
        data: GCBAServiceAlertsResponse,
        filterLine?: TransitLine
    ): LineStatus[] {
        const statusMap = new Map<TransitLine, LineStatus>();

        // Initialize all train lines
        const trainLines: TransitLine[] = [
            "Mitre",
            "Sarmiento",
            "Roca",
            "San Martín",
            "Belgrano Sur",
            "Belgrano Norte",
        ];
        for (const line of trainLines) {
            if (filterLine && line !== filterLine) continue;
            statusMap.set(line, {
                line,
                type: "train",
                isOperational: true,
                alerts: [],
            });
        }

        // Parse alerts (similar to subte)
        for (const entity of data.entity ?? []) {
            if (!entity.alert) continue;

            const routeIds = entity.alert.informed_entity
                ?.map((e) => e.route_id)
                .filter(Boolean) ?? [];

            for (const routeId of routeIds) {
                if (!routeId) continue;
                const line = TRAIN_ROUTE_MAP[routeId];
                if (!line) continue;

                const status = statusMap.get(line);
                if (!status) continue;

                const title =
                    entity.alert.header_text?.translation.find((t) => t.language === "es")
                        ?.text ?? "Alerta de servicio";
                const description =
                    entity.alert.description_text?.translation.find(
                        (t) => t.language === "es"
                    )?.text ?? "";

                status.alerts.push({
                    line,
                    type: "train",
                    severity: "warning",
                    title,
                    description,
                });
            }
        }

        return Array.from(statusMap.values());
    }

    /**
     * Get human-readable direction name
     */
    private getDirectionName(directionId: number, line: TransitLine): string {
        // Direction ID 0 or 1, mapped to terminal stations per line
        // This is simplified - would need full GTFS static data for accuracy
        const directions: Record<TransitLine, [string, string]> = {
            A: ["Plaza de Mayo", "San Pedrito"],
            B: ["L.N. Alem", "J.M. de Rosas"],
            C: ["Constitución", "Retiro"],
            D: ["Catedral", "Congreso de Tucumán"],
            E: ["Bolívar", "Plaza de los Virreyes"],
            H: ["Hospitales", "Las Heras"],
            Premetro: ["Intendente Saguier", "Centro Cívico"],
            Mitre: ["Retiro", "Tigre/Suárez/Mitre"],
            Sarmiento: ["Once", "Moreno"],
            Roca: ["Constitución", "La Plata/Bosques/Korn"],
            "San Martín": ["Retiro", "Pilar"],
            "Belgrano Sur": ["Buenos Aires", "Marinos del Fournier"],
            "Belgrano Norte": ["Retiro", "Villa Rosa"],
        };

        const [dir0, dir1] = directions[line] ?? ["Terminal A", "Terminal B"];
        return directionId === 0 ? dir0 : dir1;
    }

    /**
     * Check if line is a subte line
     */
    private isSubteLine(line: TransitLine): boolean {
        return ["A", "B", "C", "D", "E", "H", "Premetro"].includes(line);
    }

    /**
     * Check if line is a train line
     */
    private isTrainLine(line: TransitLine): boolean {
        return [
            "Mitre",
            "Sarmiento",
            "Roca",
            "San Martín",
            "Belgrano Sur",
            "Belgrano Norte",
        ].includes(line);
    }
}

/**
 * Create BAClient from environment variables
 */
export function createClientFromEnv(): BAClient {
    const clientId = process.env.BA_CLIENT_ID;
    const clientSecret = process.env.BA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Missing BA_CLIENT_ID or BA_CLIENT_SECRET environment variables"
        );
    }

    return new BAClient({
        clientId,
        clientSecret,
        baseUrl: process.env.BA_API_URL,
    });
}
