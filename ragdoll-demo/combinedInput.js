// combinedInput.js
// Une varios inputs ({ moveAxis, jumping, shooting }) en uno solo: se
// mueve con el primero que tenga movimiento y salta/dispara si cualquiera
// lo hace. Así cada jugador puede usar teclado o gamepad indistintamente.

export function combineInputs(...inputs) {
    return {
        get moveAxis() {
            for (const input of inputs) {
                const axis = input.moveAxis;
                if (axis !== 0) return axis;
            }
            return 0;
        },
        get jumping() {
            return inputs.some((input) => input.jumping);
        },
        get shooting() {
            return inputs.some((input) => input.shooting);
        },
    };
}
