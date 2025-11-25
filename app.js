const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyEKKl4vh-uhDKN5Wan-5V0U4jUFt7fLSnyPgPhpKDginiVTlTBCYfEq98WZynpYJF_gg/exec';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEYS = {
    solicitudes: 'cache_solicitudes',
    productos: 'cache_productos',
    usuarios: 'cache_usuarios',
    disponibilidad: 'cache_disponibilidad'
};

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Cache utilities
const CacheManager = {
    set(key, data) {
        const item = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(item));
    },
    
    get(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        const parsed = JSON.parse(item);
        const now = Date.now();
        
        if (now - parsed.timestamp > CACHE_DURATION) {
            localStorage.removeItem(key);
            return null;
        }
        
        return parsed.data;
    },
    
    clear() {
        Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    }
};

let allSolicitudes = [];
let allProductos = [];
let allUsuariosDisponibles = [];
let allDisponibilidad = {};
let currentUser = { email: null, name: null, nivel: null, isAuthenticated: false, id: null };
let charts = {};
let currentDisponibilidadMonth = new Date();
let selectedDates = [];
let lastSolicitudCount = 0;
let notificationCheckInterval = null;
let darkMode = localStorage.getItem('darkMode') === 'true';
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;
let paginatedData = [];

const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    app: document.getElementById('app'),
    loginButton: document.getElementById('loginButton'),
    signOutButton: document.getElementById('signOutButton'),
    loginModal: document.getElementById('loginModal'),
    closeLoginModalBtn: document.getElementById('closeLoginModalBtn'),
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginMessage: document.getElementById('loginMessage'),
    userNameDisplay: document.getElementById('userNameDisplay'),
    userNameText: document.getElementById('userNameText'),
    solicitudesTab: document.getElementById('solicitudesTab'),
    dashboardTab: document.getElementById('dashboardTab'),
    reportesTab: document.getElementById('reportesTab'),
    produccionTab: document.getElementById('produccionTab'),
    disponibilidadTab: document.getElementById('disponibilidadTab'),
    solicitudesView: document.getElementById('solicitudesView'),
    dashboardView: document.getElementById('dashboardView'),
    reportesView: document.getElementById('reportesView'),
    produccionView: document.getElementById('produccionView'),
    disponibilidadView: document.getElementById('disponibilidadView'),
    solicitudesList: document.getElementById('solicitudesList'),
    addSolicitudBtn: document.getElementById('addSolicitudBtn'),
    solicitudModal: document.getElementById('solicitudModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    solicitudForm: document.getElementById('solicitudForm'),
    cancelFormBtn: document.getElementById('cancelFormBtn'),
    productosContainer: document.getElementById('productosContainer'),
    notificationContainer: document.getElementById('notificationContainer'),
    totalSolicitudes: document.getElementById('totalSolicitudes'),
    solicitudesActivas: document.getElementById('solicitudesActivas'),
    solicitudesFinalizadas: document.getElementById('solicitudesFinalizadas'),
    totalProductosActivos: document.getElementById('totalProductosActivos'),
    solicitudUser: document.getElementById('solicitudUser'),
    solicitudEmail: document.getElementById('solicitudEmail'),
    solicitudDate: document.getElementById('solicitudDate'),
    solicitudType: document.getElementById('solicitudType'),
    solicitudLocation: document.getElementById('solicitudLocation'),
    solicitudComments: document.getElementById('solicitudComments'),
    reportTableBody: document.getElementById('reportTableBody'),
    reportFilter: document.getElementById('reportFilter'),
    searchInput: document.getElementById('searchInput'),
    produccionTableBody: document.getElementById('produccionTableBody'),
    produccionFilter: document.getElementById('produccionFilter'),
    produccionUserFilter: document.getElementById('produccionUserFilter'),
    produccionSearchInput: document.getElementById('produccionSearchInput'),
    solicitudesEstadoFilter: document.getElementById('solicitudesEstadoFilter'),
    solicitudesDestinoFilter: document.getElementById('solicitudesDestinoFilter'),
    solicitudesFechaFilter: document.getElementById('solicitudesFechaFilter'),
    sidebar: document.getElementById('sidebar'),
    menuBtn: document.getElementById('menuBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    backdrop: document.getElementById('backdrop'),
    disponibilidadUserSelect: document.getElementById('disponibilidadUserSelect'),
    currentMonthYear: document.getElementById('currentMonthYear'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    calendar: document.getElementById('calendar'),
    saveDisponibilidadBtn: document.getElementById('saveDisponibilidadBtn'),
    modalTitle: document.getElementById('modalTitle'),
    submitBtnText: document.getElementById('submitBtnText'),
    editSolicitudId: document.getElementById('editSolicitudId'),
    detailModal: document.getElementById('detailModal'),
    closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
    detailModalContent: document.getElementById('detailModalContent'),
};

/**
 * Función de inicialización: Muestra solo el modal de login al cargar la página.
 */
function initializeApp() {
    elements.loadingScreen.classList.add('hidden');
    elements.loginModal.classList.remove('hidden');
    elements.app.classList.add('hidden');
    elements.sidebar.classList.add('hidden');
}

// Update clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const clockElement = document.getElementById('currentTime');
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}
setInterval(updateClock, 1000);
updateClock();

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        new: 'fa-bell'
    };
    const colors = {
        success: 'from-green-500 to-green-600',
        error: 'from-red-500 to-red-600',
        info: 'from-blue-500 to-blue-600',
        warning: 'from-yellow-500 to-yellow-600',
        new: 'from-purple-500 to-indigo-600'
    };
    
    notification.className = `notification-enter bg-gradient-to-r ${colors[type]} text-white px-6 py-5 rounded-2xl shadow-2xl flex items-center space-x-4 max-w-md transform transition-all duration-300 border-2 border-white border-opacity-30`;
    notification.innerHTML = `
        <div class="w-12 h-12 rounded-full bg-white bg-opacity-30 flex items-center justify-center animate-pulse">
            <i class="fas ${icons[type]} text-2xl"></i>
        </div>
        <div class="flex-1">
            <p class="font-bold text-base mb-1">Sistema PULPA</p>
            <p class="text-sm font-medium opacity-95">${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all">
            <i class="fas fa-times text-lg"></i>
        </button>
    `;
    
    elements.notificationContainer.appendChild(notification);
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 6000);
}

function startNotificationCheck() {
    if (currentUser.nivel == 1) {
        notificationCheckInterval = setInterval(async () => {
            await checkForNewSolicitudes();
        }, 30000);
    }
}

function stopNotificationCheck() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
        notificationCheckInterval = null;
    }
}

