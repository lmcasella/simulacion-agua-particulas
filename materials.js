// materials.js
// -----------------------------------------------------------------------------
// Definición de "materiales líquidos" y su persistencia entre sesiones.
//
// Un material es simplemente un conjunto de parámetros físicos + visuales que
// se le pasan al solver SPH. Cambiando estos números obtenemos comportamientos
// tan distintos como agua, miel, lava o gas.
//
// La persistencia usa localStorage: los materiales del usuario (y cuál está
// seleccionado) sobreviven al recargar la página.
// -----------------------------------------------------------------------------

const STORAGE_KEY = "fluidsim.materials.v1";
const SELECTED_KEY = "fluidsim.selected.v1";

// Qué significa cada parámetro:
//
//  gravity                -> aceleración hacia abajo (px/s^2). 0 = ingravidez.
//  smoothingRadius        -> radio de influencia entre partículas (px).
//  targetDensity          -> densidad de reposo. El fluido intenta mantenerla;
//                            por encima se comprime, por debajo se expande.
//  pressureMultiplier     -> "rigidez". Qué tan fuerte empuja para corregir la
//                            densidad. Alto = líquido incompresible y enérgico.
//  nearPressureMultiplier -> repulsión a corta distancia. Evita que las
//                            partículas se apilen unas sobre otras.
//  viscosity              -> qué tanto se "arrastran" entre sí. Alto = miel;
//                            bajo = agua/mercurio.
//  collisionDamping       -> energía perdida al rebotar contra los bordes
//                            (0 = rebote perfecto, 1 = se pega a la pared).
//  particleSize           -> diámetro visual del sprite (px). Sólo estético.
//  color                  -> color del líquido (número hex 0xRRGGBB).

export const DEFAULT_MATERIALS = [
    {
        id: "agua",
        name: "Agua",
        color: 0x35a7ff,
        gravity: 900,
        smoothingRadius: 32,
        targetDensity: 3.0,
        pressureMultiplier: 260,
        nearPressureMultiplier: 22,
        viscosity: 0.06,
        collisionDamping: 0.4,
        particleSize: 9,
    },
    {
        id: "miel",
        name: "Miel",
        color: 0xf2a900,
        gravity: 900,
        smoothingRadius: 34,
        targetDensity: 3.2,
        pressureMultiplier: 200,
        nearPressureMultiplier: 20,
        viscosity: 0.9,
        collisionDamping: 0.2,
        particleSize: 10,
    },
    {
        id: "lava",
        name: "Lava",
        color: 0xff4400,
        gravity: 700,
        smoothingRadius: 36,
        targetDensity: 3.4,
        pressureMultiplier: 180,
        nearPressureMultiplier: 26,
        viscosity: 1.6,
        collisionDamping: 0.15,
        particleSize: 12,
    },
    {
        id: "mercurio",
        name: "Mercurio",
        color: 0xc0c8d0,
        gravity: 980,
        smoothingRadius: 30,
        targetDensity: 4.2,
        pressureMultiplier: 340,
        nearPressureMultiplier: 30,
        viscosity: 0.02,
        collisionDamping: 0.5,
        particleSize: 9,
    },
    {
        id: "gas",
        name: "Gas / Vapor",
        color: 0x9be7c4,
        gravity: -120, // flota hacia arriba
        smoothingRadius: 40,
        targetDensity: 1.6,
        pressureMultiplier: 120,
        nearPressureMultiplier: 8,
        viscosity: 0.04,
        collisionDamping: 0.9,
        particleSize: 11,
    },
];

// Rango y paso de cada control numérico del panel (para construir sliders).
export const PARAM_META = {
    gravity: { label: "Gravedad", min: -400, max: 2000, step: 10 },
    smoothingRadius: { label: "Radio de influencia", min: 15, max: 60, step: 1 },
    targetDensity: { label: "Densidad de reposo", min: 0.5, max: 8, step: 0.1 },
    pressureMultiplier: { label: "Presión (rigidez)", min: 0, max: 600, step: 5 },
    nearPressureMultiplier: { label: "Presión cercana", min: 0, max: 80, step: 1 },
    viscosity: { label: "Viscosidad", min: 0, max: 3, step: 0.01 },
    collisionDamping: { label: "Amortiguación de rebote", min: 0, max: 1, step: 0.05 },
    particleSize: { label: "Tamaño de partícula", min: 3, max: 20, step: 1 },
};

// Clona profundo un material (evita compartir referencias entre presets).
export function cloneMaterial(m) {
    return { ...m };
}

function slugify(name) {
    return (
        name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || "material"
    );
}

// Genera un id único que no colisione con los existentes.
export function makeUniqueId(baseName, materials) {
    const base = slugify(baseName);
    let id = base;
    let n = 2;
    const taken = new Set(materials.map((m) => m.id));
    while (taken.has(id)) {
        id = `${base}-${n++}`;
    }
    return id;
}

// --- Persistencia -----------------------------------------------------------

// Carga la lista de materiales. Si no hay nada guardado, siembra los presets
// por defecto. Los presets de fábrica que el usuario no borró se re-fusionan,
// de modo que actualizaciones del código puedan añadir nuevos presets.
export function loadMaterials() {
    let stored = null;
    try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
        stored = null;
    }

    if (!Array.isArray(stored) || stored.length === 0) {
        const seed = DEFAULT_MATERIALS.map(cloneMaterial);
        saveMaterials(seed);
        return seed;
    }
    return stored;
}

export function saveMaterials(materials) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
    } catch (e) {
        console.warn("No se pudieron guardar los materiales:", e);
    }
}

export function loadSelectedId() {
    return localStorage.getItem(SELECTED_KEY);
}

export function saveSelectedId(id) {
    try {
        localStorage.setItem(SELECTED_KEY, id);
    } catch {
        /* ignore */
    }
}

// Restaura los presets de fábrica, descartando cambios del usuario.
export function resetToDefaults() {
    const seed = DEFAULT_MATERIALS.map(cloneMaterial);
    saveMaterials(seed);
    return seed;
}
