// ... aquí sigue el resto de tu código (const API_URL = ... etc)
const API_URL = 'https://script.google.com/macros/s/AKfycbzEcW9ek3xWralEFrfSyPir1vgnMVBHa9Xo3MmEydHrs3dD4jnYDGErv34QW_eJSBzi/exec';

const pantallas = {
  inicio: document.getElementById('pantalla-inicio'),
  preparacion: document.getElementById('pantalla-preparacion'),
  batalla: document.getElementById('pantalla-batalla'),
};

// --- MOTOR DE AUDIO ---
const sonidos = {
  button: new Audio('button.mp3'),
  drop: new Audio('drop.mp3'),
  water: new Audio('water.mp3'),
  explosion: new Audio('explosion.mp3'),
  selection: new Audio('selection.mp3'),
  ending: new Audio('ending.mp3')
};

// Configurar música de ambientación en bucle permanente
sonidos.selection.loop = true;

let sonidoHabilitado = true;

function reproducirSonido(nombre) {
  if (!sonidoHabilitado) return;
  
  // Reiniciar el cursor de tiempo para permitir repeticiones rápidas consecutivas
  sonidos[nombre].currentTime = 0;
  sonidos[nombre].play().catch(err => console.log("Reproducción de audio bloqueada temporalmente: ", err));
}

const tableroPreparacion = document.getElementById('tablero-preparacion');
const tableroFlota = document.getElementById('tablero-flota');
const tableroRadar = document.getElementById('tablero-radar');
const btnJugar = document.getElementById('btn-jugar');
const btnListo = document.getElementById('btn-listo');
const btnOrientacionModal = document.getElementById('btn-orientacion-modal');
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

  // Control musical de transiciones
  if (nombre === 'preparacion') { // 👈 ¡Corregido! Ahora usamos la variable "nombre"
    reproducirSonido('selection');
  } else {
    // 👈 IMPORTANTE: Añadimos el else para apagarla al pasar a batalla
    sonidos.selection.pause(); 
  }
}

