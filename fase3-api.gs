const SPREADSHEET_ID = '1YLqkwchHDlx2Oy4g1F_3ggrPV4CjeGtB_cESAdDLf-w';
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
    case 'buscarPartidaActiva':
      response = buscarPartidaActiva(params);
      break;
    case 'crearPartida':
      response = crearPartida(params);
      break;
    case 'verificarPartidaExistente':
      response = verificarPartidaExistente(params);
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
  const nombreJugador = params.playerName || 'Jugador';
  const jugadorId = `${nombreJugador}`;
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const codigo = generarCodigoUnico(hoja);
  hoja.appendRow([codigo, jugadorId, '', 1, 'Esperando']);
  return { ok: true, idPartida: codigo, miJugador: 1, turnoDe: 1, estado: 'Esperando' };
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

function verificarPartidaExistente(params) {
  const codigoPartida = params.idPartida;
  const nombreJugador = params.playerName;
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const datos = hoja.getDataRange().getValues();

  // Buscar la partida con ese código
  for (let i = 1; i < datos.length; i += 1) {
    const fila = datos[i];
    if (fila[0] === codigoPartida) {
      // Verificar si el jugador existe como jugador 1 o jugador 2
      // Comparar por nombre (considerando formato "jugador_[nombre]_[timestamp]")
      const jugador1Id = String(fila[1]);
      const jugador2Id = String(fila[2]);
      
      // Extraer nombre de los IDs
      const extraerNombre = (id) => {
        const partes = id.split('_');
        if (partes.length >= 2) {
          return partes[1]; // Retorna el nombre extraído
        }
        return id;
      };
      
      const nombre1 = extraerNombre(jugador1Id);
      const nombre2 = extraerNombre(jugador2Id);
      
      // Si el jugador 1 coincide
      if (nombre1 === nombreJugador) {
        return { ok: true, idPartida: codigoPartida, miJugador: 1, estado: fila[4] };
      }
      
      // Si el jugador 2 coincide
      if (nombre2 === nombreJugador) {
        return { ok: true, idPartida: codigoPartida, miJugador: 2, estado: fila[4] };
      }
      
      // Si la partida existe pero el jugador no está en ella
      return { ok: false, error: 'Este nombre no está registrado en esa partida' };
    }
  }
  
  return { ok: false, error: 'Partida no encontrada' };
}

function extraerNombreDeJugadorId(jugadorId) {
  const partes = String(jugadorId).split('_');
  return partes.length >= 2 ? partes[1] : String(jugadorId);
}

