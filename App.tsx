import {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  StatusBar,
  ToastAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import ErrorHandler from './components/ErrorHandler';
import Loader from './components/Loader';
import SplashScreen from './components/SplashScreen';
import Web from './components/Web';

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
      <StatusBar
        barStyle="light-content" // for white icons
        backgroundColor="#1d4ed8" // color behind icons (Android only)
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
