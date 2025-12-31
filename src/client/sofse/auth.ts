/**
 * SOFSE API Authentication
 *
 * Implements the authentication mechanism for the SOFSE Trenes Argentinos API.
 * Based on reverse engineering by ariedro: https://github.com/ariedro/api-trenes
 */

import type { SOFSECredentials } from "./types.js";

/** Cipher substitution maps */
const CIPHER_STEP_0: Record<string, string> = {
    "a": "#t",
    "e": "#x",
    "i": "#f",
    "o": "#l",
    "u": "#7",
    "=": "#g",
};

const CIPHER_STEP_1: Record<string, string> = {
    "a": "#j",
    "e": "#p",
    "i": "#w",
    "o": "#8",
    "u": "#0",
    "=": "#v",
};

/**
 * Encoder class for generating SOFSE credentials
 */
class Encoder {
    private value: string;

    constructor(initialValue?: string) {
        this.value = initialValue ?? "";
    }

    /**
     * Set value to current timestamp in SOFSE format
     */
    timestamp(): Encoder {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        this.value = `${year}${month}${day}sofse`;
        return this;
    }

    /**
     * Base64 encode the current value
     */
    base64(): Encoder {
        this.value = Buffer.from(this.value).toString("base64");
        return this;
    }

    /**
     * Apply cipher substitution
     */
    cipher(step: 0 | 1): Encoder {
        const map = step === 0 ? CIPHER_STEP_0 : CIPHER_STEP_1;
        let result = this.value;
        for (const [char, replacement] of Object.entries(map)) {
            result = result.split(char).join(replacement);
        }
        this.value = result;
        return this;
    }

    /**
     * Reverse the string
     */
    reverse(): Encoder {
        this.value = this.value.split("").reverse().join("");
        return this;
    }

    /**
     * URL encode the value
     */
    url(): Encoder {
        this.value = encodeURIComponent(this.value);
        return this;
    }

    /**
     * Get the final value
     */
    toString(): string {
        return this.value;
    }
}

/**
 * Generate SOFSE API username
 */
export function generateUsername(): string {
    return new Encoder().timestamp().base64().toString();
}

/**
 * Encode password from username
 */
export function encodePassword(username: string): string {
    return new Encoder(username)
        .base64()
        .cipher(0)
        .reverse()
        .base64()
        .cipher(1)
        .reverse()
        .url()
        .toString();
}

/**
 * Generate fresh SOFSE API credentials
 */
export function generateCredentials(): SOFSECredentials {
    const username = generateUsername();
    const password = encodePassword(username);
    return { username, password };
}
