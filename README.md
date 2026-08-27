# Simulación de Agua / Fluidos (SPH + PixiJS)

Simulación de fluidos en 2D basada en **SPH** (Smoothed Particle Hydrodynamics),
renderizada con **PixiJS**, con un panel de control para crear, editar y
persistir distintos materiales líquidos (agua, miel, lava, mercurio, gas…).

## Cómo ejecutar

No requiere build. Sólo necesita servirse por HTTP (los módulos ES no cargan
desde `file://`):

```bash
# desde la carpeta del proyecto
npx serve .
# o
python -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Qué es y cómo funciona

En SPH el líquido no es una malla: es un conjunto de **partículas**. El fluido
"continuo" se reconstruye interpolando esas muestras con funciones de peso
(*kernels*). Cada frame, por cada sub-paso:

1. **Gravedad** y cálculo de una **posición predicha** (mejora la estabilidad).
2. **Rejilla espacial** (hashing) para encontrar vecinas en ~O(n) en vez de O(n²).
3. **Densidad** de cada partícula = suma ponderada de sus vecinas.
4. **Presión**: la densidad se convierte en presión y las partículas se empujan
   de zonas comprimidas a zonas dilatadas (esto es la *interacción* del líquido:
   no hay colisiones rígidas partícula-partícula, sino una repulsión suave).
5. **Viscosidad**: las vecinas igualan sus velocidades (agua = poca, miel = mucha).
6. **Ratón**: atrae o empuja el líquido.
7. **Integración** de posiciones y **colisión con los bordes** de la pantalla.

La **lógica** (`update`) y el **render** (`render`) están separados: la física
mueve datos puros y el render sólo vuelca posiciones a las partículas de PixiJS.

## Archivos

| Archivo           | Rol                                                        |
| ----------------- | ---------------------------------------------------------- |
| `index.html`      | Lienzo, panel y estilos.                                   |
| `main.js`         | Arranque, ratón, FPS y bucle principal.                    |
| `fluidSystem.js`  | Solver SPH (SoA) + render en `ParticleContainer`.          |
| `spatialHash.js`  | Rejilla de hashing espacial para buscar vecinas.           |
| `materials.js`    | Presets, metadatos de parámetros y persistencia.           |
| `ui.js`           | Panel de control (materiales + simulación).                |

## Interfaz (estilo editor)

La UI se reparte en tres zonas:

- **Parámetros (izquierda)**: material activo (**Nuevo / Duplicar / Borrar /
  Restaurar presets**) y sliders en vivo de color, gravedad, radio de
  influencia, densidad de reposo, presión, presión cercana, viscosidad,
  amortiguación de rebote y tamaño de partícula.
- **Simulación (arriba, centrada)**: transporte ▶ Play / ⏸ Pausa / ⏹ Stop /
  ⏭ Frame, límite de **FPS** (Auto = frecuencia del monitor) y recuento de
  partículas en vivo.
- **Herramientas (abajo, centrada)**: **＋ Añadir** y **－ Borrar** partículas
  sobre la marcha arrastrando en el lienzo, **⟲ Atraer** / **⟳ Empujar** el
  fluido, tamaño del **Pincel** y **🗑 Vaciar** todo.

Todo (materiales y selección) se guarda en `localStorage` y **persiste entre
sesiones**.

## Rendimiento

El estado de las partículas usa **Structure of Arrays** (`Float32Array`) en vez
de miles de objetos: mejor localidad de caché y bucles que el JIT vectoriza.

La búsqueda de vecinas usa una **rejilla uniforme** con ordenación por conteo
sobre `Int32Array` reutilizados: no asigna memoria por frame (la versión previa
con `Map` y claves de texto saturaba al recolector de basura). La presión se
precalcula una vez por partícula y por paso, y la lista de vecinas se cachea y
se reutiliza en los pasos de densidad/presión/viscosidad.

El **render** usa un `ParticleContainer` de PixiJS: todas las partículas
comparten una textura y se dibujan en un único lote, en lugar de tratar cada
sprite como un nodo del grafo de escena (el cuello de botella anterior). Sólo la
**posición** se sube a la GPU cada frame; color y escala son estáticos y sólo se
refrescan al editar un material. Con esto la simulación se mantiene fluida con
varios miles de partículas.
