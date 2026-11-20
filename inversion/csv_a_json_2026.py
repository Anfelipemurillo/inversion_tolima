"""Convierte el CSV oficial de inversión 2026 en datos_2026.json (conserva demo e ipm_data).

Reglas territoriales en la columna MUNICIPIO:
- TOLIMA: Inversión departamental no municipalizada (gastos operativos, transversales, etc.).
  NO se divide en los municipios (split=0, rp=0, fullRp=valor). Solo aparece en la
  Visión Global del Tolima (inversión departamental), no en vistas municipales ni subregionales.
- TOLIMA 47 MUNICIPIOS: Cobertura departamental completa (split=47, rp=fullRp/47).
- TOLIMA 46 MUNICIPIOS / TOLIMA 46: Cobertura departamental excluyendo Ibagué
  (p.ej. Secretaría de Educación, split=46, rp=fullRp/46).
- Municipios individuales o listas multi-municipio: split=N, rp=fullRp/N.
"""
import collections
import csv
import json
import os
import re
import shutil
import unicodedata

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(BASE_DIR, '2026 - Inversion por Municipios CONSOLIDADO 30 SEP V1.csv')
OUT = os.path.join(BASE_DIR, 'datos_2026.json')


def n(s):
    """Parsea montos en formato US ($1,234,567.89) o colombiano ($1.234.567,89)."""
    s = str(s or '').replace('$', '').replace('"', '').strip()
    if not s:
        return 0.0
    # Quitar espacios internos
    s = re.sub(r'\s+', '', s)
    if ',' in s and '.' in s:
        if s.rfind('.') > s.rfind(','):
            # Formato US: 1,234,567.89
            s = s.replace(',', '')
        else:
            # Formato CO: 1.234.567,89
            s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        # Si tiene múltiples comas o exactamente 3 dígitos después de la coma -> separador de miles
        parts = s.split(',')
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            s = s.replace(',', '')
        else:
            s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0


def na(s):
    return re.sub(
        r'\s+',
        ' ',
        ''.join(
            c for c in unicodedata.normalize('NFD', str(s or '').upper().strip())
            if unicodedata.category(c) != 'Mn'
        ),
    )


def load_csv_rows(path):
    """Lee el CSV oficial y repara filas partidas por saltos de línea sin comillas en col 13."""
    with open(path, encoding='utf-8-sig') as f:
        raw_rows = list(csv.reader(f))

    header_idx = next(i for i, r in enumerate(raw_rows) if r and r[0].strip().upper() == 'ITEM')
    repaired = []
    i = header_idx + 1
    while i < len(raw_rows):
        row = raw_rows[i]
        # Verificar si la siguiente fila es una continuación rota (empieza con ', $')
        if (
            len(row) >= 14
            and row[0].strip().isdigit()
            and (len(row) < 28 or not row[14].strip())
            and i + 1 < len(raw_rows)
            and raw_rows[i + 1]
            and raw_rows[i + 1][0].strip().startswith(', $')
        ):
            cont = raw_rows[i + 1]
            end_idx = next((idx for idx, val in enumerate(cont) if '"' in val), None)
            if end_idx is not None:
                rp_str = ','.join(cont[: end_idx + 1]).lstrip(',').replace('"', '').strip()
                tail = cont[end_idx + 1 : end_idx + 1 + 13]
                tail += [''] * max(0, 13 - len(tail))
                row = row[:14] + [rp_str] + tail
                i += 1
        if len(row) >= 28 and row[0].strip().isdigit():
            repaired.append(row)
        i += 1
    return repaired


old = json.load(open(OUT, encoding='utf-8'))
d = old['data']

