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
import { GamepadInput } from "./gamepadInput.js";
import { combineInputs } from "./combinedInput.js";
import { LiquidSystem } from "./liquidSystem.js";
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
const liquid = new LiquidSystem(world, CONFIG.liquid);
const renderer = new SceneRenderer(app, CONFIG.view);

// Input y arma de cada jugador viven toda la sesión; el personaje se
// recrea cada vez que se importa un ragdoll.
const players = CONFIG.players.map((settings) => {
    const gamepad = new GamepadInput(settings.gamepadSlot, CONFIG.gamepad);
    return {
        settings,
        gamepad,
        input: combineInputs(new KeyboardInput(settings.keys), gamepad),
        gun: new LiquidGun(liquid, CONFIG.liquidGun, settings.liquidColor),
        character: null,
        controller: null,
    };
});

// Reemplaza los personajes por otros nuevos a partir de un ragdoll ya
// parseado ({ def, json } de ragdollLoader). Todos usan el mismo ragdoll.
function useRagdoll({ def, json }, label) {
    const bodyNames = json.bodies.map((body) => body.name);
    const emitterBody = bodyNames.includes(CONFIG.character.emitterBody)
        ? CONFIG.character.emitterBody
        : bodyNames.at(-1);

    for (const player of players) player.character?.destroy();
    for (const player of players) {
        const { spawnX, facing } = player.settings;
        player.character = new Character(world, def, { x: spawnX, facing, emitterBody });
        player.controller = new CharacterController(
            player.character,
            player.gun,
            player.input,
            CONFIG.character,
        );
    }

    showRagdollInfo(label, bodyNames, emitterBody);
}

// ------------------------------------------------------------------
// Panel: importar archivo, elegir body emisor, jugadores, errores
// ------------------------------------------------------------------
const fileName = document.getElementById("fileName");
const fileInput = document.getElementById("fileInput");
const emitterSelect = document.getElementById("emitterSelect");
const playersPanel = document.getElementById("players");
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

// Una fila por jugador: nombre (con su color), teclas y gamepad asignado.
const playerRows = players.map(({ settings }) => {
    const row = document.createElement("div");
    row.className = "player";
    row.style.borderLeftColor = `#${settings.liquidColor.toString(16).padStart(6, "0")}`;
    const { left, right, jump, shoot } = settings.keys;
    row.innerHTML = `
        <b>${settings.name}</b>
        <div><kbd>${keyLabel(left[0])}</kbd>/<kbd>${keyLabel(right[0])}</kbd> moverse ·
             <kbd>${keyLabel(jump[0])}</kbd> saltar ·
             <kbd>${keyLabel(shoot[0])}</kbd> disparar</div>
        <div class="pad"></div>`;
    playersPanel.appendChild(row);
    return row.querySelector(".pad");
});

function refreshGamepadStatus() {
    players.forEach(({ gamepad }, i) => {
        const pad = gamepad.gamepad;
        const text = pad ? `🎮 ${pad.id}` : "🎮 sin gamepad (apretá un botón)";
        if (playerRows[i].textContent !== text) playerRows[i].textContent = text;
    });
}

function keyLabel(code) {
    const names = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "Espacio" };
    return names[code] ?? code.replace(/^(Key|Digit)/, "");
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
    for (const { character } of players) character?.setEmitterBody(emitterSelect.value);
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
        for (const { controller } of players) controller?.update(STEP);
        const instances = players.filter((p) => p.character).map((p) => p.character.instance);
        stepWorld(world, instances, STEP);
        accumulator -= STEP;
    }

    renderer.draw({ staticBodies, players, liquid }, frameDt);
    particleCount.textContent = liquid.count;
    refreshGamepadStatus();
});

// Ragdoll por defecto
try {
    useRagdoll(await fetchRagdoll(CONFIG.defaultRagdollUrl), "robot.rag.json");
} catch (error) {
    showError(CONFIG.defaultRagdollUrl, error);
}
