import sys

# ==========================================
# 1. ACTUALIZAR ORIANA (app.js)
# ==========================================
with open('apps/admin-portal/public/oriana/js/app.js', 'r', encoding='utf-8') as f:
    oriana_js = f.read()

# Función para mostrar la tarjeta de ingreso interactiva
oriana_helper = """
// ─── GATE DE IDENTIDAD NEXUS SSO ───
window.mostrarTarjetaIngresoOriana = function(userData) {
  window._ssoUserTemp = userData;
  const card = document.querySelector('.login-card');
  if (!card) return;
  
  const initials = (userData.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  card.innerHTML = `
    <div class="login-logo" style="margin-bottom:4px; font-size:24px; font-weight:900; letter-spacing:1px; color:#3b82f6;">ORIANA</div>
    <p class="login-subtitle" style="margin-bottom:20px; font-size:12px; color:#94a3b8;">Command Center · Intranet Nexus</p>
    
    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; padding: 22px; text-align: center; margin-bottom: 22px; backdrop-blur: 10px;">
      <div style="width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; margin: 0 auto 12px auto; box-shadow: 0 4px 18px rgba(37,99,235,0.45); border: 2px solid rgba(255,255,255,0.15);">
        ${initials}
      </div>
      <div style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 12px; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 600; margin-bottom: 10px;">
        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
        Sesión Nexus Conectada
      </div>
      <h3 style="color: #ffffff; font-size: 19px; font-weight: 800; margin: 0 0 5px 0;">${userData.name}</h3>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">${userData.role || 'Operador'} · <span style="color:#60a5fa;">${userData.email}</span></p>
    </div>

    <button class="btn btn-primary btn-lg" onclick="window.confirmarIngresoOriana()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; font-weight: 700; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 4px 14px rgba(37,99,235,0.35); cursor: pointer; transition: transform 0.2s;">
      <span>Ingresar a Oriana</span>
      <span class="material-symbols-outlined" style="font-size: 20px;">arrow_forward</span>
    </button>
  `;
};

window.confirmarIngresoOriana = function() {
  if (!window._ssoUserTemp) return;
  const u = window._ssoUserTemp;
  const areaId = u.isAdmin ? 'ADMIN' : (u.areas?.[0] || 'GENERAL');
  completarSesion({
    usuario: u.username,
    nombre: u.name,
    rol: u.role || 'Admin',
    turno: u.turno || 'General'
  }, areaId);
};
"""

if "window.mostrarTarjetaIngresoOriana" not in oriana_js:
    oriana_js = oriana_helper + "\n" + oriana_js
    print("Oriana helper added.")

# Actualizar el bloque SSO en DOMContentLoaded
old_oriana_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
          console.log('[Oriana] Nexus SSO Sesión activa detectada:', ssoData.user.email);
          const areaId = ssoData.user.isAdmin ? 'ADMIN' : (ssoData.user.areas?.[0] || 'GENERAL');
          completarSesion({
            usuario: ssoData.user.username,
            nombre: ssoData.user.name,
            rol: ssoData.user.role || 'Admin',
            turno: ssoData.user.turno || 'General'
          }, areaId);
        }"""

new_oriana_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
          console.log('[Oriana] Nexus SSO Sesión activa detectada:', ssoData.user.email);
          window.mostrarTarjetaIngresoOriana(ssoData.user);
        }"""

if old_oriana_sso in oriana_js:
    oriana_js = oriana_js.replace(old_oriana_sso, new_oriana_sso)
    print("Oriana SSO check updated to display gate.")
else:
    print("Warning: old_oriana_sso not found.")

with open('apps/admin-portal/public/oriana/js/app.js', 'w', encoding='utf-8') as f:
    f.write(oriana_js)

# ==========================================
# 2. ACTUALIZAR BRIANA (index.html)
# ==========================================
with open('apps/admin-portal/public/briana/index.html', 'r', encoding='utf-8') as f:
    briana_html = f.read()