MUNICIPIOS_CANON = [
    "ALPUJARRA", "ALVARADO", "AMBALEMA", "ANZOÁTEGUI", "ARMERO GUAYABAL", "ATACO", "CAJAMARCA",
    "CARMEN DE APICALÁ", "CASABIANCA", "CHAPARRAL", "COELLO", "COYAIMA", "CUNDAY", "DOLORES",
    "ESPINAL", "FALAN", "FLANDES", "FRESNO", "GUAMO", "HERVEO", "HONDA", "IBAGUÉ", "ICONONZO",
    "LÉRIDA", "LÍBANO", "SAN SEBASTIÁN DE MARIQUITA", "MELGAR", "MURILLO", "NATAGAIMA", "ORTEGA",
    "PALOCABILDO", "PIEDRAS", "PLANADAS", "PRADO", "PURIFICACIÓN", "RIOBLANCO", "RONCESVALLES",
    "ROVIRA", "SALDAÑA", "SAN ANTONIO", "SAN LUIS", "SANTA ISABEL", "SUÁREZ", "VALLE DE SAN JUAN",
    "VENADILLO", "VILLAHERMOSA", "VILLARRICA",
]

canon = {na(m): m for m in MUNICIPIOS_CANON}
canon.update({
    'MARIQUITA': 'SAN SEBASTIÁN DE MARIQUITA',
    'SAN SEBASTIAN DE MARIQUITA': 'SAN SEBASTIÁN DE MARIQUITA',
    'EL ESPINAL': 'ESPINAL',
    'CAJAMARCA DE APICALA': 'CARMEN DE APICALÁ',
    'ARMERO': 'ARMERO GUAYABAL',
    'TOLIMA': 'TOLIMA',
    'TOLIMA 47 MUNICIPIOS': 'TOLIMA 47 MUNICIPIOS',
    'TOLIMA 47': 'TOLIMA 47 MUNICIPIOS',
    'TOLIMA 46 MUNICIPIOS': 'TOLIMA 46 MUNICIPIOS',
    'TOLIMA 46': 'TOLIMA 46 MUNICIPIOS',
})

S = {
    'EDUCACION': 'Secretaría de Educación',
    'SECRETARIA DE SALUD': 'Secretaría de Salud',
    'SECRETARIA DE CULTURA Y TURISMO': 'Secretaría de Cultura y Turismo',
    'INDEPORTES TOLIMA': 'Indeportes Tolima',
    'SECRETARIA DE AMBIENTE Y GESTION DEL RIESGO': 'Secretaría de Ambiente y Gestión del Riesgo',
    'SECRETARIA DE DESARROLLO ECONOMICO': 'Secretaría de Desarrollo Económico',
    'EDAT SA ESP': 'EDAT S.A. E.S.P.',
    'SECRETARIA DE DESARROLLO AGROPECUARIO Y PRODUCCION ALIMENTARIA': 'Secretaría de Desarrollo Agropecuario y Producción Alimentaria',
    'SECRETARIA DE INFRAESTRUCTURA Y HABITAT': 'Secretaría de Infraestructura y Hábitat',
    'SECRETARIA DE INCLUSION SOCIAL Y ENFOQUE DIFERENCIAL': 'Secretaría de Inclusión Social y Poblacional',
    'SECRETARIA DE INTERIOR': 'Secretaría del Interior',
    'SECRETARIA DE CONVIVENCIA CIUDADANA SEGURIDAD Y ORDEN PUBLICO': 'Secretaría de Convivencia Ciudadana, Seguridad y Orden Público',
    'SECRETARIA DE LA MUJER': 'Secretaría de la Mujer',
    'TRANSITO': 'Secretaría de Tránsito y Transporte',
    'SECRETARIA DE PLANEACION, PROSPECTIVA Y TIC': 'Secretaría de Planeación, Prospectiva y TIC',
    'SECRETARIA DE PLANEACION PROSPECTIVA Y TIC': 'Secretaría de Planeación, Prospectiva y TIC',
    'SECRETARIA ADMINISTRATIVA Y DE TALENTO HUMANO': 'Secretaría Administrativa y de Talento Humano',
    'SECRETARIA DE HACIENDA': 'Secretaría de Hacienda',
}


