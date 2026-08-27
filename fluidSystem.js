// fluidSystem.js
// -----------------------------------------------------------------------------
// Solver de fluido SPH (Smoothed Particle Hydrodynamics), optimizado.
//
// CAMBIOS CLAVE respecto a la versión OOP:
//   1. Structure of Arrays (SoA): posiciones/velocidades en Float32Array en
//      lugar de miles de objetos con sub-objetos {x,y}. Mucho mejor localidad
//      de caché y el JIT vectoriza los bucles.
//   2. Vecindario fusionado: una sola pasada recorre el bloque 3x3, acumula
//      densidad y guarda la lista de vecinas en una caché plana (Int32Array +
//      Float32Array con offsets por partícula). Se reutiliza en presión y
//      viscosidad. Sin arrays de candidatos por partícula.
//   3. Paso de tiempo FIJO con acumulador: la física avanza en pasos pequeños
//      y constantes independientes de los FPS. Así la estabilidad no depende
//      del framerate (a bajos FPS el fluido va algo más lento, pero NO explota;
//      antes, a 15 FPS el paso era enorme y el líquido "saltaba" en vez de
//      fluir).
//   4. Material POR PARTÍCULA: cada partícula guarda el índice de su material.
//      Cambiar el material activo sólo afecta a las NUEVAS partículas; distintos
//      líquidos coexisten y se mezclan (gravedad, densidad, presión y
//      viscosidad se resuelven por partícula; la presión entre dos vecinas es
//      la media de ambas).
//
// LÓGICA (update) y RENDER (render) siguen separados.
// -----------------------------------------------------------------------------

import { SpatialHash } from "./spatialHash.js";

export class FluidSystem {
    constructor(container, texture, materials, activeIndex = 0) {
        this.container = container;
        this.texture = texture;

        // Paleta de materiales (referencia compartida con la UI) + material
        // activo (el que reciben las partículas nuevas).
        this.materials = materials;
        this.activeIndex = Math.max(0, Math.min(activeIndex, materials.length - 1));

        // Radio de interacción GLOBAL (la mezcla exige una rejilla uniforme).
        // Se toma del material activo; editable en vivo.
        this.smoothingRadius = this.materials[this.activeIndex].smoothingRadius;

        // --- Estado de partículas (SoA) ---
        this.count = 0;
        this.capacity = 0;
        this.posX = new Float32Array(0);
        this.posY = new Float32Array(0);
        this.velX = new Float32Array(0);
        this.velY = new Float32Array(0);
        this.predX = new Float32Array(0);
        this.predY = new Float32Array(0);
        this.density = new Float32Array(0);
        this.nearDensity = new Float32Array(0);
        this.pressure = new Float32Array(0);
        this.nearPressure = new Float32Array(0);
        this.matIndex = new Int32Array(0); // material de cada partícula
        this.particles = []; // PIXI.Particle paralelo (para el render)

        // --- Caché plana de vecinas ---
        this.neighborStart = new Int32Array(1); // offset por partícula (+1)
        this.neighborIdx = new Int32Array(0); // índice de la vecina
        this.neighborDst = new Float32Array(0); // distancia a la vecina

        // --- Parámetros de material aplanados (se rellenan cada frame) ---
        this.mGravity = new Float32Array(0);
        this.mTargetDensity = new Float32Array(0);
        this.mPressure = new Float32Array(0);
        this.mNearPressure = new Float32Array(0);
        this.mViscosity = new Float32Array(0);
        this.mDamping = new Float32Array(0);
        this.mRadius = new Float32Array(0); // radio físico (particleSize/2)
        this.anyViscosity = false;

        // Límites del mundo.
        this.bounds = { width: window.innerWidth, height: window.innerHeight };
        this.spatialHash = new SpatialHash(
            this.smoothingRadius,
            this.bounds.width,
            this.bounds.height,
        );

        // --- Paso de tiempo fijo ---
        this.fixedDt = 1 / 120; // s por paso de física
        this.maxStepsPerFrame = 5; // tope anti "spiral of death"
        this.accumulator = 0;

        // Interacción con el puntero.
        this.mouse = {
            x: 0,
            y: 0,
            down: false,
            tool: "attract", // add | remove | attract | repel
            radius: 130,
            strength: 6000,
            addRate: 6,
        };

        this.paused = false;

        this._ensureCapacity(1024);
    }

    // ===== Materiales ========================================================

