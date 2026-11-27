package com.nexus.briana.dialer.telecom

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.CallCommandDto
import kotlinx.serialization.json.jsonPrimitive

class TelecomCommandExecutor(private val context: Context) {
    private val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
    private val prefs = ShiftPreferences(context)

    @SuppressLint("MissingPermission")
    fun executeCommand(cmd: CallCommandDto) {
        when (cmd.command_type) {
            "DIAL" -> {
                val phone = cmd.payload?.get("phone_number")?.jsonPrimitive?.content ?: return
                prefs.currentCallUuid = cmd.call_uuid
                prefs.currentCommandId = cmd.id
                prefs.currentContactId = cmd.contact_id
                prefs.currentInitiatedFrom = "pc_web"
                prefs.pendingHangupFromPc = false

                val uri = Uri.fromParts("tel", phone, null)
                val extras = Bundle().apply {
                    putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, false)
                }
                telecomManager.placeCall(uri, extras)
            }
            "DIAL_WHATSAPP" -> {
                val rawPhone = cmd.payload?.get("phone_number")?.jsonPrimitive?.content ?: return
                val cleanDigits = rawPhone.replace(Regex("[^0-9]"), "")
                prefs.currentCallUuid = cmd.call_uuid
                prefs.currentCommandId = cmd.id
                prefs.currentContactId = cmd.contact_id
                prefs.currentInitiatedFrom = "pc_web"
                prefs.pendingHangupFromPc = false

                // Abre directamente el contacto en WhatsApp listo para pulsar llamada VoIP
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$cleanDigits")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    setPackage("com.whatsapp")
                }
                try {
                    context.startActivity(intent)
                } catch (_: Exception) {
                    val fallback = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$cleanDigits")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(fallback)
                }
            }
            "HANGUP" -> {
                prefs.pendingHangupFromPc = true
                BrianaInCallService.activeCallInstance?.disconnect()
            }
            "END_SHIFT" -> {
                prefs.isShiftActive = false
                prefs.activeSessionId = null
                prefs.clearCurrentCallContext()
            }
        }
    }
}
