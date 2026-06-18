# Fase 4 — Lógica del juego en el cliente

Esta fase implementa la gestión del estado local, la colocación de barcos y la conexión básica con la API.

## Estructuras de estado

- `miTablero`: matriz 10x10 con el estado de las celdas propias.
- `miRadar`: matriz 10x10 con los disparos realizados al rival.
- `barcosDisponibles`: lista de barcos que el jugador debe colocar.
- `orientacion`: `horizontal` o `vertical` para la colocación de barcos.
- `barcoSeleccionado`: barco que el jugador ha elegido antes de colocar.
- `idPartida` y `miJugador`: identificadores de la sesión y del jugador local.

## Colocación de barcos

- El jugador selecciona un barco del panel lateral.
- Elige orientación con el botón `Orientación`.
- Hace clic en el tablero de preparación para colocar el barco.
- La función `colocarBarco()` comprueba límites y solapamientos.
- Al colocar un barco, se guarda en `miTablero` como `barco`.

## Renderizado de tableros

- `renderTableros()` dibuja:
  - `tableroPreparacion` con las celdas actuales de `miTablero`.
  - `tableroFlota` para visualizar la flota propia con etiquetas.
  - `tableroRadar` con los disparos registrados en `miRadar`.

## Conexión con la API

- `API_URL` debe contener la URL pública del Web App de Google Apps Script.
- `fetchApi()` envía acciones como `crearPartida`, `unirsePartida`, `guardarTablero`.
- `guardarTableroApi()` convierte la posición local en un formato JSON y la envía.
- `crearPartidaApi()` y `unirsePartidaApi()` preparan la sesión y el estado de jugador.

## Flujo de la fase 4

1. El usuario crea o se une a una partida.
2. El juego muestra la pantalla de preparación.
3. El usuario selecciona y coloca todos los barcos.
4. Al pulsar `Listo`, el tablero se guarda en la API.
5. El juego pasa a la pantalla de batalla.

## Siguientes pasos recomendados

- Implementar validación completa de barcos: detectar barcos contiguos y asegurar que la cantidad exacta se coloca.
- Añadir lógica de disparo sobre el tablero de radar usando `enviarDisparo`.
- Crear el polling de `consultarEstado` para sincronizar turnos.
- Mostrar resultados de `tocado`/`fallo` en el radar y actualizar el tablero propio tras ataques rivales.
- Implementar `miTurno`, `startPolling()` y `stopPolling()` para alternar entre turno activo y espera.
- Mapear `misDisparos` y `disparosRival` de la API a los tableros `miRadar` y `miTablero`.
