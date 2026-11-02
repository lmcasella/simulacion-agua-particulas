# Ragdoll + agua (RagImporter + LiquidFun)

Un ragdoll exportado desde [RagAssembler2D](https://gann4life.github.io/RagAssembler2D/)
camina de izquierda a derecha y dispara agua (partículas de LiquidFun) desde la punta de un brazo.

## Cómo correrlo

Necesita un servidor local, porque usa módulos ES y `fetch` (no anda abriendo el archivo con doble clic):

```sh
npx serve .
# o la extensión Live Server de VS Code
```

Abrir `http://localhost:3000/ragdoll-demo/`. Necesita internet: PIXI, liquidfun.js y RagImporter se
cargan desde el repo de RagAssembler2D vía jsDelivr, fijados a un commit (ver `index.html`).

| Tecla | Acción |
| --- | --- |
| `A` / `D` o flechas | moverse |
| `Espacio` o `J` | disparar agua |

Para probar otro ragdoll: arrastrar un `.rag.json` a la ventana o usar el selector del panel. El panel
también permite elegir desde qué body sale el agua.

## Qué hay en cada archivo

| Archivo | Responsabilidad |
| --- | --- |
| `config.js` | Todos los valores ajustables: velocidades, clips por estado, teclas, agua, colores. |
| `main.js` | Arma las piezas, conecta el panel y corre el loop. |
| `ragdollLoader.js` | Texto → `RagDef` (incluye un adaptador temporal del formato v3 al v2). |
| `character.js` | Envuelve la instancia de RagImporter: moverse, girar, clips y punta del brazo. |
| `characterController.js` | Traduce input en acciones del personaje y del arma. |
| `keyboardInput.js` | Teclado → `{ moveAxis, shooting }`. |
| `liquidGun.js` | Emisor de partículas de LiquidFun. |
| `world.js` | Mundo de Box2D, piso y paredes. |
| `sceneRenderer.js` | Dibujo con PIXI.Graphics y cámara que sigue al personaje. |

## Cambios típicos

- **Otra animación al caminar o disparar:** `CONFIG.character.clips`.
- **Otro brazo por defecto:** `CONFIG.character.emitterBody` (nombre del body en el `.rag.json`).
- **Gamepad o IA en vez de teclado:** pasarle al `CharacterController` cualquier objeto con
  `moveAxis` (-1, 0, 1) y `shooting` (bool). No hay que tocar nada más.
- **Más o menos agua:** `CONFIG.liquidGun`.

## Notas

- **Formato v3:** el RagImporter publicado solo lee `version: 2`. La v3 define la masa por body
  (`mass`) en vez de por fixture (`density`); `ragdollLoader.js` hace la conversión. Cuando
  RagImporter soporte v3, se borra ese bloque.
- **Girar:** RagImporter solo permite espejar (`flipX`) al spawnear, así que girar re-spawnea el
  ragdoll espejado en la misma posición.
- **Mover:** se ajusta la velocidad horizontal de los bodies (no se aplican fuerzas) porque
  `stepWorld` hace varios sub-pasos por frame y Box2D borra las fuerzas después de cada uno.
