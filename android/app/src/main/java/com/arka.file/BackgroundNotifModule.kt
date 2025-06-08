package com.arka.file; // replace your-apps-package-name with your app's package name
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
    fun CreateRequest(customData: String) {
        Log.e("ARKA_RESULT", "===========================================")
        
        val token = getTokenFromDatabase()
        if (token != null) {
            Log.e("ARKA_RESULT", "✅ SUCCESS! Token retrieved from RKStorage")
            Log.e("ARKA_RESULT", "Token: ${token.substring(0, 50)}...")
            
            // اینجا می‌تونی با token کار کنی
            // مثل ارسال API request، ذخیره در native storage و...
            performApiCall(token, customData)
            
        } else {
            Log.e("ARKA_RESULT", "❌ Failed to retrieve token from database")
        }
        
        Log.e("ARKA_RESULT", "===========================================")
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
            Log.e("ARKA_RESULT", "Error reading token from database: ${e.message}")
            null
        }
    }

    private fun performApiCall(token: String, customData: String) {
        Log.d("ARKA_RESULT", "🚀 Performing API call with token")
        Log.d("ARKA_RESULT", "Custom data: $customData")
        
        // اینجا می‌تونی API call بزنی
        // مثال: HTTP request با Authorization header
        
        Log.d("ARKA_RESULT", "✅ API call completed successfully")
    }

    @ReactMethod
    fun startBackgroundService() {
        try {
            val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.startService(intent)
            Log.i("ARKA_SERVICE", "✅ Background service started successfully")
        } catch (e: Exception) {
            Log.e("ARKA_SERVICE", "❌ Failed to start background service: ${e.message}")
        }
    }

    @ReactMethod
    fun stopBackgroundService() {
        try {
            val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
            reactApplicationContext.stopService(intent)
            Log.i("ARKA_SERVICE", "🛑 Background service stopped")
        } catch (e: Exception) {
            Log.e("ARKA_SERVICE", "❌ Failed to stop background service: ${e.message}")
        }
    }
}