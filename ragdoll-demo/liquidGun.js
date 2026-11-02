// liquidGun.js
// Emisor de líquido de un jugador. Recibe un "muzzle"
// ({ x, y, dirX, dirY, vx, vy }) y no le importa de dónde sale: la punta
// de un brazo, una manguera fija o el mouse. Las partículas van al
// LiquidSystem compartido, con el color de esta arma.

export class LiquidGun {
    #liquid;
    #settings;
    #color;
    #pending = 0; // fracción de partícula acumulada entre pasos

    constructor(liquid, settings, color) {
        this.#liquid = liquid;
        this.#settings = settings;
        this.#color = color;
    }

    // Llamar una vez por paso de simulación mientras se dispara.
    fire(muzzle, dt) {
        if (!muzzle) return;
        this.#pending += this.#settings.particlesPerSecond * dt;
        while (this.#pending >= 1) {
            this.#pending -= 1;
            this.#emit(muzzle, dt);
        }
    }

    #emit({ x, y, dirX, dirY, vx, vy }, dt) {
        const { muzzleSpeed, spread, lifetime } = this.#settings;
        const angle = Math.atan2(dirY, dirX) + (Math.random() * 2 - 1) * spread;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Cada partícula sale un poco más adelante que la anterior (como si
        // hubiera salido en distintos momentos del paso) para que no nazcan
        // todas encimadas y la presión del fluido las haga explotar.
        const advance = muzzleSpeed * dt * Math.random();

        this.#liquid.createParticle(
            x + cos * advance,
            y + sin * advance,
            vx + cos * muzzleSpeed,
            vy + sin * muzzleSpeed,
            this.#color,
            lifetime,
        );
    }
}