async function checkForNewSolicitudes() {
    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getSolicitudes&userEmail=admin`);
        const result = await response.json();
        
        if (result.success) {
            const currentCount = result.data.length;
            
            if (lastSolicitudCount > 0 && currentCount > lastSolicitudCount) {
                const newCount = currentCount - lastSolicitudCount;
                const message = `¡${newCount} nueva${newCount > 1 ? 's' : ''} solicitud${newCount > 1 ? 'es' : ''} recibida${newCount > 1 ? 's' : ''}!`;
                
                // Toast notification mejorada
                showNotification(message, 'new');
                
                // Push notification con sonido
                if ('Notification' in window && Notification.permission === 'granted') {
                    showPushNotification('🔔 Nueva Solicitud - PULPA FDC', {
                        body: `${message}\n¡Revisa las solicitudes pendientes!`,
                        icon: './icons/icon-192x192.png',
                        badge: './icons/badge-72x72.png',
                        tag: 'new-solicitud',
                        requireInteraction: true,
                        vibrate: [200, 100, 200, 100, 200, 100, 400],
                        data: {
                            url: window.location.href,
                            dateOfArrival: Date.now(),
                            newCount: newCount
                        },
                        actions: [
                            {
                                action: 'view',
                                title: '👀 Ver Solicitudes',
                                icon: './icons/icon-96x96.png'
                            },
                            {
                                action: 'close',
                                title: 'Cerrar'
                            }
                        ]
                    });
                }
                
                // Sonido de notificación
                playNotificationSound();
                
                // Actualizar datos
                await loadData();
            }
            
            lastSolicitudCount = currentCount;
        }
    } catch (error) {
        console.error('Error al verificar nuevas solicitudes:', error);
    }
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Tono 1 - Nota agradable
        const oscillator1 = audioContext.createOscillator();
        const gainNode1 = audioContext.createGain();
        
        oscillator1.connect(gainNode1);
        gainNode1.connect(audioContext.destination);
        
        oscillator1.frequency.value = 800; // Do alto
        oscillator1.type = 'sine';
        
        gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.3);
        
        // Tono 2 - Segunda nota (acorde)
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();
            
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);
            
            oscillator2.frequency.value = 1000; // Mi alto
            oscillator2.type = 'sine';
            
            gainNode2.gain.setValueAtTime(0.25, audioContext.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.4);
        }, 100);
        
    } catch (e) {
        console.log('No se pudo reproducir el sonido de notificación');
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view-content').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('animate-fadeIn');
    });
    
    const targetView = document.getElementById(viewId);
    targetView.classList.remove('hidden');
    setTimeout(() => targetView.classList.add('animate-fadeIn'), 10);
    
    document.querySelectorAll('a[id$="Tab"]').forEach(tab => {
        tab.classList.remove('tab-active');
        tab.classList.add('tab-inactive');
    });
    
    const targetTab = document.getElementById(`${viewId.replace('View', 'Tab')}`);
    if (targetTab) {
        targetTab.classList.remove('tab-inactive');
        targetTab.classList.add('tab-active');
    }
    
    // Analytics tracking
    Analytics.trackPageView(viewId.replace('View', ''));
    
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
}

function toggleSidebar() {
    const sidebar = elements.sidebar;
    const backdrop = elements.backdrop;
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        backdrop.classList.remove('hidden');
    } else {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Verificando...';
    
    try {
        const url = new URL(GOOGLE_APPS_SCRIPT_URL);
        url.searchParams.append('action', 'login');
        url.searchParams.append('email', email);
        url.searchParams.append('password', password);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            currentUser = {
                id: result.data.id,
                email: result.data.correo,
                name: result.data.nombre,
                nivel: result.data.nivel,
                isAuthenticated: true,
            };
            
            // Analytics tracking
            Analytics.trackLogin(currentUser.nivel);
            
            elements.loginModal.classList.add('hidden'); // Oculta el modal de login
            
            elements.userNameText.textContent = `${currentUser.name} (Nivel ${currentUser.nivel})`;
            elements.userNameDisplay.classList.remove('hidden');
            
            setupAppForUserRole(); // Prepara los botones y pestañas de la app
            
            await loadData(); // Llama a loadData, que mostrará la app
            
            if (currentUser.nivel == 1) {
                startNotificationCheck();
            }
            
            showNotification('¡Bienvenido! Sesión iniciada correctamente.', 'success');
        } else {
            elements.loginMessage.textContent = result.error || 'Credenciales inválidas.';
        }
    } catch (error) {
        console.error('Login error:', error);
        elements.loginMessage.textContent = 'Error de conexión. Inténtalo de nuevo.';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Ingresar';
    }
}

function setupAppForUserRole() {
    elements.loginButton.classList.add('hidden');
    elements.signOutButton.classList.remove('hidden');
    
    if (currentUser.nivel == 1) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.produccion-only').forEach(el => el.classList.remove('hidden'));
        switchView('dashboardView');
    } else if (currentUser.nivel == 3) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.produccion-only').forEach(el => el.classList.remove('hidden'));
        switchView('solicitudesView');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.produccion-only').forEach(el => el.classList.add('hidden'));
        switchView('solicitudesView');
    }
}

async function loadData() {
    elements.loadingScreen.classList.remove('hidden');
    elements.app.classList.add('hidden');
    elements.sidebar.classList.add('hidden');
    
    try {
        let solicitudEmailParam = 'guest';
        if (currentUser.isAuthenticated) {
            if (currentUser.nivel == 1 || currentUser.nivel == 3) {
                solicitudEmailParam = 'admin'; 
            } else {
                solicitudEmailParam = currentUser.email;
            }
        }

        // Try to get cached data first
        const cachedProductos = CacheManager.get(CACHE_KEYS.productos);
        const cachedSolicitudes = CacheManager.get(CACHE_KEYS.solicitudes);
        const cachedUsuarios = CacheManager.get(CACHE_KEYS.usuarios);
        const cachedDisponibilidad = CacheManager.get(CACHE_KEYS.disponibilidad);

        // Use cache if available, otherwise fetch
        const fetchPromises = [];
        
        if (!cachedProductos) {
            fetchPromises.push(fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getProductos`).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve({ success: true, data: cachedProductos }));
        }
        
        if (!cachedSolicitudes) {
            fetchPromises.push(fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getSolicitudes&userEmail=${solicitudEmailParam}`).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve({ success: true, data: cachedSolicitudes }));
        }
        
        if (!cachedUsuarios) {
            fetchPromises.push(fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getUsuariosDisponibles`).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve({ success: true, data: cachedUsuarios }));
        }
        
        if (!cachedDisponibilidad) {
            fetchPromises.push(fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getDisponibilidad`).then(r => r.json()));
        } else {
            fetchPromises.push(Promise.resolve({ success: true, data: cachedDisponibilidad }));
        }

        const [productosData, solicitudesData, usuariosDisponiblesData, disponibilidadData] = await Promise.all(fetchPromises);
        
        if (productosData.success) {
            allProductos = productosData.data;
            if (!cachedProductos) CacheManager.set(CACHE_KEYS.productos, allProductos);
            renderProductosForForm();
        }
        
        if (solicitudesData.success) {
            allSolicitudes = solicitudesData.data;
            if (!cachedSolicitudes) CacheManager.set(CACHE_KEYS.solicitudes, allSolicitudes);
            
            if (currentUser.nivel == 1) {
                lastSolicitudCount = allSolicitudes.length;
            }
            
            renderSolicitudes();
        }
        
        if (usuariosDisponiblesData.success) {
            allUsuariosDisponibles = usuariosDisponiblesData.data;
            if (!cachedUsuarios) CacheManager.set(CACHE_KEYS.usuarios, allUsuariosDisponibles);
            renderUsuariosDisponiblesSelect();
        }
        
        if (disponibilidadData.success) {
            allDisponibilidad = disponibilidadData.data;
            if (!cachedDisponibilidad) CacheManager.set(CACHE_KEYS.disponibilidad, allDisponibilidad);
        }
        
        if (currentUser.nivel == 1) {
            updateDashboard();
            renderReportTable();
            renderCalendar();
            renderProduccionTable();
            populateProduccionUserFilter();
        } else if (currentUser.nivel == 3) {
            renderProduccionTable();
            populateProduccionUserFilter();
        }
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showNotification('Error al cargar datos: ' + error.message, 'error');
    } finally {
        elements.loadingScreen.classList.add('hidden');
        elements.app.classList.remove('hidden');
        elements.sidebar.classList.remove('hidden');
    }
}

function renderSolicitudes() {
    const list = elements.solicitudesList;
    list.innerHTML = '';
    
    let solicitudesToShow = allSolicitudes;
    if (currentUser.nivel !== 1) {
        solicitudesToShow = allSolicitudes.filter(sol => sol.Email === currentUser.email);
    }
    
    // Filtro por estado
    const estadoFilter = elements.solicitudesEstadoFilter ? elements.solicitudesEstadoFilter.value : 'all';
    if (estadoFilter === 'active') {
        solicitudesToShow = solicitudesToShow.filter(sol => sol.Activa === true);
    } else if (estadoFilter === 'finalized') {
        solicitudesToShow = solicitudesToShow.filter(sol => sol.Activa === false);
    }
    
    // Filtro por destino
    const destinoFilter = elements.solicitudesDestinoFilter ? elements.solicitudesDestinoFilter.value.toLowerCase().trim() : '';
    if (destinoFilter) {
        solicitudesToShow = solicitudesToShow.filter(sol => 
            (sol.Comentarios && sol.Comentarios.toLowerCase().includes(destinoFilter))
        );
    }
    
    // Filtro por fecha
    const fechaFilter = elements.solicitudesFechaFilter ? elements.solicitudesFechaFilter.value : '';
    if (fechaFilter) {
        solicitudesToShow = solicitudesToShow.filter(sol => {
            if (!sol.Fecha) return false;
            const solicitudFecha = sol.Fecha.split('T')[0];
            return solicitudFecha === fechaFilter;
        });
    }
    
    if (solicitudesToShow.length === 0) {
        list.innerHTML = `
            <div class="glass-effect rounded-xl p-12 text-center">
                <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
                <p class="text-gray-500 text-lg">No hay solicitudes para mostrar</p>
                <p class="text-gray-400 text-sm mt-2">Ajusta los filtros o crea una nueva solicitud</p>
            </div>
        `;
        return;
    }
    
    // Paginación
    const paginatedSolicitudes = paginateData(solicitudesToShow, currentPage);
    
    paginatedSolicitudes.forEach(solicitud => {
        const item = document.createElement('div');
        item.className = 'glass-effect rounded-2xl p-4 md:p-6 shadow-lg card-hover';
        
        let productosHTML = '';
        try {
            const productos = JSON.parse(solicitud.Productos || '{}');
            productosHTML = Object.entries(productos)
                .map(([nombre, cantidad]) => `
                    <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <span class="text-sm md:text-base text-gray-600">${nombre}</span>
                        <span class="text-base md:text-lg font-semibold text-purple-600">${cantidad}</span>
                    </div>
                `).join('');
        } catch (e) {
            console.error("Error parsing Productos JSON:", e);
        }
        
        const statusClass = solicitud.Activa ? 'status-active' : 'status-inactive';
        const statusText = solicitud.Activa ? 'Activa' : 'Finalizada';
        const statusIcon = solicitud.Activa ? 'fa-check-circle' : 'fa-times-circle';
        
        const editButton = solicitud.Activa && currentUser.email === solicitud.Email ? `
            <button onclick="editSolicitud('${solicitud.ID}')" class="bg-blue-500 text-white py-2 px-3 md:px-4 rounded-lg hover:bg-blue-600 transition-all text-sm font-medium shadow-md">
                <i class="fas fa-edit mr-1"></i><span class="hidden md:inline">Editar</span>
            </button>
        ` : '';
        
        item.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2 flex-wrap">
                        <h4 class="text-lg md:text-xl font-bold text-gray-800">${solicitud.ID}</h4>
                        <span class="status-badge ${statusClass}">
                            <i class="fas ${statusIcon} mr-1"></i>${statusText}
                        </span>
                    </div>
                    <p class="text-xs md:text-sm text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>${solicitud.Fecha ? solicitud.Fecha.split('T')[0] : 'N/A'}
                    </p>
                </div>
                <div class="flex space-x-2">
                    ${editButton}
                    <button onclick="showSolicitudDetail('${solicitud.ID}')" class="bg-purple-500 text-white py-2 px-3 md:px-4 rounded-lg hover:bg-purple-600 transition-all text-sm font-medium shadow-md">
                        <i class="fas fa-eye mr-1"></i><span class="hidden md:inline">Ver</span>
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-xs text-gray-500 mb-1">Usuario</p>
                    <p class="font-medium text-gray-800 text-sm md:text-base truncate">${solicitud.Usuario}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-xs text-gray-500 mb-1">Ubicación</p>
                    <p class="font-medium text-gray-800 text-sm md:text-base truncate">
                        <i class="fas fa-map-marker-alt text-red-500 mr-1"></i>${solicitud.Ubicacion}
                    </p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-xs text-gray-500 mb-1">Tipo</p>
                    <p class="font-medium text-gray-800 text-sm md:text-base">${solicitud.Tipo}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-xs text-gray-500 mb-1">Destino</p>
                    <p class="font-medium text-gray-800 text-sm md:text-base truncate">${solicitud.Comentarios || 'N/A'}</p>
                </div>
            </div>
            
            <div class="bg-purple-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-purple-800 mb-3">
                    <i class="fas fa-box mr-2"></i>Productos Solicitados
                </p>
                <div class="space-y-1">
                    ${productosHTML}
                </div>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    // Renderizar paginación si hay más de una página
    if (solicitudesToShow.length > itemsPerPage) {
        renderPagination('solicitudesList', solicitudesToShow.length, 'renderSolicitudes');
    }
}

function showSolicitudDetail(solicitudId) {
    const solicitud = allSolicitudes.find(s => s.ID === solicitudId);
    if (!solicitud) return;
    
    let productosHTML = '';
    try {
        const productos = JSON.parse(solicitud.Productos || '{}');
        productosHTML = Object.entries(productos)
            .map(([nombre, cantidad]) => `
                <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                    <span class="text-gray-700 font-medium">${nombre}</span>
                    <span class="text-xl font-bold text-purple-600">${cantidad}</span>
                </div>
            `).join('');
    } catch (e) {
        productosHTML = '<p class="text-gray-500">No hay productos especificados</p>';
    }
    
    const statusClass = solicitud.Activa ? 'status-active' : 'status-inactive';
    const statusText = solicitud.Activa ? 'Activa' : 'Finalizada';
    const statusIcon = solicitud.Activa ? 'fa-check-circle' : 'fa-times-circle';
    
    elements.detailModalContent.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h4 class="text-2xl font-bold text-gray-800">Solicitud ${solicitud.ID}</h4>
                <span class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon} mr-1"></i>${statusText}
                </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-calendar mr-1"></i>Fecha</p>
                    <p class="font-semibold text-gray-800">${solicitud.Fecha ? solicitud.Fecha.split('T')[0] : 'N/A'}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-user mr-1"></i>Usuario</p>
                    <p class="font-semibold text-gray-800">${solicitud.Usuario}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-envelope mr-1"></i>Correo</p>
                    <p class="font-semibold text-gray-800">${solicitud.Email}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-map-marker-alt mr-1"></i>Ubicación</p>
                    <p class="font-semibold text-gray-800">${solicitud.Ubicacion}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-tag mr-1"></i>Tipo</p>
                    <p class="font-semibold text-gray-800">${solicitud.Tipo}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-store mr-1"></i>Destino</p>
                    <p class="font-semibold text-gray-800">${solicitud.Comentarios || 'N/A'}</p>
                </div>
            </div>
            
            <div class="bg-purple-50 rounded-lg p-6">
                <h5 class="text-lg font-bold text-purple-800 mb-4">
                    <i class="fas fa-box mr-2"></i>Productos Solicitados
                </h5>
                <div class="space-y-2">
                    ${productosHTML}
                </div>
            </div>
            
            ${solicitud.Responsable ? `
                <div class="bg-green-50 rounded-lg p-4">
                    <p class="text-sm text-gray-500 mb-1"><i class="fas fa-user-check mr-1"></i>Responsable</p>
                    <p class="font-semibold text-gray-800">${solicitud.Responsable}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    elements.detailModal.classList.remove('hidden');
}

window.showSolicitudDetail = showSolicitudDetail;

function editSolicitud(solicitudId) {
    const solicitud = allSolicitudes.find(s => s.ID === solicitudId);
    if (!solicitud || !solicitud.Activa) {
        showNotification('No se puede editar esta solicitud', 'error');
        return;
    }
    
    elements.modalTitle.textContent = 'Editar Solicitud';
    elements.submitBtnText.textContent = 'Actualizar Solicitud';
    elements.editSolicitudId.value = solicitudId;
    
    elements.solicitudDate.value = solicitud.Fecha ? solicitud.Fecha.split('T')[0] : '';
    elements.solicitudType.value = solicitud.Tipo;
    elements.solicitudLocation.value = solicitud.Ubicacion;
    elements.solicitudComments.value = solicitud.Comentarios || '';
    elements.solicitudUser.value = solicitud.Usuario;
    elements.solicitudEmail.value = solicitud.Email;
    
    try {
        const productos = JSON.parse(solicitud.Productos || '{}');
        Object.entries(productos).forEach(([nombre, cantidad]) => {
            const input = document.getElementById(`cantidad-${nombre}`);
            if (input) {
                input.value = cantidad;
            }
        });
    } catch (e) {
        console.error("Error parsing productos:", e);
    }
    
    elements.solicitudModal.classList.remove('hidden');
}

window.editSolicitud = editSolicitud;

function renderProductosForForm() {
    const container = elements.productosContainer;
    container.innerHTML = '';
    
    allProductos.filter(p => p.Activo).forEach(producto => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-sm border-2 border-gray-200 p-4 hover:border-purple-400 transition-all';
        div.innerHTML = `
            <div class="text-center">
                <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                    <i class="fas fa-box text-purple-600 text-xl"></i>
                </div>
                <h5 class="text-sm font-semibold text-gray-800 mb-3">${producto.Nombre}</h5>
                <input type="number" 
                       id="cantidad-${producto.Nombre}" 
                       name="cantidad-${producto.Nombre}" 
                       min="0" 
                       value="0" 
                       class="input-modern w-full text-center p-2 rounded-lg text-lg font-bold" 
                       placeholder="0" />
            </div>
        `;
        container.appendChild(div);
    });
}

