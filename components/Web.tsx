import CookieManager from '@react-native-cookies/cookies';
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

  useEffect(() => {
    const initializeTokens = async () => {
      const existingToken = await TokenService.getValidAccessToken();
      if (existingToken) {
        setInitialUrl('https://www.arkafile.org/dashboard');
      } else {
        setInitialUrl('https://www.arkafile.org/login');
      }
      await checkAndSaveTokenFromCookies();
      // شروع SSE service پس از بارگذاری اولیه
      try {
        await BackgroundNotifModule?.StartSSEService();
      } catch (error) {}
    };

    initializeTokens();
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

  const checkAndSaveTokenFromCookies = async () => {
    try {
      const domains = ['https://www.arkafile.org', 'https://www.arkafile.info'];

      for (const domain of domains) {
        try {
          const cookies = await CookieManager.get(domain);

          if (cookies.token && cookies.token.value) {
            await TokenService.saveTokens({token: cookies.token.value});

            // راه‌اندازی مجدد SSE connection با توکن جدید
            try {
              await BackgroundNotifModule?.RestartSSEConnection();
              console.log('🔄 SSE Connection restarted with new token');
            } catch (error) {
              console.log('⚠️ SSE restart failed:', error);
            }

            return;
          }
        } catch (err) {
          // Silent error handling
        }
      }
    } catch (error) {
      console.error('Error checking cookies:', error);
    }
  };

  const handleLoadEnd = async () => {
    setLoading(false);

    // Check and save token from cookies
    await checkAndSaveTokenFromCookies();

    // اطمینان از اینکه SSE service در حال اجرا است
    try {
      await BackgroundNotifModule?.CheckTokenAndConnect();
    } catch (error) {
      console.log('⚠️ SSE token check failed:', error);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'CHECK_COOKIES') {
        setTimeout(async () => {
          await checkAndSaveTokenFromCookies();
        }, 2000);
      }

      if (data.type === 'LOGOUT') {
        await TokenService.clearTokens();
        await TokenService.clearCookies();

        // توقف SSE service هنگام logout
        try {
          await BackgroundNotifModule?.StopSSEService();
          console.log('🛑 SSE Service stopped on logout');
        } catch (error) {
          console.log('⚠️ SSE stop failed on logout:', error);
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
      startInLoadingState={false}
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
