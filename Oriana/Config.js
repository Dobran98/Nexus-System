/**
 * ======================================================================
 * ORIANA — SISTEMA DE GESTIÓN
 * Backend: Configuración, Cache y Acceso a Reglas/Áreas (Config.js)
 * ======================================================================
 */

// ─── CONFIGURACIÓN GLOBAL ─────────────────────────────────────────────────────
const NOMBRE_HOJA_REGISTROS  = "BD_Registros";
const NOMBRE_HOJA_USUARIOS   = "Usuarios";
const NOMBRE_HOJA_CONFIG     = "Configuracion";
const NOMBRE_HOJA_AUDITORIA  = "LOGS_AUDITORIA";
const NOMBRE_HOJA_COLA       = "COLA_TELEGRAM";
const NOMBRE_HOJA_AREAS      = "Areas_Trabajo";
const NOMBRE_HOJA_REGLAS     = "Reglas_Acceso";
const NOMBRE_HOJA_VARIABLES  = "Config_Variables";
const NOMBRE_HOJA_EMOJIS        = "Config_Emojis";
const NOMBRE_HOJA_DESTINATARIOS = "Config_Reportes";
const NOMBRE_HOJA_INDICADORES   = "Config_Indicadores";
const ID_HOJA_CROSS          = "14UCgTpVC4Y6MhdhJPQqgUgfADcMuufjpAcQPPtRzXWQ";
const CHAT_ID_TELEGRAM       = "-1003081975085";
const NOMBRE_PROP_TOKEN      = "TELEGRAM_BOT_TOKEN";
const NOMBRE_PROP_TOKEN_BALANCE = "TELEGRAM_BOT_TOKEN_BALANCE";

// Hora local (zona del script) de los reportes programados consolidados
const HORA_REPORTE_DIARIO   = 18;   // 18:00
const HORA_REPORTE_SEMANAL  = 18;   // 18:00

// ─── HELPERS DE ACCESO ────────────────────────────────────────────────────────

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  return (id && id !== "")
    ? SpreadsheetApp.openById(id)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Devuelve una hoja existente, o la crea con cabeceras si se especifican. */
function getOrCreateSheet(ss, nombre, cabeceras) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    if (cabeceras && cabeceras.length) hoja.appendRow(cabeceras);
  }
  return hoja;
}

/** Token de Telegram (bot operativo) desde PropertiesService. */
function getTelegramToken() {
  const token = PropertiesService.getScriptProperties().getProperty(NOMBRE_PROP_TOKEN);
  if (!token) throw new Error("Token de Telegram no configurado. Ejecute setupTelegramToken().");
  return token;
}

/** Token del bot de balances/interactivo (bot aparte) desde PropertiesService. */
function getTelegramTokenBalance() {
  const token = PropertiesService.getScriptProperties().getProperty(NOMBRE_PROP_TOKEN_BALANCE);
  if (!token) throw new Error("Token del bot de balances no configurado. Péguelo en Configuración → Bot Interactivo.");
  return token;
}

/** Guarda el token del bot de balances/interactivo, validándolo contra Telegram. */
function guardarTokenBalance(token) {
  const t = String(token || "").trim();
  if (!t) {
    PropertiesService.getScriptProperties().setProperty(NOMBRE_PROP_TOKEN_BALANCE, "");
    return { success: false, message: "Token vacío." };
  }
  // Validación de formato: <id>:<clave>  (ej. 123456789:AA...)
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(t)) {
    return { success: false, message: "Formato de token incorrecto (" + t.length + " caracteres). Debe verse como '123456789:AA...'. Copie el token COMPLETO de @BotFather." };
  }
  const me = getMeTelegram(t);
  if (!me || !me.ok) {
    return { success: false, message: "Token inválido o revocado. Cree un bot nuevo en @BotFather y copie su token completo." };
  }
  PropertiesService.getScriptProperties().setProperty(NOMBRE_PROP_TOKEN_BALANCE, t);
  const botNombre = (me.result && (me.result.username || me.result.first_name)) || "";
  return { success: true, message: "Token guardado correctamente" + (botNombre ? " (@" + botNombre + ")" : "") + "." };
}

/** Devuelve el token del bot de balances guardado (vacío si no hay). */
function obtenerTokenBalanceGuardado() {
  return PropertiesService.getScriptProperties().getProperty(NOMBRE_PROP_TOKEN_BALANCE) || "";
}

