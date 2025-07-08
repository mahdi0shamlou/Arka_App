package com.arkafile

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import android.app.NotificationManager
import android.app.NotificationChannel
import androidx.core.app.NotificationCompat
import okhttp3.*
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import android.os.PowerManager
import android.content.Context
import android.app.PendingIntent
import android.os.Build
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.absoluteValue 

/**
 * 🔧 Optimized SSE Background Service
 * - Single connection guarantee ✅
 * - Intelligent reconnection strategy ✅
 * - Network-aware operations ✅
 * - Memory efficient ✅
 * - Production ready ✅
 */
class TokenBackgroundService : Service() {
    companion object {
        private const val TAG = "SSE_SERVICE"
    }

    // 🔒 Thread-safe state management
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isRunning = AtomicBoolean(false)
    private val isConnecting = AtomicBoolean(false)
    private val reconnectAttempts = AtomicInteger(0)
    private val lastNetworkRecoveryTime = AtomicLong(0)
    
    // 🔑 Current token storage (thread-safe)
    @Volatile
    private var currentToken: String? = null
    
    // 🌐 Network & Connection Management
    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null
    private var watchdogJob: Job? = null
    private var networkMonitorJob: Job? = null
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null
    
    // 🔧 Optimized HTTP Client
    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(AppConfig.CONNECTION_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS) // SSE needs infinite read timeout
            .writeTimeout(30, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS) // Keep connection alive
            .retryOnConnectionFailure(false) // We handle retries manually
            .addInterceptor { chain ->
                val request = chain.request()
                Log.d(TAG, "🌐 HTTP Request: ${request.method} ${request.url}")
                val response = chain.proceed(request)
                Log.d(TAG, "🌐 HTTP Response: ${response.code}")
                response
            }
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "🚀 SSE Service Created")
        
        // Initialize core components
        initializeNotificationChannels()
        startForeground(AppConfig.SERVICE_NOTIFICATION_ID, createServiceNotification())
        acquireWakeLock()
        initializeNetworkMonitoring()
        startWatchdog()
        
        Log.i(TAG, "✅ Service initialization complete")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "🎯 onStartCommand called")
        
        // Handle specific actions
        val action = intent?.getStringExtra("action")
        
        when (action) {
            "set_token" -> {
                val token = intent?.getStringExtra("token")
                if (token != null) {
                    handleSetToken(token)
                    return START_STICKY
                }
            }
            "clear_token" -> {
                handleClearToken()
                return START_STICKY
            }
        }
        
        val triggerTokenCheck = intent?.getBooleanExtra("trigger_token_check", false) ?: false
        
        if (!isRunning.get()) {
            Log.i(TAG, "▶️ Starting SSE service for the first time")
            isRunning.set(true)
            
            if (triggerTokenCheck) {
                Log.i(TAG, "🔍 Token check requested - starting with token validation")
                serviceScope.launch { startConnectionWithTokenCheck() }
            } else {
                Log.i(TAG, "🔌 Standard start - beginning connection")
                serviceScope.launch { startSSEConnection() }
            }
        } else {
            Log.i(TAG, "✅ Service already running")
            
            if (triggerTokenCheck) {
                Log.i(TAG, "🔄 Token check requested on running service - restarting connection")
                serviceScope.launch { restartConnectionSafely() }
            }
        }
        
        return START_STICKY
    }

    // 🔍 Simple token check with retries
    private suspend fun startConnectionWithTokenCheck() {
        Log.i(TAG, "🔍 Token check started")
        
        var token: String? = null
        delay(2000) // Wait for AsyncStorage
        
        repeat(5) { attempt ->
            token = getTokenSimple()
            if (token != null) {
                Log.i(TAG, "✅ Token found (attempt ${attempt + 1})")
                return@repeat
            }
            Log.w(TAG, "❌ No token (attempt ${attempt + 1}), retrying...")
            delay(1000)
        }
        
        Log.i(TAG, if (token != null) "🔌 Starting WITH token" else "🔌 Starting WITHOUT token")
        startSSEConnection()
    }

    // 🔄 Safe connection restart (ensures single connection)
    private suspend fun restartConnectionSafely() {
        Log.i(TAG, "🔄 Safe connection restart requested")
        
        // Prevent multiple simultaneous restart attempts
        if (isConnecting.get()) {
            Log.w(TAG, "⚠️ Connection restart already in progress, ignoring")
            return
        }
        
        isConnecting.set(true)
        try {
            closeExistingConnection()
            delay(AppConfig.CONNECTION_CLEANUP_DELAY_MS)
            startSSEConnection()
        } finally {
            isConnecting.set(false)
        }
    }

    // 🔌 Main SSE connection method
    private suspend fun startSSEConnection() {
        if (!isRunning.get()) {
            Log.w(TAG, "⚠️ Service not running, skipping connection")
            return
        }
        
        if (isConnecting.get()) {
            Log.w(TAG, "⚠️ Connection already in progress, skipping")
            return
        }
        
        if (eventSource != null) {
            Log.w(TAG, "⚠️ Connection already exists, skipping")
            return
        }
        
        isConnecting.set(true)
        Log.d(TAG, "🔌 Starting fresh SSE connection")
        
        try {
            // 🔑 Priority: Use currentToken first, then database fallback
            val token = currentToken ?: getTokenSimple()
            val sseUrl = "${AppConfig.SSE_BASE_URL}${AppConfig.SSE_ENDPOINT}"
            
            val requestBuilder = Request.Builder()
                .url(sseUrl)
                .addHeader("Accept", "text/event-stream")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Connection", "keep-alive")
                .addHeader("User-Agent", AppConfig.USER_AGENT)

            token?.let { 
                requestBuilder.addHeader("Authorization", "Bearer $it")
            }
            
            // Log request headers for debugging
            val request = requestBuilder.build()
            Log.i(TAG, "🔗 SSE Request URL: ${request.url}")
            Log.i(TAG, "📋 Request Headers:")
            request.headers.forEach { (name, value) ->
               
                Log.i(TAG, "  $name: $value")
            }
            
            eventSource = EventSources.createFactory(httpClient)
                .newEventSource(requestBuilder.build(), createEventSourceListener())
                
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to create SSE connection: ${e.message}")
            scheduleReconnect()
        } finally {
            isConnecting.set(false)
        }
    }

    // 🎧 Event source listener
    private fun createEventSourceListener() = object : EventSourceListener() {
        override fun onOpen(eventSource: EventSource, response: Response) {
            Log.i(TAG, "✅ SSE connection opened successfully!")
            Log.i(TAG, "📊 Response: ${response.code} - ${response.headers["Content-Type"]}")
            
            // Reset reconnection attempts on successful connection
            reconnectAttempts.set(0)
            
            // Cancel any pending reconnect jobs
            reconnectJob?.cancel()
            reconnectJob = null
        }

        override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
            Log.i(TAG, "🎉 SSE Event received!")
            Log.d(TAG, "📨 Type: ${type ?: "default"}, Data length: ${data.length}")
            Log.i(TAG , "${type}")
            try {
                when (type) {
                    "notification", null -> processNotificationEvent(data)
                    "update" -> processNotificationEvent(data)
                    "ping", "heartbeat" -> Log.d(TAG, "💓 Heartbeat received")
                    else -> {
                        Log.d(TAG, "❓ Unknown event type: $type")
                        processNotificationEvent(data)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error processing event: ${e.message}")
            }
        }

        override fun onClosed(eventSource: EventSource) {
            Log.w(TAG, "⚠️ SSE connection closed")
            this@TokenBackgroundService.eventSource = null
            
            if (isRunning.get()) {
                Log.d(TAG, "🔄 Service running, scheduling reconnection")
                scheduleReconnect()
            }
        }

        override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
            Log.e(TAG, "❌ SSE connection failed: ${t?.message}")
            Log.e(TAG, "📊 Response: ${response?.code} - ${response?.message}")
            
            this@TokenBackgroundService.eventSource = null
            
            if (isRunning.get()) {
                Log.d(TAG, "🔄 Service running, scheduling reconnection")
                scheduleReconnect()
            }
        }
    }

    // 📨 Process notification events
    private fun processNotificationEvent(data: String) {
        Log.d(TAG, "🔍 Processing notification data")
            Log.d(TAG, "${data}")
        try {
            // Try parsing as JSON array first
            val jsonArray = org.json.JSONArray(data)
            if (jsonArray.length() > 0) {
                val lastItem = jsonArray.getJSONObject(jsonArray.length() - 1)
                val title = lastItem.optString("title", "ArkaFile")
                val body = lastItem.optString("body", "اعلان جدید")
                val type = lastItem.optString("type", "general")      // مقدار پیش‌فرض: general
                val details = lastItem.optString("details", "")       // مقدار پیش‌فرض: خالی
                val id = lastItem.optString("id")       // مقدار پیش‌فرض: خالی
            
                showNotification(title, body, type, details , id)
                return
            }
        } catch (arrayException: Exception) {
            try {
                // Try parsing as single JSON object
                val jsonObject = org.json.JSONObject(data)
                val title = jsonObject.optString("title", "ArkaFile")
                val body = jsonObject.optString("body", "اعلان جدید")
                val type = jsonObject.optString("type", "general")      // مقدار پیش‌فرض: general
                val details = jsonObject.optString("details", "")       // مقدار پیش‌فرض: خالی
                val id = jsonObject.optString("id")       // مقدار پیش‌فرض: خالی
                showNotification(title, body, type , details , id)
                return
            } catch (objectException: Exception) {
                Log.w(TAG, "⚠️ Failed to parse JSON, showing raw data")
                showNotification("ArkaFile", data.take(100) , "general" , "" ,"")
            }
        }
    }

    // 🔄 Intelligent reconnection scheduling
    private fun scheduleReconnect() {
        if (!isRunning.get()) {
            Log.d(TAG, "⏹️ Service not running, skipping reconnection")
            return
        }
        
        if (reconnectJob?.isActive == true) {
            Log.d(TAG, "⏰ Reconnection already scheduled")
            return
        }
        
        val currentAttempts = reconnectAttempts.incrementAndGet()
        val delayIndex = minOf(currentAttempts - 1, AppConfig.RECONNECT_DELAYS.size - 1)
        val delaySeconds = AppConfig.RECONNECT_DELAYS[delayIndex]
        
        Log.i(TAG, "🔄 Scheduling reconnection #$currentAttempts in ${delaySeconds}s")
        
        reconnectJob = serviceScope.launch {
            delay(delaySeconds * 1000)
            
            if (isRunning.get() && eventSource == null) {
                Log.i(TAG, "🔌 Executing scheduled reconnection")
                startSSEConnection()
            } else {
                Log.d(TAG, "⏭️ Skipping reconnection - service stopped or already connected")
            }
        }
    }

    // 🧹 Clean connection closure
    private suspend fun closeExistingConnection() {
        Log.d(TAG, "🧹 Closing existing connections")
        
        eventSource?.cancel()
        eventSource = null
        
        reconnectJob?.cancel()
        reconnectJob = null
        
        reconnectAttempts.set(0)
        
        Log.d(TAG, "✅ Connections cleaned up")
    }

    // 🌐 Network monitoring initialization
    private fun initializeNetworkMonitoring() {
        try {
            Log.i(TAG, "🌐 Initializing network monitoring")
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    Log.i(TAG, "🌐 Network available: $network")
                    
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastNetworkRecoveryTime.get() < AppConfig.NETWORK_RECOVERY_DEBOUNCE_MS) {
                        Log.d(TAG, "⏰ Network recovery debounced")
                        return
                    }
                    lastNetworkRecoveryTime.set(currentTime)
                    
                    serviceScope.launch {
                        delay(3000) // Wait for network stability
                        if (isRunning.get() && eventSource == null) {
                            Log.i(TAG, "🚀 Network available and no connection - starting SSE")
                            reconnectAttempts.set(0) // Reset attempts on network recovery
                            startSSEConnection()
                        }
                    }
                }
                
                override fun onLost(network: Network) {
                    Log.w(TAG, "🔴 Network lost: $network")
                }
            }
            
            val networkRequest = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                .build()
                
            connectivityManager?.registerNetworkCallback(networkRequest, networkCallback!!)
            Log.i(TAG, "✅ Network monitoring active")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to initialize network monitoring: ${e.message}")
        }
    }

    // 🐕 Watchdog for connection health
    private fun startWatchdog() {
        watchdogJob = serviceScope.launch {
            while (isRunning.get()) {
                delay(AppConfig.WATCHDOG_INTERVAL_MS)
                
                if (isRunning.get() && eventSource == null && !isConnecting.get()) {
                    Log.w(TAG, "🐕 Watchdog detected missing connection - reconnecting")
                    startSSEConnection()
                } else {
                    Log.d(TAG, "💓 Watchdog: Service healthy")
                }
            }
        }
    }

    // 🔋 Wake lock management
    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                AppConfig.WAKE_LOCK_TAG
            )
            wakeLock?.acquire()
            Log.i(TAG, "🔋 Wake lock acquired")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to acquire wake lock: ${e.message}")
        }
    }

    // 🗃️ Simple token retrieval with multiple database attempts
    private suspend fun getTokenSimple(): String? = withContext(Dispatchers.IO) {
        return@withContext try {
            // Try different database names
            val dbNames = listOf("RKStorage", "ReactNativeAsyncStorage", "mmkv", "default")
            
            for (dbName in dbNames) {
                try {
                    Log.d(TAG, "🔍 Trying DB: $dbName")
                    val db = openOrCreateDatabase(dbName, 0, null)
                    
                    // Try to find our table
                    val tables = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null)
                    Log.d(TAG, "📊 Tables in $dbName: ${tables.count}")
                    while (tables.moveToNext()) {
                        val tableName = tables.getString(0)
                        Log.d(TAG, "📋 Table: $tableName")
                        
                        if (tableName == "catalystLocalStorage") {
                            // List all keys
                            val allCursor = db.rawQuery("SELECT key FROM catalystLocalStorage", null)
                            Log.d(TAG, "📊 Keys: ${allCursor.count}")
                            while (allCursor.moveToNext()) {
                                Log.d(TAG, "🔑 Key: '${allCursor.getString(0)}'")
                            }
                            allCursor.close()
                            
                            // Try our key
                            val cursor = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf(AppConfig.TOKEN_KEY))
                            if (cursor.moveToFirst()) {
                                val value = cursor.getString(0)
                                Log.i(TAG, "✅ Found token in $dbName!")
                                cursor.close()
                                tables.close()
                                db.close()
                                
                                return@withContext try {
                                    org.json.JSONObject(value).optString("token", null)
                                } catch (e: Exception) {
                                    value.replace("\"", "")
                                }?.takeIf { it.isNotBlank() && it.length > 10 }
                            }
                            cursor.close()
                        }
                    }
                    tables.close()
                    db.close()
                } catch (e: Exception) {
                    Log.d(TAG, "❌ DB $dbName failed: ${e.message}")
                }
            }
            
            Log.w(TAG, "❌ No token found in any database")
            null
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ DB error: ${e.message}")
            null
        }
    }

    // 📱 Optimized notification system
    private fun showNotification(title: String, body: String, type: String, details: String , id: String) {
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    
            // 👇 Intent برای باز کردن MainActivity با داده‌ها
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("from_notification", true)
                putExtra("notification_title", title)
                putExtra("notification_body", body)
                putExtra("notification_type", type)
                putExtra("notification_details", details)
                putExtra("notification_id", id)
            }
    
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
    
            val notification = NotificationCompat.Builder(this, AppConfig.NOTIFICATION_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText("$body\n\n$details")
                        .setBigContentTitle(title)
                        .setSummaryText("ArkaFile - $type")
                )
                .setContentIntent(pendingIntent) // ← هم برای خود نوتیفیکیشن، هم اکشن
                .addAction(android.R.drawable.ic_menu_view, "مشاهده", pendingIntent)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true)
                .setAutoCancel(true)
                .build()
    
            notificationManager.notify(id.hashCode().absoluteValue, notification)
    
            Log.i(TAG, "✅ Notification displayed: $title ($type)")
    
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to show notification: ${e.message}")
        }
    }
    
    
    

    // 📱 Notification channel setup
    private fun initializeNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // High priority channel for notifications
            val notificationChannel = NotificationChannel(
                AppConfig.NOTIFICATION_CHANNEL_ID,
                AppConfig.NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "اعلانات مهم ArkaFile"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            
            // Low priority channel for service
            val serviceChannel = NotificationChannel(
                AppConfig.SERVICE_CHANNEL_ID,
                AppConfig.SERVICE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "سرویس پس‌زمینه ArkaFile"
                setShowBadge(false)
            }
            
            notificationManager.createNotificationChannel(notificationChannel)
            notificationManager.createNotificationChannel(serviceChannel)
        }
    }

    // 🔧 Service notification
    private fun createServiceNotification() = 
        NotificationCompat.Builder(this, AppConfig.SERVICE_CHANNEL_ID)
            .setContentTitle("ArkaFile")
            .setContentText("🔄 سرویس اعلانات فعال")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

    // 🔑 Set token directly and restart connection
    private fun handleSetToken(token: String) {
        serviceScope.launch {
            try {
                currentToken = token
                
                if (isRunning.get()) {
                    restartConnectionSafely()
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error setting token: ${e.message}")
            }
        }
    }

    // 🗑️ Clear token and restart connection
    private fun handleClearToken() {
        serviceScope.launch {
            try {
                currentToken = null
                
                if (isRunning.get()) {
                    restartConnectionSafely()
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing token: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "🛑 Service destroying")
        
        // Clean shutdown
        isRunning.set(false)
        
        serviceScope.launch {
            closeExistingConnection()
        }
        
        watchdogJob?.cancel()
        networkMonitorJob?.cancel()
        
        // Network monitoring cleanup
        try {
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error unregistering network callback: ${e.message}")
        }
        
        // Wake lock cleanup
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d(TAG, "🔋 Wake lock released")
            }
        }
        
        serviceScope.cancel()
        Log.i(TAG, "✅ Service destroyed cleanly")
    }
} 