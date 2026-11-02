// sceneRenderer.js
// Dibuja el mundo físico con PIXI.Graphics (formas planas, sin sprites)
// y mueve la cámara para encuadrar a todos los jugadores. El contenedor
// raíz se escala según el zoom de la cámara e invierte Y.

const CIRCLE_SHAPE = 0; // b2Shape::e_circle

// Se dibuja en centímetros, no en metros: PIXI decide cuántos segmentos
// usar en un círculo según su radio en unidades locales, y con radios de
// 0.05 (metros) los círculos quedan como rombos.
const UNITS_PER_METER = 100;

export class SceneRenderer {
    #app;
    #settings;
    #root = new PIXI.Container();
    #staticGraphics = new PIXI.Graphics();
    #bodyGraphics = new PIXI.Graphics();
    #liquidGraphics = new PIXI.Graphics();
    #camera = { x: 0, pixelsPerMeter: 0 };

    constructor(app, settings) {
        this.#app = app;
        this.#settings = settings;
        this.#camera.pixelsPerMeter = settings.maxPixelsPerMeter;
        this.#root.addChild(this.#staticGraphics, this.#liquidGraphics, this.#bodyGraphics);
        app.stage.addChild(this.#root);
    }

    // scene: { staticBodies, players: [{ character, settings }], liquid }
    draw({ staticBodies, players, liquid }, dt) {
        const s = this.#settings;
        const characters = players.map((p) => p.character).filter(Boolean);

        this.#staticGraphics.clear();
        for (const body of staticBodies) drawBody(this.#staticGraphics, body, s.staticColor, s.outlineColor);

        this.#bodyGraphics.clear();
        for (const { character, settings } of players) {
            if (!character) continue;
            for (const body of character.instance.bodies.values()) {
                drawBody(this.#bodyGraphics, body, settings.bodyColor, s.outlineColor);
            }
            this.#drawMuzzle(character.muzzle());
        }

        this.#drawLiquid(liquid);
        this.#updateCamera(characters, dt);
    }

    // Agrupa las partículas por color y hace un solo fill por grupo (mucho
    // más barato que un fill por partícula).
    #drawLiquid(liquid) {
        const byColor = new Map();
        liquid.forEachParticle((x, y, color) => {
            if (!byColor.has(color)) byColor.set(color, []);
            byColor.get(color).push(x * UNITS_PER_METER, y * UNITS_PER_METER);
        });

        const g = this.#liquidGraphics;
        // un poco más grandes que el radio físico para que se vea continuo
        const r = liquid.particleRadius * 1.4 * UNITS_PER_METER;
        g.clear();
        for (const [color, points] of byColor) {
            for (let i = 0; i < points.length; i += 2) g.circle(points[i], points[i + 1], r);
            g.fill({ color, alpha: 0.85 });
        }
    }

    #drawMuzzle(muzzle) {
        if (!muzzle) return;
        const u = UNITS_PER_METER;
        this.#bodyGraphics.circle(muzzle.x * u, muzzle.y * u, 0.03 * u);
        this.#bodyGraphics.fill({ color: this.#settings.muzzleColor });
    }

    // Centra la cámara entre los jugadores y aleja el zoom cuando se
    // separan, para que siempre entren todos en pantalla.
    #updateCamera(characters, dt) {
        const { maxPixelsPerMeter, cameraMargin, groundOffsetPx, cameraSmoothing } = this.#settings;
        const screen = this.#app.screen;
        const camera = this.#camera;

        if (characters.length > 0) {
            const xs = characters.map((c) => c.position.x);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const span = maxX - minX + cameraMargin * 2;
            const targetX = (minX + maxX) / 2;
            const targetPpm = Math.min(maxPixelsPerMeter, screen.width / span);

            const blend = Math.min(1, cameraSmoothing * dt);
            camera.x += (targetX - camera.x) * blend;
            camera.pixelsPerMeter += (targetPpm - camera.pixelsPerMeter) * blend;
        }

        const scale = camera.pixelsPerMeter / UNITS_PER_METER;
        this.#root.scale.set(scale, -scale);
        this.#root.position.set(
            screen.width / 2 - camera.x * camera.pixelsPerMeter,
            screen.height - groundOffsetPx,
        );
    }
}

// ------------------------------------------------------------------
// Dibujo de un b2Body: cada fixture como círculo o polígono relleno.
// Todas las coordenadas salen en UNITS_PER_METER (centímetros).
// ------------------------------------------------------------------

function drawBody(graphics, body, fill, outline) {
    for (let f = body.GetFixtureList(); Box2D.getPointer(f) !== 0; f = f.GetNext()) {
        const shape = f.GetShape();
        if (shape.GetType() === CIRCLE_SHAPE) {
            drawCircle(graphics, body, Box2D.castObject(shape, Box2D.b2CircleShape));
        } else {
            drawPolygon(graphics, body, Box2D.castObject(shape, Box2D.b2PolygonShape));
        }
        graphics.fill({ color: fill, alpha: 0.9 });
        graphics.stroke({ color: outline, width: 0.015 * UNITS_PER_METER });
    }
}

function drawCircle(graphics, body, circle) {
    const c = circle.get_m_p();
    const p = toWorld(body, c.get_x(), c.get_y());
    graphics.circle(p.x, p.y, circle.get_m_radius() * UNITS_PER_METER);
}

function drawPolygon(graphics, body, polygon) {
    const points = [];
    for (let i = 0; i < polygon.GetVertexCount(); i++) {
        const v = polygon.GetVertex(i);
        const p = toWorld(body, v.get_x(), v.get_y());
        points.push(p.x, p.y);
    }
    graphics.poly(points, true);
}

function toWorld(body, x, y) {
    const position = body.GetPosition();
    const angle = body.GetAngle();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: (position.get_x() + x * cos - y * sin) * UNITS_PER_METER,
        y: (position.get_y() + x * sin + y * cos) * UNITS_PER_METER,
    };
}
