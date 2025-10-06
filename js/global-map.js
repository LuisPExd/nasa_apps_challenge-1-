// DATA: Contaminación Atmosférica Global (Extraída y Citada del PDF)
const GLOBAL_POLLUTION_DATA = {
    'AMERICA': {
        title: "AMÉRICA (Norte y Sur)",
        citation: "Mardoñez-Balderrama et al. (2025)",
        pollutants: [
            {
                name: "PM₂.₅ / PM₁₀",
                icon: "grain",
                level: 85, // 0-100%
                color: "var(--pollutant-high)",
                description: "Proviene de la quema de biomasa, deforestación, tráfico e industria. Causa graves impactos cardiopulmonares y mortalidad."
            },
            {
                name: "Ozono ($O_3$)",
                icon: "blur_on",
                level: 65,
                color: "var(--pollutant-moderate)",
                description: "Ozono troposférico formado por $NO_x$ + COV's bajo luz solar. Elevado en áreas urbanas/peri-urbanas, afecta la salud respiratoria."
            },
            {
                name: "Metano ($CH_4$) y CO",
                icon: "local_gas_station",
                level: 40,
                color: "var(--pollutant-low)",
                description: "La quema agrícola y de residuos aumenta el $PM_{2.5}$, CO y $CH_4$, con efectos en la salud."
            },
        ]
    },
    'EUROPE': {
        title: "EUROPA",
        citation: "European Environment Agency (2025)",
        pollutants: [
            {
                name: "PM₂.₅ / PM₁₀",
                icon: "grain",
                level: 70,
                color: "var(--pollutant-moderate)",
                description: "Principal riesgo para la salud; el 94% de la población urbana de la UE sigue expuesta por encima de la guía de la OMS."
            },
            {
                name: "Dióxido de Nitrógeno ($NO_2$)",
                icon: "directions_car",
                level: 55,
                color: "var(--pollutant-moderate)",
                description: "Fuertemente ligado al transporte por carretera, especialmente en zonas urbanas."
            },
            {
                name: "Ozono ($O_3$)",
                icon: "blur_on",
                level: 50,
                color: "var(--pollutant-low)",
                description: "Contaminante complejo, particularmente problemático en las regiones más cálidas."
            },
        ]
    },
    'ASIA': {
        title: "ASIA-PACÍFICO",
        citation: "UN ESCAP (2025)",
        pollutants: [
            {
                name: "PM₂.₅ (Persistente)",
                icon: "filter_drama",
                level: 95,
                color: "var(--pollutant-very-high)",
                description: "Contaminación persistente de $PM_{2.5}$ durante todo el año en ciudades del Sur y Suroeste de Asia."
            },
            {
                name: "Dióxido de Nitrógeno ($NO_2$)",
                icon: "local_gas_station",
                level: 80,
                color: "var(--pollutant-high)",
                description: "Principal contaminante urbano con concentraciones muy altas en las grandes ciudades."
            },
            {
                name: "Dióxido de Azufre ($SO_2$)",
                icon: "bolt",
                level: 75,
                color: "var(--pollutant-high)",
                description: "Picos en invierno debido al uso de combustibles fósiles para calefacción y condiciones atmosféricas estables."
            },
        ]
    },
    'AFRICA': {
        title: "ÁFRICA",
        citation: "Kalisa & Sudmant (2025)",
        pollutants: [
            {
                name: "PM₂.₅ / PM₁₀",
                icon: "grain",
                level: 90,
                color: "var(--pollutant-very-high)",
                description: "Partículas finas de precursores gaseosos y procesos fotoquímicos. Altos riesgos para la salud (cardiovascular, respiratoria). Extremas olas de calor amplifican riesgos."
            },
            {
                name: "NOx / $NO_2$ / $O_3$",
                icon: "blur_on",
                level: 70,
                color: "var(--pollutant-high)",
                description: "Precursores que impulsan reacciones fotoquímicas bajo la luz solar, mejorando la formación de $O_3$ y $PM_{2.5}$."
            },
            {
                name: "CO / $CH_4$ / $SO_2$",
                icon: "flare",
                level: 60,
                color: "var(--pollutant-moderate)",
                description: "Precursores indirectos que afectan la química de oxidación, sosteniendo la formación de contaminantes secundarios."
            },
        ]
    },
    'OCEANIA': {
        title: "OCEANÍA",
        citation: "Emmerson et al. (2025)",
        pollutants: [
            {
                name: "Humo de Incendios",
                icon: "fire_hydrant",
                level: 75,
                color: "var(--pollutant-high)",
                description: "Episódico pero severo, degradando la calidad del aire a nivel nacional."
            },
            {
                name: "Ozono ($O_3$) / $NO_2$",
                icon: "directions_car",
                level: 45,
                color: "var(--pollutant-low)",
                description: "$O_3$ (secundario) y $NO_2$ (tráfico) están relacionados. El $NO_2$ es un precursor clave del ozono."
            },
            {
                name: "COV's Biogénicos",
                icon: "park",
                level: 30,
                color: "var(--pollutant-low)",
                description: "Emitidos por el eucalipto (isopreno, monoterpenos); impulsan el ozono y los aerosoles orgánicos secundarios."
            },
        ]
    }
};