    // Fija el material que reciben las NUEVAS partículas. NO re-estiliza las
    // existentes (ésa es la clave para mezclar líquidos).
    setActiveMaterial(index) {
        this.activeIndex = Math.max(0, Math.min(index, this.materials.length - 1));
        const m = this.materials[this.activeIndex];
        this.smoothingRadius = m.smoothingRadius;
        this.spatialHash.setCellSize(m.smoothingRadius);
    }

    // Compat: algunas rutas antiguas llamaban setMaterial. Equivale a fijar el
    // material activo (sin tocar las partículas existentes).
    setMaterial(material) {
        const idx = this.materials.indexOf(material);
        if (idx >= 0) this.setActiveMaterial(idx);
    }

    // La UI llama a esto tras editar un material: re-estiliza sólo las
    // partículas de ese material y, si es el activo, actualiza el radio global.
    onMaterialEdited(index) {
        if (index === this.activeIndex) {
            const m = this.materials[index];
            this.smoothingRadius = m.smoothingRadius;
            this.spatialHash.setCellSize(m.smoothingRadius);
        }
        this.restyleMaterial(index);
    }

    // La UI llama a esto tras borrar un material de la paleta: reasigna las
    // partículas huérfanas y recoloca los índices por encima del borrado.
    onMaterialRemoved(index) {
        const matIndex = this.matIndex;
        for (let i = 0; i < this.count; i++) {
            if (matIndex[i] === index) matIndex[i] = 0;
            else if (matIndex[i] > index) matIndex[i]--;
        }
        if (this.activeIndex > index) this.activeIndex--;
        else if (this.activeIndex === index) this.activeIndex = 0;
        this.setActiveMaterial(this.activeIndex);
        this.restyleAll();
    }

    // Reemplaza la paleta completa (p. ej. "Restaurar presets"): recorta los
    // índices al nuevo rango y re-estiliza todo.
    setMaterials(materials) {
        this.materials = materials;
        const max = materials.length - 1;
        for (let i = 0; i < this.count; i++) {
            if (this.matIndex[i] > max) this.matIndex[i] = 0;
        }
        this.setActiveMaterial(Math.min(this.activeIndex, max));
        this.restyleAll();
    }

    _flattenMaterials() {
        const mats = this.materials;
        const n = mats.length;
        if (this.mGravity.length < n) {
            this.mGravity = new Float32Array(n);
            this.mTargetDensity = new Float32Array(n);
            this.mPressure = new Float32Array(n);
            this.mNearPressure = new Float32Array(n);
            this.mViscosity = new Float32Array(n);
            this.mDamping = new Float32Array(n);
            this.mRadius = new Float32Array(n);
        }
        let anyVisc = false;
        for (let s = 0; s < n; s++) {
            const m = mats[s];
            this.mGravity[s] = m.gravity;
            this.mTargetDensity[s] = m.targetDensity;
            this.mPressure[s] = m.pressureMultiplier;
            this.mNearPressure[s] = m.nearPressureMultiplier;
            this.mViscosity[s] = m.viscosity;
            this.mDamping[s] = m.collisionDamping;
            this.mRadius[s] = m.particleSize * 0.5;
            if (m.viscosity > 0) anyVisc = true;
        }
        this.anyViscosity = anyVisc;
    }

    // ===== Bordes y capacidad ================================================

    setBounds(width, height) {
        this.bounds.width = width;
        this.bounds.height = height;
        this.spatialHash.setBounds(width, height);
    }

    _ensureCapacity(n) {
        if (n <= this.capacity) return;
        const cap = Math.max(n, this.capacity * 2, 1024);

        const growF = (old) => {
            const arr = new Float32Array(cap);
            arr.set(old);
            return arr;
        };
        this.posX = growF(this.posX);
        this.posY = growF(this.posY);
        this.velX = growF(this.velX);
        this.velY = growF(this.velY);
        this.predX = growF(this.predX);
        this.predY = growF(this.predY);
        this.density = growF(this.density);
        this.nearDensity = growF(this.nearDensity);
        this.pressure = growF(this.pressure);
        this.nearPressure = growF(this.nearPressure);

        const mi = new Int32Array(cap);
        mi.set(this.matIndex);
        this.matIndex = mi;

        const ns = new Int32Array(cap + 1);
        ns.set(this.neighborStart);
        this.neighborStart = ns;

        // Caché de vecinas: ~48 vecinas por partícula de arranque.
        if (this.neighborIdx.length < cap * 48) {
            this.neighborIdx = new Int32Array(cap * 48);
            this.neighborDst = new Float32Array(cap * 48);
        }

        this.capacity = cap;
    }

