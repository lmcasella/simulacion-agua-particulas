// config.js
// Todos los valores "tocables" del demo en un solo lugar. Unidades del
// mundo físico en metros / segundos, con Y hacia ARRIBA (convención de
// RagAssembler y de Box2D). Solo el render convierte a píxeles.
export const CONFIG = {
    defaultRagdollUrl: "./assets/robot.rag.json",

    world: {
        gravity: { x: 0, y: -10 }, // m/s²
        arenaHalfWidth: 12, // m: el piso va de -12 a +12, con paredes en los bordes
        wallHeight: 8, // m: altas, para que el agua apilada no salpique afuera
    },

    view: {
        pixelsPerMeter: 120,
        groundOffsetPx: 90, // distancia del piso al borde inferior de la pantalla
        cameraSmoothing: 6, // 1/s: más alto = la cámara sigue más pegada
        background: 0x1a1a1a,
        staticColor: 0x445566,
        bodyColor: 0x8c9eb5,
        outlineColor: 0x1a1a1a,
        muzzleColor: 0xff5a5a,
        waterColor: 0x3399ff,
    },

    character: {
        spawnX: 0, // m
        moveSpeed: 2.5, // m/s
        acceleration: 10, // 1/s: qué tan rápido alcanza moveSpeed

        // Clip a reproducir en cada estado (key del clip en el .rag.json).
        // null = sin clip: el ragdoll sostiene su pose de reposo. Si el
        // ragdoll cargado no tiene alguno de estos clips, se ignora.
        clips: { idle: null, walk: "walk", shoot: "aim" },

        // Body de cuya punta sale el agua. Si el ragdoll cargado no lo
        // tiene, se usa el último body del archivo (y se puede cambiar
        // desde el panel).
        emitterBody: "body_3_copy",
    },

    liquidGun: {
        particleRadius: 0.035, // m
        maxParticles: 1500, // al llegar al tope se reciclan las más viejas
        particlesPerSecond: 240,
        muzzleSpeed: 7, // m/s
        spread: 0.08, // rad, apertura del chorro a cada lado
        lifetime: 6, // s que vive cada partícula
    },

    // Teclas por acción, en formato KeyboardEvent.code.
    controls: {
        left: ["KeyA", "ArrowLeft"],
        right: ["KeyD", "ArrowRight"],
        shoot: ["Space", "KeyJ"],
    },
};
