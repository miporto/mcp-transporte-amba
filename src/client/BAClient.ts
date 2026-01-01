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
    TrainLineInfo,
    TrainRamalInfo,
    TrainStationCandidate,
} from "./types.js";
import { normalizeStationString } from "./stringUtils.js";
import { LINE_TO_SOFSE_ID, SOFSEClient, SOFSE_LINE_MAP } from "./sofse/index.js";

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

const TRAIN_INDEX_TTL_MS = 15 * 60 * 1000;

interface TrainIndex {
    generatedAt: number;
    ramalIdToLine: Map<number, TrainLine>;
    ramalIdToRamalName: Map<number, string>;
    ramalIdsByLine: Map<TrainLine, number[]>;
    lineIdByLine: Map<TrainLine, number>;
}

export class BAClient {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly baseUrl: string;
    private readonly sofseClient: SOFSEClient;

    private trainIndex: TrainIndex | null = null;

    constructor(config: BAClientConfig) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.sofseClient = new SOFSEClient();
    }

    private parseSOFSEStationId(id: string): number | null {
        const parsed = Number.parseInt(id, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private async getTrainIndex(): Promise<TrainIndex> {
        if (this.trainIndex && Date.now() - this.trainIndex.generatedAt < TRAIN_INDEX_TTL_MS) {
            return this.trainIndex;
        }

        const gerencias = await this.sofseClient.getGerencias();

        const ramalIdToLine = new Map<number, TrainLine>();
        const ramalIdToRamalName = new Map<number, string>();
        const ramalIdsByLine = new Map<TrainLine, number[]>();
        const lineIdByLine = new Map<TrainLine, number>();

        for (const gerencia of gerencias) {
            const lineName = SOFSE_LINE_MAP[gerencia.id];
            if (!lineName) continue;
            if (!TRAIN_LINES.includes(lineName as TrainLine)) continue;

            const line = lineName as TrainLine;
            lineIdByLine.set(line, gerencia.id);

            const ramales = await this.sofseClient.getRamales(gerencia.id);
            for (const ramal of ramales) {
                ramalIdToLine.set(ramal.id, line);
                ramalIdToRamalName.set(ramal.id, ramal.nombre);
            }

            ramalIdsByLine.set(line, ramales.map((r) => r.id));
        }

        this.trainIndex = {
            generatedAt: Date.now(),
            ramalIdToLine,
            ramalIdToRamalName,
            ramalIdsByLine,
            lineIdByLine,
        };

        return this.trainIndex;
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
            const filterLine = params.line && this.isTrainLine(params.line)
                ? params.line as TrainLine
                : undefined;
            const trainStatuses = await this.fetchTrainStatusFromSOFSE(filterLine);
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
        const resolved = await this.resolveTrainStation({
            station: params.station,
            line: params.line && this.isTrainLine(params.line) ? params.line as TrainLine : undefined,
            ramalId: undefined,
        });

        if (!resolved.station) {
            return [];
        }

        const filterLine = params.line && this.isTrainLine(params.line)
            ? params.line as TrainLine
            : undefined;

        return this.getTrainArrivals({
            stationId: resolved.station.stationId,
            line: filterLine,
            direction: params.direction,
            limit: params.limit,
        });
    }

    /**
     * List SOFSE train lines (líneas) for discovery tools
     */
    async listTrainLines(): Promise<TrainLineInfo[]> {
        const gerencias = await this.sofseClient.getGerencias();
        const result: TrainLineInfo[] = [];

        for (const gerencia of gerencias) {
            const lineName = SOFSE_LINE_MAP[gerencia.id];
            if (!lineName) continue;
            if (!TRAIN_LINES.includes(lineName as TrainLine)) continue;

            const line = lineName as TrainLine;

            result.push({
                lineId: gerencia.id,
                line,
                statusMessage: gerencia.estado.mensaje,
                isOperational: gerencia.estado.id !== 1,
                alertsCount: gerencia.alerta.length,
            });
        }

        return result;
    }

    /**
     * List ramales for a given train line
     */
    async listTrainRamales(params: { line?: TrainLine; lineId?: number }): Promise<TrainRamalInfo[]> {
        const index = await this.getTrainIndex();

        let lineId = params.lineId;
        let line = params.line;

        if (!lineId && line) {
            lineId = LINE_TO_SOFSE_ID[line];
        }

        if (!line && lineId) {
            for (const [l, id] of index.lineIdByLine.entries()) {
                if (id === lineId) {
                    line = l;
                    break;
                }
            }
        }

        if (!lineId || !line) {
            throw new Error("Debe especificar line o lineId para listar ramales");
        }

        const ramales = await this.sofseClient.getRamales(lineId);

        return ramales.map((r) => ({
            ramalId: r.id,
            ramalName: r.nombre,
            lineId,
            line,
            cabeceraInicial: r.cabecera_inicial.nombre,
            cabeceraFinal: r.cabecera_final.nombre,
            isOperational: r.operativo === 1,
            alertsCount: r.alerta.length,
        }));
    }

    /**
     * List stations for a given ramal
     */
    async listTrainStations(ramalId: number): Promise<TrainStationCandidate[]> {
        const index = await this.getTrainIndex();
        const line = index.ramalIdToLine.get(ramalId);
        if (!line) {
            throw new Error(`No se pudo determinar la línea para el ramal ${ramalId}`);
        }

        const stations = await this.sofseClient.getStationsByRamal(ramalId);
        const result: TrainStationCandidate[] = [];

        for (const station of stations) {
            const stationId = this.parseSOFSEStationId(station.id_estacion);
            if (stationId === null) continue;

            const ramalIds = station.incluida_en_ramales;
            const lines = this.getLinesForRamalIds(ramalIds, index);

            result.push({
                stationId,
                stationName: station.nombre,
                ramalIds,
                lines,
            });
        }

        return result;
    }

    /**
     * Search stations by name with optional filters
     */
    async searchTrainStations(params: {
        query: string;
        line?: TrainLine;
        ramalId?: number;
        limit?: number;
    }): Promise<TrainStationCandidate[]> {
        const index = await this.getTrainIndex();
        const normalizedQuery = normalizeStationString(params.query);

        const stations = await this.sofseClient.searchStations(params.query);

        const lineRamalIds = params.line ? index.ramalIdsByLine.get(params.line) ?? [] : null;
        const result: TrainStationCandidate[] = [];

        for (const station of stations) {
            const stationId = this.parseSOFSEStationId(station.id_estacion);
            if (stationId === null) continue;

            const nameNormalized = normalizeStationString(station.nombre);
            if (!nameNormalized.includes(normalizedQuery)) continue;

            const ramalIds = station.incluida_en_ramales;

            if (params.ramalId && !ramalIds.includes(params.ramalId)) {
                continue;
            }

            if (lineRamalIds) {
                const matchesLine = ramalIds.some((id) => lineRamalIds.includes(id));
                if (!matchesLine) continue;
            }

            const lines = this.getLinesForRamalIds(ramalIds, index);

            result.push({
                stationId,
                stationName: station.nombre,
                ramalIds,
                lines,
            });

            if (params.limit && result.length >= params.limit) {
                break;
            }
        }

        return result;
    }

    /**
     * Resolve a station query to a single station, or return disambiguation candidates.
     */
    async resolveTrainStation(params: {
        station: string;
        line?: TrainLine;
        ramalId?: number;
    }): Promise<{ station?: TrainStationCandidate; candidates: TrainStationCandidate[]; issues: string[] }> {
        const issues: string[] = [];

        const candidates = await this.searchTrainStations({
            query: params.station,
            line: params.line,
            ramalId: params.ramalId,
            limit: 25,
        });

        if (candidates.length === 0) {
            issues.push(`No se encontró ninguna estación que coincida con "${params.station}".`);
            if (params.line) {
                issues.push(`Filtro aplicado: línea ${params.line}.`);
            }
            if (params.ramalId) {
                issues.push(`Filtro aplicado: ramalId ${params.ramalId}.`);
            }
            return { station: undefined, candidates: [], issues };
        }

        if (candidates.length === 1) {
            return { station: candidates[0], candidates, issues };
        }

        // Prefer exact normalized match if unique
        const normalizedQuery = normalizeStationString(params.station);
        const exact = candidates.filter((c) => normalizeStationString(c.stationName) === normalizedQuery);
        if (exact.length === 1) {
            return { station: exact[0], candidates, issues };
        }

        issues.push(`La estación "${params.station}" es ambigua. Coincide con múltiples estaciones.`);
        issues.push("Por favor use stationId (recomendado) o refine con line y/o ramalId.");

        return { station: undefined, candidates, issues };
    }

    /**
     * Get train arrivals from SOFSE, deterministically by stationId.
     */
    async getTrainArrivals(params: {
        stationId: string | number;
        line?: TrainLine;
        ramalId?: number;
        direction?: string;
        limit?: number;
    }): Promise<Arrival[]> {
        const index = await this.getTrainIndex();
        const now = Date.now();
        const limit = params.limit ?? 5;

        const response = await this.sofseClient.getArrivals(params.stationId, {
            cantidad: limit,
            ramal: params.ramalId,
        });

        const normalizedDirection = params.direction
            ? normalizeStationString(params.direction)
            : null;

        const arrivals: Arrival[] = [];

        for (const arribo of response.results) {
            const line = index.ramalIdToLine.get(arribo.ramal_id);
            if (!line) continue;

            if (params.line && line !== params.line) continue;

            const destination = arribo.destino || arribo.cabecera;
            if (normalizedDirection) {
                const normalizedDestination = normalizeStationString(destination);
                if (!normalizedDestination.includes(normalizedDirection)) {
                    continue;
                }
            }

            const arrivalTime = this.parseSOFSETime(arribo.hora_llegada);
            if (!arrivalTime || arrivalTime.getTime() < now) continue;

            const minutesAway = Math.round((arrivalTime.getTime() - now) / 60000);
            const ramalName = index.ramalIdToRamalName.get(arribo.ramal_id) ?? arribo.ramal_nombre;

            arrivals.push({
                station: {
                    id: String(arribo.estacion_id),
                    name: arribo.estacion_nombre,
                    line,
                    type: "train",
                },
                destination,
                arrivalTime: arrivalTime.toISOString(),
                delaySeconds: 0,
                minutesAway,
                tripId: arribo.tren_id ?? `sofse-${arribo.id}`,
                ramalId: arribo.ramal_id,
                ramalName,
                platform: arribo.anden,
                status: arribo.estado,
                inTravel: arribo.en_viaje,
            });
        }

        return arrivals.sort((a, b) => a.minutesAway - b.minutesAway).slice(0, limit);
    }

    /**
     * Get train status, optionally including per-ramal breakdown.
     */
    async getTrainStatus(params: { line?: TrainLine; includeRamales?: boolean }): Promise<LineStatus[]> {
        return this.fetchTrainStatusFromSOFSE(params.line, params.includeRamales);
    }

    /**
     * Fetch train status from SOFSE API
     */
    private async fetchTrainStatusFromSOFSE(filterLine?: TrainLine, includeRamales = false): Promise<LineStatus[]> {
        const gerencias = await this.sofseClient.getGerencias();
        const statuses: LineStatus[] = [];

        for (const gerencia of gerencias) {
            const lineName = SOFSE_LINE_MAP[gerencia.id];
            if (!lineName) continue;

            // Skip non-train lines (like Regionales)
            if (!TRAIN_LINES.includes(lineName as TrainLine)) continue;

            const line = lineName as TrainLine;

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
                ramales: includeRamales
                    ? await this.fetchRamalStatuses(gerencia.id, line)
                    : undefined,
            });
        }

        return statuses;
    }

    private async fetchRamalStatuses(gerenciaId: number, line: TrainLine): Promise<LineStatus["ramales"]> {
        const ramales = await this.sofseClient.getRamales(gerenciaId);

        return ramales.map((r) => ({
            ramalId: r.id,
            ramalName: r.nombre,
            isOperational: r.operativo === 1,
            alerts: r.alerta.map((a) => ({
                line,
                type: "train" as const,
                severity: this.mapSOFSESeverity(a.criticidad_orden),
                title: r.nombre,
                description: a.contenido,
                startTime: a.vigencia_desde,
                endTime: a.vigencia_hasta ?? undefined,
            })),
        }));
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
    private getLinesForRamalIds(ramalIds: number[], index: TrainIndex): TrainLine[] {
        const lines = new Set<TrainLine>();
        for (const ramalId of ramalIds) {
            const line = index.ramalIdToLine.get(ramalId);
            if (line) {
                lines.add(line);
            }
        }
        return Array.from(lines);
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
