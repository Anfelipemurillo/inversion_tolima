const $ = (id) => document.getElementById(id);
const norm = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cleanStr = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
// Convierte texto a Sentence case (primera letra mayúscula, resto minúsculas)
const toSentenceCase = s => s && s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

const DICT_SUBREGIONES = {
    "Centro": { munis: ["IBAGUE", "ALVARADO", "ANZOATEGUI", "CAJAMARCA", "COELLO", "ESPINAL", "FLANDES", "PIEDRAS", "ROVIRA", "SAN LUIS", "VALLE DE SAN JUAN"], color: "#eab308" },
    "Nevados": { munis: ["CASABIANCA", "HERVEO", "LERIDA", "LIBANO", "MURILLO", "SANTA ISABEL", "VENADILLO", "VILLAHERMOSA"], color: "#10b981" },
    "Norte": { munis: ["AMBALEMA", "ARMERO", "ARMERO GUAYABAL", "FALAN", "FRESNO", "HONDA", "MARIQUITA", "SAN SEBASTIAN DE MARIQUITA", "PALOCABILDO"], color: "#0ea5e9" },
    "Oriente": { munis: ["CARMEN DE APICALA", "CUNDAY", "ICONONZO", "MELGAR", "VILLARRICA", "VILLARICA"], color: "#ef4444" },
    "Sur": { munis: ["ATACO", "CHAPARRAL", "COYAIMA", "NATAGAIMA", "ORTEGA", "PLANADAS", "RIOBLANCO", "RONCESVALLES", "SAN ANTONIO"], color: "#ec4899" },
    "Suroriente": { munis: ["ALPUJARRA", "DOLORES", "GUAMO", "PRADO", "PURIFICACION", "SALDANA", "SUAREZ"], color: "#f97316" }
};

const DIMENSIONES_MAP = {
    "EDUCACION": ["ANALFABETISMO - MAYORES DE 14 ANOS", "BAJO LOGRO EDUCATIVO - MAYORES DE 14 ANOS, MENOS DE 9 ANOS DE ESTUDIO"],
    "INFANCIA Y JUVENTUD": ["BARRERAS A SERVICIOS PARA CUIDADO DE LA PRIMERA INFANCIA 0 - 5 ANOS", "INASISTENCIA ESCOLAR 6 - 16 ANOS", "REZAGO ESCOLAR NNA 7-17 ANOS", "TRABAJO INFANTIL NNA 12 - 17 ANOS"],
    "TRABAJO - INGRESO": ["DESEMPLEO DE LARGA DURACION - TASA DE DEPENDENCIA", "TRABAJO INFORMAL"],
    "SALUD": ["BARRERAS DE ACCESO A SERVICIOS DE SALUD", "SIN ASEGURAMIENTO EN SALUD"],
    "VIVIENDA SERVICIOS PUBLICOS - HABITABILIDAD": ["HACINAMIENTO CRITICO", "INADECUADA ELIMINACION DE EXCRETAS", "MATERIAL INADECUADO DE PAREDES EXTERIORES", "MATERIAL INADECUADO DE PISOS", "SIN ACCESO A FUENTE DE AGUA MEJORADA"]
};

const VIGENCIA_DATA_CACHE = {};
let DATOS_IPM = {};
let GLOBAL_STATS = {};
let DEMOGRAFIA_MPO = {};
let map, muniLayer;
const state = { muni: "", subregion: "", heat: false, submap: false, maxIPM: 0, munisList: [], isDragging: false };

const formatPct = v => (v == null || v === "" || v === "-") ? "-" : (String(v).includes('%') ? v : (parseFloat(String(v).replace(',', '.')) || 0).toFixed(2).replace('.', ',') + "%");
const formatHab = v => (v == null || v === "" || v === "-") ? "-" : parseInt(String(v).replace(/\D/g, ''), 10).toLocaleString('es-CO');

function getIconForDimension(d) {
    const m = { "EDUCACION": "📚", "INFANCIA Y JUVENTUD": "🧸", "TRABAJO - INGRESO": "💼", "SALUD": "🏥", "VIVIENDA SERVICIOS PUBLICOS - HABITABILIDAD": "🏠" };
    return m[d] || "📊";
}

function isMuniInSubregion(muniName, subName) {
    if (!subName) return false;
    return DICT_SUBREGIONES[subName].munis.includes(norm(muniName));
}

function getSubregionOfMuni(muniName) {
    const nName = norm(muniName);
    for (const [sub, data] of Object.entries(DICT_SUBREGIONES)) {
        if (data.munis.includes(nName)) return sub;
    }
    return null;
}

