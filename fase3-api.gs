const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI';
const HOJA_PARTIDAS = 'Partidas';
const HOJA_TABLEROS = 'Tableros';

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  const params = method === 'POST'
    ? parseRequestBody(e)
    : e.parameter;

  const action = params.action;
  let response = { ok: false, error: 'Acción inválida' };

  switch (action) {
    case 'crearPartida':
      response = crearPartida(params);
      break;
    case 'unirsePartida':
      response = unirsePartida(params);
      break;
    case 'guardarTablero':
      response = guardarTablero(params);
      break;
    case 'enviarDisparo':
      response = enviarDisparo(params);
      break;
    case 'consultarEstado':
      response = consultarEstado(params);
      break;
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseRequestBody(e) {
  try {
    return JSON.parse(e.postData.contents || '{}');
  } catch (error) {
    return e.parameter || {};
  }
}

function obtenerHoja(nombre) {
  const libro = SpreadsheetApp.openById(SPREADSHEET_ID);
  return libro.getSheetByName(nombre);
}

function generarCodigoPartida() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let codigo = '';
  for (let i = 0; i < 5; i += 1) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length));
  }
  return codigo;
}

function crearPartida(params) {
  const jugadorId = params.jugadorId || 'jugador_1';
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const codigo = generarCodigoUnico(hoja);
  hoja.appendRow([codigo, jugadorId, '', 1, 'Esperando']);
  return { ok: true, idPartida: codigo, turnoDe: 1, estado: 'Esperando' };
}

function generarCodigoUnico(hoja) {
  const totalFilas = hoja.getLastRow();
  const cantidadExistentes = Math.max(0, totalFilas - 1);
  const existentes = cantidadExistentes > 0
    ? hoja.getRange(2, 1, cantidadExistentes, 1).getValues().flat()
    : [];
  let candidato;
  do {
    candidato = generarCodigoPartida();
  } while (existentes.indexOf(candidato) !== -1);
  return candidato;
}

function unirsePartida(params) {
  const codigo = params.idPartida;
  const jugadorId = params.jugadorId || 'jugador_2';
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i += 1) {
    const fila = datos[i];
    if (fila[0] === codigo) {
      if (fila[2]) {
        return { ok: false, error: 'La partida ya tiene dos jugadores' };
      }
      hoja.getRange(i + 1, 3).setValue(jugadorId);
      hoja.getRange(i + 1, 5).setValue('En Curso');
      hoja.getRange(i + 1, 4).setValue(1);
      return { ok: true, idPartida: codigo, jugador1: fila[1], jugador2: jugadorId, estado: 'En Curso', turnoDe: 1 };
    }
  }

  return { ok: false, error: 'Partida no encontrada' };
}

function guardarTablero(params) {
  const codigo = params.idPartida;
  const jugador = Number(params.jugador);
  const barcos = params.posicionBarcos;
  const hoja = obtenerHoja(HOJA_TABLEROS);
  const datos = hoja.getDataRange().getValues();
  const payload = JSON.stringify(barcos);

  for (let i = 1; i < datos.length; i += 1) {
    const fila = datos[i];
    if (fila[0] === codigo && Number(fila[1]) === jugador) {
      hoja.getRange(i + 1, 3).setValue(payload);
      return { ok: true, actualizado: true };
    }
  }

  hoja.appendRow([codigo, jugador, payload, '[]']);
  return { ok: true, creado: true };
}

function enviarDisparo(params) {
  const codigo = params.idPartida;
  const jugador = Number(params.jugador);
  const coordenada = params.coordenada;
  const hojaPartidas = obtenerHoja(HOJA_PARTIDAS);
  const hojaTableros = obtenerHoja(HOJA_TABLEROS);
  const partida = buscarFilaPartida(hojaPartidas, codigo);

  if (!partida) {
    return { ok: false, error: 'Partida no encontrada' };
  }

  const rival = jugador === 1 ? 2 : 1;
  const tableroRival = buscarFilaTablero(hojaTableros, codigo, rival);
  const tableroPropio = buscarFilaTablero(hojaTableros, codigo, jugador);

  if (!tableroRival) {
    return { ok: false, error: 'Tablero del rival no encontrado' };
  }

  const barcosRival = JSON.parse(tableroRival.datos[2] || '[]');
  const disparosPropios = JSON.parse(tableroPropio ? tableroPropio.datos[3] || '[]' : '[]');

  disparosPropios.push({ coordenada, resultado: 'pendiente' });
  const resultado = comprobarImpacto(barcosRival, coordenada, disparosPropios);
  disparosPropios[disparosPropios.length - 1].resultado = resultado;

  if (tableroPropio) {
    hojaTableros.getRange(tableroPropio.fila, 4).setValue(JSON.stringify(disparosPropios));
  } else {
    hojaTableros.appendRow([codigo, jugador, '[]', JSON.stringify(disparosPropios)]);
  }

  const filaPartida = partida.fila;
  hojaPartidas.getRange(filaPartida, 4).setValue(rival);

  return { ok: true, resultado };
}

function consultarEstado(params) {
  const codigo = params.idPartida;
  const jugador = Number(params.jugador);
  const hojaPartidas = obtenerHoja(HOJA_PARTIDAS);
  const hojaTableros = obtenerHoja(HOJA_TABLEROS);
  const partida = buscarFilaPartida(hojaPartidas, codigo);

  if (!partida) {
    return { ok: false, error: 'Partida no encontrada' };
  }

  const tableroRival = buscarFilaTablero(hojaTableros, codigo, jugador === 1 ? 2 : 1);
  const tableroPropio = buscarFilaTablero(hojaTableros, codigo, jugador);
  const estado = {
    ok: true,
    turnoDe: Number(partida.filaDatos[3]),
    estadoPartida: partida.filaDatos[4],
    misDisparos: tableroPropio ? JSON.parse(tableroPropio.datos[3] || '[]') : [],
    disparosRival: tableroRival ? JSON.parse(tableroRival.datos[3] || '[]') : [],
  };
  return estado;
}

function buscarFilaPartida(hoja, codigo) {
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i += 1) {
    if (datos[i][0] === codigo) {
      return { fila: i + 1, filaDatos: datos[i] };
    }
  }
  return null;
}

function buscarFilaTablero(hoja, codigo, jugador) {
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i += 1) {
    if (datos[i][0] === codigo && Number(datos[i][1]) === jugador) {
      return { fila: i + 1, datos: datos[i] };
    }
  }
  return null;
}

function comprobarImpacto(barcos, coordenada, disparos) {
  const celda = coordenada;
  const disparosAcertados = disparos.filter((item) => item.resultado !== 'fallo').map((item) => item.coordenada);
  let barcoEncontrado = null;

  for (let i = 0; i < barcos.length; i += 1) {
    const barco = barcos[i];
    if (barco.coordenadas.includes(celda)) {
      barcoEncontrado = barco;
      break;
    }
  }

  if (!barcoEncontrado) {
    return 'fallo';
  }

  const impactosEnBarco = barcoEncontrado.coordenadas.filter((coord) => disparosAcertados.includes(coord));
  if (impactosEnBarco.length >= barcoEncontrado.coordenadas.length) {
    return 'hundido';
  }

  return 'tocado';
}
