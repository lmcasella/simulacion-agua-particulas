// liquidGun.js
// Emisor de agua sobre el sistema de partículas de LiquidFun. Recibe un
// "muzzle" ({ x, y, dirX, dirY, vx, vy }) y no le importa de dónde sale:
// la punta de un brazo, una manguera fija o el mouse.

export class LiquidGun {
    #settings;
    #system;
    #particleDef; // se reutilizan en cada disparo para no crear objetos
    #vec; //         de Box2D por partícula (hay que liberarlos a mano)
    #pending = 0; // fracción de partícula acumulada entre frames

    constructor(world, settings) {
        this.#settings = settings;

        const systemDef = new Box2D.b2ParticleSystemDef();
        systemDef.set_radius(settings.particleRadius);
        systemDef.set_maxCount(settings.maxParticles);
        systemDef.set_destroyByAge(true); // al llenarse, recicla las más viejas
        this.#system = world.CreateParticleSystem(systemDef);
        Box2D.destroy(systemDef);

        this.#particleDef = new Box2D.b2ParticleDef();
        this.#vec = new Box2D.b2Vec2(0, 0);
    }

    get count() {
        return this.#system.GetParticleCount();
    }

    get particleRadius() {
        return this.#settings.particleRadius;
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

    // Recorre las posiciones de las partículas vivas (metros).
    forEachParticle(fn) {
        const count = this.#system.GetParticleCount();
        if (count === 0) return;
        // GetPositionBuffer devuelve un puntero a un array de b2Vec2 en la
        // memoria de Emscripten; se lee directo como pares de float32.
        // HEAPF32 se pide en cada llamada porque cambia si la memoria crece.
        const heap = Box2D.HEAPF32;
        const base = Box2D.getPointer(this.#system.GetPositionBuffer()) >> 2;
        for (let i = 0; i < count; i++) {
            fn(heap[base + 2 * i], heap[base + 2 * i + 1]);
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

        this.#vec.set_x(x + cos * advance);
        this.#vec.set_y(y + sin * advance);
        this.#particleDef.set_position(this.#vec);

        this.#vec.set_x(vx + cos * muzzleSpeed);
        this.#vec.set_y(vy + sin * muzzleSpeed);
        this.#particleDef.set_velocity(this.#vec);

        this.#particleDef.set_lifetime(lifetime);
        this.#system.CreateParticle(this.#particleDef);
    }
}
