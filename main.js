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

document.body.appendChild(app.canvas);

// Crear textura optimizada
const graphics = new PIXI.Graphics();
graphics.circle(0, 0, 10).fill(0xffffff); // blanco: se tiñe por densidad en runtime
const particleTexture = app.renderer.generateTexture(graphics);

// Capa exclusiva para el agua
const fluidContainer = new PIXI.Container();
app.stage.addChild(fluidContainer);

// Capa exclusiva para las líneas (evita que el radar se desenfoque)
const debugContainer = new PIXI.Container();
app.stage.addChild(debugContainer);

// Filtros Metaballs
const blurFilter = new PIXI.BlurFilter();
blurFilter.strength = 8; // Expande el halo

// Control del Filtro Metaball
const blurInput = document.getElementById("blurSlider");
const blurLabel = document.getElementById("blurVal");

blurLabel.textContent = blurInput.value;

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
    -7, // Guillotina del canal Alpha
];

fluidContainer.filters = [blurFilter, colorMatrix];

// Iniciar sistema pasando ambos contenedores
const fluidSimulator = new FluidSystem(
    fluidContainer,
    debugContainer,
    particleTexture,
);
fluidSimulator.spawnParticles(300);

// ------------------------------------------------------------------
// Dibujo de referencia de las paredes del contenedor y del
// obstáculo central, para que se entienda visualmente dónde están los
// límites físicos.
// ------------------------------------------------------------------
const containerGraphic = new PIXI.Graphics();
app.stage.addChild(containerGraphic);
containerGraphic.zIndex = -1; // detrás de las partículas

function drawContainer() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = w * fluidSimulator.containerMarginRatio;

    containerGraphic.clear();
    containerGraphic.setStrokeStyle({ width: 2, color: 0x445566, alpha: 0.8 });
    // Pared izquierda
    containerGraphic.moveTo(margin, 0);
    containerGraphic.lineTo(margin, h);
    // Pared derecha
    containerGraphic.moveTo(w - margin, 0);
    containerGraphic.lineTo(w - margin, h);
    containerGraphic.stroke();

    // Obstáculo central (mismo radio que en resolveBoundaries)
    containerGraphic.setStrokeStyle({ width: 2, color: 0x445566, alpha: 0.8 });
    containerGraphic.circle(w / 2, h / 2, 80);
    containerGraphic.stroke();
}
drawContainer();
window.addEventListener("resize", drawContainer);

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

document.getElementById("useHash").addEventListener("change", (e) => {
    fluidSimulator.useSpatialHash = e.target.checked;
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

blurInput.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    blurLabel.textContent = val;

    if (val === 0) {
        // Desactivar filtros para ver las partículas puras (Mejora el rendimiento)
        fluidContainer.filters = [];
    } else {
        // Activar filtros y actualizar la fuerza del desenfoque
        blurFilter.strength = val;
        fluidContainer.filters = [blurFilter, colorMatrix];
    }
});
