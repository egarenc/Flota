const API_URL = 'https://script.google.com/macros/s/AKfycbwuVSTX0DxzWtHT8ApiP9nNkgyz7on0jAFNU5aOcAjYqB_seB81LElmP4IPfNfhpwI/exec';

const pantallas = {
  inicio: document.getElementById('pantalla-inicio'),
  preparacion: document.getElementById('pantalla-preparacion'),
  batalla: document.getElementById('pantalla-batalla'),
};

const tableroPreparacion = document.getElementById('tablero-preparacion');
const tableroFlota = document.getElementById('tablero-flota');
const tableroRadar = document.getElementById('tablero-radar');
const btnCrear = document.getElementById('btn-crear');
const btnUnirse = document.getElementById('btn-unirse');
const btnListo = document.getElementById('btn-listo');
const btnOrientacion = document.getElementById('btn-orientacion');
const listaBarcosDiv = document.getElementById('lista-barcos-disponibles');
const infoColocacion = document.getElementById('informacion-colocacion');
const estadoTurno = document.getElementById('estado-turno');
const inputNombre = document.getElementById('nombre-jugador');
const errorNombre = document.getElementById('error-nombre');
const inputCodigo = document.getElementById('codigo-partida');

const barcosDisponibles = [
  { id: 'portaaviones', tamaño: 4, disponibles: 1, colocados: 0, label: '1 x 4 casillas' },
  { id: 'acorazado', tamaño: 3, disponibles: 2, colocados: 0, label: '2 x 3 casillas' },
  { id: 'fragata', tamaño: 2, disponibles: 3, colocados: 0, label: '3 x 2 casillas' },
  { id: 'caza', tamaño: 1, disponibles: 4, colocados: 0, label: '4 x 1 casilla' },
];

function todosLosBarcosSonColocados() {
  return barcosDisponibles.every((barco) => barco.colocados >= barco.disponibles);
}

let orientacion = 'horizontal';
let barcoSeleccionado = null;
let idPartida = null;
let miJugador = null;
let miNombre = '';
let miTurno = false;
let pollingId = null;
let disparosRivalPrevios = [];
let misDisparosPrevios = [];

const miTablero = Array.from({ length: 10 }, () => Array(10).fill('agua'));
const miRadar = Array.from({ length: 10 }, () => Array(10).fill('agua'));

function mostrarPantalla(nombre) {
  Object.values(pantallas).forEach((pantalla) => pantalla.classList.remove('activa'));
  pantallas[nombre].classList.add('activa');
}

function crearTablero(contenedor, matriz, conEtiquetas = false, esRadar = false) {
  contenedor.innerHTML = '';
  for (let fila = 0; fila < 10; fila += 1) {
    for (let columna = 0; columna < 10; columna += 1) {
      const celda = document.createElement('div');
      const valor = matriz[fila][columna];
      celda.className = `celda ${valor}`;
      celda.dataset.coordenada = `${fila}-${columna}`;

      if (conEtiquetas) {
        celda.textContent = String.fromCharCode(65 + fila) + (columna + 1);
      }

      if (contenedor === tableroPreparacion) {
        celda.addEventListener('click', () => handlePreparacionClick(fila, columna));
      }

      if (esRadar) {
        celda.addEventListener('click', () => handleRadarClick(fila, columna));
      }

      contenedor.appendChild(celda);
    }
  }
}

function renderListaBarcos() {
  listaBarcosDiv.innerHTML = '';
  barcosDisponibles.forEach((barco) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'barco-item';
    if (barcoSeleccionado && barcoSeleccionado.id === barco.id) {
      item.classList.add('seleccionado');
    }
    item.textContent = `${barco.label} — disponibles: ${barco.disponibles - barco.colocados}`;
    item.disabled = barco.colocados >= barco.disponibles;
    item.addEventListener('click', () => seleccionarBarco(barco.id));
    listaBarcosDiv.appendChild(item);
  });
}

function seleccionarBarco(id) {
  const barco = barcosDisponibles.find((item) => item.id === id);
  if (barco && barco.colocados < barco.disponibles) {
    barcoSeleccionado = barco;
    infoColocacion.textContent = `Coloca un barco de ${barco.tamaño} casillas.`;
  }
  renderListaBarcos();
}

function obtenerSiguienteBarcoDisponible(idActual) {
  const indiceActual = barcosDisponibles.findIndex((item) => item.id === idActual);
  for (let i = indiceActual + 1; i < barcosDisponibles.length; i += 1) {
    if (barcosDisponibles[i].colocados < barcosDisponibles[i].disponibles) {
      return barcosDisponibles[i];
    }
  }
  for (let i = 0; i <= indiceActual; i += 1) {
    if (barcosDisponibles[i].colocados < barcosDisponibles[i].disponibles) {
      return barcosDisponibles[i];
    }
  }
  return null;
}

