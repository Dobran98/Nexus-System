package com.nexus.briana.dialer.telecom

import android.annotation.SuppressLint
import android.content.Context
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
