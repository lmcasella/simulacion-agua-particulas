# Ragdolls + líquido (RagImporter + LiquidFun)

Dos jugadores controlan un ragdoll exportado desde [RagAssembler2D](https://gann4life.github.io/RagAssembler2D/)
cada uno: caminan de izquierda a derecha y disparan líquido (partículas de LiquidFun) desde la punta de un
brazo. Los líquidos de los dos comparten el mismo fluido: chocan, se apilan y empujan a los ragdolls.

## Cómo correrlo

Necesita un servidor local, porque usa módulos ES y `fetch` (no anda abriendo el archivo con doble clic):

```sh
npx http-server -c-1 .   # mismo comando que en RagAssembler2D
```

Abrir `http://localhost:8080/ragdoll-demo/`. Necesita internet: PIXI, liquidfun.js y RagImporter se
cargan desde el repo de RagAssembler2D vía jsDelivr, fijados a un commit (ver `index.html`).

| | Teclado | Gamepad |
| --- | --- | --- |
| Jugador 1 | `A` / `D` moverse, `W` saltar, `Espacio` disparar | 1.er gamepad conectado |
| Jugador 2 | `←` / `→` moverse, `↑` saltar, `Enter` disparar | 2.º gamepad conectado |

Los dos jugadores pueden compartir el mismo teclado (estilo Duck Game): WASD a la izquierda, flechas a
la derecha. `S` y `↓` quedan libres para una acción futura (agacharse, etc.).

Gamepad (layout Xbox / "standard mapping"): stick izquierdo o D-pad para moverse, `A` o D-pad arriba
para saltar, `X`, `RB` o `RT` para disparar. **El navegador no muestra los gamepads hasta que se aprieta un botón** con la página en foco;
el panel indica cuál quedó asignado a cada jugador. Teclado y gamepad funcionan a la vez.

Para probar otro ragdoll: arrastrar un `.rag.json` a la ventana o usar el selector del panel (se usa para
los dos jugadores). El panel también permite elegir desde qué body sale el líquido.

## Qué hay en cada archivo

| Archivo | Responsabilidad |
| --- | --- |
| `config.js` | Todos los valores ajustables: jugadores (teclas, colores, posición), gamepad, clips, líquido. |
| `main.js` | Arma las piezas, conecta el panel y corre el loop. |
| `ragdollLoader.js` | Texto → `RagDef` (incluye un adaptador temporal del formato v3 al v2). |
| `character.js` | Envuelve la instancia de RagImporter: moverse, girar, clips y punta del brazo. |
| `characterController.js` | Traduce input en acciones del personaje y del arma. |
| `keyboardInput.js` | Teclado → `{ moveAxis, shooting }`. |
| `gamepadInput.js` | Gamepad → `{ moveAxis, shooting }`. |
| `combinedInput.js` | Une varios inputs en uno (teclado + gamepad del mismo jugador). |
| `liquidSystem.js` | El fluido compartido (sistema de partículas de LiquidFun), con color por partícula. |
| `liquidGun.js` | Emisor de un jugador: dispara partículas de su color al `LiquidSystem`. |
| `world.js` | Mundo de Box2D, piso y paredes. |
| `sceneRenderer.js` | Dibujo con PIXI.Graphics y cámara que encuadra a todos los jugadores. |

## Cambios típicos

- **Más o menos jugadores:** agregar o quitar entradas en `CONFIG.players`.
- **Otras teclas o botones:** `keys` de cada jugador y `CONFIG.gamepad`.
- **Otra animación al caminar o disparar:** `CONFIG.character.clips`.
- **Otro brazo por defecto:** `CONFIG.character.emitterBody` (nombre del body en el `.rag.json`).
- **Altura del salto:** `CONFIG.character.jumpSpeed` (altura ≈ v² / 2g).
- **IA u otro dispositivo:** pasarle al `CharacterController` cualquier objeto con `moveAxis` (-1 a 1),
  `jumping` y `shooting` (bool). No hay que tocar nada más.
- **Más o menos líquido:** `CONFIG.liquid` y `CONFIG.liquidGun`.

## Notas

- **Formato v3:** el RagImporter publicado solo lee `version: 2`. La v3 define la masa por body
  (`mass`) en vez de por fixture (`density`); `ragdollLoader.js` hace la conversión. Cuando
  RagImporter soporte v3, se borra ese bloque.
- **Girar:** RagImporter solo permite espejar (`flipX`) al spawnear, así que girar re-spawnea el
  ragdoll espejado en la misma posición.
- **Mover y saltar:** se ajusta la velocidad de los bodies (no se aplican fuerzas) porque
  `stepWorld` hace varios sub-pasos por frame y Box2D borra las fuerzas después de cada uno.
- **¿Está en el piso?:** se revisan los contactos de Box2D y solo cuentan superficies que apuntan hacia
  arriba (piso o la cabeza del otro jugador; las paredes no). Un ragdoll pierde contacto por instantes
  todo el tiempo, así que recién se lo considera "en el aire" tras `coyoteTime` (0,1 s) sin piso.
