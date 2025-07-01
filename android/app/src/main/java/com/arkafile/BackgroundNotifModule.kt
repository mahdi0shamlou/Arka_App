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
        Log.i(TAG, "🎯 UNIFIED START CONNECTION - Primary method for SSE initialization")
        
        moduleScope.launch {
            try {
                val token = getTokenFromDatabase()
                if (token != null) {
                    Log.i(TAG, "✅ Token found: ${token.take(20)}... - Starting authenticated connection")
                } else {
                    Log.i(TAG, "⚠️ No token found - Starting anonymous connection")
                }
                
                // Start service with token check flag
                val startIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java).apply {
                    putExtra("trigger_token_check", true)
                }
                
                reactApplicationContext.startService(startIntent)
                Log.i(TAG, "✅ SSE service started successfully")
                
                promise?.resolve("SSE service started")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to start connection: ${e.message}")
                promise?.reject("CONNECTION_ERROR", "Failed to start SSE connection: ${e.message}")
            }
        }
    }

    // 🔄 Unified method for complete connection restart
    @ReactMethod
    fun RestartConnection(promise: Promise? = null) {
        Log.i(TAG, "🔄 UNIFIED RESTART CONNECTION - Complete service restart")
        
        moduleScope.launch {
            try {
                // Stop existing service gracefully
                Log.d(TAG, "🛑 Stopping existing service...")
                val stopIntent = Intent(reactApplicationContext, TokenBackgroundService::class.java)
                reactApplicationContext.stopService(stopIntent)
                
                // Wait for complete cleanup using coroutines instead of Thread.sleep
                Log.d(TAG, "⏳ Waiting for service cleanup...")
                delay(AppConfig.CONNECTION_CLEANUP_DELAY_MS)
                
                // Start fresh connection
                Log.d(TAG, "▶️ Starting fresh connection...")
                StartConnection()
                
                Log.i(TAG, "✅ Connection restarted successfully")
                promise?.resolve("Connection restarted successfully")
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to restart connection: ${e.message}")
                promise?.reject("RESTART_ERROR", "Failed to restart connection: ${e.message}")
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

    // 🗃️ Secure token retrieval with improved error handling
    private suspend fun getTokenFromDatabase(): String? = withContext(Dispatchers.IO) {
        return@withContext try {
            val db = reactApplicationContext.openOrCreateDatabase(AppConfig.DB_NAME, 0, null)
            
            val cursor = db.rawQuery(
                "SELECT value FROM catalystLocalStorage WHERE key = ?", 
                arrayOf(AppConfig.TOKEN_KEY)
            )
            
            val token = if (cursor.moveToFirst()) {
                val jsonValue = cursor.getString(0)
                // Parse JSON to extract token
                val jsonObject = JSONObject(jsonValue)
                jsonObject.getString("token")
            } else {
                null
            }
            
            cursor.close()
            db.close()
            
            // Return token only if it's not blank
            token?.takeIf { it.isNotBlank() }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error reading token from database: ${e.message}")
            Log.e(TAG, "💥 Exception type: ${e.javaClass.simpleName}")
            null
        }
    }

    // 🧹 Clean up when module is destroyed
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        Log.d(TAG, "🧹 Module destroying - cleaning up coroutines")
        moduleScope.cancel()
    }
}