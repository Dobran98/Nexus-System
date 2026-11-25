/**
 * Incidencias.gs - Centralizado y verificado (Con soporte de Resolución y Exportación)
 */

function registrarIncidencia(inc, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");
  
  // Usamos el estado seleccionado si existe, si no, el del perfil
  const estadoReporte = inc.estado || user.estado;

  if (!inc.bloque || !estadoReporte || !inc.municipio || !inc.categoria) {
    throw new Error("Datos incompletos para el reporte ❌");
  }

  try {
    const hojaInc = SS.getSheetByName(SHEET_INCIDENTES);
    if (!hojaInc) throw new Error("No se encontró la hoja de incidentes.");
    
    // Alineación Extendida Pro:
    // 0:Fecha | 1:Estado | 2:Municipio | 3:Bloque | 4:Categoría | 5:Descripción | 6:Usuario | 7:Rol | 8:Cantidad | 9:Comuna | 10:Estatus | 11:ResueltoPor
    hojaInc.appendRow([
      new Date(), 
      estadoReporte, 
      inc.municipio, 
      inc.bloque, 
      inc.categoria, 
      inc.descripcion || "Sin detalles adicionales", 
      user.usuario,
      user.rol,
      inc.cantidad || 1,          
      inc.comuna || "No aplica",
      "PENDIENTE", // Estatus por defecto
      ""           // Resuelto Por (vacío inicialmente)
    ]);
    
    registrarAccionAuditoria(user, "REPORTE INCIDENCIA", `${inc.cantidad || 1}x ${inc.bloque}: ${inc.categoria} en ${estadoReporte} - ${inc.municipio}`);
    return true; 
  } catch (e) {
    throw new Error("Fallo en base de datos: " + e.message);
  }
}

function marcarIncidenciaResuelta(fechaExacta, user, token) {
  if (!validarSesion(token)) throw new Error("Sesión expirada ⚠️");

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const hojaInc = SS.getSheetByName(SHEET_INCIDENTES);
    const datos = hojaInc.getDataRange().getValues();

    let filaEncontrada = -1;
    // Buscamos la incidencia usando la Fecha Exacta (Columna A) como identificador único
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString() === fechaExacta.toString()) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (filaEncontrada !== -1) {
      hojaInc.getRange(filaEncontrada, 11).setValue("RESUELTA"); // Columna K (Estatus)
      hojaInc.getRange(filaEncontrada, 12).setValue(user.usuario); // Columna L (Resuelto por)
      
      registrarAccionAuditoria(user, "RESOLUCIÓN INCIDENCIA", `Incidencia del ${fechaExacta} marcada como Resuelta`);
      SpreadsheetApp.flush();
      return true;
    } else {
      throw new Error("No se encontró la incidencia en la base de datos para resolverla.");
    }
  } catch(e) {
    throw new Error("Fallo al resolver: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

function obtenerIncidencias(estadoUsuario, rol) {
  try {
    const hoja = SS.getSheetByName(SHEET_INCIDENTES);
    const datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return[];

    const cuerpoData = datos.slice(1);
    
    // ROLES NACIONALES: Tienen acceso a la base de datos completa
    const esGlobal = (rol === "Admin" || rol === "Analista" || rol === "Operador 0800" || rol === "Operador Auxiliar");
    
    // Filtrado: Los operadores/estadales normales solo ven su estado; los globales ven todo
    const dataFiltrada = cuerpoData.filter(f => esGlobal ? true : (f[1] && f[1].toString().toUpperCase().trim() === (estadoUsuario || "").toString().toUpperCase().trim()));
    
    return dataFiltrada.map(f => [
      f[0].toString(), // 0: Fecha (ID)
      f[1],            // 1: Estado
      f[2],            // 2: Municipio
      f[3],            // 3: Bloque
      f[4],            // 4: Categoría
      f[5],            // 5: Descripción
      f[6],            // 6: Usuario
      f[7],            // 7: Rol
      f[8] || 1,       // 8: Cantidad
      f[9] || "",      // 9: Comuna
      f[10] || "PENDIENTE", // 10: Estatus
      f[11] || ""      // 11: Resuelto Por
    ]);
  } catch (e) { 
    console.error("Error obteniendo incidencias: " + e.message);
    return[]; 
  }
}

// Función que envía la matriz pura para que el Frontend arme el CSV o el Excel (xlsx)
function obtenerMatrizIncidenciasExportacion(token) {
  if (!validarSesion(token)) throw new Error("Acceso denegado 🔒");
  
  const hojaUser = SS.getSheetByName(SHEET_USUARIOS);
  const users = hojaUser.getDataRange().getValues();
  const sessionUser = users.find(u => u[6].toString() === token || u[8].toString() === token);

  if (!sessionUser || (sessionUser[3] !== "Admin" && sessionUser[3] !== "Analista")) {
    throw new Error("No tiene permisos para exportar datos 🔒");
  }

  const hoja = SS.getSheetByName(SHEET_INCIDENTES);
  // getDisplayValues() trae las fechas y números formateados tal cual se ven en el Excel
  const datos = hoja.getDataRange().getDisplayValues(); 
  
  if (datos.length < 2) return "No hay datos";

  registrarAccionAuditoria({usuario: sessionUser[1], rol: sessionUser[3]}, "EXPORTAR INCIDENCIAS", "Descarga de matriz completa");
  
  return datos; // Se envía el array bidimensional
}

// Mantenemos esta función por compatibilidad con versiones anteriores si algún botón quedó rezagado
function generarCSVIncidencias(token) {
  return obtenerMatrizIncidenciasExportacion(token);
}