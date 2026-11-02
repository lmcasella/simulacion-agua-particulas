// world.js
// Mundo de LiquidFun (Box2D) y geometría estática del escenario.
// Box2D es el global que define liquidfun.js (ver index.html).

export function createWorld({ gravity }) {
    const g = new Box2D.b2Vec2(gravity.x, gravity.y);
    const world = new Box2D.b2World(g);
    Box2D.destroy(g);
    return world;
}

// Caja estática centrada en (x, y), en metros.
export function createStaticBox(world, x, y, halfWidth, halfHeight) {
    const bodyDef = new Box2D.b2BodyDef();
    const body = world.CreateBody(bodyDef);
    Box2D.destroy(bodyDef);

    const shape = new Box2D.b2PolygonShape();
    const center = new Box2D.b2Vec2(x, y);
    shape.SetAsBox(halfWidth, halfHeight, center, 0);
    body.CreateFixture(shape, 0);
    Box2D.destroy(center);
    Box2D.destroy(shape);
    return body;
}

// Piso (con la superficie en y = 0) y una pared en cada extremo, para
// que el agua se acumule en vez de caerse del mundo.
export function createArena(world, { arenaHalfWidth, wallHeight }) {
    const wallY = wallHeight / 2;
    return [
        createStaticBox(world, 0, -0.25, arenaHalfWidth, 0.25),
        createStaticBox(world, -arenaHalfWidth, wallY, 0.25, wallY),
        createStaticBox(world, arenaHalfWidth, wallY, 0.25, wallY),
    ];
}