    // ===== Alta / baja de partículas =========================================

    _addOne(x, y, matSlot) {
        this._ensureCapacity(this.count + 1);
        const i = this.count;
        this.posX[i] = x;
        this.posY[i] = y;
        this.velX[i] = 0;
        this.velY[i] = 0;
        this.predX[i] = x;
        this.predY[i] = y;
        this.matIndex[i] = matSlot;

        // PIXI.Particle: dato ligero (no es un nodo del grafo de escena). El
        // ParticleContainer los dibuja a todos en un único lote.
        const p = new PIXI.Particle({
            texture: this.texture,
            x,
            y,
            anchorX: 0.5,
            anchorY: 0.5,
        });
        this.container.addParticle(p);
        this.particles[i] = p;
        // Añadir una partícula ya marca el buffer estático (color/escala) como
        // sucio, así que _restyle aquí no necesita un update() explícito.
        this._restyle(i);

        this.count++;
    }

    _removeAt(i) {
        this.container.removeParticle(this.particles[i]);
        const last = this.count - 1;
        if (i !== last) {
            this.posX[i] = this.posX[last];
            this.posY[i] = this.posY[last];
            this.velX[i] = this.velX[last];
            this.velY[i] = this.velY[last];
            this.predX[i] = this.predX[last];
            this.predY[i] = this.predY[last];
            this.matIndex[i] = this.matIndex[last];
            this.particles[i] = this.particles[last];
        }
        this.particles.pop();
        this.count--;
    }

    _restyle(i) {
        const p = this.particles[i];
        const m = this.materials[this.matIndex[i]];
        // La partícula sólo expone escala (no width/height): convertimos el
        // tamaño en px a factor de escala dividiendo por el diámetro de la
        // textura base.
        const scale = m.particleSize / (this.texture.orig?.width ?? this.texture.width);
        p.tint = m.color;
        p.scaleX = scale;
        p.scaleY = scale;
    }

    // color/escala son propiedades ESTÁTICAS del ParticleContainer: hay que
    // llamar a update() para que el cambio se suba a la GPU (la posición, en
    // cambio, es dinámica y se refresca sola cada frame).
    restyleAll() {
        for (let i = 0; i < this.count; i++) this._restyle(i);
        this.container.update();
    }

    restyleMaterial(index) {
        for (let i = 0; i < this.count; i++) {
            if (this.matIndex[i] === index) this._restyle(i);
        }
        this.container.update();
    }

    // Bloque cuadrado centrado, con el material activo.
    spawnBlock(count, cx = this.bounds.width / 2, cy = this.bounds.height * 0.35) {
        const size = this.materials[this.activeIndex].particleSize;
        const spacing = size + 4;
        const perRow = Math.ceil(Math.sqrt(count));
        const half = (perRow * spacing) / 2;
        this._ensureCapacity(this.count + count);
        for (let k = 0; k < count; k++) {
            const col = k % perRow;
            const row = (k / perRow) | 0;
            const jx = (Math.random() - 0.5) * spacing * 0.3;
            const jy = (Math.random() - 0.5) * spacing * 0.3;
            this._addOne(cx - half + col * spacing + jx, cy - half + row * spacing + jy, this.activeIndex);
        }
    }

    setParticleCount(target) {
        if (target > this.count) {
            this.spawnBlock(target - this.count);
        } else {
            while (this.count > target) this._removeAt(this.count - 1);
        }
    }

    clear() {
        if (this.count > 0) {
            this.container.removeParticles(this.particles.slice(0, this.count));
        }
        this.particles.length = 0;
        this.count = 0;
    }

    // ===== Herramientas de puntero (crear / borrar en vivo) ==================

    addParticlesAt(x, y, radius, count) {
        this._ensureCapacity(this.count + count);
        for (let k = 0; k < count; k++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * radius;
            this._addOne(x + Math.cos(a) * rr, y + Math.sin(a) * rr, this.activeIndex);
        }
    }

    removeParticlesAt(x, y, radius) {
        const r2 = radius * radius;
        let i = 0;
        while (i < this.count) {
            const dx = this.posX[i] - x;
            const dy = this.posY[i] - y;
            if (dx * dx + dy * dy <= r2) this._removeAt(i);
            else i++;
        }
    }

