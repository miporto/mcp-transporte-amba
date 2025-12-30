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
    | "Belgrano Norte";

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
}

/** GCBA API response for subte forecast */
export interface GCBASubteForecastResponse {
    /** GTFS-RT TripUpdate entities */
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