function alternarOrientacion() {
  orientacion = orientacion === 'horizontal' ? 'vertical' : 'horizontal';
  btnOrientacion.textContent = `Orientación: ${orientacion.charAt(0).toUpperCase() + orientacion.slice(1)}`;
}

function actualizarTituloBarcos() {
  const titulo = document.getElementById('titulo-lista-barcos');
  if (titulo) {
    titulo.textContent = 'Flota colocada';
  }
}

function handlePreparacionClick(fila, columna) {
  if (!barcoSeleccionado) {
    infoColocacion.textContent = 'Selecciona primero un barco para colocar.';
    return;
  }

  if (colocarBarco(fila, columna, barcoSeleccionado.tamaño, orientacion)) {
    barcoSeleccionado.colocados += 1;
    if (barcoSeleccionado.colocados >= barcoSeleccionado.disponibles) {
      const idAnterior = barcoSeleccionado.id;
      const siguienteBarco = obtenerSiguienteBarcoDisponible(idAnterior);
      
      if (todosLosBarcosSonColocados()) {
        barcoSeleccionado = null;
        infoColocacion.textContent = 'Adelante, vamos al ataque.';
        actualizarTituloBarcos();
      } else if (siguienteBarco) {
        barcoSeleccionado = siguienteBarco;
        infoColocacion.textContent = `Barco colocado. Siguiente: ${siguienteBarco.label}. Coloca un barco de ${siguienteBarco.tamaño} casillas.`;
      } else {
        barcoSeleccionado = null;
        infoColocacion.textContent = 'Barco colocado. Elige otro barco.';
      }
    } else {
      infoColocacion.textContent = 'Barco colocado. Coloca otro del mismo tipo o elige otro.';
    }
  } else {
    infoColocacion.textContent = 'No se puede colocar el barco ahí. Verifica el espacio y evita solapamientos.';
  }

  renderListaBarcos();
  renderTableros();
}

function handleRadarClick(fila, columna) {
  if (!miTurno) {
    estadoTurno.textContent = 'No es tu turno. Espera al rival.';
    return;
  }
  if (miRadar[fila][columna] !== 'agua') {
    return;
  }
  enviarDisparoApi(fila, columna);
}

function colocarBarco(fila, columna, tamaño, orientacion) {
  const coordenadas = obtenerCoordenadasBarco(fila, columna, tamaño, orientacion);
  if (!coordenadas) {
    return false;
  }

  const puedeColocar = coordenadas.every(([r, c]) => miTablero[r][c] === 'agua');
  if (!puedeColocar) {
    return false;
  }

  coordenadas.forEach(([r, c]) => {
    miTablero[r][c] = 'barco';
  });
  return true;
}

function obtenerCoordenadasBarco(fila, columna, tamaño, orientacion) {
  const coordenadas = [];
  for (let i = 0; i < tamaño; i += 1) {
    const r = orientacion === 'horizontal' ? fila : fila + i;
    const c = orientacion === 'horizontal' ? columna + i : columna;
    if (r >= 10 || c >= 10) {
      return null;
    }
    coordenadas.push([r, c]);
  }
  return coordenadas;
}

function actualizarTurno(activo) {
  miTurno = activo;
  if (activo) {
    estadoTurno.textContent = 'Es tu turno. Dispara al radar.';
  } else {
    estadoTurno.textContent = 'Esperando turno del rival...';
  }
}

function aplicarDisparosEnTableros(misDisparos, disparosRival) {
  misDisparos.forEach((disparo) => {
    const [fila, columna] = disparo.coordenada.split('-').map(Number);
    if (disparo.resultado === 'fallo') {
      miRadar[fila][columna] = 'fallo';
    } else if (disparo.resultado === 'tocado') {
      miRadar[fila][columna] = 'tocado';
    } else if (disparo.resultado === 'hundido') {
      miRadar[fila][columna] = 'hundido';
    }
  });

  disparosRival.forEach((disparo) => {
    const [fila, columna] = disparo.coordenada.split('-').map(Number);
    if (disparo.resultado === 'fallo') {
      miTablero[fila][columna] = 'fallo';
    } else if (disparo.resultado === 'tocado') {
      miTablero[fila][columna] = 'tocado';
    } else if (disparo.resultado === 'hundido') {
      miTablero[fila][columna] = 'hundido';
    }
  });
}

