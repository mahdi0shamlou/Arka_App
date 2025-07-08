package com.arkafile; // replace your-apps-package-name with your app's package name
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.util.Log
import android.content.Intent
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * 🔧 Optimized React Native Bridge Module
 * - Coroutine-based operations ✅
 * - Promise-based async methods ✅
 * - Secure token handling ✅
 * - Single connection guarantee ✅
 */
class BackgroundNotifModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "BGNotifModule"
    }
    
    private val moduleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun getName() = "BackgroundNotifModule"

    // 🎯 Unified method for starting SSE connection
    @ReactMethod
    fun StartConnection(promise: Promise? = null) {
        moduleScope.launch {
            try {
                delay(500)
                
                val startIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java).apply {
                    putExtra("trigger_token_check", true)
                }
                
                reactApplicationContext.startService(startIntent)
                promise?.resolve("Started")
                
            } catch (e: Exception) {
                promise?.reject("ERROR", e.message)
            }
        }
    }

    // 🔄 Unified method for complete connection restart
    @ReactMethod
    fun RestartConnection(promise: Promise? = null) {
        Log.i(TAG, "🔄 UNIFIED RESTART CONNECTION - Complete service restart")
        
        moduleScope.launch {
            try {
                Log.i(TAG, "🔄 Restarting...")
                val stopIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
                reactApplicationContext.stopService(stopIntent)
                
                delay(2000) // Wait for cleanup + AsyncStorage
                StartConnection()
                
                Log.i(TAG, "✅ Restarted")
                promise?.resolve("Restarted")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Restart error: ${e.message}")
                promise?.reject("ERROR", e.message)
            }
        }
    }

    // 🛑 Clean service stop
    @ReactMethod
    fun StopSSEService(promise: Promise? = null) {
        Log.i(TAG, "🛑 Stopping SSE service...")
        
        moduleScope.launch {
            try {
                val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
                reactApplicationContext.stopService(intent)
                
                Log.i(TAG, "✅ SSE service stopped successfully")
                promise?.resolve("SSE service stopped")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to stop SSE service: ${e.message}")
                promise?.reject("STOP_ERROR", "Failed to stop service: ${e.message}")
            }
        }
    }

    // 🔍 Service health check
    @ReactMethod
    fun CheckServiceStatus(promise: Promise) {
        Log.d(TAG, "🔍 Checking service status...")
        
        moduleScope.launch {
            try {
                // Simple health check - try to get token
                val token = getTokenFromDatabase()
                val status = mapOf(
                    "hasToken" to (token != null),
                    "tokenLength" to (token?.length ?: 0),
                    "timestamp" to System.currentTimeMillis()
                )
                
                Log.d(TAG, "✅ Service status checked: $status")
                promise.resolve(JSONObject(status).toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to check service status: ${e.message}")
                promise.reject("STATUS_ERROR", "Failed to check status: ${e.message}")
            }
        }
    }

    // 🗃️ Simple token check
    private suspend fun getTokenFromDatabase(): String? = withContext(Dispatchers.IO) {
        return@withContext try {
            val db = reactApplicationContext.openOrCreateDatabase(AppConfig.DB_NAME, 0, null)
            
            val cursor = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf(AppConfig.TOKEN_KEY))
            
            val token = if (cursor.moveToFirst()) {
                val value = cursor.getString(0)
                try {
                    JSONObject(value).optString("token", null)
                } catch (e: Exception) {
                    value.replace("\"", "")
                }
            } else {
                null
            }
            
            cursor.close()
            db.close()
            
            token?.takeIf { it.isNotBlank() && it.length > 10 }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Token error: ${e.message}")
            null
        }
    }

    // 🔑 Send token directly to service
    @ReactMethod
    fun SetToken(token: String, promise: Promise? = null) {
        Log.i(TAG, "🔑 SETTING TOKEN directly in service")
        
        moduleScope.launch {
            try {
                Log.d(TAG, "📤 Sending token to service: ${token.take(20)}...")
                
                val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java).apply {
                    putExtra("action", "set_token")
                    putExtra("token", token)
                }
                
                reactApplicationContext.startService(intent)
                Log.i(TAG, "✅ Token sent to service successfully")
                promise?.resolve("Token set")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to set token: ${e.message}")
                promise?.reject("TOKEN_ERROR", e.message)
            }
        }
    }

    // 🗑️ Clear token from service
    @ReactMethod
    fun ClearToken(promise: Promise? = null) {
        Log.i(TAG, "🗑️ CLEARING TOKEN from service")
        
        moduleScope.launch {
            try {
                val intent = Intent(reactApplicationContext, TokenBackgroundService::class.java).apply {
                    putExtra("action", "clear_token")
                }
                
                reactApplicationContext.startService(intent)
                Log.i(TAG, "✅ Token cleared from service")
                promise?.resolve("Token cleared")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to clear token: ${e.message}")
                promise?.reject("TOKEN_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getPendingPath(promise: Promise) {
        val path = MainActivity.pendingNavigationPath ?: ""
        Log.d(TAG, "📱 getPendingPath called - path: '$path'")
        promise.resolve(path)

        // Only clear if path was actually used (not empty)
        if (path.isNotEmpty()) {
            Log.d(TAG, "🗑️ Clearing pending navigation path")
            MainActivity.pendingNavigationPath = null
        }
    }

    @ReactMethod
    fun clearPendingPath(promise: Promise? = null) {
        Log.d(TAG, "🗑️ Manually clearing pending navigation path")
        MainActivity.pendingNavigationPath = null
        promise?.resolve("Path cleared")
    }

    // 🧹 Clean up when module is destroyed
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        Log.d(TAG, "🧹 Module destroying - cleaning up coroutines")
        moduleScope.cancel()
    }


}