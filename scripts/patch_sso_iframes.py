import sys

# 1. Patch Oriana
with open('apps/admin-portal/public/oriana/js/app.js', 'r', encoding='utf-8') as f:
    oriana_js = f.read()

# Reemplazar asignacion de cUser en completarSesion
old_cuser = "cUser = { u: document.getElementById('login-user').value.trim(), id: areaOId, n: r.nombre, r: r.rol, t: r.turno };"
new_cuser = "const loginEl = document.getElementById('login-user');\n    const uVal = r.usuario || (loginEl && loginEl.value ? loginEl.value.trim() : '') || 'usuario';\n    cUser = { u: uVal, id: areaOId, n: r.nombre, r: r.rol, t: r.turno };"

if old_cuser in oriana_js:
    oriana_js = oriana_js.replace(old_cuser, new_cuser)
    print("Oriana cUser patched.")
else:
    print("Warning: old_cuser not found in Oriana.")

# Inyectar chequeo SSO en DOMContentLoaded de Oriana
sso_injection_marker = "gSuperRules = accessConfig.superRules;\n    } catch (e) {"
sso_code = """gSuperRules = accessConfig.superRules;
      
      // Nexus Single Sign-On (SSO) Automático
      try {
        const ssoRes = await fetch('/api/auth/me');
        const ssoData = await ssoRes.json();
        if (ssoData && ssoData.authenticated && ssoData.user) {
          console.log('[Oriana] Nexus SSO Sesión activa detectada:', ssoData.user.email);
          const areaId = ssoData.user.isAdmin ? 'ADMIN' : (ssoData.user.areas?.[0] || 'GENERAL');
          completarSesion({
            usuario: ssoData.user.username,
            nombre: ssoData.user.name,
            rol: ssoData.user.role || 'Admin',
            turno: ssoData.user.turno || 'General'
          }, areaId);
        }
      } catch (ssoErr) {
        console.warn('[Oriana] Verificación SSO silenciosa:', ssoErr);
      }
    } catch (e) {"""

if sso_injection_marker in oriana_js:
    oriana_js = oriana_js.replace(sso_injection_marker, sso_code)
    print("Oriana SSO check injected.")
else:
    print("Warning: sso_injection_marker not found in Oriana.")

with open('apps/admin-portal/public/oriana/js/app.js', 'w', encoding='utf-8') as f:
    f.write(oriana_js)

# 2. Patch Briana
with open('apps/admin-portal/public/briana/index.html', 'r', encoding='utf-8') as f:
    briana_html = f.read()

old_verificar = """function verificarSesion() {
    const savedUser = localStorage.getItem('usuario_briana');
    const savedRol = localStorage.getItem('rol_briana');
    const savedExt = localStorage.getItem('extension_briana');

    if (savedUser && savedRol) {"""

