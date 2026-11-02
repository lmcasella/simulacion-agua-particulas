// characterController.js
// Traduce la intención del jugador en acciones del personaje y del arma.
// `input` es cualquier objeto con { moveAxis, shooting }: hoy el teclado,
// mañana un gamepad o una IA, sin tocar este archivo.

export class CharacterController {
    constructor(character, gun, input, settings) {
        this.character = character;
        this.gun = gun;
        this.input = input;
        this.settings = settings;
    }

    // Llamar una vez por paso de simulación, antes de stepWorld.
    update(dt) {
        const { moveSpeed, acceleration } = this.settings;
        const axis = this.input.moveAxis; // -1, 0 o 1
        const shooting = this.input.shooting;

        this.character.face(axis);
        this.character.move(axis * moveSpeed, acceleration, dt);
        this.character.setClip(this.#clipFor(axis, shooting));

        if (shooting) this.gun.fire(this.character.muzzle(), dt);
    }

    // Qué animación corresponde a cada estado. Caminar tiene prioridad
    // para que las piernas no queden congeladas al disparar en movimiento.
    #clipFor(axis, shooting) {
        const { clips } = this.settings;
        if (axis !== 0) return clips.walk;
        if (shooting) return clips.shoot;
        return clips.idle;
    }
}
