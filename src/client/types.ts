/**
 * Transit data types for the BA-Transit MCP
 */

/** Subte (Metro) lines */
export type SubteLine = "A" | "B" | "C" | "D" | "E" | "H" | "Premetro";

/** Train lines */
export type TrainLine =
    | "Mitre"
    | "Sarmiento"
    | "Roca"
    | "San Martín"
    | "Belgrano Sur"
    | "Belgrano Norte"
    | "Tren de la Costa";

/** All transit lines */
export type TransitLine = SubteLine | TrainLine;

/** Transit system type */
export type TransitType = "subte" | "train";

/** Direction of travel */
export interface Direction {
    id: string;
    name: string;
}

/** Station information */
export interface Station {
    id: string;
    name: string;
    line: TransitLine;
    type: TransitType;
}

/** Arrival prediction */
export interface Arrival {
    /** Station where the arrival is predicted */
    station: Station;
    /** Destination/direction of the service */
    destination: string;
    /** Estimated arrival time (ISO 8601) */
    arrivalTime: string;
    /** Delay in seconds (0 = on time, positive = delayed) */
    delaySeconds: number;
    /** Minutes until arrival */
    minutesAway: number;
    /** Trip identifier from GTFS-RT */
    tripId: string;

    /** Train-only: ramal identifier (SOFSE) */
    ramalId?: number;

    /** Train-only: ramal display name (SOFSE) */
    ramalName?: string;

    /** Train-only: platform/track (anden) */
    platform?: string | null;

    /** Train-only: service state text from SOFSE (e.g. 'EN HORARIO') */
    status?: string;

    /** Train-only: whether the train is currently en_viaje */
    inTravel?: boolean;
}

/** Service alert severity */
export type AlertSeverity = "info" | "warning" | "critical";

/** Service status alert */
export interface ServiceAlert {
    line: TransitLine;
    type: TransitType;
    severity: AlertSeverity;
    title: string;
    description: string;
    startTime?: string;
    endTime?: string;
}

/** Line service status */
export interface LineStatus {
    line: TransitLine;
    type: TransitType;
    isOperational: boolean;
    alerts: ServiceAlert[];

    /** Train-only: optional per-ramal breakdown */
    ramales?: Array<{
        ramalId: number;
        ramalName: string;
        isOperational: boolean;
        alerts: ServiceAlert[];
    }>;
}

/** Train line (SOFSE gerencia) info for discovery tools */
export interface TrainLineInfo {
    lineId: number;
    line: TrainLine;
    statusMessage: string;
    isOperational: boolean;
    alertsCount: number;
}

/** Train ramal (branch) info for discovery tools */
export interface TrainRamalInfo {
    ramalId: number;
    ramalName: string;
    lineId: number;
    line: TrainLine;
    cabeceraInicial: string;
    cabeceraFinal: string;
    isOperational: boolean;
    alertsCount: number;
}

/** Train station candidate for search/resolve tools */
export interface TrainStationCandidate {
    stationId: number;
    stationName: string;
    /** Ramales this station belongs to (SOFSE incluida_en_ramales) */
    ramalIds: number[];
    /** Lines inferred from ramal membership */
    lines: TrainLine[];
}

/** GCBA API response for subte forecast */
export interface GCBASubteForecastResponse {
    Header: {
        timestamp: number;
    };
    Entity: Array<{
        ID: string;
        Linea: {
            Trip_Id: string;
            Route_Id: string;
            Direction_ID: number;
            start_time: string;
            start_date: string;
            Estaciones: Array<{
                stop_id: string;
                stop_name: string;
                arrival: {
                    time: number;
                    delay: number;
                };
                departure: {
                    time: number;
                    delay: number;
                };
            }>;
        };
    }>;
}

/** GCBA API response for train trip updates */
export interface GCBATrainTripUpdateResponse {
    entity: Array<{
        id: string;
        tripUpdate?: {
            trip: {
                tripId: string;
                routeId: string;
                directionId: number;
            };
            stopTimeUpdate?: Array<{
                stopSequence: number;
                stopId: string;
                arrival?: {
                    delay?: number;
                    time?: number;
                };
                departure?: {
                    delay?: number;
                    time?: number;
                };
            }>;
        };
    }>;
}

/** GCBA API response for service alerts (GTFS-RT uses snake_case) */
export interface GCBAServiceAlertsResponse {
    entity: Array<{
        id: string;
        alert?: {
            active_period?: Array<{
                start?: number;
                end?: number;
            }>;
            informed_entity?: Array<{
                route_id?: string;
                stop_id?: string;
            }>;
            header_text?: {
                translation: Array<{
                    text: string;
                    language: string;
                }>;
            };
            description_text?: {
                translation: Array<{
                    text: string;
                    language: string;
                }>;
            };
        };
    }>;
}

/** Client configuration */
export interface BAClientConfig {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
}

/** Query parameters for arrivals */
export interface GetArrivalsParams {
    station: string;
    line?: TransitLine;
    direction?: string;
    limit?: number;
}

/** Query parameters for status */
export interface GetStatusParams {
    line?: TransitLine;
    type?: TransitType;
}
