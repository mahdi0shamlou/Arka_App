package com.arka.file; // replace your-apps-package-name with your app’s package name
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Log

class BackgroundNotifModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "BackgroundNotifModule"

    @ReactMethod
    fun CreateRequest(token: String) {
        Log.d("BackgroundNotifModule", "=== METHOD CALLED SUCCESSFULLY ===")
        Log.d("BackgroundNotifModule", "Token received: $token")
    }
}