function crearTablero(contenedor, matriz, conEtiquetas = false, esRadar = false) {
  if (displayId && idPartida) {
    displayId.textContent = ` (Cód. partida: ${idPartida})`;
  }
  contenedor.innerHTML = '';
  
  for (let fila = 0; fila < 10; fila += 1) {
    for (let columna = 0; columna < 10; columna += 1) {
      const celda = document.createElement('div');
      const valor = matriz[fila][columna];
      
      // Asignamos las clases (agua, barco, tocado, fallo, hundido)
      celda.className = `celda ${valor}`; 
      celda.dataset.coordenada = `${fila}-${columna}`;

      let contenido = '';

      // 1. DIBUJAR EL BARCO (Si existe en estas coordenadas y no es el radar)
      const barco = obtenerBarcoEnPosicion(fila, columna); 
      
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

        // Inyectamos el SVG del barco
        contenido += `<div class="contenedor-svg-barco ${claseOrientacion}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; z-index: 1;">
                       ${obtenerSvgBarco(tipoParte)}
                     </div>`;
      }

      celda.innerHTML = contenido;

      // 2. EVENTOS DE CLIC SEGÚN EL TABLERO
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

function alternarOrientacion() {
  orientacion = orientacion === 'horizontal' ? 'vertical' : 'horizontal';
  btnOrientacionModal.textContent = `Orientación: ${orientacion.charAt(0).toUpperCase() + orientacion.slice(1)}`;
  
  // 🔄 Si el modal está abierto y tenemos una celda activa, refrescamos las opciones
  if (celdaActivaParaColocar) {
    abrirModalColocacion(celdaActivaParaColocar.fila, celdaActivaParaColocar.columna);
  }
}

function actualizarTituloBarcos() {
  const titulo = document.getElementById('titulo-lista-barcos');
  if (titulo) {
    titulo.textContent = 'Flota colocada';
  }
}

function handlePreparacionClick(fila, columna) {
  // 1. Si hay un barco colocado, lo removemos
  if (miTablero[fila][columna] === 'barco') {
    if (removerBarcoDelTablero(fila, columna)) { 
      infoColocacion.textContent = 'Barco removido. Faltan barcos por colocar.'; 
      renderTableros(); 
      return;
    }
  }
  
  // 2. Si no hay barco (es agua), abrimos el diálogo emergente
  if (miTablero[fila][columna] === 'agua') {
    abrirModalColocacion(fila, columna);
  }
}

// --- VARIABLES Y LÓGICA DEL DIÁLOGO EMERGENTE ---
const modalBarcos = document.getElementById('modal-barcos');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const listaBarcosModal = document.getElementById('lista-barcos-modal');
const mensajeModal = document.getElementById('mensaje-modal');

let celdaActivaParaColocar = null;

// Cerrar modal al pulsar la X (Incluye el reseteo del Punto D)
btnCerrarModal.addEventListener('click', () => {
  reproducirSonido('button');
  modalBarcos.close();
  celdaActivaParaColocar = null; 
});

// Función que abre el modal y calcula qué barcos caben
function abrirModalColocacion(fila, columna) {
  celdaActivaParaColocar = { fila, columna };
  listaBarcosModal.innerHTML = '';
  mensajeModal.textContent = '';
  
  let algunBarcoCabe = false;
  let barcosPendientes = false;

  barcosDisponibles.forEach((barco) => {
    if (barco.colocados < barco.disponibles) {
      barcosPendientes = true;
      
      const coordenadasPosibles = obtenerCoordenadasBarco(fila, columna, barco.tamaño, orientacion);
      let cabe = false;
      
      if (coordenadasPosibles) {
        cabe = coordenadasPosibles.every(([r, c]) => miTablero[r][c] === 'agua');
      }

      if (cabe) algunBarcoCabe = true;

      const btn = document.createElement('button');
      btn.className = 'btn-barco-modal';
      const nombreBarco = barco.id.charAt(0).toUpperCase() + barco.id.slice(1);
      btn.textContent = `${nombreBarco} (${barco.label})`;
      
      if (!cabe) {
        btn.disabled = true;
        btn.textContent += ' - No cabe aquí';
      } else {
        btn.addEventListener('click', () => colocarBarcoDesdeModal(barco.id));
      }
      
      listaBarcosModal.appendChild(btn);
    }
  });

  if (!barcosPendientes) {
    mensajeModal.textContent = "¡Ya has colocado todos los barcos!";
  } else if (!algunBarcoCabe) {
    mensajeModal.textContent = `Ningún barco cabe aquí en orientación ${orientacion}.`;
  }

  modalBarcos.showModal();
}

// Esta es la función colocarBarcoDesdeModal (Punto D). 
// Ejecuta la colocación y luego limpia la celda activa.
function colocarBarcoDesdeModal(tipoBarco) {
  const barco = barcosDisponibles.find(b => b.id === tipoBarco);
  const { fila, columna } = celdaActivaParaColocar;

  const colocadoCorrectamente = colocarBarco(fila, columna, barco.tamaño, orientacion, barco.id);

  if (colocadoCorrectamente) {
    barco.colocados++;
    modalBarcos.close();
    
    // Aquí está el reseteo que mencionábamos en el Punto D
    celdaActivaParaColocar = null; 
    
    renderTableros();

    if (todosLosBarcosSonColocados()) {
      infoColocacion.textContent = 'Adelante, vamos al ataque.';
      actualizarTituloBarcos();
    } else {
      infoColocacion.textContent = 'Faltan barcos por colocar.';
    }
  }
}

function handleRadarClick(fila, columna) {
  if (!miTurno) {
    estadoTurno.textContent = 'No es tu turno. Espera al rival.';
    return;
  }
  if (miRadar[fila][columna] !== 'agua') {
    return;
  }
  reproducirSonido('drop');
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
  if (disparoResultado === 'fallo') {
    reproducirSonido('water');
  } else if (disparoResultado === 'tocado' || disparoResultado === 'hundido') {
    reproducirSonido('explosion');
  }
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
    sonidos.selection.pause(); // Por seguridad apaga música previa
    reproducirSonido('ending'); // 👈 Añadido: Sonido de victoria
    return true;
  }

  if (aciertosRival >= TOTAL_CELDAS_BARCOS) {
    estadoTurno.textContent = 'FIN DE LA BATALLA, HAS SIDO VENCIDO 💥';
    estadoTurno.style.backgroundColor = 'rgba(216, 79, 79, 0.3)'; // Fondo rojo suave
    stopPolling();
    miTurno = false;
    sonidos.selection.pause(); // Por seguridad apaga música previa
    reproducirSonido('ending'); // 👈 Añadido: Sonido de derrota
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
  reproducirSonido('button');
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

const toggleSonido = document.getElementById('toggle-sonido');
const textoSonido = document.getElementById('texto-sonido');

toggleSonido.addEventListener('change', (e) => {
  sonidoHabilitado = e.target.checked;
  textoSonido.textContent = sonidoHabilitado ? 'Sonido Activado' : 'Sonido Silenciado';
  
  if (!sonidoHabilitado) {
    // Si el usuario silencia el juego, pausamos inmediatamente la música activa
    sonidos.selection.pause();
    sonidos.ending.pause();
  } else {
    // Si vuelve a activar el sonido estando en la fase de preparación, reanudamos
    if (pantallas.preparacion.classList.contains('activa')) {
      reproducirSonido('selection');
    }
  }
});

btnListo.addEventListener('click', async () => {
  reproducirSonido('button');
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

btnOrientacionModal.addEventListener('click', alternarOrientacion)
reproducirSonido('button');


function comprobarSiTodosColocados() {
  const todos = barcosDisponibles.every(b => b.colocados >= b.disponibles);
  if (todos) {
    infoColocacion.textContent = "¡Todos los barcos colocados!";
    infoColocacion.style.color = "#00ff00"; // Verde
  }
}

renderTableros();