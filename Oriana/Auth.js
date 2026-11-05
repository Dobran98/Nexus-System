/**
 * ======================================================================
 * ORIANA — SISTEMA DE GESTIÓN
 * Backend: Autenticación y Seguridad (Auth.js)
 * ======================================================================
 */

// ─── SEGURIDAD: HASH DE CONTRASEÑAS ──────────────────────────────────────────

/** Genera un hash SHA-256 de un texto. */
function hashSHA256(texto) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(texto),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('');
}

/**
 * Convierte todas las contraseñas en texto plano de la hoja Usuarios a hashes SHA-256.
 */
function hashearContrasenas() {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_USUARIOS);
  if (!hoja) { Logger.log("❌ No se encontró la hoja Usuarios."); return; }

  const data = hoja.getDataRange().getValues();
  let migradas = 0;

  // Asegurar que existe columna G como backup
  if (!data[0][6]) {
    hoja.getRange(1, 7).setValue("Backup_Clave_Original");
  }

  for (let i = 1; i < data.length; i++) {
    const claveActual = String(data[i][1]).trim();
    if (!claveActual || claveActual.length === 64) {
      continue;
    }

    // Backup en columna G
    hoja.getRange(i + 1, 7).setValue(claveActual);
    // Hash en columna B
    hoja.getRange(i + 1, 2).setValue(hashSHA256(claveActual));
    migradas++;
  }

  Logger.log(`✅ Migración completada: ${migradas} contraseñas hasheadas.`);
}

// ─── AUTENTICACIÓN ────────────────────────────────────────────────────────────

function validarUsuario(u, c) {
  try {
    const ss   = getSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRE_HOJA_USUARIOS);
    if (!hoja) return { success: false, message: "Error: No existe hoja Usuarios" };

    const datos = hoja.getDataRange().getValues();
    const uIn   = String(u).trim().toLowerCase();
    const cIn   = String(c).trim();
    const cInHash = hashSHA256(cIn);

    for (let i = 1; i < datos.length; i++) {
      const uRow = String(datos[i][0]).trim().toLowerCase();
      if (uRow !== uIn) continue;

      const claveAlmacenada = String(datos[i][1]).trim();
      const coincide = (claveAlmacenada === cInHash) || (claveAlmacenada === cIn);
      if (!coincide) continue;

      const rawTurno  = datos[i][4];
      const finalTurno = (rawTurno !== undefined && String(rawTurno).trim() !== "")
        ? String(rawTurno).trim().toUpperCase()
        : "MAÑANA";

      return {
        success: true,
        nombre:  datos[i][2] || u,
        rol:     String(datos[i][3] || "Operador").trim(),
        turno:   finalTurno,
        idFisico: String(datos[i][5] || "").trim()
      };
    }

    return { success: false, message: "Credenciales incorrectas." };
  } catch (e) {
    return { success: false, message: "Error: " + e };
  }
}
