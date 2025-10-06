// =================================================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (MANDATORIO)
// =================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    if (initialAuthToken) {
        signInWithCustomToken(auth, initialAuthToken).catch(e => console.error("Error signing in with custom token:", e));
    } else {
        signInAnonymously(auth).catch(e => console.error("Error signing in anonymously:", e));
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}
// =================================================================
        
// ---------------------
// Variables de Estado
// ---------------------
let currentChart = null;
let lastSelectedDateMax = null; 
let currentHistoryData = [];    
let stationData = []; 
let sensorData = []; 

// ---------------------
// Elementos del DOM (Cache)
// ---------------------
const countrySelect = document.getElementById('country-select');
const stationSelect = document.getElementById('station-select');
const sensorSelect = document.getElementById('sensor-select');
const aggSelect = document.getElementById('agg-select');
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const dateToMaxDisplay = document.getElementById('date-to-max');
const btnHistory = document.getElementById('btn-history');
const btnLatest = document.getElementById('btn-latest');
const btnToggleTable = document.getElementById('btn-toggle-table');
const btnCloseModal = document.getElementById('btn-close-modal');

// Elementos de Resultados
const latestResultDiv = document.getElementById('latest-result');
const historyChartCard = document.getElementById('history-chart-card');
const chartPlaceholder = document.getElementById('chart-placeholder');
const chartWrapper = document.querySelector('.chart-wrapper');
const loadingDiv = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const errorBox = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const jsonDebugContainer = document.getElementById('json-debug-container');
const jsonContent = document.getElementById('json-content');
const historyModal = document.getElementById('history-modal');
const toggleTableContainer = document.getElementById('toggle-table-container');

// ---------------------
// Funciones de Ayuda de UI
// ---------------------

function showLoading(show, message = 'Cargando datos...') {
    if (show) {
        loadingText.textContent = message;
        loadingDiv.classList.remove('hidden');
        errorBox.classList.add('hidden');
    } else {
        loadingDiv.classList.add('hidden');
    }
}

function showError(message) {
    errorText.textContent = message;
    errorBox.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
}

function clearResults() {
    // Ya no ocultamos los contenedores, solo limpiamos el contenido del gráfico
    chartWrapper.classList.add('hidden');
    toggleTableContainer.classList.add('hidden');
    chartPlaceholder.classList.remove('hidden');
    errorBox.classList.add('hidden');
}

function updatePlaceholderText(message) {
    document.getElementById('placeholder-text').textContent = message;
}

// ---------------------
// Funciones de Lógica y API
// ---------------------

async function fetchApi(path) {
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
        try {
            const response = await fetch(path);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || `Error al obtener datos: ${path}`);
            }
            return data;
        } catch (error) {
            attempt++;
            if (attempt >= maxAttempts) {
                throw error; 
            }
            // Espera exponencial (1s, 2s, 4s, 8s, 16s)
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function loadCountries() {
    showLoading(true, 'Inicializando la aplicación y cargando lista de países...');
    try {
        const data = await fetchApi('/api/countries');
        countrySelect.innerHTML = '<option value="" disabled selected>Selecciona un país</option>';
        data.results.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });
        countrySelect.disabled = false;
        
        showLoading(false);
        updatePlaceholderText('Países cargados. Seleccione uno para ver las estaciones disponibles.');
    } catch (e) {
        countrySelect.innerHTML = '<option value="" disabled selected>Error al cargar países</option>';
        document.getElementById('country-feedback').textContent = `Error: ${e.message}`;
        document.getElementById('country-feedback').classList.remove('hidden');
        showLoading(false);
        showError('No se pudo cargar la lista de países. Verifique la conexión con el backend.');
    }
}

