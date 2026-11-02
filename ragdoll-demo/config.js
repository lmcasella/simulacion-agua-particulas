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
        maxPixelsPerMeter: 120, // zoom máximo (jugadores cerca)
        cameraMargin: 4, // m extra a los costados del encuadre de los jugadores
        groundOffsetPx: 90, // distancia del piso al borde inferior de la pantalla
        cameraSmoothing: 6, // 1/s: más alto = la cámara sigue más pegada
        background: 0x1a1a1a,
        staticColor: 0x445566,
        outlineColor: 0x1a1a1a,
        muzzleColor: 0xffffff,
    },

    // Un objeto por jugador: agregar o quitar entradas cambia la cantidad
    // de jugadores, sin tocar código.
    players: [
        {
            name: "Jugador 1",
            spawnX: -3, // m
            facing: 1, // 1 = mira a la derecha, -1 = a la izquierda
            bodyColor: 0x7fa7d9,
            liquidColor: 0x3399ff,
            keys: { left: ["KeyA"], right: ["KeyD"], shoot: ["Space"] },
            gamepadSlot: 0, // 0 = primer gamepad conectado
        },
        {
            name: "Jugador 2",
            spawnX: 3,
            facing: -1,
            bodyColor: 0xd9a07f,
            liquidColor: 0xff8833,
            keys: { left: ["ArrowLeft"], right: ["ArrowRight"], shoot: ["Enter"] },
            gamepadSlot: 1,
        },
    ],

    // Botones/ejes según el "standard mapping" de la Gamepad API (layout Xbox):
    // 0 = A, 5 = RB, 7 = RT, 14/15 = D-pad izquierda/derecha.
    gamepad: {
        stickAxis: 0, // stick izquierdo, eje X
        deadzone: 0.25, // por debajo de esto el stick cuenta como suelto
        leftButtons: [14],
        rightButtons: [15],
        shootButtons: [0, 5, 7],
    },

    character: {
        moveSpeed: 2.5, // m/s
        acceleration: 10, // 1/s: qué tan rápido alcanza moveSpeed

        // Clip a reproducir en cada estado (key del clip en el .rag.json).
        // null = sin clip: el ragdoll sostiene su pose de reposo. Si el
        // ragdoll cargado no tiene alguno de estos clips, se ignora.
        clips: { idle: null, walk: "walk", shoot: "aim" },

        // Body de cuya punta sale el líquido. Si el ragdoll cargado no lo
        // tiene, se usa el último body del archivo (y se puede cambiar
        // desde el panel).
        emitterBody: "body_3_copy",
    },

    // El fluido compartido por todos los jugadores.
    liquid: {
        particleRadius: 0.035, // m
        maxParticles: 3000, // al llegar al tope se reciclan las más viejas
    },

    // Cada arma (una por jugador).
    liquidGun: {
        particlesPerSecond: 240,
        muzzleSpeed: 7, // m/s
        spread: 0.08, // rad, apertura del chorro a cada lado
        lifetime: 6, // s que vive cada partícula
    },
};
