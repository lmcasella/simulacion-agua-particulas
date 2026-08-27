// ui.js
// -----------------------------------------------------------------------------
// Interfaz tipo "editor / motor", repartida en tres zonas:
//
//   · Panel de PARÁMETROS (izquierda): material activo + sliders físicos.
//   · Barra de SIMULACIÓN (arriba, centrada): transporte, FPS y recuento.
//   · Barra de HERRAMIENTAS (abajo, centrada): crear / borrar / atraer /
//     empujar partículas, y tamaño del pincel.
//
// Todo lo relativo a materiales se persiste en localStorage entre sesiones.
// -----------------------------------------------------------------------------

import {
    PARAM_META,
    cloneMaterial,
    makeUniqueId,
    saveMaterials,
    saveSelectedId,
    resetToDefaults,
} from "./materials.js";

const hexToNumber = (str) => parseInt(str.replace("#", ""), 16);
const numberToHex = (num) => "#" + num.toString(16).padStart(6, "0");

export class UIController {
    constructor(fluidSystem, options) {
        this.sim = fluidSystem;
        this.onRespawn = options.onRespawn; // () => void
        this.onSetFps = options.onSetFps || (() => {}); // (maxFps:number) => void

        // La paleta es propiedad del solver (referencia compartida). `selected`
        // es el material ACTIVO: el que reciben las partículas nuevas.
        this.materials = this.sim.materials;
        this.selected = this.materials[this.sim.activeIndex];

        // Recuento con el que "Stop" reinicia el bloque de partículas.
        this.particleCount = options.initialCount ?? 700;

        this.root = document.getElementById("panel");
        this.topbar = document.getElementById("topbar");
        this.toolbar = document.getElementById("toolbar");

        this.build();
        this.buildTopbar();
        this.buildToolbar();
        this.applySelected();
    }

    // Fija el material ACTIVO (para partículas nuevas). NO re-estiliza las
    // existentes: así se pueden mezclar líquidos distintos.
    applySelected() {
        this.sim.setActiveMaterial(this.materials.indexOf(this.selected));
        this.selected = this.materials[this.sim.activeIndex];
        saveSelectedId(this.selected.id);
    }

    persist() {
        saveMaterials(this.materials);
    }

    // ===== Panel de parámetros (izquierda) ===================================

    build() {
        this.root.innerHTML = "";

        const header = el("div", "panel-header");
        const title = el("span", "panel-title", "💧 Parámetros");
        const collapseBtn = el("button", "icon-btn", "–");
        collapseBtn.title = "Contraer / expandir";
        collapseBtn.onclick = () => this.root.classList.toggle("collapsed");
        header.append(title, collapseBtn);

        const body = el("div", "panel-body");

        body.append(sectionTitle("Material"));

        this.select = document.createElement("select");
        this.select.className = "material-select";
        this.refreshSelectOptions();
        this.select.onchange = () => {
            this.selected = this.materials.find((m) => m.id === this.select.value);
            this.applySelected();
            this.renderMaterialControls();
        };
        body.append(this.select);

        const actions = el("div", "btn-row");
        actions.append(
            button("Nuevo", () => this.createMaterial()),
            button("Duplicar", () => this.duplicateMaterial()),
            button("Borrar", () => this.deleteMaterial(), "danger"),
        );
        body.append(actions);

        const actions2 = el("div", "btn-row");
        actions2.append(button("Restaurar presets", () => this.resetDefaults(), "wide"));
        body.append(actions2);

        this.materialControls = el("div", "material-controls");
        body.append(this.materialControls);

        this.root.append(header, body);
        this.renderMaterialControls();
    }

    refreshSelectOptions() {
        this.select.innerHTML = "";
        for (const m of this.materials) {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.name;
            if (m.id === this.selected.id) opt.selected = true;
            this.select.append(opt);
        }
    }

    renderMaterialControls() {
        const box = this.materialControls;
        box.innerHTML = "";

        // Nombre editable.
        const nameRow = el("div", "field");
        nameRow.append(labelEl("Nombre"));
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = this.selected.name;
        nameInput.className = "text-input";
        nameInput.oninput = () => {
            this.selected.name = nameInput.value;
            const opt = [...this.select.options].find(
                (o) => o.value === this.selected.id,
            );
            if (opt) opt.textContent = nameInput.value;
            this.persist();
        };
        nameRow.append(nameInput);
        box.append(nameRow);

        // Color.
        const colorRow = el("div", "field");
        colorRow.append(labelEl("Color"));
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = numberToHex(this.selected.color);
        colorInput.className = "color-input";
        colorInput.oninput = () => {
            this.selected.color = hexToNumber(colorInput.value);
            // Re-tinta sólo las partículas de ESTE material.
            this.sim.onMaterialEdited(this.materials.indexOf(this.selected));
            this.persist();
        };
        colorRow.append(colorInput);
        box.append(colorRow);

        // Un slider por cada parámetro físico.
        for (const key of Object.keys(PARAM_META)) {
            const meta = PARAM_META[key];
            box.append(
                this.buildSlider(meta.label, this.selected[key], meta, (val) => {
                    this.selected[key] = val;
                    // Aplica en vivo a las partículas de este material.
                    this.sim.onMaterialEdited(this.materials.indexOf(this.selected));
                    this.persist();
                }),
            );
        }
    }

