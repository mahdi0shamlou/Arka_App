package com.arkafile

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject
import android.app.NotificationManager
import android.app.NotificationChannel
import android.os.Build
import androidx.core.app.NotificationCompat
import okhttp3.*
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import android.os.PowerManager
import android.content.Context

class TokenBackgroundService : Service() {
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS) // SSE needs infinite read timeout
        .addInterceptor { chain ->
            val request = chain.request()
            Log.d("SSE_DEBUG", "🌐 HTTP Request: ${request.method} ${request.url}")
            
            val response = chain.proceed(request)
            Log.d("SSE_DEBUG", "🌐 HTTP Response: ${response.code} ${response.message}")
            
            // لاگ کردن response body اگر content-type مناسب باشد
            val contentType = response.header("Content-Type")
            if (contentType?.contains("text/event-stream") == true) {
                Log.d("SSE_DEBUG", "📡 SSE Response detected!")
                
                // لاگ کردن headerهای response
                Log.d("SSE_DEBUG", "📋 All Response Headers:")
                response.headers.forEach { header ->
                    Log.d("SSE_DEBUG", "   ${header.first}: ${header.second}")
                }
            }
            
            response
        }
        .build()
    private val NOTIFICATION_ID = 1
    private val CHANNEL_ID = "TOKEN_SERVICE_CHANNEL"
    private var wakeLock: PowerManager.WakeLock? = null
    private val sseBaseUrl = "http://185.190.39.252:7575/sse" // SSE endpoint
    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = Int.MAX_VALUE // unlimited retries
    private val reconnectDelaySeconds = longArrayOf(1, 2, 5, 10, 30, 60) // exponential backoff

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i("SSE_DEBUG", "🚀 SSE TOKENBACKGROUNDSERVICE CREATED")
        Log.d("SSE_DEBUG", "📢 Creating notification channel...")
        createNotificationChannel()
        Log.d("SSE_DEBUG", "📱 Starting foreground service...")
        startForeground(NOTIFICATION_ID, createPersistentNotification())
        Log.d("SSE_DEBUG", "✅ Service initialization complete")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("SSE_DEBUG", "🎯 ONSTARTCOMMAND CALLED")
        Log.d("SSE_DEBUG", "🔍 Current running status: $isRunning")
        Log.d("SSE_DEBUG", "🆔 Start ID: $startId")
        
        if (!isRunning) {
            Log.d("SSE_DEBUG", "▶️ Starting SSE service...")
            isRunning = true
            Log.d("SSE_DEBUG", "🔋 Acquiring WakeLock...")
            acquireWakeLock()
            Log.d("SSE_DEBUG", "🔌 Starting SSE connection...")
            startSSEConnection()
        } else {
            Log.d("SSE_DEBUG", "⏩ Service already running, skipping initialization")
        }
        
        Log.d("SSE_DEBUG", "🔄 Returning START_STICKY for auto-restart")
        return START_STICKY
    }

    private fun acquireWakeLock() {
        Log.d("SSE_DEBUG", "🔋 ACQUIRING WAKELOCK...")
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            Log.d("SSE_DEBUG", "⚡ PowerManager service obtained")
            
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ArkaFile::SSEService"
            )
            Log.d("SSE_DEBUG", "🔒 WakeLock created with tag: ArkaFile::SSEService")
            
            wakeLock?.acquire()
            Log.i("SSE_DEBUG", "✅ WAKELOCK ACQUIRED SUCCESSFULLY")
        } catch (e: Exception) {
            Log.e("SSE_DEBUG", "❌ FAILED TO ACQUIRE WAKELOCK: ${e.message}")
            Log.e("SSE_DEBUG", "💥 Exception type: ${e.javaClass.simpleName}")
        }
    }

    private fun startSSEConnection() {
        serviceScope.launch {
            Log.d("SSE_DEBUG", "🔍 Starting SSE connection process...")
            val token = getTokenFromDatabase()
            if (token != null) {
                Log.d("SSE_DEBUG", "✅ Token found: ${token.take(20)}...")
                connectToSSE(token)
            } else {
                Log.w("SSE_DEBUG", "⚠️ No token found in database, retrying in 10 seconds...")
                scheduleReconnect(10000) // retry in 10 seconds
            }
        }
    }

    private fun connectToSSE(token: String) {
        try {
            val sseUrl = "$sseBaseUrl/1"
            Log.d("SSE_DEBUG", "🔌 Attempting SSE connection to: $sseUrl")
            Log.d("SSE_DEBUG", "🔌 Using token: ${token.take(20)}...")

            val request = Request.Builder()
                .url(sseUrl)
                .addHeader("Accept", "text/event-stream")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Connection", "keep-alive")
                .addHeader("User-Agent", "ArkaFile-SSE-Client/1.0")
                .build()

            Log.d("SSE_DEBUG", "📡 Request headers: Accept=text/event-stream, Cache-Control=no-cache")

            eventSource = EventSources.createFactory(httpClient)
                .newEventSource(request, object : EventSourceListener() {
                    
                    override fun onOpen(eventSource: EventSource, response: Response) {
                        Log.i("SSE_DEBUG", "✅ SSE CONNECTION OPENED SUCCESSFULLY!")
                        Log.i("SSE_DEBUG", "📊 Response code: ${response.code}")
                        Log.i("SSE_DEBUG", "📊 Response headers: ${response.headers}")
                        
                        // بررسی Content-Type برای اطمینان از صحت
                        val contentType = response.header("Content-Type")
                        Log.d("SSE_DEBUG", "📋 Content-Type: $contentType")
                        
                        // بررسی سایر headerهای مهم
                        val connection = response.header("Connection")
                        val transferEncoding = response.header("Transfer-Encoding")
                        Log.d("SSE_DEBUG", "🔗 Connection: $connection")
                        Log.d("SSE_DEBUG", "📦 Transfer-Encoding: $transferEncoding")
                        
                        reconnectAttempts = 0 // reset retry counter on success
                        
                        // ثبت زمان اتصال برای debugging
                        Log.d("SSE_DEBUG", "⏰ Connection established at: ${System.currentTimeMillis()}")
                        Log.d("SSE_DEBUG", "👂 Now listening for events...")
                        
                        // شروع یک timer برای چک کردن event timeout
                        startEventTimeoutChecker()
                    }

                    override fun onEvent(
                        eventSource: EventSource,
                        id: String?,
                        type: String?,
                        data: String
                    ) {
                        val currentTime = System.currentTimeMillis()
                        Log.i("SSE_DEBUG", "🎉 EVENT RECEIVED! Time: $currentTime")
                        Log.i("SSE_DEBUG", "📨 NEW SSE EVENT RECEIVED!")
                        Log.d("SSE_DEBUG", "🆔 Event ID: $id")
                        Log.d("SSE_DEBUG", "🏷️ Event Type: ${type ?: "default"}")
                        Log.d("SSE_DEBUG", "📄 Raw Data Length: ${data.length} characters")
                        Log.d("SSE_DEBUG", "📄 Raw Data: $data")
                        Log.d("SSE_DEBUG", "🔥 THIS PROVES EVENTS ARE WORKING!")
                        
                        // شناسایی نوع event
                        when (type) {
                            "notification", null -> {
                                Log.d("SSE_DEBUG", "🔔 Processing NOTIFICATION event")
                                processNotificationEvent(data)
                            }
                            "update" -> {
                                Log.d("SSE_DEBUG", "🔄 Processing UPDATE event")
                                processNotificationEvent(data) // فعلاً مثل notification
                            }
                            "ping", "heartbeat" -> {
                                Log.d("SSE_DEBUG", "💓 Processing HEARTBEAT event")
                                // heartbeat event - فقط نگه‌داری اتصال
                            }
                            else -> {
                                Log.d("SSE_DEBUG", "❓ Processing UNKNOWN event type: $type")
                                processNotificationEvent(data) // default behavior
                            }
                        }
                    }
                    
                private fun processNotificationEvent(data: String) {
                    Log.d("SSE_DEBUG", "🔍 Processing notification data...")
                    
                    try {
                        Log.d("SSE_DEBUG", "🔍 Attempting to parse as JSON array...")
                        
                        // تلاش برای پارس به عنوان آرایه
                        val jsonArray = org.json.JSONArray(data)
                        Log.d("SSE_DEBUG", "✅ JSON Array parsed successfully!")
                        Log.d("SSE_DEBUG", "📊 Array length: ${jsonArray.length()}")
                        
                        if (jsonArray.length() > 0) {
                            // گرفتن آخرین آیتم از آرایه
                            val lastIndex = jsonArray.length() - 1
                            val lastItem = jsonArray.getJSONObject(lastIndex)
                            
                            Log.d("SSE_DEBUG", "🎯 Using last item (index $lastIndex): $lastItem")
                            
                            val title = lastItem.optString("title", "ArkaFile")
                            val body = lastItem.optString("body", "اعلان جدید")
                            
                            Log.d("SSE_DEBUG", "✅ Last item parsed - Title: '$title', Body: '$body'")
                            
                            // نمایش نوتیفیکیشن
                            sendNotificationFromServer(title, body)
                            
                        } else {
                            Log.w("SSE_DEBUG", "⚠️ JSON Array is empty, no notification to show")
                        }
                        
                    } catch (arrayException: Exception) {
                        Log.d("SSE_DEBUG", "📝 Not a JSON array, trying as single object...")
                        
                        try {
                            // تلاش برای پارس به عنوان آبجکت واحد
                            val jsonData = org.json.JSONObject(data)
                            Log.d("SSE_DEBUG", "✅ JSON Object parsed successfully!")
                            
                            val title = jsonData.optString("title", "ArkaFile")
                            val body = jsonData.optString("body", "اعلان جدید")
                            
                            Log.d("SSE_DEBUG", "✅ Single object parsed - Title: '$title', Body: '$body'")
                            
                            // نمایش نوتیفیکیشن
                            sendNotificationFromServer(title, body)
                            
                        } catch (objectException: Exception) {
                            Log.e("SSE_DEBUG", "❌ JSON Parse Failed (both array and object):")
                            Log.e("SSE_DEBUG", "💥 Array error: ${arrayException.message}")
                            Log.e("SSE_DEBUG", "💥 Object error: ${objectException.message}")
                            Log.d("SSE_DEBUG", "🔄 Showing raw data as notification...")
                            
                            // در صورت خطا در پارس، نوتیفیکیشن پیش‌فرض نمایش دهیم
                            sendNotificationFromServer("ArkaFile", data.take(100))
                        }
                    }
                }

                    override fun onClosed(eventSource: EventSource) {
                        Log.w("SSE_DEBUG", "⚠️ SSE CONNECTION CLOSED!")
                        Log.d("SSE_DEBUG", "🔍 Service running status: $isRunning")
                        if (isRunning) {
                            Log.d("SSE_DEBUG", "🔄 Scheduling reconnection...")
                            scheduleReconnect()
                        } else {
                            Log.d("SSE_DEBUG", "⏹️ Service not running, skipping reconnection")
                        }
                    }

                    override fun onFailure(
                        eventSource: EventSource,
                        t: Throwable?,
                        response: Response?
                    ) {
                        Log.e("SSE_DEBUG", "❌ SSE CONNECTION FAILED!")
                        Log.e("SSE_DEBUG", "💥 Error: ${t?.message}")
                        Log.e("SSE_DEBUG", "💥 Error Type: ${t?.javaClass?.simpleName}")
                        Log.e("SSE_DEBUG", "📊 Response Code: ${response?.code}")
                        Log.e("SSE_DEBUG", "📊 Response Message: ${response?.message}")
                        Log.d("SSE_DEBUG", "🔍 Service running status: $isRunning")
                        if (isRunning) {
                            Log.d("SSE_DEBUG", "🔄 Scheduling reconnection...")
                            scheduleReconnect()
                        } else {
                            Log.d("SSE_DEBUG", "⏹️ Service not running, skipping reconnection")
                        }
                    }
                })

        } catch (e: Exception) {
            Log.e("SSE_DEBUG", "❌ ERROR CREATING SSE CONNECTION: ${e.message}")
            Log.e("SSE_DEBUG", "💥 Exception type: ${e.javaClass.simpleName}")
            Log.e("SSE_DEBUG", "🔄 Scheduling reconnection due to exception...")
            scheduleReconnect()
        }
    }

    private fun scheduleReconnect(customDelay: Long? = null) {
        Log.d("SSE_DEBUG", "🔄 SCHEDULING SSE RECONNECTION...")
        reconnectJob?.cancel()
        
        val delay = customDelay ?: getReconnectDelay()
        Log.i("SSE_DEBUG", "⏰ Reconnect delay: ${delay/1000} seconds (attempt ${reconnectAttempts + 1})")
        
        reconnectJob = serviceScope.launch {
            Log.d("SSE_DEBUG", "⏳ Waiting ${delay/1000} seconds before reconnection...")
            delay(delay)
            if (isRunning) {
                reconnectAttempts++
                Log.d("SSE_DEBUG", "🔄 Starting reconnection attempt #$reconnectAttempts")
                startSSEConnection()
            } else {
                Log.d("SSE_DEBUG", "⏹️ Service stopped during delay, canceling reconnection")
            }
        }
    }

    private fun getReconnectDelay(): Long {
        val index = minOf(reconnectAttempts, reconnectDelaySeconds.size - 1)
        return reconnectDelaySeconds[index] * 1000L
    }
    
    private fun startEventTimeoutChecker() {
        serviceScope.launch {
            Log.d("SSE_DEBUG", "⏰ Starting event timeout checker...")
            var checkCount = 0
            
            while (isRunning && eventSource != null) {
                delay(25000) // چک کردن هر 25 ثانیه (5 ثانیه بیشتر از timing سرور)
                checkCount++
                
                Log.w("SSE_DEBUG", "⚠️ Event timeout check #$checkCount - NO EVENTS received in last 25 seconds!")
                Log.d("SSE_DEBUG", "🔍 Connection still alive: ${eventSource != null}")
                Log.d("SSE_DEBUG", "🔍 Service running: $isRunning")
                
                if (checkCount >= 3) { // بعد از 75 ثانیه بدون event
                    Log.e("SSE_DEBUG", "❌ FORCING RECONNECTION - No events for 75 seconds!")
                    eventSource?.cancel()
                    scheduleReconnect(5000)
                    break
                }
            }
        }
    }

    private fun getTokenFromDatabase(): String? {
        Log.d("SSE_DEBUG", "🔍 Reading token from database...")
        return try {
            val db = applicationContext.openOrCreateDatabase("RKStorage", 0, null)
            Log.d("SSE_DEBUG", "📂 Database opened successfully")
            
            val cursor = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf("app_token"))
            Log.d("SSE_DEBUG", "🔍 Query executed, checking results...")
            
            if (cursor.moveToFirst()) {
                val jsonValue = cursor.getString(0)
                Log.d("SSE_DEBUG", "✅ Token JSON found: ${jsonValue.take(50)}...")
                cursor.close()
                db.close()
                
                val jsonObject = JSONObject(jsonValue)
                val token = jsonObject.getString("token")
                Log.d("SSE_DEBUG", "✅ Token extracted: ${token.take(20)}...")
                return token
            }
            
            Log.w("SSE_DEBUG", "⚠️ No token found in database")
            cursor.close()
            db.close()
            null
        } catch (e: Exception) {
            Log.e("SSE_DEBUG", "❌ Error reading token: ${e.message}")
            Log.e("SSE_DEBUG", "💥 Exception type: ${e.javaClass.simpleName}")
            null
        }
    }

    private fun sendNotificationFromServer(title: String, body: String) {
        Log.d("SSE_DEBUG", "📱 PREPARING TO SEND NOTIFICATION")
        Log.d("SSE_DEBUG", "📝 Title: '$title'")
        Log.d("SSE_DEBUG", "📄 Body: '$body'")
        
        try {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "sse_notifications_channel"
            
            // ایجاد کانال نوتیفیکیشن برای Android 8+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d("SSE_DEBUG", "📢 Creating notification channel for Android 8+")
                val channel = NotificationChannel(
                    channelId,
                    "SSE Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
                channel.description = "اعلانات دریافتی از SSE"
                notificationManager.createNotificationChannel(channel)
            }
            
            val notification = NotificationCompat.Builder(this, channelId)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .build()
                
            // استفاده از timestamp برای ایجاد ID منحصر بفرد
            val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
            Log.d("SSE_DEBUG", "🆔 Notification ID: $notificationId")
            
            notificationManager.notify(notificationId, notification)
            Log.i("SSE_DEBUG", "✅ NOTIFICATION SENT SUCCESSFULLY!")
            
        } catch (e: Exception) {
            Log.e("SSE_DEBUG", "❌ FAILED TO SEND NOTIFICATION: ${e.message}")
            Log.e("SSE_DEBUG", "💥 Exception type: ${e.javaClass.simpleName}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ArkaFile SSE Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "سرویس اعلانات SSE آرکافایل"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createPersistentNotification() = 
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ArkaFile")
            .setContentText("🔄 در حال اتصال به سرویس اعلانات...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

    override fun onDestroy() {
        super.onDestroy()
        Log.i("SSE_DEBUG", "🛑 SSE SERVICE DESTROYING...")
        
        isRunning = false
        Log.d("SSE_DEBUG", "⏹️ Service running status set to false")
        
        // بستن اتصال SSE
        eventSource?.cancel()
        Log.d("SSE_DEBUG", "🔌 SSE connection canceled")
        
        // لغو reconnect job
        reconnectJob?.cancel()
        Log.d("SSE_DEBUG", "⏰ Reconnect job canceled")
        
        // لغو scope
        serviceScope.cancel()
        Log.d("SSE_DEBUG", "🔄 Service scope canceled")
        
        // آزاد کردن WakeLock
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d("SSE_DEBUG", "🔋 WakeLock released")
            } else {
                Log.d("SSE_DEBUG", "🔋 WakeLock was not held")
            }
        }
        
        Log.i("SSE_DEBUG", "✅ SSE SERVICE DESTROYED SUCCESSFULLY")
    }
} 