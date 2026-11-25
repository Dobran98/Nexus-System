with open('apps/admin-portal/public/asys/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Reemplazo del bloque de arranque SSO
target_sso = """    // Arranque de la App con Nexus SSO
    (async function() { 
        try {
            const ssoRes = await fetch('/api/auth/me');
            const ssoData = await ssoRes.json();
            if (ssoData && ssoData.authenticated && ssoData.user) {
                console.log('[ASYS] Nexus SSO Sesión activa detectada:', ssoData.user.email);
                window.mostrarTarjetaIngresoAsys(ssoData.user);
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

replacement_sso = """    // Arranque de la App con Nexus SSO - Forzado Atómico
    (async function() { 
        try {
            const ssoRes = await fetch('/api/auth/me?t=' + Date.now());
            const ssoData = await ssoRes.json();
            if (ssoData && ssoData.authenticated && ssoData.user) {
                const u = ssoData.user;
                console.log('[ASYS] Nexus SSO - Autenticando usuario activo:', u.email, u.role, u.subRol);
                
                // Limpiar cualquier residuo de usuario previo
                sessionStorage.clear();
                
                currentUser = {
                    userId: u.userId || u.id,
                    name: u.name,
                    role: u.role || (u.isAdmin ? 'Admin' : 'Operador'),
                    subRol: u.subRol || (u.isAdmin ? 'superadmin' : 'Operador/a'),
                    foto: '',
                    areas: u.areas || [],
                    email: u.email,
                    masterQRId: "QR-MAESTRO-ASISTENCIA-V1"
                };
                sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
                masterQRId = currentUser.masterQRId;
                
                // Enrutamiento directo e instantáneo al panel del rol activo
                routeByRole(currentUser);
                return;
            } else {
                console.warn('[ASYS] No hay sesión activa en Nexus. Limpiando almacenamiento.');
                sessionStorage.clear();
                loadLoginPage();
                return;
            }
        } catch (ssoErr) {
            console.warn('[ASYS] Error verificando SSO:', ssoErr);
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

# 2. Modificar logout en Asys
target_logout = """    function logout() { 
        stopScanner(); 
        currentUser = null; 
        sessionStorage.removeItem("currentUser");
        const tables =['adminAttendanceTable', 'userAttendanceTable', 'usersTable', 'dutiesTable', 'hoursReportTable', 'detailedReportTable', 'adminPermissionsTable', 'userPermissionsTable', 'substitutionsTable', 'crossTable'];
        tables.forEach(function(id) { 
            if ($.fn.DataTable.isDataTable('#' + id)) {
                $('#' + id).DataTable().destroy(); 
            }
        }); 
        loadLoginPage(); 
    }"""

replacement_logout = """    function logout() { 
        stopScanner(); 
        currentUser = null; 
        sessionStorage.clear();
        try { localStorage.removeItem('currentUser'); } catch(e){}
        const tables =['adminAttendanceTable', 'userAttendanceTable', 'usersTable', 'dutiesTable', 'hoursReportTable', 'detailedReportTable', 'adminPermissionsTable', 'userPermissionsTable', 'substitutionsTable', 'crossTable'];
        tables.forEach(function(id) { 
            if ($.fn.DataTable.isDataTable('#' + id)) {
                $('#' + id).DataTable().destroy(); 
            }
        }); 
        // Redirigir la ventana superior al logout oficial de Nexus
        if (window.top && window.top !== window) {
            window.top.location.href = '/api/auth/signout';
        } else {
            window.location.href = '/api/auth/signout';
        }
    }"""

if target_sso in content:
    content = content.replace(target_sso, replacement_sso)
    print("SSO reemplazado exitosamente en Asys.")
else:
    print("AVISO: No se encontro target_sso exacto.")

if target_logout in content:
    content = content.replace(target_logout, replacement_logout)
    print("Logout reemplazado exitosamente en Asys.")
else:
    print("AVISO: No se encontro target_logout exacto.")

with open('apps/admin-portal/public/asys/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Asys index.html actualizado.")