async function enviarDisparoApi(fila, columna) {
  const coordenada = `${fila}-${columna}`;
  const resultado = await fetchApi('enviarDisparo', {
    idPartida,
    jugador: miJugador,
    coordenada,
  });

  if (!resultado.ok) {
    estadoTurno.textContent = resultado.error || 'Error enviando disparo.';
    return;
  }

  const { resultado: disparoResultado } = resultado;
  miRadar[fila][columna] = disparoResultado === 'hundido' ? 'hundido' : disparoResultado === 'tocado' ? 'tocado' : 'fallo';
  renderTableros();
  actualizarTurno(false);
  startPolling();
}

async function consultarEstadoApi() {
  if (!idPartida || !miJugador) {
    return;
  }
  const resultado = await fetchApi('consultarEstado', {
    idPartida,
    jugador: miJugador,
  });

  if (!resultado.ok) {
    estadoTurno.textContent = resultado.error || 'Error consultando estado.';
    return;
  }

  if (!resultado.listoParaBatalla && pantallas.preparacion.classList.contains('activa')) {
    infoColocacion.textContent = 'Esperando adversario...';
    if (!pollingId) {
      startPolling();
    }
    return;
  }

  if (resultado.listoParaBatalla && pantallas.preparacion.classList.contains('activa')) {
    mostrarPantalla('batalla');
    inicializarBatalla();
    return;
  }

  const nuevoTurno = Number(resultado.turnoDe) === miJugador;
  const misDisparos = resultado.misDisparos || [];
  const disparosRival = resultado.disparosRival || [];

  aplicarDisparosEnTableros(misDisparos, disparosRival);
  renderTableros();
  actualizarTurno(nuevoTurno);

  if (!nuevoTurno) {
    startPolling();
  } else {
    stopPolling();
  }
}

function startPolling() {
  if (pollingId) {
    return;
  }
  pollingId = setInterval(consultarEstadoApi, 3500);
}

function stopPolling() {
  if (pollingId) {
    clearInterval(pollingId);
    pollingId = null;
  }
}

function inicializarBatalla() {
  actualizarNombreBatalla();
  aplicarDisparosEnTableros(misDisparosPrevios, disparosRivalPrevios);
  renderTableros();
  consultarEstadoApi();
}

function actualizarNombreBatalla() {
  const nombreLabel = document.getElementById('nombre-jugador-batalla');
  if (nombreLabel) {
    nombreLabel.textContent = miNombre ? `Jugador: ${miNombre}` : '';
  }
}

function renderTableros() {
  crearTablero(tableroPreparacion, miTablero);
  crearTablero(tableroFlota, miTablero, true);
  crearTablero(tableroRadar, miRadar, true, true);
}

async function fetchApi(action, data) {
  if (!API_URL) {
    console.warn('API_URL no configurada. Usa la URL pública de Google Apps Script.');
    return { ok: false, error: 'API_URL no configurada' };
  }
  try {
    console.log(`[API] Enviando ${action}:`, data);
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data }),
    });
    const resultado = respuesta.ok ? await respuesta.json() : { ok: false, error: 'Error en la API' };
    console.log(`[API] Respuesta ${action}:`, resultado);
    return resultado;
  } catch (error) {
    console.error(`[API] Error en ${action}:`, error);
    return { ok: false, error: error.message };
  }
}

function validarNombreJugador() {
  const nombre = inputNombre.value.trim();
  const patron = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,15}$/;
  if (!nombre) {
    return { ok: false, error: 'Introduce un nombre de jugador.' };
  }
  if (!patron.test(nombre)) {
    return { ok: false, error: 'El nombre solo puede contener letras y debe tener hasta 15 caracteres.' };
  }
  return { ok: true, nombre };
}

function mostrarErrorInicio(mensaje) {
  if (errorNombre) {
    errorNombre.textContent = mensaje;
  }
}

function limpiarErrorInicio() {
  if (errorNombre) {
    errorNombre.textContent = '';
  }
}

async function crearPartidaApi(nombreJugador) {
  const resultado = await fetchApi('crearPartida', {
    playerName: nombreJugador,
  });
  if (resultado.ok) {
    idPartida = resultado.idPartida;
    miJugador = resultado.miJugador || 1;
    miNombre = nombreJugador;
    infoColocacion.textContent = `Partida creada: ${idPartida}. ${nombreJugador}, coloca tus barcos.`;
  }
  return resultado;
}

async function verificarPartidaExistenteApi(codigo, nombreJugador) {
  return fetchApi('verificarPartidaExistente', {
    idPartida: codigo,
    playerName: nombreJugador,
  });
}

