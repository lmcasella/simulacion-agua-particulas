// main.js
import { FluidSystem } from "./fluidSystem.js";

const app = new PIXI.Application();

await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    resizeTo: window,
});

document.body.appendChild(app.canvas);

// Crear textura optimizada
const graphics = new PIXI.Graphics();
graphics.circle(0, 0, 10).fill(0x00bfff);
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