function updateDashboard() {
    if (currentUser.nivel != 1) return;
    
    if (elements.totalSolicitudes) elements.totalSolicitudes.textContent = allSolicitudes.length;
    
    const activas = allSolicitudes.filter(s => s.Activa === true).length;
    if (elements.solicitudesActivas) elements.solicitudesActivas.textContent = activas;
    
    const finalizadas = allSolicitudes.filter(s => s.Activa === false).length;
    if (elements.solicitudesFinalizadas) elements.solicitudesFinalizadas.textContent = finalizadas;
    
    const productosActivos = allProductos.filter(p => p.Activo).length;
    if (elements.totalProductosActivos) elements.totalProductosActivos.textContent = productosActivos;
    
    if (allSolicitudes.length > 0) {
        renderTopProductsChart();
        renderLocationChart();
        renderTypeChart();
        renderTrendChart();
    }
}

function renderTopProductsChart() {
    const chartCanvas = document.getElementById('topProductsChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    const productCounts = {};
    
    allSolicitudes.forEach(s => {
        try {
            const productos = JSON.parse(s.Productos || '{}');
            for (const [producto, cantidad] of Object.entries(productos)) {
                productCounts[producto] = (productCounts[producto] || 0) + parseInt(cantidad);
            }
        } catch(e) {}
    });
    
    const sortedProducts = Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
    
    const labels = sortedProducts.map(p => p[0]);
    const data = sortedProducts.map(p => p[1]);
    
    if (charts.topProducts) charts.topProducts.destroy();
    
    charts.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidad Solicitada',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderLocationChart() {
    const chartCanvas = document.getElementById('locationChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    const locationCounts = {};
    
    allSolicitudes.forEach(s => {
        const location = s.Ubicacion || 'Sin Ubicación';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
    });
    
    const labels = Object.keys(locationCounts);
    const data = Object.values(locationCounts);
    
    if (charts.location) charts.location.destroy();
    
    charts.location = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solicitudes',
                data: data,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(237, 100, 166, 0.8)',
                    'rgba(255, 154, 158, 0.8)',
                    'rgba(250, 208, 196, 0.8)',
                ],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

function renderTypeChart() {
    const chartCanvas = document.getElementById('typeChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    const typeCounts = {};
    
    allSolicitudes.forEach(s => {
        const type = s.Tipo || 'Sin Tipo';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);
    
    if (charts.type) charts.type.destroy();
    
    charts.type = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solicitudes',
                data: data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                ],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

function renderTrendChart() {
    const chartCanvas = document.getElementById('trendChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    const monthCounts = {};
    
    allSolicitudes.forEach(s => {
        if (s.Fecha) {
            const date = new Date(s.Fecha);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1;
        }
    });
    
    const sortedMonths = Object.keys(monthCounts).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    });
    const data = sortedMonths.map(m => monthCounts[m]);
    
    if (charts.trend) charts.trend.destroy();
    
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solicitudes por Mes',
                data: data,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Helper function to format the product list for tables.
 */
function formatProductosList(productosJSON) {
    try {
        const productos = JSON.parse(productosJSON || '{}');
        const entries = Object.entries(productos);
        
        if (entries.length === 0) {
            return '<span class="text-gray-400 text-xs">N/A</span>';
        }
        
        return entries.map(([nombre, cantidad]) => `
            <div class="text-xs">
                <span class="font-medium text-gray-800">${nombre}:</span>
                <span class="text-purple-600 font-bold">${cantidad}</span>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error parsing Productos JSON:", e);
        return '<span class="text-red-500 text-xs">Error</span>';
    }
}

function renderReportTable() {
    const tbody = elements.reportTableBody;
    tbody.innerHTML = '';
    
    let solicitudesToRender = allSolicitudes;
    const filterValue = elements.reportFilter.value;
    
    if (filterValue === 'active') {
        solicitudesToRender = allSolicitudes.filter(sol => sol.Activa === true);
    } else if (filterValue === 'finalized') {
        solicitudesToRender = allSolicitudes.filter(sol => sol.Activa === false);
    }
    
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        solicitudesToRender = solicitudesToRender.filter(sol => 
            sol.ID.toLowerCase().includes(searchTerm) ||
            sol.Usuario.toLowerCase().includes(searchTerm) ||
            sol.Ubicacion.toLowerCase().includes(searchTerm)
        );
    }
    
    if (solicitudesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 text-gray-500">No hay datos de solicitudes para el reporte.</td></tr>';
        return;
    }
    
    solicitudesToRender.forEach(solicitud => {
        const row = document.createElement('tr');
        row.className = 'table-row-hover';
        
        const statusClass = solicitud.Activa ? 'status-active' : 'status-inactive';
        const statusText = solicitud.Activa ? 'Activa' : 'Finalizada';
        const statusIcon = solicitud.Activa ? 'fa-check-circle' : 'fa-times-circle';
        
        let responsableHtml = '';
        if (solicitud.Activa) {
            responsableHtml = `
                <select id="assign-${solicitud.ID}" data-id="${solicitud.ID}" class="assign-dropdown input-modern p-2 rounded-lg text-sm w-full">
                    <option value="">Seleccionar...</option>
                    ${allUsuariosDisponibles.map(user => `<option value="${user.ID}">${user.Nombre}</option>`).join('')}
                </select>
            `;
        } else {
            responsableHtml = `<span class="text-sm text-gray-600">${solicitud.Responsable || 'N/A'}</span>`;
        }
        
        const actionButtonHtml = solicitud.Activa ? `
            <button data-id="${solicitud.ID}" class="finalize-btn bg-green-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-600 transition-all shadow-md w-full">
                <i class="fas fa-check mr-1"></i>Finalizar
            </button>
        ` : `<span class="text-gray-400 text-sm">-</span>`;
        
        const formattedDate = solicitud.Fecha ? solicitud.Fecha.split('T')[0] : 'N/A';
        const productosHtml = formatProductosList(solicitud.Productos);
        
        row.innerHTML = `
            <td class="px-4 py-4 text-sm font-medium text-gray-900">${solicitud.ID}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${formattedDate}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${solicitud.Usuario}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${solicitud.Ubicacion}</td>
            <td class="px-4 py-4 text-sm text-gray-600 hidden lg:table-cell">${solicitud.Tipo}</td>
            <td class="px-4 py-4 text-sm text-gray-600 hidden xl:table-cell">${solicitud.Comentarios || 'N/A'}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${productosHtml}</td>
            <td class="px-4 py-4">
                <span class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon} mr-1"></i>${statusText}
                </span>
            </td>
            <td class="px-4 py-4">
                ${responsableHtml}
            </td>
            <td class="px-4 py-4 text-center">
                ${actionButtonHtml}
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    document.querySelectorAll('.finalize-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const dropdown = document.getElementById(`assign-${id}`);
            const responsableId = dropdown ? dropdown.value : null;
            const responsableName = dropdown && responsableId ? dropdown.options[dropdown.selectedIndex].text : null;
            
            if (!responsableId) {
                showNotification('Por favor, selecciona un responsable para finalizar la solicitud.', 'warning');
                return;
            }
            
            const solicitud = allSolicitudes.find(s => s.ID === id);
            const solicitudDate = solicitud.Fecha ? solicitud.Fecha.split('T')[0] : null;
            
            if (solicitudDate && allDisponibilidad[responsableId] && allDisponibilidad[responsableId].includes(solicitudDate)) {
                showNotification(`${responsableName} no está disponible en la fecha ${solicitudDate}.`, 'error');
                return;
            }
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Procesando...';
            
            const result = await postToGoogleSheets('finalizeSolicitud', { solicitudId: id, responsable: responsableName });
            
            if (result.success) {
                showNotification('Solicitud finalizada con éxito.', 'success');
                loadData();
            } else {
                showNotification('Error al finalizar la solicitud.', 'error');
                e.currentTarget.disabled = false;
                e.currentTarget.innerHTML = '<i class="fas fa-check mr-1"></i>Finalizar';
            }
        });
    });
}

function renderProduccionTable() {
    if (!elements.produccionTableBody) return;
    
    const tbody = elements.produccionTableBody;
    tbody.innerHTML = '';
    
    // Solo filtrar por tipo "Pedidos", NO por ubicación
    let solicitudesToRender = allSolicitudes.filter(sol => sol.Tipo === 'Pedidos');
    
    // Filtro por estado
    const filterValue = elements.produccionFilter ? elements.produccionFilter.value : 'all';
    if (filterValue === 'active') {
        solicitudesToRender = solicitudesToRender.filter(sol => sol.Activa === true);
    } else if (filterValue === 'finalized') {
        solicitudesToRender = solicitudesToRender.filter(sol => sol.Activa === false);
    }
    
    // Filtro por usuario
    const userFilterValue = elements.produccionUserFilter ? elements.produccionUserFilter.value : 'all';
    if (userFilterValue !== 'all') {
        solicitudesToRender = solicitudesToRender.filter(sol => sol.Usuario === userFilterValue);
    }
    
    // Búsqueda
    const searchTerm = elements.produccionSearchInput ? elements.produccionSearchInput.value.toLowerCase().trim() : '';
    if (searchTerm) {
        solicitudesToRender = solicitudesToRender.filter(sol => 
            sol.ID.toLowerCase().includes(searchTerm) ||
            sol.Usuario.toLowerCase().includes(searchTerm) ||
            (sol.Comentarios && sol.Comentarios.toLowerCase().includes(searchTerm)) ||
            sol.Ubicacion.toLowerCase().includes(searchTerm)
        );
    }
    
    if (solicitudesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center p-8 text-gray-500">No hay pedidos de producción para mostrar.</td></tr>';
        return;
    }
    
    solicitudesToRender.forEach(solicitud => {
        const row = document.createElement('tr');
        row.className = 'table-row-hover';
        
        const statusClass = solicitud.Activa ? 'status-active' : 'status-inactive';
        const statusText = solicitud.Activa ? 'Activa' : 'Finalizada';
        const statusIcon = solicitud.Activa ? 'fa-check-circle' : 'fa-times-circle';
        
        const actionButtonHtml = solicitud.Activa && currentUser.nivel == 3 ? `
            <button data-id="${solicitud.ID}" class="finalize-produccion-btn bg-green-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-600 transition-all shadow-md w-full">
                <i class="fas fa-check mr-1"></i>Finalizar
            </button>
        ` : solicitud.Activa && currentUser.nivel == 1 ? `
            <span class="text-gray-400 text-sm">Solo visualización</span>
        ` : `<span class="text-gray-400 text-sm">-</span>`;
        
        const formattedDate = solicitud.Fecha ? solicitud.Fecha.split('T')[0] : 'N/A';
        const productosHtml = formatProductosList(solicitud.Productos);
        
        row.innerHTML = `
            <td class="px-4 py-4 text-sm font-medium text-gray-900">${solicitud.ID}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${formattedDate}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${solicitud.Usuario}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${solicitud.Ubicacion}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${solicitud.Comentarios || 'N/A'}</td>
            <td class="px-4 py-4 text-sm text-gray-600">${productosHtml}</td>
            <td class="px-4 py-4">
                <span class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon} mr-1"></i>${statusText}
                </span>
            </td>
            <td class="px-4 py-4 text-center">
                ${actionButtonHtml}
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    document.querySelectorAll('.finalize-produccion-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Procesando...';
            
            const result = await postToGoogleSheets('finalizeSolicitud', { solicitudId: id, responsable: currentUser.name });
            
            if (result.success) {
                showNotification('Pedido finalizado con éxito.', 'success');
                Analytics.trackSolicitudFinalized(id);
                loadData();
            } else {
                showNotification('Error al finalizar el pedido.', 'error');
                e.currentTarget.disabled = false;
                e.currentTarget.innerHTML = '<i class="fas fa-check mr-1"></i>Finalizar';
            }
        });
    });
}

function renderUsuariosDisponiblesSelect() {
    const select = elements.disponibilidadUserSelect;
    select.innerHTML = allUsuariosDisponibles.map(user => `<option value="${user.ID}">${user.Nombre}</option>`).join('');
}

function populateProduccionUserFilter() {
    if (!elements.produccionUserFilter) return;
    
    // Obtener usuarios únicos de las solicitudes de tipo "Pedidos"
    const pedidos = allSolicitudes.filter(sol => sol.Tipo === 'Pedidos');
    const uniqueUsers = [...new Set(pedidos.map(sol => sol.Usuario))].sort();
    
    elements.produccionUserFilter.innerHTML = '<option value="all">Todos los usuarios</option>' +
        uniqueUsers.map(user => `<option value="${user}">${user}</option>`).join('');
}

function renderCalendar() {
    const userId = elements.disponibilidadUserSelect.value;
    selectedDates = allDisponibilidad[userId] ? [...allDisponibilidad[userId]] : [];
    elements.calendar.innerHTML = '';
    elements.currentMonthYear.textContent = currentDisponibilidadMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    
    const firstDayOfMonth = new Date(currentDisponibilidadMonth.getFullYear(), currentDisponibilidadMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDisponibilidadMonth.getFullYear(), currentDisponibilidadMonth.getMonth() + 1, 0);
    
    const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center font-bold text-gray-600 text-sm py-2';
        dayHeader.textContent = day;
        elements.calendar.appendChild(dayHeader);
    });
    
    for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
        const emptyCell = document.createElement('div');
        elements.calendar.appendChild(emptyCell);
    }
    
    for (let date = 1; date <= lastDayOfMonth.getDate(); date++) {
        const dateCell = document.createElement('button');
        const formattedDate = `${currentDisponibilidadMonth.getFullYear()}-${(currentDisponibilidadMonth.getMonth() + 1).toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;
        dateCell.textContent = date;
        dateCell.dataset.date = formattedDate;
        dateCell.className = 'p-3 rounded-lg transition-all font-medium';
        
        const isSelected = selectedDates.includes(formattedDate);
        if (isSelected) {
            dateCell.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600', 'shadow-md');
        } else {
            dateCell.classList.add('bg-white', 'text-gray-700', 'hover:bg-purple-100');
        }
        
        dateCell.addEventListener('click', () => {
            const index = selectedDates.indexOf(formattedDate);
            if (index > -1) {
                selectedDates.splice(index, 1);
                dateCell.classList.remove('bg-red-500', 'text-white', 'shadow-md');
                dateCell.classList.add('bg-white', 'text-gray-700');
            } else {
                selectedDates.push(formattedDate);
                dateCell.classList.remove('bg-white', 'text-gray-700');
                dateCell.classList.add('bg-red-500', 'text-white', 'shadow-md');
            }
        });
        
        elements.calendar.appendChild(dateCell);
    }
}

async function postToGoogleSheets(action, data) {
    try {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('data', JSON.stringify(data));
        
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData,
            redirect: 'follow',
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error en postToGoogleSheets:', error);
        return { success: false, error: 'Error de red. Inténtalo de nuevo.' };
    }
}

// Event Listeners
elements.prevMonthBtn.addEventListener('click', () => {
    currentDisponibilidadMonth.setMonth(currentDisponibilidadMonth.getMonth() - 1);
    renderCalendar();
});

elements.nextMonthBtn.addEventListener('click', () => {
    currentDisponibilidadMonth.setMonth(currentDisponibilidadMonth.getMonth() + 1);
    renderCalendar();
});

elements.disponibilidadUserSelect.addEventListener('change', renderCalendar);

elements.saveDisponibilidadBtn.addEventListener('click', async () => {
    const userId = elements.disponibilidadUserSelect.value;
    const result = await postToGoogleSheets('setDisponibilidad', { userId: userId, unavailableDates: selectedDates });
    
    if (result.success) {
        showNotification('Disponibilidad guardada con éxito.', 'success');
        await loadData();
        renderCalendar();
    } else {
        showNotification('Error al guardar la disponibilidad.', 'error');
    }
});

elements.reportFilter.addEventListener('change', renderReportTable);
elements.searchInput.addEventListener('input', debounce(renderReportTable, 300));

if (elements.produccionFilter) {
    elements.produccionFilter.addEventListener('change', renderProduccionTable);
}

if (elements.produccionUserFilter) {
    elements.produccionUserFilter.addEventListener('change', renderProduccionTable);
}

if (elements.produccionSearchInput) {
    elements.produccionSearchInput.addEventListener('input', debounce(renderProduccionTable, 300));
}

if (elements.solicitudesEstadoFilter) {
    elements.solicitudesEstadoFilter.addEventListener('change', renderSolicitudes);
}

if (elements.solicitudesDestinoFilter) {
    elements.solicitudesDestinoFilter.addEventListener('input', debounce(renderSolicitudes, 300));
}

if (elements.solicitudesFechaFilter) {
    elements.solicitudesFechaFilter.addEventListener('change', renderSolicitudes);
}

elements.loginButton.addEventListener('click', () => elements.loginModal.classList.remove('hidden'));
elements.closeLoginModalBtn.addEventListener('click', () => elements.loginModal.classList.add('hidden'));
elements.loginForm.addEventListener('submit', handleLogin);

elements.signOutButton.addEventListener('click', () => {
    stopNotificationCheck();
    currentUser = { email: null, name: null, nivel: null, isAuthenticated: false, id: null };
    
    // Oculta la app y el sidebar
    elements.app.classList.add('hidden');
    elements.sidebar.classList.add('hidden');
    
    // Muestra el modal de login
    elements.loginModal.classList.remove('hidden');
    
    // Resetea el formulario de login
    elements.emailInput.value = '';
    elements.passwordInput.value = '';
    elements.loginMessage.textContent = '';
    
    // Resetea los botones del sidebar para el próximo login
    elements.userNameDisplay.classList.add('hidden');
    elements.loginButton.classList.remove('hidden');
    elements.signOutButton.classList.add('hidden');
    
    showNotification('Sesión cerrada correctamente.', 'info');
});

elements.menuBtn.addEventListener('click', toggleSidebar);
elements.closeSidebarBtn.addEventListener('click', toggleSidebar);
elements.backdrop.addEventListener('click', toggleSidebar);

elements.solicitudesTab.addEventListener('click', (e) => { 
    e.preventDefault(); 
    switchView('solicitudesView'); 
    renderSolicitudes(); 
});

if (elements.dashboardTab) {
    elements.dashboardTab.addEventListener('click', (e) => { 
        e.preventDefault(); 
        switchView('dashboardView'); 
        updateDashboard(); 
    });
}

if (elements.reportesTab) {
    elements.reportesTab.addEventListener('click', (e) => { 
        e.preventDefault(); 
        switchView('reportesView'); 
        renderReportTable(); 
    });
}

if (elements.produccionTab) {
    elements.produccionTab.addEventListener('click', (e) => { 
        e.preventDefault(); 
        switchView('produccionView'); 
        renderProduccionTable(); 
    });
}

if (elements.disponibilidadTab) {
    elements.disponibilidadTab.addEventListener('click', (e) => { 
        e.preventDefault(); 
        switchView('disponibilidadView'); 
        renderCalendar(); 
    });
}

elements.addSolicitudBtn.addEventListener('click', () => {
    // La app no debería ser visible si no está autenticado,
    // pero esta comprobación se mantiene por seguridad.
    if (!currentUser.isAuthenticated) {
        showNotification('Debes iniciar sesión para hacer una solicitud.', 'error');
        return;
    }
    
    elements.modalTitle.textContent = 'Nueva Solicitud';
    elements.submitBtnText.textContent = 'Enviar Solicitud';
    elements.editSolicitudId.value = '';
    elements.solicitudForm.reset();
    elements.solicitudUser.value = currentUser.name;
    elements.solicitudEmail.value = currentUser.email;
    elements.solicitudDate.valueAsDate = new Date();
    
    document.querySelectorAll('#productosContainer input[type="number"]').forEach(input => {
        input.value = 0;
    });
    
    elements.solicitudModal.classList.remove('hidden');
});

elements.closeModalBtn.addEventListener('click', () => elements.solicitudModal.classList.add('hidden'));
elements.cancelFormBtn.addEventListener('click', () => elements.solicitudModal.classList.add('hidden'));
elements.closeDetailModalBtn.addEventListener('click', () => elements.detailModal.classList.add('hidden'));

elements.solicitudForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedProducts = {};
    document.querySelectorAll('#productosContainer input[type="number"]').forEach(input => {
        const productName = input.id.replace('cantidad-', '');
        const quantity = parseInt(input.value);
        if (quantity > 0) {
            selectedProducts[productName] = quantity;
        }
    });
    
    if (Object.keys(selectedProducts).length === 0) {
        showNotification('Por favor, ingresa una cantidad para al menos un producto.', 'warning');
        return;
    }
    
    const editId = elements.editSolicitudId.value;
    const isEdit = editId !== '';
    
    const solicitudData = {
        date: elements.solicitudDate.value,
        type: elements.solicitudType.value,
        location: elements.solicitudLocation.value,
        products: selectedProducts,
        comments: elements.solicitudComments.value,
        user: elements.solicitudUser.value,
        email: elements.solicitudEmail.value,
        userId: currentUser.id
    };
    
    if (isEdit) {
        solicitudData.solicitudId = editId;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Procesando...';
    
    const action = isEdit ? 'updateSolicitud' : 'addSolicitud';
    const result = await postToGoogleSheets(action, solicitudData);
    
    if (result.success) {
        const successMessage = isEdit ? '¡Solicitud actualizada exitosamente!' : '¡Solicitud creada exitosamente!';
        const productCount = Object.keys(selectedProducts).length;
        const totalItems = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);
        
        showNotification(`${successMessage} - ${productCount} producto(s), ${totalItems} unidades totales`, 'success');
        
        // Reproducir sonido de éxito
        playNotificationSound();
        
        elements.solicitudModal.classList.add('hidden');
        elements.solicitudForm.reset();
        loadData(); // Recarga los datos después de agregar/editar
    } else {
        showNotification('Error al procesar la solicitud. Inténtalo de nuevo.', 'error');
    }
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fas fa-paper-plane mr-2"></i>${isEdit ? 'Actualizar' : 'Enviar'} Solicitud`;
});

// Se cambia el listener 'load' para llamar a initializeApp en lugar de loadData
window.addEventListener('load', initializeApp);

// ============================================
// ENHANCED FEATURES
// ============================================

// Dark Mode Toggle
function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    
    // Analytics tracking
    Analytics.trackFeatureUse(darkMode ? 'dark_mode_enabled' : 'dark_mode_disabled');
    
    showNotification(darkMode ? 'Modo oscuro activado' : 'Modo claro activado', 'info');
}

// Export to CSV
function exportToCSV() {
    if (allSolicitudes.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }
    
    // Analytics tracking
    Analytics.trackExport('CSV');
    
    const headers = ['ID', 'Fecha', 'Usuario', 'Email', 'Ubicación', 'Tipo', 'Destino', 'Estado', 'Responsable'];
    const rows = allSolicitudes.map(sol => [
        sol.ID,
        sol.Fecha ? sol.Fecha.split('T')[0] : '',
        sol.Usuario,
        sol.Email,
        sol.Ubicacion,
        sol.Tipo,
        sol.Comentarios || '',
        sol.Activa ? 'Activa' : 'Finalizada',
        sol.Responsable || ''
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `solicitudes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Reporte exportado exitosamente', 'success');
}

// Confirmation Modal
function showConfirmModal(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 animate-fadeIn';
    modal.innerHTML = `
        <div class="glass-effect rounded-2xl p-8 max-w-md w-full shadow-2xl animate-bounceIn">
            <div class="text-center mb-6">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white">
                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">Confirmación</h3>
                <p class="text-gray-600">${message}</p>
            </div>
            <div class="flex gap-3">
                <button id="cancelBtn" class="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-300 transition-all">
                    <i class="fas fa-times mr-2"></i>Cancelar
                </button>
                <button id="confirmBtn" class="flex-1 btn-gradient text-white font-semibold py-3 rounded-xl shadow-lg">
                    <i class="fas fa-check mr-2"></i>Confirmar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#cancelBtn').onclick = () => modal.remove();
    modal.querySelector('#confirmBtn').onclick = () => {
        onConfirm();
        modal.remove();
    };
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Refresh Data Button
function refreshData() {
    CacheManager.clear();
    showNotification('Actualizando datos...', 'info');
    loadData();
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = elements.searchInput || elements.produccionSearchInput;
        if (searchInput && !searchInput.classList.contains('hidden')) {
            searchInput.focus();
        }
    }
    
    // Ctrl/Cmd + N: New Solicitud
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (currentUser.isAuthenticated && !elements.solicitudModal.classList.contains('hidden') === false) {
            elements.addSolicitudBtn.click();
        }
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
        if (!elements.solicitudModal.classList.contains('hidden')) {
            elements.solicitudModal.classList.add('hidden');
        }
        if (!elements.detailModal.classList.contains('hidden')) {
            elements.detailModal.classList.add('hidden');
        }
        if (!elements.loginModal.classList.contains('hidden') && currentUser.isAuthenticated) {
            elements.loginModal.classList.add('hidden');
        }
    }
});

// Improved Form Validation
function validateSolicitudForm() {
    const form = elements.solicitudForm;
    const requiredFields = [
        { element: elements.solicitudDate, name: 'Fecha' },
        { element: elements.solicitudType, name: 'Tipo' },
        { element: elements.solicitudLocation, name: 'Ubicación' }
    ];
    
    for (const field of requiredFields) {
        if (!field.element.value.trim()) {
            field.element.classList.add('border-red-500');
            showNotification(`El campo ${field.name} es requerido`, 'warning');
            field.element.focus();
            return false;
        } else {
            field.element.classList.remove('border-red-500');
        }
    }
    
    return true;
}

// Add visual feedback on form inputs
[elements.solicitudDate, elements.solicitudType, elements.solicitudLocation].forEach(input => {
    if (input) {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.classList.remove('border-red-500');
                this.classList.add('border-green-500');
            }
        });
        
        input.addEventListener('focus', function() {
            this.classList.remove('border-red-500', 'border-green-500');
        });
    }
});