async function unirsePartidaApi(codigo, nombreJugador) {
  const resultado = await fetchApi('unirsePartida', {
    idPartida: codigo,
    playerName: nombreJugador,
  });
  if (resultado.ok) {
    idPartida = resultado.idPartida;
    miJugador = resultado.miJugador || 2;
    miNombre = nombreJugador;
    infoColocacion.textContent = `Unido a la partida ${idPartida}. ${nombreJugador}, coloca tus barcos.`;
  }
  return resultado;
}

async function guardarTableroApi() {
  const barcos = extraerBarcosDeTablero();
  return fetchApi('guardarTablero', {
    idPartida,
    jugador: miJugador,
    posicionBarcos: barcos,
  });
}

function extraerBarcosDeTablero() {
  const barcos = [];
  const visited = Array.from({ length: 10 }, () => Array(10).fill(false));

  for (let fila = 0; fila < 10; fila += 1) {
    for (let columna = 0; columna < 10; columna += 1) {
      if (miTablero[fila][columna] !== 'barco' || visited[fila][columna]) {
        continue;
      }

      const barco = obtenerBarcoDesde(fila, columna, visited);
      if (barco) {
        barcos.push(barco);
      }
    }
  }
  return barcos;
}

function obtenerBarcoDesde(fila, columna, visited) {
  const coordenadas = [[fila, columna]];
  visited[fila][columna] = true;

  for (let offset = 1; offset < 10; offset += 1) {
    if (columna + offset < 10 && miTablero[fila][columna + offset] === 'barco') {
      coordenadas.push([fila, columna + offset]);
      visited[fila][columna + offset] = true;
      continue;
    }
    break;
  }

  if (coordenadas.length === 1) {
    for (let offset = 1; offset < 10; offset += 1) {
      if (fila + offset < 10 && miTablero[fila + offset][columna] === 'barco') {
        coordenadas.push([fila + offset, columna]);
        visited[fila + offset][columna] = true;
        continue;
      }
      break;
    }
  }

  return {
    tipo: coordenadas.length,
    coordenadas: coordenadas.map(([r, c]) => `${r}-${c}`),
  };
}

btnCrear.addEventListener('click', async () => {
  console.log('[UI] Botón Crear clickeado');
  limpiarErrorInicio();
  const validacion = validarNombreJugador();
  if (!validacion.ok) {
    mostrarErrorInicio(validacion.error);
    return;
  }
  const resultado = await crearPartidaApi(validacion.nombre);
  console.log('[UI] Resultado de crearPartidaApi:', resultado);
  if (resultado.ok) {
    console.log('[UI] Cambio a pantalla preparacion');
    mostrarPantalla('preparacion');
  } else {
    console.error('[UI] Error al crear partida:', resultado.error);
  }
});

btnUnirse.addEventListener('click', async () => {
  limpiarErrorInicio();
  const validacion = validarNombreJugador();
  if (!validacion.ok) {
    mostrarErrorInicio(validacion.error);
    return;
  }
  const codigo = inputCodigo.value.trim().toUpperCase();
  
  // Si hay código, primero verificar si el jugador ya existe en esa partida
  if (codigo) {
    const resultadoVerificacion = await verificarPartidaExistenteApi(codigo, validacion.nombre);
    if (resultadoVerificacion.ok) {
      idPartida = resultadoVerificacion.idPartida;
      miJugador = resultadoVerificacion.miJugador;
      miNombre = validacion.nombre;
      infoColocacion.textContent = `Reconectado a partida ${idPartida}. Bienvenido ${validacion.nombre}.`;
      // Cargar estado actual de la partida
      mostrarPantalla('preparacion');
      consultarEstadoApi();
      return;
    }
    // Si no existe, intentar unirse como nuevo jugador
  }
  
  const resultado = await unirsePartidaApi(codigo || null, validacion.nombre);
  if (resultado.ok) {
    mostrarPantalla('preparacion');
  } else {
    infoColocacion.textContent = resultado.error || 'Error al unirse.';
  }
});

btnListo.addEventListener('click', async () => {
  if (!barcosDisponibles.every((barco) => barco.colocados >= barco.disponibles)) {
    infoColocacion.textContent = 'Debes colocar todos los barcos antes de continuar.';
    return;
  }

  const resultado = await guardarTableroApi();
  if (resultado.ok) {
    infoColocacion.textContent = 'Esperando adversario...';
    startPolling();
  } else {
    infoColocacion.textContent = resultado.error || 'No se pudo guardar el tablero.';
  }
});

btnOrientacion.addEventListener('click', alternarOrientacion);

renderListaBarcos();
renderTableros();
