import React, {useEffect} from 'react';
import {Linking} from 'react-native';
import WebView from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import {TokenService} from '../services/tokenService';

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>;
  webViewRef: React.RefObject<WebView<{}> | null>;
}

function Web({setHasError, setLoading, setCanGoBack, webViewRef}: IProps) {
  useEffect(() => {
    const initializeTokens = async () => {
      await checkAndSaveTokenFromCookies();
    };

    initializeTokens();
  }, []);

  const handleNavigation = (event: any) => {
    const url = event.url;
    if (url.startsWith('tel:')) {
      Linking.openURL(url);
      return false;
    }
    return true;
  };

  const checkAndSaveTokenFromCookies = async () => {
    try {
      const domains = [
        'https://www.arkafile.info',
        'https://arkafile.info'
      ];
      
      for (const domain of domains) {
        try {
          const cookies = await CookieManager.get(domain);
          
          if (cookies.token && cookies.token.value) {
            await TokenService.saveTokens({token: cookies.token.value});
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
      }
    } catch (error) {
      // Silent error handling for non-JSON messages
    }
  };

  return (
    <WebView
      source={{uri: 'https://www.arkafile.info/dashboard'}}
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
