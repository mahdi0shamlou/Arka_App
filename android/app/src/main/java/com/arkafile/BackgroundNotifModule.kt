package com.arkafile; // replace your-apps-package-name with your app's package name
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Log
import android.content.Intent

class BackgroundNotifModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "BackgroundNotifModule"

    @ReactMethod
    fun RestartSSEConnection() {
        Log.d("BackgroundNotifModule", "🔄 Restarting SSE connection...")
        try {
            // متوقف کردن سرویس فعلی
            val stopIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.stopService(stopIntent)
            
            // شروع مجدد سرویس
            val startIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.startService(startIntent)
            
            Log.d("BackgroundNotifModule", "✅ SSE service restarted successfully")
        } catch (e: Exception) {
            Log.e("BackgroundNotifModule", "❌ Failed to restart SSE service: ${e.message}")
        }
    }

    @ReactMethod
    fun CheckTokenAndConnect() {
        Log.d("BackgroundNotifModule", "🔍 Checking token and connecting to SSE...")
        
        val token = getTokenFromDatabase()
        if (token != null) {
            Log.d("BackgroundNotifModule", "✅ Token found, restarting SSE connection")
            RestartSSEConnection()
        } else {
            Log.w("BackgroundNotifModule", "⚠️ No token found, cannot connect to SSE")
        }
    }

    @ReactMethod
    fun StartSSEService() {
        Log.d("BackgroundNotifModule", "🚀 Starting SSE service...")
        try {
            val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.startService(intent)
            Log.d("BackgroundNotifModule", "✅ SSE service started")
        } catch (e: Exception) {
            Log.e("BackgroundNotifModule", "❌ Failed to start SSE service: ${e.message}")
        }
    }

    @ReactMethod
    fun StopSSEService() {
        Log.d("BackgroundNotifModule", "🛑 Stopping SSE service...")
        try {
            val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.stopService(intent)
            Log.d("BackgroundNotifModule", "✅ SSE service stopped")
        } catch (e: Exception) {
            Log.e("BackgroundNotifModule", "❌ Failed to stop SSE service: ${e.message}")
        }
    }

    private fun getTokenFromDatabase(): String? {
        return try {
            val db = reactApplicationContext.openOrCreateDatabase("RKStorage", 0, null)
            val cursor = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf("app_token"))
            
            if (cursor.moveToFirst()) {
                val jsonValue = cursor.getString(0)
                cursor.close()
                db.close()
                
                // Parse JSON to extract token
                val jsonObject = org.json.JSONObject(jsonValue)
                return jsonObject.getString("token")
            }
            
            cursor.close()
            db.close()
            null
        } catch (e: Exception) {
            Log.e("BackgroundNotifModule", "Error reading token from database: ${e.message}")
            null
        }
    }
}