// Mapeo de continentes a posiciones simuladas en el globo (Lat, Lon)
const CONTINENT_POSITIONS = {
    'AMERICA': { lat: 30, lon: -100, color: 0x3b82f6 }, // Azul Estándar
    'EUROPE': { lat: 50, lon: 15, color: 0x1e40af },    // Azul Oscuro
    'ASIA': { lat: 40, lon: 100, color: 0xef4444 },     // Rojo
    'AFRICA': { lat: 5, lon: 20, color: 0x10b981 },     // Verde (Mantenemos un contraste)
    'OCEANIA': { lat: -25, lon: 135, color: 0xf59e0b }  // Ámbar
};

let scene, camera, renderer, earth, continentsGroup, raycaster;
let mouse = new THREE.Vector2();
let INTERSECTED = null;
const mapContainer = document.getElementById('map-canvas-container');
const loadingScreen = document.getElementById('map-loading');

/**
 * Convierte coordenadas Lat/Lon a coordenadas cartesianas (x, y, z) en la esfera.
 * @param {number} lat Latitud
 * @param {number} lon Longitud
 * @param {number} radius Radio de la esfera
 */
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -((radius) * Math.sin(phi) * Math.cos(theta));
    const z = ((radius) * Math.sin(phi) * Math.sin(theta));
    const y = ((radius) * Math.cos(phi));

    return new THREE.Vector3(x, y, z);
}

/**
 * Inicializa la escena 3D (Three.js)
 */
function initThreeJS() {
    // 1. Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Fondo negro para contraste espacial

    // 2. Cámara (Perspectiva)
    camera = new THREE.PerspectiveCamera(
        75, 
        mapContainer.clientWidth / mapContainer.clientHeight, 
        0.1, 
        1000
    );
    camera.position.z = 250;

    // 3. Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mapContainer.clientWidth, mapContainer.clientHeight);
    mapContainer.appendChild(renderer.domElement);
    loadingScreen.classList.add('hidden'); // Ocultar pantalla de carga

    // 4. Luz (Iluminación sutil)
    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.5); // Luz suave
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(200, 150, 200);
    scene.add(directionalLight);

    // 5. Creación del Globo (Tierra)
    const earthRadius = 100;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x102040, // Azul oscuro como base
        specular: 0x333333,
        shininess: 15,
        transparent: true,
        opacity: 0.95
    });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // 6. Creación de Contenedor de Contaminantes (Simulados como esferas)
    continentsGroup = new THREE.Group();
    scene.add(continentsGroup);

    // 7. Colocar "Continentes" (simulados)
    for (const [key, pos] of Object.entries(CONTINENT_POSITIONS)) {
        const continentPosition = latLonToVector3(pos.lat, pos.lon, earthRadius + 5); // 5 unidades por encima de la tierra

        const geometry = new THREE.SphereGeometry(10, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: pos.color });
        
        const continentMesh = new THREE.Mesh(geometry, material);
        continentMesh.position.copy(continentPosition);
        continentMesh.userData = { continent: key, originalColor: pos.color }; // Almacenar el nombre
        
        continentsGroup.add(continentMesh);
    }
    
    // 8. Raycaster para interactividad
    raycaster = new THREE.Raycaster();

    // 9. Manejadores de Eventos
    window.addEventListener('resize', onWindowResize, false);
    mapContainer.addEventListener('mousemove', onMouseMove, false);
    mapContainer.addEventListener('click', onContinentClick, false);

    // 10. Iniciar animación
    animate();
}

/**
 * Maneja el redimensionamiento del navegador
 */
function onWindowResize() {
    camera.aspect = mapContainer.clientWidth / mapContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mapContainer.clientWidth, mapContainer.clientHeight);
}

