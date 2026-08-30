// fluidSystem.js
import { Particle } from "./particle.js";
export class FluidSystem {
    constructor(stage, texture) {
        this.particles = [];
        this.stage = stage;
        this.texture = texture;

        // Constantes SPH
        this.gravity = 300; // Aceleración en Y hacia abajo
        this.smoothingRadius = 35; // El círculo de influencia (h)

        // IMPORTANTE: targetDensity depende directamente de cómo esté escalado
        // el Kernel. Con smoothingKernel = (1 - d/radio)^3 (SIN normalizar por
        // volumen), una partícula completamente aislada ya tiene densidad = 1
        // solo por influenciarse a sí misma. Con vecinas bien empaquetadas
        // (radio=35) la densidad real medida da entre ~1.5 y ~7 según qué tan
        // juntas estén. targetDensity tiene que vivir en ESE rango, si no el
        // sistema queda "sobrepresurizado" todo el tiempo y nunca asienta.
        this.targetDensity = 2.5; // Densidad de reposo

        this.pressureMultiplier = 4000; // Define qué tan violento es el rechazo
        this.viscosityMultiplier = 0.1;

        // Sub-pasos de física por frame. Con pressureMultiplier alto, el
        // sistema se vuelve "rígido" (como un resorte muy duro): si lo
        // integrás con un solo paso grande (deltaTime completo, hasta 30ms),
        // la simulación se vuelve inestable y las partículas se comprimen
        // mal o explotan. Dividiendo el mismo deltaTime en varios pasos
        // más chicos, cada uno queda dentro de un rango estable.
        this.subSteps = 3;

        // Contenedor tipo "pileta": paredes más angostas que la pantalla
        // completa, para que el agua acumule profundidad en vez de
        // desparramarse en una capa fina por todo el ancho disponible.
        // Es un porcentaje del ancho de ventana, de cada lado.
        this.containerMarginRatio = 0.28;

        this.mousePos = { x: -1000, y: -1000 };

        // Cacheamos la referencia al checkbox una sola vez, en vez de
        // buscarlo en el DOM en cada frame (con miles de partículas eso
        // se nota en el rendimiento).
        this.debugToggle = document.getElementById("debugRadar");
    }

    // Nace la simulación con partículas agrupadas arriba, en el centro,
    // simulando que se "vierte" agua dentro del contenedor.
    spawnParticles(count) {
        const centroX = window.innerWidth / 2;
        for (let i = 0; i < count; i++) {
            let px = centroX + (Math.random() * 200 - 100);
            let py = Math.random() * 300;
            this.particles.push(new Particle(px, py, this.texture, this.stage));
        }
    }

    // Destruye todas las partículas actuales y crea "count" nuevas.
    // Útil para el panel de control (slider de cantidad de partículas).
    respawn(count) {
        for (let p of this.particles) {
            p.destroy();
        }
        this.particles = [];
        this.spawnParticles(count);
    }

    update(deltaTime) {
        // Acá iría la actualización de tu Spatial Hashing Grid
        // this.spatialHash.update(this.particles);

        // Repartimos el deltaTime del frame en varios sub-pasos más chicos.
        // Esto es lo que evita que, al subir pressureMultiplier para que el
        // agua sostenga su propio peso apilada, la simulación se vuelva
        // inestable (partículas que se aplastan en una sola línea o que
        // explotan). Cada sub-paso hace el ciclo completo: densidad ->
        // fuerzas -> integración.
        const subDt = deltaTime / this.subSteps;
        for (let s = 0; s < this.subSteps; s++) {
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
                this.integrate(p, subDt);
            }
        }

        // El render (sprites y color) se actualiza una sola vez por frame,
        // no en cada sub-paso: no aporta nada visual y sería trabajo de más.
        for (let p of this.particles) {
            p.updateVisuals();
            p.updateColorByDensity(this.targetDensity);
        }

