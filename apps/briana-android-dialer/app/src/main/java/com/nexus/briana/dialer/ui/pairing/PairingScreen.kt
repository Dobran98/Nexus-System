package com.nexus.briana.dialer.ui.pairing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun PairingScreen(
    deviceModel: String,
    pairingPin: String,
    isShiftActive: Boolean,
    operatorName: String?,
    batteryPct: Int,
    networkType: String,
    isDefaultDialer: Boolean,
    onToggleShift: (Boolean) -> Unit,
    onRequestBatteryOptimization: () -> Unit,
    onOpenDefaultAppsSettings: () -> Unit,
    onOpenNotificationAccessSettings: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Cabecera Nexus / Briana
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "BRIANA · NEXUS DIALER",
                color = Color(0xFF38BDF8),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = deviceModel,
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AssistChip(
                    onClick = {},
                    label = { Text("$batteryPct%", color = Color(0xFF94A3B8), fontSize = 11.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.BatteryChargingFull, null, tint = Color(0xFF10B981), modifier = Modifier.size(16.dp))
                    }
                )
                AssistChip(
                    onClick = {},
                    label = { Text(networkType, color = Color(0xFF94A3B8), fontSize = 11.sp) },
                    leadingIcon = {
                        Icon(Icons.Default.Wifi, null, tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                    }
                )
            }
        }

        // Tarjeta Central del PIN de Vinculación
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(24.dp)),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "CÓDIGO DE VINCULACIÓN",
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.5.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = if (pairingPin.isNotBlank()) pairingPin else "BRN-...",
                    color = Color(0xFF38BDF8),
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.height(10.dp))

                if (operatorName != null) {
                    Surface(
                        color = Color(0xFF064E3B),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = "● Vinculado a: $operatorName",
                            color = Color(0xFF6EE7B7),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }
                } else {
                    Text(
                        text = "Ingresa este código en tu PC (Briana Web) para iniciar turno.",
                        color = Color(0xFF64748B),
                        fontSize = 12.sp
                    )
                }
            }
        }

        // Controles de Modo Turno y Permisos Samsung OneUI
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Button(
                onClick = { onToggleShift(!isShiftActive) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isShiftActive) Color(0xFFE11D48) else Color(0xFF0284C7)
                )
            ) {
                Icon(
                    imageVector = if (isShiftActive) Icons.Default.PowerSettingsNew else Icons.Default.PhoneAndroid,
                    contentDescription = null
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isShiftActive) "Finalizar Turno Operador" else "Activar Modo Turno Operador",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onRequestBatteryOptimization,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Sin Restricción Batería", fontSize = 11.sp, color = Color(0xFFCBD5E1))
                }
                OutlinedButton(
                    onClick = onOpenDefaultAppsSettings,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (isDefaultDialer) "Marcador Activo ✓" else "App Teléfono",
                        fontSize = 11.sp,
                        color = if (isDefaultDialer) Color(0xFF34D399) else Color(0xFFCBD5E1)
                    )
                }
            }

            OutlinedButton(
                onClick = onOpenNotificationAccessSettings,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Permiso Monitor WhatsApp (Notificaciones)", fontSize = 11.sp, color = Color(0xFF34D399))
            }
        }
    }
}
