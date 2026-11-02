export class Particle {
    constructor(x, y, texture, stage, debugContainer) {
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

        this.radarGraphic = new PIXI.Graphics();
        debugContainer.addChild(this.radarGraphic);
        this.radarGraphic.visible = false;
    }

    // Sincroniza la matemática con el render
    updateVisuals() {
        this.sprite.x = this.position.x;
        this.sprite.y = this.position.y;

        // El radar ahora debe copiar la posición de la partícula manualmente
        if (this.radarGraphic) {
            this.radarGraphic.x = this.position.x;
            this.radarGraphic.y = this.position.y;
        }
    }

    // Pinta la partícula según su densidad relativa a la densidad de reposo.
    // Azul = zona "suelta" (densidad baja), Rojo = zona comprimida (densidad alta).
    // Esto hace visible el disparador de la fuerza de presión: donde se ve rojo,
    // el algoritmo está empujando partículas hacia afuera en ese mismo frame.
    updateColorByDensity(targetDensity) {
        const ratio = this.density / targetDensity;

        // Normalizamos el ratio a un valor t entre 0 (suelto) y 1 (comprimido)
        const t = Math.min(Math.max((ratio - 0.5) / 2.0, 0), 1);

        const colorSuelto = { r: 0x33, g: 0x99, b: 0xff }; // azul
        const colorDenso = { r: 0xff, g: 0x44, b: 0x44 }; // rojo

        const r = Math.round(
            colorSuelto.r + t * (colorDenso.r - colorSuelto.r),
        );
        const g = Math.round(
            colorSuelto.g + t * (colorDenso.g - colorSuelto.g),
        );
        const b = Math.round(
            colorSuelto.b + t * (colorDenso.b - colorSuelto.b),
        );

        this.sprite.tint = (r << 16) + (g << 8) + b;
    }

    destroy() {
        this.sprite.destroy();
    }
}