// -------------------------------------------------------------------
// NUEVA LECTURA LOCAL (FETCH)
// -------------------------------------------------------------------
async function cambiarVigencia(periodo) {
    document.querySelectorAll('.btn-vigencia').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btnVigencia' + periodo);
    if (btn) btn.classList.add('active');

    $('loader').style.display = 'flex';
    $('loader').style.opacity = '1';
    $('loadingText').innerHTML = "Cargando periodo " + periodo + "...";

    try {
        if (!VIGENCIA_DATA_CACHE[periodo]) {
            const response = await fetch('./datos_' + periodo + '.json');
            const payload = await response.json();
            if (!payload || !payload.ok) throw new Error(payload ? payload.error : "Error de lectura de datos.");
            VIGENCIA_DATA_CACHE[periodo] = payload;
        }

        const payload = VIGENCIA_DATA_CACHE[periodo];
        procesarNuevosDatos(payload.data, payload.demo);

        if (!muniLayer && typeof MAP_GEOJSON !== 'undefined') {
            construirCapaMapa();
        }

        // Si no hay municipio seleccionado aún, arrancar con vista global TOLIMA
        if (!state.muni) {
            selectMuni('TOLIMA');
        } else {
            selectMuni(state.muni);
        }

        $('loader').style.opacity = '0';
        setTimeout(() => {
            $('loader').style.display = 'none';
            $('loadingText').innerHTML = "Sincronizando IPM Tolima...";
            $('loadingText').style.color = "var(--vinotinto)";
        }, 400);

    } catch (err) {
        console.error(err);
        $('loadingText').innerHTML = `<span style="color:#dc2626;">Error Crítico: ${err.message}</span>`;
    }
}

function procesarNuevosDatos(rawData, demoData) {
    DATOS_IPM = {};
    state.maxIPM = 0;
    GLOBAL_STATS = { fuente: "Fuente: No disponible" };
    let fuenteDatosStr = "Cargando...";

    let headerRow = [];
    let dataStartIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
        const rowStr = rawData[i].map(c => norm(c));
        if (rowStr.includes("MUNICIPIO")) {
            headerRow = rawData[i].map(c => cleanStr(c));
            dataStartIndex = i + 1;
            break;
        }
    }

    const getColIdx = (name) => headerRow.indexOf(cleanStr(name));

    const cols = {
        muni: getColIdx("MUNICIPIO"), hab: getColIdx("HABITANTES SISBEN"), total: getColIdx("IPM TOTAL"),
        extremo: getColIdx("IPM EXTREMO"), moderado: getColIdx("IPM MODERADO"), vulnerable: getColIdx("IPM VULNERABLE"),
        nopobre: getColIdx("NO POBRE"), fuente: getColIdx("FUENTE")
    };

    for (let i = dataStartIndex; i < rawData.length; i++) {
        const row = rawData[i];
        if (cols.muni === -1 || !row[cols.muni]) continue;

        const muniKey = norm(row[cols.muni]);
        let ipmTotalVal = cols.total !== -1 ? parseFloat(String(row[cols.total] || 0).replace(',', '.')) : 0;
        if (muniKey !== 'TOLIMA' && !isNaN(ipmTotalVal) && ipmTotalVal > state.maxIPM) {
            state.maxIPM = ipmTotalVal;
        }

        if (cols.fuente !== -1 && row[cols.fuente]) fuenteDatosStr = String(row[cols.fuente]);

        DATOS_IPM[muniKey] = {
            nombreReal: row[cols.muni],
            stats: {
                habitantes: cols.hab !== -1 ? row[cols.hab] : "-", ipmTotal: cols.total !== -1 ? row[cols.total] : "-",
                ipmExtremo: cols.extremo !== -1 ? row[cols.extremo] : "-", ipmModerado: cols.moderado !== -1 ? row[cols.moderado] : "-",
                ipmVulnerable: cols.vulnerable !== -1 ? row[cols.vulnerable] : "-", noPobre: cols.nopobre !== -1 ? row[cols.nopobre] : "-"
            },
            dimensiones: {}
        };

        for (const [dim, indicadores] of Object.entries(DIMENSIONES_MAP)) {
            DATOS_IPM[muniKey].dimensiones[dim] = [];
            indicadores.forEach(ind => {
                const idx = getColIdx(ind);
                if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
                    DATOS_IPM[muniKey].dimensiones[dim].push({ nombre: ind, valor: row[idx] });
                }
            });
        }
    }

    if (DATOS_IPM['TOLIMA']) {
        GLOBAL_STATS = { fuente: "Fuente: " + fuenteDatosStr };
    }

    if ($('fuenteDatos')) $('fuenteDatos').innerHTML = GLOBAL_STATS.fuente.split(',')[0].replace("Coordinación", "<br>Coordinación");

    if (demoData && demoData.length > 0) {
        let headers = demoData[0].map(h => norm(h));
        let getIdx = (keywords) => headers.findIndex(h => keywords.some(kw => h.includes(kw)));
        let idxMuni = getIdx(['MUNICIPIO', 'ENTIDAD']); if (idxMuni === -1) idxMuni = 0;
        let idxTotal = getIdx(['TOTAL']); let idxUrbana = getIdx(['URBANA', 'CABECERA']); let idxRural = getIdx(['RURAL', 'RESTO']);
        let idxHombres = getIdx(['HOMBRES', 'MASCULINO']); let idxMujeres = getIdx(['MUJERES', 'FEMENINO']);
        let idxNna = getIdx(['NNA', '0-17']); let idxJovenes = getIdx(['JOVENES', '18-28', 'JÓVENES']);
        let idxAdultos = getIdx(['ADULTOS', '29-59']); let idxAmayor = getIdx(['MAYOR', '60+']);

        for (let i = 1; i < demoData.length; i++) {
            let row = demoData[i];
            let mName = norm(row[idxMuni]);
            if (!mName) continue;
            DEMOGRAFIA_MPO[mName] = {
                total: idxTotal !== -1 ? row[idxTotal] : 0, urbana: idxUrbana !== -1 ? row[idxUrbana] : 0, rural: idxRural !== -1 ? row[idxRural] : 0,
                hombres: idxHombres !== -1 ? row[idxHombres] : 0, mujeres: idxMujeres !== -1 ? row[idxMujeres] : 0,
                nna: idxNna !== -1 ? parseFloat(String(row[idxNna]).replace(',', '.')) || 0 : 0,
                jovenes: idxJovenes !== -1 ? parseFloat(String(row[idxJovenes]).replace(',', '.')) || 0 : 0,
                adultos: idxAdultos !== -1 ? parseFloat(String(row[idxAdultos]).replace(',', '.')) || 0 : 0,
                amayor: idxAmayor !== -1 ? parseFloat(String(row[idxAmayor]).replace(',', '.')) || 0 : 0
            };
        }
    }

    state.munisList = Object.keys(DATOS_IPM).filter(k => k !== 'TOLIMA').sort((a, b) => DATOS_IPM[a].nombreReal.localeCompare(DATOS_IPM[b].nombreReal));
    populateMuniFilter();
}

