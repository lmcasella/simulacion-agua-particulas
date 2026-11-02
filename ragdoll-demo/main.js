// main.js
// Punto de entrada: arma las piezas, conecta el panel y corre el loop.
// La lógica vive en cada módulo; acá solo se "enchufan" entre sí.
import { RagImporter, STEP_SETTINGS, stepWorld } from "ragimporter";
import { CONFIG } from "./config.js";
import { createWorld, createArena } from "./world.js";
import { fetchRagdoll, parseRagdoll, describeError } from "./ragdollLoader.js";
import { Character } from "./character.js";
import { CharacterController } from "./characterController.js";
import { KeyboardInput } from "./keyboardInput.js";
import { LiquidGun } from "./liquidGun.js";
import { SceneRenderer } from "./sceneRenderer.js";

RagImporter.configure({ Box2D, PIXI });

const app = new PIXI.Application();
await app.init({
    resizeTo: window,
    background: CONFIG.view.background,
    antialias: true,
});
document.body.appendChild(app.canvas);

// ------------------------------------------------------------------
// Escena
// ------------------------------------------------------------------
const world = createWorld(CONFIG.world);
const staticBodies = createArena(world, CONFIG.world);
const gun = new LiquidGun(world, CONFIG.liquidGun);
const input = new KeyboardInput(CONFIG.controls);
const renderer = new SceneRenderer(app, CONFIG.view);

let character = null;
let controller = null;

// Reemplaza el personaje actual por uno nuevo a partir de un ragdoll
// ya parseado ({ def, json } de ragdollLoader).
function useRagdoll({ def, json }, label) {
    const bodyNames = json.bodies.map((body) => body.name);
    const emitterBody = bodyNames.includes(CONFIG.character.emitterBody)
        ? CONFIG.character.emitterBody
        : bodyNames.at(-1);

    character?.destroy();
    character = new Character(world, def, { x: CONFIG.character.spawnX, emitterBody });
    controller = new CharacterController(character, gun, input, CONFIG.character);

    showRagdollInfo(label, bodyNames, emitterBody);
}

// ------------------------------------------------------------------
// Panel: importar archivo, elegir body emisor, errores
// ------------------------------------------------------------------
const fileName = document.getElementById("fileName");
const fileInput = document.getElementById("fileInput");
const emitterSelect = document.getElementById("emitterSelect");
const particleCount = document.getElementById("particleCount");
const errorBox = document.getElementById("error");

function showRagdollInfo(label, bodyNames, emitterBody) {
    fileName.textContent = label;
    emitterSelect.replaceChildren(...bodyNames.map((name) => new Option(name, name)));
    emitterSelect.value = emitterBody;
    errorBox.hidden = true;
}

function showError(label, error) {
    errorBox.textContent = `${label}: ${describeError(error)}`;
    errorBox.hidden = false;
}

async function loadFile(file) {
    try {
        useRagdoll(parseRagdoll(await file.text()), file.name);
    } catch (error) {
        showError(file.name, error);
    }
}

fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files;
    fileInput.value = ""; // permite volver a elegir el mismo archivo
    fileInput.blur(); // que las teclas vuelvan al juego
    if (file) await loadFile(file);
});

emitterSelect.addEventListener("change", () => {
    character?.setEmitterBody(emitterSelect.value);
    emitterSelect.blur();
});

// Arrastrar y soltar un .rag.json en cualquier parte de la ventana.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (file) await loadFile(file);
});

// ------------------------------------------------------------------
// Loop: paso fijo (el que espera RagImporter) + render una vez por frame
// ------------------------------------------------------------------
const STEP = STEP_SETTINGS.dt;
const MAX_FRAME = 0.25; // s: evita la "espiral de la muerte" tras un lag
let accumulator = 0;

app.ticker.add((ticker) => {
    const frameDt = ticker.deltaMS / 1000;
    accumulator = Math.min(accumulator + frameDt, MAX_FRAME);
    while (accumulator >= STEP) {
        controller?.update(STEP);
        stepWorld(world, character ? [character.instance] : [], STEP);
        accumulator -= STEP;
    }

    renderer.draw({ staticBodies, character, gun }, frameDt);
    particleCount.textContent = gun.count;
});

// Ragdoll por defecto
try {
    useRagdoll(await fetchRagdoll(CONFIG.defaultRagdollUrl), "robot.rag.json");
} catch (error) {
    showError(CONFIG.defaultRagdollUrl, error);
}
