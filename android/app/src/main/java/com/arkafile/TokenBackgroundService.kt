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
import java.io.IOException
import android.os.PowerManager
import android.content.Context

class TokenBackgroundService : Service() {
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false
    private val httpClient = OkHttpClient()
    private val NOTIFICATION_ID = 1
    private val CHANNEL_ID = "TOKEN_SERVICE_CHANNEL"
    private var wakeLock: PowerManager.WakeLock? = null
    private val mainUrl = "https://back.arkafile.info" // قابل تغییر

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.d("TokenBackgroundService", "🚀 TokenBackgroundService Created")
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createPersistentNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isRunning) {
            isRunning = true
            acquireWakeLock()
            startTokenChecking()
        }
        
        return START_STICKY
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ArkaFile::TokenService"
            )
            wakeLock?.acquire()
            Log.d("TokenBackgroundService", "🔒 WakeLock acquired")
        } catch (e: Exception) {
            Log.e("TokenBackgroundService", "Failed to acquire WakeLock: ${e.message}")
        }
    }

    private fun startTokenChecking() {
        serviceScope.launch {
            while (isRunning) {
                try {
                    checkAndLogToken()
                    delay(180000) // هر 20 ثانیه چک کن
                } catch (e: Exception) {
                    Log.e("TokenBackgroundService", "Error in background check: ${e.message}")
                    delay(180000)
                }
            }
        }
    }

    private fun checkAndLogToken() {
        try {
            val token = getTokenFromDatabase()
            Log.i("TOKEN_BACKGROUND", if (token != null) "✅ Token available" else "⚠️ No token found")
            
            // درخواست HTTP به سرور (در هر صورت ارسال می‌شود)
            makeNotificationRequest(token)
        } catch (e: Exception) {
            Log.e("TOKEN_BACKGROUND", "Background token check failed: ${e.message}")
        }
    }

    private fun getTokenFromDatabase(): String? {
        return try {
            val db = applicationContext.openOrCreateDatabase("RKStorage", 0, null)
            val cursor = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf("app_token"))
            
            if (cursor.moveToFirst()) {
                val jsonValue = cursor.getString(0)
                cursor.close()
                db.close()
                
                val jsonObject = JSONObject(jsonValue)
                return jsonObject.getString("token")
            }
            
            cursor.close()
            db.close()
            null
        } catch (e: Exception) {
            Log.e("TOKEN_BACKGROUND", "Error reading token: ${e.message}")
            null
        }
    }

    private fun sendNotificationFromServer(title: String, body: String) {
        try {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "server_notifications_channel"
            
            // ایجاد کانال نوتیفیکیشن برای Android 8+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Server Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
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
            notificationManager.notify(notificationId, notification)
            Log.d("TOKEN_BACKGROUND", "📱 Server notification sent - Title: $title, Body: $body")
            
        } catch (e: Exception) {
            Log.e("TOKEN_BACKGROUND", "Failed to send server notification: ${e.message}")
        }
    }

    private fun makeNotificationRequest(token: String?) {
        serviceScope.launch {
            try {
                val requestBuilder = Request.Builder()
                    .url("$mainUrl/Notifications")
                
                // اگر توکن موجود بود، در هدر قرار بده
                if (token != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                }
                
                val request = requestBuilder.build()

                httpClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.d("TOKEN_BACKGROUND", "❌ Notifications request failed: ${e.message}")
                    }

                    override fun onResponse(call: Call, response: Response) {
                        response.use {
                            if (response.isSuccessful) {
                                try {
                                    val responseBody = response.body?.string()
                                    if (responseBody != null) {
                                        val jsonResponse = JSONObject(responseBody)
                                        val title = jsonResponse.optString("title", "ArkaFile")
                                        val body = jsonResponse.optString("body", "اعلان جدید")
                                        
                                        Log.d("TOKEN_BACKGROUND", "✅ Notifications request successful - Title: $title, Body: $body")
                                        // ارسال نوتیفیکیشن با title و body از سرور
                                        sendNotificationFromServer(title, body)
                                    } else {
                                        Log.d("TOKEN_BACKGROUND", "✅ Notifications request successful but empty response")
                                    }
                                } catch (e: Exception) {
                                    Log.e("TOKEN_BACKGROUND", "Error parsing notifications response: ${e.message}")
                                }
                            } else {
                                Log.d("TOKEN_BACKGROUND", "❌ Notifications request failed with code: ${response.code}")
                            }
                        }
                    }
                })
                
            } catch (e: Exception) {
                Log.e("TOKEN_BACKGROUND", "Error making notifications request: ${e.message}")
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ArkaFile Background Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "سرویس اعلانات "
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createPersistentNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("ArkaFile")
        .setContentText("سرویس اعلانات فعال است")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setOngoing(true)
        .setShowWhen(false)
        .build()

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // سرویس را دوباره راه‌اندازی کن اگر task حذف شد
        val restartServiceIntent = Intent(applicationContext, TokenBackgroundService::class.java)
        restartServiceIntent.setPackage(packageName)
        
        val restartPendingIntent = android.app.PendingIntent.getService(
            this, 1, restartServiceIntent, 
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        
        val alarmManager = getSystemService(android.content.Context.ALARM_SERVICE) as android.app.AlarmManager
        alarmManager.set(
            android.app.AlarmManager.ELAPSED_REALTIME,
            android.os.SystemClock.elapsedRealtime() + 1000,
            restartPendingIntent
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        serviceScope.cancel()
        
        // Release WakeLock
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    Log.d("TokenBackgroundService", "🔓 WakeLock released")
                }
            }
        } catch (e: Exception) {
            Log.e("TokenBackgroundService", "Failed to release WakeLock: ${e.message}")
        }
        
        Log.d("TokenBackgroundService", "🛑 Background Service Destroyed")
    }
} 