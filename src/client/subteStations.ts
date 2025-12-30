/**
 * Subte station index for Buenos Aires Metro
 *
 * Contains all stations with their line mappings and common aliases
 */

import type { SubteLine } from "./types.js";

export interface SubteStation {
    id: string;
    name: string;
    line: SubteLine;
    aliases?: string[];
}

export const SUBTE_STATIONS: SubteStation[] = [
    // Line A (18 stations): Plaza de Mayo - San Pedrito
    { id: "plaza-de-mayo-a", name: "Plaza de Mayo", line: "A" },
    { id: "peru", name: "Perú", line: "A" },
    { id: "piedras", name: "Piedras", line: "A" },
    { id: "lima", name: "Lima", line: "A" },
    { id: "saenz-pena", name: "Sáenz Peña", line: "A", aliases: ["Saenz Peña"] },
    { id: "congreso", name: "Congreso", line: "A" },
    { id: "pasco-a", name: "Pasco", line: "A" },
    { id: "alberti", name: "Alberti", line: "A" },
    { id: "plaza-miserere", name: "Plaza Miserere", line: "A", aliases: ["Once", "Miserere"] },
    { id: "loria", name: "Loria", line: "A" },
    { id: "castro-barros", name: "Castro Barros", line: "A" },
    { id: "rio-de-janeiro-a", name: "Río de Janeiro", line: "A", aliases: ["Rio de Janeiro"] },
    { id: "acoyte", name: "Acoyte", line: "A" },
    { id: "primera-junta", name: "Primera Junta", line: "A" },
    { id: "puan", name: "Puan", line: "A" },
    { id: "carabobo-a", name: "Carabobo", line: "A" },
    { id: "flores", name: "Flores", line: "A" },
    { id: "san-pedrito", name: "San Pedrito", line: "A" },

    // Line B (17 stations): Leandro N. Alem - Juan Manuel de Rosas
    { id: "leandro-n-alem", name: "Leandro N. Alem", line: "B", aliases: ["L.N. Alem", "Alem"] },
    { id: "florida", name: "Florida", line: "B" },
    { id: "carlos-pellegrini", name: "Carlos Pellegrini", line: "B", aliases: ["Pellegrini"] },
    { id: "uruguay", name: "Uruguay", line: "B" },
    { id: "callao-b", name: "Callao", line: "B" },
    { id: "pasteur", name: "Pasteur", line: "B" },
    { id: "pueyrredon-b", name: "Pueyrredón", line: "B", aliases: ["Pueyrredon"] },
    { id: "carlos-gardel", name: "Carlos Gardel", line: "B", aliases: ["Gardel"] },
    { id: "medrano", name: "Medrano", line: "B" },
    { id: "angel-gallardo", name: "Ángel Gallardo", line: "B", aliases: ["Angel Gallardo"] },
    { id: "malabia", name: "Malabia", line: "B" },
    { id: "dorrego", name: "Dorrego", line: "B" },
    { id: "federico-lacroze", name: "Federico Lacroze", line: "B", aliases: ["Lacroze"] },
    { id: "tronador", name: "Tronador", line: "B" },
    { id: "los-incas", name: "Los Incas - Parque Chas", line: "B", aliases: ["Los Incas", "Parque Chas"] },
    { id: "echeverria", name: "Echeverría", line: "B", aliases: ["Echeverria"] },
    { id: "juan-manuel-de-rosas", name: "Juan Manuel de Rosas", line: "B", aliases: ["J.M. de Rosas", "Rosas"] },

    // Line C (9 stations): Retiro - Constitución
    { id: "retiro-c", name: "Retiro", line: "C" },
    { id: "general-san-martin", name: "General San Martín", line: "C", aliases: ["San Martin", "San Martín"] },
    { id: "lavalle", name: "Lavalle", line: "C" },
    { id: "diagonal-norte", name: "Diagonal Norte", line: "C" },
    { id: "avenida-de-mayo", name: "Avenida de Mayo", line: "C", aliases: ["Av. de Mayo"] },
    { id: "moreno", name: "Moreno", line: "C" },
    { id: "independencia-c", name: "Independencia", line: "C" },
    { id: "san-juan", name: "San Juan", line: "C" },
    { id: "constitucion-c", name: "Constitución", line: "C", aliases: ["Constitucion"] },

    // Line D (16 stations): Catedral - Congreso de Tucumán
    { id: "catedral", name: "Catedral", line: "D" },
    { id: "9-de-julio", name: "9 de Julio", line: "D", aliases: ["Nueve de Julio"] },
    { id: "tribunales", name: "Tribunales", line: "D" },
    { id: "callao-d", name: "Callao", line: "D" },
    { id: "facultad-de-medicina", name: "Facultad de Medicina", line: "D", aliases: ["Medicina"] },
    { id: "pueyrredon-d", name: "Pueyrredón", line: "D", aliases: ["Pueyrredon"] },
    { id: "agüero", name: "Agüero", line: "D", aliases: ["Aguero"] },
    { id: "bulnes", name: "Bulnes", line: "D" },
    { id: "scalabrini-ortiz", name: "Scalabrini Ortiz", line: "D" },
    { id: "plaza-italia", name: "Plaza Italia", line: "D" },
    { id: "palermo", name: "Palermo", line: "D" },
    { id: "ministro-carranza", name: "Ministro Carranza", line: "D", aliases: ["Carranza"] },
    { id: "olleros", name: "Olleros", line: "D" },
    { id: "jose-hernandez", name: "José Hernández", line: "D", aliases: ["Jose Hernandez"] },
    { id: "juramento", name: "Juramento", line: "D" },
    { id: "congreso-de-tucuman", name: "Congreso de Tucumán", line: "D", aliases: ["Congreso de Tucuman"] },

    // Line E (18 stations): Bolívar - Plaza de los Virreyes (+ Retiro extension)
    { id: "retiro-e", name: "Retiro", line: "E" },
    { id: "catalinas", name: "Catalinas", line: "E" },
    { id: "correo-central", name: "Correo Central", line: "E" },
    { id: "bolivar", name: "Bolívar", line: "E", aliases: ["Bolivar"] },
    { id: "belgrano", name: "Belgrano", line: "E" },
    { id: "independencia-e", name: "Independencia", line: "E" },
    { id: "san-jose", name: "San José", line: "E", aliases: ["San Jose"] },
    { id: "entre-rios", name: "Entre Ríos", line: "E", aliases: ["Entre Rios", "Rodolfo Walsh"] },
    { id: "pichincha", name: "Pichincha", line: "E" },
    { id: "jujuy", name: "Jujuy", line: "E" },
    { id: "general-urquiza", name: "General Urquiza", line: "E", aliases: ["Urquiza"] },
    { id: "boedo", name: "Boedo", line: "E" },
    { id: "avenida-la-plata", name: "Avenida La Plata", line: "E", aliases: ["Av. La Plata"] },
    { id: "jose-maria-moreno", name: "José María Moreno", line: "E", aliases: ["Jose Maria Moreno"] },
    { id: "emilio-mitre", name: "Emilio Mitre", line: "E" },
    { id: "medalla-milagrosa", name: "Medalla Milagrosa", line: "E" },
    { id: "varela", name: "Varela", line: "E" },
    { id: "plaza-de-los-virreyes", name: "Plaza de los Virreyes", line: "E", aliases: ["Virreyes"] },

    // Line H (12 stations): Las Heras - Hospitales
    { id: "facultad-de-derecho", name: "Facultad de Derecho", line: "H", aliases: ["Derecho", "Julieta Lanteri"] },
    { id: "las-heras", name: "Las Heras", line: "H" },
    { id: "santa-fe", name: "Santa Fe", line: "H" },
    { id: "cordoba-h", name: "Córdoba", line: "H", aliases: ["Cordoba"] },
    { id: "corrientes-h", name: "Corrientes", line: "H" },
    { id: "once-h", name: "Once", line: "H", aliases: ["Once - 30 de Diciembre"] },
    { id: "venezuela", name: "Venezuela", line: "H" },
    { id: "humberto-i", name: "Humberto I", line: "H", aliases: ["Humberto 1"] },
    { id: "inclan", name: "Inclán", line: "H", aliases: ["Inclan"] },
    { id: "caseros", name: "Caseros", line: "H" },
    { id: "parque-patricios", name: "Parque Patricios", line: "H" },
    { id: "hospitales", name: "Hospitales", line: "H" },

    // Premetro (17 stations): Intendente Saguier - Centro Cívico
    { id: "intendente-saguier", name: "Intendente Saguier", line: "Premetro" },
    { id: "centro-civico", name: "Centro Cívico", line: "Premetro", aliases: ["Centro Civico"] },
    { id: "general-savio", name: "General Savio", line: "Premetro" },
    { id: "gabino-ezeiza", name: "Gabino Ezeiza", line: "Premetro" },
    { id: "nicolas-descalzi", name: "Nicolás Descalzi", line: "Premetro", aliases: ["Nicolas Descalzi"] },
    { id: "larrazabal", name: "Larrazábal", line: "Premetro", aliases: ["Larrazabal"] },
    { id: "murature", name: "Murature", line: "Premetro" },
    { id: "mariano-acosta", name: "Mariano Acosta", line: "Premetro" },
    { id: "timoteo-gordillo", name: "Timoteo Gordillo", line: "Premetro" },
    { id: "juan-de-garay", name: "Juan de Garay", line: "Premetro" },
    { id: "somellera", name: "Somellera", line: "Premetro" },
    { id: "castanares", name: "Castañares", line: "Premetro", aliases: ["Castanares"] },
    { id: "florentino-ameghino", name: "Florentino Ameghino", line: "Premetro" },
    { id: "cildanez", name: "Cildáñez", line: "Premetro", aliases: ["Cildanez"] },
    { id: "escalada", name: "Escalada", line: "Premetro" },
    { id: "portela", name: "Portela", line: "Premetro" },
    { id: "olympo", name: "Olympo", line: "Premetro" },
];

/**
 * Get all stations for a specific line
 */
export function getStationsForLine(line: SubteLine): SubteStation[] {
    return SUBTE_STATIONS.filter((s) => s.line === line);
}

/**
 * Get all unique line values
 */
export function getAllSubteLines(): SubteLine[] {
    return ["A", "B", "C", "D", "E", "H", "Premetro"];
}
