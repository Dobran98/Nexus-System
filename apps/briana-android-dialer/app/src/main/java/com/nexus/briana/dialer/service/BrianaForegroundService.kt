package com.nexus.briana.dialer.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.nexus.briana.dialer.BrianaApp
import com.nexus.briana.dialer.MainActivity
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.RegisterDeviceRequest
import com.nexus.briana.dialer.data.remote.NexusApiClient
import com.nexus.briana.dialer.telecom.TelecomCommandExecutor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class BrianaForegroundService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: ShiftPreferences
    private lateinit var apiClient: NexusApiClient
    private lateinit var executor: TelecomCommandExecutor
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        prefs = ShiftPreferences(this)
        apiClient = NexusApiClient(this)
        executor = TelecomCommandExecutor(this)

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Briana::ShiftWakeLock").apply {
            acquire(12 * 60 * 60 * 1000L) // Máx 12 horas por turno
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1001, buildNotification("Modo Turno Operador Activo · Sincronizado"))

        scope.launch {
            while (isActive && prefs.isShiftActive) {
                val res = apiClient.registerAndHeartbeat(
                    RegisterDeviceRequest(
                        deviceUid = prefs.deviceUid,
                        model = "${Build.MANUFACTURER} ${Build.MODEL}",
                        batteryPct = getBatteryPct(),
                        networkType = getNetworkType(),
                        isDefaultDialer = true
                    )
                )
                if (res != null) {
                    prefs.pairingPin = res.pairingPin
                    prefs.activeSessionId = res.sessionId
                    prefs.activeOperatorId = res.operatorId
                    prefs.activeOperatorName = res.operatorName
                    prefs.activeCampaignId = res.campaignId

                    for (cmd in res.commands) {
                        executor.executeCommand(cmd)
                    }
                }
                apiClient.flushOutbox()
                delay(2000L) // Polling ligero + respaldo Realtime mientras turno esté activo
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        if (wakeLock?.isHeld == true) wakeLock?.release()
        scope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, BrianaApp.CHANNEL_ID)
            .setContentTitle("Briana Contact Center")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun getBatteryPct(): Int {
        val bm = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = bm?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: 100
        val scale = bm?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        return ((level * 100f) / scale).toInt().coerceIn(0, 100)
    }

    private fun getNetworkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return "OFFLINE"
        val caps = cm.getNetworkCapabilities(net) ?: return "UNKNOWN"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
            else -> "OTHER"
        }
    }
}