/**
 * Maneja el movimiento del mouse (para hover)
 * @param {Event} event 
 */
function onMouseMove(event) {
    // Normalizar coordenadas del mouse
    const rect = mapContainer.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Lógica al hacer clic en un "continente"
 * @param {Event} event 
 */
function onContinentClick(event) {
    if (INTERSECTED) {
        // Ejecutar animación de selección
        animateSelection(INTERSECTED);
        
        // Cargar datos en el panel
        loadPollutantData(INTERSECTED.userData.continent);
    }
}

/**
 * Anima la esfera seleccionada
 * @param {THREE.Mesh} mesh 
 */
function animateSelection(mesh) {
    const originalScale = mesh.scale.x;
    const duration = 0.5;
    const peakScale = originalScale * 1.5;

    // Simple animación de pulso (simulando onda expansiva)
    let startTime = performance.now();
    const pulse = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = elapsed / duration;

        if (progress < 0.5) {
            // Expansión
            const scale = originalScale + (peakScale - originalScale) * (progress * 2);
            mesh.scale.set(scale, scale, scale);
        } else if (progress < 1.0) {
            // Contracción
            const scale = peakScale - (peakScale - originalScale) * ((progress - 0.5) * 2);
            mesh.scale.set(scale, scale, scale);
        } else {
            // Final
            mesh.scale.set(originalScale, originalScale, originalScale);
            return;
        }

        requestAnimationFrame(pulse);
    };
    pulse();
}

/**
 * Carga los datos específicos del contaminante en el panel dinámico
 * @param {string} continentKey 
 */
function loadPollutantData(continentKey) {
    const data = GLOBAL_POLLUTION_DATA[continentKey];
    if (!data) return;

    // Actualizar títulos
    document.getElementById('continent-title').textContent = data.title;
    document.getElementById('continent-intro').textContent = "Principales contaminantes y riesgos según la investigación:";
    document.getElementById('citation-box').querySelector('p').textContent = `Fuente: ${data.citation}`;

    const cardsContainer = document.getElementById('pollutant-data-cards');
    cardsContainer.innerHTML = ''; // Limpiar tarjetas anteriores
    
    // Generar las tarjetas de contaminantes
    data.pollutants.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pollutant-data-card';
        card.style.borderLeftColor = p.color; // Borde color-coded
        
        // Tooltip (Efectos en salud - usando el atributo title)
        card.title = p.description;

        card.innerHTML = `
            <h3><i class="material-icons">${p.icon}</i>${p.name}</h3>
            <p class="pollutant-description">${p.description}</p>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${p.level}%; background-color: ${p.color};"></div>
            </div>
            <p class="text-xs text-gray-400 mt-1 text-right">${p.level}% Nivel Relativo</p>
        `;
        cardsContainer.appendChild(card);
    });
}


/**
 * Bucle principal de animación y renderizado
 */
function animate() {
    requestAnimationFrame(animate);

    // Rotar la tierra y los continentes para dinamismo
    if (earth) {
        earth.rotation.y += 0.002;
        continentsGroup.rotation.y += 0.002;
    }

    // 1. Detección de Hover (Raycasting)
    if (continentsGroup) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(continentsGroup.children);

        if (intersects.length > 0) {
            // Un continente ha sido intersectado
            if (INTERSECTED != intersects[0].object) {
                // Restaurar color del objeto anterior
                if (INTERSECTED) INTERSECTED.material.color.set(INTERSECTED.userData.originalColor);

                INTERSECTED = intersects[0].object;
                
                // Resaltar el nuevo objeto (Hover effect)
                INTERSECTED.material.color.set(0xffffff); 
            }
        } else {
            // No hay intersección
            if (INTERSECTED) INTERSECTED.material.color.set(INTERSECTED.userData.originalColor);
            INTERSECTED = null;
        }
    }

    // 2. Renderizar
    renderer.render(scene, camera);
}


// Iniciar el mapa 3D al cargar la ventana
window.onload = function() {
    // Asegurarse de que initThreeJS se llama después de cargar las imágenes si las hubiera.
    // En este caso, como no hay texturas pesadas, llamamos directamente.
    initThreeJS();
    // Iniciar el script de la infografía anterior
    // Ya se inicia en scripts.js, pero para evitar problemas de orden
    // podrías mover toda la lógica de scripts.js aquí o asegurarte de que
    // el init del carrusel y AQI se ejecuten sin depender del onload global.
};
