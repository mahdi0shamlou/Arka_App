import React, {useEffect} from 'react';
import {Linking, NativeModules} from 'react-native';
import WebView from 'react-native-webview';
import {TokenService} from '../services/tokenService';

const {BackgroundNotifModule} = NativeModules;

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>;
  webViewRef: React.RefObject<WebView<{}> | null>;
}

function Web({setHasError, setLoading, setCanGoBack, webViewRef}: IProps) {
  const [initialUrl, setInitialUrl] = React.useState(
    'https://www.arkafile.org/dashboard',
  );
  const [connectionInitialized, setConnectionInitialized] =
    React.useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...');

        // // اول همه اتصالات قبلی را قطع کن
        // try {
        //   await BackgroundNotifModule?.StopSSEService();
        //   console.log('🛑 Previous SSE connections stopped');
        // } catch (error) {
        //   // نادیده بگیر اگر قبلاً متوقف بود
        // }

        // بررسی توکن و تعیین URL اولیه
        const existingToken = await TokenService.getValidAccessToken();
        if (existingToken) {
          setInitialUrl('https://www.arkafile.org/dashboard');
          console.log('✅ Token found, redirecting to dashboard');
        } else {
          setInitialUrl('https://www.arkafile.org/login');
          console.log('❌ No token found, redirecting to login');
        }
      } catch (error) {
        console.error('❌ Error initializing app:', error);
      }
    };

    initializeApp();
  }, []);

  const handleNavigation = (event: any) => {
    const url = event.url;

    // اگر لینک تلفن است، در اپ دیگری باز کن
    if (url.startsWith('tel:')) {
      Linking.openURL(url);
      return false;
    }

    // اگر لینک ایمیل است، در اپ دیگری باز کن
    if (url.startsWith('mailto:')) {
      Linking.openURL(url);
      return false;
    }

    // لیست دامنه‌های مجاز که باید در WebView باز شوند (فقط دو دامنه اصلی)
    const allowedDomains = ['arkafile.org', 'arkafile.info'];

    // چک کن که آیا URL مربوط به دامنه‌های مجاز است یا نه
    const isAllowedDomain = allowedDomains.some(domain => url.includes(domain));

    // اگر دامنه مجاز نیست، در مرورگر خارجی باز کن
    if (!isAllowedDomain) {
      console.log('❌ Opening in external browser:', url);
      Linking.openURL(url);
      return false;
    }

    // بقیه لینک‌ها (مربوط به سایت اصلی) در WebView باز شوند
    return true;
  };

  const initializeSSEConnection = async () => {
    try {
      if (connectionInitialized) {
        console.log('⚠️ Connection already initialized, skipping...');
        return;
      }

      console.log('🔄 Initializing SSE connection for the FIRST time...');

      // فقط برای اولین بار service رو شروع کن (بدون stop)
      try {
        await BackgroundNotifModule?.StartSSEService();
        setConnectionInitialized(true);
        console.log(
          '✅ SSE Connection initialized for first time successfully',
        );
      } catch (error) {
        console.log('❌ SSE Connection failed:', error);
      }
    } catch (error) {
      console.error('❌ Error initializing SSE connection:', error);
    }
  };

  const checkAndSaveTokenFromCookies = async () => {
    try {
      console.log('🔍 Checking for token in cookies...');

      // استفاده از TokenService برای همگام‌سازی
      const newToken = await TokenService.forceSyncFromCookies();

      if (newToken) {
        console.log('✅ Token found and synced from cookies');

        // اگر اتصال هنوز شروع نشده، شروع کن
        if (!connectionInitialized) {
          await initializeSSEConnection();
        } else {
          // // اگر اتصال موجود است، به service بگو که token جدید اومده
          // console.log('🔄 Notifying service about new token...');
          // // صبر کن تا AsyncStorage به SQLite sync بشه
          // await BackgroundNotifModule?.CheckTokenAndConnect();
        }
      } else {
        console.log('❌ No token found in cookies');
        // اگر اتصال موجود نیست و token هم نیست، connection نساز
        if (!connectionInitialized) {
          console.log(
            '🚫 No token available, skipping connection initialization',
          );
        }
      }
    } catch (error) {
      console.error('❌ Error checking cookies:', error);
    }
  };

  const handleLoadEnd = async () => {
    setLoading(false);
    console.log('📱 WebView load ended');

    // فقط اگر اتصال هنوز شروع نشده باشد
    if (!connectionInitialized) {
      console.log(
        '🔄 Load ended, checking for tokens and initializing connection...',
      );
      await checkAndSaveTokenFromCookies();
    } else {
      console.log(
        '✅ Connection already initialized, checking for new tokens...',
      );
      // همیشه token check کن و اگر جدید بود service رو trigger کن
      await checkAndSaveTokenFromCookies();
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'CHECK_COOKIES') {
        console.log('📨 Received CHECK_COOKIES message - user logged in');
        // setTimeout(async () => {
        //   await checkAndSaveTokenFromCookies();
        // }, 2000); // صبر کن تا cookies set شوند
        await BackgroundNotifModule?.RestartSSEConnection();

      }

      if (data.type === 'LOGOUT') {
        console.log('📨 Received LOGOUT message - user logged out');

        // پاک کردن همه توکن‌ها
        await TokenService.clearTokens();
        await TokenService.clearCookies();

        // ریستارت SSE service تا بدون توکن ادامه بده
        try {
          await BackgroundNotifModule?.RestartSSEConnection();
          console.log('🔄 SSE Service restarted without token after logout');
        } catch (error) {
          console.log('⚠️ SSE restart failed on logout:', error);
        }
      }
    } catch (error) {
      // Silent error handling for non-JSON messages
    }
  };

  return (
    <WebView
      source={{uri: initialUrl}}
      ref={webViewRef}
      onLoadProgress={event => {
        setCanGoBack(event.nativeEvent.canGoBack);
      }}
      onLoadEnd={handleLoadEnd}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleNavigation}
      originWhitelist={['*']}
      style={{flex: 1}}
      onError={() => {
        setHasError(true);
      }}
      onHttpError={e => {
        setHasError(true);
      }}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={true}
      domStorageEnabled={true}
      javaScriptEnabled={true}
      startInLoadingState={true}
      mixedContentMode={'compatibility'}
      allowUniversalAccessFromFileURLs={true}
      setSupportMultipleWindows={false}
      cacheEnabled={true}
      allowsInlineMediaPlayback={true}
      userAgent="Mozilla/5.0 (Linux; Android 10; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      injectedJavaScript={`
        document.addEventListener('click', function(e) {
          if (e.target) {
            const text = e.target.textContent || e.target.innerText || '';
            if (text.includes('خروج') || text.includes('Logout') || text.includes('logout')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOGOUT'
              }));
            } else if (text.includes('ورود') || text.includes('Login') || text.includes('login')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CHECK_COOKIES'
              }));
            }
          }
        });
        
        true;
      `}
    />
  );
}

export default Web;