// ─── CACHE LAYER: MEJORA DE FLUIDEZ ───────────────────────────────────────────

/**
 * Obtiene los datos de la hoja Usuarios, usando CacheService.
 * Duración: 30 minutos (1800 segundos).
 */
function obtenerDatosUsuariosCached() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "USUARIOS_DATA_ROWS";
  const cached = cache.get(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Error al parsear usuarios en caché: " + e);
    }
  }
  
  const ss = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_USUARIOS);
  if (!hoja) return [];
  
  const data = hoja.getDataRange().getValues();
  try {
    cache.put(cacheKey, JSON.stringify(data), 1800);
  } catch (e) {
    console.error("Error al guardar usuarios en caché: " + e);
  }
  
  return data;
}

/**
 * Invalida la caché de usuarios.
 */
function invalidarCacheUsuarios() {
  try {
    CacheService.getScriptCache().remove("USUARIOS_DATA_ROWS");
  } catch (e) {
    console.error("Error al invalidar caché de usuarios: " + e);
  }
}

/**
 * Obtiene la configuración vinculada, usando CacheService.
 * Duración: 1 hora (3600 segundos).
 */
function obtenerConfiguracionVinculada() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "CONFIGURACION_VINCULADA";
  const cached = cache.get(cacheKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Error al parsear config en caché: " + e);
    }
  }
  
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_CONFIG);
  if (!hoja) return {};

  const datos  = hoja.getDataRange().getValues();
  const config = {};

  for (let i = 1; i < datos.length; i++) {
    const modo    = String(datos[i][0]).trim();
    const campStr = datos[i][1] ? String(datos[i][1]) : "";
    if (modo !== "") {
      config[modo] = campStr.trim() === ""
        ? []
        : campStr.split(",").map(c => c.trim()).filter(c => c !== "");
    }
  }
  
  try {
    cache.put(cacheKey, JSON.stringify(config), 3600);
  } catch (e) {
    console.error("Error al guardar config en caché: " + e);
  }
  
  return config;
}

/**
 * Guarda una nueva configuración de campaña e invalida la caché de configuración.
 */
function guardarNuevaConfiguracion(modo, texto) {
  const ss   = getSpreadsheet();
  const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_CONFIG, ["Modo", "Campaña"]);

  const datos   = hoja.getDataRange().getValues();
  const mBusca  = String(modo).trim().toLowerCase();
  let fila      = -1;

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toLowerCase() === mBusca) { fila = i + 1; break; }
  }

  try {
    if (fila > 0) hoja.getRange(fila, 2).setValue(texto);
    else          hoja.appendRow([modo, texto]);
    
    // Invalidar caché de configuraciones vinculadas
    try {
      CacheService.getScriptCache().remove("CONFIGURACION_VINCULADA");
    } catch (ex) {
      console.error("Error al limpiar caché de configuración: " + ex);
    }
    
    return { success: true, message: "Configuración guardada." };
  } catch (e) {
    return { success: false, message: "Error: " + e };
  }
}

// ─── VARIABLES DE EVALUACIÓN (CUANTITATIVAS POR MODO) ─────────────────────────

/**
 * Normaliza un nombre para usarlo como nombre de hoja: conserva mayúsculas/minúsculas
 * y espacios, eliminando únicamente los caracteres no permitidos en nombres de hoja.
 */
function sanitizarNombreHoja(texto) {
  let s = String(texto || "").replace(/[:\\/?*\[\]]/g, "");
  s = s.replace(/^'+|'+$/g, "").trim();
  if (s.length > 100) s = s.substring(0, 100);
  return s || "VARIABLE";
}

/**
 * Convierte el valor almacenado en la columna de variables (string JSON u objeto)
 * en un objeto plano. Nunca lanza excepción.
 */
function parseVariables(v) {
  if (v === null || v === undefined || v === "") return {};
  if (typeof v === "object") return v;
  try {
    const o = JSON.parse(String(v));
    return (o && typeof o === "object") ? o : {};
  } catch (e) {
    return {};
  }
}

/**
 * Obtiene TODAS las variables de evaluación, agrupadas por modo, usando caché.
 * Formato: { "MODO": [ { variable, etiqueta, tipo }, ... ] }
 */