    applyPointerTool() {
        if (!this.mouse.down) return;
        if (this.mouse.tool === "add") {
            this.addParticlesAt(this.mouse.x, this.mouse.y, this.mouse.radius, this.mouse.addRate);
        } else if (this.mouse.tool === "remove") {
            this.removeParticlesAt(this.mouse.x, this.mouse.y, this.mouse.radius);
        }
    }

    // ===== LÓGICA (paso de tiempo fijo) ======================================

    update(frameDt) {
        if (this.paused || this.count === 0) return;
        this._flattenMaterials();

        // Acumulador de paso fijo. Capamos el tiempo de entrada para que un lag
        // no dispare decenas de pasos de golpe.
        this.accumulator += Math.min(frameDt, 1 / 30);
        const fdt = this.fixedDt;
        let steps = 0;
        while (this.accumulator >= fdt && steps < this.maxStepsPerFrame) {
            this.step(fdt);
            this.accumulator -= fdt;
            steps++;
        }
        // Si aún vamos muy atrasados (FPS bajos), descartamos el remanente en
        // vez de acumular deuda infinita.
        if (this.accumulator > fdt) this.accumulator = 0;
    }

    // Avanza exactamente un paso fijo (botón "Frame").
    stepOnce() {
        if (this.count === 0) return;
        this._flattenMaterials();
        this.step(this.fixedDt);
        this.render();
    }

