// liquidSystem.js
// El fluido compartido: un único sistema de partículas de LiquidFun.
// Todas las armas disparan acá, así los líquidos de los distintos
// jugadores chocan y se apilan entre sí. Cada partícula guarda su color.

export class LiquidSystem {
    #settings;
    #system;
    #particleDef; // se reutilizan en cada partícula para no crear objetos
    #vec; //         de Box2D por partícula (hay que liberarlos a mano)
    #color;

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
        this.#color = new Box2D.b2ParticleColor(0, 0, 0, 255);
    }

    get count() {
        return this.#system.GetParticleCount();
    }

    get particleRadius() {
        return this.#settings.particleRadius;
    }

    // Posición y velocidad en metros y m/s; color como 0xRRGGBB.
    createParticle(x, y, vx, vy, color, lifetime) {
        this.#vec.set_x(x);
        this.#vec.set_y(y);
        this.#particleDef.set_position(this.#vec);

        this.#vec.set_x(vx);
        this.#vec.set_y(vy);
        this.#particleDef.set_velocity(this.#vec);

        this.#color.Set((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255);
        this.#particleDef.set_color(this.#color);

        this.#particleDef.set_lifetime(lifetime);
        this.#system.CreateParticle(this.#particleDef);
    }

    // Recorre las partículas vivas: fn(x, y, color 0xRRGGBB).
    forEachParticle(fn) {
        const count = this.#system.GetParticleCount();
        if (count === 0) return;
        // Los buffers son punteros a la memoria de Emscripten: posiciones
        // como pares de float32 y colores como 4 bytes (r, g, b, a).
        // Los HEAP se piden en cada llamada porque cambian si la memoria crece.
        const floats = Box2D.HEAPF32;
        const bytes = Box2D.HEAPU8;
        const positions = Box2D.getPointer(this.#system.GetPositionBuffer()) >> 2;
        const colors = Box2D.getPointer(this.#system.GetColorBuffer());
        for (let i = 0; i < count; i++) {
            const c = colors + 4 * i;
            const color = (bytes[c] << 16) | (bytes[c + 1] << 8) | bytes[c + 2];
            fn(floats[positions + 2 * i], floats[positions + 2 * i + 1], color);
        }
    }
}