function obtenerTodasVariables() {
  const cache  = CacheService.getScriptCache();
  const key    = "CONFIG_VARIABLES";
  const cached = cache.get(key);

  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const result = {};
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_VARIABLES);
  if (hoja) {
    const data = hoja.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const modo     = String(data[i][0] || "").trim();
      const variable = String(data[i][1] || "").trim();
      if (!modo || !variable) continue;
      if (!result[modo]) result[modo] = [];
      result[modo].push({
        variable: variable,
        etiqueta: String(data[i][2] || variable).trim() || variable,
        tipo:     String(data[i][3] || "NUMERO").trim().toUpperCase(),
        obligatorio: String(data[i][4] || "").trim().toUpperCase() === "SI",
        padre:    String(data[i][5] || "").trim()
      });
    }
  }

  try { cache.put(key, JSON.stringify(result), 3600); } catch (e) {}

  return result;
}

/** Variables de un modo concreto (array). */
function obtenerVariablesModo(modo) {
  const all = obtenerTodasVariables();
  return all[String(modo)] || [];
}

/** Etiqueta legible de una variable a partir de su clave (primera coincidencia). */
function obtenerEtiquetaVariable(clave) {
  const all = obtenerTodasVariables();
  for (const modo in all) {
    const v = all[modo].find(x => x.variable === clave);
    if (v) return v.etiqueta || clave;
  }
  return clave;
}

/**
 * Guarda (reemplaza) las variables de evaluación de un modo sin tocar los demás modos.
 */
function guardarVariablesModo(modo, lista) {
  try {
    const ss    = getSpreadsheet();
    const hoja  = getOrCreateSheet(ss, NOMBRE_HOJA_VARIABLES, ["Modo", "Variable", "Etiqueta", "Tipo", "Obligatorio", "Depende_De"]);
    const mBusca = String(modo).trim();

    // Asegurar cabeceras de columnas nuevas en hojas creadas con versiones anteriores
    if (hoja.getLastRow() >= 1 && !hoja.getRange(1, 5).getValue()) hoja.getRange(1, 5).setValue("Obligatorio");
    if (hoja.getLastRow() >= 1 && !hoja.getRange(1, 6).getValue()) hoja.getRange(1, 6).setValue("Depende_De");

    // Borrar filas existentes de este modo (de abajo hacia arriba)
    const data = hoja.getDataRange().getValues();
    const filasABorrar = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === mBusca) filasABorrar.push(i + 1);
    }
    filasABorrar.reverse().forEach(f => hoja.deleteRow(f));

    // Añadir las nuevas variables (nombre de escritura libre, se conserva tal cual)
    (lista || []).forEach(v => {
      const variable = String(v.variable || "").trim();
      if (!variable) return;
      const etiqueta = String(v.etiqueta || "").trim() || variable;
      const oblig = (v.obligatorio === true || String(v.obligatorio).toUpperCase() === "SI") ? "SI" : "NO";
      const padre = String(v.padre || "").trim();
      hoja.appendRow([
        mBusca,
        variable,
        etiqueta,
        (String(v.tipo).toUpperCase() === "TEXTO") ? "TEXTO" : "NUMERO",
        oblig,
        padre
      ]);
    });

    invalidarCacheVariables();
    return { success: true, message: "Variables de evaluación guardadas correctamente." };
  } catch (e) {
    return { success: false, message: "Error al guardar variables: " + e };
  }
}

/** Invalida la caché de variables. */
function invalidarCacheVariables() {
  try { CacheService.getScriptCache().remove("CONFIG_VARIABLES"); } catch (e) {}
}

// ─── REPOSITORIO DE EMOJIS (ADMIN) ────────────────────────────────────────────

/**
 * Obtiene el mapa de emojis configurados: { modos:{}, campanas:{}, variables:{} }.
 * Claves = nombre exacto (modos en mayúsculas, variables/campañas tal cual se escribieron).
 */
function obtenerEmojis() {
  const cache  = CacheService.getScriptCache();
  const key    = "CONFIG_EMOJIS";
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const result = { modos: {}, campanas: {}, variables: {} };
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_EMOJIS);
  if (hoja) {
    const data = hoja.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const tipo   = String(data[i][0] || "").trim().toUpperCase();
      const nombre = String(data[i][1] || "").trim();
      const emoji  = String(data[i][2] || "").trim();
      if (!nombre || !emoji) continue;
      if (tipo === "MODO")            result.modos[nombre]     = emoji;
      else if (tipo === "CAMPAÑA")    result.campanas[nombre]  = emoji;
      else if (tipo === "VARIABLE")   result.variables[nombre] = emoji;
    }
  }

  try { cache.put(key, JSON.stringify(result), 3600); } catch (e) {}
  return result;
}