async function loadStations(countryCode) {
    stationSelect.disabled = true;
    stationSelect.innerHTML = '<option value="" disabled selected>Cargando Estaciones...</option>';
    clearResults();
    showLoading(true, `Cargando estaciones para ${countryCode}...`);

    try {
        const data = await fetchApi(`/api/stations/${countryCode}`);
        stationData = data.results;
        stationSelect.innerHTML = '<option value="" disabled selected>Selecciona una estación</option>';
        stationData.forEach(station => {
            const option = document.createElement('option');
            option.value = station.id;
            // Usamos name y locality para mejor identificación
            option.textContent = station.name + (station.locality ? ` (${station.locality})` : ''); 
            stationSelect.appendChild(option);
        });
        stationSelect.disabled = false;
        showLoading(false);
        updatePlaceholderText('Estaciones cargadas. Seleccione una estación para cargar los sensores.');
    } catch (e) {
        stationSelect.innerHTML = '<option value="" disabled selected>Error al cargar estaciones</option>';
        document.getElementById('station-feedback').textContent = `Error: ${e.message}`;
        document.getElementById('station-feedback').classList.remove('hidden');
        showLoading(false);
        showError(`Error al cargar estaciones: ${e.message}`);
    }
}

async function loadSensors(stationId) {
    sensorSelect.disabled = true;
    sensorSelect.innerHTML = '<option value="" disabled selected>Cargando Sensores...</option>';
    clearResults();
    jsonDebugContainer.classList.add('hidden');
    showLoading(true, 'Cargando sensores/parámetros de la estación...');

    try {
        const data = await fetchApi(`/api/parameters/${stationId}`);
        sensorData = data.results;
        sensorSelect.innerHTML = '<option value="" disabled selected>Selecciona un sensor</option>';
        
        sensorData.forEach(sensor => {
            const option = document.createElement('option');
            option.value = `${sensor.parameter_id}|${sensor.sensor_id}`;
            
            // SOLUCIÓN DEFINITIVA: Analizar y limpiar el texto del sensor
            let sensorName = sensor.name || '';
            let unit = sensor.units || sensor.unit || 'N/A';
            let sensorId = sensor.sensor_id;
            
            // Buscar si el nombre ya contiene información duplicada
            const idRegex = /\(ID Sensor:\s*\d+/;
            const unitRegex = /Unidad:\s*[^)]*\)/;
            
            if (idRegex.test(sensorName) && unitRegex.test(sensorName)) {
                // El nombre ya está formateado completamente, usarlo tal cual
                option.textContent = sensorName;
            } else if (idRegex.test(sensorName)) {
                // Tiene ID pero no unidad, añadir solo la unidad
                option.textContent = `${sensorName.replace(/\)\s*$/, '')}, Unidad: ${unit})`;
            } else if (unitRegex.test(sensorName)) {
                // Tiene unidad pero no ID, añadir solo el ID
                const cleanName = sensorName.replace(/\s*\(Unidad:\s*[^)]*\)/, '');
                option.textContent = `${cleanName} (ID: ${sensorId}, Unidad: ${unit})`;
            } else {
                // No tiene formato, construir desde cero
                option.textContent = `${sensorName} (ID: ${sensorId}, Unidad: ${unit})`;
            }
            
            sensorSelect.appendChild(option);
        });

        sensorSelect.disabled = false;
        
        // Mostrar JSON de debug
        jsonContent.textContent = JSON.stringify(data, null, 2);
        jsonDebugContainer.classList.remove('hidden');
        
        showLoading(false);
        updatePlaceholderText('Sensores listos. Ahora puede seleccionar un parámetro y cargar datos.');

    } catch (e) {
        sensorSelect.innerHTML = '<option value="" disabled selected>Error al cargar sensores</option>';
        document.getElementById('sensor-feedback').textContent = `Error: ${e.message}`;
        document.getElementById('sensor-feedback').classList.remove('hidden');
        showLoading(false);
        showError(`Error al cargar sensores: ${e.message}`);
    }
}