    buildSlider(label, value, meta, onChange) {
        const field = el("div", "field");
        const head = el("div", "field-head");
        head.append(labelEl(label));
        const valSpan = el("span", "field-value", formatNum(value));
        head.append(valSpan);
        field.append(head);

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = meta.min;
        slider.max = meta.max;
        slider.step = meta.step;
        slider.value = value;
        slider.oninput = () => {
            const v = parseFloat(slider.value);
            valSpan.textContent = formatNum(v);
            onChange(v);
        };
        field.append(slider);
        return field;
    }

    // ===== Barra de simulación (arriba, centrada) ============================

    buildTopbar() {
        this.topbar.innerHTML = "";

        // Transporte.
        this.playBtn = iconButton("▶", () => this.play(), "Reproducir");
        this.pauseBtn = iconButton("⏸", () => this.pause(), "Pausar");
        this.stopBtn = iconButton("⏹", () => this.stop(), "Detener y reiniciar");
        this.stepBtn = iconButton("⏭", () => this.stepFrame(), "Avanzar un cuadro");
        const transport = el("div", "bar-group");
        transport.append(this.playBtn, this.pauseBtn, this.stopBtn, this.stepBtn);
        this.topbar.append(transport);
        this.refreshTransport();

        this.topbar.append(barSep());

        // FPS.
        const fpsGroup = el("div", "bar-group");
        fpsGroup.append(el("span", "bar-label", "FPS"));
        this.fpsSelect = document.createElement("select");
        this.fpsSelect.className = "bar-select";
        for (const [label, val] of [
            ["Auto", 0],
            ["30", 30],
            ["60", 60],
            ["120", 120],
            ["144", 144],
        ]) {
            const opt = document.createElement("option");
            opt.value = String(val);
            opt.textContent = label;
            this.fpsSelect.append(opt);
        }
        this.fpsSelect.onchange = () => {
            this.onSetFps(parseInt(this.fpsSelect.value, 10));
        };
        this.fpsVal = el("span", "bar-readout", "— fps");
        fpsGroup.append(this.fpsSelect, this.fpsVal);
        this.topbar.append(fpsGroup);

        this.topbar.append(barSep());

        // Recuento de partículas.
        const countGroup = el("div", "bar-group");
        countGroup.append(el("span", "bar-label", "Partículas"));
        this.countVal = el("span", "bar-readout", String(this.sim.count));
        countGroup.append(this.countVal);
        this.topbar.append(countGroup);
    }

    // ===== Barra de herramientas (abajo, centrada) ===========================

    buildToolbar() {
        this.toolbar.innerHTML = "";

        // Herramientas de puntero.
        const tools = el("div", "bar-group");
        this.toolButtons = {
            add: toolButton("＋ Añadir", () => this.setTool("add"), "Crear partículas"),
            remove: toolButton("－ Borrar", () => this.setTool("remove"), "Eliminar partículas"),
            attract: toolButton("⟲ Atraer", () => this.setTool("attract"), "Atraer el fluido"),
            repel: toolButton("⟳ Empujar", () => this.setTool("repel"), "Empujar el fluido"),
        };
        tools.append(
            this.toolButtons.add,
            this.toolButtons.remove,
            this.toolButtons.attract,
            this.toolButtons.repel,
        );
        this.toolbar.append(tools);

        this.toolbar.append(barSep());

        // Tamaño del pincel / radio de influencia.
        const brushGroup = el("div", "bar-group");
        brushGroup.append(el("span", "bar-label", "Pincel"));
        this.brushSlider = document.createElement("input");
        this.brushSlider.type = "range";
        this.brushSlider.min = 30;
        this.brushSlider.max = 320;
        this.brushSlider.step = 5;
        this.brushSlider.value = this.sim.mouse.radius;
        this.brushSlider.className = "bar-slider";
        this.brushVal = el("span", "bar-readout", String(this.sim.mouse.radius));
        this.brushSlider.oninput = () => {
            const v = parseInt(this.brushSlider.value, 10);
            this.sim.mouse.radius = v;
            this.brushVal.textContent = String(v);
        };
        brushGroup.append(this.brushSlider, this.brushVal);
        this.toolbar.append(brushGroup);

        this.toolbar.append(barSep());

        // Vaciar todo.
        const clearGroup = el("div", "bar-group");
        clearGroup.append(
            toolButton("🗑 Vaciar", () => this.clearAll(), "Eliminar todas las partículas", "danger"),
        );
        this.toolbar.append(clearGroup);

        this.setTool("attract");
    }

