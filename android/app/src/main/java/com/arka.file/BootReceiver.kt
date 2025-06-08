package com.arka.file

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            intent.action == Intent.ACTION_PACKAGE_REPLACED) {
            
            Log.i("BootReceiver", "🔄 Device booted or app updated - Starting Token Background Service")
            
            try {
                val serviceIntent = Intent(context, TokenBackgroundService::class.java)
                context.startService(serviceIntent)
                Log.i("BootReceiver", "✅ Token Background Service started after boot")
            } catch (e: Exception) {
                Log.e("BootReceiver", "❌ Failed to start service after boot: ${e.message}")
            }
        }
    }
} 