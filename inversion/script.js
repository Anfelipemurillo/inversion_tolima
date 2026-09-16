// ==========================================
// ADAPTACIÓN DESDE GOOGLE APPS SCRIPT (GAS)
// ==========================================
async function fetchClientPayload(vigencia, skipStatic = false) {
    if (window[`DATOS_${vigencia}`]) {
        return window[`DATOS_${vigencia}`];
    }
    const filename = `datos_${vigencia}.json`;
    const response = await fetch(filename);
    if (!response.ok) {
        throw new Error(`No se pudo cargar ${filename} (${response.status} ${response.statusText})`);
    }
    return await response.json();
}

// Shim de compatibilidad con Google Apps Script (google.script.run)
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = {
    withSuccessHandler: function(onSuccess) {
        this._onSuccess = onSuccess;
        return this;
    },
    withFailureHandler: function(onFailure) {
        this._onFailure = onFailure;
        return this;
    },
    getClientPayload: async function(vigencia, skipStatic) {
        try {
            const data = await fetchClientPayload(vigencia, skipStatic);
            if (this._onSuccess) this._onSuccess(data);
            return data;
        } catch (err) {
            if (this._onFailure) this._onFailure(err);
            else console.error("Error al obtener datos:", err);
        }
    }
};

const $ = (id) => document.getElementById(id);

        const MUNICIPIOS_TOLIMA_CANON = [
            "ALPUJARRA", "ALVARADO", "AMBALEMA", "ANZOÁTEGUI", "ARMERO GUAYABAL", "ATACO", "CAJAMARCA",
            "CARMEN DE APICALÁ", "CASABIANCA", "CHAPARRAL", "COELLO", "COYAIMA", "CUNDAY", "DOLORES",
            "ESPINAL", "FALAN", "FLANDES", "FRESNO", "GUAMO", "HERVEO", "HONDA", "IBAGUÉ", "ICONONZO",
            "LÉRIDA", "LÍBANO", "SAN SEBASTIÁN DE MARIQUITA", "MELGAR", "MURILLO", "NATAGAIMA", "ORTEGA",
            "PALOCABILDO", "PIEDRAS", "PLANADAS", "PRADO", "PURIFICACIÓN", "RIOBLANCO", "RONCESVALLES",
            "ROVIRA", "SALDAÑA", "SAN ANTONIO", "SAN LUIS", "SANTA ISABEL", "SUÁREZ", "VALLE DE SAN JUAN",
            "VENADILLO", "VILLAHERMOSA", "VILLARRICA"
        ];

        // DICCIONARIO DE IDs RECONSTRUIDO EXACTO AL ARCHIVO "municipios.csv"
        const MUNI_IDS = {
            "ALPUJARRA": 41,
            "ALVARADO": 2,
            "AMBALEMA": 20,
            "ANZOATEGUI": 3,
            "ARMERO GUAYABAL": 21,
            "ATACO": 32,
            "CAJAMARCA": 4,
            "CARMEN DE APICALA": 27,
            "CASABIANCA": 12,
            "CHAPARRAL": 33,
            "COELLO": 5,
            "COYAIMA": 34,
            "CUNDAY": 28,
            "DOLORES": 42,
            "ESPINAL": 6,
            "FALAN": 22,
            "FLANDES": 7,
            "FRESNO": 23,
            "GUAMO": 43,
            "HERVEO": 13,
            "HONDA": 24,
            "IBAGUE": 1,
            "ICONONZO": 29,
            "LERIDA": 14,
            "LIBANO": 15,
            "SAN SEBASTIAN DE MARIQUITA": 25,
            "MELGAR": 30,
            "MURILLO": 16,
            "NATAGAIMA": 35,
            "ORTEGA": 36,
            "PALOCABILDO": 26,
            "PIEDRAS": 8,
            "PLANADAS": 37,
            "PRADO": 44,
            "PURIFICACION": 45,
            "RIOBLANCO": 38,
            "RONCESVALLES": 39,
            "ROVIRA": 9,
            "SALDANA": 46,
            "SAN ANTONIO": 40,
            "SAN LUIS": 10,
            "SANTA ISABEL": 17,
            "SUAREZ": 47,
            "VALLE DE SAN JUAN": 11,
            "VENADILLO": 18,
            "VILLAHERMOSA": 19,
            "VILLARRICA": 31,
        };

        const DICT_SUBREGIONES = {
            "Centro": { color: "#eab308", munis: ["ALVARADO", "ANZOÁTEGUI", "CAJAMARCA", "COELLO", "ESPINAL", "FLANDES", "IBAGUÉ", "PIEDRAS", "ROVIRA", "SAN LUIS", "VALLE DE SAN JUAN"] },
            "Nevados": { color: "#10b981", munis: ["CASABIANCA", "HERVEO", "LÉRIDA", "LÍBANO", "MURILLO", "SANTA ISABEL", "VENADILLO", "VILLAHERMOSA"] },
            "Norte": { color: "#0ea5e9", munis: ["AMBALEMA", "ARMERO GUAYABAL", "FALAN", "FRESNO", "HONDA", "SAN SEBASTIÁN DE MARIQUITA", "PALOCABILDO"] },
            "Oriente": { color: "#ef4444", munis: ["CARMEN DE APICALÁ", "CUNDAY", "ICONONZO", "MELGAR", "VILLARRICA"] },
            "Suroriente": { color: "#f97316", munis: ["ALPUJARRA", "DOLORES", "GUAMO", "PRADO", "PURIFICACIÓN", "SALDAÑA", "SUÁREZ"] },
            "Sur": { color: "#ec4899", munis: ["ATACO", "CHAPARRAL", "COYAIMA", "NATAGAIMA", "ORTEGA", "PLANADAS", "RIOBLANCO", "RONCESVALLES", "SAN ANTONIO"] }
        };

        let ORIGINAL_DATA = [];
        let RAW_DATA = [];
        let PROJ_SHARED_MAP = {};
        let GLOBAL_TOTAL = 0;

        let DEMOGRAFIA_MPO = {};
        let IPM_DATA = {};

        // CACHÉ EN MEMORIA DEL NAVEGADOR (por sesión de página, no persiste al recargar).
        // Guarda los datos crudos ya obtenidos de cada vigencia visitada, para que
        // volver a una vigencia ya vista sea instantáneo (0 llamadas de red), sin
        // depender de CacheService en el servidor, que resulta lento para blobs
        // grandes como este dataset de miles de filas.
        const VIGENCIA_DATA_CACHE = {};

        let map, pMap;
        // MAP_GEOJSON ya fue declarado arriba, embebido desde el template.

        // munisList arranca con la lista canónica fija (no depende de datos financieros),
        // así el mapa se puede dibujar de inmediato. Se reordena por inversión total
        // en procesarNuevosDatos() cuando llegan los datos, sin necesidad de reconstruir el mapa.
        const state = { sub: "", muni: "", sec: "", excl: false, heat: false, subMap: false, maxRP: 0, munisList: MUNICIPIOS_TOLIMA_CANON.slice(), muniLayer: null, fuente: "", isDragging: false };

        const fmtCOP = n => Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
        const fmt = n => Number(n).toLocaleString('es-CO');
        const norm = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

        function isMuniInSubregion(muniName, subName) {
            if (!subName) return false;
            const subData = DICT_SUBREGIONES[subName];
            if (!subData) return false;
            return subData.munis.some(m => norm(m) === norm(muniName));
        }

        function getSubregionOfMuni(muniName) {
            for (const [sub, data] of Object.entries(DICT_SUBREGIONES)) {
                if (data.munis.some(m => norm(m) === norm(muniName))) return sub;
            }
            return null;
        }

        function updateKPI(value, label) {
            $('kpiRP').textContent = fmtCOP(value);
            $('kpiLabel').textContent = label;
        }

        function buildSharedProjectsMap() {
            const tempMap = {};
            RAW_DATA.forEach(r => {
                if (!tempMap[r._key]) tempMap[r._key] = new Set();
                if (r.muni) tempMap[r._key].add(r.muni);
            });

            Object.keys(tempMap).forEach(key => {
                PROJ_SHARED_MAP[key] = {
                    isShared: tempMap[key].size > 1,
                    count: tempMap[key].size
                };
            });
        }

        function abrirReporteGeneral() {
            let idGeneral = 48;
            if (state.muni) {
                const normalizedMuni = norm(state.muni);
                idGeneral = MUNI_IDS[normalizedMuni] || 48;
            }
            const url = "https://ejecutortolima.gov.co/generarReporteGeneralMuni.php?municipio=" + idGeneral;
            window.open(url, '_blank');
        }

        function resetFilters() {
            try {
                state.sub = ""; state.muni = ""; state.sec = ""; state.excl = false; state.fuente = "";
                if ($('subFilter')) $('subFilter').value = "";
                if ($('muniFilter')) $('muniFilter').value = "";
                if ($('secFilter')) $('secFilter').value = "";
                if ($('fuenteFilter')) $('fuenteFilter').value = "";

                if (map && state.muniLayer && state.muniLayer.getBounds) {
                    map.flyToBounds(state.muniLayer.getBounds());
                }
            } catch(e) {
                console.warn("Aviso al resetear filtros:", e);
            }
        }

        // =====================================================================
        // CARGA DIFERIDA Y CONSULTA DIRECTA (STATELESS)
        // =====================================================================
        window.cambiarVigencia = async function(vigencia) {
            document.querySelectorAll('.btn-vigencia').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById('btnVigencia' + vigencia);
            if (btn) btn.classList.add('active');

            resetFilters();

            // 1. VIGENCIA YA VISITADA EN ESTA SESIÓN → uso instantáneo, sin red.
            if (VIGENCIA_DATA_CACHE[vigencia]) {
                // Si el loader quedó visible con un mensaje de error de un intento
                // anterior (p.ej. al caer aquí como salvavidas tras una vigencia sin
                // datos), hay que limpiarlo igual que en la ruta exitosa por RPC.
                if ($('loader') && $('loader').style.display !== 'none') {
                    $('loader').style.opacity = '0';
                    setTimeout(() => {
                        if ($('loader')) $('loader').style.display = 'none';
                        if ($('loadingText')) {
                            $('loadingText').style.color = "var(--vinotinto)";
                            $('loadingText').textContent = "Iniciando Sistema...";
                        }
                    }, 400);
                }
                procesarNuevosDatos(VIGENCIA_DATA_CACHE[vigencia]);
                return;
            }

            // 2. PRIMERA VEZ EN ESTA SESIÓN QUE SE PIDE ESTA VIGENCIA → sí se muestra
            //    el loader, porque implica un viaje real al servidor (que a su vez
            //    puede o no estar en el caché de BigQuery del lado del servidor).
            if ($('loadingText')) {
                $('loadingText').style.color = "var(--vinotinto)";
                $('loadingText').textContent = "Sincronizando Tolima " + vigencia + "...";
            }

            if ($('loader')) {
                $('loader').style.display = 'flex';
                void $('loader').offsetWidth; // Forzar repintado del DOM
                $('loader').style.opacity = '1';
            }

            try {
                const payload = await fetchClientPayload(vigencia, true);

                if (!payload || !payload.ok) {
                    throw new Error(payload ? payload.error : "Error de conexión.");
                }

                if ($('loader')) $('loader').style.opacity = '0';
                setTimeout(() => {
                    if ($('loader')) $('loader').style.display = 'none';
                    if ($('loadingText')) $('loadingText').textContent = "Iniciando Sistema...";
                }, 400);

                // Se guarda para que la próxima vez que el usuario vuelva a esta
                // vigencia, en esta misma sesión, no vuelva a viajar al servidor.
                VIGENCIA_DATA_CACHE[vigencia] = payload.data;

                procesarNuevosDatos(payload.data);

            } catch (err) {
                if ($('loadingText')) {
                    $('loadingText').textContent = "Error: " + err.message;
                    $('loadingText').style.color = "red";
                }
                console.error("Error en cambiarVigencia:", err);

                if (btn) { btn.classList.remove('active'); }

                if (vigencia !== '2025') {
                    setTimeout(() => cambiarVigencia('2025'), 2000);
                } else {
                    setTimeout(() => {
                        if ($('loader')) $('loader').style.opacity = '0';
                        setTimeout(() => {
                            if ($('loader')) $('loader').style.display = 'none';
                            if ($('loadingText')) {
                                $('loadingText').style.color = "var(--vinotinto)";
                                $('loadingText').textContent = "Iniciando Sistema...";
                            }
                        }, 400);
                    }, 2000);
                }
            }
        };

        // =====================================================================
        // CARGA INICIAL ULTRARRÁPIDA
        // =====================================================================
        async function init() {
            // SVG, no Canvas: con SVG el navegador maneja el hover de forma nativa
            // por cada nodo <path> (barato). Con Canvas, Leaflet tiene que hacer
            // hit-testing manual contra las 47 geometrías en CADA mousemove (no
            // solo al cruzar un borde), lo cual resultó peor para la navegación
            // con cursor. El fix real de rendimiento está en computeLayerStyle()
            // (O(1) por capa) y en no recorrer todo el mapa en cada mouseout.
            map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.1, renderer: L.svg({ padding: 1.5 }) });
            // Durante un paneo (drag) o zoom, el navegador puede no disparar el
            // par completo mouseover/mouseout de cada polígono si el cursor se
            // mueve muy rápido o el pane del SVG se traslada más rápido de lo que
            // el hit-testing nativo logra seguir. Eso deja estilos de hover y
            // tooltips "sticky" pegados en municipios que ya no están bajo el
            // cursor. Solución: desactivar el hover mientras hay movimiento activo
            // (no aporta nada mientras arrastras el mapa) y forzar un reseteo
            // limpio de estilos + tooltips al iniciar y al terminar cualquier
            // movimiento (incluye la inercia final tras soltar el clic).
            map.on('movestart zoomstart', () => {
                state.isDragging = true;
                map.eachLayer(layer => { if (layer.closeTooltip) layer.closeTooltip(); });
                updateMapStyles();
            });
            map.on('moveend zoomend', () => {
                state.isDragging = false;
                updateMapStyles();
            });

            // Red de seguridad: si el cursor sale del contenedor del mapa (p.ej.
            // un flick rápido hacia afuera) sin generar un mouseout normal sobre
            // el polígono, se limpia igual al detectar que el mouse abandonó el
            // mapa por completo.
            $('map').addEventListener('mouseleave', () => {
                map.eachLayer(layer => { if (layer.closeTooltip) layer.closeTooltip(); });
                updateMapStyles();
            });

            // El geo ya está disponible desde el HTML (MAP_GEOJSON), así que el mapa
            // se dibuja de inmediato, sin esperar la respuesta del RPC financiero.
            buildMuniLayer();

            window.addEventListener('resize', () => {
                if (map) {
                    map.invalidateSize();
                    if (!state.muni && !state.sub && state.muniLayer && Object.keys(state.muniLayer._layers).length > 0) {
                        map.fitBounds(state.muniLayer.getBounds());
                    }
                }
            });

            if ($('loadingText')) $('loadingText').textContent = "Cargando Monitor Territorial del Tolima...";

            try {
                // Carga inicial de datos desde datos_2025.json
                const payload = await fetchClientPayload("2025", false);

                if (!payload || !payload.ok) throw new Error(payload ? payload.error : "Error de conexión.");

                DEMOGRAFIA_MPO = payload.demo || {};
                IPM_DATA = payload.ipm_data || {};

                if ($('loader')) $('loader').style.opacity = '0';
                setTimeout(() => {
                    if ($('loader')) $('loader').style.display = 'none';
                    if ($('loadingText')) $('loadingText').textContent = "Iniciando Sistema...";
                }, 400);

                procesarNuevosDatos(payload.data);
                VIGENCIA_DATA_CACHE["2025"] = payload.data;

                // Abrir el panel lateral automáticamente con la visión global al iniciar
                if ($('detail-panel')) $('detail-panel').classList.add('open');
                calculateDashboard();
            } catch (err) {
                if ($('loadingText')) {
                    $('loadingText').textContent = "Sistema Fuera de Línea";
                    $('loadingText').style.color = "red";
                }
                console.error("Error en init:", err);
            }
        }

        // Construye la capa de polígonos municipales en el mapa. Se puede llamar
        // tan pronto como el mapa Leaflet exista, sin depender de los datos
        // financieros (RPC), ya que MAP_GEOJSON viene embebido desde el HTML.
        // Resuelve el nombre canónico de un municipio a partir de una capa Leaflet.
        // Se centraliza aquí porque se repetía este mismo cálculo (norm + find)
        // en varios puntos del código.
        function getCanonName(layer) {
            const geoName = layer.feature.properties.NOM_MPIO.toUpperCase().trim();
            return state.munisList.find(m => norm(m) === norm(geoName)) || geoName;
        }

        function buildMuniLayer() {
            if (state.muniLayer || !map || !MAP_GEOJSON || Object.keys(MAP_GEOJSON).length === 0) return;

            state.muniLayer = L.geoJSON(MAP_GEOJSON, {
                onEachFeature: (f, l) => {
                    const geoName = (f.properties && f.properties.NOM_MPIO) ? f.properties.NOM_MPIO.toUpperCase().trim() : "DESCONOCIDO";
                    const canon = state.munisList.find(m => norm(m) === norm(geoName)) || geoName;

                    l.bindTooltip(canon, { className: 'muni-tooltip', sticky: true });
                    l.on('mouseover', function () {
                        if (!state.isDragging && canon !== state.muni && !state.heat && !state.subMap && !(state.sub && !isMuniInSubregion(canon, state.sub))) {
                            this.setStyle({ fillColor: '#CBA135', fillOpacity: 0.9, color: '#ffffff', weight: 1.5 });
                            this.bringToFront();
                        }
                    });
                    // Antes esto llamaba updateMapStyles(), que recorre las 47 capas
                    // (con norm() + búsquedas en diccionarios) en cada salida del mouse.
                    // Como el mouseout se dispara constantemente al navegar el mapa,
                    // era el mayor causante de la lentitud percibida. Ahora solo se
                    // reestiliza la capa individual, con O(1) usando el caché de heat.
                    l.on('mouseout', function () {
                        const style = computeLayerStyle(canon);
                        this.setStyle(style);
                        if (style._front) this.bringToFront();
                    });
                    l.on('click', () => { if (!(state.sub && !isMuniInSubregion(canon, state.sub))) selectMuni(canon); });
                }
            }).addTo(map);

            if (state.muniLayer && Object.keys(state.muniLayer._layers).length > 0) {
                try { map.fitBounds(state.muniLayer.getBounds()); } catch(e) {}
            }
        }

       function procesarNuevosDatos(fetchedData) {
            ORIGINAL_DATA = [];
            RAW_DATA = [];
            PROJ_SHARED_MAP = {};

            fetchedData.forEach((r, index) => {
                // Se agrega '_index' para diferenciar proyectos sin BPIN
                const key = r.pid ? norm(r.pid) : norm(r.sec + "_" + r.pname) + "_" + index;
                r._key = key;

                ORIGINAL_DATA.push({ ...r, estado: r.estado });

                let munis = [];
                const upperMuni = (r.muni || "").toUpperCase().trim();

                // Se amplía la verificación de cobertura departamental
                if (upperMuni === "COBERTURA DEPARTAMENTAL" || upperMuni === "TODOS" || upperMuni === "TOLIMA" || upperMuni === "TODO EL DEPARTAMENTO") {
                    munis = MUNICIPIOS_TOLIMA_CANON;
                }
                else if (upperMuni === "INVERSIÓN EXTRADEPARTAMENTAL" || upperMuni === "SIN ASIGNAR") {
                    munis = [];
                }
                else {
                    munis = (r.muni || "").split(',').map(x => x.trim());
                }

                munis.forEach(m => {
                    RAW_DATA.push({
                        ...r,
                        muni: m
                    });
                });
            });

            buildSharedProjectsMap();

            GLOBAL_TOTAL = ORIGINAL_DATA.reduce((sum, r) => sum + (r.fullRp || 0), 0);

            const muniTotalsMap = {};
            const secTotalsMap = {};
            const subTotalsMap = {};

            Object.keys(DICT_SUBREGIONES).forEach(s => subTotalsMap[s] = 0);

            RAW_DATA.forEach(r => {
                if (r.muni !== "INVERSIÓN EXTRADEPARTAMENTAL") {
                    muniTotalsMap[r.muni] = (muniTotalsMap[r.muni] || 0) + (r.rp || 0);
                    const subName = getSubregionOfMuni(r.muni);
                    if (subName) subTotalsMap[subName] += (r.rp || 0);
                }
            });
            ORIGINAL_DATA.forEach(r => secTotalsMap[r.sec] = (secTotalsMap[r.sec] || 0) + (r.fullRp || 0));

            state.maxRP = Math.max(...Object.values(muniTotalsMap), 0);
            state.munisList = MUNICIPIOS_TOLIMA_CANON.sort((a, b) => (muniTotalsMap[b] || 0) - (muniTotalsMap[a] || 0));

            // Respaldo: si por algún motivo el mapa no se construyó ya en init()
            // (p.ej. MAP_GEOJSON llegó vacío/null en el HTML), se intenta aquí.
            buildMuniLayer();
            // Los tooltips ya fueron ligados con nombres de municipio provisionales
            // (antes de conocer los totales); no requieren reconstrucción, solo se
            // refresca el estilo/orden visual con updateMapStyles() más abajo.

            if ($('subFilter')) {
                $('subFilter').innerHTML = '<option value="">🗺️ Visión Global del Tolima</option>';
                Object.keys(DICT_SUBREGIONES).sort((a, b) => subTotalsMap[b] - subTotalsMap[a]).forEach(s => {
                    $('subFilter').innerHTML += '<option value="' + s + '">Subregión ' + s + '</option>';
                });
            }

            updateMuniDropdown();

            if ($('secFilter')) {
                $('secFilter').innerHTML = '<option value="">📋 Todas las Dependencias o Entidades</option>';
                [...new Set(ORIGINAL_DATA.map(r => r.sec))].sort((a, b) => (secTotalsMap[b] || 0) - (secTotalsMap[a] || 0)).forEach(s => {
                    $('secFilter').innerHTML += '<option value="' + s + '">' + s + '</option>';
                });
            }

            calculateDashboard();
        }

        function calculateDashboard() {
            let baseArray = (state.muni || state.sub) ? RAW_DATA : ORIGINAL_DATA;

            let activeRows = baseArray;
            if (state.excl) {
                activeRows = activeRows.filter(r => !PROJ_SHARED_MAP[r._key].isShared);
            }
            if (state.fuente) {
                activeRows = activeRows.filter(r => (r[state.fuente] || 0) > 0);
            }

            let geoRows = [];
            let geoLabel = "";
            let panelTitleText = "";

            if (state.muni) {
                geoRows = activeRows.filter(r => r.muni === state.muni);
                geoLabel = 'Inversión en ' + state.muni;
                panelTitleText = state.muni;
            } else if (state.sub) {
                geoRows = activeRows.filter(r => isMuniInSubregion(r.muni, state.sub));
                geoLabel = 'Subregión ' + state.sub;
                panelTitleText = 'SUBREGIÓN ' + state.sub.toUpperCase();
            } else {
                geoRows = activeRows;
                geoLabel = "Inversión Total Departamental";
                panelTitleText = "VISIÓN GLOBAL DEL TOLIMA";
            }

            const btnReporte = $('btnReporteGeneral');
            if (btnReporte) {
                if (state.muni) {
                    btnReporte.style.display = 'flex';
                    btnReporte.title = 'Ver Reporte General de ' + state.muni;
                } else if (!state.sub && !state.muni) {
                    btnReporte.style.display = 'flex';
                    btnReporte.title = 'Ver Reporte General del Tolima';
                } else {
                    btnReporte.style.display = 'none';
                }
            }

            const isGlobal = (baseArray === ORIGINAL_DATA);

            if (state.sec) {
                const secRows = geoRows.filter(r => r.sec === state.sec);
                updateKPI(secRows.reduce((sum, r) => sum + (isGlobal ? r.fullRp : r.rp), 0), state.sec);
            } else {
                updateKPI(geoRows.reduce((sum, r) => sum + (isGlobal ? r.fullRp : r.rp), 0), geoLabel);
            }

            renderDetailPanel(geoRows, panelTitleText, isGlobal);
            updateMapStyles();
        }

        function renderDetailPanel(filteredRows, panelTitleText, isGlobal) {
            const body = $('panelBody');
            $('panelTitle').textContent = panelTitleText;

            const totalRP = filteredRows.reduce((sum, r) => sum + (isGlobal ? r.fullRp : r.rp), 0);

            if (!state.sec) {
                $('panelSub').textContent = 'Matriz por Dependencia';
                $('btnBack').style.display = 'none';

                const perSec = {};
                let uniqueProjCount = 0;
                const globalCountedKeys = new Set();

                for (const row of filteredRows) {
                    if (!perSec[row.sec]) perSec[row.sec] = { sec: row.sec, rp: 0, count: 0, localKeys: new Set() };
                    perSec[row.sec].rp += (isGlobal ? row.fullRp : row.rp);

                    if (!globalCountedKeys.has(row._key)) {
                        uniqueProjCount++;
                        globalCountedKeys.add(row._key);
                    }
                    if (!perSec[row.sec].localKeys.has(row._key)) {
                        perSec[row.sec].count++;
                        perSec[row.sec].localKeys.add(row._key);
                    }
                }

                const secs = Object.values(perSec).sort((a, b) => b.rp - a.rp);

                let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <span class="pill" style="background:var(--oro);color:#fff;border:none;">🏛️ ${secs.length} Secs</span>
                        <span class="pill" style="background:#fff;border-color:var(--oro);color:#9c781d;">📈 ${uniqueProjCount} Projs</span>
                        <span class="pill" style="background:#f1f5f9;border-color:var(--border-light);color:var(--text-main);">💰 ${fmtCOP(totalRP)}</span>
                    </div>
                    <button id="btnToggleExclSec" name="btnToggleExclSec" type="button" class="btn-toggle-excl ${state.excl ? 'active' : ''}" onclick="toggleExcl()">${state.excl ? '⭐ Mostrar Todos' : '⭐ Exclusivos Mpo'}</button>
                </div>`;

                secs.forEach(s => {
                    html += `
                    <div class="secItem" onclick="selectSec('${s.sec.replace(/'/g, "\\'")}')">
                        <div>
                            <div class="secName">${s.sec}</div>
                            <div class="secMeta">${s.count} proyectos vinculados</div>
                        </div>
                        <div class="card-money">${fmtCOP(s.rp)}</div>
                    </div>`;
                });
                body.innerHTML = html;

            } else {
                $('panelSub').textContent = state.sec;
                $('btnBack').style.display = 'inline-flex';

                const projsMap = {};
                const secRows = filteredRows.filter(r => r.sec === state.sec);

                for (const row of secRows) {
                    if (!projsMap[row._key]) {
                        projsMap[row._key] = {
                            pname: row.pname, bpin: row.pid, sec: row.sec,
                            shareInfo: PROJ_SHARED_MAP[row._key],
                            fullRp: 0, fullOp: 0, rp: 0, op: 0, // Todas inician en 0
                            estado: row.estado
                        };
                    }
                    // Acumulamos += para sumar todas las fuentes de financiación
                    projsMap[row._key].fullRp += (row.fullRp || 0);
                    projsMap[row._key].fullOp += (row.fullOp || 0);
                    projsMap[row._key].rp += (isGlobal ? (row.fullRp || 0) : (row.rp || 0));
                    projsMap[row._key].op += (isGlobal ? (row.fullOp || 0) : (row.op || 0));
                }

                const projs = Object.values(projsMap).sort((a, b) => {
                    if (a.shareInfo.isShared !== b.shareInfo.isShared) return a.shareInfo.isShared ? 1 : -1;
                    return b.fullRp - a.fullRp;
                });

                let html = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <span class="pill" style="background:var(--vinotinto);color:#fff;border:none;margin-bottom:0;">Proyectos de Dependencia: ${projs.length}</span>
                    <button id="btnToggleExclProj" name="btnToggleExclProj" type="button" class="btn-toggle-excl ${state.excl ? 'active' : ''}" onclick="toggleExcl()" style="margin-bottom:0;">${state.excl ? '⭐ Mostrar Todos' : '⭐ Exclusivos Mpo'}</button>
                </div>`;

                if (projs.length === 0) {
                    html += `<div style="text-align:center;color:var(--text-muted);margin-top:40px;font-weight:600;">No existen proyectos registrados bajo este filtro.</div>`;
                }

                projs.forEach(p => {
                    let tag = 'EXCLUSIVO MUNICIPAL';
                    let tagColor = 'var(--oro)';
                    let bgTagColor = 'rgba(203, 161, 53, 0.12)';
                    let borderColor = 'var(--oro)';

                    if (p.shareInfo.isShared) {
                        if (p.shareInfo.count >= 47) {
                            tag = 'COBERTURA DEPARTAMENTAL';
                            tagColor = '#64748b'; bgTagColor = '#f1f5f9'; borderColor = 'transparent';
                        } else {
                            tag = `COMPARTIDO (${p.shareInfo.count} MUNICIPIOS)`;
                            tagColor = '#64748b'; bgTagColor = '#f1f5f9'; borderColor = 'transparent';
                        }
                    }

                    const bienesSet = new Set();
                    ORIGINAL_DATA.filter(r => (p.bpin ? r.pid === p.bpin : r.pname === p.pname && r.sec === p.sec) && r.bien && r.bien.trim() !== "")
                        .forEach(r => bienesSet.add(r.bien.trim()));

                    const bienesList = Array.from(bienesSet);
                    let bienesHtml = "";

                    if (bienesList.length > 0) {
                        bienesHtml = `
                        <div class="bienes-container" style="display:none; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                            <div style="font-size:10px; font-weight:900; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Bienes o Servicios Entregados:</div>
                            <ul style="margin:0; padding-left:16px; font-size:11px; color:var(--text-main); line-height:1.6;">
                                ${bienesList.map(b => `<li style="margin-bottom:4px;">${b.replace(/\n/g, '<br>')}</li>`).join('')}
                            </ul>
                        </div>`;
                    } else {
                        bienesHtml = `
                        <div class="bienes-container" style="display:none; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0; font-size:11px; color:var(--text-muted); font-weight:600; text-align:center;">
                            No hay bienes o servicios detallados para este proyecto.
                        </div>`;
                    }

                    let colorEstado = '#94a3b8';
                    if (p.estado === 'EJECUTADO') {
                        colorEstado = '#10b981';
                    } else if (p.estado === 'EN EJECUCION' || p.estado === 'EN EJECUCIÓN') {
                        colorEstado = '#3b82f6';
                    } else if (p.estado === 'SUSPENDIDO') {
                        colorEstado = '#ef4444';
                    }

                    html += `
                    <div class="projCard" style="border-left: 4px solid ${borderColor}" onclick="const b = this.querySelector('.bienes-container'); b.style.display = b.style.display === 'none' ? 'block' : 'none';">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                          <div class="projName">${p.pname || 'Proyecto no identificado'}</div>
                          <div style="font-size:9px; font-weight:900; background:${colorEstado}20; color:${colorEstado}; padding:3px 6px; border-radius:4px; border: 1px solid ${colorEstado}50; white-space:nowrap; margin-left:8px;">
                              ${p.estado || 'SIN DEFINIR'}
                          </div>
                      </div>
                      ${p.bpin ? `<div style="margin-top:8px;color:var(--text-muted);font-size:11px;font-weight:700;letter-spacing:0.5px;">BPIN: ${p.bpin}</div>` : ''}
                      <div class="projTag" style="color:${tagColor}; background: ${bgTagColor}">${tag}</div>

                    <div class="projMoney">
                      <div class="data-row">
                          <span class="data-label">Valor de inversión (RP)</span>
                          <span class="data-value highlight">${fmtCOP(p.fullRp)}</span>
                      </div>
                      ${(p.rp < p.fullRp && (state.muni || state.sub)) ? `
                      <div style="font-size:10px; color:var(--text-muted); text-align:right; margin-top:2px; font-weight:700;">
                          Impacto en ${state.muni ? 'este municipio' : 'esta subregión'}: ${fmtCOP(p.rp)}
                      </div>` : ''}
                    </div>

                    ${bienesHtml}

                    <div style="text-align:center; margin-top:12px; font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">
                        Click para ver detalle de bienes ▼
                    </div>
                  </div>
                `;
                });
                body.innerHTML = html;
            }
        }

        // Caché de agregados de heatmap (se recalculan solo cuando updateMapStyles()
        // corre por un cambio de estado real: filtro, selección, toggle). El
        // hover/mouseout de un solo municipio reutiliza estos valores en vez de
        // recorrer RAW_DATA de nuevo, que era el costo más caro del hover.
        let HEAT_TOTALS = {};
        let HEAT_MAX = 0;

        function getHeatmapColor(val, max) {
            if (!val || max === 0) return '#f8f6f0';
            const pct = val / max;
            if (pct >= 0.80) return '#8A6D1C';
            if (pct >= 0.60) return '#A8852B';
            if (pct >= 0.40) return '#CBA135';
            if (pct >= 0.20) return '#DBC173';
            return '#EBE1B1';
        }

        // Calcula el estilo que le corresponde a UN municipio dado el estado actual,
        // usando los agregados de heatmap ya cacheados en HEAT_TOTALS/HEAT_MAX.
        // No recorre RAW_DATA ni ninguna otra capa: es O(1) por llamada.
        function computeLayerStyle(canon) {
            const isSelectedMuni = (canon === state.muni);
            const isSelectedSub = (state.sub && isMuniInSubregion(canon, state.sub));

            if (isSelectedMuni) {
                return { fillColor: '#761C33', fillOpacity: 1, color: '#CBA135', weight: 1.5, _front: true };
            } else if (state.sub && !state.muni) {
                if (isSelectedSub) {
                    let fillColor = state.subMap ? (DICT_SUBREGIONES[getSubregionOfMuni(canon)]?.color || '#761C33') : (state.heat ? getHeatmapColor(HEAT_TOTALS[canon] || 0, HEAT_MAX) : '#761C33');
                    return { fillColor: fillColor, fillOpacity: 0.9, color: '#ffffff', weight: 1.5, _front: true };
                } else {
                    return { fillColor: '#761C33', fillOpacity: 0.1, color: '#ffffff', weight: 1 };
                }
            } else if (state.subMap) {
                return { fillColor: DICT_SUBREGIONES[getSubregionOfMuni(canon)]?.color || '#e2e8f0', fillOpacity: 0.85, color: '#ffffff', weight: 1.5 };
            } else if (state.heat) {
                return { fillColor: getHeatmapColor(HEAT_TOTALS[canon] || 0, HEAT_MAX), fillOpacity: 0.85, color: '#ffffff', weight: 1.5 };
            } else {
                return { fillColor: '#761C33', fillOpacity: (state.muni) ? 0.3 : 0.9, color: '#ffffff', weight: 1 };
            }
        }

        // Recalcula los agregados de heatmap (si aplica) y reestiliza las 47 capas.
        // Se invoca solo ante cambios de estado reales (filtros, selección,
        // toggles), NUNCA en cada hover/mouseout individual.
        function updateMapStyles() {
            if (!state.muniLayer) return;

            HEAT_TOTALS = {};
            HEAT_MAX = state.maxRP;

            if (state.heat) {
                let activeRows = RAW_DATA.filter(r => r.muni !== "INVERSIÓN EXTRADEPARTAMENTAL");
                if (state.excl) activeRows = activeRows.filter(r => !PROJ_SHARED_MAP[r._key].isShared);
                if (state.sec) activeRows = activeRows.filter(r => r.sec === state.sec);

                activeRows.forEach(r => {
                    HEAT_TOTALS[r.muni] = (HEAT_TOTALS[r.muni] || 0) + (r.rp || 0);
                });

                if (state.sec || state.excl) {
                    const vals = Object.values(HEAT_TOTALS);
                    if (vals.length > 0) {
                        HEAT_MAX = Math.max(...vals);
                    }
                }
            }

            state.muniLayer.eachLayer(layer => {
                const canon = getCanonName(layer);
                const style = computeLayerStyle(canon);
                layer.setStyle(style);
                if (style._front) layer.bringToFront();
            });
        }

        function updateButtonsUI() {
            $('btnHeatmap').classList.toggle('active', state.heat);
            $('btnHeatmap').querySelector('span').textContent = state.heat ? "Ocultar Calor" : "Calor";
            $('btnSubmap').classList.toggle('active', state.subMap);
            $('btnSubmap').querySelector('span').textContent = state.subMap ? "Ocultar Regiones" : "Subregiones";
        }

        function getSmartPadding() {
            return window.innerWidth <= 900
                ? { ptl: [0, $('sidebar').offsetHeight + 20], pbr: [0, $('detail-panel').classList.contains('open') ? $('detail-panel').offsetHeight + 20 : 0] }
                : { ptl: [380, 20], pbr: [$('detail-panel').classList.contains('open') ? 460 : 20, 20] };
        }

        function updateMuniDropdown() {
            const mS = $('muniFilter');
            if (!mS) return;
            mS.innerHTML = '<option value="">🗺️ ' + (state.sub ? 'Toda la Subregión' : 'Visión Global del Tolima') + '</option>';

            (state.sub ? state.munisList.filter(m => isMuniInSubregion(m, state.sub)) : state.munisList).forEach(m => {
                mS.innerHTML += '<option value="' + m + '">' + m + '</option>';
            });
            mS.value = state.muni;
        }

        function flyToSubregion(s) {
            if (!state.muniLayer) return;
            let subBounds = L.latLngBounds(), hasLayers = false;
            state.muniLayer.eachLayer(l => {
                const canon = state.munisList.find(m => norm(m) === norm(l.feature.properties.NOM_MPIO.toUpperCase().trim())) || l.feature.properties.NOM_MPIO;
                if (isMuniInSubregion(canon, s)) {
                    subBounds.extend(l.getBounds());
                    hasLayers = true;
                }
            });
            if (hasLayers) {
                try { map.flyToBounds(subBounds, { paddingTopLeft: getSmartPadding().ptl, paddingBottomRight: getSmartPadding().pbr, maxZoom: 10, duration: 0.8, easeLinearity: 0.25 }); } catch(e) {}
            }
        }

        function selectSubregion(s) {
            state.sub = s; state.muni = ""; state.sec = ""; state.excl = false;
            if ($('subFilter')) $('subFilter').value = s;
            if ($('muniFilter')) $('muniFilter').value = "";
            if ($('secFilter')) $('secFilter').value = "";
            updateMuniDropdown();
            if ($('detail-panel')) $('detail-panel').classList.add('open');
            if (s) flyToSubregion(s);
            else if (state.muniLayer && Object.keys(state.muniLayer._layers).length > 0) {
                try { map.flyToBounds(state.muniLayer.getBounds()); } catch(e) {}
            }
            calculateDashboard();
        }

        function selectMuni(m) {
            state.muni = m; state.sec = ""; state.excl = false;
            if ($('muniFilter')) $('muniFilter').value = m;
            if ($('secFilter')) $('secFilter').value = "";
            if ($('detail-panel')) $('detail-panel').classList.add('open');
            if (m) {
                const layer = state.muniLayer.getLayers().find(l => norm(state.munisList.find(x => norm(x) === norm(l.feature.properties.NOM_MPIO.toUpperCase().trim())) || l.feature.properties.NOM_MPIO) === norm(m));
                if (layer) {
                    try { map.flyToBounds(layer.getBounds(), { paddingTopLeft: getSmartPadding().ptl, paddingBottomRight: getSmartPadding().pbr, maxZoom: 10, duration: 0.8, easeLinearity: 0.25 }); } catch(e) {}
                }
            } else {
                if (state.sub) flyToSubregion(state.sub);
                else if (state.muniLayer && Object.keys(state.muniLayer._layers).length > 0) {
                    try { map.flyToBounds(state.muniLayer.getBounds()); } catch(e) {}
                }
            }
            calculateDashboard();
        }

        function selectSec(s) {
            state.sec = s;
            if ($('secFilter')) $('secFilter').value = s;
            if ($('detail-panel')) $('detail-panel').classList.add('open');
            calculateDashboard();
        }

        function toggleExcl() {
            state.excl = !state.excl;
            calculateDashboard();
        }

        // Se activa una sola vez: la primera vez que el usuario abre el chat,
        // se marca el widget df-messenger como "abierto" desde JS. Esto dispara
        // su intent WELCOME justo en ese momento (con el panel ya visible),
        // en vez de a la carga de la página (donde antes disparaba oculto,
        // sin que el usuario lo viera, obligándolo a escribir algo para que
        // AMAIA reaccionara).
        // Crea (o recrea) el widget <df-messenger> desde cero dentro de
        // .messenger-wrapper. Es importante que df-messenger-chat-open="true"
        // vaya puesto DESDE LA CREACIÓN del elemento: el widget solo lee ese
        // atributo una vez, en su inicialización, así que intentar cambiarlo
        // en un elemento ya montado no dispara nada. Recrear el elemento es
        // la única forma confiable de repetir el saludo (WELCOME) a demanda.
        function createMessenger() {
            const wrapper = document.querySelector('.messenger-wrapper');
            if (!wrapper) return;
            wrapper.innerHTML = '';

            const dfMessenger = document.createElement('df-messenger');
            dfMessenger.setAttribute('project-id', 'co-tol-prd');
            dfMessenger.setAttribute('location', 'us-central1');
            dfMessenger.setAttribute('agent-id', 'ffe4cffa-7e81-46c9-952a-22ec282bcfab');
            dfMessenger.setAttribute('language-code', 'es');
            dfMessenger.setAttribute('df-messenger-chat-open', 'true');

            const dfChat = document.createElement('df-messenger-chat');
            dfChat.setAttribute('chat-title', 'AMAIA');
            dfChat.setAttribute('intent', 'WELCOME');
            dfMessenger.appendChild(dfChat);

            // Los campos y botones (incluyendo "Cancelar tarea" y el input "Pregunta algo…")
            // viven dentro de varios niveles de Shadow DOM anidados del widget de Dialogflow.
            // Para resolver advertencias de accesibilidad y autofill, buscamos recursivamente
            // en todos los shadow roots y agregamos id, name y type="button" a los botones.
            function deepQueryShadowAll(node, selector, results = []) {
                if (!node) return results;
                const sr = node.shadowRoot;
                if (sr) {
                    sr.querySelectorAll(selector).forEach(el => results.push(el));
                    sr.querySelectorAll('*').forEach(child => deepQueryShadowAll(child, selector, results));
                }
                if (node.children) {
                    for (let i = 0; i < node.children.length; i++) {
                        deepQueryShadowAll(node.children[i], selector, results);
                    }
                }
                return results;
            }

            function patchChatElements() {
                let patched = false;

                // 1. Inputs y textareas dentro de Shadow DOM
                const fields = deepQueryShadowAll(dfMessenger, 'input, textarea');
                fields.forEach((field, idx) => {
                    const idVal = idx === 0 ? 'amaia-chat-input' : `amaia-chat-input-${idx + 1}`;
                    if (!field.id) field.id = idVal;
                    if (!field.getAttribute('name')) field.setAttribute('name', idVal);
                    if (!field.hasAttribute('autocomplete')) field.setAttribute('autocomplete', 'off');
                    patched = true;
                });

                // 2. Botones dentro de Shadow DOM (e.g. "Cancelar tarea")
                const buttons = deepQueryShadowAll(dfMessenger, 'button');
                buttons.forEach((btn, idx) => {
                    const text = (btn.textContent || '').trim().toLowerCase();
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const title = (btn.getAttribute('title') || '').toLowerCase();

                    // Identificar botón "Cancelar tarea"
                    if (text.includes('cancelar') || ariaLabel.includes('cancelar') || title.includes('cancelar') || ariaLabel.includes('cancel task')) {
                        if (!btn.id) btn.id = 'cancel-task-btn';
                        if (!btn.getAttribute('name')) btn.setAttribute('name', 'cancel-task');
                    } else {
                        if (!btn.id) btn.id = `df-chat-btn-${idx + 1}`;
                        if (!btn.getAttribute('name')) btn.setAttribute('name', `df-chat-btn-${idx + 1}`);
                    }

                    // Prevenir warnings de submit en botones de acción UI
                    const currentType = btn.getAttribute('type');
                    if (!currentType || currentType === 'submit') {
                        btn.setAttribute('type', 'button');
                    }
                    patched = true;
                });

                // Observar dinámicamente nuevos elementos dentro de shadow roots
                attachShadowObservers(dfMessenger);

                return patched;
            }

            function attachShadowObservers(node) {
                if (!node) return;
                const sr = node.shadowRoot;
                if (sr && !sr._observedForA11y) {
                    sr._observedForA11y = true;
                    const observer = new MutationObserver(() => {
                        patchChatElements();
                    });
                    observer.observe(sr, { childList: true, subtree: true });
                    sr.querySelectorAll('*').forEach(child => attachShadowObservers(child));
                }
                if (node.children) {
                    for (let i = 0; i < node.children.length; i++) {
                        attachShadowObservers(node.children[i]);
                    }
                }
            }

            // Intentar en eventos oficiales + serie de reintentos con backoff
            let attempts = 0;
            function scheduleRetry() {
                if (attempts >= 10) return;
                attempts++;
                setTimeout(() => {
                    patchChatElements();
                    if (attempts < 10) scheduleRetry();
                }, 300 * attempts);
            }

            dfMessenger.addEventListener('df-messenger-loaded', () => {
                patchChatElements();
                scheduleRetry();
            });
            dfMessenger.addEventListener('df-response-received', () => {
                patchChatElements();
            });
            dfMessenger.addEventListener('df-request-sent', () => {
                patchChatElements();
            });
            scheduleRetry(); // primer intento sin esperar el evento

            wrapper.appendChild(dfMessenger);
        }

        let dfMessengerStarted = false;

        function toggleChat() {
            const panel = $('ai-chat-sidebar');
            const btn = $('ai-chat-btn');
            const isOpen = panel.classList.toggle('open');
            btn.classList.toggle('hidden', isOpen);

            if (isOpen && !dfMessengerStarted) {
                dfMessengerStarted = true;
                createMessenger();
            }

            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                    if (state.muni) selectMuni(state.muni);
                    else if (state.sub) flyToSubregion(state.sub);
                }
            }, 400);
        }

        function resetChat() {
            if (confirm("¿Estás seguro de que deseas reiniciar la conversación con AMAIA?")) {
                sessionStorage.clear();
                // Antes esto hacía window.location.reload(), lo cual en el
                // entorno de Apps Script (URL .../dev) podía terminar en una
                // pantalla en blanco sin salida. Ahora simplemente se recrea
                // el widget del chat desde cero, sin recargar la página: se
                // reinicia la sesión de Dialogflow y se repite el saludo, sin
                // perder el estado del mapa ni los filtros activos.
                createMessenger();
                dfMessengerStarted = true;
            }
        }

        // =====================================================================
        // MOTOR DE IMPRESIÓN PDF
        // =====================================================================
        function ejecutarImpresion() {
            const btn = document.querySelector('.print-btn');
            if (btn) { btn.style.pointerEvents = "none"; btn.style.opacity = "0.5"; }

            let baseArray = (state.muni || state.sub) ? RAW_DATA : ORIGINAL_DATA;
            let activeRows = baseArray;
            if (state.excl) activeRows = activeRows.filter(r => !PROJ_SHARED_MAP[r._key].isShared);

            let geoRows = [];
            let geoTitle = "DEPARTAMENTO DEL TOLIMA";
            let geoColor = "#761C33";
            let subTitleText = "";

            if (state.muni) {
                geoRows = activeRows.filter(r => r.muni === state.muni);
                geoTitle = state.muni;
                const subName = getSubregionOfMuni(state.muni);
                if (subName) {
                    const sColor = DICT_SUBREGIONES[subName].color;
                    subTitleText = '<div style="font-size: 16px; color: ' + sColor + '; font-weight: 800; margin-top: -15px; margin-bottom: 20px; text-align: center;">SUBREGIÓN ' + subName.toUpperCase() + '</div>';
                }
            } else if (state.sub) {
                geoRows = activeRows.filter(r => isMuniInSubregion(r.muni, state.sub));
                geoColor = DICT_SUBREGIONES[state.sub].color;
                geoTitle = 'SUBREGIÓN ' + state.sub.toUpperCase();
            } else {
                geoRows = activeRows;
            }

            let depTitle = state.sec ? '<div style="font-size: 14px; color: #64748b; font-weight: 800; margin-top: ' + (subTitleText ? '-10px' : '-15px') + '; margin-bottom: 20px; text-align: center; text-transform: uppercase;">' + state.sec + '</div>' : "";
            if (state.sec) geoRows = geoRows.filter(r => r.sec === state.sec);

            const isGlobal = (baseArray === ORIGINAL_DATA);
            const totalRP = geoRows.reduce((sum, r) => sum + (isGlobal ? r.fullRp : r.rp), 0);
            const totalOP = geoRows.reduce((sum, r) => sum + (isGlobal ? r.fullOp : r.op), 0);

            let invTitleLabel = "INVERSIÓN TOTAL DEPARTAMENTAL (RP)";
            if (state.muni) invTitleLabel = "INVERSIÓN TOTAL EN " + state.muni.toUpperCase();
            else if (state.sub) invTitleLabel = "INVERSIÓN TOTAL EN SUBREGIÓN " + state.sub.toUpperCase();

            const groupedBySec = {};
            let totalProjs = 0;

            geoRows.forEach(r => {
                if (!groupedBySec[r.sec]) groupedBySec[r.sec] = {};
                if (!groupedBySec[r.sec][r._key]) {
                    groupedBySec[r.sec][r._key] = { pname: r.pname, bpin: r.pid, sec: r.sec, rp: 0, bienes: new Set() };
                    totalProjs++;
                }
                groupedBySec[r.sec][r._key].rp += (isGlobal ? r.fullRp : r.rp);
            });

            let today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
            let tableRows = '';

            Object.keys(groupedBySec).sort().forEach(sec => {
                tableRows += `
            <tr style="background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-after: avoid;">
                <td colspan="3" style="font-weight: 900; color: #761C33; font-size: 13px; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">
                    🏛️ ${sec}
                </td>
            </tr>`;

                Object.values(groupedBySec[sec]).sort((a, b) => b.rp - a.rp).forEach(p => {
                    const bienesSet = new Set();
                    ORIGINAL_DATA.filter(r => (p.bpin ? r.pid === p.bpin : r.pname === p.pname && r.sec === p.sec) && r.bien && r.bien.trim() !== "")
                        .forEach(r => bienesSet.add(r.bien.trim()));

                    const bienesList = Array.from(bienesSet);
                    let bienesHtml = "";
                    if (bienesList.length > 0) {
                        bienesHtml = `<div style="margin-top: 6px; font-size: 9px; line-height: 1.4;">
                                    <span style="font-weight: 800; color: #64748b;">BIENES O SERVICIOS:</span>
                                    <ul style="margin: 2px 0 0; padding-left: 16px; color: #475569;">
                                        ${bienesList.map(b => `<li>${b.replace(/\n/g, '<br>')}</li>`).join('')}
                                    </ul>
                                  </div>`;
                    } else {
                        bienesHtml = `<div style="margin-top: 6px; font-size: 9px; font-weight: 600; color: #94a3b8; font-style: italic;">Sin bienes/servicios detallados</div>`;
                    }

                    tableRows += `<tr>
                    <td style="border-bottom: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top;">${p.bpin || 'N/A'}</td>
                    <td style="font-weight: 600; border-bottom: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top;">
                        ${p.pname}
                        ${bienesHtml}
                    </td>
                    <td style="text-align: right; font-weight: 900; color: #761C33; border-bottom: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top; font-size: 11px;">${fmtCOP(p.rp)}</td>
                </tr>`;
                });
            });

            let demoHtml = "";
            let ipmBoxHtml = "";

            if (state.muni) {
                const mKey = norm(state.muni);
                const d = DEMOGRAFIA_MPO[mKey];
                const ipm = IPM_DATA[mKey];

                if (d && d.total > 0) {
                    demoHtml = `
                <div class="demo-overlay" style="position: absolute; bottom: 15px; left: 15px; background: transparent; box-shadow: none; border: none; z-index: 1000; font-family: 'Inter', sans-serif; text-shadow: 0px 0px 4px white, 0px 0px 6px white, 0px 0px 8px white, 0px 0px 10px white, 0px 0px 12px white; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 280px;">
                    <div style="font-size: 11px; color: #0f172a; line-height: 1.6; font-weight: 800;">
                        <div style="margin-bottom: 6px; border-bottom: 2px solid #761C33; padding-bottom: 4px;">
                            <span style="text-transform: uppercase;">POB. TOTAL:</span> <b style="color:#761C33; font-size:18px;">${fmt(d.total)}</b> <span style="font-size: 10px;">hab.</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;"><span>URBANA:</span> <b>${fmt(d.urbana)}</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>RURAL:</span> <b>${fmt(d.rural)}</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>HOMBRES:</span> <b>${fmt(d.hombres)}</b></div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;"><span>MUJERES:</span> <b>${fmt(d.mujeres)}</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>% NIÑOS, NIÑAS Y ADOLESCENTES (0-17):</span> <b style="color:#761C33;">${(d.nna * 100).toFixed(1)}%</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>% JÓVENES (18-28):</span> <b style="color:#761C33;">${(d.jovenes * 100).toFixed(1)}%</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>% ADULTOS (29-59):</span> <b style="color:#761C33;">${(d.adultos * 100).toFixed(1)}%</b></div>
                        <div style="display: flex; justify-content: space-between;"><span>% ADULTO MAYOR (60+):</span> <b style="color:#761C33;">${(d.amayor * 100).toFixed(1)}%</b></div>
                    </div>
                    <div style="color:#0f172a; font-weight:900; font-size: 8px; margin-top: 8px; text-transform: uppercase; text-align: right;">Fuente: Proyección DANE 2026</div>
                </div>`;
                }

                if (ipm && Object.keys(ipm).length > 0) {
                    
                    // 1. EXTRACTOR MATEMÁTICO: Solo para saber quién es mayor (Top 3)
                    const extractNum = (val) => {
                        if (val === null || val === undefined || val === '') return -1;
                        let num = parseFloat(String(val).replace('%', '').replace(',', '.').trim());
                        return isNaN(num) ? -1 : num;
                    };

                    // 2. FORMATEADOR VISUAL DE PORCENTAJES: Convierte el decimal oculto de Sheets (0.345) en "34,5%"
                    const formatPct = (val) => {
                        if (val === null || val === undefined || val === '') return '0%';
                        let str = String(val).trim();
                        if (str.includes('%')) return str; // Si ya trae %, se respeta intacto
                        
                        let num = parseFloat(str);
                        if (isNaN(num)) return '0%';
                        
                        // Multiplicamos por 100 (ej: 0.002 * 100 = 0.2)
                        // Math.round corrige fallos nativos de JS (ej. evitar que 0.14 * 100 se vuelva 14.000000001)
                        let pct = Math.round(num * 10000) / 100;
                        
                        // Devolvemos el número cambiando punto por coma y agregando %
                        return String(pct).replace('.', ',') + '%';
                    };

                    // Aplicamos el formateador de porcentaje al TOTAL
                    let ipmTotalKey = Object.keys(ipm).find(k => k.toUpperCase().includes('TOTAL'));
                    let ipmTotalVal = ipmTotalKey ? formatPct(ipm[ipmTotalKey]) : '0%';

                    // El Sisbén NO pasa por el formateador de porcentajes (se queda como número plano)
                    let sisbenKey = Object.keys(ipm).find(k => k.toUpperCase().includes('SISBEN'));
                    let sisbenVal = sisbenKey ? ipm[sisbenKey] : null;

                    let sisbenHtml = sisbenKey ? `
                    <div style="background: #e2e8f0; color: #334155; padding: 4px 10px; border-radius: 6px; font-size: 14px; font-weight: 900; margin-right: 10px;">
                        SISBEN: ${fmt(sisbenVal)} Habitantes.
                    </div>` : "";

                    // Filtramos, ordenamos con extractNum, y a la hora de imprimir usamos formatPct
                    const deficitsSorted = Object.entries(ipm)
                        .filter(([k]) => !k.toUpperCase().includes('TOTAL') && !k.toUpperCase().includes('SISBEN'))
                        .sort(([, a], [, b]) => extractNum(b) - extractNum(a))
                        .slice(0, 3);

                    if (deficitsSorted.length > 0 || sisbenKey) {
                        ipmBoxHtml = `
                    <div style="margin-bottom: 25px; padding: 15px; background: #fffcf4; border: 1px solid #CBA135; border-left: 5px solid #761C33; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="font-size: 13px; font-weight: 900; color: #761C33; text-transform: uppercase;">
                                PRINCIPALES BARRERAS SOCIOECONÓMICAS (IPM):
                            </div>
                            <div style="display: flex; align-items: center;">
                                ${sisbenHtml}
                                <div style="background: #761C33; color: white; padding: 4px 10px; border-radius: 6px; font-size: 14px; font-weight: 900;">
                                    IPM TOTAL: ${ipmTotalVal}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 15px;">
                            ${deficitsSorted.map(([name, val]) => {
                            let cleanName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                            return `
                                <div style="flex: 1; background: white; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center;">
                                    <span style="display: block; font-size: 16px; font-weight: 900; color: #761C33;">${formatPct(val)}</span>
                                    <span style="display: block; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 4px;">${cleanName}</span>
                                </div>`;
                        }).join('')}
                        </div>
                    </div>`;
                    }
                }
            }

            let logoSrc = document.getElementById('mainLogo').src;

            // Filtrado del GeoJSON para pasarlo al nuevo tab
            const filteredFeatures = MAP_GEOJSON.features.filter((f) => {
                const geoName = f.properties.NOM_MPIO.toUpperCase().trim();
                const canon = state.munisList.find(m => norm(m) === norm(geoName)) || geoName;
                if (state.muni) return canon === state.muni;
                if (state.sub) return getSubregionOfMuni(canon) === state.sub;
                return true;
            }).map((f) => {
                const geoName = f.properties.NOM_MPIO.toUpperCase().trim();
                const canon = state.munisList.find(m => norm(m) === norm(geoName)) || geoName;
                const subName = getSubregionOfMuni(canon);
                const colorDinamico = subName ? DICT_SUBREGIONES[subName].color : geoColor;
                return {
                    ...f,
                    properties: {
                        ...f.properties,
                        fillColor: colorDinamico
                    }
                };
            });
            const printGeoJSON = { type: "FeatureCollection", features: filteredFeatures };

            // Abrimos ventana en blanco para la previsualización
            const w = window.open('', '_blank');
            if (!w) {
                alert("El navegador bloqueó la ventana emergente. Por favor, habilita las ventanas emergentes en este sitio para ver la previsualización del reporte.");
                if (btn) { btn.style.pointerEvents = "auto"; btn.style.opacity = "1"; }
                return;
            }

            let htmlDoc = `<!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8" />
                <title>Previsualización de Reporte - ${geoTitle}</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    body {
                        margin: 0;
                        font-family: 'Inter', sans-serif;
                        background-color: #f1f5f9;
                        color: #1e293b;
                        padding-top: 60px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .preview-header-bar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 60px;
                        background-color: #761C33;
                        color: #ffffff;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0 24px;
                        z-index: 10000;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .preview-title {
                        font-weight: 800;
                        font-size: 14px;
                        letter-spacing: 0.5px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        text-transform: uppercase;
                    }
                    .preview-actions {
                        display: flex;
                        gap: 12px;
                    }
                    .btn-action {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        font-size: 11px;
                        font-weight: 800;
                        border-radius: 6px;
                        cursor: pointer;
                        border: none;
                        transition: all 0.2s ease;
                        text-transform: uppercase;
                    }
                    .btn-print {
                        background-color: #CBA135;
                        color: #ffffff;
                    }
                    .btn-print:hover {
                        background-color: #b58d2a;
                        transform: translateY(-1px);
                    }
                    .btn-close {
                        background-color: transparent;
                        border: 1px solid rgba(255, 255, 255, 0.4);
                        color: #ffffff;
                    }
                    .btn-close:hover {
                        background-color: rgba(255, 255, 255, 0.1);
                        border-color: #ffffff;
                    }
                    .print-content {
                        background: #ffffff;
                        width: calc(100% - 40px);
                        max-width: 1000px;
                        margin: 30px auto;
                        padding: 30px 40px;
                        border-radius: 12px;
                        box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.05), 0 4px 6px -2px rgba(15, 23, 42, 0.02);
                        position: relative;
                        border: 1px solid #e2e8f0;
                    }
                    .print-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-bottom: 3px solid #761C33;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .print-header img {
                        height: 50px;
                    }
                    .print-header-info {
                        text-align: right;
                    }
                    .print-header-info p {
                        margin: 2px 0;
                        color: #64748b;
                        font-size: 11px;
                        text-transform: uppercase;
                        font-weight: 700;
                    }
                    .print-title {
                        text-align: center;
                        font-size: 26px;
                        font-weight: 900;
                        text-transform: uppercase;
                        margin: 10px 0 15px 0;
                    }
                    .map-wrapper {
                        position: relative;
                        margin-bottom: 25px;
                        border-radius: 10px;
                        overflow: hidden;
                        border: 1px solid #cbd5e1;
                        /* Mismo fondo texturizado que la página principal del monitor */
                        background-color: #f8fafc;
                        background-image: url('https://lh3.googleusercontent.com/d/1oLgtwF_8bTeOWUE5xGeJT19ByY-t8FV_');
                        background-size: cover;
                        background-position: center center;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print-map {
                        height: 10cm !important;
                        background: transparent;
                        cursor: default;
                    }
                    .leaflet-container {
                        background: transparent !important;
                    }
                    .print-kpi-container {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        margin-bottom: 25px;
                    }
                    .print-kpi-main {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px 25px;
                        background: #fffcf4;
                        border: 1px solid #CBA135;
                        border-left: 6px solid #761C33;
                        border-radius: 10px;
                    }
                    .print-kpi-main-label {
                        font-size: 16px;
                        font-weight: 900;
                        color: #761C33;
                        text-transform: uppercase;
                    }
                    .print-kpi-main-value {
                        font-size: 28px;
                        font-weight: 900;
                        color: #761C33;
                        margin: 0;
                    }
                    .print-kpi-row {
                        display: flex;
                        gap: 10px;
                        width: 100%;
                    }
                    .print-kpi-card {
                        flex: 1;
                        padding: 12px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        text-align: center;
                        background: #f8fafc;
                        border-top: 3px solid #CBA135;
                    }
                    .print-kpi-label {
                        font-size: 9px;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                    }
                    .print-kpi-value {
                        font-size: 16px;
                        font-weight: 900;
                        color: #1e293b;
                        margin-top: 4px;
                    }
                    .print-section-title {
                        font-size: 14px;
                        font-weight: 900;
                        color: #761C33;
                        text-transform: uppercase;
                        margin: 25px 0 10px 0;
                        border-left: 4px solid #CBA135;
                        padding-left: 8px;
                    }
                    .print-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        font-size: 10px;
                    }
                    .print-table th {
                        background: #f1f5f9;
                        color: #475569;
                        font-weight: 800;
                        text-align: left;
                        padding: 8px 10px;
                        border-bottom: 2px solid #cbd5e1;
                        text-transform: uppercase;
                    }
                    .print-table td {
                        padding: 6px 10px;
                        border-bottom: 1px solid #e2e8f0;
                        vertical-align: top;
                    }
                    .print-footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 9px;
                        color: #94a3b8;
                        text-align: center;
                        font-weight: 600;
                        text-transform: uppercase;
                    }
                    @media print {
                        @page {
                            size: letter landscape;
                            margin: 1.2cm;
                        }
                        body {
                            background-color: #ffffff;
                            padding-top: 0;
                        }
                        .preview-header-bar {
                            display: none !important;
                        }
                        .print-content {
                            margin: 0;
                            padding: 0;
                            box-shadow: none;
                            border: none;
                            width: 100%;
                            max-width: 1000px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="preview-header-bar">
                    <div class="preview-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#CBA135;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Vista Previa de Reporte - ${geoTitle}
                    </div>
                    <div class="preview-actions">
                        <button id="btnPrintPopup" name="btnPrintPopup" type="button" class="btn-action btn-print" onclick="window.print()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Imprimir / PDF
                        </button>
                        <button id="btnClosePopup" name="btnClosePopup" type="button" class="btn-action btn-close" onclick="window.close()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Cerrar
                        </button>
                    </div>
                </div>

                <div class="print-content">
                    <div class="print-header">
                        <img src="${logoSrc}" referrerpolicy="no-referrer">
                        <div class="print-header-info">
                            <p style="margin:0; font-weight:bold; color:#64748b;">REPORTE OFICIAL DE INVERSIÓN PÚBLICA</p>
                            <p style="margin:0; color:#64748b;">Corte: ${today}</p>
                        </div>
                    </div>

                    <div class="print-title" style="color: ${geoColor};">${geoTitle}</div>
                    ${subTitleText}
                    ${depTitle}

                    <div class="map-wrapper">
                        <div id="printMapObj" class="print-map"></div>
                        ${demoHtml}
                    </div>

                    ${ipmBoxHtml}

                    <div class="print-kpi-container">
                        <div class="print-kpi-main">
                            <div class="print-kpi-main-label">${invTitleLabel}</div>
                            <div class="print-kpi-main-value">${fmtCOP(totalRP)}</div>
                        </div>
                        <div class="print-kpi-row">
                            <div class="print-kpi-card" style="border-top-color: #64748b;">
                                <div class="print-kpi-label">Proyectos Registrados</div>
                                <div class="print-kpi-value">${totalProjs}</div>
                            </div>
                        </div>
                    </div>

                    ${tableRows ? `
                    <div class="print-section-title">Matriz Detallada de Proyectos por Dependencia</div>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 15%">BPIN</th>
                                <th style="width: 65%">Nombre del Proyecto y Bienes</th>
                                <th style="width: 20%; text-align: right;">Valor Asignado (RP)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>` : ''}

                    <div class="print-footer">Monitor Territorial Tolima 2026 | Sistema Zero Data Loss</div>
                </div>

                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"><\/script>
                <script>
                    window.onload = function() {
                        const printGeoJSON = ${JSON.stringify(printGeoJSON)};
                        const map = L.map('printMapObj', {
                            zoomControl: false,
                            attributionControl: false,
                            fadeAnimation: false,
                            zoomAnimation: false,
                            dragging: false,
                            touchZoom: false,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            keyboard: false
                        });

                        const layer = L.geoJSON(printGeoJSON, {
                            style: function(f) {
                                return { fillColor: f.properties.fillColor, fillOpacity: 0.95, color: '#ffffff', weight: 2 };
                            }
                        }).addTo(map);

                        if (layer.getLayers().length > 0) {
                            map.fitBounds(layer.getBounds(), { padding: [20, 20], animate: false });
                        }

                        setTimeout(function() {
                            map.invalidateSize();
                        }, 300);
                    };
                <\/script>
            </body>
            </html>`;

            w.document.open();
            w.document.write(htmlDoc);
            w.document.close();

            if (btn) { btn.style.pointerEvents = "auto"; btn.style.opacity = "1"; }
        }

        if ($('subFilter')) $('subFilter').onchange = (e) => selectSubregion(e.target.value);
        if ($('muniFilter')) $('muniFilter').onchange = (e) => selectMuni(e.target.value);
        if ($('secFilter')) $('secFilter').onchange = (e) => selectSec(e.target.value);
        if ($('fuenteFilter')) $('fuenteFilter').onchange = (e) => { state.fuente = e.target.value; calculateDashboard(); };
        if ($('btnClosePanel')) {
            $('btnClosePanel').onclick = () => {
                // Reiniciar todos los filtros y mostrar visión global del Tolima
                state.sub = "";
                state.muni = "";
                state.sec = "";
                state.excl = false;
                if ($('subFilter')) $('subFilter').value = "";
                if ($('muniFilter')) $('muniFilter').value = "";
                if ($('secFilter')) $('secFilter').value = "";
                updateMuniDropdown();
                if (state.muniLayer && Object.keys(state.muniLayer._layers).length > 0) {
                    try { map.flyToBounds(state.muniLayer.getBounds()); } catch(e) {}
                }
                // Cerrar panel lateral
                if ($('detail-panel')) $('detail-panel').classList.remove('open');
                calculateDashboard();
            };
        }
        if ($('btnBack')) $('btnBack').onclick = () => selectSec("");
        if ($('btnHeatmap')) $('btnHeatmap').onclick = () => { state.heat = !state.heat; if (state.heat) state.subMap = false; updateButtonsUI(); updateMapStyles(); };
        if ($('btnSubmap')) $('btnSubmap').onclick = () => { state.subMap = !state.subMap; if (state.subMap) state.heat = false; updateButtonsUI(); updateMapStyles(); };

        window.onload = init;