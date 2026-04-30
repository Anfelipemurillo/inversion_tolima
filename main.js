const $ = (id) => document.getElementById(id);
const norm = s => String(s||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const fmtCOP = n => Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 });

let ORIGINAL_DATA = [], RAW_DATA = [], MAP_GEOJSON = null, map;
const state = { sub: "", muni: "", sec: "", munisList: [] };

// 1. INICIALIZAR EL MAPA Y FETCH DE DATOS
async function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false });
    
    try {
        // Cargar datos a través de Fetch API en lugar de google.script.run
        // Pide a tu equipo que aquí pongan la URL del JSON que arroja BigQuery o el App Script
        const response = await fetch('/api/payload.json'); 
        const payload = await response.json();
        
        MAP_GEOJSON = payload.geo;
        ORIGINAL_DATA = payload.data;
        // ... (Tu lógica de mapeo Leaflet, renderDetailPanel y subregiones que ya hicimos) ...
        
        $('loader').style.display = 'none';
    } catch (e) { 
        console.error("Error cargando datos:", e); 
    }
}

window.onload = init;

// 2. LÓGICA DEL AGENTE CONVERSACIONAL (Basado en pág. 136)
document.addEventListener('DOMContentLoaded', () => {
    const btnReset = document.getElementById('btn-reset');
    const dfMessenger = document.querySelector('df-messenger');
    const wrapper = document.querySelector('.messenger-wrapper');

    if (btnReset && dfMessenger) {
        btnReset.addEventListener('click', () => {
            if (wrapper) wrapper.style.opacity = '0.5';
            
            if (dfMessenger.startNewSession) {
                dfMessenger.startNewSession({ retainHistory: false });
                console.log('Sesión de IA reiniciada.');
            } else {
                sessionStorage.clear();
                window.location.reload();
            }
            
            if (wrapper) {
                setTimeout(() => { wrapper.style.opacity = '1'; }, 500);
            }
        });
    }
});