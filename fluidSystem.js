// fluidSystem.js
import { Particle } from "./particle.js";
export class FluidSystem {
    constructor(stage, texture) {
        this.particles = [];
        this.stage = stage;
        this.texture = texture;

        // Constantes SPH
        this.gravity = 980; // Aceleración en Y hacia abajo
        this.smoothingRadius = 30; // El círculo de influencia (h)
        this.targetDensity = 1.0; // Densidad de reposo
    }

    spawnParticles(count) {
        for (let i = 0; i < count; i++) {
            // Spawnea partículas en posiciones aleatorias o en bloque
            let px = Math.random() * 400 + 100;
            let py = Math.random() * 200 + 100;
            this.particles.push(new Particle(px, py, this.texture, this.stage));
        }
    }

    update(deltaTime) {
        // Acá iría la actualización de tu Spatial Hashing Grid
        // this.spatialHash.update(this.particles);

        // PASO 1: Calcular Densidad y Presión
        for (let p of this.particles) {
            this.calculateDensity(p);
        }

        // PASO 2: Calcular Fuerzas (Gravedad, Presión repulsiva, Viscosidad)
        for (let p of this.particles) {
            this.calculateForces(p);
        }

        // PASO 3: Integración (Mover partículas y aplicar límites de pantalla)
        for (let p of this.particles) {
            this.integrate(p, deltaTime);
            p.updateVisuals();
        }
    }

    calculateDensity(particle) {
        // TODO: Buscar vecinos con Spatial Hashing
        // TODO: Aplicar fórmula del Smoothing Kernel
    }

    calculateForces(particle) {
        // Fuerza base
        particle.force.x = 0;
        particle.force.y = this.gravity; // 1. Gravedad

        // TODO: Calcular Presión con vecinos
        // TODO: Calcular Viscosidad con vecinos
    }

    integrate(p, dt) {
        // Euler integration básico (Velocidad = Fuerza * dt)
        p.velocity.x += p.force.x * dt;
        p.velocity.y += p.force.y * dt;

        // Posición = Velocidad * dt
        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;

        // Lógica de colisión con los bordes de la ventana
        this.resolveBoundaries(p);
    }

    resolveBoundaries(p) {
        const bounds = { width: window.innerWidth, height: window.innerHeight };
        const damping = -0.5; // Pérdida de energía al chocar

        if (p.position.x < 0) {
            p.position.x = 0;
            p.velocity.x *= damping;
        }
        if (p.position.x > bounds.width) {
            p.position.x = bounds.width;
            p.velocity.x *= damping;
        }
        if (p.position.y > bounds.height) {
            p.position.y = bounds.height;
            p.velocity.y *= damping;
        }
    }
}
