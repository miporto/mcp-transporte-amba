/**
 * SOFSEClient - API client for SOFSE Trenes Argentinos API
 *
 * Handles authentication and fetches real-time train data
 * for all train lines in Buenos Aires metropolitan area.
 */

import type {
    SOFSEClientConfig,
    SOFSEStation,
    SOFSEGerencia,
    SOFSERamal,
    SOFSEArribosResponse,
} from "./types.js";
import { generateCredentials } from "./auth.js";

const DEFAULT_BASE_URL = "https://api-servicios.sofse.gob.ar/v1";
const AUTH_ENDPOINT = "/auth/authorize";

export class SOFSEClient {
    private readonly baseUrl: string;
    private token: string | null = null;
    private tokenExpiration: number | null = null;

    constructor(config?: SOFSEClientConfig) {
        this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    }

    /**
     * Get a valid authentication token
     */
    private async getToken(): Promise<string> {
        if (this.token && this.tokenExpiration && Date.now() < this.tokenExpiration) {
            return this.token;
        }

        const credentials = generateCredentials();
        const response = await fetch(`${this.baseUrl}${AUTH_ENDPOINT}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            throw new Error(
                `SOFSE auth failed: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json() as { token?: string };
        if (!data.token) {
            throw new Error("SOFSE auth response missing token");
        }

        this.token = data.token;
        this.tokenExpiration = this.parseTokenExpiration(data.token);

        return this.token;
    }

    /**
     * Parse JWT token to get expiration time
     */
    private parseTokenExpiration(token: string): number {
        try {
            const parts = token.split(".");
            if (parts.length !== 3) {
                return Date.now() + 3600000;
            }
            const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64").toString());
            if (payload.exp) {
                return payload.exp * 1000;
            }
        } catch {
            // Ignore parsing errors
        }
        return Date.now() + 3600000;
    }

    /**
     * Make authenticated GET request
     */
    private async fetch<T>(endpoint: string, retried = false): Promise<T> {
        const token = await this.getToken();
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            headers: {
                Authorization: token,
                Accept: "application/json",
            },
        });

        if (response.status === 403 && !retried) {
            this.token = null;
            this.tokenExpiration = null;
            return this.fetch<T>(endpoint, true);
        }

        if (!response.ok) {
            throw new Error(
                `SOFSE API request failed: ${response.status} ${response.statusText}`
            );
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
            const text = await response.text();
            throw new Error(
                `SOFSE API returned non-JSON response (${contentType}): ${text.slice(0, 200)}`
            );
        }

        let data: unknown;
        try {
            data = await response.json();
        } catch {
            throw new Error("Failed to parse JSON response from SOFSE API");
        }

        return data as T;
    }

    /**
     * Search stations by name
     */
    async searchStations(name: string): Promise<SOFSEStation[]> {
        const encoded = encodeURIComponent(name);
        return this.fetch<SOFSEStation[]>(`/infraestructura/estaciones?nombre=${encoded}`);
    }

    /**
     * Get stations for a specific ramal
     */
    async getStationsByRamal(ramalId: number): Promise<SOFSEStation[]> {
        return this.fetch<SOFSEStation[]>(`/infraestructura/estaciones?idRamal=${ramalId}`);
    }

    /**
     * Get all gerencias (train lines) for empresa ID 1 (metropolitan trains)
     */
    async getGerencias(): Promise<SOFSEGerencia[]> {
        return this.fetch<SOFSEGerencia[]>("/infraestructura/gerencias?idEmpresa=1");
    }

    /**
     * Get ramales (branches) for a gerencia
     */
    async getRamales(gerenciaId: number): Promise<SOFSERamal[]> {
        return this.fetch<SOFSERamal[]>(`/infraestructura/ramales?idGerencia=${gerenciaId}`);
    }

    /**
     * Get arrivals for a station
     */
    async getArrivals(
        stationId: string | number,
        options?: {
            hasta?: string | number;
            fecha?: string;
            hora?: string;
            cantidad?: number;
            ramal?: number;
            sentido?: number;
        }
    ): Promise<SOFSEArribosResponse> {
        let endpoint = `/arribos/estacion/${stationId}`;
        const params: string[] = [];

        if (options?.hasta) {
            params.push(`hasta=${options.hasta}`);
        }
        if (options?.fecha) {
            params.push(`fecha=${options.fecha}`);
        }
        if (options?.hora) {
            params.push(`hora=${options.hora}`);
        }
        if (options?.cantidad) {
            params.push(`cantidad=${options.cantidad}`);
        }
        if (options?.ramal) {
            params.push(`ramal=${options.ramal}`);
        }
        if (options?.sentido) {
            params.push(`sentido=${options.sentido}`);
        }

        if (params.length > 0) {
            endpoint += "?" + params.join("&");
        }

        return this.fetch<SOFSEArribosResponse>(endpoint);
    }

    /**
     * Get station info by ID
     */
    async getStationInfo(stationId: string | number): Promise<SOFSEStation | null> {
        const stations = await this.fetch<SOFSEStation[]>(
            `/infraestructura/estaciones?id=${stationId}`
        );
        return stations[0] ?? null;
    }
}
