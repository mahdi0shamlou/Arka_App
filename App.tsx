import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Button,
  Dimensions,
  Keyboard,
  Platform,
  StatusBar,
  ToastAndroid,
  View,
  PermissionsAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import PushNotification from 'react-native-push-notification';

// import backgroundService from './services/backgroundService';
import SplashScreen from './components/SplashScreen';
import ErrorHandler from './components/ErrorHandler';
import Loader from './components/Loader';
import Web from './components/Web';
import backgroundService from './services/backgroundService';

// Configure local notifications only (no Firebase, minimal config)
PushNotification.configure({
  // Minimal configuration to avoid Firebase
  onNotification: function (notification) {
    console.log('NOTIFICATION:', notification);
  },

  // Disable all remote/Firebase features
  requestPermissions: false,
  popInitialNotification: false,
});

// Create a channel for Android (required for Android 8.0+)
PushNotification.createChannel(
  {
    channelId: 'default-channel-id',
    channelName: 'ArkaFile Notifications',
    channelDescription: 'Default notifications for ArkaFile app',
    soundName: 'default',
    importance: 4,
    vibrate: true,
  },
  (created) => console.log(`createChannel returned '${created}'`)
);


let backPressTime = 0;

export default function HomeScreen() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const screenHeight = Dimensions.get('window').height;
  const [splash, setSplash] = useState<boolean>(true);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // تست نوتیفیکیشن
  const testNotification = () => {
    PushNotification.localNotification({
      channelId: 'default-channel-id',
      title: '✅ تست اعلان',
      message: 'نوتیفیکیشن با موفقیت ارسال شد!',
      playSound: true,
      vibrate: true,
    });
  };

  // چک و درخواست مجوز در هر startup (تا مجوز بگیرد)
  useEffect(() => {
    const requestPermissionIfNeeded = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        // اگر مجوز ندارد، هر بار درخواست کن
        if (!hasPermission) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
           
          );
          
        
        }
      }
    };

    requestPermissionIfNeeded();
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);


  const onAndroidBackPress = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    const now = Date.now();
    if (backPressTime && now - backPressTime < 2000) {
      BackHandler.exitApp();
      return true;
    }

    backPressTime = now;
    ToastAndroid.show(
      'برای خروج مجدد دکمه بازگشت را بزنید.',
      ToastAndroid.SHORT,
    );
    return true;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
    }
  }, [onAndroidBackPress]);

  useEffect(() => {
    setTimeout(() => {
      setSplash(false);
    }, 2000);
  }, []);

  // Background service disabled to avoid Firebase errors
  useEffect(() => {
    // Start background service when app loads
    const initializeBackgroundService = () => {
      // Configure the service
      backgroundService.configure({
        apiUrl: 'https://www.arkafile.info/api/check-status', // URL API را تغییر دهید
        intervalMinutes: 5, // هر 5 دقیقه چک کند
        enableNotifications: true,
        enableLogging: true,
      });

      // Enable auto-restart
      backgroundService.setAutoRestart(true);

      // Start the service
      backgroundService.start();
      console.log('Background service started with persistence');
    };

    initializeBackgroundService();

    // Set up periodic health check
    const healthCheckInterval = setInterval(() => {
      const stats = backgroundService.getStats();
      if (!stats.isRunning) {
        console.log('Service health check: Service is down, restarting...');
        backgroundService.start();
      }
    }, 30000); // Check every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(healthCheckInterval);
      backgroundService.stop();
      console.log('Background service stopped');
    };
  }, []);

  if (splash) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView
      style={{
        height: screenHeight - keyboardHeight,
        backgroundColor: '#1d4ed8',
      }}>
      <StatusBar
        barStyle="light-content" // for white icons
        backgroundColor="#1d4ed8" // color behind icons (Android only)
      />
      <View style={{ padding: 20 }}>
        <Button 
          title='🔔 تست اعلان'
          onPress={testNotification}
        />
      </View>
      {hasError ? (
        <ErrorHandler setHasError={setHasError} setLoading={setLoading} />
      ) : (
        <>
          {loading && <Loader />}
          <Web
            setHasError={setHasError}
            setLoading={setLoading}
            setCanGoBack={setCanGoBack}
            webViewRef={webViewRef}
          />
        </>
      )}
    </SafeAreaView>
  );
}
