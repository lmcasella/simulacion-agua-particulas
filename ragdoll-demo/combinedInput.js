// combinedInput.js
// Une varios inputs ({ moveAxis, shooting }) en uno solo: se mueve con el
// primero que tenga movimiento y dispara si cualquiera dispara. Así cada
// jugador puede usar teclado o gamepad indistintamente.

export function combineInputs(...inputs) {
    return {
        get moveAxis() {
            for (const input of inputs) {
                const axis = input.moveAxis;
                if (axis !== 0) return axis;
            }
            return 0;
        },
        get shooting() {
            return inputs.some((input) => input.shooting);
        },
    };
}
