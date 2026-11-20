# MONITOR TERRITORIAL TOLIMA — SISTEMA DE INFORMACIÓN Y MONITOREO
## Paquete Oficial de Entrega Institucional (Inversión Pública y Pobreza Multidimensional)

**Autor y Desarrollador:** Andrés Felipe Murillo Monroy  
**Entidad Receptora:** Gobernación del Tolima — Secretaría de Planeación, Prospectiva y TIC (Dirección de TIC)  
**Fecha de Entrega:** Octubre de 2026  

---

### 1. Descripción del Sistema
El **Monitor Territorial Tolima** es una solución web de inteligencia y analítica territorial georreferenciada desarrollada para el seguimiento en tiempo real y la toma de decisiones del Despacho de la Gobernadora y las distintas dependencias departamentales. 

Consta de dos módulos principales integrados mediante un portal central:
1. **Módulo de Inversión Pública Departamental (`inversion/`):** Seguimiento y agregación geográfica de la ejecución presupuestal (RP, OP, fuentes de financiación: propios, SGR, SGP, crédito, cofinanciación) sobre los 47 municipios del Tolima.
2. **Módulo de Pobreza Multidimensional (`pobreza/`):** Caracterización socioeconómica, índices de pobreza (IPM) y enfoque poblacional territorial.

---

### 2. Estructura del Paquete Entregado

```text
monitor_tolima_entrega_oficial/
│
├── index.html                           # Portal principal de acceso y navegación
├── style.css                            # Estilos globales y diseño del portal
├── geo.js                               # Capa cartográfica vectorial del Tolima (Leaflet)
├── AUTHORS.md                           # Ficha oficial de autoría y créditos
├── ACTA_DERECHOS_DE_AUTOR_MONITOR...md  # Acta de derechos de autor y régimen de propiedad
├── LEAME_ENTREGA_MONITOR_TOLIMA.md      # Este documento técnico
│
├── inversion/                           # MÓDULO DE INVERSIÓN PÚBLICA
│   ├── index.html                       # Interfaz interactiva del monitor de inversión
│   ├── script.js                        # Lógica analítica, filtros y motor cartográfico
│   ├── geo.js                           # Cartografía vectorial municipal
│   ├── datos_2026.json                  # Base consolidada 2026 (vigente, 2.865 registros)
│   ├── datos_2025.json                  # Base histórica consolidada 2025
│   ├── csv_a_json_2026.py               # Script automatizado para ingesta y actualización
│   ├── Inversion_2026_Limpio.xlsx       # Matriz Excel oficial saneada (900 KB)
│   └── 2026 - Inversion por Munic...csv # Exportación CSV oficial del corte vigente
│
└── pobreza/                             # MÓDULO DE POBREZA MULTIDIMENSIONAL
    ├── index.html                       # Interfaz interactiva del monitor de pobreza
    ├── script.js                        # Lógica analítica y cálculo de indicadores IPM
    ├── geo.js                           # Cartografía vectorial municipal
    ├── datos_2026-1.json                # Indicadores y variables socioeconómicas (Parte 1)
    └── datos_2026-2.json                # Indicadores y variables socioeconómicas (Parte 2)
```

---

### 3. Instrucciones de Despliegue en Servidores de la Gobernación (Recomendado)

El sistema fue diseñado como una aplicación web estática de alto rendimiento en **HTML5, CSS3 y JavaScript nativo (ES6+) con Leaflet.js**. No requiere servidores Node.js, compiladores ni bases de datos activas en el hosting.

1. **Servidor Web (IIS, Nginx o Apache):**
   * Copiar todo el contenido de este paquete en la carpeta raíz del sitio web o en un directorio virtual (ejemplo: `C:\inetpub\wwwroot\monitor\` o `/var/www/html/monitor/`).
   * Configurar el dominio o subdominio institucional deseado (ejemplo: `monitor.tolima.gov.co`).
2. **Tipos MIME en IIS (Si aplica):**
   * Asegurar que el servidor tenga habilitado el MIME type para archivos `.json` (`application/json`).
3. **Acceso:**
   * La aplicación cargará de manera inmediata y fluida en cualquier navegador moderno.

---

### 4. Actualización de Datos (Módulo de Inversión)

Para actualizar la información cuando las dependencias reporten un nuevo corte:

1. **A partir del CSV:**
   * Colocar el archivo CSV en la carpeta `inversion/`.
   * Ejecutar en terminal:
     ```bash
     python3 csv_a_json_2026.py
     ```
   * El script valida automáticamente los nombres de los municipios, normaliza acentos, estandariza dependencias y recalcula las inversiones de cobertura departamental (split 47), actualizando `datos_2026.json`.

2. **Recomendación sobre el archivo Excel:**
   * Utilizar la versión saneada `Inversion_2026_Limpio.xlsx`.
   * **Importante:** Evitar arrastrar fórmulas o bordes hasta el final de la hoja en Excel, ya que esto genera millones de celdas vacías (fila 1.048.576) que inflan el archivo a cientos de megabytes y lo hacen inoperable.
   * Se recomienda migrar la captura de datos hacia la plataforma **Ejecutor Tolima** para garantizar integridad en origen.

---

### 5. Derechos de Autor y Propiedad Intelectual

De acuerdo con la Ley 23 de 1982, Ley 1450 de 2011 y la Decisión Andina 351 de 1993:
* **Derechos Morales:** Pertenecen de forma perpetua, inalienable e imprescriptible al autor **Andrés Felipe Murillo Monroy**. Las firmas de código y los créditos en pantalla deben conservarse intactos en cualquier despliegue institucional.
* **Derechos Patrimoniales / Uso Institucional:** Cedidos a la **Gobernación del Tolima — Secretaría de Planeación, Prospectiva y TIC** para sus fines misionales.