    step(dt) {
        const n = this.count;
        const posX = this.posX, posY = this.posY;
        const velX = this.velX, velY = this.velY;
        const predX = this.predX, predY = this.predY;
        const density = this.density, nearDensity = this.nearDensity;
        const pressure = this.pressure, nearPressure = this.nearPressure;
        const matIndex = this.matIndex;

        const mGrav = this.mGravity, mTgt = this.mTargetDensity;
        const mPres = this.mPressure, mNear = this.mNearPressure;
        const mVisc = this.mViscosity, mDamp = this.mDamping, mRad = this.mRadius;

        const r = this.smoothingRadius;
        const r2 = r * r;
        const invR = 1 / r;
        const invR2 = 1 / r2;

        // 1. Gravedad (por partícula) + posición predicha.
        for (let i = 0; i < n; i++) {
            velY[i] += mGrav[matIndex[i]] * dt;
            predX[i] = posX[i] + velX[i] * dt;
            predY[i] = posY[i] + velY[i] * dt;
        }

        // 2. Rejilla espacial sobre las predichas.
        this.spatialHash.build(predX, predY, n);

        const grid = this.spatialHash;
        const cols = grid.cols, rows = grid.rows, cs = grid.cellSize;
        const cellStart = grid.cellStart, sorted = grid.sorted;

        // 3. Vecindario + densidad + presión (una sola pasada).
        const nStart = this.neighborStart;
        let nIdx = this.neighborIdx;
        let nDst = this.neighborDst;
        let nn = 0;

        for (let i = 0; i < n; i++) {
            nStart[i] = nn;
            const xi = predX[i], yi = predY[i];
            let cx = (xi / cs) | 0;
            if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
            let cy = (yi / cs) | 0;
            if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;

            let dens = 0, near = 0;
            for (let oy = -1; oy <= 1; oy++) {
                const ny = cy + oy;
                if (ny < 0 || ny >= rows) continue;
                const rowBase = ny * cols;
                for (let ox = -1; ox <= 1; ox++) {
                    const nx = cx + ox;
                    if (nx < 0 || nx >= cols) continue;
                    const ci = rowBase + nx;
                    const end = cellStart[ci + 1];
                    for (let k = cellStart[ci]; k < end; k++) {
                        const j = sorted[k];
                        if (j === i) continue;
                        const dx = predX[j] - xi;
                        const dy = predY[j] - yi;
                        const d2 = dx * dx + dy * dy;
                        if (d2 >= r2) continue;
                        const dst = Math.sqrt(d2);
                        const q = 1 - dst * invR; // kernel normalizado [0..1]
                        dens += q * q;
                        near += q * q * q;

                        if (nn >= nIdx.length) {
                            const ni = new Int32Array(nIdx.length * 2);
                            ni.set(nIdx);
                            this.neighborIdx = nIdx = ni;
                            const nd = new Float32Array(nDst.length * 2);
                            nd.set(nDst);
                            this.neighborDst = nDst = nd;
                        }
                        nIdx[nn] = j;
                        nDst[nn] = dst;
                        nn++;
                    }
                }
            }

            // +1 = contribución propia (dst=0 => kernel=1). density >= 1.
            const di = dens + 1;
            const ndi = near + 1;
            density[i] = di;
            nearDensity[i] = ndi;
            const mi = matIndex[i];
            pressure[i] = (di - mTgt[mi]) * mPres[mi];
            nearPressure[i] = ndi * mNear[mi];
        }
        nStart[n] = nn;

        // 4. Fuerza de presión (usa la caché de vecinas).
        for (let i = 0; i < n; i++) {
            const xi = predX[i], yi = predY[i];
            const pi = pressure[i], npi = nearPressure[i];
            const di = density[i];
            let fx = 0, fy = 0;
            const s = nStart[i], e = nStart[i + 1];
            for (let k = s; k < e; k++) {
                const j = nIdx[k];
                let dst = nDst[k];
                let dirx, diry;
                if (dst > 1e-6) {
                    dirx = (predX[j] - xi) / dst;
                    diry = (predY[j] - yi) / dst;
                } else {
                    const a = Math.random() * Math.PI * 2;
                    dirx = Math.cos(a);
                    diry = Math.sin(a);
                    dst = 1e-6;
                }
                const q = 1 - dst * invR;
                const slope2 = -2 * invR * q; // derivada de (1-dst/r)^2
                const slope3 = -3 * invR * q * q; // derivada de (1-dst/r)^3
                const sharedP = (pi + pressure[j]) * 0.5;
                const sharedNear = (npi + nearPressure[j]) * 0.5;
                const contrib =
                    (slope2 * sharedP) / density[j] +
                    (slope3 * sharedNear) / nearDensity[j];
                fx += dirx * contrib;
                fy += diry * contrib;
            }
            velX[i] += (fx / di) * dt;
            velY[i] += (fy / di) * dt;
        }

        // 5. Viscosidad (por partícula; se salta si nadie es viscoso).
        if (this.anyViscosity) {
            for (let i = 0; i < n; i++) {
                const visc = mVisc[matIndex[i]];
                if (visc <= 0) continue;
                const vxi = velX[i], vyi = velY[i];
                let fx = 0, fy = 0;
                const s = nStart[i], e = nStart[i + 1];
                for (let k = s; k < e; k++) {
                    const j = nIdx[k];
                    const dst = nDst[k];
                    let w = 1 - dst * dst * invR2; // (1 - dst^2/r^2)^2
                    w *= w;
                    fx += (velX[j] - vxi) * w;
                    fy += (velY[j] - vyi) * w;
                }
                velX[i] += fx * visc * dt;
                velY[i] += fy * visc * dt;
            }
        }

        // 6. Interacción del ratón (herramientas de fuerza).
        const tool = this.mouse.tool;
        if (this.mouse.down && (tool === "attract" || tool === "repel")) {
            const mx = this.mouse.x, my = this.mouse.y;
            const mr = this.mouse.radius, strength = this.mouse.strength;
            const sign = tool === "attract" ? 1 : -1;
            for (let i = 0; i < n; i++) {
                const dx = mx - posX[i];
                const dy = my - posY[i];
                const dst = Math.sqrt(dx * dx + dy * dy);
                if (dst >= mr || dst < 1e-4) continue;
                const falloff = 1 - dst / mr;
                const accel = (sign * strength * falloff) / dst;
                velX[i] += dx * accel * dt;
                velY[i] += dy * accel * dt;
            }
        }

        // 7. Integración + colisiones con los bordes.
        const width = this.bounds.width, height = this.bounds.height;
        for (let i = 0; i < n; i++) {
            posX[i] += velX[i] * dt;
            posY[i] += velY[i] * dt;

            const mi = matIndex[i];
            const rad = mRad[mi];
            const damping = 1 - mDamp[mi];

            if (posX[i] < rad) {
                posX[i] = rad;
                velX[i] *= -damping;
            } else if (posX[i] > width - rad) {
                posX[i] = width - rad;
                velX[i] *= -damping;
            }
            if (posY[i] < rad) {
                posY[i] = rad;
                velY[i] *= -damping;
            } else if (posY[i] > height - rad) {
                posY[i] = height - rad;
                velY[i] *= -damping;
            }
        }
    }

    // ===== RENDER (sólo vuelca posiciones) ===================================

    render() {
        const posX = this.posX, posY = this.posY, particles = this.particles;
        for (let i = 0; i < this.count; i++) {
            const p = particles[i];
            p.x = posX[i];
            p.y = posY[i];
        }
    }
}
