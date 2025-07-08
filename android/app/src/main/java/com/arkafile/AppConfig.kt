package com.arkafile

object AppConfig {
    // 🔐 Secure SSE Configuration
    const val SSE_BASE_URL = "https://notification.arkafile.info/sse"
    const val SSE_ENDPOINT = ""
    
    // ⏱️ Timing Configuration
    const val CONNECTION_TIMEOUT_SECONDS = 30L
    const val RECONNECT_BASE_DELAY_MS = 2000L
    const val RECONNECT_MAX_DELAY_MS = 60000L
    const val WATCHDOG_INTERVAL_MS = 300000L // 5 minutes
    const val TOKEN_CHECK_RETRY_DELAY_MS = 1000L
    const val TOKEN_CHECK_MAX_RETRIES = 30
    const val NETWORK_RECOVERY_DEBOUNCE_MS = 10000L
    const val CONNECTION_CLEANUP_DELAY_MS = 1000L
    
    // 📱 Notification Configuration
    const val NOTIFICATION_CHANNEL_ID = "sse_notifications_v3"
    const val SERVICE_CHANNEL_ID = "sse_service_v3"
    const val NOTIFICATION_CHANNEL_NAME = "ArkaFile اعلانات"
    const val SERVICE_CHANNEL_NAME = "ArkaFile Service"
    
    // 🔄 Retry Configuration
    const val MAX_RECONNECT_ATTEMPTS = 2147483647 // Int.MAX_VALUE
    val RECONNECT_DELAYS = arrayOf(2L, 5L, 10L, 20L) // seconds
    
    // 🗃️ Database Configuration
    const val DB_NAME = "RKStorage"
    const val TOKEN_KEY = "app_token"
    
    // 🔐 Wake Lock Configuration
    const val WAKE_LOCK_TAG = "ArkaFile::SSEService"
    
    // 🎯 Service Configuration
    const val SERVICE_NOTIFICATION_ID = 2024
    
    // 🌐 User Agent
    const val USER_AGENT = "ArkaFile-SSE-Client/2.0"
} 