async function loadLatestDate(locationId, parameterId) {
    try {
        const data = await fetchApi(`/api/last_measurement_date/${locationId}/${parameterId}`);
        const dateUtc = data.date_utc;
        
        const dt = luxon.DateTime.fromISO(dateUtc, { zone: 'utc' });
        const localDateFormat = dt.toFormat("yyyy-MM-dd");
        
        lastSelectedDateMax = dt;
        
        dateToInput.value = localDateFormat;
        dateToInput.max = localDateFormat;
        dateToMaxDisplay.textContent = `Máx: ${dt.toFormat('dd-MM-yyyy')} UTC`;

    } catch (e) {
        console.warn("No se pudo cargar la última fecha de medición. Usando fecha actual como máximo.");
        const now = luxon.DateTime.utc();
        const localDateFormat = now.toFormat("yyyy-MM-dd");
        lastSelectedDateMax = now;
        dateToInput.value = localDateFormat;
        dateToInput.max = localDateFormat;
        dateToMaxDisplay.textContent = `Máx: ${now.toFormat('dd-MM-yyyy')} UTC (Fallback)`;
    }
}

function updateDateRange() {
    const agg = aggSelect.value;
    
    let dtEnd = lastSelectedDateMax || luxon.DateTime.utc();
    
    // Si el usuario seleccionó una fecha final anterior, usarla.
    if (dateToInput.value) {
         const userDt = luxon.DateTime.fromISO(dateToInput.value, { zone: 'local' }).endOf('day').toUTC();
         if (userDt < dtEnd) {
            dtEnd = userDt; 
         }
    } else {
         dateToInput.value = dtEnd.toFormat("yyyy-MM-dd");
    }
    
    let dtStart;
    
    // Lógica para establecer un rango por defecto basado en la granularidad
    switch (agg) {
        case 'raw':
        case 'hours':
            dtStart = dtEnd.minus({ days: 3 }); // Últimos 3 días para raw/hourly
            break;
        case 'days':
            dtStart = dtEnd.minus({ months: 1 }); // Último mes
            break;
        case 'monthly':
            dtStart = dtEnd.minus({ years: 1 }); // Último año
            break;
        case 'yearly':
            dtStart = dtEnd.minus({ years: 10 }); // Últimos 10 años
            break;
        default:
            dtStart = dtEnd.minus({ months: 1 });
    }

    // Aplicar la fecha de inicio calculada
    dateFromInput.value = dtStart.toFormat("yyyy-MM-dd");
}

async function fetchLatestMeasurement() {
    const stationId = stationSelect.value;
    const sensorValue = sensorSelect.value;
    
    if (!stationId || !sensorValue) return showError("Por favor, seleccione una estación y un sensor.");
    
    const [parameterId, sensorId] = sensorValue.split('|');

    // Ocultar modal si estaba abierto
    historyModal.classList.add('hidden');
    showLoading(true, 'Obteniendo la última medición disponible...');

    try {
        const data = await fetchApi(`/api/sensor_latest/${stationId}/${sensorId}`);
        
        if (data.count === 0) {
            // No es un error crítico, pero no hay datos
            document.getElementById('latest-value').textContent = 'N/A';
            document.getElementById('latest-datetime').textContent = 'Fecha (UTC): No hay datos recientes';
            showLoading(false);
            return;
        }

        const result = data.results[0];
        const dt = luxon.DateTime.fromISO(result.datetime_utc, { zone: 'utc' });
        
        document.getElementById('latest-value').textContent = `${result.value !== null ? result.value.toFixed(2) : 'N/A'} ${result.unit || ''}`;
        document.getElementById('latest-datetime').textContent = `Fecha (UTC): ${dt.toFormat('dd-MM-yyyy HH:mm')}Z`;
        
        showLoading(false);

    } catch (e) {
        showError(`Error al obtener la última medición: ${e.message}`);
    }
}