function construirCapaMapa() {
    if (muniLayer) map.removeLayer(muniLayer);
    muniLayer = L.geoJSON(MAP_GEOJSON, {
        style: function (f) {
            return { fillColor: '#761C33', fillOpacity: 0.9, color: '#ffffff', weight: 1 };
        },
        onEachFeature: (f, l) => {
            const name = f.properties.NOM_MPIO.toUpperCase();
            l.bindTooltip(name, { className: 'muni-tooltip', sticky: true });
            l.on('mouseover', function () {
                const canon = state.munisList.find(x => x === norm(name)) || name;
                const subName = getSubregionOfMuni(canon);
                const isInSub = !state.subregion || state.subregion === subName;
                if (!state.isDragging && canon !== state.muni && isInSub && !state.heat && !state.submap) {
                    this.setStyle({ fillColor: '#CBA135', fillOpacity: 0.9, color: '#ffffff', weight: 1.5 });
                    this.bringToFront();
                } else if (!state.isDragging && state.submap && canon !== state.muni && isInSub) {
                    this.setStyle({ fillOpacity: 1, weight: 2.5 });
                    this.bringToFront();
                }
            });
            l.on('mouseout', updateMapStyles);
            l.on('click', () => {
                const canon = state.munisList.find(x => x === norm(name)) || name;
                if (!state.subregion || isMuniInSubregion(canon, state.subregion)) selectMuni(canon);
            });
        }
    }).addTo(map);

    map.fitBounds(muniLayer.getBounds());
    updateMapStyles();
}

function getHeatmapColor(val, max) {
    if (!val || max === 0) return '#f8f6f0';
    let numericVal = parseFloat(String(val).replace(',', '.').replace('%', ''));
    if (isNaN(numericVal)) return '#EBE1B1';
    const pct = numericVal / max;
    if (pct >= 0.80) return '#8A6D1C';
    if (pct >= 0.60) return '#A8852B';
    if (pct >= 0.40) return '#CBA135';
    if (pct >= 0.20) return '#DBC173';
    return '#EBE1B1';
}

