package com.arkafile

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.util.Log
import android.content.Intent
import android.provider.Settings
import android.net.Uri
import android.app.AlertDialog
import android.widget.Toast

/**
 * 🔧 Optimized Main Activity
 * - Smart permission management ✅
 * - User-friendly dialogs ✅
 * - Config-based constants ✅
 * - Modern Android practices ✅
 */
class MainActivity : ReactActivity() {

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST = 1001
        private const val TAG = "MainActivity"
        private const val PERMISSION_DIALOG_SHOWN_KEY = "permission_dialog_shown"
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     */
    override fun getMainComponentName(): String = "ArkaFile"

    /**
     * Returns the instance of the [ReactActivityDelegate].
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
        
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "🚀 MainActivity created")
        
        // Handle notification intent data
        handleNotificationIntent()
        
        // Check and request notification permission
        checkAndRequestNotificationPermission()
        
        Log.i(TAG, "✅ MainActivity initialization complete")
    }
    
    override fun onResume() {
        super.onResume()
        Log.d(TAG, "📱 MainActivity resumed")
        
        // Re-check permissions when app resumes
        checkAndRequestNotificationPermission()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent()
    }
    
    /**
     * 📨 Handle intent data from notifications
     */
    private fun handleNotificationIntent() {
        try {
            val fromNotification = intent?.getBooleanExtra("from_notification", false) ?: false
            if (fromNotification) {
                val title = intent?.getStringExtra("notification_title")
                val body = intent?.getStringExtra("notification_body")
                
                Log.i(TAG, "📨 Opened from notification: $title")
                
                // Show toast to user
                if (!title.isNullOrBlank()) {
                    Toast.makeText(this, "📨 $title", Toast.LENGTH_SHORT).show()
                }
                
                // You can add additional handling here like navigating to specific screen
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling notification intent: ${e.message}")
        }
    }
    
    /**
     * 🔔 Smart notification permission management
     */
    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permission = Manifest.permission.POST_NOTIFICATIONS
            val hasPermission = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
            
            Log.d(TAG, "📱 POST_NOTIFICATIONS Permission Status: $hasPermission")
            
            if (!hasPermission) {
                val shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(this, permission)
                val dialogShown = getSharedPreferences(TAG, MODE_PRIVATE)
                    .getBoolean(PERMISSION_DIALOG_SHOWN_KEY, false)
                
                when {
                    shouldShowRationale -> {
                        Log.w(TAG, "⚠️ User previously denied permission, showing explanation")
                        showPermissionRationale()
                    }
                    !dialogShown -> {
                        Log.i(TAG, "🔔 First time requesting POST_NOTIFICATIONS permission")
                        markDialogShown()
                        ActivityCompat.requestPermissions(this, arrayOf(permission), NOTIFICATION_PERMISSION_REQUEST)
                    }
                    else -> {
                        Log.w(TAG, "🚫 Permission likely permanently denied, directing to settings")
                        showSettingsDialog()
                    }
                }
            } else {
                Log.i(TAG, "✅ POST_NOTIFICATIONS permission already granted")
            }
        } else {
            Log.d(TAG, "ℹ️ Android < 13, no runtime permission needed for notifications")
        }
    }
    
    /**
     * 💬 Show user-friendly permission explanation
     */
    private fun showPermissionRationale() {
        AlertDialog.Builder(this)
            .setTitle("🔔 اجازه نوتیفیکیشن")
            .setMessage("برای دریافت اعلانات مهم ArkaFile، لطفاً اجازه نوتیفیکیشن را فعال کنید.\n\nاین اجازه برای:\n• اطلاع از آگهی‌های جدید\n• یادآوری‌های مهم\n• به‌روزرسانی‌های سیستم\n\nمورد استفاده قرار می‌گیرد.")
            .setPositiveButton("بله، اجازه می‌دهم") { _, _ ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    ActivityCompat.requestPermissions(
                        this, 
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS), 
                        NOTIFICATION_PERMISSION_REQUEST
                    )
                }
            }
            .setNegativeButton("نه") { dialog, _ ->
                Log.w(TAG, "❌ User declined permission in rationale")
                dialog.dismiss()
                Toast.makeText(this, "⚠️ بدون این اجازه، اعلانات دریافت نخواهید کرد", Toast.LENGTH_LONG).show()
            }
            .setCancelable(false)
            .show()
    }
    
    /**
     * 📊 Track dialog display to avoid spam
     */
    private fun markDialogShown() {
        getSharedPreferences(TAG, MODE_PRIVATE)
            .edit()
            .putBoolean(PERMISSION_DIALOG_SHOWN_KEY, true)
            .apply()
    }
    
    /**
     * 📱 Handle permission request results
     */
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            NOTIFICATION_PERMISSION_REQUEST -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    Log.i(TAG, "✅ POST_NOTIFICATIONS permission granted by user!")
                    Toast.makeText(this, "✅ اعلانات فعال شد", Toast.LENGTH_SHORT).show()
                } else {
                    Log.w(TAG, "❌ POST_NOTIFICATIONS permission denied by user")
                    
                    // Check if permanently denied
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val permission = Manifest.permission.POST_NOTIFICATIONS
                        val shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(this, permission)
                        
                        if (!shouldShowRationale) {
                            Log.w(TAG, "🚫 Permission permanently denied")
                            showSettingsDialog()
                        } else {
                            Toast.makeText(this, "⚠️ بدون این اجازه، اعلانات دریافت نخواهید کرد", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }
    }
    
    /**
     * 🔧 Direct user to app settings for permanent permission
     */
    private fun showSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle("🔧 تنظیمات اجازه‌ها")
            .setMessage("برای فعال کردن اعلانات، لطفاً:\n\n1. روی 'باز کردن تنظیمات' کلیک کنید\n2. گزینه 'اعلانات' را پیدا کنید\n3. آن را فعال کنید\n4. به برنامه برگردید")
            .setPositiveButton("باز کردن تنظیمات") { _, _ ->
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                    Log.i(TAG, "📱 Redirected to app settings")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Failed to open app settings: ${e.message}")
                    Toast.makeText(this, "❌ خطا در باز کردن تنظیمات", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("بعداً") { dialog, _ ->
                Log.d(TAG, "ℹ️ User postponed settings")
                dialog.dismiss()
            }
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "🛑 MainActivity destroyed")
    }
}
