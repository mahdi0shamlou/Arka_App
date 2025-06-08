import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Button,
  Dimensions,
  Keyboard,
  PermissionsAndroid,
  Platform,
  StatusBar,
  ToastAndroid,
} from 'react-native';
import PushNotification from 'react-native-push-notification';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import {NativeModules} from 'react-native';
import ErrorHandler from './components/ErrorHandler';
import Loader from './components/Loader';
import SplashScreen from './components/SplashScreen';
import Web from './components/Web';
import {TokenService} from './services/tokenService';

const {BackgroundNotifModule} = NativeModules;

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
  created => console.log(`createChannel returned '${created}'`),
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
      if (Platform.OS === 'android') {
        // Request notification permission for Android 13+
        if (Platform.Version >= 33) {
          const hasNotificationPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          if (!hasNotificationPermission) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
          }
        }

        // Request battery optimization exemption
        try {
          const hasBatteryPermission = await PermissionsAndroid.check(
            'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as any,
          );

          if (!hasBatteryPermission) {
            await PermissionsAndroid.request(
              'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as any,
            );
          }
        } catch (error) {
          console.log('Battery optimization permission error:', error);
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

  if (splash) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView
      style={{
        height: screenHeight - keyboardHeight,
        backgroundColor: '#1d4ed8',
      }}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <Button
        title="Save Token Now"
        onPress={async () => {
          try {
            console.log('=== SAVING TOKEN ===');
            await TokenService.saveTokens({
              token:
                'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test_token_for_debug',
            });
            console.log('Token saved successfully!');

            // بعد از save، بلافاصله check کن
            const saved = await TokenService.getStoredTokens();
            console.log('Immediately after save:', saved);
          } catch (error) {
            console.error('Error saving token:', error);
          }
        }}
      />
      <Button
        title="Native Check"
        onPress={() => BackgroundNotifModule.CreateRequest('test')}
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