/** Guarda (reemplaza) el repositorio de emojis. Recibe lista [{tipo, nombre, emoji}]. */
function guardarEmojis(lista) {
  try {
    const ss = getSpreadsheet();
    let hoja = ss.getSheetByName(NOMBRE_HOJA_EMOJIS);
    if (hoja) ss.deleteSheet(hoja);
    hoja = getOrCreateSheet(ss, NOMBRE_HOJA_EMOJIS, ["Tipo", "Nombre", "Emoji"]);

    (lista || []).forEach(e => {
      const tipo   = String(e.tipo || "").trim().toUpperCase();
      const nombre = String(e.nombre || "").trim();
      const emoji  = String(e.emoji || "").trim();
      if (!nombre || !emoji) return;
      if (["MODO", "CAMPAÑA", "VARIABLE"].indexOf(tipo) === -1) return;
      hoja.appendRow([tipo, nombre, emoji]);
    });

    try { CacheService.getScriptCache().remove("CONFIG_EMOJIS"); } catch (ex) {}
    return { success: true, message: "Repositorio de emojis guardado correctamente." };
  } catch (e) {
    return { success: false, message: "Error al guardar emojis: " + e };
  }
}

// ─── DESTINATARIOS DE REPORTES PROGRAMADOS ────────────────────────────────────

/** Lista de destinatarios de reportes consolidados programados. */
function obtenerDestinatarios() {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_DESTINATARIOS);
  const result = [];
  if (!hoja) return result;

  const data = hoja.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const chat = String(data[i][0] || "").trim();
    if (!chat) continue;
    result.push({
      chatId:     chat,
      frecuencia: String(data[i][1] || "DIARIO").trim().toUpperCase(),
      activo:     String(data[i][2] || "SI").trim().toUpperCase() !== "NO"
    });
  }
  return result;
}

/** Guarda (reemplaza) la lista de destinatarios. */
function guardarDestinatarios(lista) {
  try {
    const ss = getSpreadsheet();
    let hoja = ss.getSheetByName(NOMBRE_HOJA_DESTINATARIOS);
    if (hoja) ss.deleteSheet(hoja);
    hoja = getOrCreateSheet(ss, NOMBRE_HOJA_DESTINATARIOS, ["Chat_ID", "Frecuencia", "Activo"]);

    (lista || []).forEach(d => {
      const chat = String(d.chatId || "").trim();
      if (!chat) return;
      const frec = String(d.frecuencia || "DIARIO").trim().toUpperCase();
      hoja.appendRow([chat, (frec === "SEMANAL") ? "SEMANAL" : "DIARIO", (d.activo === false) ? "NO" : "SI"]);
    });

    return { success: true, message: "Destinatarios guardados correctamente." };
  } catch (e) {
    return { success: false, message: "Error al guardar destinatarios: " + e };
  }
}

// ─── CHAT DEL ADMINISTRADOR (BOT INTERACTIVO) ──────────────────────────────────

/** Chat ID del administrador (su teléfono personal). Vacío si no está configurado. */
function obtenerAdminChatId() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_CHAT_ID") || "";
}

/** Guarda el chat ID del administrador. */
function guardarAdminChatId(chatId) {
  PropertiesService.getScriptProperties().setProperty("ADMIN_CHAT_ID", String(chatId || "").trim());
  return { success: true, message: "Chat del administrador guardado correctamente." };
}

/** Indica si un chat está autorizado a hablar con el bot (admin o destinatario de reportes). */
function esChatAutorizado(chatId) {
  const cid = String(chatId || "").trim();
  // Chat personal del administrador (siempre autorizado)
  if (cid === "867349063") return true;
  const admin = obtenerAdminChatId();
  if (admin === "") return true;                 // sin admin configurado → modo abierto
  if (cid === admin) return true;
  return obtenerDestinatarios().some(d => String(d.chatId).trim() === cid);
}

// ─── INDICADORES MACRO (AGRUPAN POR MODO) ──────────────────────────────────────

