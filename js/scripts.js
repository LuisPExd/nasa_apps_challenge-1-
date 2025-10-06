// =================================================================
// RUTAS DE IMAGENES CENTRALIZADAS (Por favor, usa la carpeta 'img/' con estos nombres)
// =================================================================
const SLIDE_IMAGES = [
    'img/earth_from_space_01.png', 
    'img/satellite_view_02.png',
    'img/air_quality_map_03.png',
    'img/nasa_challenge_04.png'
];


// =================================================================
// LÓGICA DEL HEADER FIJO (STICKY NAV)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('main-header');
    const heroSection = document.getElementById('hero-section');
    
    // Función para manejar el cambio de clase al hacer scroll
    const handleScroll = () => {
        // Obtenemos la altura de la sección principal (hero)
        const heroHeight = heroSection ? heroSection.offsetHeight : 500;
        
        // El punto de activación (scrollThreshold) es el 80% del alto de la sección inicial
        const scrollThreshold = heroHeight * 0.8;

        if (window.scrollY > scrollThreshold) {
            header.classList.add('header-fixed');
            header.classList.remove('header-initial');
            // Cambiar color de los enlaces cuando es fijo
            document.querySelectorAll('.nav-link').forEach(link => link.style.color = 'var(--color-text-dark)');
        } else {
            header.classList.remove('header-fixed');
            header.classList.add('header-initial');
            // Restaurar color de los enlaces cuando es transparente
            document.querySelectorAll('.nav-link').forEach(link => link.style.color = 'white');
        }
    };

    // Inicializar y agregar el listener
    if (header) {
        window.addEventListener('scroll', handleScroll);
        // Llamada inicial para corregir si se recarga la página con scroll
        handleScroll(); 
    }
});


// =================================================================
// LÓGICA DEL CARRUSEL AUTOMÁTICO
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const indicators = document.querySelectorAll('.indicator');
    let currentSlide = 0;
    const intervalTime = 5000; // 5 segundos

    // Función para mostrar un slide específico
    const showSlide = (index) => {
        slides.forEach((slide, i) => {
            slide.classList.remove('current-slide');
            indicators[i].classList.remove('active');
            
            // Asigna la imagen dinámicamente usando el array de SLIDE_IMAGES
            if (i < SLIDE_IMAGES.length) {
                slide.style.backgroundImage = `url('${SLIDE_IMAGES[i]}')`;
            }
        });

        if (slides[index] && indicators[index]) {
            slides[index].classList.add('current-slide');
            indicators[index].classList.add('active');
            currentSlide = index;
        }
    };

    // Función para avanzar al siguiente slide
    const nextSlide = () => {
        const nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    };

    // Iniciar el carrusel automático
    if (slides.length > 0) {
        let slideInterval = setInterval(nextSlide, intervalTime);

        // Permitir la navegación manual con los indicadores
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                // Detener el carrusel, mostrar la diapositiva y reiniciar el temporizador
                clearInterval(slideInterval);
                showSlide(index);
                slideInterval = setInterval(nextSlide, intervalTime);
            });
        });

        // Mostrar el primer slide al cargar la página
        showSlide(0);
    }
});


// =================================================================
// LÓGICA DE INFOGRAFÍA INTERACTIVA (CONTAMINANTES AQI)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.pollutant-card');
    const infoBox = document.getElementById('pollutant-info-box');
    const infoTitle = document.getElementById('info-box-title');
    const infoRisk = document.getElementById('info-box-risk');

    // Información resumida de los contaminantes 
    const POLLUTANT_DATA = {
        'O3': {
            title: "Ozone (O3)",
            risk: "Mainly affects the lungs and airways. Active children and people with asthma should reduce outdoor activity at Unhealthy AQI levels (151+)."
        },
        'PM2.5': {
            title: "Fine Particulate Matter (PM2.5)",
            risk: "Penetrates deep into the lungs and bloodstream. People with heart or lung diseases, older adults, and children should avoid outdoor physical activity at Very Unhealthy AQI levels (201+)."
        },
        'PM10': {
            title: "Coarse Particulate Matter (PM10)",
            risk: "Affects the airways and can worsen heart diseases. Sensitive groups (heart/lung diseases) should reduce prolonged exertion outdoors at Unhealthy AQI levels (151+)."
        },
        'NO2': {
            title: "Nitrogen Dioxide (NO2)",
            risk: "Irritates the airways. Although it does not have specific advice on the displayed scale, its presence is linked to respiratory risks, especially for people with asthma."
        },
        'CO': {
            title: "Carbon Monoxide (CO)",
            risk: "Reduces the blood's ability to carry oxygen. People with heart diseases, such as angina, should avoid exposure and sources like heavy traffic at Unhealthy AQI levels (151+)."
        }
    };
    
    // Asignar el listener de clic a cada tarjeta
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const pollutantKey = card.getAttribute('data-pollutant');
            const data = POLLUTANT_DATA[pollutantKey];
            
            if (data) {
                // Limpiar el estado activo anterior y establecer el nuevo
                cards.forEach(c => c.classList.remove('pollutant-card-active'));
                card.classList.add('pollutant-card-active');

                // Mostrar la caja de información
                infoTitle.textContent = data.title;
                infoRisk.textContent = data.risk;
                infoBox.classList.remove('hidden');
            }
        });
    });
});