async function fetchHistory() {
    const locationId = stationSelect.value;
    const sensorValue = sensorSelect.value;
    const agg = aggSelect.value;
    const dateFromLocal = dateFromInput.value;
    const dateToLocal = dateToInput.value;

    if (!locationId || !sensorValue) return showError("Por favor, seleccione una estación y un sensor.");
    if (!dateFromLocal || !dateToLocal) return showError("Por favor, ingrese un rango de fechas válido.");

    const [parameterId, sensorId] = sensorValue.split('|');
    
    // Convertir fechas YYYY-MM-DD a UTC (inicio del día y fin del día, respectivamente)
    const dateFromUtc = luxon.DateTime.fromISO(dateFromLocal, { zone: 'local' }).startOf('day').toUTC().toISO();
    const dateToUtc = luxon.DateTime.fromISO(dateToLocal, { zone: 'local' }).endOf('day').toUTC().toISO();

    // Ocultar modal si estaba abierto
    historyModal.classList.add('hidden');
    showLoading(true, 'Cargando datos históricos y generando gráfico...');
    chartPlaceholder.classList.remove('hidden');

    let url = `/api/measurements/${locationId}/${parameterId}?agg=${agg}&date_from=${dateFromUtc}&date_to=${dateToUtc}`;
    if (agg === 'raw' || agg === 'hours') {
         url += '&limit=1000'; // Limitar a 1000 puntos
    }

    try {
        const data = await fetchApi(url);
        
        if (data.count === 0) {
            showLoading(false);
            updatePlaceholderText("No se encontraron mediciones para el rango seleccionado.");
            return;
        }

        currentHistoryData = data.results.filter(r => r.datetime_utc && r.value !== null).sort((a, b) => {
            return new Date(a.datetime_utc) - new Date(b.datetime_utc);
        });

        if (currentHistoryData.length === 0) {
            showLoading(false);
            updatePlaceholderText("No se encontraron mediciones válidas para el rango seleccionado.");
            return;
        }

        // Generar Gráfico y preparar Tabla
        renderChart(currentHistoryData, agg);
        renderTable(currentHistoryData);

        chartPlaceholder.classList.add('hidden');
        chartWrapper.classList.remove('hidden');
        toggleTableContainer.classList.remove('hidden');
        showLoading(false);
        
    } catch (e) {
        showError(`Error al obtener el historial: ${e.message}`);
    }
}

