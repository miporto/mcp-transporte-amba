/**
 * SOFSE client exports
 */

export { SOFSEClient } from "./SOFSEClient.js";
export { generateCredentials, generateUsername, encodePassword } from "./auth.js";
export type {
    SOFSEClientConfig,
    SOFSECredentials,
    SOFSEStation,
    SOFSEGerencia,
    SOFSERamal,
    SOFSEAlert,
    SOFSEArribosResponse,
    SOFSEArribo,
    SOFSECabecera,
} from "./types.js";
export { SOFSE_LINE_MAP, LINE_TO_SOFSE_ID } from "./types.js";
