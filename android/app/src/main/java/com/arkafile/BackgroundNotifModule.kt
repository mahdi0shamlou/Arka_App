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
            // ابتدا همه اتصالات قبلی را کاملاً ببند
            Log.d("BackgroundNotifModule", "🛑 Forcefully stopping all existing SSE connections...")
            val stopIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.stopService(stopIntent)
            
            // صبر کن تا service کاملاً متوقف شود و cleanup انجام شود
            Log.d("BackgroundNotifModule", "⏳ Waiting for complete cleanup...")
            Thread.sleep(1500)
            
            // حالا service جدید را با اتصال fresh شروع کن
            Log.d("BackgroundNotifModule", "▶️ Starting fresh SSE service after cleanup...")
            val startIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.startService(startIntent)
            
            Log.d("BackgroundNotifModule", "✅ SSE service restarted with fresh connection")
        } catch (e: Exception) {
            Log.e("BackgroundNotifModule", "❌ Failed to restart SSE service: ${e.message}")
        }
    }

    @ReactMethod
    fun CheckTokenAndConnect() {
        Log.d("BackgroundNotifModule", "🔍 Checking token and triggering immediate connection...")
        
        val token = getTokenFromDatabase()
        if (token != null) {
            Log.d("BackgroundNotifModule", "✅ Token found in database: ${token.take(20)}...")
            
            // فوری service رو trigger کن تا token جدید رو بخونه و اتصال برقرار کنه
            Log.d("BackgroundNotifModule", "🚀 Triggering service to check token immediately...")
            val triggerIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            triggerIntent.putExtra("trigger_token_check", true)
            reactApplicationContext.startService(triggerIntent)
            
            Log.d("BackgroundNotifModule", "✅ Service triggered for immediate token check")
        } else {
            Log.w("BackgroundNotifModule", "⚠️ No token found in database")
        }
    }

    @ReactMethod
    fun StartSSEService() {
        Log.d("BackgroundNotifModule", "🚀 Starting SSE service (smart mode)...")
        try {
            // فقط service را start کن، restart نکن مگر اینکه ضروری باشد
            Log.d("BackgroundNotifModule", "▶️ Starting SSE service without forced restart...")
            val startIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.startService(startIntent)
            Log.d("BackgroundNotifModule", "✅ SSE service start command sent")
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