new_verificar = """async function verificarSesion() {
    // Nexus Single Sign-On (SSO) Automático
    try {
      const ssoRes = await fetch('/api/auth/me');
      const ssoData = await ssoRes.json();
      if (ssoData && ssoData.authenticated && ssoData.user) {
        console.log('[Briana] Nexus SSO Sesión activa detectada:', ssoData.user.email);
        ROL = ssoData.user.isAdmin ? "admin" : (ssoData.user.role?.toLowerCase() === "analista" ? "analista" : "operador");
        USUARIO_ACTUAL = ssoData.user.username || ssoData.user.name;
        const ext = ssoData.user.extension || "11001";

        localStorage.setItem('rol_briana', ROL);
        localStorage.setItem('usuario_briana', USUARIO_ACTUAL);
        localStorage.setItem('extension_briana', ext);
        localStorage.setItem('permiso_reporte_briana', "S");

        document.getElementById('login-page').style.display = "none";
        document.getElementById('home-page').style.display = "block";

        iniciarEscuchaRefresco();

        if (ROL === "admin" || ROL.toLowerCase() === "analista") {
          document.getElementById('sidebar-admin').style.display = "flex";
          document.getElementById('vista-admin').style.display = "block";
          document.getElementById('label-rol-admin').innerText = (ROL.toLowerCase() === "analista" ? "ANALISTA: " : "ADMIN: ") + USUARIO_ACTUAL;

          if (ROL.toLowerCase() === "analista") {
            document.getElementById('btn-nav-usuarios').style.display = "none";
          } else {
            document.getElementById('btn-nav-usuarios').style.display = "flex";
          }

          mostrarSeccion('campanas-salientes');
        } else {
          document.getElementById('sidebar-operador').style.display = "flex";
          document.getElementById('vista-operador').style.display = "block";
          document.getElementById('label-rol-operador').innerText = "OPERADOR: " + USUARIO_ACTUAL;
          const labelExt = document.getElementById('label-extension-operador');
          if (labelExt) {
            labelExt.innerText = "Extensión: " + ext;
          }
          mostrarSeccionOperador('marcacion');
        }
        return;
      }
    } catch (ssoErr) {
      console.warn('[Briana] Verificación SSO silenciosa:', ssoErr);
    }

    const savedUser = localStorage.getItem('usuario_briana');
    const savedRol = localStorage.getItem('rol_briana');
    const savedExt = localStorage.getItem('extension_briana');

    if (savedUser && savedRol) {"""

if old_verificar in briana_html:
    briana_html = briana_html.replace(old_verificar, new_verificar)
    print("Briana verificarSesion SSO patched.")
else:
    print("Warning: old_verificar not found in Briana.")

with open('apps/admin-portal/public/briana/index.html', 'w', encoding='utf-8') as f:
    f.write(briana_html)

# 3. Patch Asys
with open('apps/admin-portal/public/asys/index.html', 'r', encoding='utf-8') as f:
    asys_html = f.read()

old_asys_startup = """    // Arranque de la App
    (function() { 
        let u = sessionStorage.getItem("currentUser"); 
        if (u) {
            currentUser = JSON.parse(u);
            masterQRId = currentUser.masterQRId || "QR-MAESTRO-ASISTENCIA-V1";
            routeByRole(currentUser);
        } else {
            loadLoginPage();
        }
    })();"""

new_asys_startup = """    // Arranque de la App con Nexus SSO
    (async function() { 
        try {
            const ssoRes = await fetch('/api/auth/me');
            const ssoData = await ssoRes.json();
            if (ssoData && ssoData.authenticated && ssoData.user) {
                console.log('[ASYS] Nexus SSO Sesión activa detectada:', ssoData.user.email);
                currentUser = {
                    userId: ssoData.user.id,
                    name: ssoData.user.name,
                    role: ssoData.user.role || (ssoData.user.isAdmin ? 'Admin' : 'Operador'),
                    subRol: ssoData.user.subRol || (ssoData.user.isAdmin ? 'superadmin' : 'Operador/a'),
                    foto: '',
                    areas: ssoData.user.areas || [],
                    masterQRId: "QR-MAESTRO-ASISTENCIA-V1"
                };
                sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
                masterQRId = currentUser.masterQRId;
                routeByRole(currentUser);
                return;
            }
        } catch (ssoErr) {
            console.warn('[ASYS] Verificación SSO silenciosa:', ssoErr);
        }

        let u = sessionStorage.getItem("currentUser"); 
        if (u) {
            currentUser = JSON.parse(u);
            masterQRId = currentUser.masterQRId || "QR-MAESTRO-ASISTENCIA-V1";
            routeByRole(currentUser);
        } else {
            loadLoginPage();
        }
    })();"""

if old_asys_startup in asys_html:
    asys_html = asys_html.replace(old_asys_startup, new_asys_startup)
    print("Asys startup SSO patched.")
else:
    print("Warning: old_asys_startup not found in Asys.")

with open('apps/admin-portal/public/asys/index.html', 'w', encoding='utf-8') as f:
    f.write(asys_html)

print("All patches completed successfully!")
