// Activar Polyfill para móviles (configuración simplificada)
MobileDragDrop.polyfill({
  // Mantiene presionado 200ms para iniciar el arrastre (evita conflictos con clics normales)
  holdToDrag: 200 
});

// Evitar comportamientos de scroll no deseados en móviles durante el arrastre
window.addEventListener('touchmove', function() {}, { passive: false });

// ... aquí sigue el resto de tu código (const API_URL = ... etc)
const API_URL = 'https://script.google.com/macros/s/AKfycbzEcW9ek3xWralEFrfSyPir1vgnMVBHa9Xo3MmEydHrs3dD4jnYDGErv34QW_eJSBzi/exec';

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
const errorUnirse = document.getElementById('error-unirse');
const inputCodigo = document.getElementById('codigo-partida');
const displayId = document.getElementById('display-id-partida');
let orientacionArrastrable = 'horizontal';

const barcosDisponibles = [
  { id: 'portaaviones', tamaño: 4, disponibles: 1, colocados: 0, label: '4 casillas' },
  { id: 'acorazado', tamaño: 3, disponibles: 2, colocados: 0, label: '3 casillas' },
  { id: 'fragata', tamaño: 2, disponibles: 3, colocados: 0, label: '2 casillas' },
  { id: 'caza', tamaño: 1, disponibles: 4, colocados: 0, label: '1 casilla' },
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
let barcosColocados = []; // Rastrea barcos colocados: {tipo, posiciones: [[fila, col], ...]}

function mostrarPantalla(nombre) {
  Object.values(pantallas).forEach((pantalla) => pantalla.classList.remove('activa'));
  pantallas[nombre].classList.add('activa');
}

// Sustituye tu función crearTablero actual por esta:
function crearTablero(contenedor, matriz, conEtiquetas = false, esRadar = false) {
        if (displayId && idPartida) {
          displayId.textContent = ` (Cód. partida: ${idPartida})`;
        }
  contenedor.innerHTML = '';
  for (let fila = 0; fila < 10; fila += 1) {
    for (let columna = 0; columna < 10; columna += 1) {
      const celda = document.createElement('div');
      const valor = matriz[fila][columna];
      celda.className = `celda ${valor}`; // Clase celda
      celda.dataset.coordenada = `${fila}-${columna}`; // Coordenada de la celda

      // Si la celda contiene un barco y no es el radar
      if (valor === 'barco' && !esRadar) {
        const barco = obtenerBarcoEnPosicion(fila, columna); // Barco en esta posición
        let contenido = '';
        if (barco) {
          const posiciones = barco.posiciones; // Posiciones del barco
          const indice = posiciones.findIndex(([r, c]) => r === fila && c === columna); // Índice de esta celda
          const longitud = posiciones.length; // Longitud total del barco
          let emoji = '';
          let flip = false;

          if (longitud === 1) emoji = '🚢';
          else if (indice === 0) emoji = '🚢';
          else if (indice === longitud - 1) { emoji = '🚢'; flip = true; }
          else if (longitud >= 3) emoji = '↔️'; // Emoji para celdas centrales

          if (emoji) {
            contenido = `<span class="emoji${flip ? ' flip' : ''}">${emoji}</span>`; // Añadimos emoji
          }
        }
        celda.innerHTML = contenido;
      } else {
        if (conEtiquetas) {
          //celda.textContent = String.fromCharCode(65 + fila) + (columna + 1); // Etiquetas para radar o flota
        }
      }

      if (contenedor === tableroPreparacion) {
        
        // EVENT LISTENER: Al hacer clic (para remover barcos)
        celda.addEventListener('click', () => handlePreparacionClick(fila, columna));

        // EVENT LISTENER: Al arrastrar un barco sobre la celda
        celda.addEventListener('dragover', (e) => {
          e.preventDefault(); // Permitir el drop
          if (!barcoSeleccionado) return; // Si no hay barco seleccionado, no hacemos nada
          
          // feedback visual de drop válido/inválido
          const coordenadasPotential = obtenerCoordenadasBarco(fila, columna, barcoSeleccionado.tamaño, orientacionArrastrable); // Coordenadas potenciales
          if (!coordenadasPotential) return; // Si no hay coordenadas, no hacemos nada
          
          // Verificamos si la posición es válida
          const esValido = coordenadasPotential.every(([r, c]) => miTablero[r][c] === 'agua'); // Comprobamos si hay agua
          
          if (esValido) {
            celda.classList.add('hover-drop'); // Clase CSS drop válido
            celda.classList.remove('hover-drop-invalid'); // Clase CSS drop inválido
          } else {
            celda.classList.remove('hover-drop'); // Clase CSS drop válido
            celda.classList.add('hover-drop-invalid'); // Clase CSS drop inválido
          }
        });

        // EVENT LISTENER: Al dejar de arrastrar sobre la celda
        celda.addEventListener('dragleave', () => {
          celda.classList.remove('hover-drop', 'hover-drop-invalid'); // Quitamos feedback visual
        });

        // EVENT LISTENER: Al soltar el barco sobre la celda
        celda.addEventListener('drop', (e) => {
          e.preventDefault(); // Permitir el drop
          celda.classList.remove('hover-drop', 'hover-drop-invalid'); // Quitamos feedback visual

          if (!barcoSeleccionado) return; // Si no hay barco seleccionado, no hacemos nada
          
          // Intentamos colocar el barco
          const colocacionCorrecta = colocarBarco(fila, columna, barcoSeleccionado.tamaño, orientacionArrastrable, barcoSeleccionado.id); // Colocamos barco
          
          if (colocacionCorrecta) {
            barcoSeleccionado.colocados += 1; // Incrementamos contador de barcos colocados
            
            // Si el barco ya se ha colocado completamente
            if (barcoSeleccionado.colocados >= barcoSeleccionado.disponibles) {
              if (todosLosBarcosSonColocados()) {
                barcoSeleccionado = null; // Barcos colocados
                infoColocacion.textContent = 'Adelante, vamos al ataque.'; // Info colocación
                actualizarTituloBarcos(); // Actualizar título barcos
              } else {
                barcoSeleccionado = null; // Limpiamos barcoSeleccionado
                infoColocacion.textContent = 'Barco colocado. Elige otro barco.'; // Info colocación
              }
            } else {
              infoColocacion.textContent = 'Barco colocado. Coloca otro del mismo tipo o elige otro.'; // Info colocación
            }
            
            renderListaBarcos(); // Volvemos a renderizar la lista de barcos
            renderTableros(); // Volvemos a renderizar el tablero
          } else {
            infoColocacion.textContent = 'No se puede colocar el barco ahí. Verifica el espacio y evita solapamientos.'; // Info colocación
          }
        });
      }

      if (esRadar) {
        celda.addEventListener('click', () => handleRadarClick(fila, columna)); // Clic para radar
      }

      contenedor.appendChild(celda); // Añadimos celda al contenedor
    }
  }
}

// Sustituye tu función renderListaBarcos actual por esta:
function renderListaBarcos() {
  listaBarcosDiv.innerHTML = ''; // Limpiamos contenedor
  
  barcosDisponibles.forEach((barco) => {
    const isPlaced = barco.colocados >= barco.disponibles; // Barco ya colocado
    if (isPlaced) return; // Si ya está colocado, no lo renderizamos en la lista

    // Contenedor para el gráfico y la etiqueta
    const itemContainer = document.createElement('div');
    itemContainer.className = 'barco-item-container'; // Nueva clase para flexbox

    // El gráfico del barco
    const shipGraphic = createShipGraphic(barco.tamaño, orientacionArrastrable, barco.id);
    
    // Label de información
    const label = document.createElement('div');
    label.className = 'barco-item-label';
    label.textContent = `${barco.label} — disponibles: ${barco.disponibles - barco.colocados}`;

    itemContainer.appendChild(shipGraphic); // Añadimos gráfico
    itemContainer.appendChild(label); // Añadimos etiqueta
    
    listaBarcosDiv.appendChild(itemContainer); // Añadimos al contenedor principal
  });
}

// NUEVA FUNCIÓN: Crea el gráfico arrastrable de un barco
function createShipGraphic(size, orientation, shipId) {
  const graphic = document.createElement('div');
  graphic.className = `barco-grafico ${orientation}`; // Clases barco-grafico y orientación
  graphic.draggable = true; // Hacemos el elemento arrastrable
  graphic.dataset.tipo = shipId; // Almacenamos el ID de la tipología del barco
  graphic.dataset.tamaño = size; // Almacenamos el tamaño del barco
  
  // Establecer dimensiones para asegurar que el gráfico tenga el tamaño correcto
  const celdaWidth = 32; // Ancho fijo por celda gráfica
  const celdaGap = 1; // Gap fino por celda gráfica
  const totalCeldasSize = size * celdaWidth + (size - 1) * celdaGap; // Tamaño total de las celdas gráficas
  
  if (orientation === 'horizontal') {
    graphic.style.width = `${totalCeldasSize}px`; // Ancho total para horizontal
    graphic.style.height = `${celdaWidth}px`; // Alto total para horizontal
  } else {
    graphic.style.width = `${celdaWidth}px`; // Ancho total para vertical
    graphic.style.height = `${totalCeldasSize}px`; // Alto total para vertical
  }

  // Creamos cada celda gráfica del barco
  for (let i = 0; i < size; i++) {
    const celda = document.createElement('div');
    celda.className = 'barco-grafico-celda'; // Clase barco-grafico-celda
    celda.dataset.offset = i; // Guardamos el offset de la celda gráfica
    
    // Añadimos emojis idénticos (🚢)
    let emoji = '';
    let flip = false;
    
    if (size === 1) emoji = '🚢';
    else if (i === 0) emoji = '🚢';
    else if (i === size - 1) { emoji = '🚢'; flip = true; }
    else if (size >= 3) emoji = '↔️'; // Emoji para celdas centrales

    if (emoji) {
      celda.innerHTML = `<span class="emoji${flip ? ' flip' : ''}">${emoji}</span>`; // Añadimos emoji
    }
    
    graphic.appendChild(celda); // Añadimos celda gráfica
  }

  // EVENT LISTENER: Al iniciar el arrastre
  graphic.addEventListener('dragstart', (e) => {
    graphic.classList.add('dragging'); // Clase CSS dragging
    // Guardamos los datos críticos para el drop en el DataTransfer
    e.dataTransfer.setData('text/plain', shipId); // ID del barco
    e.dataTransfer.setData('tamaño', size); // Tamaño del barco
    e.dataTransfer.effectAllowed = 'move'; // Indicamos que es un movimiento
    barcoSeleccionado = barcosDisponibles.find(b => b.id === shipId); // Establecemos barcoSeleccionado
  });

  // EVENT LISTENER: Al terminar el arrastre
  graphic.addEventListener('dragend', () => {
    graphic.classList.remove('dragging'); // Quitamos clase CSS dragging
    barcoSeleccionado = null; // Limpiamos barcoSeleccionado
  });

  return graphic;
}

function seleccionarBarco(id) {
  const barco = barcosDisponibles.find((item) => item.id === id);
  if (!barco || barco.colocados >= barco.disponibles) {
    return;
  }

  if (barcoSeleccionado && barcoSeleccionado.id === barco.id) {
    alternarOrientacion();
    infoColocacion.textContent = `Rotado a ${orientacion}. Coloca un barco de ${barco.tamaño} casillas.`;
  } else {
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

// Sustituye tu función alternarOrientacion actual por esta:
function alternarOrientacion() {
  orientacion = orientacion === 'horizontal' ? 'vertical' : 'horizontal'; // Alternamos orientación
  btnOrientacion.textContent = `Orientación: ${orientacion.charAt(0).toUpperCase() + orientacion.slice(1)}`; // Actualizamos botón
  orientacionArrastrable = orientacion; // Sincronizamos la nueva orientación para los barcos gráficos
  renderListaBarcos(); // Volvemos a renderizar los gráficos de los barcos con la nueva orientación
}

function actualizarTituloBarcos() {
  const titulo = document.getElementById('titulo-lista-barcos');
  if (titulo) {
    titulo.textContent = 'Flota colocada';
  }
}

function handlePreparacionClick(fila, columna) {
  // Primero verificar si hay un barco colocado en esa posición para removerlo
  if (miTablero[fila][columna] === 'barco') {
    if (removerBarcoDelTablero(fila, columna)) { // Removemos barco
      infoColocacion.textContent = 'Barco removido. Vuelve a colocarlo o elige otro.'; 
      renderListaBarcos(); 
      renderTableros(); 
      return;
    }
  }
  
  // Con el sistema Drag & Drop, no hacemos nada más al hacer clic.
  // Toda la lógica antigua de colocación se ha eliminado.
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

function colocarBarco(fila, columna, tamaño, orientacion, tipo) {
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
  
  // Registrar barco colocado
  barcosColocados.push({ tipo, posiciones: coordenadas });
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

function obtenerBarcoEnPosicion(fila, columna) {
  // Busca qué barco está en esa posición
  return barcosColocados.find((barco) =>
    barco.posiciones.some(([r, c]) => r === fila && c === columna)
  );
}

function removerBarcoDelTablero(fila, columna) {
  // Encuentra el barco en esa posición y lo remueve
  const barcoEnPosicion = obtenerBarcoEnPosicion(fila, columna);
  if (!barcoEnPosicion) {
    return false;
  }

  // Limpiar el tablero
  barcoEnPosicion.posiciones.forEach(([r, c]) => {
    miTablero[r][c] = 'agua';
  });

  // Remover del registro de barcosColocados
  const indice = barcosColocados.indexOf(barcoEnPosicion);
  if (indice > -1) {
    barcosColocados.splice(indice, 1);
  }

  // Restaurar el contador de barcosDisponibles
  const barco = barcosDisponibles.find((b) => b.id === barcoEnPosicion.tipo);
  if (barco) {
    barco.colocados -= 1;
  }

  return true;
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
      const barcohundido = obtenerBarcoEnPosicion(fila, columna);
      barcohundido?.posiciones.forEach(([r, c]) => {
        miRadar[r][c] = 'hundido';
      }); 
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
      const barcohundido = obtenerBarcoEnPosicion(fila, columna);
      barcohundido?.posiciones.forEach(([r, c]) => {
        miTablero[r][c] = 'hundido';
      });
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
  if (comprobarFinDePartida()) {
    return; 
  }
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
  if (comprobarFinDePartida()) {
    return;
  }
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

const TOTAL_CELDAS_BARCOS = 20;

function comprobarFinDePartida() {
  let misAciertos = 0;
  let aciertosRival = 0;

    for (let f = 0; f < 10; f += 1) {
    for (let c = 0; c < 10; c += 1) {
      if (miRadar[f][c] === 'tocado' || miRadar[f][c] === 'hundido') misAciertos += 1;
      if (miTablero[f][c] === 'tocado' || miTablero[f][c] === 'hundido') aciertosRival += 1;
    }
  }

    if (misAciertos >= TOTAL_CELDAS_BARCOS) {
    estadoTurno.textContent = '¡FIN DE LA BATALLA, HAS GANADO! 🏆';
    estadoTurno.style.backgroundColor = 'rgba(46, 204, 113, 0.3)'; // Fondo verde suave
    stopPolling();
    miTurno = false; // Bloquea futuros clics
    return true;
  }

  if (aciertosRival >= TOTAL_CELDAS_BARCOS) {
    estadoTurno.textContent = 'FIN DE LA BATALLA, HAS SIDO VENCIDO 💥';
    estadoTurno.style.backgroundColor = 'rgba(216, 79, 79, 0.3)'; // Fondo rojo suave
    stopPolling();
    miTurno = false;
    return true;
  }

  return false;
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
    if (displayId && idPartida) {
    displayId.textContent = ` (Cód. partida: ${idPartida})`;
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
  if (errorUnirse) { // NUEVO: Limpiamos también el error de unirse
    errorUnirse.textContent = '';
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

/*
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

*/


function extraerBarcosDeTablero() {
  return barcosColocados.map((barco) => ({
     tipo: barco.posiciones.length,
     coordenadas: barco.posiciones.map(([r, c]) => `${r}-${c}`)
  }));
}



/*
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

*/

/**
 * Envuelve un tablero existente con ejes de coordenadas tradicionales (A-J, 1-10)
 * @param {string} idTablero - El ID del elemento HTML del tablero
 */
function agregarEjesCoordenadasTradicionales(idTablero) {
  const tablero = document.getElementById(idTablero);
  // Si el tablero no existe o ya ha sido envuelto previamente, salimos para evitar duplicados
  if (!tablero || tablero.parentElement.classList.contains('tablero-con-ejes')) return;

  // 1. Crear el contenedor maestro
  const wrapper = document.createElement('div');
  wrapper.className = 'tablero-con-ejes';

  // 2. Crear Eje X (Letras A-J para las Columnas)
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const ejeX = document.createElement('div');
  ejeX.className = 'eje-x';
  for (let i = 0; i < 10; i++) {
    const letraDiv = document.createElement('div');
    letraDiv.textContent = letras[i]; 
    ejeX.appendChild(letraDiv);
  }

  // 3. Crear Eje Y (Números 1-10 para las Filas)
  const ejeY = document.createElement('div');
  ejeY.className = 'eje-y';
  for (let i = 1; i <= 10; i++) {
    const numeroDiv = document.createElement('div');
    numeroDiv.textContent = i;
    ejeY.appendChild(numeroDiv);
  }

  // 4. Reestructurar el árbol HTML (Envolver el tablero sin alterar sus celdas)
  tablero.parentNode.insertBefore(wrapper, tablero);
  wrapper.appendChild(ejeX);
  wrapper.appendChild(ejeY);
  wrapper.appendChild(tablero); // Al mover el tablero aquí, sus celdas internas se quedan intactas
}

// Añadir ejes a los tableros de la interfaz
agregarEjesCoordenadasTradicionales('tablero-preparacion');
agregarEjesCoordenadasTradicionales('tablero-radar');
agregarEjesCoordenadasTradicionales('tablero-flota');

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
  }
  
  const resultado = await unirsePartidaApi(codigo || null, validacion.nombre);
  if (resultado.ok) {
    mostrarPantalla('preparacion');
  } else {
        if (errorUnirse) {
      errorUnirse.textContent = resultado.error || 'Error al intentar unirse a la partida.';
    }
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

// ELIMINAR O COMENTAR estas líneas al final de script.js
// // Preseleccionar el primer barco disponible
// barcoSeleccionado = barcosDisponibles[0];
// infoColocacion.textContent = `Coloca un barco de ${barcoSeleccionado.tamaño} casillas.`;
// renderListaBarcos();
