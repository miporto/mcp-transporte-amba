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
    GCBAServiceAlertsResponse,
    GetArrivalsParams,
    GetStatusParams,
    LineStatus,
    TransitLine,
    TrainLine,
} from "./types.js";
import { normalizeStationString } from "./stringUtils.js";
import { SOFSEClient, SOFSE_LINE_MAP } from "./sofse/index.js";

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

const TRAIN_LINES: TrainLine[] = [
    "Mitre",
    "Sarmiento",
    "Roca",
    "San Martín",
    "Belgrano Sur",
    "Belgrano Norte",
    "Tren de la Costa",
];

export class BAClient {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly baseUrl: string;
    private readonly sofseClient: SOFSEClient;

    constructor(config: BAClientConfig) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.sofseClient = new SOFSEClient();
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

        // Fetch train data from SOFSE
        if (!params.line || this.isTrainLine(params.line)) {
            const trainArrivals = await this.fetchTrainArrivalsFromSOFSE(params);
            arrivals.push(...trainArrivals);
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

        // Fetch train status from SOFSE
        if (!params.type || params.type === "train") {
            const trainStatuses = await this.fetchTrainStatusFromSOFSE(params.line);
            statuses.push(...trainStatuses);
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
     * Fetch subte service alerts
     */
    private async fetchSubteAlerts(): Promise<GCBAServiceAlertsResponse> {
        return this.fetch<GCBAServiceAlertsResponse>("/subtes/serviceAlerts?json=1");
    }

    /**
     * Fetch train arrivals from SOFSE API
     */
    private async fetchTrainArrivalsFromSOFSE(params: GetArrivalsParams): Promise<Arrival[]> {
        const arrivals: Arrival[] = [];
        const now = Date.now();

        // Search for stations matching the query
        const stations = await this.sofseClient.searchStations(params.station);
        if (stations.length === 0) {
            return arrivals;
        }

        // Get arrivals for the first matching station
        const station = stations[0];
        if (!station) {
            return arrivals;
        }

        const response = await this.sofseClient.getArrivals(station.id_estacion, {
            cantidad: params.limit ?? 5,
        });

        // Convert SOFSE arrivals to our Arrival format
        for (const arribo of response.results) {
            // Determine the line from the ramal
            const line = this.getLineFromRamalId(arribo.ramal_id) ?? "Mitre";

            // Filter by line if specified
            if (params.line && line !== params.line) continue;

            // Parse arrival time
            const arrivalTime = this.parseSOFSETime(arribo.hora_llegada);
            if (!arrivalTime || arrivalTime.getTime() < now) continue;

            const minutesAway = Math.round((arrivalTime.getTime() - now) / 60000);

            arrivals.push({
                station: {
                    id: String(arribo.estacion_id),
                    name: arribo.estacion_nombre,
                    line,
                    type: "train",
                },
                destination: arribo.destino || arribo.cabecera,
                arrivalTime: arrivalTime.toISOString(),
                delaySeconds: 0,
                minutesAway,
                tripId: arribo.tren_id ?? `sofse-${arribo.id}`,
            });
        }

        return arrivals;
    }

    /**
     * Fetch train status from SOFSE API
     */
    private async fetchTrainStatusFromSOFSE(filterLine?: TransitLine): Promise<LineStatus[]> {
        const gerencias = await this.sofseClient.getGerencias();
        const statuses: LineStatus[] = [];

        for (const gerencia of gerencias) {
            const lineName = SOFSE_LINE_MAP[gerencia.id];
            if (!lineName) continue;

            // Skip non-train lines (like Regionales)
            if (!TRAIN_LINES.includes(lineName as TrainLine)) continue;

            const line = lineName as TransitLine;

            // Filter by line if specified
            if (filterLine && line !== filterLine) continue;

            const alerts = gerencia.alerta.map((a) => ({
                line,
                type: "train" as const,
                severity: this.mapSOFSESeverity(a.criticidad_orden),
                title: gerencia.estado.mensaje,
                description: a.contenido,
                startTime: a.vigencia_desde,
                endTime: a.vigencia_hasta ?? undefined,
            }));

            statuses.push({
                line,
                type: "train",
                isOperational: gerencia.estado.id !== 1,
                alerts,
            });
        }

        return statuses;
    }

    /**
     * Parse SOFSE time string (HH:MM or HH:MM:SS) to Date
     */
    private parseSOFSETime(timeStr: string): Date | null {
        if (!timeStr) return null;

        const now = new Date();
        const parts = timeStr.split(":");
        if (parts.length < 2) return null;

        const hours = parseInt(parts[0] ?? "0", 10);
        const minutes = parseInt(parts[1] ?? "0", 10);
        const seconds = parts[2] ? parseInt(parts[2], 10) : 0;

        const result = new Date(now);
        result.setHours(hours, minutes, seconds, 0);

        // If the time is earlier than now, assume it's tomorrow
        if (result.getTime() < now.getTime()) {
            result.setDate(result.getDate() + 1);
        }

        return result;
    }

    /**
     * Get line name from SOFSE ramal ID
     */
    private getLineFromRamalId(ramalId: number): TrainLine | null {
        // Ramal IDs to gerencia (line) mapping based on SOFSE data
        const ramalToGerencia: Record<number, number> = {
            // Mitre ramales
            9: 5, 7: 5, 141: 5, 151: 5, 171: 5, 5: 5,
            // Sarmiento ramales
            1: 1, 3: 1, 11: 1,
            // Roca ramales
            103: 11, 109: 11, 115: 11, 121: 11, 127: 11, 133: 11,
            // San Martín ramales
            31: 31, 65: 31, 131: 31,
            // Belgrano Sur ramales
            21: 21, 23: 21, 25: 21,
            // Belgrano Norte ramales
            51: 51, 53: 51,
            // Tren de la Costa
            41: 41, 43: 41,
        };

        const gerenciaId = ramalToGerencia[ramalId];
        if (!gerenciaId) return null;

        return (SOFSE_LINE_MAP[gerenciaId] as TrainLine) ?? null;
    }

    /**
     * Map SOFSE severity to our AlertSeverity
     */
    private mapSOFSESeverity(criticalityOrder: number): "info" | "warning" | "critical" {
        if (criticalityOrder <= 2) return "critical";
        if (criticalityOrder <= 3) return "warning";
        return "info";
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

        for (const entity of data.Entity ?? []) {
            if (!entity.Linea?.Estaciones) continue;

            const routeId = entity.Linea.Route_Id;
            const line = SUBTE_ROUTE_MAP[routeId];
            if (!line) continue;

            // Filter by line if specified
            if (params.line && line !== params.line) continue;

            for (const estacion of entity.Linea.Estaciones) {
                const stopName = estacion.stop_name;
                const normalizedStopName = normalizeStationString(stopName);
                const normalizedQuery = normalizeStationString(params.station);

                if (!normalizedStopName.includes(normalizedQuery)) {
                    continue;
                }

                const arrivalTime = estacion.arrival?.time
                    ? new Date(estacion.arrival.time * 1000)
                    : null;

                if (!arrivalTime || arrivalTime.getTime() < now) continue;

                const delaySeconds = estacion.arrival?.delay ?? 0;
                const minutesAway = Math.round((arrivalTime.getTime() - now) / 60000);

                arrivals.push({
                    station: {
                        id: estacion.stop_id,
                        name: stopName,
                        line,
                        type: "subte",
                    },
                    destination: this.getDirectionName(
                        entity.Linea.Direction_ID,
                        line
                    ),
                    arrivalTime: arrivalTime.toISOString(),
                    delaySeconds,
                    minutesAway,
                    tripId: entity.Linea.Trip_Id,
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
            "Tren de la Costa": ["Maipú", "Delta"],
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
        return TRAIN_LINES.includes(line as TrainLine);
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
