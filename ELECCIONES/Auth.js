/**
 * Auth.gs - Gestión de Identidad, Sesiones Concurrentes y Auditoría
 * VERSIÓN 2.0 — Seguridad mejorada: SHA-256 hashing + CacheService
 */

// ============================================================
// HELPER: Hash SHA-256 de contraseña
// ============================================================
function hashPassword(plain) {
  if (!plain) return "";
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plain.toString(),
    Utilities.Charset.UTF_8
  );
  return digest.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}

// ============================================================
// MIGRACIÓN ÚNICA: Convierte todas las contraseñas a hash
// Llamar UNA SOLA VEZ desde el panel Admin o manualmente
// ============================================================
function migrarContrasenasTHash() {
  const hoja = SS.getSheetByName(SHEET_USUARIOS);
  const datos = hoja.getDataRange().getValues();
  let migradas = 0;

  for (let i = 1; i < datos.length; i++) {
    const pass = datos[i][5] ? datos[i][5].toString().trim() : "";
    if (!pass) continue;
    // Si ya tiene 64 caracteres hexadecimales, ya está hasheada
    if (/^[a-f0-9]{64}$/.test(pass)) continue;
    const hashVal = hashPassword(pass);
    hoja.getRange(i + 1, 6).setValue(hashVal);
    migradas++;
  }
  SpreadsheetApp.flush();
  registrarAccionAuditoria({ usuario: "SISTEMA", rol: "Admin" }, "MIGRACIÓN SEGURIDAD", `${migradas} contraseñas migradas a SHA-256`);
  return { success: true, migradas };
}

// ============================================================
// INICIO DE SESIÓN con soporte hash + compatibilidad legacy
// ============================================================
function iniciarSesion(usuarioNombre, password) {
  const hoja = SS.getSheetByName(SHEET_USUARIOS);
  const datos = hoja.getDataRange().getValues();
  const ahora = new Date();

  const hashInput = hashPassword(password);

  for (let i = 1; i < datos.length; i++) {
    const userBD     = datos[i][1] ? datos[i][1].toString().trim() : "";
    const passBD     = datos[i][5] ? datos[i][5].toString().trim() : "";
    const usuarioOK  = userBD === usuarioNombre;
    if (!usuarioOK) continue;

    // Comparar: primero hash SHA-256, luego texto plano (período de migración)
    const passOK = (passBD === hashInput) || (passBD === password.toString().trim());
    if (!passOK) continue;

    let columnaToken = -1;
    let columnaTime  = -1;

    // Verificamos espacio o caducidad en Sesión 1 (G=col7, H=col8)
    const diff1 = (ahora - new Date(datos[i][7])) / 60000;
    if (!datos[i][6] || datos[i][6] === "" || diff1 > 10) {
      columnaToken = 7;
      columnaTime  = 8;
    } else {
      // Verificamos espacio o caducidad en Sesión 2 (I=col9, J=col10)
      const diff2 = (ahora - new Date(datos[i][9])) / 60000;
      if (!datos[i][8] || datos[i][8] === "" || diff2 > 10) {
        columnaToken = 9;
        columnaTime  = 10;
      }
    }

    if (columnaToken !== -1) {
      const token = Utilities.getUuid();

      hoja.getRange(i + 1, columnaToken).setValue(token);
      hoja.getRange(i + 1, columnaTime).setValue(ahora);

      const userData = {
        usuario: datos[i][1],
        rol:     datos[i][3],
        estado:  datos[i][4]
      };

      // Guardar token en CacheService para acceso rápido (10 min = 600s)
      const cache = CacheService.getScriptCache();
      cache.put('session_' + token, JSON.stringify(userData), 600);

      registrarAccionAuditoria(userData, "INICIO DE SESIÓN",
        `Acceso exitoso. Sesión ${columnaToken === 7 ? '1' : '2'}`);

      return { success: true, token, user: userData };

    } else {
      registrarAccionAuditoria(
        { usuario: usuarioNombre, rol: datos[i][3], estado: datos[i][4] },
        "LOGIN FALLIDO", "Límite de 2 sesiones alcanzado"
      );
      throw new Error("Límite de 2 sesiones activas alcanzado para este usuario ❌");
    }
  }

  throw new Error("Usuario o contraseña incorrectos ❌");
}

// ============================================================
// VALIDAR SUPERVISIÓN con hash
// ============================================================
function validarSupervision(userSup, passSup) {
  try {
    const hashInput = hashPassword(passSup);
    const datos     = SS.getSheetByName(SHEET_USUARIOS).getDataRange().getValues();

    const supervisor = datos.find(f => {
      const userOK = f[1] && f[1].toString().trim() === userSup;
      const passOK = f[5] && (
        f[5].toString().trim() === hashInput ||
        f[5].toString().trim() === (passSup || "").toString().trim()
      );
      const rolOK  = f[3] === "Analista" || f[3] === "Admin";
      return userOK && passOK && rolOK;
    });

    if (supervisor) {
      const userData = { usuario: supervisor[1], rol: supervisor[3], estado: supervisor[4] };
      registrarAccionAuditoria(userData, "AUTORIZACIÓN", "Supervisor validó una acción protegida");
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error en validación de supervisión: " + e.message);
    return false;
  }
}

// ============================================================
// CIERRE DE SESIÓN — Limpia token de hoja Y de caché
// ============================================================
function logoutManual(token) {
  if (!token) return;

  // Eliminar del CacheService inmediatamente
  const cache = CacheService.getScriptCache();
  cache.remove('session_' + token);

  const hoja  = SS.getSheetByName(SHEET_USUARIOS);
  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (datos[i][6] && datos[i][6].toString() === token) {
      registrarAccionAuditoria(
        { usuario: datos[i][1], rol: datos[i][3], estado: datos[i][4] },
        "CIERRE SESIÓN", "Salida manual (Sesión 1)"
      );
      hoja.getRange(i + 1, 7).clearContent();
      break;
    }
    if (datos[i][8] && datos[i][8].toString() === token) {
      registrarAccionAuditoria(
        { usuario: datos[i][1], rol: datos[i][3], estado: datos[i][4] },
        "CIERRE SESIÓN", "Salida manual (Sesión 2)"
      );
      hoja.getRange(i + 1, 9).clearContent();
      break;
    }
  }
}