// Performance monitoring
const PerformanceMonitor = {
    start(label) {
        performance.mark(`${label}-start`);
    },
    
    end(label) {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label)[0];
        console.log(`${label}: ${measure.duration.toFixed(2)}ms`);
    }
};

// Connection status indicator
window.addEventListener('online', () => {
    showNotification('Conexión restablecida', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Sin conexión a internet. Los cambios se guardarán cuando vuelvas a estar en línea.', 'warning');
});

// Auto-save form data to localStorage
function autoSaveForm() {
    const formData = {
        date: elements.solicitudDate.value,
        type: elements.solicitudType.value,
        location: elements.solicitudLocation.value,
        comments: elements.solicitudComments.value
    };
    localStorage.setItem('formDraft', JSON.stringify(formData));
}

// Restore form data
function restoreFormData() {
    const savedData = localStorage.getItem('formDraft');
    if (savedData) {
        const data = JSON.parse(savedData);
        if (data.date) elements.solicitudDate.value = data.date;
        if (data.type) elements.solicitudType.value = data.type;
        if (data.location) elements.solicitudLocation.value = data.location;
        if (data.comments) elements.solicitudComments.value = data.comments;
    }
}

// Clear draft after successful submission
function clearFormDraft() {
    localStorage.removeItem('formDraft');
}

// Add auto-save listeners
if (elements.solicitudForm) {
    ['solicitudDate', 'solicitudType', 'solicitudLocation', 'solicitudComments'].forEach(fieldName => {
        const element = elements[fieldName];
        if (element) {
            element.addEventListener('input', debounce(autoSaveForm, 500));
        }
    });
}

// ============================================
// ANALYTICS TRACKING
// ============================================

const Analytics = {
    track(eventName, eventParams = {}) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, eventParams);
        }
        console.log(`Analytics: ${eventName}`, eventParams);
    },
    
    trackPageView(pageName) {
        this.track('page_view', {
            page_title: pageName,
            page_location: window.location.href
        });
    },
    
    trackLogin(userLevel) {
        this.track('login', {
            method: 'email',
            user_level: userLevel
        });
    },
    
    trackSolicitudCreated(solicitudType) {
        this.track('solicitud_created', {
            solicitud_type: solicitudType
        });
    },
    
    trackSolicitudEdited(solicitudId) {
        this.track('solicitud_edited', {
            solicitud_id: solicitudId
        });
    },
    
    trackSolicitudFinalized(solicitudId) {
        this.track('solicitud_finalized', {
            solicitud_id: solicitudId
        });
    },
    
    trackExport(format) {
        this.track('export_data', {
            export_format: format
        });
    },
    
    trackSearch(searchTerm) {
        this.track('search', {
            search_term: searchTerm
        });
    },
    
    trackFeatureUse(featureName) {
        this.track('feature_use', {
            feature_name: featureName
        });
    }
};

