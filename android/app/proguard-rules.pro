# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ✅ Keep our background service classes
-keep class com.arkafile.TokenBackgroundService { *; }
-keep class com.arkafile.BootReceiver { *; }
-keep class com.arkafile.BackgroundNotifModule { *; }
-keep class com.arkafile.MainActivity { *; }
-keep class com.arkafile.MainApplication { *; }
-keep class com.arkafile.MyAppPackage { *; }

# ✅ Keep all methods that are called via reflection
-keepclassmembers class com.arkafile.** {
    public *;
    private *;
}

# ✅ Keep service related classes
-keep class * extends android.app.Service
-keep class * extends android.content.BroadcastReceiver
-keep class * extends android.app.Application

# ✅ Keep notification related classes
-keep class androidx.core.app.NotificationCompat$** { *; }
-keep class android.app.NotificationManager { *; }
-keep class android.app.NotificationChannel { *; }
-keep class android.app.PendingIntent { *; }

# ✅ Keep React Native Bridge methods
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# ✅ Keep React Native packages
-keep class com.facebook.react.** { *; }
-keepclassmembers class com.facebook.react.** { *; }

# ✅ Keep Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepnames class kotlinx.coroutines.android.AndroidExceptionPreHandler {}
-keepnames class kotlinx.coroutines.android.AndroidDispatcherFactory {}
-keep class kotlinx.coroutines.** { *; }

# ✅ Keep OkHttp classes and SSE
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okhttp3.sse.** { *; }
-keep interface okhttp3.sse.** { *; }

# ✅ Keep JSON classes
-keep class org.json.** { *; }
-keepclassmembers class org.json.** { *; }

# ✅ Keep PowerManager and WakeLock classes
-keep class android.os.PowerManager { *; }
-keep class android.os.PowerManager$WakeLock { *; }

# ✅ Keep database related classes
-keep class android.database.** { *; }
-keep class android.database.sqlite.** { *; }

# ✅ Keep Intent and Context classes
-keep class android.content.Intent { *; }
-keep class android.content.Context { *; }

# ✅ Preserve line numbers for debugging crashes
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ✅ Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ✅ Keep EventSourceListener methods (Critical for SSE!)
-keep class okhttp3.sse.EventSourceListener { *; }
-keepclassmembers class * extends okhttp3.sse.EventSourceListener {
    public void onOpen(okhttp3.sse.EventSource, okhttp3.Response);
    public void onEvent(okhttp3.sse.EventSource, java.lang.String, java.lang.String, java.lang.String);
    public void onClosed(okhttp3.sse.EventSource);
    public void onFailure(okhttp3.sse.EventSource, java.lang.Throwable, okhttp3.Response);
}

# ✅ Keep Lambda expressions and anonymous classes
-keepclassmembers class * {
    private static synthetic *** lambda$*(...);
}
-keep class **$$Lambda$* { *; }
-dontwarn java.lang.invoke.*

# ✅ Keep Java 8+ features
-dontwarn java.util.concurrent.Flow*
-keep class java.util.concurrent.** { *; }

# ✅ Keep all Notification style classes
-keep class androidx.core.app.NotificationCompat$BigTextStyle { *; }
-keep class androidx.core.app.NotificationCompat$BigPictureStyle { *; }
-keep class androidx.core.app.NotificationCompat$Action { *; }
-keep class androidx.core.app.NotificationCompat$Builder { *; }

# ✅ Keep SQLite cursor methods
-keepclassmembers class android.database.Cursor {
    public ** moveToFirst();
    public ** getString(int);
    public ** close();
}

# ✅ Keep Runtime annotations for Kotlin
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# ✅ Keep Thread and Coroutine classes
-keep class java.lang.Thread { *; }
-keep class java.util.concurrent.ThreadPoolExecutor { *; }
-keepnames class kotlinx.coroutines.** { *; }

# ✅ Keep System Service classes
-keep class android.app.NotificationManager { *; }
-keep class android.os.PowerManager { *; }
-keep class android.content.Context { 
    public java.lang.Object getSystemService(java.lang.String);
}

# ✅ Keep Parcelable implementation
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ✅ Critical: Keep all synthetic methods
-keepclassmembers class * {
    synthetic <methods>;
}

# ✅ Don't warn about missing classes
-dontwarn com.arkafile.**
-dontwarn androidx.**
-dontwarn kotlin.**
-dontwarn kotlinx.**
-dontwarn okio.**
-dontwarn retrofit2.**