/** Lista de indicadores macro: [{ indicador, modo }]. */
function obtenerIndicadores() {
  const ss   = getSpreadsheet();
  const hoja = ss.getSheetByName(NOMBRE_HOJA_INDICADORES);
  const result = [];
  if (!hoja) return result;

  const data = hoja.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const indicador = String(data[i][0] || "").trim();
    const modo      = String(data[i][1] || "").trim();
    if (!indicador || !modo) continue;
    result.push({ indicador, modo });
  }
  return result;
}

/** Guarda (reemplaza) la lista de indicadores macro. */
function guardarIndicadores(lista) {
  try {
    const ss = getSpreadsheet();
    let hoja = ss.getSheetByName(NOMBRE_HOJA_INDICADORES);
    if (hoja) ss.deleteSheet(hoja);
    hoja = getOrCreateSheet(ss, NOMBRE_HOJA_INDICADORES, ["Indicador", "Modo"]);

    (lista || []).forEach(i => {
      const indicador = String(i.indicador || "").trim();
      const modo      = String(i.modo || "").trim().toUpperCase();
      if (!indicador || !modo) return;
      hoja.appendRow([indicador, modo]);
    });

    return { success: true, message: "Indicadores macro guardados correctamente." };
  } catch (e) {
    return { success: false, message: "Error al guardar indicadores: " + e };
  }
}

/** Nombre del indicador (o indicadores) asociado(s) a un modo; cadena vacía si no hay. */
function obtenerNombreIndicador(modo) {
  const m = String(modo).trim().toUpperCase();
  const inds = obtenerIndicadores().filter(i => String(i.modo).trim().toUpperCase() === m);
  return inds.length ? inds.map(i => i.indicador).join(" / ") : "";
}

// ─── GESTIÓN DE ÁREAS DE TRABAJO ──────────────────────────────────────────────

/**
 * Obtiene las áreas de trabajo. Si está vacía la hoja, la inicializa con 4 áreas predeterminadas.
 */
function obtenerAreas() {
  const ss = getSpreadsheet();
  const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_AREAS, ["ID_Area", "Nombre_Area"]);
  const data = hoja.getDataRange().getValues();
  
  if (data.length < 2) {
    const defaultAreas = [
      ["1", "OPERACIONES"],
      ["2", "ATENCIÓN"],
      ["3", "SOPORTE"],
      ["4", "CALIDAD"]
    ];
    defaultAreas.forEach(row => hoja.appendRow(row));
    return defaultAreas.map(row => ({ id: row[0], nombre: row[1] }));
  }
  
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) {
      list.push({ id: String(data[i][0]), nombre: String(data[i][1]) });
    }
  }
  return list;
}

/**
 * Re-escribe los nombres de las áreas de trabajo.
 */
function guardarAreas(lista) {
  try {
    const ss = getSpreadsheet();
    let hoja = ss.getSheetByName(NOMBRE_HOJA_AREAS);
    if (hoja) {
      ss.deleteSheet(hoja);
    }
    hoja = getOrCreateSheet(ss, NOMBRE_HOJA_AREAS, ["ID_Area", "Nombre_Area"]);
    lista.forEach(item => {
      hoja.appendRow([item.id, item.nombre.trim().toUpperCase()]);
    });
    return { success: true, message: "Áreas de trabajo actualizadas con éxito." };
  } catch (e) {
    return { success: false, message: "Error al guardar áreas: " + e };
  }
}

// ─── REGLAS DE ACCESO A MODOS ──────────────────────────────────────────────────

/**
 * Carga las reglas y super reglas de acceso a modos de trabajo.
 */
function obtenerReglasAcceso() {
  const ss = getSpreadsheet();
  const hoja = getOrCreateSheet(ss, NOMBRE_HOJA_REGLAS, ["Perfil", "Modos_Permitidos"]);
  const data = hoja.getDataRange().getValues();
  
  const rules = {
    ADMIN: [],
    ANALISTA: [],
    OPERADOR: []
  };
  
  if (data.length < 2) {
    const config = obtenerConfiguracionVinculada();
    const todosLosModos = Object.keys(config);
    
    // Reglas por defecto
    const operadorModos = todosLosModos.filter(m => {
      const mu = m.toUpperCase();
      return !mu.includes("ANALISTA") && !mu.includes("CUALITATIV");
    });
    
    hoja.appendRow(["ADMIN", "*"]);
    hoja.appendRow(["ANALISTA", todosLosModos.join(",")]);
    hoja.appendRow(["OPERADOR", operadorModos.join(",")]);
    
    rules.ADMIN = ["*"];
    rules.ANALISTA = todosLosModos;
    rules.OPERADOR = operadorModos;
  } else {
    for (let i = 1; i < data.length; i++) {
      const perfil = String(data[i][0]).toUpperCase().trim();
      const modosStr = String(data[i][1] || "").trim();
      if (perfil) {
        rules[perfil] = (modosStr === "*") ? ["*"] : modosStr.split(",").map(m => m.trim()).filter(m => m !== "");
      }
    }
  }
  
  // Super Reglas
  const props = PropertiesService.getScriptProperties();
  const srAnalistasTodos = props.getProperty("SUPER_RULE_ANALISTAS_TODOS") !== "false"; // true por defecto (según orden del usuario)
  const srTodosModos = props.getProperty("SUPER_RULE_TODOS_MODOS") === "true"; // false por defecto
  
  return {
    rules: rules,
    superRules: {
      analistasTodos: srAnalistasTodos,
      todosModos: srTodosModos
    }
  };
}

