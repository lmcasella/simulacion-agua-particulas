// sceneRenderer.js
// Dibuja el mundo físico con PIXI.Graphics (formas planas, sin sprites)
// y mueve la cámara siguiendo al personaje. Trabaja en metros: el
// contenedor raíz se escala por pixelsPerMeter e invierte Y.

const CIRCLE_SHAPE = 0; // b2Shape::e_circle

export class SceneRenderer {
    #app;
    #settings;
    #root = new PIXI.Container();
    #staticGraphics = new PIXI.Graphics();
    #bodyGraphics = new PIXI.Graphics();
    #waterGraphics = new PIXI.Graphics();
    #cameraX = 0;

    constructor(app, settings) {
        this.#app = app;
        this.#settings = settings;
        this.#root.addChild(this.#staticGraphics, this.#waterGraphics, this.#bodyGraphics);
        app.stage.addChild(this.#root);
        this.#root.scale.set(settings.pixelsPerMeter, -settings.pixelsPerMeter);
    }

    // scene: { staticBodies, character (o null), gun }
    draw({ staticBodies, character, gun }, dt) {
        const s = this.#settings;

        this.#staticGraphics.clear();
        for (const body of staticBodies) drawBody(this.#staticGraphics, body, s.staticColor, s.outlineColor);

        this.#bodyGraphics.clear();
        if (character) {
            for (const body of character.instance.bodies.values()) {
                drawBody(this.#bodyGraphics, body, s.bodyColor, s.outlineColor);
            }
            this.#drawMuzzle(character.muzzle());
        }

        this.#waterGraphics.clear();
        const r = gun.particleRadius * 1.4; // un poco más grandes para que se vea continuo
        gun.forEachParticle((x, y) => this.#waterGraphics.circle(x, y, r));
        this.#waterGraphics.fill({ color: s.waterColor, alpha: 0.85 });

        this.#updateCamera(character, dt);
    }

    #drawMuzzle(muzzle) {
        if (!muzzle) return;
        this.#bodyGraphics.circle(muzzle.x, muzzle.y, 0.03);
        this.#bodyGraphics.fill({ color: this.#settings.muzzleColor });
    }

    #updateCamera(character, dt) {
        const { pixelsPerMeter, groundOffsetPx, cameraSmoothing } = this.#settings;
        if (character) {
            const targetX = character.position.x;
            this.#cameraX += (targetX - this.#cameraX) * Math.min(1, cameraSmoothing * dt);
        }
        const screen = this.#app.screen;
        this.#root.position.set(
            screen.width / 2 - this.#cameraX * pixelsPerMeter,
            screen.height - groundOffsetPx,
        );
    }
}

// ------------------------------------------------------------------
// Dibujo de un b2Body: cada fixture como círculo o polígono relleno.
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
        graphics.stroke({ color: outline, width: 0.015 });
    }
}

function drawCircle(graphics, body, circle) {
    const c = circle.get_m_p();
    const p = toWorld(body, c.get_x(), c.get_y());
    graphics.circle(p.x, p.y, circle.get_m_radius());
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
    return { x: position.get_x() + x * cos - y * sin, y: position.get_y() + x * sin + y * cos };
}
