package com.arka.file

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject

class TokenBackgroundService : Service() {
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isRunning = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("TokenBackgroundService", "🚀 Background Service Started")
        
        if (!isRunning) {
            isRunning = true
            startTokenChecking()
        }
        
        return START_STICKY // Service رو دوباره راه‌اندازی کن اگه کشته شد
    }

    private fun startTokenChecking() {
        serviceScope.launch {
            while (isRunning) {
                try {
                    checkAndLogToken()
                    delay(15000) // هر 15 ثانیه چک کن
                } catch (e: Exception) {
                    Log.e("TokenBackgroundService", "Error in background check: ${e.message}")
                    delay(15000)
                }
            }
        }
    }

    private fun checkAndLogToken() {
        try {
            val token = getTokenFromDatabase()
            if (token != null) {
                Log.i("TOKEN_BACKGROUND", "✅ Token available: ${token.substring(0, 30)}...")
                Log.i("TOKEN_BACKGROUND", "⏰ Check time: ${System.currentTimeMillis()}")
                
                // اینجا می‌تونی API call بزنی یا کار دیگه‌ای انجام بدی
                performBackgroundTask(token)
            } else {
                Log.w("TOKEN_BACKGROUND", "❌ No token found in background check")
            }
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

    private fun performBackgroundTask(token: String) {
        Log.d("TOKEN_BACKGROUND", "🔄 Performing background task with token")
        // اینجا می‌تونی:
        // - API call بزنی
        // - Notification نشون بدی  
        // - داده ذخیره کنی
        // - هر کار دیگه‌ای انجام بدی
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        serviceScope.cancel()
        Log.d("TokenBackgroundService", "🛑 Background Service Destroyed")
    }
} 