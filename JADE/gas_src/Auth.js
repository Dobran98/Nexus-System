function verificarLogin(usuarioIngresado, claveIngresada) {
  var idSheet = SpreadsheetApp.getActiveSpreadsheet().getId(); 
  var hojaUsuarios = SpreadsheetApp.openById(idSheet).getSheetByName("Usuarios");
  
  var datos = hojaUsuarios.getDataRange().getValues();
  
  for (var i = 1; i < datos.length; i++) {
    var usuarioBd = datos[i][4]; 
    var claveBd = datos[i][5];   
    
    if (usuarioBd === usuarioIngresado && claveBd.toString() === claveIngresada.toString()) {
      var rol = datos[i][2];
      return {
        exito: true,
        nombre: datos[i][0], 
        rol: rol,    
        estado: datos[i][3],
        usuario: datos[i][4],
        tema: datos[i][8] || 'default',
        fotoPerfil: datos[i][9] || '',
        requiere2FA: (rol === 'Operador')
      };
    }
  }
  return { exito: false, mensaje: "Usuario o clave incorrectos" };
}