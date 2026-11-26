// ==========================================
// 1. AUDITORÍA, BACKUPS Y PERFIL
// ==========================================
function registrarAuditoria(email, rol, accion, detalles) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Auditoria");
    if (!sheet) return;
    var fecha = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([fecha, email, rol, accion, detalles]);
  } catch (e) { }
}

function crearBackupSemanal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var carpeta = DriveApp.getFolderById("1dsxdA2qLNx6-Kz4DmanSKhJXNSD16AUi");
  var fecha = Utilities.formatDate(new Date(), "America/Caracas", "yyyy-MM-dd");
  DriveApp.getFileById(ss.getId()).makeCopy("Backup_BD_" + fecha, carpeta);
}

function instalarTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "crearBackupSemanal" || triggers[i].getHandlerFunction() === "revisarIncumplimientos") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("crearBackupSemanal").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
  ScriptApp.newTrigger("revisarIncumplimientos").timeBased().everyDays(1).atHour(1).create();
}

function obtenerMisDatosPersonales(usuarioLogin) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    var datos = sheet.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][4] === usuarioLogin) {
        return { exito: true, fila: i + 1, nombre: datos[i][0], correo: datos[i][1], usuario: datos[i][4], cedula: datos[i][6] || "", telefono: datos[i][7] || "", tema: datos[i][8] || "default", fotoPerfil: datos[i][9] || "" };
      }
    }
    return { exito: false, mensaje: "Usuario no encontrado." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarDatosPersonales(datos) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    sheet.getRange(datos.fila, 1).setValue(datos.nombre);
    sheet.getRange(datos.fila, 2).setValue(datos.correo);
    sheet.getRange(datos.fila, 7).setValue(datos.cedula);
    sheet.getRange(datos.fila, 8).setValue(datos.telefono);
    sheet.getRange(datos.fila, 9).setValue(datos.tema || "default");
    
    var fotoUrl = datos.fotoPerfil || "";
    if (datos.fotoPerfilBase64 && datos.fotoPerfilBase64.indexOf("data:image/") === 0) {
      var partes = datos.fotoPerfilBase64.split(",");
      var mimeType = partes[0].match(/:(.*?);/)[1];
      var base64Data = partes[1];
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, "AVATAR_" + datos.usuarioLogin + "_" + new Date().getTime());
      var carpetaDestino = DriveApp.getFolderById("1lwOqQ315njd9KX3pJ-DHcz2owMUcMshH");
      var archivo = carpetaDestino.createFile(blob);
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fotoUrl = convertirUrlDriveAImagen(archivo.getUrl());
    } else if (datos.fotoPerfilBase64 === "") {
      fotoUrl = "";
    }
    sheet.getRange(datos.fila, 10).setValue(fotoUrl);
    
    if (datos.clave && datos.clave.trim() !== "") sheet.getRange(datos.fila, 6).setValue(datos.clave);
    registrarAuditoria(datos.usuarioLogin, "General", "Actualizó Perfil", "");
    return { exito: true, mensaje: "Datos actualizados exitosamente.", tema: datos.tema, fotoPerfil: fotoUrl };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function obtenerCorreoBd(usuarioLogin) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
  var datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) { if (datos[i][4] === usuarioLogin) return datos[i][1]; }
  return "";
}

// ==========================================
// 2. GESTIÓN Y CONFIGURACIÓN (ADMIN)
// ==========================================
function obtenerConfigGlobal() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion");
    if (!sheet) { sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Configuracion"); }
    var datos = sheet.getDataRange().getValues();
    for (var i = 0; i < datos.length; i++) {
      if (datos[i][0] === "config_global") return { exito: true, datos: JSON.parse(datos[i][1]) };
    }
    var def = { correosActivos: true, notificarAdminImportantes: false, comunicadoActivo: false, comunicadoTexto: "Escribe aquí el aviso general para los usuarios...", diasIncumplimiento: 7 };
    sheet.appendRow(["config_global", JSON.stringify(def)]);
    return { exito: true, datos: def };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarConfigGlobal(configJson) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion");
    var datos = sheet.getDataRange().getValues();
    var fila = -1;
    for (var i = 0; i < datos.length; i++) { if (datos[i][0] === "config_global") { fila = i + 1; break; } }
    if (fila !== -1) { sheet.getRange(fila, 2).setValue(JSON.stringify(configJson)); }
    else { sheet.appendRow(["config_global", JSON.stringify(configJson)]); }
    registrarAuditoria(Session.getActiveUser().getEmail(), "Admin", "Configuró Ajustes Globales", "");
    return { exito: true, mensaje: "Ajustes del Sistema actualizados." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function probarEnvioCorreos(correoDestino) {
  try {
    MailApp.sendEmail({
      to: correoDestino,
      subject: "JADE - Prueba de Servicio de Correo",
      htmlBody: "<h3>¡Prueba Exitosa!</h3><p>El servicio de correo de Google Apps Script está funcionando correctamente para el sistema JADE.</p>"
    });
    return { exito: true, mensaje: "Correo de prueba enviado exitosamente a " + correoDestino };
  } catch (e) { 
    return { exito: false, mensaje: "Error al enviar correo: " + e.message }; 
  }
}

function obtenerListaUsuarios() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    var data = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) { users.push({ fila: i + 1, nombre: data[i][0], correo: data[i][1], rol: data[i][2], estado: data[i][3], usuario: data[i][4], clave: data[i][5] }); }
    return { exito: true, datos: users };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarNuevoUsuario(u) {
  try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios").appendRow([u.nombre, u.correo, u.rol, u.estado, u.usuario, u.clave, "", ""]); return { exito: true, mensaje: "Usuario creado." }; } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

// ==========================================
// 2.1 SISTEMA DE MENSAJERÍA
// ==========================================
function _initMensajeria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shChats = ss.getSheetByName("Chats");
  if (!shChats) { shChats = ss.insertSheet("Chats"); shChats.appendRow(["ChatID", "Titulo", "CreadoPor", "FechaCreacion", "ParticipantesRoles"]); }
  var shMsgs = ss.getSheetByName("Mensajes");
  if (!shMsgs) { shMsgs = ss.insertSheet("Mensajes"); shMsgs.appendRow(["MsgID", "ChatID", "Fecha", "Usuario", "Rol", "Mensaje", "Leido"]); }
}

function crearChatTrabajo(datos) {
  try {
    _initMensajeria();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shChats = ss.getSheetByName("Chats");
    var chatId = "CHAT-" + Utilities.formatDate(new Date(), "America/Caracas", "yyyyMMdd-HHmmss");
    
    // Si es un chat directo (1 a 1), podemos marcarlo de alguna forma si queremos, 
    // pero por ahora seguiremos usando la lista de participantes.
    var roles = Array.isArray(datos.participantes) ? datos.participantes.join(",") : "Todos";
    
    shChats.appendRow([chatId, datos.titulo, datos.creadoPor, Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm"), roles]);
    return { exito: true, mensaje: "Chat creado exitosamente.", chatId: chatId };
  } catch (e) { 
    Logger.log("Error en crearChatTrabajo: " + e.toString());
    return { exito: false, mensaje: "Error al crear chat: " + e.toString() }; 
  }
}

function obtenerChats(usuarioLogin, rolUsuario) {
  try {
    _initMensajeria();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("No se pudo obtener la hoja de cálculo activa.");
    
    var shChats = ss.getSheetByName("Chats");
    if (!shChats) return { exito: true, datos: [] }; 
    
    var datos = shChats.getDataRange().getValues();
    var chats = [];
    if (datos.length <= 1) return { exito: true, datos: [] };
    
    for (var i = 1; i < datos.length; i++) {
      var rolesPermitidos = String(datos[i][4] || "").split(",");
      var tieneAcceso = (
        rolUsuario === "Admin" || 
        rolesPermitidos.indexOf("Todos") !== -1 || 
        rolesPermitidos.indexOf(rolUsuario) !== -1 || 
        rolesPermitidos.indexOf(usuarioLogin) !== -1 || 
        datos[i][2] === usuarioLogin
      );
      
      if (tieneAcceso) {
        chats.push({
          id: String(datos[i][0]),
          titulo: String(datos[i][1]),
          creadoPor: String(datos[i][2]),
          fecha: String(datos[i][3]),
          roles: String(datos[i][4])
        });
      }
    }
    return { exito: true, datos: chats.reverse() };
  } catch (e) { 
    Logger.log("Error en obtenerChats: " + e.toString());
    return { exito: false, mensaje: "Error al obtener chats: " + e.toString() }; 
  }
}

function obtenerMensajes(chatId) {
  try {
    _initMensajeria();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shMsgs = ss.getSheetByName("Mensajes");
    if (!shMsgs) return { exito: true, datos: [] };
    
    var datos = shMsgs.getDataRange().getValues();
    var msgs = [];
    if (datos.length <= 1) return { exito: true, datos: [] };
    
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][1]) === String(chatId)) {
        msgs.push({
          id: String(datos[i][0]),
          chatId: String(datos[i][1]),
          fecha: String(datos[i][2]),
          usuario: String(datos[i][3]),
          rol: String(datos[i][4]),
          mensaje: String(datos[i][5]),
          leido: String(datos[i][6] || "No")
        });
      }
    }
    return { exito: true, datos: msgs };
  } catch (e) { 
    Logger.log("Error en obtenerMensajes: " + e.toString());
    return { exito: false, mensaje: e.toString() }; 
  }
}

function marcarMensajesComoLeidos(chatId, usuarioLogin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName("Mensajes");
    if (!sh) return { exito: false };
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(chatId) && String(data[i][3]) !== String(usuarioLogin) && data[i][6] !== "Si") {
        sh.getRange(i + 1, 7).setValue("Si");
      }
    }
    return { exito: true };
  } catch (e) { return { exito: false }; }
}

