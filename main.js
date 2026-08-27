// main.js
import { FluidSystem } from "./fluidSystem.js";

const app = new PIXI.Application();

await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    resizeTo: window,
});

app.stage.eventMode = "static";
app.stage.hitArea = new PIXI.Rectangle(
    0,
    0,
    window.innerWidth,
    window.innerHeight,
);

app.stage.on("pointermove", (e) => {
    fluidSimulator.mousePos = { x: e.global.x, y: e.global.y };
});

// Filtro de desenfoque
const blurFilter = new PIXI.BlurFilter();
blurFilter.strength = 5; // Ajustá este valor según el tamaño de tu sprite

// Filtro de matriz de color para endurecer el canal Alpha
const colorMatrix = new PIXI.ColorMatrixFilter();
colorMatrix.matrix = [
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    20,
    -7, // Multiplica el alpha por 20 y le resta 7 (threshold)
];

app.stage.filters = [blurFilter, colorMatrix];

document.body.appendChild(app.canvas);

// Crear textura optimizada
const graphics = new PIXI.Graphics();
graphics.circle(0, 0, 10).fill(0xffffff); // blanco: se tiñe por densidad en runtime
const particleTexture = app.renderer.generateTexture(graphics);

// Iniciar sistema
const fluidSimulator = new FluidSystem(app.stage, particleTexture);
fluidSimulator.spawnParticles(300); // 300 partículas para empezar

// Bucle de juego
app.ticker.add(() => {
    // PixiJS ticker delta time es dependiente de los FPS,
    // lo normalizamos dividiendo por 60 para cálculos físicos.
    const dt = app.ticker.deltaMS / 1000;

    // Evitar picos de lag que rompan la simulación
    const cappedDt = Math.min(dt, 0.03);

    fluidSimulator.update(cappedDt);
});

// ------------------------------------------------------------------
// PANEL DE CONTROL: conecta los sliders del HTML a las propiedades
// del FluidSystem para poder tocar los parámetros en vivo durante
// la exposición, sin tener que tocar código ni recargar la página.
// ------------------------------------------------------------------

function bindSlider(id, labelId, getFormatted, onInput) {
    const input = document.getElementById(id);
    const label = document.getElementById(labelId);
    label.textContent = getFormatted(Number(input.value));
    input.addEventListener("input", () => {
        const value = Number(input.value);
        label.textContent = getFormatted(value);
        onInput(value);
    });
}

// Sincronizamos el valor inicial de cada slider con el valor por defecto
// que ya tiene el FluidSystem, para que el panel no "mienta" al abrir.
document.getElementById("gravity").value = fluidSimulator.gravity;
document.getElementById("radius").value = fluidSimulator.smoothingRadius;
document.getElementById("density").value = fluidSimulator.targetDensity;
document.getElementById("pressure").value = fluidSimulator.pressureMultiplier;
document.getElementById("viscosity").value = fluidSimulator.viscosityMultiplier;
document.getElementById("particleCount").value =
    fluidSimulator.particles.length;

bindSlider(
    "gravity",
    "gravityVal",
    (v) => v.toFixed(0),
    (v) => (fluidSimulator.gravity = v),
);

bindSlider(
    "radius",
    "radiusVal",
    (v) => v.toFixed(0),
    (v) => (fluidSimulator.smoothingRadius = v),
);

bindSlider(
    "density",
    "densityVal",
    (v) => v.toFixed(1),
    (v) => (fluidSimulator.targetDensity = v),
);

bindSlider(
    "pressure",
    "pressureVal",
    (v) => v.toFixed(0),
    (v) => (fluidSimulator.pressureMultiplier = v),
);

bindSlider(
    "viscosity",
    "viscosityVal",
    (v) => v.toFixed(2),
    (v) => (fluidSimulator.viscosityMultiplier = v),
);

bindSlider(
    "particleCount",
    "countVal",
    (v) => v.toFixed(0),
    () => {}, // el respawn real se dispara al soltar el slider, no en cada tick
);

// Al soltar el mouse del slider de partículas, recién ahí destruimos y
// creamos de nuevo (hacerlo en cada "input" sería carísimo).
document.getElementById("particleCount").addEventListener("change", (e) => {
    fluidSimulator.respawn(Number(e.target.value));
});

document.getElementById("respawnBtn").addEventListener("click", () => {
    fluidSimulator.respawn(fluidSimulator.particles.length);
});

const pauseBtn = document.getElementById("pauseBtn");
let paused = false;
pauseBtn.addEventListener("click", () => {
    paused = !paused;
    if (paused) {
        app.ticker.stop();
        pauseBtn.textContent = "Reanudar";
    } else {
        app.ticker.start();
        pauseBtn.textContent = "Pausar";
    }
});