console.log('%c🚀 Sistema PULPA - FDC ', 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; font-size: 16px; font-weight: bold; border-radius: 8px;');
console.log('%c✨ Versión Mejorada con Cache, Validaciones y Exportación', 'color: #667eea; font-size: 12px; font-weight: bold;');

// ============================================
// PAGINACIÓN REAL
// ============================================

function paginateData(data, page = 1) {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    totalPages = Math.ceil(data.length / itemsPerPage);
    return data.slice(start, end);
}

function renderPagination(containerId, totalItems, renderFunction) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const paginationDiv = document.getElementById(`${containerId}-pagination`) || document.createElement('div');
    paginationDiv.id = `${containerId}-pagination`;
    paginationDiv.className = 'flex items-center justify-between mt-6 p-4 glass-effect rounded-xl';
    
    totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationDiv.remove();
        return;
    }
    
    paginationDiv.innerHTML = `
        <div class="flex items-center space-x-2">
            <button onclick="changePage(${currentPage - 1}, '${renderFunction}')" 
                    ${currentPage === 1 ? 'disabled' : ''}
                    class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="text-sm font-semibold text-gray-700">
                Página <span class="text-purple-600">${currentPage}</span> de <span class="text-purple-600">${totalPages}</span>
                <span class="text-gray-500 ml-2">(${totalItems} registros)</span>
            </span>
            <button onclick="changePage(${currentPage + 1}, '${renderFunction}')" 
                    ${currentPage === totalPages ? 'disabled' : ''}
                    class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div class="flex items-center space-x-2">
            <label class="text-sm font-semibold text-gray-700">Items por página:</label>
            <select onchange="changeItemsPerPage(this.value, '${renderFunction}')" class="input-modern p-2 rounded-lg">
                <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
            </select>
        </div>
    `;
    
    if (!container.querySelector(`#${containerId}-pagination`)) {
        container.appendChild(paginationDiv);
    }
}

