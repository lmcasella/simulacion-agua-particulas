// characterController.js
// Traduce la intención del jugador en acciones del personaje y del arma.
// `input` es cualquier objeto con { moveAxis, jumping, shooting }: hoy el
// teclado o un gamepad, mañana una IA, sin tocar este archivo.

export class CharacterController {
    #airTime = 0; // s seguidos sin tocar el piso

    constructor(character, gun, input, settings) {
        this.character = character;
        this.gun = gun;
        this.input = input;
        this.settings = settings;
    }

    // Llamar una vez por paso de simulación, antes de stepWorld.
    update(dt) {
        const { moveSpeed, acceleration, jumpSpeed, coyoteTime } = this.settings;
        const axis = this.input.moveAxis; // -1 a 1
        const shooting = this.input.shooting;

        // Un ragdoll pierde contacto con el piso por un instante todo el
        // tiempo (al caminar, al balancearse). Recién después de coyoteTime
        // sin piso se lo considera "en el aire".
        this.#airTime = this.character.isGrounded() ? 0 : this.#airTime + dt;
        const grounded = this.#airTime <= coyoteTime;

        this.character.face(axis);
        this.character.move(axis * moveSpeed, acceleration, dt);
        // Solo desde el piso: mantener apretado salta de nuevo al aterrizar.
        if (this.input.jumping && grounded) this.character.jump(jumpSpeed);
        this.character.setClip(this.#clipFor(axis, shooting, grounded));

        if (shooting) this.gun.fire(this.character.muzzle(), dt);
    }

    // Qué animación corresponde a cada estado, en orden de prioridad.
    // Caminar va antes que disparar para que las piernas no queden
    // congeladas al disparar en movimiento.
    #clipFor(axis, shooting, grounded) {
        const { clips } = this.settings;
        if (!grounded) return clips.jump;
        if (axis !== 0) return clips.walk;
        if (shooting) return clips.shoot;
        return clips.idle;
    }
}