briana_gate_js = """
  window.mostrarTarjetaIngresoBriana = function(userData) {
    window._ssoUserBriana = userData;
    const card = document.querySelector('.login-card');
    if (!card) return;
    const initials = (userData.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    
    card.innerHTML = `
      <div style="text-align: center; margin-bottom: 18px;">
        <h2 style="font-size: 24px; font-weight: 900; color: #0284c7; margin: 0; letter-spacing: 0.5px;">BRIANA</h2>
        <p style="color: #64748b; font-size: 12px; margin: 0;">Telefonía Celular & Contact Center</p>
      </div>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 22px; text-align: center; margin-bottom: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #0ea5e9); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(2,132,199,0.35);">
          ${initials}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 12px; border-radius: 9999px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; font-size: 11px; font-weight: 600; margin-bottom: 10px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
          Sesión Nexus Conectada
        </div>
        <h4 style="color: #0f172a; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">${userData.name}</h4>
        <p style="color: #64748b; font-size: 12px; margin: 0;">${userData.role || 'Operador'} · Extensión: <strong style="color:#0284c7;">${userData.extension || '11001'}</strong></p>
      </div>

      <button class="btn btn-modern-blue w-100" onclick="window.confirmarIngresoBriana()" style="padding: 14px; font-weight: 800; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; box-shadow: 0 4px 14px rgba(2,132,199,0.3);">
        <span>Ingresar a Briana</span>
        <span>→</span>
      </button>
    `;
  };

  window.confirmarIngresoBriana = function() {
    if (!window._ssoUserBriana) return;
    const ssoData = { user: window._ssoUserBriana };
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
  };
"""

if "window.mostrarTarjetaIngresoBriana" not in briana_html:
    briana_html = briana_html.replace("<script>", "<script>\n" + briana_gate_js, 1)
    print("Briana helper injected.")

old_briana_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
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
      }"""

new_briana_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
        console.log('[Briana] Nexus SSO Sesión activa detectada:', ssoData.user.email);
        window.mostrarTarjetaIngresoBriana(ssoData.user);
        return;
      }"""

if old_briana_sso in briana_html:
    briana_html = briana_html.replace(old_briana_sso, new_briana_sso)
    print("Briana SSO check updated to display gate.")
else:
    print("Warning: old_briana_sso not found.")

with open('apps/admin-portal/public/briana/index.html', 'w', encoding='utf-8') as f:
    f.write(briana_html)

# ==========================================
# 3. ACTUALIZAR ASYS (index.html)
# ==========================================
with open('apps/admin-portal/public/asys/index.html', 'r', encoding='utf-8') as f:
    asys_html = f.read()

asys_gate_js = """
    window.mostrarTarjetaIngresoAsys = function(userData) {
        window._ssoUserAsys = userData;
        loadLoginPage();
        setTimeout(function() {
            const container = document.querySelector('.p-5');
            if (!container) return;
            const initials = (userData.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            
            container.innerHTML = `
                <div class="text-center mb-4">
                    <div style="width: 58px; height: 58px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #059669); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(16,185,129,0.35);">
                        ${initials}
                    </div>
                    <div style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 12px; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 600; margin-bottom: 10px;">
                        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
                        Sesión Nexus Conectada
                    </div>
                    <h1 class="h4 text-gray-900 mb-1" style="font-weight: 800;">${userData.name}</h1>
                    <p class="text-muted" style="font-size: 13px; margin: 0;">Panel de ${userData.subRol || userData.role || 'Personal'} · <span style="color:#059669;">${userData.email}</span></p>
                </div>

                <button class="btn btn-primary btn-user btn-block" onclick="window.confirmarIngresoAsys()" style="padding: 14px; font-weight: 800; font-size: 14px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 4px 14px rgba(37,99,235,0.3); cursor: pointer;">
                    Ingresar al Módulo de Asistencia →
                </button>
            `;
        }, 80);
    };

    window.confirmarIngresoAsys = function() {
        if (!window._ssoUserAsys) return;
        const u = window._ssoUserAsys;
        currentUser = {
            userId: u.id,
            name: u.name,
            role: u.role || (u.isAdmin ? 'Admin' : 'Operador'),
            subRol: u.subRol || (u.isAdmin ? 'superadmin' : 'Operador/a'),
            foto: '',
            areas: u.areas || [],
            masterQRId: "QR-MAESTRO-ASISTENCIA-V1"
        };
        sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
        masterQRId = currentUser.masterQRId;
        routeByRole(currentUser);
    };
"""

if "window.mostrarTarjetaIngresoAsys" not in asys_html:
    asys_html = asys_html.replace("<script>", "<script>\n" + asys_gate_js, 1)
    print("Asys helper injected.")

old_asys_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
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
            }"""

new_asys_sso = """if (ssoData && ssoData.authenticated && ssoData.user) {
                console.log('[ASYS] Nexus SSO Sesión activa detectada:', ssoData.user.email);
                window.mostrarTarjetaIngresoAsys(ssoData.user);
                return;
            }"""

if old_asys_sso in asys_html:
    asys_html = asys_html.replace(old_asys_sso, new_asys_sso)
    print("Asys SSO check updated to display gate.")
else:
    print("Warning: old_asys_sso not found.")

with open('apps/admin-portal/public/asys/index.html', 'w', encoding='utf-8') as f:
    f.write(asys_html)

print("All interactive gate updates applied successfully!")
