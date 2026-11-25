import json
import os

BRIANA_DIR = 'Llamadas - Briana'
OUTPUT_DIR = 'apps/admin-portal/public/briana'

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Leer archivos
with open(os.path.join(BRIANA_DIR, 'Index.html'), 'r', encoding='utf-8') as f:
    index_html = f.read()

with open(os.path.join(BRIANA_DIR, 'Estilos.html'), 'r', encoding='utf-8') as f:
    estilos = f.read()

with open(os.path.join(BRIANA_DIR, 'DashboardEstilos.html'), 'r', encoding='utf-8') as f:
    dashboard_estilos = f.read()

with open(os.path.join(BRIANA_DIR, 'Formulario.html'), 'r', encoding='utf-8') as f:
    formulario = f.read()

with open(os.path.join(BRIANA_DIR, 'JavaScript.html'), 'r', encoding='utf-8') as f:
    javascript = f.read()

with open(os.path.join(BRIANA_DIR, 'DashboardLogica.html'), 'r', encoding='utf-8') as f:
    dashboard_logica = f.read()

# 2. Puente de emulación de google.script.run para Briana
bridge_code = """
<script>
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = (function() {
    function createRunner(successHandler, failureHandler) {
        return new Proxy({}, {
            get: function(target, prop) {
                if (prop === 'withSuccessHandler') {
                    return function(sh) { return createRunner(sh, failureHandler); };
                }
                if (prop === 'withFailureHandler') {
                    return function(fh) { return createRunner(successHandler, fh); };
                }
                return function(...args) {
                    fetch('/api/briana/' + prop, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(args)
                    })
                    .then(async function(res) {
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error en ' + prop);
                        return data;
                    })
                    .then(function(data) {
                        if (successHandler) successHandler(data);
                    })
                    .catch(function(err) {
                        console.error('Error en google.script.run.' + prop, err);
                        if (failureHandler) failureHandler(err);
                    });
                };
            }
        });
    }
    return createRunner(null, null);
})();

// Reemplazo para getAppUrl
function getAppUrl() { return window.location.href; }
</script>
"""

# Reemplazar includes de Estilos
index_html = index_html.replace("<?!= include('Estilos'); ?>", estilos)
index_html = index_html.replace("<?!= include('DashboardEstilos'); ?>", dashboard_estilos)
index_html = index_html.replace("<?!= include('Formulario'); ?>", formulario)
index_html = index_html.replace('const PREVIEW_FORM_NAME = "<?= previewFormName ?>";', 'const PREVIEW_FORM_NAME = "";')

# Reemplazar fuentes de datos (Estados de Venezuela)
estados_json = json.dumps({
    "Estados": [
        "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar",
        "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón",
        "Guárico", "La Guaira", "Lara", "Mérida", "Miranda", "Monagas",
        "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo",
        "Yaracuy", "Zulia"
    ]
})
reemplazo_fuentes = f'<script>window.FUENTES_DATOS = {estados_json}; window.ESTADOS_DATA = window.FUENTES_DATOS["Estados"] || [];</script>'

# Buscar la línea con obtenerFuentesDatos()
import re
index_html = re.sub(r'<\?!=.*?obtenerFuentesDatos\(.*?\).*?\?>', lambda m: reemplazo_fuentes, index_html)

# Reemplazar JavaScript y DashboardLogica
full_scripts = bridge_code + "\n" + javascript + "\n" + dashboard_logica
index_html = index_html.replace("<?!= include('JavaScript'); ?>", full_scripts)
index_html = index_html.replace("<?!= include('DashboardLogica'); ?>", "")

# Guardar en apps/admin-portal/public/briana/index.html
out_file = os.path.join(OUTPUT_DIR, 'index.html')
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(index_html)

print(f"✓ Briana empaquetado exitosamente en {out_file} (Tamaño: {os.path.getsize(out_file) / 1024:.1f} KB)")
