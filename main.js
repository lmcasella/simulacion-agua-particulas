// main.js
// -----------------------------------------------------------------------------
// Punto de entrada: crea la app PixiJS, el sistema de fluido y el panel,
// conecta la interacción del ratón y arranca el bucle de simulación.
// -----------------------------------------------------------------------------

import { FluidSystem } from "./fluidSystem.js";
import { UIController } from "./ui.js";
import { loadMaterials, loadSelectedId } from "./materials.js";

const app = new PIXI.Application();

await app.init({
    backgroundColor: 0x0f1420,
    resizeTo: window,
    antialias: true,
});

document.getElementById("canvas-host").appendChild(app.canvas);

// Textura base: un círculo blanco suave. Al ser blanco, el tint del material
// reproduce cualquier color sin recrear la textura.
const g = new PIXI.Graphics();
g.circle(0, 0, 32).fill(0xffffff);
const particleTexture = app.renderer.generateTexture({
    target: g,
    resolution: 2,
});

// Contenedor de partículas. Un ParticleContainer dibuja miles de partículas
// (que comparten la misma textura) en UN solo lote de dibujo, en vez de tratar
// cada sprite como un nodo del grafo de escena. Por defecto sólo la POSICIÓN es
// dinámica (se sube a la GPU cada frame); color y escala son estáticos y se
// refrescan bajo demanda con container.update() al reestilizar un material.
const particleLayer = new PIXI.ParticleContainer();
app.stage.addChild(particleLayer);

// Paleta de materiales (referencia compartida entre el solver y la UI) y
// material activo inicial (el último seleccionado o el primer preset).
const materials = loadMaterials();
const savedId = loadSelectedId();
let activeIndex = materials.findIndex((m) => m.id === savedId);
if (activeIndex < 0) activeIndex = 0;

// Sistema de fluido.
const sim = new FluidSystem(particleLayer, particleTexture, materials, activeIndex);
sim.setBounds(app.renderer.width, app.renderer.height);

const INITIAL_COUNT = 700;
sim.setParticleCount(INITIAL_COUNT);

// Panel de control.
const ui = new UIController(sim, {
    initialCount: INITIAL_COUNT,
    onRespawn: () => {
        const n = ui.particleCount;
        sim.clear();
        sim.setParticleCount(n);
    },
    // maxFps = 0 => sin límite: el ticker corre al ritmo de refresco del
    // monitor (por rAF). Cualquier otro valor limita los FPS.
    onSetFps: (maxFps) => {
        app.ticker.maxFPS = maxFps;
    },
});

// Por defecto, "Auto": PixiJS ya sincroniza con la frecuencia del monitor
// (rAF). Si el navegador no lo respetara, este valor actúa de red de seguridad.
app.ticker.maxFPS = 0;

// ----- Interacción con el ratón / puntero -----------------------------------
const host = app.canvas;

function updateMouse(e) {
    const rect = host.getBoundingClientRect();
    sim.mouse.x = e.clientX - rect.left;
    sim.mouse.y = e.clientY - rect.top;
}

host.addEventListener("pointerdown", (e) => {
    updateMouse(e);
    sim.mouse.down = true;
});
host.addEventListener("pointermove", updateMouse);
window.addEventListener("pointerup", () => {
    sim.mouse.down = false;
});
// Salir del lienzo suelta la interacción.
host.addEventListener("pointerleave", () => {
    sim.mouse.down = false;
});

// ----- Redimensionado -------------------------------------------------------
window.addEventListener("resize", () => {
    sim.setBounds(app.renderer.width, app.renderer.height);
});

// ----- Bucle principal ------------------------------------------------------
let fpsSmooth = 60; // media móvil de FPS
let fpsAccum = 0; // acumulador para refrescar el display ~4 veces/seg

app.ticker.add(() => {
    // deltaMS -> segundos. Capamos para evitar explosiones tras un lag/pestaña
    // en segundo plano.
    const dt = Math.min(app.ticker.deltaMS / 1000, 1 / 30);

    // 0) HERRAMIENTAS: crear/borrar partículas con el puntero (aun en pausa).
    sim.applyPointerTool();
    // 1) LÓGICA: avanza la física (no toca las partículas de render).
    sim.update(dt);
    // 2) RENDER: vuelca posiciones a PixiJS. Siempre se ejecuta, aun en pausa,
    //    para reflejar cambios de estilo o de partículas.
    sim.render();

    // FPS reales (suavizados) + recuento de partículas para el panel.
    const instFps = 1000 / Math.max(app.ticker.deltaMS, 1e-3);
    fpsSmooth += (instFps - fpsSmooth) * 0.1;
    fpsAccum += app.ticker.deltaMS;
    if (fpsAccum >= 250) {
        fpsAccum = 0;
        ui.setFpsDisplay(fpsSmooth);
        ui.setCountDisplay(sim.count);
    }
});
