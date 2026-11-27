package com.nexus.briana.dialer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class BrianaApp : Application() {
    companion object {
        const val CHANNEL_ID = "briana_shift_channel"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Briana Modo Turno Operador",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene sincronizado el marcado remoto y telemetría de llamadas con Nexus-System"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
