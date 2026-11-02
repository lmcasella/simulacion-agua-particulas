// keyboardInput.js
// Lee el teclado y lo expone como intención: { moveAxis, jumping, shooting }.
// `bindings` mapea cada acción a una lista de KeyboardEvent.code.

export class KeyboardInput {
    #bindings;
    #pressed = new Set();

    constructor(bindings, target = window) {
        this.#bindings = bindings;
        const bound = new Set(Object.values(bindings).flat());

        target.addEventListener("keydown", (e) => {
            if (!bound.has(e.code)) return;
            e.preventDefault(); // evita que Espacio/flechas scrolleen la página
            this.#pressed.add(e.code);
        });
        target.addEventListener("keyup", (e) => this.#pressed.delete(e.code));
        // Si la ventana pierde el foco con una tecla apretada, nunca llega
        // el keyup: soltamos todo para que el personaje no siga caminando.
        target.addEventListener("blur", () => this.#pressed.clear());
    }

    get moveAxis() {
        return (this.#isDown("right") ? 1 : 0) - (this.#isDown("left") ? 1 : 0);
    }

    get jumping() {
        return this.#isDown("jump");
    }

    get shooting() {
        return this.#isDown("shoot");
    }

    #isDown(action) {
        const codes = this.#bindings[action] ?? []; // acción sin teclas = nunca
        return codes.some((code) => this.#pressed.has(code));
    }
}