function enviarMensajeChat(chatId, mensaje, usuarioLogin, rolUsuario) {
  try {
    _initMensajeria();
    if (!mensaje || mensaje.trim() === "") return { exito: false, mensaje: "El mensaje no puede estar vacío." };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shMsgs = ss.getSheetByName("Mensajes");
    if (!shMsgs) throw new Error("No se pudo encontrar la hoja 'Mensajes'");
    
    var msgId = "MSG-" + new Date().getTime();
    shMsgs.appendRow([
      String(msgId), 
      String(chatId), 
      String(Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm")), 
      String(usuarioLogin), 
      String(rolUsuario), 
      String(mensaje),
      "No"
    ]);
    return { exito: true, mensaje: "Enviado.", msgId: msgId };
  } catch (e) { 
    Logger.log("Error en enviarMensajeChat: " + e.toString());
    return { exito: false, mensaje: e.toString() }; 
  }
}
function editarUsuarioBD(u) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios"); var fila = parseInt(u.fila);
    sheet.getRange(fila, 1).setValue(u.nombre); sheet.getRange(fila, 2).setValue(u.correo); sheet.getRange(fila, 3).setValue(u.rol); sheet.getRange(fila, 4).setValue(u.estado); sheet.getRange(fila, 5).setValue(u.usuario);
    if (u.clave && u.clave.trim() !== "") sheet.getRange(fila, 6).setValue(u.clave);
    return { exito: true, mensaje: "Usuario actualizado." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}
function eliminarUsuarioBD(fila, nombreUser) {
  try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios").deleteRow(fila); return { exito: true, mensaje: "Usuario eliminado." }; } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function obtenerConfigIndicadores() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion");
    var def = { valRecurrente: 10, valNacional: 20, valPresidencial: 30, valMetaPart: 40, valMetaFam: 15, valEvidencias: 15 };
    if (!sheet) { sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Configuracion"); sheet.appendRow(["indicadores_json", JSON.stringify(def)]); return { exito: true, datos: def }; }
    var datos = sheet.getDataRange().getValues();
    for (var i = 0; i < datos.length; i++) { if (datos[i][0] === "indicadores_json") return { exito: true, datos: JSON.parse(datos[i][1]) }; }
    sheet.appendRow(["indicadores_json", JSON.stringify(def)]); return { exito: true, datos: def };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}
function guardarConfigIndicadores(configJson) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuracion"); var datos = sheet.getDataRange().getValues(); var fila = -1;
    for (var i = 0; i < datos.length; i++) { if (datos[i][0] === "indicadores_json") { fila = i + 1; break; } }
    if (fila !== -1) sheet.getRange(fila, 2).setValue(JSON.stringify(configJson)); else sheet.appendRow(["indicadores_json", JSON.stringify(configJson)]);
    registrarAuditoria(Session.getActiveUser().getEmail(), "Admin/Analista", "Configuró Indicadores", "");
    return { exito: true, mensaje: "Parámetros actualizados." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

// Sub-Indicadores CRUD
function obtenerSubIndicadores() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SubIndicadores");
    if (!sheet) return { exito: true, datos: [] };
    var datos = sheet.getDataRange().getValues();
    if (datos.length <= 1) return { exito: true, datos: [] };
    var lista = [];
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === "" && datos[i][1] === "") continue;
      lista.push({
        fila: i + 1,
        nombre: datos[i][0],
        criterio: datos[i][1],
        puntaje: Number(datos[i][2]) || 0,
        activo: datos[i][3] !== false && datos[i][3] !== "FALSE" && datos[i][3] !== ""
      });
    }
    return { exito: true, datos: lista };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarSubIndicador(ind) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SubIndicadores");
    if (!sheet) {
      sheet = ss.insertSheet("SubIndicadores");
      sheet.appendRow(["Nombre", "Criterio", "Puntaje", "Activo"]);
    }
    if (ind.fila) {
      // Editar existente
      sheet.getRange(ind.fila, 1).setValue(ind.nombre);
      sheet.getRange(ind.fila, 2).setValue(ind.criterio);
      sheet.getRange(ind.fila, 3).setValue(ind.puntaje);
      sheet.getRange(ind.fila, 4).setValue(ind.activo);
      return { exito: true, mensaje: "Indicador actualizado." };
    } else {
      // Crear nuevo
      sheet.appendRow([ind.nombre, ind.criterio, ind.puntaje, ind.activo]);
      return { exito: true, mensaje: "Indicador creado." };
    }
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function eliminarSubIndicador(fila) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SubIndicadores");
    if (!sheet) return { exito: false, mensaje: "Hoja no encontrada." };
    sheet.deleteRow(fila);
    return { exito: true, mensaje: "Indicador eliminado." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}


function revisarIncumplimientos(adminTrigger) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    if (!sheet) return { exito: false, mensaje: "Hoja de Actividades no encontrada." };
    var datos = sheet.getDataRange().getValues();

    // Si no tienes la función obtenerConfigGlobal() en BD.js, asumo valores por defecto.
    var diasUmbral = 7;
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    var countModificados = 0;

    for (var i = 1; i < datos.length; i++) {
      var estatus = datos[i][3]; // Columna D
      if (estatus === "Planificada") {
        var fechaVal = datos[i][16]; // Columna Q (Índice 16)
        var fechaAct = null;

        // REPARACIÓN CRÍTICA: Interpretar correctamente si viene como Date o String
        if (fechaVal) {
          if (fechaVal instanceof Date || typeof fechaVal.getMonth === 'function') {
            fechaAct = new Date(fechaVal);
          } else {
            var partes = String(fechaVal).split("-");
            if (partes.length === 3) {
              fechaAct = new Date(partes[0], partes[1] - 1, partes[2]);
            }
          }
        }

        if (fechaAct && !isNaN(fechaAct.getTime())) {
          fechaAct.setHours(0, 0, 0, 0);
          var diffDias = Math.floor((hoy.getTime() - fechaAct.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDias >= diasUmbral) {
            sheet.getRange(i + 1, 4).setValue("Actividad Incumplida");
            sheet.getRange(i + 1, 44).setValue("Excedió umbral de " + diasUmbral + " días"); // AR
            agregarAlHistorial(sheet, i + 1, "Incumplimiento Automático", "Venció hace " + diffDias + " días.");
            countModificados++;
          }
        }
      }
    }
    if (adminTrigger) registrarAuditoria(Session.getActiveUser().getEmail(), "Admin", "Forzó Revisión", "Modificadas: " + countModificados);
    return { exito: true, mensaje: "Revisión completada. Marcadas: " + countModificados };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

// ==========================================
// 3. PLANIFICACIÓN Y ACCIONES 
// ==========================================
function agregarAlHistorial(sheet, fila, accion, detalle, nombre, rol) {
  var colHistorial = 48; // Columna AV (1-based index)
  var historialActual = sheet.getRange(fila, colHistorial).getValue() || "";
  var fecha = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm");
  var quien = (nombre && rol) ? nombre + " (" + rol + "): " : "";
  var nuevaEntrada = "•[" + fecha + "] " + quien + accion + (detalle ? ": " + detalle : "");
  sheet.getRange(fila, colHistorial).setValue(historialActual + (historialActual ? "\n" : "") + nuevaEntrada);
}

function guardarPlanificacion(datos) {
  try {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var idActividad = "ACT-" + Utilities.formatDate(new Date(), "America/Caracas", "yyyyMMdd-HHmmss");

    // Array blindado de 52 columnas (A hasta AZ)
    var nuevaFila = new Array(52).fill("");
    nuevaFila[0] = idActividad; // A
    nuevaFila[1] = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm:ss"); // B
    nuevaFila[2] = datos.usuarioLogin; // C
    nuevaFila[3] = "Planificada"; // D
    nuevaFila[4] = datos.tipoActividad || "Ordinaria"; // E
    nuevaFila[5] = datos.estado; // F
    nuevaFila[6] = datos.municipio; // G
    nuevaFila[7] = datos.parroquia; // H
    nuevaFila[8] = datos.comuna; // I
    nuevaFila[9] = datos.lugar; // J
    nuevaFila[10] = datos.nombreResp; // K
    nuevaFila[11] = datos.cedulaResp; // L
    nuevaFila[12] = datos.telefonoResp; // M
    nuevaFila[13] = datos.instResp; // N
    nuevaFila[14] = datos.cargoResp; // O
    nuevaFila[15] = datos.nombreAct; // P
    nuevaFila[16] = datos.fechaAct; // Q
    nuevaFila[17] = datos.horaAct; // R
    nuevaFila[18] = datos.transformacion; // S
    nuevaFila[19] = datos.impacto; // T
    nuevaFila[20] = datos.objetivo; // U
    nuevaFila[21] = datos.descripcion; // V
    nuevaFila[22] = datos.metaPart; // W
    nuevaFila[23] = datos.metaFam; // X
    nuevaFila[24] = datos.instituciones; // Y
    nuevaFila[25] = datos.medios; // Z
    nuevaFila[33] = datos.demoJovenes || 0; // AH
    nuevaFila[34] = datos.demoAdultos || 0; // AI
    nuevaFila[35] = datos.demoMayores || 0; // AJ
    nuevaFila[36] = datos.demoHombres || 0; // AK
    nuevaFila[37] = datos.demoMujeres || 0; // AL
    nuevaFila[49] = datos.tipoActCategoria || ""; // AX — Tipo de Actividad (Reunión/Asambleas/Visitas/Jornadas)
    nuevaFila[50] = datos.comunasVinculadas || 0; // AY
    nuevaFila[51] = datos.circuitosVinculados || 0; // AZ

    hoja.appendRow(nuevaFila);
    var lastRow = hoja.getLastRow();
    agregarAlHistorial(hoja, lastRow, "Creada", "Planificación Inicial", datos.usuarioNombre, datos.usuarioRol);
    registrarAuditoria(datos.usuarioLogin, "Responsable", "Planificó", "ID: " + idActividad);
    return { exito: true, mensaje: "Planificación guardada exitosamente." };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function editarPlanificacionBD(oldData, nD) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === oldData[0]) {
        var f = i + 1;
        // Editamos las columnas exactas
        sheet.getRange(f, 5).setValue(nD.tipoActividad || "Ordinaria");
        sheet.getRange(f, 6).setValue(nD.estado); sheet.getRange(f, 7).setValue(nD.municipio); sheet.getRange(f, 8).setValue(nD.parroquia);
        sheet.getRange(f, 9).setValue(nD.comuna); sheet.getRange(f, 10).setValue(nD.lugar); sheet.getRange(f, 11).setValue(nD.nombreResp);
        sheet.getRange(f, 12).setValue(nD.cedulaResp); sheet.getRange(f, 13).setValue(nD.telefonoResp); sheet.getRange(f, 14).setValue(nD.instResp);
        sheet.getRange(f, 15).setValue(nD.cargoResp); sheet.getRange(f, 16).setValue(nD.nombreAct); sheet.getRange(f, 17).setValue(nD.fechaAct);
        sheet.getRange(f, 18).setValue(nD.horaAct); sheet.getRange(f, 19).setValue(nD.transformacion); sheet.getRange(f, 20).setValue(nD.impacto);
        sheet.getRange(f, 21).setValue(nD.objetivo); sheet.getRange(f, 22).setValue(nD.descripcion); sheet.getRange(f, 23).setValue(nD.metaPart);
        sheet.getRange(f, 24).setValue(nD.metaFam); sheet.getRange(f, 25).setValue(nD.instituciones); sheet.getRange(f, 26).setValue(nD.medios);
        
        // Nuevos campos en edición
        sheet.getRange(f, 34).setValue(nD.demoJovenes || 0); // AH
        sheet.getRange(f, 35).setValue(nD.demoAdultos || 0); // AI
        sheet.getRange(f, 36).setValue(nD.demoMayores || 0); // AJ
        sheet.getRange(f, 37).setValue(nD.demoHombres || 0); // AK
        sheet.getRange(f, 38).setValue(nD.demoMujeres || 0); // AL
        sheet.getRange(f, 51).setValue(nD.comunasVinculadas || 0); // AY
        sheet.getRange(f, 52).setValue(nD.circuitosVinculados || 0); // AZ

        if (nD.tipoActCategoria) sheet.getRange(f, 50).setValue(nD.tipoActCategoria); // Columna AX

        agregarAlHistorial(sheet, f, "Editada", "Planificación actualizada (48h)", nD.usuarioNombre, nD.usuarioRol);
        registrarAuditoria(nD.usuarioLogin, "Responsable", "Editó Actividad", oldData[0]);
        return { exito: true, mensaje: "Actividad actualizada correctamente." };
      }
    }
    return { exito: false, mensaje: "No se encontró la actividad." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function obtenerMisActividades(usuarioLogin, rol, estado) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getDisplayValues();
    var misActividades = [];
    var usrNorm = (usuarioLogin || "").toString().trim().toLowerCase();
    var estadoNorm = (estado || "").toString().trim().toLowerCase();
    var esResponsable = (rol === "Responsable Estadal" || rol === "Responsable");
    var esAdminAnalista = (rol === "Admin" || rol === "Analista" || rol === "Operador");

    for (var i = 1; i < datos.length; i++) {
      var colUsuario = (datos[i][2] || "").toString().trim().toLowerCase();
      var colEstado = (datos[i][5] || "").toString().trim().toLowerCase();
      
      var coincide = false;
      if (esAdminAnalista) {
        coincide = true;
      } else if (esResponsable && estadoNorm) {
        coincide = (colEstado === estadoNorm);
      } else {
        coincide = (colUsuario === usrNorm);
      }

      if (coincide) {
        misActividades.push({
          id: datos[i][0], estatus: datos[i][3], estado: datos[i][5], municipio: datos[i][6], parroquia: datos[i][7],
          nombreAct: datos[i][15], fechaAct: datos[i][16], descripcion: datos[i][21],
          transformacion: datos[i][18] || "",
          obsAnalista: datos[i][42] || "", datosCompletos: datos[i].slice(0, 53)
        });
      }
    }
    return { exito: true, datos: misActividades.reverse() };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function obtenerDetalleActividad(idActividad) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
  var datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idActividad) return { exito: true, id: datos[i][0], municipio: datos[i][6], descripcion: datos[i][21], filaIndex: i + 1 };
  }
  return { exito: false, mensaje: "Actividad no encontrada" };
}