function updateMapStyles() {
    if (!muniLayer) return;
    muniLayer.eachLayer(layer => {
        const name = layer.feature.properties.NOM_MPIO.toUpperCase();
        const canon = state.munisList.find(m => m === norm(name)) || name;
        const isSelectedMuni = (canon === state.muni);
        const subName = getSubregionOfMuni(canon);
        const isInSubregion = state.subregion ? state.subregion === subName : true;
        const datosMuni = DATOS_IPM[canon];

        if (isSelectedMuni) {
            layer.setStyle({ fillColor: '#761C33', fillOpacity: 1, color: '#CBA135', weight: 2 });
            layer.bringToFront();
        } else if (state.subregion && !isInSubregion) {
            layer.setStyle({ fillColor: '#761C33', fillOpacity: 0.1, color: '#ffffff', weight: 1 });
        } else if (state.submap && subName) {
            const opacidad = (!state.subregion || state.subregion === subName) ? 0.85 : 0.15;
            layer.setStyle({ fillColor: DICT_SUBREGIONES[subName].color, fillOpacity: opacidad, color: '#ffffff', weight: 1.5 });
        } else if (state.heat && isInSubregion) {
            const ipmVal = datosMuni ? (datosMuni.stats.ipmTotal || 0) : 0;
            layer.setStyle({ fillColor: getHeatmapColor(ipmVal, state.maxIPM), fillOpacity: 0.9, color: '#ffffff', weight: 1.5 });
        } else {
            const isFaded = state.muni && state.muni !== 'TOLIMA';
            layer.setStyle({ fillColor: '#761C33', fillOpacity: isFaded ? 0.2 : 0.9, color: '#ffffff', weight: 1 });
        }
    });
}

function updateSisbenCard(muni) {
    const mKey = muni || 'TOLIMA';
    const d = DATOS_IPM[mKey];
    if (!d || !d.stats) return;
    const g = d.stats;

    const cardTitle = mKey === 'TOLIMA' ? 'CATEGORÍA SISBÉN IV (TOLIMA)' : `CATEGORÍA SISBÉN IV (${d.nombreReal})`;

    $('sisbenCard').innerHTML = `
        <div style="border: 1px solid rgba(148,163,184,0.15); border-radius: 10px; overflow: hidden; background: white; box-shadow: var(--shadow-card);">
            <div style="background: var(--vinotinto); color: white; text-align: center; font-weight: 800; font-size: 11px; padding: 8px; letter-spacing: 0.5px;">${cardTitle}</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); text-align: center;">
                <div style="border-right: 1px solid #f1f5f9; padding: 12px 4px;">
                    <b style="color:var(--vinotinto); font-size:13px; display:block; margin-bottom:2px;">A</b>
                    <span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:4px;">P. Extrema</span>
                    <b style="font-size:14px; font-weight:800; color:var(--vinotinto);">${formatPct(g.ipmExtremo)}</b>
                </div>
                <div style="border-right: 1px solid #f1f5f9; padding: 12px 4px;">
                    <b style="color:var(--vinotinto); font-size:13px; display:block; margin-bottom:2px;">B</b>
                    <span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:4px;">P. Moderada</span>
                    <b style="font-size:14px; font-weight:800; color:var(--vinotinto);">${formatPct(g.ipmModerado)}</b>
                </div>
                <div style="border-right: 1px solid #f1f5f9; padding: 12px 4px;">
                    <b style="color:var(--vinotinto); font-size:13px; display:block; margin-bottom:2px;">C</b>
                    <span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:4px;">Vulnerable</span>
                    <b style="font-size:14px; font-weight:800; color:var(--vinotinto);">${formatPct(g.ipmVulnerable)}</b>
                </div>
                <div style="padding: 12px 4px;">
                    <b style="color:var(--vinotinto); font-size:13px; display:block; margin-bottom:2px;">D</b>
                    <span style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:4px;">No Pobre</span>
                    <b style="font-size:14px; font-weight:800; color:var(--vinotinto);">${formatPct(g.noPobre)}</b>
                </div>
            </div>
        </div>
    `;
}

