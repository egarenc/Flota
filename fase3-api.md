# Fase 3 — API con Google Apps Script

Esta fase define los endpoints que conectarán tu frontend con Google Sheets. El código se sube a un proyecto de Apps Script y se publica como Web App.

## Endpoints principales

- `crearPartida`
  - Genera un ID único de 5 letras.
  - Crea una fila en la hoja `Partidas`.
  - Devuelve el código de partida y los datos iniciales.

- `unirsePartida`
  - Busca el código en la hoja `Partidas`.
  - Registra el jugador 2 y cambia el estado a `En Curso`.
  - Devuelve la información de la partida.

- `guardarTablero`
  - Recibe `ID_Partida`, `Jugador` y `Posicion_Barcos`.
  - Actualiza o inserta la fila en la hoja `Tableros`.

- `enviarDisparo`
  - Recibe `ID_Partida`, `Jugador` y `Coordenada`.
  - Comprueba el tablero del rival y determina `tocado`/`fallo`/`hundido`.
  - Actualiza `Tableros` y cambia `Turno_De` en `Partidas`.
  - Devuelve el resultado del disparo.

- `consultarEstado`
  - Devuelve el estado de la partida y los disparos recientes.
  - Permite al cliente saber si ya es su turno.

## Consideraciones de seguridad y CORS

- En Apps Script, publica el proyecto como Web App:
  - Ejecutar la aplicación como: `Yo mismo`.
  - Quién tiene acceso: `Cualquiera, incluso anónimo`.
- Si hay problemas de CORS desde GitHub Pages, usa `mode: 'no-cors'` con cuidado, o agrega un proxy desde tu servidor.

## Estructura de funciones

- `doGet(e)` y `doPost(e)` reciben la acción en `e.parameter.action` o en el cuerpo JSON.
- Usa `getSheetByName('Partidas')` y `getSheetByName('Tableros')`.
- Normaliza los resultados con funciones auxiliares.

## Ejemplo de uso desde JavaScript

```js
await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'crearPartida', jugadorId: 'jugador_1' }),
});
```
