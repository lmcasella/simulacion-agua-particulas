// particle.js
export class Particle {
    constructor(x, y, texture, stage) {
        // Datos Físicos (Lógica Lagrangiana)
        this.position = new PIXI.Point(x, y);
        this.velocity = new PIXI.Point(0, 0);
        this.force = new PIXI.Point(0, 0);

        this.density = 0;
        this.pressure = 0;

        // Representación Visual
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.width = 10; // Tamaño visual, distinto al radio de influencia
        this.sprite.height = 10;

        stage.addChild(this.sprite);
    }

    // Sincroniza la matemática con el render
    updateVisuals() {
        this.sprite.x = this.position.x;
        this.sprite.y = this.position.y;
    }
}