function unirsePartida(params) {
  const codigoEspecifico = params.idPartida;
  const nombreJugador = params.playerName || 'Jugador';
  const jugadorId = `${nombreJugador}`;
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const datos = hoja.getDataRange().getValues();

  // 1. Si se proporciona un código específico, buscar esa partida concreta
  if (codigoEspecifico) {
    for (let i = 1; i < datos.length; i += 1) {
      const fila = datos[i];
      if (fila[0] === codigoEspecifico) {
        const nombre1 = fila[1] ? extraerNombreDeJugadorId(fila[1]) : '';
        const nombre2 = fila[2] ? extraerNombreDeJugadorId(fila[2]) : '';
        
        if (nombre1 === nombreJugador || nombre2 === nombreJugador) {
          return { ok: false, error: 'No se permite el mismo nombre para los dos jugadores en una partida' };
        }
        
        // Si el hueco de Jugador 2 está vacío, entra como Jugador 2
        if (fila[1] && (!fila[2] || String(fila[2]).trim() === '')) {
          hoja.getRange(i + 1, 3).setValue(jugadorId);
          hoja.getRange(i + 1, 5).setValue('En Curso');
          hoja.getRange(i + 1, 4).setValue(1);
          return { ok: true, idPartida: codigoEspecifico, miJugador: 2, jugador1: fila[1], jugador2: jugadorId, estado: 'En Curso', turnoDe: 1 };
        }
        
        // Si el hueco de Jugador 1 está vacío, entra como Jugador 1
        if (fila[2] && (!fila[1] || String(fila[1]).trim() === '')) {
          hoja.getRange(i + 1, 2).setValue(jugadorId);
          hoja.getRange(i + 1, 5).setValue('En Curso');
          hoja.getRange(i + 1, 4).setValue(1);
          return { ok: true, idPartida: codigoEspecifico, miJugador: 1, jugador1: jugadorId, jugador2: fila[2], estado: 'En Curso', turnoDe: 1 };
        }
        
        return { ok: false, error: 'La partida ya tiene dos jugadores' };
      }
    }
    return { ok: false, error: 'Partida no encontrada' };
  }

  // 2. BÚSQUEDA AUTOMÁTICA: Buscar la partida más antigua en estado 'Esperando' comprobando ambos campos
  for (let i = 1; i < datos.length; i += 1) {
    const fila = datos[i];
    
    if (fila[4] === 'Esperando') {
      const jugador1 = fila[1];
      const jugador2 = fila[2];
      const nombre1 = jugador1 ? extraerNombreDeJugadorId(jugador1) : '';
      const nombre2 = jugador2 ? extraerNombreDeJugadorId(jugador2) : '';

      // CASO A: Está el Jugador 1 pero el puesto de Jugador 2 está libre
      if (jugador1 && String(jugador1).trim() !== '' && (!jugador2 || String(jugador2).trim() === '')) {
        if (nombre1 === nombreJugador) {
          continue; // Evita unirse a su propia partida creada
        }
        const codigo = fila[0];
        hoja.getRange(i + 1, 3).setValue(jugadorId); // Columna 3 (C) es Jugador 2
        hoja.getRange(i + 1, 5).setValue('En Curso');
        hoja.getRange(i + 1, 4).setValue(1); // Asignar turno al jugador 1 por defecto
        return { ok: true, idPartida: codigo, miJugador: 2, jugador1: jugador1, jugador2: jugadorId, estado: 'En Curso', turnoDe: 1 };
      }

      // CASO B: Está el Jugador 2 pero el puesto de Jugador 1 está libre
      if (jugador2 && String(jugador2).trim() !== '' && (!jugador1 || String(jugador1).trim() === '')) {
        if (nombre2 === nombreJugador) {
          continue; // Evita unirse a su propia partida
        }
        const codigo = fila[0];
        hoja.getRange(i + 1, 2).setValue(jugadorId); // Columna 2 (B) es Jugador 1
        hoja.getRange(i + 1, 5).setValue('En Curso');
        hoja.getRange(i + 1, 4).setValue(1); // Asignar turno al jugador 1 (el nuevo jugador)
        return { ok: true, idPartida: codigo, miJugador: 1, jugador1: jugadorId, jugador2: jugador2, estado: 'En Curso', turnoDe: 1 };
      }
    }
  }

  return { ok: false, error: 'No hay partidas abiertas disponibles' };
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

  // 1. Añadimos el disparo actual temporalmente como pendiente
  disparosPropios.push({ coordenada, resultado: 'pendiente' });
  
  // 2. Comprobamos el impacto (ahora devuelve un objeto)
  const analisis = comprobarImpacto(barcosRival, coordenada, disparosPropios);
  const resultado = analisis.resultado;

  // 3. Actualizamos todos los disparos de este barco si se ha hundido
  if (resultado === 'hundido' && analisis.coordenadasBarco) {
    disparosPropios.forEach((disparo) => {
      if (analisis.coordenadasBarco.includes(disparo.coordenada)) {
        disparo.resultado = 'hundido';
      }
    });
  } else {
    // Si es tocado o fallo, solo actualizamos el último disparo
    disparosPropios[disparosPropios.length - 1].resultado = resultado;
  }

  // 4. Guardado en la base de datos de Sheets
  if (tableroPropio) {
    hojaTableros.getRange(tableroPropio.fila, 4).setValue(JSON.stringify(disparosPropios));
  } else {
    hojaTableros.appendRow([codigo, jugador, '[]', JSON.stringify(disparosPropios)]);
  }
  
  const partidaFinalizada = verificarDerrota(tableroRival.datos[2], JSON.stringify(disparosPropios));
  
  const filaPartida = partida.fila;
  if (partidaFinalizada) {
    // Si el rival ha perdido, cambiamos el 'Estado' (Columna 5) a Finalizada
    hojaPartidas.getRange(filaPartida, 5).setValue('Finalizada');
  } else {
    // Si la batalla sigue, guardamos con normalidad el cambio de turno (Columna 4)
    hojaPartidas.getRange(filaPartida, 4).setValue(rival);
  }

  // Retornamos el veredicto incluyendo una bandera explicativa útil para el front
  return { ok: true, resultado, finalizada: partidaFinalizada };
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
    listoParaBatalla: tableroListo(tableroPropio) && tableroListo(tableroRival),
    misDisparos: tableroPropio ? JSON.parse(tableroPropio.datos[3] || '[]') : [],
    disparosRival: tableroRival ? JSON.parse(tableroRival.datos[3] || '[]') : [],
    misBarcos: tableroPropio ? JSON.parse(tableroPropio.datos[2] || '[]') : []
  };
  return estado;
}

function tableroListo(tablero) {
  if (!tablero || !tablero.datos[2]) {
    return false;
  }
  try {
    const barcos = JSON.parse(tablero.datos[2] || '[]');
    return Array.isArray(barcos) && barcos.length > 0;
  } catch (error) {
    return false;
  }
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
    return { resultado: 'fallo', coordenadasBarco: null };
  }

  const impactosEnBarco = barcoEncontrado.coordenadas.filter((coord) => disparosAcertados.includes(coord));
  
  if (impactosEnBarco.length >= barcoEncontrado.coordenadas.length) {
    return { resultado: 'hundido', coordenadasBarco: barcoEncontrado.coordenadas };
  }

  return { resultado: 'tocado', coordenadasBarco: barcoEncontrado.coordenadas };
}

function verificarDerrota(jsonBarcos, jsonDisparos) {
  const barcos = JSON.parse(jsonBarcos || '[]');
  const disparos = JSON.parse(jsonDisparos || '[]');
  
  // Aplanamos todas las coordenadas de los barcos
  const todasCoordsBarcos = barcos.flatMap(b => b.coordenadas);
  
  // Filtramos solo los disparos que impactaron y hundieron
  const coordsHundidas = disparos
    .filter(d => d.resultado === 'hundido')
    .map(d => d.coordenada);
    
  // Si todas las coordenadas de barcos están en la lista de hundidas, el jugador perdió
  return todasCoordsBarcos.every(coord => coordsHundidas.includes(coord));
}

function buscarPartidaActiva(params) {
  const nombreJugador = params.playerName;
  const hoja = obtenerHoja(HOJA_PARTIDAS);
  const datos = hoja.getDataRange().getValues();

  for (let i = 0; i < datos.length; i += 1) {
    const fila = datos[i];
    const estado = fila[4];
    
    // Solo nos interesan partidas vivas
    if (estado === 'Esperando' || estado === 'En Curso') {
      const j1 = String(fila[1]);
      const j2 = String(fila[2]);
      
      if (j1 === nombreJugador) {
        return { ok: true, encontrado: true, idPartida: fila[0], miJugador: 1, estadoPartida: estado };
      }
      if (j2 === nombreJugador) {
        return { ok: true, encontrado: true, idPartida: fila[0], miJugador: 2, estadoPartida: estado };
      }
    }
  }
  return { ok: true, encontrado: false };
}