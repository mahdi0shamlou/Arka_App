import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  StatusBar,
  ToastAndroid,
  PermissionsAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import PushNotification from 'react-native-push-notification';

import {TokenService} from './services/tokenService';
import SplashScreen from './components/SplashScreen';
import ErrorHandler from './components/ErrorHandler';
import Loader from './components/Loader';
import Web from './components/Web';
import backgroundService from './services/backgroundService';

PushNotification.configure({
  onNotification: function (notification) {
    console.log('NOTIFICATION:', notification);
  },
  requestPermissions: false,
  popInitialNotification: false,
});

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



  useEffect(() => {
    const requestPermissionIfNeeded = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        if (!hasPermission) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
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

  useEffect(() => {
    const initializeBackgroundService = () => {
      backgroundService.configure({
        apiUrl: 'https://www.arkafile.info/api/check-status',
        intervalMinutes: 5,
        enableNotifications: true,
        enableLogging: true,
      });

      backgroundService.setAutoRestart(true);
      backgroundService.start();
    };

    initializeBackgroundService();

    const healthCheckInterval = setInterval(() => {
      const stats = backgroundService.getStats();
      if (!stats.isRunning) {
        backgroundService.start();
      }
    }, 30000);

    return () => {
      clearInterval(healthCheckInterval);
      backgroundService.stop();
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
        barStyle="light-content"
        backgroundColor="#1d4ed8"
      />

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