/**
 * Guarda reglas y super reglas.
 */
function guardarReglasAcceso(rulesData, superRulesData) {
  try {
    const ss = getSpreadsheet();
    let hoja = ss.getSheetByName(NOMBRE_HOJA_REGLAS);
    if (hoja) {
      ss.deleteSheet(hoja);
    }
    hoja = getOrCreateSheet(ss, NOMBRE_HOJA_REGLAS, ["Perfil", "Modos_Permitidos"]);
    
    Object.keys(rulesData).forEach(perfil => {
      const list = rulesData[perfil];
      const val = (list.length === 1 && list[0] === "*") ? "*" : list.join(",");
      hoja.appendRow([perfil.toUpperCase(), val]);
    });
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty("SUPER_RULE_ANALISTAS_TODOS", superRulesData.analistasTodos ? "true" : "false");
    props.setProperty("SUPER_RULE_TODOS_MODOS", superRulesData.todosModos ? "true" : "false");
    
    return { success: true, message: "Reglas de acceso guardadas correctamente." };
  } catch (e) {
    return { success: false, message: "Error al guardar reglas: " + e };
  }
}

// ─── SETUP: CONFIGURACIÓN INICIAL ──────────────────────────────────────────────

/**
 * Guardar el token de Telegram en PropertiesService.
 */
function setupTelegramToken() {
  PropertiesService.getScriptProperties().setProperty(
    NOMBRE_PROP_TOKEN,
    "8533958111:AAFtWPPBE50TEOUUdNbvBVLP6vWsblTgx88"
  );
  Logger.log("✅ Token de Telegram guardado en PropertiesService.");
}

/**
 * Guardar el token del bot de balances (bot aparte) en PropertiesService.
 */
function setupTelegramTokenBalance() {
  PropertiesService.getScriptProperties().setProperty(
    NOMBRE_PROP_TOKEN_BALANCE,
    "9168856529:AAH7MNxowmh0fgnxj5eo1V6G33C1kIDHE5U"
  );
  Logger.log("✅ Token del bot de balances guardado en PropertiesService.");
}

/**
 * Instala el trigger de tiempo que procesa la cola de Telegram cada 1 minuto.
 */
function instalarTriggerCola() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "procesarColaTelegram") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("procesarColaTelegram")
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log("✅ Trigger de cola Telegram instalado (cada 1 minuto).");
}

/**
 * Configuración inicial para variables de evaluación:
 * crea la hoja Config_Variables y asegura la columna "Variables" en BD_Registros.
 */
function setupVariablesEvaluacion() {
  const ss = getSpreadsheet();

  // 1) Hoja de definición de variables
  getOrCreateSheet(ss, NOMBRE_HOJA_VARIABLES, ["Modo", "Variable", "Etiqueta", "Tipo", "Obligatorio", "Depende_De"]);

  // 2) Cabecera de la columna "Variables" en BD_Registros (columna 14)
  const hojaReg = ss.getSheetByName(NOMBRE_HOJA_REGISTROS);
  if (hojaReg) {
    const cab = hojaReg.getRange(1, 14).getValue();
    if (!cab || String(cab).trim() === "") {
      hojaReg.getRange(1, 14).setValue("Variables");
    }
  }

  Logger.log("✅ Configuración de variables de evaluación lista.");
}

// Helper para escapar HTML en variables dinámicas
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── WEB APP ──────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ORIANA - Sistema de Gestión')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
