import json
import os

ASYS_DIR = 'Asys'
OUTPUT_DIR = 'apps/admin-portal/public/asys'

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Leer plantillas de vistas
views = {}
for view_file in ['AdminDashboard.html', 'CoordinadorDashboard.html', 'UserDashboard.html', 'UsersListPage.html', 'LoginPage.html']:
    view_path = os.path.join(ASYS_DIR, view_file)
    if os.path.exists(view_path):
        with open(view_path, 'r', encoding='utf-8') as f:
            views[view_file] = f.read()

# 2. Leer Stylesheet y JavaScript
with open(os.path.join(ASYS_DIR, 'Stylesheet.html'), 'r', encoding='utf-8') as f:
    stylesheet = f.read()

with open(os.path.join(ASYS_DIR, 'JavaScript.html'), 'r', encoding='utf-8') as f:
    javascript = f.read()

# 3. Leer index.html base
with open(os.path.join(ASYS_DIR, 'index.html'), 'r', encoding='utf-8') as f:
    index_html = f.read()

# Puente de emulación de google.script.run
views_json = json.dumps(views)
bridge_code = f"""
<script>
window.__ASYS_VIEWS__ = {views_json};

window.google = window.google || {{}};
window.google.script = window.google.script || {{}};
window.google.script.run = (function() {{
    function createRunner(successHandler, failureHandler) {{
        return new Proxy({{}}, {{
            get: function(target, prop) {{
                if (prop === 'withSuccessHandler') {{
                    return function(sh) {{ return createRunner(sh, failureHandler); }};
                }}
                if (prop === 'withFailureHandler') {{
                    return function(fh) {{ return createRunner(successHandler, fh); }};
                }}
                return function(...args) {{
                    // Interceptar include(nombreVista)
                    if (prop === 'include') {{
                        const viewName = args[0];
                        if (window.__ASYS_VIEWS__ && window.__ASYS_VIEWS__[viewName]) {{
                            if (successHandler) {{
                                setTimeout(function() {{ successHandler(window.__ASYS_VIEWS__[viewName]); }}, 0);
                            }}
                            return;
                        }}
                    }}

                    // Petición al API router de Next.js
                    fetch('/api/asys/' + prop, {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify(args)
                    }})
                    .then(async function(res) {{
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error en ' + prop);
                        return data;
                    }})
                    .then(function(data) {{
                        if (successHandler) successHandler(data);
                    }})
                    .catch(function(err) {{
                        console.error('Error en google.script.run.' + prop, err);
                        if (failureHandler) failureHandler(err);
                    }});
                }};
            }}
        }});
    }}
    return createRunner(null, null);
}})();

// Auto-reconocimiento de sesión de Nexus
window.addEventListener('message', function(event) {{
    if (event.data && event.data.type === 'NEXUS_SET_USER') {{
        window.currentUser = event.data.user;
    }}
}});
</script>
"""

# Reemplazar include('Stylesheet')
if "<?!= include('Stylesheet'); ?>" in index_html:
    index_html = index_html.replace("<?!= include('Stylesheet'); ?>", stylesheet)
elif "include('Stylesheet')" in index_html:
    index_html = index_html.replace("include('Stylesheet')", stylesheet)

# Reemplazar include('JavaScript') con el puente + JavaScript original
full_js_block = bridge_code + "\n" + javascript
if "<?!= include('JavaScript'); ?>" in index_html:
    index_html = index_html.replace("<?!= include('JavaScript'); ?>", full_js_block)
else:
    index_html = index_html.replace("</body>", full_js_block + "\n</body>")

# Guardar en public/asys/index.html
out_file = os.path.join(OUTPUT_DIR, 'index.html')
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(index_html)

print(f"✓ Paquete Asys generado exitosamente en {out_file} (Tamaño: {os.path.getsize(out_file) / 1024:.1f} KB)")
