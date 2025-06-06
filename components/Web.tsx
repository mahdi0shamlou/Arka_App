import React, {useEffect} from 'react';
import {Linking} from 'react-native';
import WebView from 'react-native-webview';
import {TokenService} from '../services/tokenService';

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>;
  webViewRef: React.RefObject<WebView<{}> | null>;
}

function Web({setHasError, setLoading, setCanGoBack, webViewRef}: IProps) {
  useEffect(() => {
    // Sync tokens when component mounts
    const initializeTokens = async () => {
      try {
        await TokenService.syncTokensFromCookies();
      } catch (error) {
        console.error('Error initializing tokens:', error);
      }
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

  const handleLoadEnd = async () => {
    setLoading(false);
    
    // Sync tokens after page load
    try {
      await TokenService.syncTokensFromCookies();
      
      // Log current token status for debugging
      const isValid = await TokenService.isTokenValid();
      const accessToken = await TokenService.getValidAccessToken();
      
      console.log('Token status after page load:', {
        isValid,
        hasAccessToken: !!accessToken,
      });
    } catch (error) {
      console.error('Error syncing tokens after load:', error);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle token updates from web page
      if (data.type === 'TOKEN_UPDATE' && data.tokens) {
        await TokenService.saveTokens(data.tokens);
        console.log('Tokens updated from web page');
      }
      
      // Handle logout
      if (data.type === 'LOGOUT') {
        await TokenService.clearTokens();
        await TokenService.clearCookies();
        console.log('User logged out - tokens cleared');
      }
    } catch (error) {
      console.log('Received non-JSON message:', event.nativeEvent.data);
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
      // Enable sharing cookies with WebView
      sharedCookiesEnabled={true}
      // Enable DOM storage for better token handling
      domStorageEnabled={true}
      // Allow JavaScript communication
      javaScriptEnabled={true}
      // Inject JavaScript to communicate with web page
      injectedJavaScript={`
        // Function to send tokens to React Native
        function sendTokensToApp() {
          try {
            // Try to get tokens from localStorage
            const tokens = {
              access_token: localStorage.getItem('access_token') || localStorage.getItem('token'),
              refresh_token: localStorage.getItem('refresh_token'),
              expires_in: localStorage.getItem('expires_in'),
              token_type: localStorage.getItem('token_type') || 'Bearer'
            };
            
            if (tokens.access_token) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TOKEN_UPDATE',
                tokens: tokens
              }));
            }
          } catch (error) {
            console.log('Error sending tokens:', error);
          }
        }
        
        // Send tokens when page loads
        sendTokensToApp();
        
        // Monitor localStorage changes
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
          originalSetItem.apply(this, arguments);
          if (key.includes('token') || key.includes('auth')) {
            sendTokensToApp();
          }
        };
        
        // Monitor for logout events
        document.addEventListener('click', function(e) {
          if (e.target && (e.target.textContent.includes('خروج') || e.target.textContent.includes('Logout'))) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOGOUT'
            }));
          }
        });
        
        true; // Required for injected JavaScript
      `}
    />
  );
}

export default Web;
