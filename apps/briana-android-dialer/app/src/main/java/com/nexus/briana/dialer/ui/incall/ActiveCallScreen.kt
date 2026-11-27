package com.nexus.briana.dialer.ui.incall

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.PhoneInTalk
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.briana.dialer.telecom.LiveCallUiState
import kotlinx.coroutines.delay

@Composable
fun ActiveCallScreen(
    callState: LiveCallUiState,
    onHangupClick: () -> Unit
) {
    var elapsedSeconds by remember(callState.activeStartMs) { mutableIntStateOf(0) }

    LaunchedEffect(callState.isConnected, callState.activeStartMs) {
        while (callState.isConnected && callState.activeStartMs != null) {
            elapsedSeconds = ((System.currentTimeMillis() - callState.activeStartMs) / 1000L).toInt().coerceAtLeast(0)
            delay(500L)
        }
    }

    val mins = elapsedSeconds / 60
    val secs = elapsedSeconds % 60
    val timerStr = "%02d:%02d".format(mins, secs)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(modifier = Modifier.height(32.dp))
            Surface(
                color = if (callState.isConnected) Color(0xFF064E3B) else Color(0xFF1E293B),
                shape = RoundedCornerShape(50)
            ) {
                Text(
                    text = if (callState.isConnected) "● LLAMADA CONECTADA (ACTIVE)" else "● ${callState.stateLabel}...",
                    color = if (callState.isConnected) Color(0xFF34D399) else Color(0xFFFBBF24),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
            Icon(
                imageVector = Icons.Default.PhoneInTalk,
                contentDescription = null,
                tint = Color(0xFF38BDF8),
                modifier = Modifier.size(56.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = callState.phoneNumber,
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.Monospace
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = if (callState.isConnected) timerStr else "Esperando respuesta...",
                color = Color(0xFF94A3B8),
                fontSize = 22.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Button(
                onClick = onHangupClick,
                modifier = Modifier.size(80.dp),
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE11D48))
            ) {
                Icon(
                    imageVector = Icons.Default.CallEnd,
                    contentDescription = "Colgar",
                    tint = Color.White,
                    modifier = Modifier.size(34.dp)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Colgar Llamada (Sincroniza con PC)",
                color = Color(0xFF94A3B8),
                fontSize = 12.sp
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
