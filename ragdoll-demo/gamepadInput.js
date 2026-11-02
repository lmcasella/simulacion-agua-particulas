// gamepadInput.js
// Lee un gamepad y lo expone como intención: { moveAxis, jumping, shooting }.
// Usa el "standard mapping" de la Gamepad API (layout tipo Xbox), que es
// el que reportan Chrome/Edge/Firefox para la mayoría de los joysticks.
//
// Ojo: por privacidad, el navegador no muestra ningún gamepad hasta que
// se aprieta un botón con la página en foco.

export class GamepadInput {
    #slot;
    #settings;

    // slot: 0 = primer gamepad conectado, 1 = segundo, etc.
    constructor(slot, settings) {
        this.#slot = slot;
        this.#settings = settings;
    }

    // El Gamepad asignado a este slot, o null si no hay.
    get gamepad() {
        return connectedGamepads()[this.#slot] ?? null;
    }

    // Analógico (-1 a 1) con el stick; -1, 0 o 1 con el D-pad.
    get moveAxis() {
        const pad = this.gamepad;
        if (!pad) return 0;
        const { stickAxis, deadzone, leftButtons, rightButtons } = this.#settings;

        const stick = pad.axes[stickAxis] ?? 0;
        if (Math.abs(stick) >= deadzone) return stick;
        return (anyPressed(pad, rightButtons) ? 1 : 0) - (anyPressed(pad, leftButtons) ? 1 : 0);
    }

    get jumping() {
        const pad = this.gamepad;
        return pad !== null && anyPressed(pad, this.#settings.jumpButtons);
    }

    get shooting() {
        const pad = this.gamepad;
        return pad !== null && anyPressed(pad, this.#settings.shootButtons);
    }
}

// getGamepads() devuelve una "foto" del estado actual, con huecos (null)
// para los slots vacíos: hay que pedirla de nuevo en cada lectura.
function connectedGamepads() {
    return [...(navigator.getGamepads?.() ?? [])].filter((pad) => pad?.connected);
}

function anyPressed(pad, buttons) {
    return buttons.some((index) => pad.buttons[index]?.pressed);
}
