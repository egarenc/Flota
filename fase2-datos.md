# Fase 2 — Estructura de datos en Google Sheets

Google Sheets será la base de datos relacional para tu juego de Hundir la flota virtual. Aquí se define el esquema de las hojas y el formato recomendado para los campos.

## Hoja 1: `Partidas`

Columnas:
- `ID_Partida`: Código único de la partida (por ejemplo: `A1B2C`).
- `Jugador1_ID`: Identificador del primer jugador.
- `Jugador2_ID`: Identificador del segundo jugador.
- `Turno_De`: `1` o `2` para indicar qué jugador tiene el turno.
- `Estado`: `Esperando`, `En Curso` o `Finalizada`.

Ejemplo de filas:

| ID_Partida | Jugador1_ID | Jugador2_ID | Turno_De | Estado      |
|------------|-------------|-------------|----------|-------------|
| ABCDE      | jugador_1   |             | 1        | Esperando   |
| FGHIJ      | jugador_11  | jugador_22  | 2        | En Curso    |

## Hoja 2: `Tableros`

Columnas:
- `ID_Partida`: Clave foránea a la hoja `Partidas`.
- `Jugador`: `1` o `2` para distinguir los tableros de cada jugador.
- `Posicion_Barcos`: Texto JSON con la ubicación de los barcos.
- `Disparos_Realizados`: Texto JSON con los disparos hechos por el jugador y sus resultados.

### Formato sugerido para `Posicion_Barcos`

Usa un array de objetos, cada uno con el tipo de barco y sus celdas.

```json
[
  { "tipo": 4, "coordenadas": ["0-0", "0-1", "0-2", "0-3"] },
  { "tipo": 3, "coordenadas": ["2-5", "3-5", "4-5"] },
  { "tipo": 3, "coordenadas": ["7-2", "7-3", "7-4"] }
]
```

### Formato sugerido para `Disparos_Realizados`

Usa un array de objetos con la coordenada y resultado esperado.

```json
[
  { "coordenada": "1-1", "resultado": "fallo" },
  { "coordenada": "4-5", "resultado": "tocado" },
  { "coordenada": "0-3", "resultado": "hundido" }
]
```

### Ejemplo de filas en `Tableros`

| ID_Partida | Jugador | Posicion_Barcos                                                                                                                                                     | Disparos_Realizados                                                                                 |
|------------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| ABCDE      | 1       | [{"tipo":4,"coordenadas":["0-0","0-1","0-2","0-3"]}, {"tipo":3,"coordenadas":["2-5","3-5","4-5"]}]                                                     | [{"coordenada":"5-5","resultado":"fallo"}]                                                   |
| ABCDE      | 2       | [{"tipo":4,"coordenadas":["1-1","1-2","1-3","1-4"]}, {"tipo":3,"coordenadas":["6-0","6-1","6-2"]}]                                                     | [{"coordenada":"0-0","resultado":"tocado"}]                                                  |

## Relaciones y reglas

- Cada `ID_Partida` debe existir en la hoja `Partidas`.
- En la hoja `Tableros`, debe haber exactamente dos filas por partida (`Jugador` 1 y `Jugador` 2) una vez que la partida está en curso.
- `Turno_De` en `Partidas` controla qué jugador puede disparar.
- La API deberá leer y actualizar estas hojas para sincronizar el juego.

## Notas adicionales

- Si quieres simplificar, puedes usar coordenadas en formato `A1`, `J10` en lugar de `fila-columna`.
- Asegúrate de que `Posicion_Barcos` y `Disparos_Realizados` sean cadenas válidas JSON antes de guardarlas en la hoja.
- Para buscar el rival, la API puede leer la fila `Tableros` del mismo `ID_Partida` y `Jugador` contrario.




## Apps Script de Google

- URL
https://script.google.com/macros/s/AKfycbxya7yzXIKF8lxo3RYRyBNkzgCQ545sABrCK3ax5q8NTRUrrtna_40HH3_8A-2GisEi/exec

https://script.google.com/macros/s/AKfycbx11N7im_6r0Ct88uf147WzQRqs2iB8kNUj4ZuvPOzaZLYHBAkcC3f8UiJ5_Gpw59EJ/exec

https://script.google.com/macros/s/AKfycby61mLJHQR003PqMzDo1xPjIWvn1wl0_tYVkccJZA7-fOJP7so1ENFEEAURNabb0WGi/exec

- ID de implementación
AKfycbxya7yzXIKF8lxo3RYRyBNkzgCQ545sABrCK3ax5q8NTRUrrtna_40HH3_8A-2GisEi

- ID de GoogleSpreadsheat
1YLqkwchHDlx2Oy4g1F_3ggrPV4CjeGtB_cESAdDLf-w