// spatialHash.js
// -----------------------------------------------------------------------------
// Rejilla espacial uniforme (Uniform Grid) con ordenación por conteo,
// operando sobre arrays tipados (Structure of Arrays).
//
// build(predX, predY, n) coloca los índices [0..n) en `sorted`, agrupados por
// celda, usando un counting sort sobre Int32Array reutilizados. No asigna
// memoria por frame (salvo que crezca el número de celdas o de partículas).
//
// El consumidor (FluidSystem) recorre directamente las 9 celdas del bloque 3x3
// leyendo `cellStart` y `sorted`; por eso ambos son públicos.
// -----------------------------------------------------------------------------

export class SpatialHash {
    constructor(cellSize, width = window.innerWidth, height = window.innerHeight) {
        this.cellSize = Math.max(1, cellSize);
        this.width = width;
        this.height = height;

        this.cols = 1;
        this.rows = 1;
        this.numCells = 1;

        this.cellCounts = new Int32Array(1); // partículas por celda
        this.cellStart = new Int32Array(2); // offset inicial de cada celda (+1)
        this.cursor = new Int32Array(1); // posición de inserción por celda
        this.sorted = new Int32Array(0); // índices de partícula ordenados por celda
        this.cellIndexOf = new Int32Array(0); // celda de cada partícula

        this._recalcDims();
        this._ensureCells();
    }

    setCellSize(cellSize) {
        this.cellSize = Math.max(1, cellSize);
        this._recalcDims();
        this._ensureCells();
    }

    setBounds(width, height) {
        this.width = width;
        this.height = height;
        this._recalcDims();
        this._ensureCells();
    }

    _recalcDims() {
        this.cols = Math.max(1, Math.ceil(this.width / this.cellSize));
        this.rows = Math.max(1, Math.ceil(this.height / this.cellSize));
        this.numCells = this.cols * this.rows;
    }

    _ensureCells() {
        if (this.cellCounts.length < this.numCells) {
            this.cellCounts = new Int32Array(this.numCells);
            this.cursor = new Int32Array(this.numCells);
        }
        if (this.cellStart.length < this.numCells + 1) {
            this.cellStart = new Int32Array(this.numCells + 1);
        }
    }

    // Reconstruye la rejilla a partir de las posiciones predichas (SoA).
    build(predX, predY, n) {
        if (this.sorted.length < n) {
            this.sorted = new Int32Array(n);
            this.cellIndexOf = new Int32Array(n);
        }

        const counts = this.cellCounts;
        const start = this.cellStart;
        const cursor = this.cursor;
        const cellIndexOf = this.cellIndexOf;
        const sorted = this.sorted;
        const numCells = this.numCells;
        const cols = this.cols;
        const rows = this.rows;
        const cs = this.cellSize;

        counts.fill(0, 0, numCells);

        // 1) Contar partículas por celda (con recorte a la rejilla).
        for (let i = 0; i < n; i++) {
            let cx = (predX[i] / cs) | 0;
            if (cx < 0) cx = 0;
            else if (cx >= cols) cx = cols - 1;
            let cy = (predY[i] / cs) | 0;
            if (cy < 0) cy = 0;
            else if (cy >= rows) cy = rows - 1;
            const ci = cy * cols + cx;
            cellIndexOf[i] = ci;
            counts[ci]++;
        }

        // 2) Suma prefija -> offset inicial de cada celda.
        start[0] = 0;
        for (let c = 0; c < numCells; c++) {
            start[c + 1] = start[c] + counts[c];
            cursor[c] = start[c];
        }

        // 3) Colocar cada índice de partícula en su tramo.
        for (let i = 0; i < n; i++) {
            const ci = cellIndexOf[i];
            sorted[cursor[ci]++] = i;
        }
    }
}
