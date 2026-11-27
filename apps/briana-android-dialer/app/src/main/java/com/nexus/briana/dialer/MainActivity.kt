package com.nexus.briana.dialer

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.lifecycle.lifecycleScope
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.RegisterDeviceRequest
import com.nexus.briana.dialer.data.remote.NexusApiClient
import com.nexus.briana.dialer.service.BrianaForegroundService
import com.nexus.briana.dialer.telecom.BrianaInCallService
import com.nexus.briana.dialer.ui.incall.ActiveCallScreen
import com.nexus.briana.dialer.ui.pairing.PairingScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var prefs: ShiftPreferences
    private lateinit var apiClient: NexusApiClient

    private val roleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        startShiftServiceIfAllowed()
    }

    private val permLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = ShiftPreferences(this)
        apiClient = NexusApiClient(this)

        requestRuntimePermissions()

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                val liveCall by BrianaInCallService.liveState.collectAsState()
                var pairingPin by remember { mutableStateOf(prefs.pairingPin) }
                var isShiftActive by remember { mutableStateOf(prefs.isShiftActive) }
                var operatorName by remember { mutableStateOf(prefs.activeOperatorName) }
                var isDefaultDialer by remember { mutableStateOf(checkDefaultDialer()) }
                var batteryPct by remember { mutableStateOf(readBatteryPct()) }
                var networkType by remember { mutableStateOf(readNetworkType()) }
                var serverUrl by remember { mutableStateOf(prefs.baseUrl) }
                var connectionError by remember { mutableStateOf<String?>(null) }
                var syncTrigger by remember { mutableStateOf(0) }

                LaunchedEffect(syncTrigger, serverUrl) {
                    while (true) {
                        batteryPct = readBatteryPct()
                        networkType = readNetworkType()
                        isDefaultDialer = checkDefaultDialer()
                        val res = apiClient.registerAndHeartbeat(
                            RegisterDeviceRequest(
                                deviceUid = prefs.deviceUid,
                                model = "${Build.MANUFACTURER} ${Build.MODEL}",
                                batteryPct = batteryPct,
                                networkType = networkType,
                                isDefaultDialer = isDefaultDialer
                            )
                        )
                        if (res != null) {
                            prefs.pairingPin = res.pairingPin
                            pairingPin = res.pairingPin
                            operatorName = res.operatorName
                            connectionError = null
                        } else {
                            connectionError = apiClient.lastError
                            if (prefs.pairingPin.isNotBlank()) {
                                pairingPin = prefs.pairingPin
                            }
                        }
                        delay(if (res != null) 4000L else 6000L)
                    }
                }

                if (liveCall.isInCall) {
                    ActiveCallScreen(
                        callState = liveCall,
                        onHangupClick = { BrianaInCallService.hangupFromPhoneUi() }
                    )
                } else {
                    PairingScreen(
                        deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                        pairingPin = pairingPin,
                        isShiftActive = isShiftActive,
                        operatorName = operatorName,
                        batteryPct = batteryPct,
                        networkType = networkType,
                        isDefaultDialer = isDefaultDialer,
                        serverUrl = serverUrl,
                        connectionError = connectionError,
                        onRetryConnection = { syncTrigger++ },
                        onUpdateServerUrl = { newUrl ->
                            val cleaned = newUrl.trim().trimEnd('/')
                            if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
                                prefs.baseUrl = cleaned
                                prefs.pairingPin = ""
                                pairingPin = ""
                                serverUrl = cleaned
                                connectionError = null
                                syncTrigger++
                            }
                        },
                        onToggleShift = { enable ->
                            if (enable) {
                                requestDialerRoleAndStartShift()
                                isShiftActive = true
                            } else {
                                stopShiftAndRestorePhone()
                                isShiftActive = false
                                operatorName = null
                            }
                            isDefaultDialer = checkDefaultDialer()
                        },
                        onRequestBatteryOptimization = { requestBatteryExclusion() },
                        onOpenDefaultAppsSettings = {
                            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
                        },
                        onOpenNotificationAccessSettings = {
                            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                        }
                    )
                }
            }
        }
    }

    private fun readBatteryPct(): Int {
        val bm = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = bm?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: 100
        val scale = bm?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        return ((level * 100f) / scale).toInt().coerceIn(0, 100)
    }

    private fun readNetworkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return "OFFLINE"
        val caps = cm.getNetworkCapabilities(net) ?: return "RED"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "DATOS"
            else -> "ACTIVO"
        }
    }

    private fun requestRuntimePermissions() {
        val perms = mutableListOf(
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permLauncher.launch(perms.toTypedArray())
    }

    private fun checkDefaultDialer(): Boolean {
        val tm = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        return tm.defaultDialerPackage == packageName
    }

    private fun requestDialerRoleAndStartShift() {
        prefs.isShiftActive = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_DIALER) && !rm.isRoleHeld(RoleManager.ROLE_DIALER)) {
                roleLauncher.launch(rm.createRequestRoleIntent(RoleManager.ROLE_DIALER))
                return
            }
        }
        startShiftServiceIfAllowed()
    }

    private fun startShiftServiceIfAllowed() {
        val intent = Intent(this, BrianaForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopShiftAndRestorePhone() {
        prefs.isShiftActive = false
        prefs.activeSessionId = null
        prefs.activeOperatorName = null
        stopService(Intent(this, BrianaForegroundService::class.java))
        lifecycleScope.launch {
            // El operador puede restaurar el marcador Samsung si lo desea en Ajustes
        }
    }

    private fun requestBatteryExclusion() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        }
    }
}

