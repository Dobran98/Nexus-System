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

    companion object {
        private val processedCommandIds = mutableSetOf<String>()
    }

    private fun normalizeWhatsAppDigits(rawPhone: String): String {
        val digits = rawPhone.replace(Regex("[^0-9]"), "")
        return when {
            digits.length == 11 && digits.startsWith("0") -> "58" + digits.substring(1)
            digits.length == 10 && (digits.startsWith("4") || digits.startsWith("2")) -> "58$digits"
            else -> digits
        }
    }

    @SuppressLint("MissingPermission")
    fun executeCommand(cmd: CallCommandDto) {
        synchronized(processedCommandIds) {
            if (processedCommandIds.contains(cmd.id)) return
            processedCommandIds.add(cmd.id)
            if (processedCommandIds.size > 200) {
                processedCommandIds.clear()
                processedCommandIds.add(cmd.id)
            }
        }

        val payloadCampaignId = cmd.payload?.get("campaign_id")?.let {
            if (it.toString() == "null") null else it.jsonPrimitive.content
        }

        when (cmd.command_type) {
            "DIAL" -> {
                val phone = cmd.payload?.get("phone_number")?.jsonPrimitive?.content ?: return
                prefs.currentCallUuid = cmd.call_uuid
                prefs.currentCommandId = cmd.id
                prefs.currentContactId = cmd.contact_id
                if (!payloadCampaignId.isNullOrBlank()) {
                    prefs.activeCampaignId = payloadCampaignId
                }
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
                val waDigits = normalizeWhatsAppDigits(rawPhone)
                prefs.currentCallUuid = cmd.call_uuid
                prefs.currentCommandId = cmd.id
                prefs.currentContactId = cmd.contact_id
                if (!payloadCampaignId.isNullOrBlank()) {
                    prefs.activeCampaignId = payloadCampaignId
                }
                prefs.currentInitiatedFrom = "pc_web"
                prefs.pendingHangupFromPc = false

                // Abre directamente el chat en WhatsApp (o WhatsApp Business) listo para pulsar llamada VoIP
                val uri = Uri.parse("https://wa.me/$waDigits")
                val packages = listOf("com.whatsapp", "com.whatsapp.w4b", null)
                for (pkg in packages) {
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        if (pkg != null) setPackage(pkg)
                    }
                    try {
                        context.startActivity(intent)
                        break
                    } catch (_: Exception) {
                        continue
                    }
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