window.changePage = function(page, renderFunction) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    window[renderFunction]();
};

window.changeItemsPerPage = function(newSize, renderFunction) {
    itemsPerPage = parseInt(newSize);
    currentPage = 1;
    window[renderFunction]();
};

// ============================================
// EXPORT TO PDF CON GRÁFICOS
// ============================================

function exportToPDF() {
    if (allSolicitudes.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }
    
    // Analytics tracking
    Analytics.trackExport('PDF');
    
    showNotification('Generando PDF... Por favor espera', 'info');
    
    // Usar jsPDF (se agregará al HTML)
    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        
        // Header
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, 297, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('FRUTOS DE COPÁN', 148.5, 12, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text('Reporte de Solicitudes', 148.5, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-HN')}`, 148.5, 26, { align: 'center' });
        
        // Stats summary
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Resumen:', 10, 40);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const activas = allSolicitudes.filter(s => s.Activa).length;
        const finalizadas = allSolicitudes.filter(s => !s.Activa).length;
        
        doc.text(`Total: ${allSolicitudes.length} | Activas: ${activas} | Finalizadas: ${finalizadas}`, 10, 46);
        
        // Table
        const tableData = allSolicitudes.map(sol => [
            sol.ID,
            sol.Fecha ? sol.Fecha.split('T')[0] : '',
            sol.Usuario,
            sol.Ubicacion,
            sol.Tipo,
            sol.Activa ? 'Activa' : 'Finalizada'
        ]);
        
        doc.autoTable({
            head: [['ID', 'Fecha', 'Usuario', 'Ubicación', 'Tipo', 'Estado']],
            body: tableData,
            startY: 52,
            theme: 'grid',
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 250]
            },
            margin: { top: 52 }
        });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Página ${i} de ${pageCount}`,
                148.5,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }
        
        doc.save(`reporte_pulpa_${new Date().toISOString().split('T')[0]}.pdf`);
        showNotification('PDF generado exitosamente', 'success');
    }, 500);
}

// ============================================
// VIRTUAL SCROLLING (Preparado)
// ============================================

class VirtualScroller {
    constructor(container, items, itemHeight, renderItem) {
        this.container = container;
        this.items = items;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
        this.startIndex = 0;
        
        this.init();
    }
    
    init() {
        this.container.style.height = `${this.items.length * this.itemHeight}px`;
        this.container.style.position = 'relative';
        this.render();
        
        this.container.addEventListener('scroll', () => {
            const scrollTop = this.container.scrollTop;
            this.startIndex = Math.floor(scrollTop / this.itemHeight);
            this.render();
        });
    }
    
    render() {
        const endIndex = Math.min(this.startIndex + this.visibleCount, this.items.length);
        const visibleItems = this.items.slice(this.startIndex, endIndex);
        
        this.container.innerHTML = '';
        
        visibleItems.forEach((item, index) => {
            const element = this.renderItem(item);
            element.style.position = 'absolute';
            element.style.top = `${(this.startIndex + index) * this.itemHeight}px`;
            this.container.appendChild(element);
        });
    }
}

// ============================================
// PUSH NOTIFICATIONS (Preparado)
// ============================================

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

function showPushNotification(title, options) {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            icon: './icons/icon-192x192.png',
            badge: './icons/badge-72x72.png',
            vibrate: [200, 100, 200],
            ...options
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
}

// Request permission on login
if (currentUser.isAuthenticated && currentUser.nivel == 1) {
    requestNotificationPermission();
}