    setTool(name) {
        this.sim.mouse.tool = name;
        for (const [k, btn] of Object.entries(this.toolButtons)) {
            btn.classList.toggle("active", k === name);
        }
    }

    clearAll() {
        this.sim.clear();
        this.setCountDisplay(0);
    }

    // ===== Transporte ========================================================

    play() {
        this.sim.paused = false;
        this.refreshTransport();
    }

    pause() {
        this.sim.paused = true;
        this.refreshTransport();
    }

    // Detener = reiniciar el fluido al bloque inicial y pausar.
    stop() {
        this.onRespawn();
        this.sim.paused = true;
        this.refreshTransport();
    }

    // Avanzar un cuadro (pausa primero: comportamiento de depurador).
    stepFrame() {
        this.sim.paused = true;
        this.sim.stepOnce();
        this.refreshTransport();
    }

    refreshTransport() {
        const paused = this.sim.paused;
        this.playBtn.classList.toggle("active", !paused);
        this.pauseBtn.classList.toggle("active", paused);
    }

    // ===== Lecturas en vivo (llamadas por el bucle principal) ================

    setFpsDisplay(fps) {
        if (this.fpsVal) this.fpsVal.textContent = Math.round(fps) + " fps";
    }

    setCountDisplay(n) {
        if (this.countVal) this.countVal.textContent = String(n);
    }

    // ===== Acciones de materiales ============================================

    createMaterial() {
        const base = cloneMaterial(this.selected);
        base.name = "Nuevo material";
        base.id = makeUniqueId(base.name, this.materials);
        base.color = Math.floor(Math.random() * 0xffffff);
        this.materials.push(base);
        this.selected = base;
        this.persist();
        this.refreshSelectOptions();
        this.applySelected();
        this.renderMaterialControls();
    }

    duplicateMaterial() {
        const copy = cloneMaterial(this.selected);
        copy.name = this.selected.name + " (copia)";
        copy.id = makeUniqueId(copy.name, this.materials);
        this.materials.push(copy);
        this.selected = copy;
        this.persist();
        this.refreshSelectOptions();
        this.applySelected();
        this.renderMaterialControls();
    }

    deleteMaterial() {
        if (this.materials.length <= 1) {
            alert("Debe existir al menos un material.");
            return;
        }
        if (!confirm(`¿Borrar el material "${this.selected.name}"?`)) return;
        const idx = this.materials.findIndex((m) => m.id === this.selected.id);
        this.materials.splice(idx, 1);
        // Reasigna en el solver las partículas que apuntaban a este material.
        this.sim.onMaterialRemoved(idx);
        this.selected = this.materials[Math.max(0, idx - 1)];
        this.persist();
        this.refreshSelectOptions();
        this.applySelected();
        this.renderMaterialControls();
    }

    resetDefaults() {
        if (!confirm("Esto restaura los presets de fábrica y descarta tus cambios. ¿Continuar?"))
            return;
        this.materials = resetToDefaults();
        // Reemplaza la paleta en el solver (recorta índices y re-estiliza).
        this.sim.setMaterials(this.materials);
        this.selected = this.materials[0];
        this.refreshSelectOptions();
        this.applySelected();
        this.renderMaterialControls();
    }
}

// ----- Pequeños helpers de DOM ----------------------------------------------

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function labelEl(text) {
    return el("label", "field-label", text);
}

function sectionTitle(text) {
    return el("div", "section-title", text);
}

function button(text, onClick, extraClass = "") {
    const b = el("button", "btn " + extraClass, text);
    b.onclick = onClick;
    return b;
}

// Botón compacto de las barras (transporte).
function iconButton(text, onClick, title) {
    const b = el("button", "bar-btn", text);
    b.title = title;
    b.onclick = onClick;
    return b;
}

// Botón de herramienta (seleccionable, con estado activo).
function toolButton(text, onClick, title, extraClass = "") {
    const b = el("button", "tool-btn " + extraClass, text);
    b.title = title;
    b.onclick = onClick;
    return b;
}

function barSep() {
    return el("div", "bar-sep");
}

function formatNum(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
