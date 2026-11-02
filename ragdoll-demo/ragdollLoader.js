// ragdollLoader.js
// Convierte un .rag.json (texto) en un RagDef listo para spawnear.
import { RagImporter, RagFormatError } from "ragimporter";

// Devuelve también el JSON (ya adaptado) porque el demo necesita datos
// que RagDef no expone, como la lista de nombres de los bodies.
export function parseRagdoll(text) {
    const json = adaptToImporterVersion(JSON.parse(text));
    return { def: RagImporter.parse(json), json };
}

export async function fetchRagdoll(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} al cargar ${url}`);
    return parseRagdoll(await response.text());
}

// Mensaje legible para mostrar en el panel.
export function describeError(error) {
    if (error instanceof RagFormatError) {
        const lines = error.errors
            .slice(0, 8)
            .map((item) => `${item.code} ${item.path}: ${item.message}`);
        return [error.message, ...lines].join("\n");
    }
    if (error instanceof SyntaxError) return `No es un JSON válido: ${error.message}`;
    return error.message ?? String(error);
}

// ------------------------------------------------------------------
// ADAPTADOR v3 -> v2 (temporal)
// El RagImporter publicado (commit fijado en index.html) solo lee la
// versión 2 del formato. La v3 cambia una sola cosa: la masa se define
// por body (`mass`, kg) en vez de por fixture (`density`, kg/m²).
// Box2D calcula la masa de un body como Σ densidad·área de sus fixtures,
// así que repartir `mass` sobre el área total da exactamente la misma
// masa. Cuando RagImporter soporte v3, se borra este bloque.
// ------------------------------------------------------------------
function adaptToImporterVersion(json) {
    if (json?.version !== 3) return json;

    const bodies = json.bodies.map(({ mass, ...body }) => {
        const area = body.fixtures.reduce((sum, f) => sum + shapeArea(f.shape), 0);
        const density = area > 0 ? mass / area : 1;
        const fixtures = body.fixtures.map((f) => ({ ...f, density }));
        return { ...body, fixtures };
    });
    return { ...json, version: 2, bodies };
}

function shapeArea(shape) {
    switch (shape.type) {
        case "circle":
            return Math.PI * shape.radius * shape.radius;
        case "box":
            return shape.width * shape.height;
        default: {
            // Polígono: fórmula del área de Gauss (shoelace)
            let twice = 0;
            const v = shape.vertices;
            for (let i = 0; i < v.length; i++) {
                const [x1, y1] = v[i];
                const [x2, y2] = v[(i + 1) % v.length];
                twice += x1 * y2 - x2 * y1;
            }
            return Math.abs(twice) / 2;
        }
    }
}