function reprogramarActividadBD(id, nuevaFecha, motivo, usuarioLogin, nombre, rol) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === id) {
        sheet.getRange(i + 1, 4).setValue("Planificada - Reprogramada");
        sheet.getRange(i + 1, 44).setValue("Reprogramada"); // AS (Estatus_Reprogramación)
        sheet.getRange(i + 1, 45).setValue(nuevaFecha);     // AT (Nueva_Fecha)
        sheet.getRange(i + 1, 46).setValue(motivo);         // AU (Motivo)
        agregarAlHistorial(sheet, i + 1, "Reprogramada", "Para el " + nuevaFecha + " (" + motivo + ")", nombre, rol);
        registrarAuditoria(usuarioLogin, "Responsable", "Reprogramó", id);
        return { exito: true, mensaje: "Actividad Reprogramada exitosamente." };
      }
    }
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function cancelarActividadBD(id, usuarioLogin, motivo, nombre, rol) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] === id) {
        sheet.getRange(i + 1, 4).setValue("Cancelada");
        sheet.getRange(i + 1, 46).setValue(motivo); // AU (Motivo)
        agregarAlHistorial(sheet, i + 1, "Cancelada", "Motivo: " + motivo, nombre, rol);
        registrarAuditoria(usuarioLogin, "Responsable", "Canceló", id);
        return { exito: true, mensaje: "Actividad Cancelada" };
      }
    }
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

// ==========================================
// 4. REPORTAR Y FOTOS 
// ==========================================
function convertirUrlDriveAImagen(urlDrive) {
  if (!urlDrive) return "";
  var idMatch = urlDrive.match(/[-\w]{25,}/);
  if (idMatch && idMatch.length > 0) return "https://drive.google.com/uc?export=view&id=" + idMatch[0];
  return urlDrive;
}

function guardarRendicionCompleta(formulario, fotosBase64) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var idBuscado = formulario.idActividad;
    var datos = sheet.getDataRange().getValues();
    var filaEncontrada = -1;
    for (var i = 1; i < datos.length; i++) { if (datos[i][0] === idBuscado) { filaEncontrada = i + 1; break; } }
    if (filaEncontrada === -1) return { exito: false, mensaje: "Actividad no encontrada." };

    var carpetaDestino = DriveApp.getFolderById("1lwOqQ315njd9KX3pJ-DHcz2owMUcMshH");

    var urlsFotos = ["", "", ""];
    fotosBase64.forEach(function (fotoObj, index) {
      if (fotoObj && fotoObj.data && index < 3) {
        var blob = Utilities.newBlob(Utilities.base64Decode(fotoObj.data), fotoObj.mimeType, idBuscado + "_FOTO" + (index + 1));
        var archivo = carpetaDestino.createFile(blob);
        archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        urlsFotos[index] = convertirUrlDriveAImagen(archivo.getUrl());
      }
    });

    var estatusAnterior = sheet.getRange(filaEncontrada, 4).getValue();
    if (estatusAnterior === "Enviar a Corregir") agregarAlHistorial(sheet, filaEncontrada, "Corrección", "Reporte corregido enviado.", formulario.usuarioNombre, formulario.usuarioRol);
    else agregarAlHistorial(sheet, filaEncontrada, "Reporte Enviado", "A la espera de validación.", formulario.usuarioNombre, formulario.usuarioRol);

    sheet.getRange(filaEncontrada, 4).setValue("Reportado - En Revisión");
    sheet.getRange(filaEncontrada, 27).setValue(Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm")); // AA: Fecha_Reporte
    sheet.getRange(filaEncontrada, 28).setValue(formulario.descFinal);  // AB: Desc Final
    sheet.getRange(filaEncontrada, 29).setValue(formulario.transFinal); // AC: Transf Real
    sheet.getRange(filaEncontrada, 30).setValue(formulario.partReales); // AD: Part Reales
    sheet.getRange(filaEncontrada, 31).setValue(formulario.famReales);  // AE: Fam Reales
    sheet.getRange(filaEncontrada, 32).setValue(formulario.instReales); // AF: Inst Reales
    sheet.getRange(filaEncontrada, 33).setValue(formulario.mediosReales);// AG: Medios Reales

    // DEMOGRAFÍA
    sheet.getRange(filaEncontrada, 34).setValue(formulario.demoJovenes); // AH
    sheet.getRange(filaEncontrada, 35).setValue(formulario.demoAdultos); // AI
    sheet.getRange(filaEncontrada, 36).setValue(formulario.demoMayores); // AJ
    sheet.getRange(filaEncontrada, 37).setValue(formulario.demoHombres); // AK
    sheet.getRange(filaEncontrada, 38).setValue(formulario.demoMujeres); // AL

    // FOTOS
    sheet.getRange(filaEncontrada, 39).setValue(urlsFotos[0]); // AM          
    sheet.getRange(filaEncontrada, 40).setValue(urlsFotos[1]); // AN         
    sheet.getRange(filaEncontrada, 41).setValue(urlsFotos[2]); // AO         

    // NUEVOS CAMPOS OBLIGATORIOS (Comunas y Circuitos)
    sheet.getRange(filaEncontrada, 51).setValue(formulario.comunasVinculadas || 0); // AY
    sheet.getRange(filaEncontrada, 52).setValue(formulario.circuitosVinculados || 0); // AZ

    // CATEGORÍA DE ACTIVIDAD (columna 50 = AX)
    if (formulario.tipoActCategoria) sheet.getRange(filaEncontrada, 50).setValue(formulario.tipoActCategoria);

    registrarAuditoria(formulario.usuarioLogin, "Responsable", "Report\u00f3 Actividad", idBuscado);

    try {
      var configG = obtenerConfigGlobal().datos;
      if (configG.correosActivos) {
        var emailAnalistas = [];
        var sheetU = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
        var dU = sheetU.getDataRange().getValues();
        for (var k = 1; k < dU.length; k++) { if (dU[k][2] === "Analista" || dU[k][2] === "Admin") emailAnalistas.push(dU[k][1]); }
        if (emailAnalistas.length > 0) {
          MailApp.sendEmail({
            to: emailAnalistas.join(","),
            subject: "NUEVO REPORTE: " + idBuscado + " (" + datos[filaEncontrada - 1][5] + ")",
            htmlBody: "El estado <b>" + datos[filaEncontrada - 1][5] + "</b> ha enviado un nuevo reporte para la actividad " + idBuscado + ".<br>Por favor, ingrese al sistema para auditarlo."
          });
        }
      }
    } catch (e) { }

    return { exito: true, mensaje: "Reporte enviado a revisión exitosamente." };
  } catch (e) { return { exito: false, mensaje: "Error: " + e.toString() }; }
}