function renderDetailPanel(m) {
    const d = DATOS_IPM[m], b = $('panelBody');
    $('panelTitle').textContent = d ? (m === 'TOLIMA' ? 'DEPARTAMENTO DEL TOLIMA' : d.nombreReal) : m;
    if (!d?.stats) return b.innerHTML = `<div style="text-align:center;color:var(--text-muted);margin-top:40px;">No hay datos.</div>`;

    let h = `<div class="projCard" style="border-left: 4px solid var(--vinotinto);">
    <div class="projName"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg> Resumen de Pobreza</div>
    <div class="data-row"><span class="data-label">Habitantes Sisbén</span><span class="data-value">${formatHab(d.stats.habitantes)}</span></div>
    ${[['IPM Total', d.stats.ipmTotal, 'highlight'], ['Pobreza extrema', d.stats.ipmExtremo], ['Pobreza moderada', d.stats.ipmModerado], ['Vulnerable', d.stats.ipmVulnerable], ['No pobre', d.stats.noPobre]]
            .map(([l, v, c]) => `<div class="data-row" ${l === 'IPM Total' ? 'style="border-top:2px solid rgba(118,28,51,0.1);margin-top:4px;"' : ''}><span class="data-label" ${l === 'IPM Total' ? 'style="color:var(--vinotinto);font-weight:800;"' : ''}>${l}</span><span class="data-value ${c || ''}">${formatPct(v)}</span></div>`).join('')}
  </div>`;

    Object.entries(d.dimensiones).forEach(([dim, inds]) => {
        if (inds && inds.length > 0) {
            h += `<div class="projCard"><div class="projName">${getIconForDimension(dim)} ${toSentenceCase(dim)}</div>
        ${inds.map(i => `<div class="data-row"><span class="data-label">${toSentenceCase(i.nombre)}</span><span class="data-value">${formatPct(i.valor)}</span></div>`).join('')}</div>`;
        }
    });
    b.innerHTML = h;
}

function populateMuniFilter() {
    const mS = $('muniFilter');
    mS.innerHTML = '<option value="TOLIMA">📊 Visión Global del Tolima</option>';
    state.munisList.forEach(m => {
        if (!state.subregion || isMuniInSubregion(m, state.subregion)) {
            mS.innerHTML += `<option value="${m}">${DATOS_IPM[m].nombreReal}</option>`;
        }
    });
    mS.value = state.muni || '';
}

function getSmartPadding() {
    const isMobile = window.innerWidth <= 900;
    const panelOpen = $('detail-panel').classList.contains('open');
    return isMobile
        ? { ptl: [0, $('sidebar').offsetHeight + 20], pbr: [0, panelOpen ? $('detail-panel').offsetHeight + 20 : 0] }
        : { ptl: [420, 20], pbr: [panelOpen ? 460 : 20, 20] };
}

function init() {
    // Retrasar la inicialización del mapa para permitir que el layout se calcule
    // y evitar un Forced Reflow (Recálculo sincrónico de diseño).
    requestAnimationFrame(() => {
        const customRenderer = L.svg({ padding: 1.5 });
        map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.1, renderer: customRenderer });

        map.on('movestart zoomstart', () => { state.isDragging = true; });
        map.on('moveend zoomend', () => { state.isDragging = false; });

        window.addEventListener('resize', () => {
            if (map) map.invalidateSize();
            if (!state.muni && !state.subregion && muniLayer) map.fitBounds(muniLayer.getBounds());
        });

        cambiarVigencia('2026-1');
    });
}

function selectMuni(m, forceClose = false) {
    state.muni = m;
    if ($('muniFilter')) $('muniFilter').value = m || '';
    if (m) {
        $('detail-panel').classList.add('open');
        renderDetailPanel(m);
        updateSisbenCard(m);
        if (muniLayer) {
            const layer = muniLayer.getLayers().find(l => norm(l.feature.properties.NOM_MPIO) === norm(m));
            if (layer) {
                const pad = getSmartPadding();
                map.flyToBounds(layer.getBounds(), { paddingTopLeft: pad.ptl, paddingBottomRight: pad.pbr, maxZoom: 10, duration: 0.8 });
            } else if (m === 'TOLIMA' && !state.subregion) {
                map.flyToBounds(muniLayer.getBounds());
            }
        }
    } else {
        // Cerrar panel lateral (botón ✕)
        $('detail-panel').classList.remove('open');
        if ($('muniFilter')) $('muniFilter').value = '';

        if (!forceClose && state.subregion) {
            renderDetailPanel("TOLIMA");
            updateSisbenCard("TOLIMA");
        }

        if (state.subregion && muniLayer) {
            const subLayers = muniLayer.getLayers().filter(l => isMuniInSubregion(l.feature.properties.NOM_MPIO, state.subregion));
            if (subLayers.length > 0) {
                const pad = getSmartPadding();
                map.flyToBounds(L.featureGroup(subLayers).getBounds(), { paddingTopLeft: pad.ptl, paddingBottomRight: pad.pbr, duration: 0.8 });
            }
        } else if (muniLayer) {
            map.flyToBounds(muniLayer.getBounds());
        }
    }
    updateMapStyles();
}