        // Mostrar radar solo en la partícula 0 si el checkbox está activo
        if (this.particles.length > 0) {
            const p = this.particles[0];
            p.radarGraphic.visible = !!(
                this.debugToggle && this.debugToggle.checked
            );
            if (p.radarGraphic.visible) {
                p.radarGraphic.clear();
                p.radarGraphic.setStrokeStyle({
                    width: 1,
                    color: 0xffffff,
                    alpha: 0.5,
                });
                p.radarGraphic.circle(0, 0, this.smoothingRadius);
                p.radarGraphic.stroke();
            }
        }
    }

    smoothingKernel(radio, distancia) {
        // Si está fuera del radio de influencia, no tiene efecto
        if (distancia >= radio) return 0;

        const valor = 1 - distancia / radio;

        return valor * valor * valor;
    }

    smoothingKernelDerivative(radio, distancia) {
        if (distancia >= radio || distancia === 0) return 0;

        const valor = 1 - distancia / radio;

        // Derivada matemática de la función normalizada superior
        return (-3 * valor * valor) / radio;
    }

    calculateDensity(particula) {
        // La partícula siempre se influencia a sí misma (distancia 0)
        // Por lo tanto, empezamos sumando su propio valor en el centro del Kernel
        particula.density = this.smoothingKernel(this.smoothingRadius, 0);

        for (let vecina of this.particles) {
            // Evitamos que se calcule contra sí misma
            if (particula === vecina) continue;

            // Calculamos la distancia euclidiana entre las dos partículas
            const difX = vecina.position.x - particula.position.x;
            const difY = vecina.position.y - particula.position.y;
            const distancia = Math.sqrt(difX * difX + difY * difY);

            // Pasamos la distancia por nuestra función matemática
            const influencia = this.smoothingKernel(
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
        // Usamos Math.max para asegurar que la presión nunca sea negativa.
        particula.pressure =
            Math.max(0, particula.density - this.targetDensity) *
            this.pressureMultiplier;

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
                    Math.max(0, vecina.density - this.targetDensity) *
                    this.pressureMultiplier;
                const presionCompartida =
                    (particula.pressure + vecina.pressure) / 2;
                const influenciaPendiente = this.smoothingKernelDerivative(
                    this.smoothingRadius,
                    distancia,
                );

                const fuerzaPresion =
                    -(presionCompartida * influenciaPendiente) / vecina.density;
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

        // Repulsión del mouse
        const difMouseX = particula.position.x - this.mousePos.x;
        const difMouseY = particula.position.y - this.mousePos.y;
        const distMouse = Math.sqrt(
            difMouseX * difMouseX + difMouseY * difMouseY,
        );
        const radioMouse = 100;

        if (distMouse < radioMouse && distMouse > 0) {
            const fuerzaFuga = (radioMouse - distMouse) * 50;
            particula.force.x += (difMouseX / distMouse) * fuerzaFuga;
            particula.force.y += (difMouseY / distMouse) * fuerzaFuga;
        }
    }

    integrate(p, dt) {
        // Euler integration básico (Velocidad = Fuerza * dt)
        p.velocity.x += p.force.x * dt;
        p.velocity.y += p.force.y * dt;

        // Salvavidas numérico: con pressureMultiplier alto, un frame con dt
        // grande (lag momentáneo) podría generar una fuerza puntual enorme
        // y mandar una partícula a velocidad absurda ("explota" fuera de
        // pantalla). Este clamp no afecta el comportamiento normal del
        // fluido, solo evita ese caso límite.
        const maxSpeed = 2500;
        const speed = Math.sqrt(
            p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y,
        );
        if (speed > maxSpeed) {
            p.velocity.x = (p.velocity.x / speed) * maxSpeed;
            p.velocity.y = (p.velocity.y / speed) * maxSpeed;
        }

        // Posición = Velocidad * dt
        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;

        // Lógica de colisión con los bordes de la ventana
        this.resolveBoundaries(p);
    }

    resolveBoundaries(p) {
        const bounds = { width: window.innerWidth, height: window.innerHeight };
        const damping = -0.5; // Pérdida de energía al chocar

        const radioVisual = 5;

        // Paredes del contenedor tipo "pileta": más angostas que la pantalla
        // completa, para que el agua acumule profundidad visible en vez de
        // desparramarse por todo el ancho de la ventana.
        const margin = bounds.width * this.containerMarginRatio;
        const leftWall = margin;
        const rightWall = bounds.width - margin;

        if (p.position.x < leftWall + radioVisual) {
            p.position.x = leftWall + radioVisual;
            p.velocity.x *= damping;
        }
        if (p.position.x > rightWall - radioVisual) {
            p.position.x = rightWall - radioVisual;
            p.velocity.x *= damping;
        }
        if (p.position.y > bounds.height - radioVisual) {
            p.position.y = bounds.height - radioVisual;
            p.velocity.y *= damping;
        }

        // Colisión con obstáculo central
        const centroX = bounds.width / 2;
        const centroY = bounds.height / 2;
        const radioObstaculo = 80;

        const difObsX = p.position.x - centroX;
        const difObsY = p.position.y - centroY;
        const distObs = Math.sqrt(difObsX * difObsX + difObsY * difObsY);

        if (distObs < radioObstaculo && distObs > 0) {
            // Empujar hacia el borde del obstáculo
            const normalX = difObsX / distObs;
            const normalY = difObsY / distObs;
            p.position.x = centroX + normalX * radioObstaculo;

            // Invertir velocidad perdiendo energía (fricción)
            const dot = p.velocity.x * normalX + p.velocity.y * normalY;
            p.velocity.x -= 2 * dot * normalX * 0.5;
            p.velocity.y -= 2 * dot * normalY * 0.5;
        }
    }
}