function guardarActividadExtraordinariaBD(datos, fotosBase64) {
  try {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var idActividad = "EXT-" + Utilities.formatDate(new Date(), "America/Caracas", "yyyyMMdd-HHmmss");

    var carpetaDestino = DriveApp.getFolderById("1lwOqQ315njd9KX3pJ-DHcz2owMUcMshH");
    var urlsFotos = ["", "", ""];
    fotosBase64.forEach(function (fotoObj, index) {
      if (fotoObj && fotoObj.data && index < 3) {
        var blob = Utilities.newBlob(Utilities.base64Decode(fotoObj.data), fotoObj.mimeType, idActividad + "_FOTO" + (index + 1));
        var archivo = carpetaDestino.createFile(blob);
        archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        urlsFotos[index] = convertirUrlDriveAImagen(archivo.getUrl());
      }
    });

    var nuevaFila = new Array(50).fill("");
    nuevaFila[0] = idActividad; // A
    nuevaFila[1] = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm:ss"); // B
    nuevaFila[2] = datos.usuarioLogin; // C
    nuevaFila[3] = "Reportado - En Revisión"; // D (Estado inicial reportado)
    nuevaFila[4] = datos.tipoActividad; // E (Extraordinaria)
    nuevaFila[5] = datos.estado; // F
    nuevaFila[6] = datos.municipio; // G
    nuevaFila[7] = datos.parroquia; // H
    nuevaFila[8] = datos.comuna; // I
    nuevaFila[9] = datos.lugar; // J
    nuevaFila[10] = datos.nombreResp; // K
    nuevaFila[11] = ""; // L
    nuevaFila[12] = ""; // M
    nuevaFila[13] = ""; // N
    nuevaFila[14] = ""; // O
    nuevaFila[15] = datos.nombreAct; // P
    nuevaFila[16] = datos.fechaAct; // Q
    nuevaFila[17] = datos.horaAct; // R
    nuevaFila[18] = datos.transformacion; // S
    nuevaFila[19] = datos.impacto; // T
    nuevaFila[20] = datos.objetivo; // U
    nuevaFila[21] = datos.descripcion; // V
    nuevaFila[22] = datos.metaPart; // W
    nuevaFila[23] = datos.metaFam; // X
    nuevaFila[24] = datos.instituciones; // Y
    nuevaFila[25] = datos.medios; // Z
    nuevaFila[26] = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm"); // AA Fecha Reporte
    nuevaFila[27] = datos.descripcion; // AB Desc Final (es la misma descripcion)
    nuevaFila[28] = datos.transformacion; // AC Transf Real
    nuevaFila[29] = datos.metaPart; // AD Part Reales
    nuevaFila[30] = datos.metaFam; // AE Fam Reales
    nuevaFila[31] = datos.instituciones; // AF Inst Reales
    nuevaFila[32] = datos.medios; // AG Med Reales
    nuevaFila[33] = datos.demoJovenes; // AH (Demo Jovenes)
    nuevaFila[34] = datos.demoAdultos; // AI (Demo Adultos)
    nuevaFila[35] = datos.demoMayores; // AJ (Demo Mayores)
    nuevaFila[36] = datos.demoHombres; // AK (Demo Hombres)
    nuevaFila[37] = datos.demoMujeres; // AL (Demo Mujeres)
    nuevaFila[38] = urlsFotos[0]; // AM Foto1
    nuevaFila[39] = urlsFotos[1]; // AN Foto2
    nuevaFila[40] = urlsFotos[2]; // AO Foto3
    nuevaFila[49] = datos.tipoActCategoria || ""; // AX — Categoría (Reunión/Asambleas/Visitas/Jornadas)
    nuevaFila[50] = datos.comunasVinculadas || 0; // AY
    nuevaFila[51] = datos.circuitosVinculados || 0; // AZ

    hoja.appendRow(nuevaFila);
    var lastRow = hoja.getLastRow();
    agregarAlHistorial(hoja, lastRow, "Creada y Reportada", "Actividad Extraordinaria", datos.usuarioNombre, datos.usuarioRol);
    registrarAuditoria(datos.usuarioLogin, "Responsable", "Reportó Extraordinaria", "ID: " + idActividad);

    try {
      var configG = obtenerConfigGlobal().datos;
      if (configG.correosActivos) {
        var emailAnalistas = [];
        var sheetU = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
        var dU = sheetU.getDataRange().getValues();
        for (var k = 1; k < dU.length; k++) { if (dU[k][2] === "Analista" || dU[k][2] === "Admin") emailAnalistas.push(dU[k][1]); }
        if (emailAnalistas.length > 0) {
          MailApp.sendEmail({
            to: emailAnalistas.join(","),
            subject: "NUEVA ACT. EXTRAORDINARIA: " + idActividad + " (" + datos.estado + ")",
            htmlBody: "El estado <b>" + datos.estado + "</b> ha registrado y reportado la actividad extraordinaria " + idActividad + ".<br>Por favor, ingrese al sistema para auditarla."
          });
        }
      }
    } catch (e) { }

    return { exito: true, mensaje: "Actividad extraordinaria guardada y reportada exitosamente." };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

// ==========================================
// 5. MÓDULO ANALISTA, OPERADOR Y VISOR ADMIN
// ==========================================
function obtenerPendientesValidacion() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getDisplayValues();
    var pendientes = [];
    for (var i = 1; i < datos.length; i++) {
      var estatus = datos[i][3];
      if (estatus === "Reportado - En Revisión" || estatus === "Planificado - En Revisión" || estatus === "Planificada") {
        pendientes.push({
          fila: i + 1, id: datos[i][0], estado: datos[i][5], municipio: datos[i][6],
          nombreAct: datos[i][15], fechaAct: datos[i][16], descReal: datos[i][27], estatus: estatus,
          foto1: datos[i][38], foto2: datos[i][39], foto3: datos[i][40], datosCompletos: datos[i] // Fotos AM, AN, AO
        });
      }
    }
    return { exito: true, datos: pendientes.reverse() };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function obtenerHistorialValidaciones() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getDisplayValues();
    var historial = [];
    for (var i = 1; i < datos.length; i++) {
      var est = (datos[i][3] || "").toString().trim().toLowerCase();
      // Verificamos por palabras clave para evitar fallos por capitalización o espacios
      if (est.indexOf("validada") !== -1 || est.indexOf("corregir") !== -1 || est.indexOf("cancelada") !== -1 || est.indexOf("reprogramada") !== -1 || est.indexOf("incumplida") !== -1 || est.indexOf("rechazada") !== -1) {
        historial.push({
          fila: i + 1, id: datos[i][0], estado: datos[i][5], municipio: datos[i][6],
          nombreAct: datos[i][15], fechaAct: datos[i][16], descReal: datos[i][27], estatus: datos[i][3],
          foto1: datos[i][38], foto2: datos[i][39], foto3: datos[i][40], datosCompletos: datos[i]
        });
      }
    }
    return { exito: true, datos: historial.reverse() };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function obtenerPlanificacionesNacionales() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datos = sheet.getDataRange().getDisplayValues();
    var plan = [];
    for (var i = 1; i < datos.length; i++) {
      plan.push({
        id: datos[i][0], estatus: datos[i][3], estado: datos[i][5], municipio: datos[i][6],
        nombreAct: datos[i][15], fechaAct: datos[i][16], descripcion: datos[i][21], datosCompletos: datos[i]
      });
    }
    return { exito: true, datos: plan.reverse() };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function procesarValidacion(datosValidacion) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var fila = datosValidacion.fila;
    
    sheet.getRange(fila, 4).setValue(datosValidacion.decision); // D (4): Estatus
    sheet.getRange(fila, 43).setValue(datosValidacion.decision); // AQ (43): Validacion_Analista
    sheet.getRange(fila, 44).setValue(datosValidacion.observacion); // AR (44): Observaciones_Analista
    sheet.getRange(fila, 49).setValue(datosValidacion.puntaje); // AW (49): Puntaje_Obtenido
    
    // Actualiza el Histórico usando la función estándar
    agregarAlHistorial(sheet, fila, "Evaluación", "Analista evaluó reporte. (" + datosValidacion.decision + ")", datosValidacion.usuarioNombre, datosValidacion.usuarioRol);

    try { registrarAuditoria(datosValidacion.usuarioLogin, "Analista", datosValidacion.decision, "Fila: " + fila); } catch(e){}
    return { exito: true, mensaje: "Reporte evaluado y guardado correctamente." };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function obtenerMonitorSeguimiento() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetAct = ss.getSheetByName("Actividades");
    var sheetUser = ss.getSheetByName("Usuarios");

    var datosAct = sheetAct.getDataRange().getDisplayValues();
    var datosUser = sheetUser.getDataRange().getDisplayValues();

    // Mapeo de Responsables por Estado para obtener sus teléfonos
    var responsablesMap = {};
    for (var j = 1; j < datosUser.length; j++) {
      var r = datosUser[j][2]; // Rol
      if (r === "Responsable Estadal" || r === "Responsable") {
        var est = datosUser[j][3]; // Estado
        if (!responsablesMap[est]) responsablesMap[est] = [];
        responsablesMap[est].push({
          nombre: datosUser[j][0],
          telefonos: datosUser[j][7] // Columna H (Múltiples números separados por coma)
        });
      }
    }

    var monitor = [];
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    for (var i = 1; i < datosAct.length; i++) {
      var estatus = datosAct[i][3];
      var notas = datosAct[i][41] || "";
      var semaforo = "🟢";
      var estadoAct = datosAct[i][5];

      if (estatus === "Planificada" || estatus.indexOf("Reprogramada") !== -1) {
        var fechaStr = datosAct[i][16];
        var partes = fechaStr.split("-");
        if (partes.length === 3) {
          var fechaAct = new Date(partes[0], partes[1] - 1, partes[2]);
          if (fechaAct < hoy) semaforo = "🔴"; else if (fechaAct.getTime() === hoy.getTime()) semaforo = "🟡";
        }
      } else if (estatus === "Actividad Validada") { semaforo = "✔️"; } else if (estatus === "Enviar a Corregir") { semaforo = "⚠️"; } else { semaforo = "🔵"; }

      monitor.push({
        fila: i + 1,
        id: datosAct[i][0],
        estado: estadoAct,
        responsable: datosAct[i][10],
        telefono: datosAct[i][12],
        responsablesEstado: responsablesMap[estadoAct] || [], // Datos de contacto del estado
        nombreAct: datosAct[i][15],
        fechaAct: datosAct[i][16],
        estatus: estatus,
        semaforo: semaforo,
        notas: notas
      });
    }
    return { exito: true, datos: monitor.reverse() };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarNotaOperador(fila, nota) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var notaActual = sheet.getRange(fila, 42).getValue(); // AP = 42 (1-based)
    var nuevaNota = notaActual + (notaActual !== "" ? "\n" : "") + "[" + Utilities.formatDate(new Date(), "America/Caracas", "dd/MM") + "]: " + nota;
    sheet.getRange(fila, 42).setValue(nuevaNota);
    return { exito: true, mensaje: "Nota agregada." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function marcarContactadoBD(fila, nota, usuarioLogin, contactoNombre) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var idAct = sheet.getRange(fila, 1).getValue();
    var notaActual = sheet.getRange(fila, 42).getValue();
    var quienContacto = contactoNombre ? ' [→ ' + contactoNombre + ']' : '';
    var nuevaNota = notaActual + (notaActual !== "" ? "\n" : "") + "📞[" + Utilities.formatDate(new Date(), "America/Caracas", "dd/MM") + "]" + quienContacto + " CONTACTADO: " + nota;
    sheet.getRange(fila, 42).setValue(nuevaNota);
    agregarAlHistorial(sheet, fila, "Contacto Operador", (contactoNombre ? contactoNombre + ': ' : '') + nota, "", "Operador");
    registrarAuditoria(usuarioLogin, "Operador", "Contactó Responsable", "Actividad: " + idAct);
    return { exito: true, mensaje: "Contacto guardado." };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function registrarNoContactadoBD(fila, idAct, usuarioLogin, tipoFallo) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var tipoTexto = tipoFallo || 'Sin respuesta';
    var notaActual = sheet.getRange(fila, 42).getValue();
    var nuevaNota = notaActual + (notaActual !== "" ? "\n" : "") + "📴[" + Utilities.formatDate(new Date(), "America/Caracas", "dd/MM") + "] INTENTO: " + tipoTexto;
    sheet.getRange(fila, 42).setValue(nuevaNota);
    agregarAlHistorial(sheet, fila, "Intento de Contacto", tipoTexto + " (Operador)", "", "Operador");
    registrarAuditoria(usuarioLogin, "Operador", "No Contactado", "Actividad: " + idAct + " | " + tipoTexto);
    return { exito: true, mensaje: "Intento registrado: " + tipoTexto };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

function obtenerEstadisticasGlobales() {
  try {
    var sheetAct = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datosAct = sheetAct.getDataRange().getDisplayValues();
    var sheetUsu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    var datosUsu = sheetUsu.getDataRange().getDisplayValues();
    var responsablesEstadales = {};
    for (var u = 1; u < datosUsu.length; u++) { if (datosUsu[u][2] === "Responsable Estadal" || datosUsu[u][2] === "Responsable") { responsablesEstadales[datosUsu[u][3]] = datosUsu[u][0]; } }

    var stats = { total: 0, ejecutadas: 0, pendientes: 0, porEstado: {}, rechazadas: 0 };
    var listaCompleta = [];

    for (var i = 1; i < datosAct.length; i++) {
      stats.total++;
      var estatus = datosAct[i][3]; var estado = datosAct[i][5]; // F=5

      listaCompleta.push({
        id: datosAct[i][0], estatus: estatus, estado: estado,
        fechaAct: datosAct[i][16], transformacion: datosAct[i][18], impacto: datosAct[i][19],
        responsable: responsablesEstadales[estado] || "Sin Asignar"
      });

      if (estatus === "Actividad Validada") stats.ejecutadas++;
      else if (estatus !== "Cancelada" && estatus !== "Enviar a Corregir" && estatus !== "Rechazada" && estatus !== "Actividad Incumplida") stats.pendientes++;
      if (estatus === "Cancelada" || estatus === "Actividad Incumplida" || estatus === "Rechazada") stats.rechazadas++;

      if (!stats.porEstado[estado]) { stats.porEstado[estado] = { planificadas: 0, ejecutadas: 0, pendientes: 0, incumplidas: 0, responsable: responsablesEstadales[estado] || "Sin Asignar" }; }
      stats.porEstado[estado].planificadas++;

      if (estatus === "Actividad Validada") { stats.porEstado[estado].ejecutadas++; }
      else if (estatus === "Cancelada" || estatus === "Enviar a Corregir" || estatus === "Rechazada" || estatus === "Actividad Incumplida") { stats.porEstado[estado].incumplidas++; }
      else { stats.porEstado[estado].pendientes++; }
    }

    var arrayEstados = [];
    for (var key in stats.porEstado) { arrayEstados.push({ nombre: key, total: stats.porEstado[key].planificadas, ejec: stats.porEstado[key].ejecutadas, pend: stats.porEstado[key].pendientes, incum: stats.porEstado[key].incumplidas, resp: stats.porEstado[key].responsable }); }
    return { exito: true, general: stats, desglose: arrayEstados, listaCompleta: listaCompleta };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}



// ==========================================
// 6. NOTIFICACIONES
// ==========================================
function obtenerNotificacionesBD(usuarioLogin, rol, estadoUsr) {
  try {
    var sheetAct = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datosAct = sheetAct.getDataRange().getDisplayValues();
    var sheetMon = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Monitor");
    var datosMon = sheetMon ? sheetMon.getDataRange().getDisplayValues() : [];

    var notificaciones = [];
    var hoyStr = Utilities.formatDate(new Date(), "America/Caracas", "yyyy-MM-dd");
    var hoyObj = new Date(hoyStr + "T00:00:00");

    if (rol === "Responsable Estadal" || rol === "Responsable") {
      for (var i = 1; i < datosAct.length; i++) {
        if (datosAct[i][2] !== usuarioLogin && datosAct[i][5] !== estadoUsr) continue;
        var est = datosAct[i][3];
        var idAct = datosAct[i][0];

        if (est.indexOf("Corregir") !== -1) {
          notificaciones.push({ tipo: "error", titulo: "Corrección Requerida", msj: "Tu reporte " + idAct + " requiere correcciones.", fecha: datosAct[i][26] || hoyStr });
        }
        else if (est === "Planificada") {
          var p = datosAct[i][16].split("-");
          if (p.length === 3) {
            var fAct = new Date(p[0], p[1] - 1, p[2]);
            var diffDias = (hoyObj - fAct) / (1000 * 60 * 60 * 24);
            if (diffDias === 0) {
              notificaciones.push({ tipo: "warning", titulo: "Actividad Hoy", msj: "Recuerda ejecutar y reportar " + idAct + " hoy.", fecha: hoyStr });
            } else if (diffDias > 0 && diffDias <= 3) {
              notificaciones.push({ tipo: "warning", titulo: "Reporte Pendiente", msj: "Tienes pendiente el reporte de " + idAct + " (" + diffDias + " días de retraso).", fecha: hoyStr });
            } else if (diffDias > 3) {
              notificaciones.push({ tipo: "error", titulo: "Alerta de Incumplimiento", msj: "La actividad " + idAct + " tiene " + diffDias + " días sin reportar.", fecha: hoyStr });
            }
          }
        }
      }
    }
    else if (rol === "Analista" || rol === "Admin") {
      var countRev = 0;
      for (var i = 1; i < datosAct.length; i++) {
        var est = datosAct[i][3];
        if (est === "Reportado - En Revisión" || est === "Planificado - En Revisión") countRev++;
      }
      if (countRev > 0) {
        notificaciones.push({ tipo: "info", titulo: "Reportes Pendientes", msj: "Hay " + countRev + " reportes esperando tu revisión.", fecha: hoyStr });
      }

      // Alertas del Monitor (Marcadores de operadores)
      var maxMonitor = 10;
      for (var j = datosMon.length - 1; j > 0 && maxMonitor > 0; j--) {
        if (datosMon[j][4] === "No Contactado" || (datosMon[j][6] && datosMon[j][6].trim() !== "")) {
          notificaciones.push({ tipo: "warning", titulo: "Aviso de Operador", msj: "Monitor en " + datosMon[j][2] + " (" + datosMon[j][1] + "): " + (datosMon[j][4] === "No Contactado" ? "No contactado" : datosMon[j][6]), fecha: datosMon[j][0] });
          maxMonitor--;
        }
      }
    }
    else if (rol === "Operador") {
      var countPen = 0;
      for (var i = 1; i < datosAct.length; i++) {
        if (datosAct[i][3] === "Planificada") countPen++;
      }
      if (countPen > 0) {
        notificaciones.push({ tipo: "info", titulo: "Seguimiento", msj: "Hay " + countPen + " actividades planificadas para seguimiento.", fecha: hoyStr });
      }
    }

    return { exito: true, datos: notificaciones };
  } catch (e) { return { exito: false, mensaje: e.toString() }; }
}

// ==========================================
// 7. DESGLOCE MUNICIPAL
// ==========================================
function getMunicipiosPorEstado(estado) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("DesgloceMunicipal");
    if (!sheet) {
      // Si no existe, crear la hoja con cabeceras para que el usuario sepa que debe llenarla
      sheet = ss.insertSheet("DesgloceMunicipal");
      sheet.appendRow(["Estado", "Municipio"]);
      return { exito: false, mensaje: "La hoja 'DesgloceMunicipal' fue creada. Por favor, llénela con los datos correspondientes." };
    }
    
    var datos = sheet.getDataRange().getValues();
    var municipios = [];
    var estadoBusqueda = (estado || "").toString().trim().toLowerCase();
    
    for (var i = 1; i < datos.length; i++) {
      var est = (datos[i][0] || "").toString().trim().toLowerCase();
      if (est === estadoBusqueda) {
        municipios.push(datos[i][1]);
      }
    }
    
    return { exito: true, datos: municipios.sort() };
  } catch (e) {
    return { exito: false, mensaje: e.toString() };
  }
}

// ==========================================
// 7. CLASSROOM Y FORMATOS
// ==========================================
function obtenerPlantillasDrive() {
  try {
    var carpeta = DriveApp.getFolderById("1vmlH3JP3ns9nYYGBPfS6SpY7T9LY7xQ1");
    var archivos = carpeta.getFiles(), lista = [];
    while (archivos.hasNext()) { var arch = archivos.next(); lista.push({ id: arch.getId(), nombre: arch.getName(), tipo: arch.getMimeType() }); }
    return { exito: true, datos: lista };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function generarDocumentoTrabajo(idPlantilla, nombrePlantilla, estadoUsuario, nombreUsuario) {
  try {
    var carpetaDestino = DriveApp.getFolderById("1u8V99qK3E7dMl_uGQgrj4qacTA8nsRIe");
    var archivoOriginal = DriveApp.getFileById(idPlantilla);
    var nuevoNombre = "[" + estadoUsuario + "] " + nombrePlantilla + " - " + nombreUsuario + " (" + Utilities.formatDate(new Date(), "America/Caracas", "dd-MM-yyyy") + ")";
    var nuevoArchivo = archivoOriginal.makeCopy(nuevoNombre, carpetaDestino);
    nuevoArchivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    return { exito: true, url: nuevoArchivo.getUrl(), nombreCreado: nuevoNombre };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

function obtenerHistorialFormatos(rolUsuario, estadoUsuario) {
  try {
    var carpeta = DriveApp.getFolderById("1u8V99qK3E7dMl_uGQgrj4qacTA8nsRIe");
    var archivos = carpeta.getFiles(), historial = [];
    while (archivos.hasNext()) {
      var arch = archivos.next(); var nom = arch.getName();
      if ((rolUsuario === 'Responsable Estadal' || rolUsuario === 'Responsable') && nom.indexOf('[' + estadoUsuario + ']') === -1) continue;
      historial.push({ id: arch.getId(), nombre: nom, fecha: Utilities.formatDate(arch.getDateCreated(), "America/Caracas", "dd/MM/yyyy HH:mm"), url: arch.getUrl() });
    }
    return { exito: true, datos: historial.reverse() };
  } catch (error) { return { exito: false, mensaje: error.message }; }
}

// ==========================================
// 8. SISTEMA DE SOLICITUDES Y GAMIFICACIÓN
// ==========================================

// --- Helpers de hojas ---
function _getOrCreateSheet(nombre, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    if (headers && headers.length > 0) sh.appendRow(headers);
  }
  return sh;
}

// --- NIVELES CONFIG (inicialización por defecto) ---
var NIVELES_OPERADOR = [
  [1, "Aprendiz de Operador", 0],
  [2, "Operador sin Sueldo", 500],
  [3, "Operador Junior", 1200],
  [4, "Operador de Apoyo", 2200],
  [5, "Operador Base", 3500],
  [6, "Operador Pleno", 5500],
  [7, "Operador Senior", 8000],
  [8, "Operador Especialista", 11000],
  [9, "Operador Entrenador", 15000],
  [10, "Operador Supervisor", 20000],
  [11, "Sub-Líder de Operadores", 27000],
  [12, "Líder de Operadores", 35000]
];
var NIVELES_ANALISTA = [
  [1, "Pasante de Análisis", 0],
  [2, "Becario Analista", 500],
  [3, "Analista Junior", 1200],
  [4, "Analista de Calidad", 2200],
  [5, "Analista de Datos Operativos", 3500],
  [6, "Analista Pleno", 5500],
  [7, "Analista Senior", 8000],
  [8, "Analista Especialista", 11000],
  [9, "Auditor Analítico", 15000],
  [10, "Analista de Estrategia", 20000],
  [11, "Asistente de Jefe Analista", 27000],
  [12, "Jefe Analista", 35000]
];

function _inicializarHojaNiveles() {
  var sh = _getOrCreateSheet("NivelesConfig", ["Rol", "Nivel", "NombreRango", "XPRequerido"]);
  var datos = sh.getDataRange().getValues();
  if (datos.length <= 1) {
    NIVELES_OPERADOR.forEach(function(n) { sh.appendRow(["Operador", n[0], n[1], n[2]]); });
    NIVELES_ANALISTA.forEach(function(n) { sh.appendRow(["Analista", n[0], n[1], n[2]]); });
  }
  return sh;
}

function obtenerNivelesConfig() {
  try {
    _inicializarHojaNiveles();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("NivelesConfig");
    var datos = sh.getDataRange().getValues();
    var niveles = [];
    for (var i = 1; i < datos.length; i++) {
      niveles.push({ fila: i + 1, rol: datos[i][0], nivel: Number(datos[i][1]), nombre: datos[i][2], xpRequerido: Number(datos[i][3]) });
    }
    return { exito: true, datos: niveles };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function guardarNivelConfig(item) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("NivelesConfig");
    if (!sh) return { exito: false, mensaje: "Hoja NivelesConfig no encontrada." };
    if (item.fila) {
      sh.getRange(item.fila, 4).setValue(item.xpRequerido);
      sh.getRange(item.fila, 3).setValue(item.nombre);
      return { exito: true, mensaje: "Nivel actualizado." };
    }
    sh.appendRow([item.rol, item.nivel, item.nombre, item.xpRequerido]);
    return { exito: true, mensaje: "Nivel creado." };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

// --- XP USUARIO ---
function _getOrCreateUsuarioXP(usuarioLogin, rol) {
  var sh = _getOrCreateSheet("UsuarioXP", ["UsuarioLogin", "Rol", "XPTotal", "NivelActual", "RangoActual", "FechaActualizacion"]);
  var datos = sh.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === usuarioLogin) return { fila: i + 1, xp: Number(datos[i][2]) || 0, nivel: Number(datos[i][3]) || 1, rango: datos[i][4] || "" };
  }
  // Crear registro nuevo
  var rangoInicial = (rol === "Analista") ? "Becario Analista sin Sueldo" : "Aprendiz de Operador";
  sh.appendRow([usuarioLogin, rol, 0, 1, rangoInicial, Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm")]);
  return { fila: sh.getLastRow(), xp: 0, nivel: 1, rango: rangoInicial };
}

function obtenerPerfilGamificado(usuarioLogin, rol) {
  try {
    if (rol === "Responsable Estadal" || rol === "Responsable") {
      return { exito: true, tieneNiveles: false };
    }
    var perfil = _getOrCreateUsuarioXP(usuarioLogin, rol);
    var nivelesRes = obtenerNivelesConfig();
    var niveles = nivelesRes.datos.filter(function(n) { return n.rol === rol; });
    niveles.sort(function(a, b) { return a.nivel - b.nivel; });

    var nivelActual = perfil.nivel;
    var nivelMax = niveles[niveles.length - 1];
    var nivelSig = niveles.find(function(n) { return n.nivel === nivelActual + 1; });
    var nivelInfo = niveles.find(function(n) { return n.nivel === nivelActual; }) || niveles[0];

    var xpParaSig = nivelSig ? nivelSig.xpRequerido : nivelMax.xpRequerido;
    var xpNivelActual = nivelInfo ? nivelInfo.xpRequerido : 0;
    var xpEnNivel = perfil.xp - xpNivelActual;
    var xpTotalNivel = xpParaSig - xpNivelActual;
    var pct = xpTotalNivel > 0 ? Math.min(Math.round((xpEnNivel / xpTotalNivel) * 100), 100) : 100;

    // Contar solicitudes completadas
    var shProg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MisionesProgreso");
    var completadas = 0;
    if (shProg) {
      var dp = shProg.getDataRange().getValues();
      for (var i = 1; i < dp.length; i++) {
        if (dp[i][2] === usuarioLogin && dp[i][4] === "Completada") completadas++;
      }
    }

    return {
      exito: true, tieneNiveles: true,
      xpTotal: perfil.xp, nivelActual: nivelActual, rangoActual: perfil.rango,
      xpParaSig: nivelSig ? nivelSig.xpRequerido : null,
      rangoSig: nivelSig ? nivelSig.nombre : "Rango Máximo",
      pct: pct, estaEnMaximo: !nivelSig,
      completadas: completadas
    };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function otorgarXP(usuarioLogin, rol, cantidad) {
  try {
    if (rol === "Responsable Estadal" || rol === "Responsable") return { exito: true, mensaje: "Sin sistema de XP para este rol." };
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("UsuarioXP");
    if (!sh) { _getOrCreateUsuarioXP(usuarioLogin, rol); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("UsuarioXP"); }
    var datos = sh.getDataRange().getValues();
    var fila = -1;
    for (var i = 1; i < datos.length; i++) { if (datos[i][0] === usuarioLogin) { fila = i + 1; break; } }
    if (fila === -1) { _getOrCreateUsuarioXP(usuarioLogin, rol); return otorgarXP(usuarioLogin, rol, cantidad); }

    var nuevoXP = (Number(datos[fila - 1][2]) || 0) + cantidad;
    sh.getRange(fila, 3).setValue(nuevoXP);
    sh.getRange(fila, 6).setValue(Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm"));

    // Verificar ascenso de nivel
    var nivelesRes = obtenerNivelesConfig();
    var niveles = nivelesRes.datos.filter(function(n) { return n.rol === rol; });
    niveles.sort(function(a, b) { return a.nivel - b.nivel; });
    var nivelNuevo = 1; var rangoNuevo = niveles[0] ? niveles[0].nombre : "";
    for (var j = 0; j < niveles.length; j++) {
      if (nuevoXP >= niveles[j].xpRequerido) { nivelNuevo = niveles[j].nivel; rangoNuevo = niveles[j].nombre; }
    }
    var nivelAnterior = Number(datos[fila - 1][3]) || 1;
    sh.getRange(fila, 4).setValue(nivelNuevo);
    sh.getRange(fila, 5).setValue(rangoNuevo);

    var subioNivel = nivelNuevo > nivelAnterior;
    return { exito: true, xpTotal: nuevoXP, nivelNuevo: nivelNuevo, rangoNuevo: rangoNuevo, subioNivel: subioNivel };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

// --- MISIONES CRUD (Admin) ---
function crearSolicitud(datos) {
  try {
    // Estructura real de la hoja Misiones (sin Requisitos, sin Masiva, sin ParticipantesMinimos):
    // ID | FechaCreacion | CreadoPor | Titulo | Descripcion | Tipo | RolDestino | EstadoDestino
    // | XPRecompensa | FechaLimite | Activa | CantidadObjetivo | ImpactoRequerido
    // | AccionObjetivo | DiaReinicio | HoraCorte | AutoEnvio | CicloActual
    var headers = ["ID","FechaCreacion","CreadoPor","Titulo","Descripcion","Tipo","RolDestino",
                   "EstadoDestino","XPRecompensa","FechaLimite","Activa","CantidadObjetivo",
                   "ImpactoRequerido","AccionObjetivo","DiaReinicio","HoraCorte","AutoEnvio","CicloActual"];
    var sh = _getOrCreateSheet("Misiones", headers);
    var id = "SOL-" + Utilities.formatDate(new Date(), "America/Caracas", "yyyyMMdd-HHmmss");
    var fechaCreacion = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm:ss");

    // Si la hoja ya existe con datos, escribimos por header-matching para evitar desalineaciones
    var sheetHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var sheetHeadersNorm = sheetHeaders.map(function(h){ return String(h).toLowerCase().replace(/[^a-z]/g,''); });

    function colIdx(keyword) {
      var idx = sheetHeadersNorm.findIndex(function(h){ return h.indexOf(keyword) !== -1; });
      return idx; // -1 si no encontrado
    }

    var totalCols = Math.max(sheetHeaders.length, headers.length);
    var fila = new Array(totalCols).fill("");
    fila[colIdx('id') !== -1 ? colIdx('id') : 0]                          = id;
    fila[colIdx('fechacreacion') !== -1 ? colIdx('fechacreacion') : 1]     = fechaCreacion;
    fila[colIdx('creadopor') !== -1 ? colIdx('creadopor') : 2]             = datos.creadoPor;
    fila[colIdx('titulo') !== -1 ? colIdx('titulo') : 3]                   = datos.titulo;
    fila[colIdx('descripcion') !== -1 ? colIdx('descripcion') : 4]         = datos.descripcion;
    fila[colIdx('tipo') !== -1 ? colIdx('tipo') : 5]                       = datos.tipo;
    fila[colIdx('roldestino') !== -1 ? colIdx('roldestino') : 6]           = datos.rolDestino;
    fila[colIdx('estadodestino') !== -1 ? colIdx('estadodestino') : 7]     = datos.estadoDestino || "";
    fila[colIdx('xprecompensa') !== -1 ? colIdx('xprecompensa') : 8]       = Number(datos.xpRecompensa) || 50;
    fila[colIdx('fechalimite') !== -1 ? colIdx('fechalimite') : 9]         = datos.fechaLimite || "";
    fila[colIdx('activa') !== -1 ? colIdx('activa') : 10]                  = true;
    fila[colIdx('cantidadobjetivo') !== -1 ? colIdx('cantidadobjetivo') : 11] = Number(datos.cantidadObjetivo) || 0;
    fila[colIdx('impactorequerido') !== -1 ? colIdx('impactorequerido') : 12] = datos.impactoRequerido || "";
    fila[colIdx('accionobjetivo') !== -1 ? colIdx('accionobjetivo') : 13]  = datos.accionObjetivo || "";
    fila[colIdx('diareinicio') !== -1 ? colIdx('diareinicio') : 14]        = datos.diaReinicio || "";
    fila[colIdx('horacorte') !== -1 ? colIdx('horacorte') : 15]            = datos.horaCorte || "";
    fila[colIdx('autoenvio') !== -1 ? colIdx('autoenvio') : 16]            = datos.autoEnvio === true;
    fila[colIdx('cicloactual') !== -1 ? colIdx('cicloactual') : 17]        = 1;

    sh.appendRow(fila);
    registrarAuditoria(datos.creadoPor, "Admin", "Cre\u00f3 Solicitud", id + " \u2192 " + datos.rolDestino);
    return { exito: true, mensaje: "Solicitud creada correctamente.", id: id };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function _getMisionesHeaders(sh) {
  // Devuelve array de headers normalizados (solo letras minúsculas) para búsqueda parcial
  var rawHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return rawHeaders.map(function(h){ return String(h).toLowerCase().replace(/[^a-z]/g, ''); });
}

function _findColIdx(normHeaders, keyword, fallback) {
  var idx = -1;
  for (var i = 0; i < normHeaders.length; i++) {
    if (normHeaders[i].indexOf(keyword) !== -1) { idx = i; break; }
  }
  return idx !== -1 ? idx : fallback;
}

function _safeDateString(val, format) {
  if (val == null || val === "") return "";
  if (Object.prototype.toString.call(val) === '[object Date]') {
    try {
      return Utilities.formatDate(val, "America/Caracas", format || "dd/MM/yyyy HH:mm:ss");
    } catch(e) { return String(val); }
  }
  return String(val);
}

function obtenerSolicitudes() {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Misiones");
    if (!sh) return { exito: true, datos: [] };
    var datos = sh.getDataRange().getValues();
    if (datos.length <= 1) return { exito: true, datos: [] };

    // Detectar posición de cada columna por nombre parcial (tolerante a variaciones del header)
    var hdr = _getMisionesHeaders(sh);
    var idxActiva   = _findColIdx(hdr, 'activa',            10);
    var idxCantidad = _findColIdx(hdr, 'cantidadobjetivo',  idxActiva + 1);
    var idxImpacto  = _findColIdx(hdr, 'impactorequerido',  idxActiva + 2);
    var idxAccion   = _findColIdx(hdr, 'accionobjetivo',    idxActiva + 3);
    var idxDiaRein  = _findColIdx(hdr, 'diareinicio',       idxActiva + 4);
    var idxHoraCor  = _findColIdx(hdr, 'horacorte',         idxActiva + 5);
    var idxAutoEnv  = _findColIdx(hdr, 'autoenvio',         idxActiva + 6);
    var idxCiclo    = _findColIdx(hdr, 'cicloactual',       idxActiva + 7);

    var lista = [];
    for (var i = 1; i < datos.length; i++) {
      var activa = datos[i][idxActiva];
      // Omitir filas vacías o inactivas
      if (!datos[i][0]) continue;
      var activaStr = String(activa).trim().toUpperCase();
      if (activaStr === 'FALSE' || activaStr === '0' || activaStr === 'NO' || activa === false) continue;
      lista.push({
        fila: i + 1,
        id: String(datos[i][0]),
        fechaCreacion: _safeDateString(datos[i][1], "dd/MM/yyyy HH:mm:ss"),
        creadoPor: String(datos[i][2] || ''),
        titulo: String(datos[i][3] || ''),
        descripcion: String(datos[i][4] || ''),
        tipo: String(datos[i][5] || ''),
        rolDestino: String(datos[i][6] || '').trim(),
        estadoDestino: String(datos[i][7] || '').trim(),
        xpRecompensa: Number(datos[i][8]) || 50,
        fechaLimite: _safeDateString(datos[i][9], "yyyy-MM-dd").trim(),
        cantidadObjetivo: Number(datos[i][idxCantidad]) || 0,
        impactoRequerido: String(datos[i][idxImpacto] || '').trim(),
        accionObjetivo: String(datos[i][idxAccion] || '').trim(),
        diaReinicio: String(datos[i][idxDiaRein] || '').trim(),
        horaCorte: _safeDateString(datos[i][idxHoraCor], "HH:mm").trim(),
        autoEnvio: datos[i][idxAutoEnv] === true || String(datos[i][idxAutoEnv]).toUpperCase() === 'TRUE',
        cicloActual: Number(datos[i][idxCiclo]) || 1
      });
    }
    return { exito: true, datos: lista };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function eliminarSolicitud(fila) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Misiones");
    if (!sh) return { exito: false, mensaje: "Hoja no encontrada." };
    // Detectar columna Activa dinámicamente
    var hdr = _getMisionesHeaders(sh);
    var idxActiva = _findColIdx(hdr, 'activa', 10);
    sh.getRange(fila, idxActiva + 1).setValue(false); // +1 porque getRange es 1-indexed
    return { exito: true, mensaje: "Solicitud desactivada." };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}


// --- PROGRESO USUARIO ---
function obtenerMisSolicitudes(usuarioLogin, rol, estadoUsr) {
  try {
    var solRes = obtenerSolicitudes();
    if (!solRes.exito) return solRes;
    var todas = solRes.datos;
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var estadoNorm = String(estadoUsr || "").trim();

    // BUG FIX: Corrección de precedencia de operadores en filtro de rol
    var misiones = todas.filter(function(s) {
      var rd = String(s.rolDestino || "").trim();
      var rolOk = (rd === "Todos" || rd === rol ||
                   (rd === "Responsable Estadal" && (rol === "Responsable" || rol === "Responsable Estadal")) ||
                   (rd === "Responsable" && (rol === "Responsable" || rol === "Responsable Estadal")));
      var ed = String(s.estadoDestino || "").trim();
      var estadoOk = (ed === "" || !ed || ed === estadoNorm);
      return rolOk && estadoOk;
    });

    // Obtener progreso del usuario
    var shProg = _getOrCreateSheet("MisionesProgreso", ["ID","MisionID","UsuarioLogin","FechaInicio","Estatus","XPOtorgado","FechaEntrega","RevisadoPor","NotasRevisor","FechaRevision","RolUsuario"]);
    var dp = shProg.getDataRange().getValues();
    var progresoMap = {};
    for (var i = 1; i < dp.length; i++) {
      if (String(dp[i][2]) === usuarioLogin) {
        progresoMap[String(dp[i][1])] = { estatus: String(dp[i][4] || ''), xpOtorgado: dp[i][5], fechaEntrega: _safeDateString(dp[i][6], "dd/MM/yyyy HH:mm:ss") };
      }
    }

    // Ensamblar resultado con progreso automático
    var shAct = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Actividades");
    var datosAct = shAct ? shAct.getDataRange().getValues() : [];

    var resultado = misiones.map(function(s) {
      var prog = progresoMap[s.id] || null;
      var estatus = "Pendiente";
      if (prog) estatus = prog.estatus;
      else if (s.fechaLimite) {
        var fl = new Date(s.fechaLimite + "T23:59:59");
        if (fl < hoy) estatus = "Vencida";
      }

      // Calcular progreso automático si tiene cantidad objetivo
      var progresoAuto = null;
      if (s.cantidadObjetivo > 0 && (estatus === "Pendiente" || estatus === "En Progreso")) {
        progresoAuto = calcularProgresoAutomatico(s, usuarioLogin, estadoNorm, datosAct);
        if (progresoAuto.cumplida && estatus === "Pendiente" && !prog) estatus = "En Progreso";
      }

      return Object.assign({}, s, { estatus: estatus, progreso: prog, progresoAuto: progresoAuto });
    });

    return { exito: true, datos: resultado };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

// Calcula cuántas veces un usuario ya cumplió los criterios de una solicitud contando en la BD
function calcularProgresoAutomatico(solicitud, usuarioLogin, estadoUsr, datosAct) {
  var completadas = 0;
  var objetivo = solicitud.cantidadObjetivo || 0;
  var accion = (solicitud.accionObjetivo || "").toLowerCase();
  var impactoReq = (solicitud.impactoRequerido || "").toLowerCase();
  var partMin = Number(solicitud.participantesMinimos) || 0;

  // Fecha de creación de la solicitud como fecha de inicio de conteo
  var fechaInicio = null;
  try {
    if (solicitud.fechaCreacion) {
      var partesFecha = String(solicitud.fechaCreacion).split(' ')[0].split('/');
      if (partesFecha.length === 3) fechaInicio = new Date(partesFecha[2], partesFecha[1]-1, partesFecha[0]);
    }
  } catch(e) {}

  for (var i = 1; i < datosAct.length; i++) {
    var filUsr = String(datosAct[i][2] || "").toLowerCase();
    var filEst = String(datosAct[i][5] || "").toLowerCase();
    var filEstatus = String(datosAct[i][3] || "").toLowerCase();
    var filImpacto = String(datosAct[i][18] || datosAct[i][19] || "").toLowerCase();
    var filPart = Number(datosAct[i][22] || datosAct[i][29] || 0);
    var filFecha = datosAct[i][1]; // Fecha de creación registro

    // Filtro de usuario (responsable por estado)
    var perteneceUsr = (filUsr === usuarioLogin.toLowerCase()) || (estadoUsr && filEst === estadoUsr.toLowerCase());
    if (!perteneceUsr) continue;

    // Filtro de fecha: solo contar desde la creación de la solicitud
    if (fechaInicio && filFecha) {
      try {
        var fReg = new Date(filFecha);
        if (fReg < fechaInicio) continue;
      } catch(e) {}
    }

    // Filtro de impacto
    if (impactoReq && impactoReq !== "" && filImpacto.indexOf(impactoReq) === -1) continue;

    // Filtro de participantes mínimos
    if (partMin > 0 && filPart < partMin) continue;

    // Filtro de acción
    if (accion === "planificar") {
      if (filEstatus.indexOf("planificada") === -1 && filEstatus.indexOf("reportado") === -1 && filEstatus.indexOf("validada") === -1) continue;
    } else if (accion === "reportar") {
      if (filEstatus.indexOf("reportado") === -1 && filEstatus.indexOf("validada") === -1) continue;
    } else if (accion === "validar") {
      if (filEstatus.indexOf("validada") === -1) continue;
    }

    completadas++;
  }

  var pct = objetivo > 0 ? Math.min(Math.round((completadas / objetivo) * 100), 100) : 0;
  return { completadas: completadas, objetivo: objetivo, porcentaje: pct, cumplida: completadas >= objetivo };
}


function entregarSolicitud(solicitudId, usuarioLogin, rol) {
  try {
    var shProg = _getOrCreateSheet("MisionesProgreso", ["ID","MisionID","UsuarioLogin","FechaInicio","Estatus","XPOtorgado","FechaEntrega","RevisadoPor","NotasRevisor","FechaRevision","RolUsuario"]);
    var dp = shProg.getDataRange().getValues();
    var filaExist = -1;
    for (var i = 1; i < dp.length; i++) {
      if (String(dp[i][1]) === solicitudId && String(dp[i][2]) === usuarioLogin) { filaExist = i + 1; break; }
    }

    var solRes = obtenerSolicitudes();
    var solicitud = null;
    if (solRes.exito) solicitud = solRes.datos.find(function(s) { return s.id === solicitudId; });
    var xpRecompensa = solicitud ? solicitud.xpRecompensa : 50;
    var tituloSol = solicitud ? solicitud.titulo : solicitudId;
    var fechaEntrega = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm");

    // FASE 2: XP NO se otorga hasta aprobación — estado = Pendiente Revisión
    if (filaExist !== -1) {
      shProg.getRange(filaExist, 5).setValue("Pendiente Revisión");
      shProg.getRange(filaExist, 7).setValue(fechaEntrega);
    } else {
      var progId = "PROG-" + Utilities.formatDate(new Date(), "America/Caracas", "yyyyMMdd-HHmmss");
      shProg.appendRow([progId, solicitudId, usuarioLogin, fechaEntrega, "Pendiente Revisión", xpRecompensa, fechaEntrega, "", "", "", rol]);
    }
    registrarAuditoria(usuarioLogin, rol, "Entregó Solicitud", tituloSol);
    return { exito: true, mensaje: "Solicitud entregada. Pendiente de revisión por un Analista o Admin.", xpPendiente: xpRecompensa };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

// --- REVISIÓN (FASE 2) ---
function obtenerEntregasPendientes(rolRevisor, usuarioRevisor) {
  try {
    var shProg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MisionesProgreso");
    if (!shProg) return { exito: true, datos: [] };
    var dp = shProg.getDataRange().getValues();
    var solRes = obtenerSolicitudes();
    var solMap = {};
    if (solRes.exito) solRes.datos.forEach(function(s) { solMap[s.id] = s; });

    var lista = [];
    for (var i = 1; i < dp.length; i++) {
      var estatus = String(dp[i][4] || "");
      if (estatus !== "Pendiente Revisión" && estatus !== "Aprobada" && estatus !== "Rechazada") continue;
      var rolUsr = String(dp[i][10] || "");
      // Jerarquía: Analista solo revisa Operadores y Responsables; Admin revisa todo
      if (rolRevisor === "Analista") {
        if (rolUsr !== "Operador" && rolUsr !== "Responsable Estadal" && rolUsr !== "Responsable") continue;
      }
      var sol = solMap[String(dp[i][1])] || {};
      lista.push({
        progresoId: String(dp[i][0]),
        misionId: String(dp[i][1]),
        usuarioLogin: String(dp[i][2]),
        fechaEntrega: _safeDateString(dp[i][6], "dd/MM/yyyy HH:mm"),
        estatus: estatus,
        xpRecompensa: Number(dp[i][5]) || 50,
        revisadoPor: String(dp[i][7] || ""),
        notasRevisor: String(dp[i][8] || ""),
        fechaRevision: _safeDateString(dp[i][9], "dd/MM/yyyy HH:mm"),
        rolUsuario: rolUsr,
        tituloSolicitud: sol.titulo || String(dp[i][1]),
        tipoSolicitud: sol.tipo || "",
        fila: i + 1
      });
    }
    lista.sort(function(a,b) { return (a.estatus === 'Pendiente Revisión' ? 0 : 1) - (b.estatus === 'Pendiente Revisión' ? 0 : 1); });
    return { exito: true, datos: lista };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function aprobarSolicitud(progresoId, revisor, notas) {
  try {
    var shProg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MisionesProgreso");
    if (!shProg) return { exito: false, mensaje: "Hoja de progreso no encontrada." };
    var dp = shProg.getDataRange().getValues();
    var fila = -1; var usuarioLogin = ""; var rol = ""; var xpRecompensa = 0;
    for (var i = 1; i < dp.length; i++) {
      if (String(dp[i][0]) === progresoId) { fila = i + 1; usuarioLogin = String(dp[i][2]); rol = String(dp[i][10]); xpRecompensa = Number(dp[i][5]) || 50; break; }
    }
    if (fila === -1) return { exito: false, mensaje: "Registro no encontrado." };
    var fechaRev = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm");
    shProg.getRange(fila, 5).setValue("Aprobada");
    shProg.getRange(fila, 8).setValue(revisor);
    shProg.getRange(fila, 9).setValue(notas || "");
    shProg.getRange(fila, 10).setValue(fechaRev);
    // Otorgar XP ahora que fue aprobada
    var xpRes = otorgarXP(usuarioLogin, rol, xpRecompensa);
    registrarAuditoria(revisor, "Revisor", "Aprobó Solicitud", progresoId + " → " + usuarioLogin);
    var msg = "Aprobada. " + xpRecompensa + " XP otorgados a " + usuarioLogin;
    if (xpRes.subioNivel) msg += " (¡Subió a " + xpRes.rangoNuevo + "!)";
    return { exito: true, mensaje: msg };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

function rechazarSolicitud(progresoId, revisor, notas) {
  try {
    var shProg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MisionesProgreso");
    if (!shProg) return { exito: false, mensaje: "Hoja de progreso no encontrada." };
    var dp = shProg.getDataRange().getValues();
    var fila = -1;
    for (var i = 1; i < dp.length; i++) {
      if (String(dp[i][0]) === progresoId) { fila = i + 1; break; }
    }
    if (fila === -1) return { exito: false, mensaje: "Registro no encontrado." };
    var fechaRev = Utilities.formatDate(new Date(), "America/Caracas", "dd/MM/yyyy HH:mm");
    shProg.getRange(fila, 5).setValue("Rechazada");
    shProg.getRange(fila, 8).setValue(revisor);
    shProg.getRange(fila, 9).setValue(notas || "");
    shProg.getRange(fila, 10).setValue(fechaRev);
    // No se otorga XP
    registrarAuditoria(revisor, "Revisor", "Rechazó Solicitud", progresoId);
    return { exito: true, mensaje: "Solicitud rechazada. No se otorgó XP." };
  } catch(e) { return { exito: false, mensaje: e.toString() }; }
}

// --- AUTO-REGENERACIÓN INTELIGENTE (trigger diario ~00:00) ---
function regenerarSolicitudesRecurrentes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shMis = ss.getSheetByName("Misiones");
    if (!shMis) return;
    var datosMis = shMis.getDataRange().getValues();
    var shProg = _getOrCreateSheet("MisionesProgreso", ["ID","MisionID","UsuarioLogin","FechaInicio","Estatus","XPOtorgado","FechaEntrega","RevisadoPor","NotasRevisor","FechaRevision","RolUsuario"]);
    var shAct = ss.getSheetByName("Actividades");
    var shUsr = ss.getSheetByName("Usuarios");
    var datosAct = shAct ? shAct.getDataRange().getValues() : [];
    var datosUsr = shUsr ? shUsr.getDataRange().getValues() : [];
    var ahora = new Date();
    var diaSemana = ahora.getDay(); // 0=Dom, 1=Lun...5=Vie, 6=Sab
    var horaActual = ahora.getHours() + ahora.getMinutes() / 60;
    var fechaHoy = Utilities.formatDate(ahora, "America/Caracas", "dd/MM/yyyy");

    // Construir mapa de usuarios por rol
    var usuariosPorRol = {};
    for (var u = 1; u < datosUsr.length; u++) {
      var rolU = String(datosUsr[u][2] || ""); var loginU = String(datosUsr[u][4] || ""); var estU = String(datosUsr[u][3] || "");
      if (!usuariosPorRol[rolU]) usuariosPorRol[rolU] = [];
      usuariosPorRol[rolU].push({ login: loginU, estado: estU });
    }

    for (var i = 1; i < datosMis.length; i++) {
      // Usar detección por cabecera para columnas variables
      var misHeader = datosMis[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var _idxActiva  = misHeader.indexOf('activa')        !== -1 ? misHeader.indexOf('activa')        : 11;
      var _idxDiaRein = misHeader.indexOf('diareinicio')   !== -1 ? misHeader.indexOf('diareinicio')   : (_idxActiva + 5);
      var _idxHoraCor = misHeader.indexOf('horacorte')     !== -1 ? misHeader.indexOf('horacorte')     : (_idxActiva + 6);
      var _idxAutoEnv = misHeader.indexOf('autoenvio')     !== -1 ? misHeader.indexOf('autoenvio')     : (_idxActiva + 7);
      var _idxCiclo   = misHeader.indexOf('cicloactual')   !== -1 ? misHeader.indexOf('cicloactual')   : (_idxActiva + 8);
      var _idxCantObj = misHeader.indexOf('cantidadobjetivo') !== -1 ? misHeader.indexOf('cantidadobjetivo') : (_idxActiva + 1);
      var _idxImpacto = misHeader.indexOf('impactorequerido') !== -1 ? misHeader.indexOf('impactorequerido') : (_idxActiva + 2);
      var _idxPartMin = misHeader.indexOf('participantesminimos') !== -1 ? misHeader.indexOf('participantesminimos') : (_idxActiva + 3);
      var _idxAccion  = misHeader.indexOf('accionobjetivo')   !== -1 ? misHeader.indexOf('accionobjetivo')   : (_idxActiva + 4);
      break; // Solo necesitamos leerlo una vez
    }
    // Reinicializar variables de cabecera
    var misHeader = datosMis[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var _idxActiva  = misHeader.indexOf('activa')        !== -1 ? misHeader.indexOf('activa')        : 11;
    var _idxDiaRein = misHeader.indexOf('diareinicio')   !== -1 ? misHeader.indexOf('diareinicio')   : (_idxActiva + 5);
    var _idxHoraCor = misHeader.indexOf('horacorte')     !== -1 ? misHeader.indexOf('horacorte')     : (_idxActiva + 6);
    var _idxAutoEnv = misHeader.indexOf('autoenvio')     !== -1 ? misHeader.indexOf('autoenvio')     : (_idxActiva + 7);
    var _idxCiclo   = misHeader.indexOf('cicloactual')   !== -1 ? misHeader.indexOf('cicloactual')   : (_idxActiva + 8);
    var _idxCantObj = misHeader.indexOf('cantidadobjetivo') !== -1 ? misHeader.indexOf('cantidadobjetivo') : (_idxActiva + 1);
    var _idxImpacto = misHeader.indexOf('impactorequerido') !== -1 ? misHeader.indexOf('impactorequerido') : (_idxActiva + 2);
    var _idxPartMin = misHeader.indexOf('participantesminimos') !== -1 ? misHeader.indexOf('participantesminimos') : (_idxActiva + 3);
    var _idxAccion  = misHeader.indexOf('accionobjetivo')   !== -1 ? misHeader.indexOf('accionobjetivo')   : (_idxActiva + 4);

    for (var i = 1; i < datosMis.length; i++) {
      var activa = datosMis[i][_idxActiva];
      if (!activa || activa === 'FALSE' || activa === false) continue;
      var tipo = String(datosMis[i][5] || '');
      if (tipo !== 'Diaria' && tipo !== 'Semanal') continue;

      var misionId = String(datosMis[i][0]);
      var diaReinicio = String(datosMis[i][_idxDiaRein] || '');
      var horaCorte = String(datosMis[i][_idxHoraCor] || '');
      var autoEnvio = datosMis[i][_idxAutoEnv] === true || datosMis[i][_idxAutoEnv] === 'TRUE';
      var rolDestino = String(datosMis[i][6] || 'Todos');
      var estadoDest = String(datosMis[i][7] || '');
      var cicloActual = Number(datosMis[i][_idxCiclo]) || 1;
      var xpRecompensa = Number(datosMis[i][8]) || 50;
      var cantidadObj = Number(datosMis[i][_idxCantObj]) || 0;
      var impactoReq = String(datosMis[i][_idxImpacto] || '');
      var partMin = Number(datosMis[i][_idxPartMin]) || 0;
      var accionObj = String(datosMis[i][_idxAccion] || '');

      // Determinar si es momento de reinicio
      var esReinicio = false;
      var horaCorteNum = 0;
      if (horaCorte) { var hParts = horaCorte.split(':'); horaCorteNum = Number(hParts[0]) + (Number(hParts[1]||0)/60); }
      if (tipo === "Diaria") { esReinicio = horaActual >= horaCorteNum; }
      if (tipo === "Semanal" && diaReinicio !== "") { esReinicio = (diaSemana === Number(diaReinicio)) && (horaActual >= horaCorteNum); }

      if (!esReinicio) continue;

      // Obtener usuarios destino
      var usrDestino = [];
      if (rolDestino === "Todos") { for (var r in usuariosPorRol) usrDestino = usrDestino.concat(usuariosPorRol[r]); }
      else { usrDestino = usuariosPorRol[rolDestino] || []; }
      if (estadoDest) usrDestino = usrDestino.filter(function(u) { return u.estado === estadoDest; });

      var dpActual = shProg.getDataRange().getValues();

      for (var j = 0; j < usrDestino.length; j++) {
        var usr = usrDestino[j];
        // Buscar progreso actual del ciclo
        var filaProgreso = -1;
        for (var k = 1; k < dpActual.length; k++) {
          if (String(dpActual[k][1]) === misionId && String(dpActual[k][2]) === usr.login && Number(dpActual[k][11]||1) === cicloActual) { filaProgreso = k + 1; break; }
        }

        // Calcular si cumplió el objetivo
        var cumplioObjetivo = true;
        var progresoActual = { completadas: 0, objetivo: cantidadObj, porcentaje: 0, cumplida: false };
        if (cantidadObj > 0) {
          var solicObj = { cantidadObjetivo: cantidadObj, impactoRequerido: impactoReq, participantesMinimos: partMin, accionObjetivo: accionObj, fechaCreacion: datosMis[i][1] };
          progresoActual = calcularProgresoAutomatico(solicObj, usr.login, usr.estado, datosAct);
          cumplioObjetivo = progresoActual.cumplida;
        } else {
          // Sin contador: solo se cumple si entregó manualmente
          if (filaProgreso !== -1) {
            var estProg = String(dpActual[filaProgreso-1][4] || "");
            cumplioObjetivo = (estProg === "Pendiente Revisión" || estProg === "Aprobada");
          } else { cumplioObjetivo = false; }
        }

        // Auto-envío si activado y cumplió objetivo
        if (autoEnvio && cumplioObjetivo) {
          if (filaProgreso === -1) {
            var newProgId = "PROG-" + Utilities.formatDate(ahora, "America/Caracas", "yyyyMMdd-HHmmss") + "-" + j;
            shProg.appendRow([newProgId, misionId, usr.login, fechaHoy, "Pendiente Revisión", xpRecompensa, fechaHoy, "", "Auto-envío", "", rolDestino, cicloActual]);
          } else {
            var estAct = String(dpActual[filaProgreso-1][4]);
            if (estAct === "Pendiente" || estAct === "") {
              shProg.getRange(filaProgreso, 5).setValue("Pendiente Revisión");
              shProg.getRange(filaProgreso, 7).setValue(fechaHoy);
              shProg.getRange(filaProgreso, 9).setValue("Auto-envío");
            }
          }
        }

        // Marcar incumplimiento si no cumplió
        if (!cumplioObjetivo) {
          var msgInc = "[INCUMPLIMIENTO] Solicitud '" + String(datosMis[i][3]) + "' no completada por " + usr.login;
          // Notificar a admins y analistas
          var shNot = ss.getSheetByName("Usuarios");
          if (shNot) {
            var dU = shNot.getDataRange().getValues();
            for (var na = 1; na < dU.length; na++) {
              if (dU[na][2] === "Admin" || dU[na][2] === "Analista") {
                try { MailApp.sendEmail({ to: dU[na][1], subject: "⚠️ Incumplimiento de Solicitud", body: msgInc }); } catch(e) {}
              }
            }
          }
        }

        // Archivar ciclo actual y crear nuevo ciclo limpio
        if (filaProgreso !== -1) {
          // Marcar con el ciclo y estatus final
          shProg.getRange(filaProgreso, 12).setValue(cicloActual);
          var estatusFinal = cumplioObjetivo ? "Completado (Ciclo " + cicloActual + ")" : "Incumplido (Ciclo " + cicloActual + ")";
          var estCurrent = String(dpActual[filaProgreso-1][4]);
          if (estCurrent !== "Aprobada" && estCurrent !== "Rechazada") {
            shProg.getRange(filaProgreso, 5).setValue(estatusFinal);
          }
        }
      }

      // Incrementar ciclo en la hoja Misiones
      shMis.getRange(i + 1, _idxCiclo + 1).setValue(cicloActual + 1);
    }
  } catch(e) { Logger.log("regenerarSolicitudesRecurrentes error: " + e.toString()); }
}


function instalarTriggerMisiones() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "regenerarSolicitudesRecurrentes") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("regenerarSolicitudesRecurrentes").timeBased().everyDays(1).atHour(0).create();
}

// ==========================================
// 12. DIRECTORIO Y 2FA
// ==========================================

function registrar2FA(usuario, idExtension) {
  try {
    registrarAuditoria(usuario, "Operador", "Inicio Sesión 2FA", "Extensión asignada: " + idExtension);
    
    // Actualizar en el directorio si existe
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName("Directorio");
    if (hoja) {
      var datos = hoja.getDataRange().getValues();
      for (var i = 1; i < datos.length; i++) {
        if (datos[i][4] === usuario) {
          hoja.getRange(i + 1, 6).setValue(idExtension); // Columna F (Extensión Actual)
          hoja.getRange(i + 1, 7).setValue(new Date());  // Columna G (Última Conexión)
          break;
        }
      }
    }
    return { exito: true };
  } catch(e) {
    return { exito: false, mensaje: e.toString() };
  }
}

function actualizarDirectorio(usuarioObj) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName("Directorio");
    if (!hoja) return;
    
    // Buscar datos completos en hoja Usuarios
    var hUsr = ss.getSheetByName("Usuarios");
    if (!hUsr) return;
    var dUsr = hUsr.getDataRange().getValues();
    var uData = null;
    for (var i = 1; i < dUsr.length; i++) {
      if (dUsr[i][4] === usuarioObj.usuario) {
        uData = { nombre: dUsr[i][0], tlf: dUsr[i][6] || '', correo: dUsr[i][7] || '' };
        break;
      }
    }
    if (!uData) return;
    
    var datos = hoja.getDataRange().getValues();
    var existe = false;
    for (var j = 1; j < datos.length; j++) {
      if (datos[j][4] === usuarioObj.usuario) { // Col E = Login
        hoja.getRange(j + 1, 1).setValue(uData.nombre);
        hoja.getRange(j + 1, 2).setValue(usuarioObj.rol);
        hoja.getRange(j + 1, 3).setValue(uData.tlf);
        hoja.getRange(j + 1, 4).setValue(uData.correo);
        hoja.getRange(j + 1, 5).setValue(usuarioObj.usuario);
        hoja.getRange(j + 1, 7).setValue(new Date());
        existe = true;
        break;
      }
    }
    if (!existe) {
      // Header esperado: Nombre | Rol | Teléfono | Correo | Usuario(Login) | Extensión | Última Conexión
      if (datos.length === 1 && datos[0][0] === "") {
        hoja.getRange(1, 1, 1, 7).setValues([["Nombre", "Rol", "Teléfono", "Correo", "Usuario", "Extensión", "Última Conexión"]]);
      }
      hoja.appendRow([uData.nombre, usuarioObj.rol, uData.tlf, uData.correo, usuarioObj.usuario, "", new Date()]);
    }
  } catch(e) {
    Logger.log("Error en actualizarDirectorio: " + e.message);
  }
}