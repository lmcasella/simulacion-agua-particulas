// character.js
// Envuelve una instancia de RagImporter y le da una interfaz de
// "personaje": moverse, mirar hacia un lado, reproducir clips y decir
// dónde está la punta del brazo. No sabe nada de teclado ni de agua:
// eso lo deciden el CharacterController y el LiquidGun.

const GROUND_CLEARANCE = 0.02; // m sobre el piso al spawnear
const CIRCLE_SHAPE = 0; // b2Shape::e_circle

export class Character {
    #world;
    #def;
    #instance = null;
    #facing = 1; // 1 = derecha, -1 = izquierda
    #clip = null;
    #emitterBody;
    #tip = null; // punta del brazo emisor, en coordenadas locales de su body

    constructor(world, def, { x, facing = 1, emitterBody }) {
        this.#world = world;
        this.#def = def;
        this.#emitterBody = emitterBody;
        this.#spawn(x, facing);
    }

    // La instancia de RagImporter (bodies, joints). Solo lectura.
    get instance() {
        return this.#instance;
    }

    get position() {
        return this.#instance.position;
    }

    get facing() {
        return this.#facing;
    }

    // Gira el personaje hacia `direction` (signo: + derecha, - izquierda).
    // RagImporter solo permite espejar (flipX) al spawnear, así que girar
    // = re-spawnear espejado en la misma X. Es lo más simple y alcanza
    // para un demo; el "salto" visual es de un frame.
    face(direction) {
        const facing = Math.sign(direction);
        if (facing === 0 || facing === this.#facing) return;
        this.#spawn(this.position.x, facing);
    }

    // Lleva la velocidad horizontal de todos los bodies hacia `targetSpeed`.
    // Se modifica la velocidad (no se aplica fuerza) porque stepWorld hace
    // varios sub-pasos por frame y Box2D borra las fuerzas tras cada uno.
    move(targetSpeed, acceleration, dt) {
        const blend = Math.min(1, acceleration * dt);
        for (const body of this.#instance.bodies.values()) {
            const velocity = body.GetLinearVelocity();
            velocity.set_x(velocity.get_x() + (targetSpeed - velocity.get_x()) * blend);
            body.SetLinearVelocity(velocity);
        }
    }

    // Reproduce un clip por key; null (o una key inexistente) = ninguno.
    setClip(key) {
        const next = this.#hasClip(key) ? key : null;
        if (next === this.#clip) return;
        if (this.#clip) this.#instance.stop(this.#clip);
        if (next) this.#instance.play(next);
        this.#clip = next;
    }

    setEmitterBody(name) {
        this.#emitterBody = name;
        this.#tip = findTip(this.#instance, name);
    }

    // Punta del brazo en el mundo: posición, dirección (unitaria, "hacia
    // afuera" del brazo) y velocidad del body. null si no hay emisor.
    muzzle() {
        if (!this.#tip) return null;
        const { body, point, direction } = this.#tip;
        const position = body.GetPosition();
        const velocity = body.GetLinearVelocity();
        const angle = body.GetAngle();
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: position.get_x() + point.x * cos - point.y * sin,
            y: position.get_y() + point.x * sin + point.y * cos,
            dirX: direction.x * cos - direction.y * sin,
            dirY: direction.x * sin + direction.y * cos,
            vx: velocity.get_x(),
            vy: velocity.get_y(),
        };
    }

    destroy() {
        this.#instance?.destroy();
        this.#instance = null;
    }

    #hasClip(key) {
        return key != null && this.#def.clips.some((clip) => clip.key === key);
    }

    // Spawnea con el body raíz en `rootX` y los pies apoyados en el piso.
    // Para saber dónde caen raíz y pies, primero se hace un spawn de prueba
    // en el origen, se mide y se descarta (mismo truco que el demo de
    // RagAssembler2D).
    #spawn(rootX, facing) {
        const flipX = facing < 0;
        const probe = this.#def.spawn(this.#world, { x: 0, y: 0, flipX });
        const rootOffsetX = probe.position.x;
        const lift = GROUND_CLEARANCE - lowestPoint(probe);
        probe.destroy();

        this.#instance?.destroy();
        this.#instance = this.#def.spawn(this.#world, { x: rootX - rootOffsetX, y: lift, flipX });
        this.#facing = facing;
        this.#tip = findTip(this.#instance, this.#emitterBody);

        // La instancia nueva arranca sin clips: re-aplicamos el actual.
        if (this.#clip) this.#instance.play(this.#clip);
    }
}

// ------------------------------------------------------------------
// Geometría
// ------------------------------------------------------------------

function forEachFixture(body, fn) {
    for (let f = body.GetFixtureList(); Box2D.getPointer(f) !== 0; f = f.GetNext()) fn(f);
}

function lowestPoint(instance) {
    let lowest = Infinity;
    for (const body of instance.bodies.values()) {
        forEachFixture(body, (f) => {
            lowest = Math.min(lowest, f.GetAABB(0).get_lowerBound().get_y());
        });
    }
    return Number.isFinite(lowest) ? lowest : 0;
}

// Busca la punta de un body tipo "antebrazo": el punto de sus shapes más
// lejano a la articulación que lo une al resto. La dirección de disparo
// va de la articulación a esa punta, así el chorro sigue al brazo.
function findTip(instance, bodyName) {
    const body = instance.body(bodyName);
    if (!body) return null;

    const joint = [...instance.joints.values()].find(
        (j) => sameBody(j.GetBodyA(), body) || sameBody(j.GetBodyB(), body),
    );
    const anchor = joint ? toLocal(body, joint.GetAnchorA()) : { x: 0, y: 0 };

    let tip = anchor;
    let farthest = -1;
    for (const point of shapePoints(body, anchor)) {
        const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
        if (distance > farthest) {
            farthest = distance;
            tip = point;
        }
    }

    const length = Math.hypot(tip.x - anchor.x, tip.y - anchor.y) || 1;
    const direction = { x: (tip.x - anchor.x) / length, y: (tip.y - anchor.y) / length };
    return { body, point: tip, direction };
}

// Puntos candidatos a "punta" de cada shape, en coordenadas locales:
// los vértices de un polígono, o el borde de un círculo opuesto al ancla.
function shapePoints(body, anchor) {
    const points = [];
    forEachFixture(body, (fixture) => {
        const shape = fixture.GetShape();
        if (shape.GetType() === CIRCLE_SHAPE) {
            const circle = Box2D.castObject(shape, Box2D.b2CircleShape);
            const c = circle.get_m_p();
            const r = circle.get_m_radius();
            const dx = c.get_x() - anchor.x;
            const dy = c.get_y() - anchor.y;
            const d = Math.hypot(dx, dy) || 1;
            points.push({ x: c.get_x() + (dx / d) * r, y: c.get_y() + (dy / d) * r });
        } else {
            const polygon = Box2D.castObject(shape, Box2D.b2PolygonShape);
            for (let i = 0; i < polygon.GetVertexCount(); i++) {
                const v = polygon.GetVertex(i);
                points.push({ x: v.get_x(), y: v.get_y() });
            }
        }
    });
    return points;
}

function sameBody(a, b) {
    return Box2D.getPointer(a) === Box2D.getPointer(b);
}

function toLocal(body, worldPoint) {
    const position = body.GetPosition();
    const angle = body.GetAngle();
    const dx = worldPoint.get_x() - position.get_x();
    const dy = worldPoint.get_y() - position.get_y();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}