def est(s):
    s = na(s)
    if s in ('EN EJECUCION', 'EJUCUCION'):
        return 'EN EJECUCION'
    if s in ('EJECUTADO', 'SUSPENDIDO'):
        return s
    return 'SIN DEFINIR'


def parse_municipio(raw_muni):
    """Devuelve (muni_canon, split) para valores simples, especiales TOLIMA* o multi-municipio."""
    m = na(raw_muni)
    if not m:
        return 'INVERSIÓN EXTRADEPARTAMENTAL', 0
    if m in canon:
        val = canon[m]
        if val == 'TOLIMA':
            return 'TOLIMA', 0
        if val == 'TOLIMA 47 MUNICIPIOS':
            return 'TOLIMA 47 MUNICIPIOS', 47
        if val == 'TOLIMA 46 MUNICIPIOS':
            return 'TOLIMA 46 MUNICIPIOS', 46
        return val, 1

    # Intentar parsear listas multi-municipio (separadas por ',', '.', '-', ' Y ')
    cleaned = re.sub(r'^TOLIMA\s*\((.*)\)$', r'\1', m).strip()
    parts = [p.strip() for p in re.split(r'[,.\-]|\bY\b', cleaned) if p.strip()]
    resolved = []
    for p in parts:
        c = canon.get(p)
        if not c or c in ('TOLIMA', 'TOLIMA 47 MUNICIPIOS', 'TOLIMA 46 MUNICIPIOS'):
            return None, 0
        if c not in resolved:
            resolved.append(c)
    if resolved:
        return ', '.join(resolved), len(resolved)
    return None, 0


rows = load_csv_rows(CSV)
new, problems = [], []
for x in rows:
    muni, sp = parse_municipio(x[2])
    sec = S.get(na(x[27]))
    if not muni or not sec:
        problems.append((x[0], x[2], x[27]))
        continue
    full = n(x[14])
    f = [n(x[i]) for i in range(15, 20)]
    rp_muni = (full / sp) if sp > 0 else 0.0
    new.append(dict(
        muni=muni,
        sec=sec,
        rp=rp_muni,
        op=0,
        fullRp=full,
        fullOp=0,
        pid=x[7].strip(),
        pname=x[8].strip(),
        bien=x[21].strip(),
        split=sp,
        estado=est(x[22]),
        propios=f[0],
        sgr=f[1],
        sgp=f[2],
        credito=f[3],
        cofin=f[4],
    ))

print('filas CSV', len(rows), '| nuevas', len(new), '| problemas', problems)

# Resumen por categoría territorial
cats = collections.Counter()
cat_totals = collections.defaultdict(float)
for q in new:
    if q['muni'] in ('TOLIMA', 'TOLIMA 47 MUNICIPIOS', 'TOLIMA 46 MUNICIPIOS', 'INVERSIÓN EXTRADEPARTAMENTAL'):
        k = q['muni']
    elif q['split'] > 1:
        k = 'MULTI-MUNICIPIO'
    else:
        k = 'MUNICIPIO INDIVIDUAL'
    cats[k] += 1
    cat_totals[k] += q['fullRp']

print('\n--- Resumen por cobertura territorial ---')
for k in sorted(cats):
    print(f"  {k:28s}: {cats[k]:4d} filas | ${cat_totals[k]:20,.2f}")


def tot(L):
    t = collections.defaultdict(float)
    for q in L:
        t[q['sec']] += q['fullRp']
    return t


a, b = tot(d), tot(new)
print('\n--- Cambios por secretaría (> $10) ---')
for k in sorted(set(a) | set(b)):
    if abs(b.get(k, 0) - a.get(k, 0)) > 10:
        print(f"  {k}: {a.get(k, 0):,.2f} -> {b.get(k, 0):,.2f}")
print('\nfilas JSON', len(d), '->', len(new), '| total', f"{sum(a.values()):,.2f} -> {sum(b.values()):,.2f}")

shutil.copy(OUT, OUT + '.bak2')
old['data'] = new
json.dump(old, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('escrito', OUT)
