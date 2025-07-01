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

class MainActivity : ReactActivity() {

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST = 1001
        private const val TAG = "MainActivity"
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "ArkaFile"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
        
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 🚨 فوری چک کردن و درخواست permission برای نوتیفیکیشن
        checkAndRequestNotificationPermission()
    }
    
    override fun onResume() {
        super.onResume()
        // هر بار که اپ resume میشه دوباره چک کن
        checkAndRequestNotificationPermission()
    }
    
    /**
     * 🔥 چک کردن و درخواست permission برای Android 13+
     */
    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permission = Manifest.permission.POST_NOTIFICATIONS
            val hasPermission = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
            
            Log.i(TAG, "📱 POST_NOTIFICATIONS Permission Status: $hasPermission")
            
            if (!hasPermission) {
                // چک کن که آیا باید rationale نشان دهیم
                if (ActivityCompat.shouldShowRequestPermissionRationale(this, permission)) {
                    // کاربر قبلاً رد کرده، باید توضیح دهیم
                    Log.w(TAG, "⚠️ User previously denied permission, showing rationale")
                    showPermissionRationale()
                } else {
                    // اولین بار یا permanently denied
                    Log.i(TAG, "🔔 Requesting POST_NOTIFICATIONS permission")
                    ActivityCompat.requestPermissions(this, arrayOf(permission), NOTIFICATION_PERMISSION_REQUEST)
                }
            } else {
                Log.i(TAG, "✅ POST_NOTIFICATIONS permission already granted")
            }
        } else {
            Log.i(TAG, "ℹ️ Android < 13, no runtime permission needed")
        }
    }
    
    /**
     * نمایش توضیح چرا permission لازم است
     */
    private fun showPermissionRationale() {
        // اینجا میتونید یک dialog یا snackbar نشان دهید
        Log.i(TAG, "📢 برای دریافت اعلانات مهم، لطفاً اجازه دهید")
        
        // بعد از نمایش توضیح، دوباره درخواست کنید
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST)
        }
    }
    
    /**
     * پردازش نتیجه درخواست permission
     */
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        when (requestCode) {
            NOTIFICATION_PERMISSION_REQUEST -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    Log.i(TAG, "✅ POST_NOTIFICATIONS permission granted!")
                } else {
                    Log.w(TAG, "❌ POST_NOTIFICATIONS permission denied!")
                    
                    // چک کن که آیا permanently denied شده
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val permission = Manifest.permission.POST_NOTIFICATIONS
                        if (!ActivityCompat.shouldShowRequestPermissionRationale(this, permission)) {
                            Log.w(TAG, "🚫 Permission permanently denied, directing to settings")
                            showSettingsDialog()
                        }
                    }
                }
            }
        }
    }
    
    /**
     * هدایت کاربر به تنظیمات اپ برای فعال کردن permission
     */
    private fun showSettingsDialog() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.data = Uri.fromParts("package", packageName, null)
            startActivity(intent)
            Log.i(TAG, "📱 Redirected to app settings")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open app settings: ${e.message}")
        }
    }
}
