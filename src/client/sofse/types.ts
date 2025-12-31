/**
 * SOFSE API types for Trenes Argentinos
 *
 * These types represent the responses from the SOFSE (Trenes Argentinos) API
 * which provides real-time train data for Buenos Aires metropolitan area.
 */

/** SOFSE authentication credentials */
export interface SOFSECredentials {
    username: string;
    password: string;
}

/** SOFSE authentication token response */
export interface SOFSETokenResponse {
    token: string;
    expiration?: number;
}

/** SOFSE station from search */
export interface SOFSEStation {
    nombre: string;
    id_estacion: string;
    id_tramo: string;
    orden: string;
    id_referencia: string;
    latitud: string;
    longitud: string;
    referencia_orden: string;
    radio: string;
    andenes_habilitados: string;
    visibilidad: {
        totem: number;
        app_mobile: number;
    };
    incluida_en_ramales: number[];
    operativa_en_ramales: number[];
}

/** SOFSE line/gerencia */
export interface SOFSEGerencia {
    id: number;
    id_empresa: number;
    nombre: string;
    estado: {
        id: number;
        mensaje: string;
        color: string;
    };
    alerta: SOFSEAlert[];
}

/** SOFSE alert */
export interface SOFSEAlert {
    id: number;
    linea_id: number;
    ramal_id: number | null;
    estacion_id: number | null;
    sentido: string | null;
    causa_gtfs: string;
    efecto_gtfs: string;
    icono_fontawesome: string;
    contenido: string;
    habilitado: number;
    vigencia_desde: string;
    vigencia_hasta: string | null;
    criticidad_orden: number;
    criticidad_color_fondo: string;
    criticidad_color_texto: string;
}

/** SOFSE ramal (branch) */
export interface SOFSERamal {
    id: number;
    id_estacion_inicial: number;
    id_estacion_final: number;
    id_gerencia: number;
    nombre: string;
    estaciones: number;
    operativo: number;
    es_electrico: number;
    tipo_id: number;
    puntualidad_tolerancia: number;
    siglas: string;
    publico: boolean;
    orden_ramal: number;
    mostrar_en_panel_cumplimiento: boolean;
    cabecera_inicial: SOFSECabecera;
    cabecera_final: SOFSECabecera;
    alerta: SOFSEAlert[];
}

/** SOFSE station header info */
export interface SOFSECabecera {
    id: number;
    nombre: string;
    siglas: string;
    nombre_corto: string;
    visibilidad: string;
}

/** SOFSE arrival response */
export interface SOFSEArribosResponse {
    timestamp: number;
    results: SOFSEArribo[];
    total: number;
}

/** SOFSE single arrival */
export interface SOFSEArribo {
    id: number;
    ramal_id: number;
    ramal_nombre: string;
    cabecera: string;
    destino: string;
    estacion_id: number;
    estacion_nombre: string;
    anden: string | null;
    hora_llegada: string;
    hora_salida: string;
    tiempo_estimado: number;
    estado: string;
    tren_id: string | null;
    formacion_id: string | null;
    en_viaje: boolean;
}

/** SOFSE client configuration */
export interface SOFSEClientConfig {
    baseUrl?: string;
}

/** Map SOFSE gerencia IDs to line names */
export const SOFSE_LINE_MAP: Record<number, string> = {
    1: "Sarmiento",
    5: "Mitre",
    11: "Roca",
    21: "Belgrano Sur",
    31: "San Martín",
    41: "Tren de la Costa",
    51: "Belgrano Norte",
    501: "Regionales",
};

/** Reverse map: line names to SOFSE gerencia IDs */
export const LINE_TO_SOFSE_ID: Record<string, number> = {
    "Sarmiento": 1,
    "Mitre": 5,
    "Roca": 11,
    "Belgrano Sur": 21,
    "San Martín": 31,
    "Tren de la Costa": 41,
    "Belgrano Norte": 51,
    "Regionales": 501,
};
