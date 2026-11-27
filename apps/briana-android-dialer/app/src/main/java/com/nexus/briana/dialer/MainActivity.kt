package com.nexus.briana.dialer

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
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

                LaunchedEffect(Unit) {
                    val res = apiClient.registerAndHeartbeat(
                        RegisterDeviceRequest(
                            deviceUid = prefs.deviceUid,
                            model = "${Build.MANUFACTURER} ${Build.MODEL}",
                            batteryPct = 100,
                            networkType = "WIFI",
                            isDefaultDialer = isDefaultDialer
                        )
                    )
                    if (res != null) {
                        prefs.pairingPin = res.pairingPin
                        pairingPin = res.pairingPin
                        operatorName = res.operatorName
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
                        batteryPct = 100,
                        networkType = "ACTIVO",
                        isDefaultDialer = isDefaultDialer,
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
                        }
                    )
                }
            }
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
