package com.arkafile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            intent.action == Intent.ACTION_PACKAGE_REPLACED) {
            
            try {
                val serviceIntent = Intent(context, TokenBackgroundService::class.java)
                context.startService(serviceIntent)
            } catch (e: Exception) {
                // Silent failure
            }
        }
    }
} 