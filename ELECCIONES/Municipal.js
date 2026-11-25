/**
 * Municipal.gs - Módulo de Monitoreo de Responsables y Movilización Municipal
 * ACTUALIZADO: 10 franjas horarias (h9, h10, h11, h12, h13, h14, h15, h16, h17, h20)
 *
 * Estructura DATA_MUNICIPAL:
 *   A(0)=Estado  B(1)=Municipio  C(2)=Cédula  D(3)=Nombre  E(4)=Teléfono
 *   F(5)=cActivos  G(6)=h9  H(7)=h10 I(8)=h11  J(9)=h12  K(10)=h13  L(11)=h14
 *   M(12)=h15  N(13)=h16  O(14)=h17  P(15)=h20
 */

function obtenerDataMonitoreoMunicipal(estadoUsuario, rol) {
  try {
    const hoja = SS.getSheetByName(SHEET_MUNICIPAL);
    if (!hoja) throw new Error("La hoja DATA_MUNICIPAL no existe.");

    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return [];

    const cuerpoData = datos.slice(1);
    const esNacional = (rol === "Admin" || rol === "Analista" || rol === "Operador Auxiliar");

    const dataFiltrada = cuerpoData.filter(f =>
      esNacional ? true : (f[0] && f[0].toString().toUpperCase().trim() === (estadoUsuario || "").toString().toUpperCase().trim())
    );

    return {
      puedeEditar: esNacional,
      registros: dataFiltrada.map(f => ({
        estado:    f[0] ? f[0].toString() : "",
        municipio: f[1] ? f[1].toString() : "",
        cedula:    f[2] ? f[2].toString() : "N/A",
        nombre:    f[3] ? f[3].toString() : "No asignado",
        telefono:  f[4] ? f[4].toString() : "N/A",
        cActivos:  Number(f[5]) || 0,
        // 10 franjas horarias
        h9:  Number(f[6])  || 0,
        h10: Number(f[7])  || 0,
        h11: Number(f[8])  || 0,
        h12: Number(f[9])  || 0,
        h13: Number(f[10]) || 0,
        h14: Number(f[11]) || 0,
        h15: Number(f[12]) || 0,
        h16: Number(f[13]) || 0,
        h17: Number(f[14]) || 0,
        h20: Number(f[15]) || 0
      }))
    };
  } catch (e) {
    console.error("Error obtenerDataMonitoreoMunicipal: " + e.message);
    return { puedeEditar: false, registros: [] };
  }
}

function guardarMonitoreoMunicipal(filasModificadas, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");

  if (user.rol !== "Admin" && user.rol !== "Analista" && user.rol !== "Operador Auxiliar") {
    throw new Error("No tienes los privilegios necesarios ⛔");
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const hoja     = SS.getSheetByName(SHEET_MUNICIPAL);
    const registros = hoja.getDataRange().getValues();

    filasModificadas.forEach(datos => {
      const idx = registros.findIndex(r =>
        r[0].toString().toUpperCase() === datos.estado.toUpperCase() &&
        r[1].toString().toUpperCase() === datos.municipio.toUpperCase()
      );
      if (idx !== -1) {
        // Escribe: cActivos + 10 horas = 11 valores desde col F(6)
        hoja.getRange(idx + 1, 6, 1, 11).setValues([[
          Number(datos.cActivos) || 0,
          Number(datos.h9)  || 0, Number(datos.h10) || 0, Number(datos.h11) || 0,
          Number(datos.h12) || 0, Number(datos.h13) || 0,
          Number(datos.h14) || 0, Number(datos.h15) || 0,
          Number(datos.h16) || 0, Number(datos.h17) || 0,
          Number(datos.h20) || 0
        ]]);
      }
    });

    registrarAccionAuditoria(user, "ACTUALIZACIÓN MUNICIPAL", `Actualizados ${filasModificadas.length} responsables.`);
    SpreadsheetApp.flush();
    return { success: true };
  } finally { lock.releaseLock(); }
}

/**
 * Exporta la matriz completa de DATA_MUNICIPAL como array 2D (para XLSX en frontend)
 */
function obtenerMatrizMunicipal(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔒");

  const hojaUser = SS.getSheetByName(SHEET_USUARIOS);
  const users    = hojaUser.getDataRange().getValues();
  const sessionUser = users.find(u => u[6].toString() === token || u[8].toString() === token);

  if (!sessionUser || (sessionUser[3] !== "Admin" && sessionUser[3] !== "Analista" && sessionUser[3] !== "Operador Auxiliar")) {
    throw new Error("Su rol no tiene permisos para exportar este directorio.");
  }

  const hoja  = SS.getSheetByName(SHEET_MUNICIPAL);
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) throw new Error("No hay datos en el Directorio Municipal.");

  // Reemplazamos la primera fila (encabezado) con los títulos correctos de 10 franjas
  const matrizConHeader = [
    ["ESTADO","MUNICIPIO","CÉDULA","NOMBRE","TELÉFONO","CENTROS ACTIVOS",
     "9:00 AM","10:00 AM","11:00 AM","12:00 M","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6-8:00 PM"]
  ];

  for (let i = 1; i < datos.length; i++) {
    const f = datos[i];
    const totalVotos = [6,7,8,9,10,11,12,13,14,15].reduce((s, j) => s + (Number(f[j])||0), 0);
    matrizConHeader.push([
      f[0], f[1], f[2], f[3], f[4],
      Number(f[5])||0,
      Number(f[6])||0, Number(f[7])||0, Number(f[8])||0, Number(f[9])||0,
      Number(f[10])||0, Number(f[11])||0, Number(f[12])||0, Number(f[13])||0, Number(f[14])||0, Number(f[15])||0
    ]);
  }

  registrarAccionAuditoria({usuario: sessionUser[1], rol: sessionUser[3]}, "EXPORTAR MUNICIPAL EXCEL", "Descarga de directorio completo.");
  return matrizConHeader;
}

/**
 * Genera CSV de Municipal (compatibilidad)
 */
function generarCSVMunicipal(token) {
  const matriz = obtenerMatrizMunicipal(token);
  return matriz.map(fila =>
    fila.map(celda => {
      let texto = celda ? celda.toString().replace(/"/g, '""').replace(/\n/g, ' ') : "";
      return `"${texto}"`;
    }).join(",")
  ).join("\n");
}