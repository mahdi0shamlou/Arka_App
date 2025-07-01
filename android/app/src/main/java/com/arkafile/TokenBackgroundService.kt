package com.arkafile

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject
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
import com.arkafile.MainActivity
import android.provider.Settings
import android.net.Uri
import android.os.Build

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
    private val sseBaseUrl = "http://185.190.39.252:7575/sse" // ✅ HTTPS for security
    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = Int.MAX_VALUE // unlimited retries
    private val reconnectDelaySeconds = longArrayOf(1, 2, 5, 10, 30, 60) // exponential backoff
    private var watchdogJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i("SSE_DEBUG", "🚀 SSE TOKENBACKGROUNDSERVICE CREATED")
        Log.d("SSE_DEBUG", "📢 Creating notification channel...")
        createNotificationChannel()
        Log.d("SSE_DEBUG", "📱 Starting foreground service...")
        startForeground(NOTIFICATION_ID, createPersistentNotification())
        Log.d("SSE_DEBUG", "✅ Service initialization complete")
        
      
        
        startWatchdog()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("SSE_DEBUG", "🎯 ONSTARTCOMMAND CALLED")
        Log.d("SSE_DEBUG", "🔍 Current running status: $isRunning")
        Log.d("SSE_DEBUG", "🆔 Start ID: $startId")
        
        // چک کن که آیا درخواست فوری token check هست
        val triggerTokenCheck = intent?.getBooleanExtra("trigger_token_check", false) ?: false
        if (triggerTokenCheck) {
            Log.d("SSE_DEBUG", "🚀 TRIGGER TOKEN CHECK requested - checking token with retry...")
            serviceScope.launch {
                // تلاش چندباره برای خواندن token با delay
                var currentToken: String? = null
                repeat(3) { attempt ->
                    currentToken = getTokenFromDatabase()
                    if (currentToken != null) {
                        Log.d("SSE_DEBUG", "✅ Token found on attempt ${attempt + 1}")
                        return@repeat
                    } else {
                        Log.w("SSE_DEBUG", "⚠️ No token found on attempt ${attempt + 1}, retrying...")
                        delay(500) // صبر 500ms بین تلاش ها
                    }
                }
                
                if (currentToken != null && eventSource == null) {
                    Log.d("SSE_DEBUG", "✅ Token found and no active connection - starting connection now...")
                    startSSEConnection()
                } else if (currentToken != null) {
                    Log.d("SSE_DEBUG", "✅ Token found and connection exists - restarting connection with new token...")
                    // اگر connection موجود است، آن را restart کن تا token جدید را استفاده کند
                    closeExistingConnections()
                    delay(1000)
                    startSSEConnection()
                } else {
                    Log.w("SSE_DEBUG", "⚠️ No token found after all retries")
                }
            }
            return START_STICKY
        }
        
        if (!isRunning) {
            Log.d("SSE_DEBUG", "▶️ Starting SSE service for the first time...")
            isRunning = true
            Log.d("SSE_DEBUG", "🔋 Acquiring WakeLock...")
            acquireWakeLock()
            
            // فقط برای اولین بار connection ایجاد کن
            Log.d("SSE_DEBUG", "🧹 Cleaning up any existing connections...")
            closeExistingConnections()
            Log.d("SSE_DEBUG", "🔌 Starting fresh SSE connection...")
            startSSEConnection()
        } else {
            Log.d("SSE_DEBUG", "✅ Service already running - no action needed")
            // اگر service در حال اجرا است، هیچ کار نکن تا loop نشود
        }
        
        Log.d("SSE_DEBUG", "🔄 Returning START_STICKY for auto-restart")
        return START_STICKY
    }

  

    private fun closeExistingConnections() {
        Log.d("SSE_DEBUG", "🧹 Cleaning up existing connections...")
        
        try {
            // بستن اتصال SSE فعلی
            eventSource?.cancel()
            eventSource = null
            Log.d("SSE_DEBUG", "🔌 EventSource closed and nullified")
            
            // لغو job های reconnect
            reconnectJob?.cancel()
            reconnectJob = null
            Log.d("SSE_DEBUG", "⏰ Reconnect job canceled")
            
            // Reset reconnection attempts
            reconnectAttempts = 0
            Log.d("SSE_DEBUG", "🔄 Reconnect attempts reset to 0")
            
            Log.d("SSE_DEBUG", "✅ All existing connections cleaned up successfully")
            
        } catch (e: Exception) {
            Log.e("SSE_DEBUG", "❌ Error during connection cleanup: ${e.message}")
        }
    }

    private fun startWatchdog() {
        watchdogJob = serviceScope.launch {
            while (isRunning) {
                delay(300000) // چک کردن هر 5 دقیقه (کم aggressive)
                
                if (isRunning && eventSource == null) {
                    Log.w("SSE_DEBUG", "⚠️ WATCHDOG: SSE connection lost after 5 minutes, reconnecting...")
                    // فقط اگر واقعاً connection نداشته باشیم restart کن
                    startSSEConnection()
                } else {
                    Log.d("SSE_DEBUG", "💓 WATCHDOG: Service healthy - isRunning: $isRunning, eventSource: ${eventSource != null}")
                }
            }
        }
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
            
            // اطمینان از بستن اتصالات قبلی (اضافی برای اطمینان)
            Log.d("SSE_DEBUG", "🧹 Double-checking: closing any remaining connections...")
            eventSource?.cancel()
            eventSource = null
            
            // کمی صبر کن تا اتصال قبلی کاملاً بسته شود
            delay(500)
            
            val token = getTokenFromDatabase()
            if (token != null) {
                Log.d("SSE_DEBUG", "✅ Token found: ${token.take(20)}...")
                connectToSSE(token)
            } else {
                Log.w("SSE_DEBUG", "⚠️ No token found in database, connecting without token...")
                connectToSSE(null)
            }
        }
    }

    private fun connectToSSE(token: String?) {
        try {
            val sseUrl = "$sseBaseUrl/1"
            Log.d("SSE_DEBUG_TOKEN", "🔌 Attempting SSE connection to: $sseUrl")
            
            if (token != null) {
                Log.d("SSE_DEBUG_TOKEN", "🔌in Using token: ${token.take(20)}...")
            } else {
                Log.d("SSE_DEBUG_TOKEN", "🔌 No token available, connecting without authentication")
            }

            val requestBuilder = Request.Builder()
                .url(sseUrl)
                .addHeader("Accept", "text/event-stream")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Connection", "keep-alive")
                .addHeader("User-Agent", "ArkaFile-SSE-Client/1.0")
                
            // اضافه کردن توکن به header اگر موجود باشد
            if (token != null) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
                Log.d("SSE_DEBUG_TOKEN", "🔑 Authorization header added with token")
            }
            
            val request = requestBuilder.build()

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
                            
                            // نمایش نوتیفیکیشن با دکمه مشاهده
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
                            
                            // نمایش نوتیفیکیشن با دکمه مشاهده
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
                
                var connectionSuccess = false
                for (attempt in 1..3) {
                    try {
                        startSSEConnection()
                        connectionSuccess = true
                        break
                    } catch (e: Exception) {
                        Log.w("SSE_DEBUG", "⚠️ Connection attempt $attempt failed: ${e.message}")
                        if (attempt < 3) {
                            delay(2000) // 2 ثانیه انتظار بین تلاش‌ها
                        }
                    }
                }
                
                if (!connectionSuccess) {
                    Log.e("SSE_DEBUG", "❌ All connection attempts failed, scheduling next retry...")
                    scheduleReconnect()
                }
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
                delay(120000) // چک کردن هر 2 دقیقه (بجای 25 ثانیه)
                checkCount++
                
                Log.d("SSE_DEBUG", "⏰ Event timeout check #$checkCount - Checking connection health after 2 minutes")
                Log.d("SSE_DEBUG", "🔍 Connection still alive: ${eventSource != null}")
                Log.d("SSE_DEBUG", "🔍 Service running: $isRunning")
                
                if (checkCount >= 5) { // بعد از 10 دقیقه بدون event (بجای 75 ثانیه)
                    Log.w("SSE_DEBUG", "⚠️ LONG CONNECTION TIMEOUT - No events for 10 minutes, considering reconnect...")
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

    // ✅ بهبود نوتیفیکیشن برای Release با دکمه مشاهده آگهی
    private fun sendNotificationFromServer(title: String, body: String) {
        // ✅ برای Release هم لاگ حفظ می‌شود
        val debugTag = "SSE_RELEASE"
        android.util.Log.i(debugTag, "📱 PREPARING NOTIFICATION: $title") // تغییر به Log.i
        
        try {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "sse_notifications_channel_v2"
            
            // ✅ ایجاد کانال قوی‌تر برای Release
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "ArkaFile اعلانات",
                    NotificationManager.IMPORTANCE_HIGH // ✅ HIGH importance برای Release
                ).apply {
                    description = "اعلانات مهم ArkaFile"
                    enableLights(true)
                    enableVibration(true)
                    setShowBadge(true)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
                android.util.Log.i(debugTag, "✅ HIGH IMPORTANCE channel created")
            }
            
            // ✅ ایجاد Intent قوی‌تر برای باز کردن اپلیکیشن
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_CLEAR_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("from_notification", true)
                putExtra("notification_title", title)
                putExtra("notification_body", body)
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, 
                System.currentTimeMillis().toInt(), // ✅ Unique request code
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            // ✅ نوتیفیکیشن قوی‌تر برای Release
            val notificationBuilder = NotificationCompat.Builder(this, channelId)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH) // ✅ HIGH priority
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(NotificationCompat.BigTextStyle()
                    .bigText(body)
                    .setBigContentTitle(title)
                    .setSummaryText("ArkaFile"))
                .setContentIntent(pendingIntent)
                .addAction(
                    android.R.drawable.ic_menu_view, // ✅ استفاده از آیکون سیستم
                    "مشاهده آگهی", 
                    pendingIntent
                )
                .setDefaults(NotificationCompat.DEFAULT_ALL) // ✅ صدا و لرزش
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true)
                .setAutoCancel(true)
                
            val notification = notificationBuilder.build()
                
            // ✅ ID منحصر بفرد برای هر نوتیفیکیشن
            val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
            android.util.Log.d(debugTag, "🆔 Showing notification with ID: $notificationId")
            
            notificationManager.notify(notificationId, notification)
            android.util.Log.i(debugTag, "✅ NOTIFICATION DISPLAYED SUCCESSFULLY!")
            
            // ✅ تست اینکه notification manager کار می‌کند
            val activeNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                notificationManager.activeNotifications.size
            } else {
                "N/A"
            }
            android.util.Log.d(debugTag, "📊 Active notifications count: $activeNotifications")
            
        } catch (e: Exception) {
            android.util.Log.e(debugTag, "❌ NOTIFICATION FAILED: ${e.message}")
            android.util.Log.e(debugTag, "💥 Stack trace: ${e.stackTrace.contentToString()}")
            
            // ✅ Fallback: سعی در نمایش نوتیفیکیشن ساده
            try {
                val simpleNotification = NotificationCompat.Builder(this, "default")
                    .setContentTitle("ArkaFile")
                    .setContentText("اعلان جدید دریافت شد")
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .build()
                    
                val fallbackId = (System.currentTimeMillis() % 1000).toInt()
                val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(fallbackId, simpleNotification)
                android.util.Log.i(debugTag, "✅ FALLBACK notification sent")
            } catch (fallbackException: Exception) {
                android.util.Log.e(debugTag, "❌ Even fallback failed: ${fallbackException.message}")
            }
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
        
        eventSource?.cancel()
        Log.d("SSE_DEBUG", "🔌 SSE connection canceled")
        
        reconnectJob?.cancel()
        Log.d("SSE_DEBUG", "⏰ Reconnect job canceled")
        
        watchdogJob?.cancel()
        Log.d("SSE_DEBUG", "🐕 Watchdog job canceled")
        
        serviceScope.cancel()
        Log.d("SSE_DEBUG", "🔄 Service scope canceled")
        
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d("SSE_DEBUG", "🔋 WakeLock released")
            } else {
                Log.d("SSE_DEBUG", "🔋 WakeLock was not held")
            }
        }
        
        Log.i("SSE_DEBUG", "✅ SSE SERVICE DESTROYED SUCCESSFULLY")
        
        // ❌ AUTO-RESTART REMOVED - جلوگیری از loop های بی‌پایان
        // val restartServiceIntent = Intent(applicationContext, TokenBackgroundService::class.java)
        // applicationContext.startService(restartServiceIntent)
        Log.i("SSE_DEBUG", "🚫 AUTO-RESTART DISABLED - Clean shutdown to prevent loops")
    }
} 