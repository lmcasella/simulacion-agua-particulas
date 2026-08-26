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
        this.pressureMultiplier = 10; // Define qué tan violento es el rechazo
        this.viscosityMultiplier = 0.05;
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

    smoothingKernel(radio, distancia) {
        // Si está fuera del radio de influencia, no tiene efecto
        if (distancia >= radio) return 0;

        // Calculamos la diferencia
        const valor = radio - distancia;

        // Lo elevamos al cubo para que la curva sea suave.
        // El divisor (volumen) es una constante matemática de normalización
        // para asegurar que la suma de influencias tenga sentido físico en 2D.
        const volumen = (Math.PI * Math.pow(radio, 4)) / 6;

        return (valor * valor * valor) / volumen;
    }

    smoothingKernelDerivative(radio, distancia) {
        if (distancia >= radio || distancia === 0) return 0;

        const valor = radio - distancia;

        // La derivada de (radio - distancia)^3 genera un multiplicador de 3
        // y eleva el resto al cuadrado.
        const volumen = (Math.PI * Math.pow(radio, 4)) / 6;

        // Retorna un valor negativo porque la fuerza de presión empuja hacia AFUERA
        // (desde la mayor concentración hacia la menor).
        return (-3 * valor * valor) / volumen;
    }

    calculateDensity(particula) {
        // La partícula siempre se influencia a sí misma (distancia 0)
        // Por lo tanto, empezamos sumando su propio valor en el centro del Kernel
        particula.density = this.smoothingKernelDerivative(
            this.smoothingRadius,
            0,
        );

        for (let vecina of this.particles) {
            // Evitamos que se calcule contra sí misma
            if (particula === vecina) continue;

            // Calculamos la distancia euclidiana entre las dos partículas
            const difX = vecina.position.x - particula.position.x;
            const difY = vecina.position.y - particula.position.y;
            const distancia = Math.sqrt(difX * difX + difY * difY);

            // Pasamos la distancia por nuestra función matemática
            const influencia = this.smoothingKernelDerivative(
                this.smoothingRadius,
                distancia,
            );

            // Sumamos la influencia a la densidad total de nuestra partícula
            particula.density += influencia;
        }
    }

    calculateForces(particula) {
        // 1. Gravedad base hacia abajo
        particula.force.x = 0;
        particula.force.y = this.gravity;

        // Ecuación de Estado para la presión
        particula.pressure =
            (particula.density - this.targetDensity) * this.pressureMultiplier;

        let presionX = 0;
        let presionY = 0;
        let viscosidadX = 0;
        let viscosidadY = 0;

        for (let vecina of this.particles) {
            if (particula === vecina) continue;

            const difX = particula.position.x - vecina.position.x;
            const difY = particula.position.y - vecina.position.y;
            const distancia = Math.sqrt(difX * difX + difY * difY);

            if (distancia < this.smoothingRadius && distancia > 0) {
                const dirX = difX / distancia;
                const dirY = difY / distancia;

                // --- FUERZA DE PRESIÓN ---
                vecina.pressure =
                    (vecina.density - this.targetDensity) *
                    this.pressureMultiplier;
                const presionCompartida =
                    (particula.pressure + vecina.pressure) / 2;
                const influenciaPendiente = this.smoothingKernelDerivative(
                    this.smoothingRadius,
                    distancia,
                );

                const fuerzaPresion =
                    (presionCompartida * influenciaPendiente) / vecina.density;
                presionX += dirX * fuerzaPresion;
                presionY += dirY * fuerzaPresion;

                // --- FUERZA DE VISCOSIDAD ---
                const velDifX = vecina.velocity.x - particula.velocity.x;
                const velDifY = vecina.velocity.y - particula.velocity.y;
                const influenciaVecindad = this.smoothingKernel(
                    this.smoothingRadius,
                    distancia,
                );

                viscosidadX +=
                    velDifX * influenciaVecindad * this.viscosityMultiplier;
                viscosidadY +=
                    velDifY * influenciaVecindad * this.viscosityMultiplier;
            }
        }

        // Sumamos todas las fuerzas al resultado final de la partícula
        particula.force.x += presionX + viscosidadX;
        particula.force.y += presionY + viscosidadY;
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