function renderChart(data, agg) {
    const ctx = document.getElementById('history-chart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }

    const selectedOption = sensorSelect.options[sensorSelect.selectedIndex].textContent;
    // Extraer solo el nombre del parámetro (ej: PM2.5)
    const parameterNameMatch = selectedOption.match(/^(.+?)\s*\(/);
    const parameterName = parameterNameMatch ? parameterNameMatch[1].trim() : 'Parámetro';
    
    const unitMatch = selectedOption.match(/Unidad:\s*([^\)]+)\)/);
    const unit = unitMatch ? unitMatch[1].trim() : 'N/A';
    
    const aggName = aggSelect.options[aggSelect.selectedIndex].textContent;
    
    document.getElementById('chart-title').textContent = `${parameterName} | ${aggName} (${unit})`;

    const labels = data.map(item => item.datetime_utc);
    const values = data.map(item => item.value);

    let timeUnit;
    switch(agg) {
        case 'raw':
        case 'hours':
            timeUnit = 'hour';
            break;
        case 'days':
            timeUnit = 'day';
            break;
        case 'monthly':
            timeUnit = 'month';
            break;
        case 'yearly':
            timeUnit = 'year';
            break;
        default:
            timeUnit = 'day';
    }
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${parameterName} (${unit})`,
                data: values,
                borderColor: '#4f46e5', // indigo-600
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: '#4f46e5',
                fill: 'origin', // Relleno hasta el eje
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                        displayFormats: {
                            'hour': 'HH:mm',
                            'day': 'MMM dd',
                            'month': 'yyyy/MM',
                            'year': 'yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Fecha y Hora (UTC)'
                    },
                    adapters: {
                        date: luxon
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: `Valor (${unit})`
                    },
                    beginAtZero: false
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderTable(data) {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';
    
    const displayLimit = 500;
    const dataToDisplay = data.slice(0, displayLimit);
    
    dataToDisplay.forEach(item => {
        const row = tbody.insertRow();
        row.classList.add('hover:bg-gray-50');

        // Formatear fecha para la tabla
        const dt = luxon.DateTime.fromISO(item.datetime_utc, { zone: 'utc' });
        const dateCell = row.insertCell();
        dateCell.textContent = dt.toFormat('dd-MM-yyyy HH:mm:ss') + 'Z';
        dateCell.classList.add('px-4', 'py-2', 'whitespace-nowrap', 'text-sm', 'font-medium', 'text-gray-900');

        const valueCell = row.insertCell();
        valueCell.textContent = item.value !== null ? item.value.toFixed(2) : 'N/A';
        valueCell.classList.add('px-4', 'py-2', 'whitespace-nowrap', 'text-sm', 'text-gray-500');

        const unitCell = row.insertCell();
        unitCell.textContent = item.unit || 'N/A';
        unitCell.classList.add('px-4', 'py-2', 'whitespace-nowrap', 'text-sm', 'text-gray-500');
    });
    
    document.getElementById('table-info').classList.toggle('hidden', data.length <= displayLimit);
}

// ---------------------
// Manejadores de Eventos
// ---------------------

window.onload = loadCountries;

countrySelect.addEventListener('change', (e) => {
    loadStations(e.target.value);
    document.getElementById('country-feedback').classList.add('hidden');
    document.getElementById('station-feedback').classList.add('hidden');
    sensorSelect.disabled = true;
    dateFromInput.disabled = true;
    dateToInput.disabled = true;
    btnHistory.disabled = true;
    btnLatest.disabled = true;
    
    // Resetear última medición
    document.getElementById('latest-value').textContent = '--';
    document.getElementById('latest-datetime').textContent = 'Seleccione un sensor para cargar datos';
    clearResults();
});

stationSelect.addEventListener('change', (e) => {
    const stationId = e.target.value;
    loadSensors(stationId);
    document.getElementById('station-feedback').classList.add('hidden');
    document.getElementById('sensor-feedback').classList.add('hidden');
    dateFromInput.disabled = true;
    dateToInput.disabled = true;
    btnHistory.disabled = true;
    btnLatest.disabled = true;
    
    // Resetear última medición
    document.getElementById('latest-value').textContent = '--';
    document.getElementById('latest-datetime').textContent = 'Seleccione un sensor para cargar datos';
    clearResults();
});

sensorSelect.addEventListener('change', (e) => {
    const sensorValue = e.target.value;
    const locationId = stationSelect.value;
    if (sensorValue) {
        const [parameterId, sensorId] = sensorValue.split('|');
        
        // Habilitar controles de tiempo y botones
        dateFromInput.disabled = false;
        dateToInput.disabled = false;
        btnHistory.disabled = false;
        btnLatest.disabled = false;
        
        // Cargar automáticamente la última medición
        loadLatestDate(locationId, parameterId).then(() => {
            updateDateRange();
            fetchLatestMeasurement(); // Cargar automáticamente la última medición
        });
        
        clearResults();
    }
});

aggSelect.addEventListener('change', updateDateRange);
dateFromInput.addEventListener('change', () => { /* no-op */ });
dateToInput.addEventListener('change', () => { /* no-op */ });

btnLatest.addEventListener('click', fetchLatestMeasurement);
btnHistory.addEventListener('click', fetchHistory);

// Manejo del Modal
btnToggleTable.addEventListener('click', () => {
    historyModal.classList.remove('hidden');
});
btnCloseModal.addEventListener('click', () => {
    historyModal.classList.add('hidden');
});
// Cerrar modal al hacer clic fuera
historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.classList.add('hidden');
    }
});