package com.nexus.briana.dialer.data.local

import android.content.Context
import android.provider.Settings

class ShiftPreferences(context: Context) {
    private val prefs = context.getSharedPreferences("briana_shift_prefs", Context.MODE_PRIVATE)
    private val appContext = context.applicationContext

    val deviceUid: String
        get() = Settings.Secure.getString(appContext.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "SAMSUNG-UNKNOWN"

    var baseUrl: String
        get() = prefs.getString("base_url", "https://nexus-system.vercel.app") ?: "https://nexus-system.vercel.app"
        set(value) = prefs.edit().putString("base_url", value.trimEnd('/')).apply()

    var pairingPin: String
        get() = prefs.getString("pairing_pin", "") ?: ""
        set(value) = prefs.edit().putString("pairing_pin", value).apply()

    var isShiftActive: Boolean
        get() = prefs.getBoolean("is_shift_active", false)
        set(value) = prefs.edit().putBoolean("is_shift_active", value).apply()

    var activeSessionId: String?
        get() = prefs.getString("active_session_id", null)
        set(value) = prefs.edit().putString("active_session_id", value).apply()

    var activeOperatorName: String?
        get() = prefs.getString("active_operator_name", null)
        set(value) = prefs.edit().putString("active_operator_name", value).apply()

    var activeOperatorId: String?
        get() = prefs.getString("active_operator_id", null)
        set(value) = prefs.edit().putString("active_operator_id", value).apply()

    var activeCampaignId: String?
        get() = prefs.getString("active_campaign_id", null)
        set(value) = prefs.edit().putString("active_campaign_id", value).apply()

    // Contexto de la llamada en curso (para vincular PC DIAL con InCallService)
    var currentCallUuid: String?
        get() = prefs.getString("current_call_uuid", null)
        set(value) = prefs.edit().putString("current_call_uuid", value).apply()

    var currentCommandId: String?
        get() = prefs.getString("current_command_id", null)
        set(value) = prefs.edit().putString("current_command_id", value).apply()

    var currentContactId: String?
        get() = prefs.getString("current_contact_id", null)
        set(value) = prefs.edit().putString("current_contact_id", value).apply()

    var currentInitiatedFrom: String
        get() = prefs.getString("current_initiated_from", "android_app") ?: "android_app"
        set(value) = prefs.edit().putString("current_initiated_from", value).apply()

    var pendingHangupFromPc: Boolean
        get() = prefs.getBoolean("pending_hangup_from_pc", false)
        set(value) = prefs.edit().putBoolean("pending_hangup_from_pc", value).apply()

    fun clearCurrentCallContext() {
        prefs.edit()
            .remove("current_call_uuid")
            .remove("current_command_id")
            .remove("current_contact_id")
            .putString("current_initiated_from", "android_app")
            .putBoolean("pending_hangup_from_pc", false)
            .apply()
    }
}

