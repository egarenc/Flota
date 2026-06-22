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
const btnJugar = document.getElementById('btn-jugar');
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
        const barco = obtenerBarcoEnPosicion(fila, columna); 
        let contenido = '';
        if (barco && !esRadar) {
        const posiciones = barco.posiciones; 
        const indice = posiciones.findIndex(([r, c]) => r === fila && c === columna); 
        const longitud = posiciones.length; 
        
        let tipoParte = 'medio';
        if (longitud === 1) tipoParte = 'unico';
        else if (indice === 0) tipoParte = 'popa';
        else if (indice === longitud - 1) tipoParte = 'proa';

        let esVertical = false;
        if (longitud > 1) { esVertical = posiciones[0][1] === posiciones[1][1]; }
        const claseOrientacion = esVertical ? 'barco-vertical' : 'barco-horizontal';

        // Le añadimos position: absolute y z-index: 1 para que sea la capa base
        contenido += `<div class="contenedor-svg-barco ${claseOrientacion}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; z-index: 1;">
                       ${obtenerSvgBarco(tipoParte)}
                     </div>`;
      }

      // CAPA 2: EFECTOS VISUALES (Se dibujan encima si la celda ha recibido disparo)
      if (valor === 'fallo') {
        contenido += obtenerSvgSalpicadura();
      } else if (valor === 'tocado') {
        contenido += obtenerSvgExplosion(false);
      } else if (valor === 'hundido') {
        contenido += obtenerSvgExplosion(true);
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
    celda.className = 'barco-grafico-celda'; 
    celda.dataset.offset = i; 
    
    // Determinamos qué segmento inyectar en la lista lateral
    let tipoParte = 'medio';
    if (size === 1) tipoParte = 'unico';
    else if (i === 0) tipoParte = 'popa';
    else if (i === size - 1) tipoParte = 'proa';

    celda.innerHTML = `<div class="contenedor-svg-barco" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                         ${obtenerSvgBarco(tipoParte)}
                       </div>`;
    
    graphic.appendChild(celda); 
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
// =========================================================
// FUNCIÓN AUXILIAR: GENERADOR DE SVGs ULTRA-REALISTAS
// =========================================================
function obtenerSvgBarco(tipoParte) {
  // Definimos materiales y sombras hiperrealistas
  const defs = `<defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="5" stdDeviation="3" flood-color="#001a33" flood-opacity="0.8"/>
    </filter>
    
    <linearGradient id="hullGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#374151"/>
      <stop offset="15%" stop-color="#9CA3AF"/>  <stop offset="50%" stop-color="#D1D5DB"/>
      <stop offset="85%" stop-color="#4B5563"/>
      <stop offset="100%" stop-color="#111827"/> </linearGradient>

    <linearGradient id="deckGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#8B7355"/>
      <stop offset="50%" stop-color="#A68B6A"/>
      <stop offset="100%" stop-color="#705C42"/>
    </linearGradient>

    <linearGradient id="subGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1F2937"/>
      <stop offset="30%" stop-color="#6B7280"/>
      <stop offset="70%" stop-color="#374151"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>
  </defs>`;

  switch (tipoParte) {
    case 'unico': // Submarino táctico (1 casilla)
      return `<svg class="svg-barco" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${defs}
        <g filter="url(#shadow)">
          <path d="M5 40 Q -5 50 5 60" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4"/>
          <path d="M10 50 C10 42 30 40 50 40 L70 40 C85 40 92 47 95 50 C92 53 85 60 70 60 L50 60 C30 60 10 58 10 50 Z" fill="url(#subGrad)"/>
          <rect x="65" y="36" width="8" height="28" rx="2" fill="#1F2937"/>
          <rect x="40" y="43" width="22" height="14" rx="4" fill="#374151" stroke="#111827" stroke-width="1.5"/>
          <circle cx="55" cy="50" r="2.5" fill="#030712"/>
        </g>
      </svg>`;
    
    case 'popa': // Parte trasera (Helipuerto y torreta secundaria)
      return `<svg class="svg-barco" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${defs}
        <path d="M10 40 Q 0 50 10 60" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.3"/>
        <g filter="url(#shadow)">
          <path d="M10 35 C10 20 20 15 40 15 L100 15 L100 85 L40 85 C20 85 10 80 10 65 Z" fill="url(#hullGrad)"/>
          <path d="M15 40 C15 30 25 22 40 22 L100 22 L100 78 L40 78 C25 78 15 70 15 60 Z" fill="url(#deckGrad)"/>
          <circle cx="45" cy="50" r="16" fill="none" stroke="#FBBF24" stroke-width="2" stroke-dasharray="4,2"/>
          <text x="45" y="55" font-family="Arial" font-size="14" fill="#FBBF24" text-anchor="middle" font-weight="bold">H</text>
          <circle cx="85" cy="50" r="11" fill="url(#hullGrad)" stroke="#111827"/>
          <rect x="62" y="46" width="23" height="2.5" fill="#6B7280" stroke="#111" stroke-width="0.5"/>
          <rect x="62" y="51.5" width="23" height="2.5" fill="#6B7280" stroke="#111" stroke-width="0.5"/>
          <polygon points="80,44 90,46 90,54 80,56" fill="#4B5563" stroke="#111827"/>
        </g>
      </svg>`;

    case 'medio': // Bloque central (Superestructura y Chimeneas)
      return `<svg class="svg-barco" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${defs}
        <g filter="url(#shadow)">
          <rect x="0" y="15" width="100" height="70" fill="url(#hullGrad)"/>
          <rect x="0" y="22" width="100" height="56" fill="url(#deckGrad)"/>
          <rect x="15" y="17" width="18" height="6" rx="3" fill="#E5E7EB" stroke="#4B5563"/>
          <rect x="65" y="17" width="18" height="6" rx="3" fill="#E5E7EB" stroke="#4B5563"/>
          <rect x="15" y="77" width="18" height="6" rx="3" fill="#E5E7EB" stroke="#4B5563"/>
          <rect x="65" y="77" width="18" height="6" rx="3" fill="#E5E7EB" stroke="#4B5563"/>
          <rect x="10" y="32" width="80" height="36" rx="3" fill="url(#hullGrad)" stroke="#111827"/>
          <circle cx="20" cy="40" r="3" fill="#111827"/><circle cx="20" cy="60" r="3" fill="#111827"/>
          <circle cx="80" cy="40" r="3" fill="#111827"/><circle cx="80" cy="60" r="3" fill="#111827"/>
          <ellipse cx="35" cy="50" rx="9" ry="13" fill="#4B5563" stroke="#111827"/>
          <ellipse cx="35" cy="50" rx="5" ry="9" fill="#030712"/>
          <ellipse cx="65" cy="50" rx="9" ry="13" fill="#4B5563" stroke="#111827"/>
          <ellipse cx="65" cy="50" rx="5" ry="9" fill="#030712"/>
        </g>
      </svg>`;

    case 'proa': // Punta delantera (Torreta principal pesada)
      return `<svg class="svg-barco" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${defs}
        <path d="M60 15 Q 90 30 100 50 Q 90 70 60 85" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.4"/>
        <g filter="url(#shadow)">
          <path d="M0 15 L60 15 C85 15 95 48 97 50 C95 52 85 85 60 85 L0 85 Z" fill="url(#hullGrad)"/>
          <path d="M0 22 L55 22 C75 22 88 48 90 50 C88 52 75 78 55 78 L0 78 Z" fill="url(#deckGrad)"/>
          <circle cx="75" cy="32" r="2.5" fill="#374151"/>
          <circle cx="75" cy="68" r="2.5" fill="#374151"/>
          <circle cx="35" cy="50" r="16" fill="url(#hullGrad)" stroke="#111827"/>
          <rect x="35" y="41.5" width="40" height="3" fill="#9CA3AF" stroke="#111" stroke-width="0.5"/>
          <rect x="35" y="48.5" width="40" height="3" fill="#9CA3AF" stroke="#111" stroke-width="0.5"/>
          <rect x="35" y="55.5" width="40" height="3" fill="#9CA3AF" stroke="#111" stroke-width="0.5"/>
          <polygon points="25,40 45,43 45,57 25,60" fill="#4B5563" stroke="#111827"/>
        </g>
      </svg>`;
  }
  return '';
}

// ==========================================
// FUNCIONES AUXILIARES: ANIMACIONES DE FX
// ==========================================

function obtenerSvgExplosion(esHundido) {
  // Si es hundido, la explosión es más grande y roja. Si es tocado, es naranja.
  const colorFuego = esHundido ? '#DC2626' : '#EA580C'; 
  
  return `<svg class="efecto-fx" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="animation: estallido 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
    <circle cx="50" cy="50" r="45" fill="${colorFuego}" opacity="0.6">
       <animate attributeName="opacity" values="0.8; 0" dur="0.6s" fill="freeze" />
    </circle>
    <path d="M50 15 L58 38 L80 35 L63 50 L75 70 L55 62 L50 85 L45 62 L25 70 L37 50 L20 35 L42 38 Z" fill="${colorFuego}" />
    <path d="M50 25 L55 42 L70 40 L60 50 L68 65 L53 58 L50 75 L47 58 L32 65 L40 50 L30 40 L45 42 Z" fill="#FDE047" />
    <circle cx="50" cy="50" r="25" fill="#111827" opacity="0">
       <animate attributeName="r" values="0; 35" dur="0.5s" begin="0.1s" fill="freeze" />
       <animate attributeName="opacity" values="0; 0.8; 0.9" dur="0.5s" begin="0.1s" fill="freeze" />
    </circle>
  </svg>`;
}

function obtenerSvgSalpicadura() {
  return `<svg class="efecto-fx" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="10" fill="none" stroke="#E0F2FE" stroke-width="6">
      <animate attributeName="r" values="10; 45" dur="0.6s" fill="freeze" />
      <animate attributeName="opacity" values="1; 0" dur="0.6s" fill="freeze" />
    </circle>
    <circle cx="50" cy="50" r="5" fill="none" stroke="#BAE6FD" stroke-width="4">
      <animate attributeName="r" values="5; 35" dur="0.6s" begin="0.1s" fill="freeze" />
      <animate attributeName="opacity" values="1; 0" dur="0.6s" begin="0.1s" fill="freeze" />
    </circle>
    <circle cx="50" cy="50" r="8" fill="#7DD3FC">
      <animate attributeName="cy" values="50; 20; 60" dur="0.5s" fill="freeze" />
      <animate attributeName="opacity" values="1; 1; 0" dur="0.5s" fill="freeze" />
    </circle>
    <circle cx="50" cy="50" r="4" fill="#E0F2FE">
      <animate attributeName="cy" values="50; 10; 50" dur="0.6s" fill="freeze" />
      <animate attributeName="opacity" values="1; 1; 0" dur="0.6s" fill="freeze" />
    </circle>
  </svg>`;
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

btnJugar.addEventListener('click', async () => {
  limpiarErrorInicio();
  const validacion = validarNombreJugador();
  if (!validacion.ok) {
    mostrarErrorInicio(validacion.error);
    return;
  }

  btnJugar.textContent = 'Procesando...';
  btnJugar.disabled = true;

  // NUEVO PASO 0: ¿Ya estaba este jugador en una partida?
  const chequeo = await verificarPartidaExistenteApi(validacion.nombre);
  
  if (chequeo.encontrada) {
    console.log('[UI] Reconectando a partida existente:', chequeo.idPartida);
    idPartida = chequeo.idPartida;
    miJugador = chequeo.miJugador;
    miNombre = validacion.nombre;
    mostrarPantalla('preparacion');
    // IMPORTANTE: Aquí deberías iniciar el polling para ver si el rival ya movió
    startPolling(); 
  } 
  else {
    // PASO 1: Intentar unirse a una partida abierta (lógica original)
    const resultadoUnirse = await unirsePartidaApi(null, validacion.nombre);
    
    if (resultadoUnirse.ok) {
      idPartida = resultadoUnirse.idPartida;
      miJugador = resultadoUnirse.miJugador;
      miNombre = validacion.nombre;
      mostrarPantalla('preparacion');
    } 
    else {
      // PASO 2: Crear nueva
      const resultadoCrear = await crearPartidaApi(validacion.nombre);
      if (resultadoCrear.ok) {
        idPartida = resultadoCrear.idPartida;
        miJugador = 1; // Eres el creador
        miNombre = validacion.nombre;
        mostrarPantalla('preparacion');
      } else {
        mostrarErrorInicio('Error al crear partida.');
      }
    }
  }

  btnJugar.textContent = 'Jugar / Buscar Partida';
  btnJugar.disabled = false;
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