function selectSubregion(sub) {
    state.subregion = sub;
    // Al cambiar subregión, si no hay municipio específico, volver a vista TOLIMA
    selectMuni('TOLIMA');
    populateMuniFilter();
    if (sub && muniLayer) {
        const subLayers = muniLayer.getLayers().filter(l => isMuniInSubregion(l.feature.properties.NOM_MPIO, sub));
        if (subLayers.length > 0) {
            const pad = getSmartPadding();
            map.flyToBounds(L.featureGroup(subLayers).getBounds(), { paddingTopLeft: pad.ptl, paddingBottomRight: pad.pbr, duration: 0.8 });
        }
    } else if (muniLayer) map.flyToBounds(muniLayer.getBounds());
    updateMapStyles();
}

// =====================================================================
// MOTOR DE IMPRESIÓN PDF BLINDADO
// =====================================================================
function ejecutarImpresion() {
    const m = state.muni || "TOLIMA";
    const d = DATOS_IPM[m];
    if (!d) { alert("No hay datos cargados para imprimir."); return; }

    const btn = document.querySelector('.print-btn');
    if (btn) { btn.style.pointerEvents = "none"; btn.style.opacity = "0.5"; }

    let geoTitle = m === "TOLIMA" ? "DEPARTAMENTO DEL TOLIMA" : d.nombreReal;
    let geoColor = "#761C33";
    let subTitleText = "";

    if (m !== "TOLIMA") {
        const subName = getSubregionOfMuni(m);
        if (subName) {
            geoColor = DICT_SUBREGIONES[subName].color;
            subTitleText = '<div style="font-size: 16px; color: ' + geoColor + '; font-weight: 800; margin-top: -15px; margin-bottom: 20px; text-align: center; text-transform: uppercase;">SUBREGIÓN ' + subName + '</div>';
        }
    } else if (state.subregion) {
        geoColor = DICT_SUBREGIONES[state.subregion].color;
        subTitleText = '<div style="font-size: 16px; color: ' + geoColor + '; font-weight: 800; margin-top: -15px; margin-bottom: 20px; text-align: center; text-transform: uppercase;">SUBREGIÓN ' + state.subregion + '</div>';
    }

    let today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

    let tableRows = '';
    for (const [dim, inds] of Object.entries(d.dimensiones)) {
        if (inds && inds.length > 0) {
            inds.forEach(i => {
                tableRows += `<tr>
                    <td style="font-weight: 800; border-bottom: 1px solid #e2e8f0; padding: 6px 10px; vertical-align: top;">${dim}</td>
                    <td style="border-bottom: 1px solid #e2e8f0; padding: 6px 10px; vertical-align: top;">${i.nombre}</td>
                    <td style="text-align: right; font-weight: 900; color: #761C33; border-bottom: 1px solid #e2e8f0; padding: 6px 10px; vertical-align: top;">${formatPct(i.valor)}</td>
                </tr>`;
            });
        }
    }

    let demoHtml = "";
    if (m !== "TOLIMA" && DEMOGRAFIA_MPO[norm(m)]) {
        const demo = DEMOGRAFIA_MPO[norm(m)];
        if (demo && demo.total > 0) {
            demoHtml = `
            <div style="position: absolute; bottom: 15px; left: 15px; background: transparent; box-shadow: none; border: none; z-index: 1000; font-family: 'Inter', sans-serif; text-shadow: 0px 0px 4px white, 0px 0px 6px white, 0px 0px 8px white, 0px 0px 10px white, 0px 0px 12px white; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 280px;">
                <div style="font-size: 11px; color: #0f172a; line-height: 1.6; font-weight: 800;">
                    <div style="margin-bottom: 6px; border-bottom: 2px solid #761C33; padding-bottom: 4px;">
                        <span style="text-transform: uppercase;">POB. TOTAL:</span> <b style="color:#761C33; font-size:18px;">${formatHab(demo.total)}</b> <span style="font-size: 10px;">hab.</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;"><span>URBANA:</span> <b>${formatHab(demo.urbana)}</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>RURAL:</span> <b>${formatHab(demo.rural)}</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>HOMBRES:</span> <b>${formatHab(demo.hombres)}</b></div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;"><span>MUJERES:</span> <b>${formatHab(demo.mujeres)}</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>% NIÑOS, NIÑAS Y ADOLESCENTES (0-17):</span> <b style="color:#761C33;">${(demo.nna * (demo.nna < 2 ? 100 : 1)).toFixed(1)}%</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>% JÓVENES (18-28):</span> <b style="color:#761C33;">${(demo.jovenes * (demo.jovenes < 2 ? 100 : 1)).toFixed(1)}%</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>% ADULTOS (29-59):</span> <b style="color:#761C33;">${(demo.adultos * (demo.adultos < 2 ? 100 : 1)).toFixed(1)}%</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>% ADULTO MAYOR (60+):</span> <b style="color:#761C33;">${(demo.amayor * (demo.amayor < 2 ? 100 : 1)).toFixed(1)}%</b></div>
                </div>
                <div style="color:#0f172a; font-weight:900; font-size: 8px; margin-top: 8px; text-transform: uppercase; text-align: right;">Fuente: Proyección DANE 2026</div>
            </div>`;
        }
    }

    const g = d.stats;
    let ipmBoxHtml = `
    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #fffcf4; border: 1px solid #CBA135; border-left: 6px solid #761C33; border-radius: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <div style="font-size: 16px; font-weight: 900; color: #761C33; text-transform: uppercase;">IPM TOTAL</div>
            <div style="font-size: 28px; font-weight: 900; color: #761C33; margin: 0;">${formatPct(g.ipmTotal)}</div>
        </div>
        <div style="display: flex; gap: 10px; width: 100%;">
            <div style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; background: #f8fafc; border-top: 3px solid #761C33; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="color:#761C33; font-size:14px; font-weight:900; margin-bottom:2px;">A</div>
                <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Pobreza Extrema</div>
                <div style="font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px;">${formatPct(g.ipmExtremo)}</div>
            </div>
            <div style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; background: #f8fafc; border-top: 3px solid #CBA135; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="color:#CBA135; font-size:14px; font-weight:900; margin-bottom:2px;">B</div>
                <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Pobreza Moderada</div>
                <div style="font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px;">${formatPct(g.ipmModerado)}</div>
            </div>
            <div style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; background: #f8fafc; border-top: 3px solid #A8852B; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="color:#A8852B; font-size:14px; font-weight:900; margin-bottom:2px;">C</div>
                <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Vulnerable</div>
                <div style="font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px;">${formatPct(g.ipmVulnerable)}</div>
            </div>
            <div style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; background: #f8fafc; border-top: 3px solid #64748b; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="color:#64748b; font-size:14px; font-weight:900; margin-bottom:2px;">D</div>
                <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">No Pobre</div>
                <div style="font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px;">${formatPct(g.noPobre)}</div>
            </div>
        </div>
    </div>`;

    let logoSrc = document.getElementById('mainLogo').src;

    const filteredFeatures = MAP_GEOJSON.features.filter((f) => {
        const canon = norm(f.properties.NOM_MPIO);
        if (m !== "TOLIMA") return canon === norm(m);
        if (state.subregion) return getSubregionOfMuni(canon) === state.subregion;
        return true;
    }).map((f) => {
        const canon = norm(f.properties.NOM_MPIO);
        const subName = getSubregionOfMuni(canon);
        const colorDinamico = (subName && m === "TOLIMA") ? DICT_SUBREGIONES[subName].color : geoColor;
        return {
            ...f,
            properties: { ...f.properties, fillColor: colorDinamico }
        };
    });
    const printGeoJSON = { type: "FeatureCollection", features: filteredFeatures };

    const w = window.open('', '_blank');
    if (!w) {
        alert("El navegador bloqueó la ventana emergente.");
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
            body { margin: 0; font-family: 'Inter', sans-serif; background-color: #f1f5f9; color: #1e293b; padding-top: 60px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .preview-header-bar { position: fixed; top: 0; left: 0; right: 0; height: 60px; background-color: #761C33; color: #ffffff; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; z-index: 10000; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .preview-title { font-weight: 800; font-size: 14px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 10px; text-transform: uppercase; }
            .preview-actions { display: flex; gap: 12px; }
            .btn-action { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 11px; font-weight: 800; border-radius: 6px; cursor: pointer; border: none; transition: all 0.2s ease; text-transform: uppercase; }
            .btn-print { background-color: #CBA135; color: #ffffff; }
            .btn-close { background-color: transparent; border: 1px solid rgba(255, 255, 255, 0.4); color: #ffffff; }

            @media print {
                @page { size: letter landscape; margin: 1cm; }
                body { padding-top: 0 !important; background-color: #ffffff !important; }
                .preview-header-bar { display: none !important; }
                .print-content {
                    margin: 0 !important; padding: 0 !important; border: none !important;
                    box-shadow: none !important; width: 100% !important; max-width: 100% !important;
                }
                .map-wrapper {
                    height: 10cm !important;
                    page-break-inside: avoid !important;
                    background-color: #f8fafc !important;
                }
                #printMapObj {
                    height: 10cm !important;
                    width: 100% !important;
                    display: block !important;
                }
                path, svg {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
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
                <button class="btn-action btn-print" onclick="window.print()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Imprimir / PDF
                </button>
                <button class="btn-action btn-close" onclick="window.close()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Cerrar
                </button>
            </div>
        </div>

        <div class="print-content" style="margin: 30px auto; padding: 30px 40px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; width: calc(100% - 40px); max-width: 1000px; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.05), 0 4px 6px -2px rgba(15, 23, 42, 0.02); position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #761C33; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="${logoSrc}" style="height: 50px; width: auto;" referrerpolicy="no-referrer">
                <div style="text-align: right;">
                    <p style="margin:0; font-weight:bold; color:#64748b; font-size: 11px; text-transform: uppercase;">REPORTE OFICIAL DE POBREZA MULTIDIMENSIONAL</p>
                    <p style="margin:0; color:#64748b; font-size: 11px; text-transform: uppercase;">Corte: ${today}</p>
                </div>
            </div>

            <div style="text-align: center; font-size: 26px; font-weight: 900; text-transform: uppercase; margin: 10px 0 15px 0; color: ${geoColor};">${geoTitle}</div>
            ${subTitleText}

            <div class="map-wrapper" style="position: relative; margin-bottom: 25px; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; background-color: #f8fafc; background-image: url('https://lh3.googleusercontent.com/d/1oLgtwF_8bTeOWUE5xGeJT19ByY-t8FV_'); background-size: cover; background-position: center center; height: 380px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div id="printMapObj" style="width: 100%; height: 100%; background: transparent;"></div>
                ${demoHtml}
            </div>

            ${ipmBoxHtml}

            ${tableRows ? `
            <div style="font-size: 14px; font-weight: 900; color: #761C33; text-transform: uppercase; margin: 25px 0 10px 0; border-left: 4px solid #CBA135; padding-left: 8px;">Matriz Multidimensional - Indicadores de Pobreza</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; color: #475569; font-weight: 800; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; width: 30%;">Dimensión IPM</th>
                        <th style="background: #f1f5f9; color: #475569; font-weight: 800; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; width: 55%;">Indicadores de Pobreza</th>
                        <th style="background: #f1f5f9; color: #475569; font-weight: 800; text-align: right; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; width: 15%;">Valor</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>` : ''}

            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; font-weight: 600; text-transform: uppercase;">
                Monitor Territorial Tolima 2026 | ${GLOBAL_STATS.fuente ? GLOBAL_STATS.fuente.split(',')[0] : ''}
            </div>
        </div>

        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"><\/script>
        <script>
            window.onload = function() {
                const printGeoJSON = ${JSON.stringify(printGeoJSON)};

                const map = L.map('printMapObj', {
                    zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false
                });

                const layer = L.geoJSON(printGeoJSON, {
                    style: function(f) { return { fillColor: f.properties.fillColor, fillOpacity: 0.95, color: '#ffffff', weight: 2 }; }
                }).addTo(map);

                if (layer.getLayers().length > 0) {
                    map.fitBounds(layer.getBounds(), { padding: [20, 20], animate: false });
                }

                window.addEventListener('beforeprint', function() {
                    map.invalidateSize(false);
                    if (layer.getLayers().length > 0) {
                        map.fitBounds(layer.getBounds(), { padding: [20, 20], animate: false });
                    }
                });

                setTimeout(function() { map.invalidateSize(false); }, 400);
            };
        <\/script>
    </body>
    </html>`;

    w.document.open();
    w.document.write(htmlDoc);
    w.document.close();

    if (btn) { btn.style.pointerEvents = "auto"; btn.style.opacity = "1"; }
}

$('subregionFilter').onchange = (e) => selectSubregion(e.target.value);
$('muniFilter').onchange = (e) => selectMuni(e.target.value);
$('btnClosePanel').onclick = () => selectMuni("", true);

$('btnHeatmap').onclick = () => {
    state.heat = !state.heat;
    if (state.heat) state.submap = false;
    $('btnHeatmap').classList.toggle('active', state.heat);
    $('btnSubmap').classList.toggle('active', state.submap);
    updateMapStyles();
};

$('btnSubmap').onclick = () => {
    state.submap = !state.submap;
    if (state.submap) state.heat = false;
    $('btnSubmap').classList.toggle('active', state.submap);
    $('btnHeatmap').classList.toggle('active', state.heat);
    updateMapStyles();
};

window.onload = init;