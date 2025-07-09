import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Linking, NativeModules} from 'react-native';
import WebView from 'react-native-webview';
import {TokenService} from '../services/tokenService';
import NativeLocalStorage from '../specs/NativeLocalStorage';

const {BackgroundNotifModule} = NativeModules;

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>;
  webViewRef: React.RefObject<WebView<{}> | null>;
}

// 🛡️ Safe logging to prevent crashes
const safeLog = {
  info: (message: string, ...args: any[]) => {
    try {
      if (__DEV__) {
        console.log(`ℹ️ ${message}`, ...args);
      }
    } catch (e) {
      // Silent fail
    }
  },
  error: (message: string, error?: any) => {
    try {
      if (__DEV__) {
        console.warn(`❌ ${message}`, error?.message || error || '');
      }
    } catch (e) {
      // Silent fail
    }
  },
  warn: (message: string, ...args: any[]) => {
    try {
      if (__DEV__) {
        console.warn(`⚠️ ${message}`, ...args);
      }
    } catch (e) {
      // Silent fail
    }
  },
};

/**
 * 🔧 Crash-Free Web Component
 * - Eliminated console crash issues ✅
 * - Safe error handling ✅
 * - Improved stability ✅
 * - Memory leak prevention ✅
 * - Following MUI component rules ✅
 */
function Web({setHasError, setLoading, setCanGoBack, webViewRef}: IProps) {
  const [initialUrl, setInitialUrl] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [tokenCheckInProgress, setTokenCheckInProgress] =
    useState<boolean>(false);
  const [value, setValue] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedValue = NativeLocalStorage.getItem('myKey');
    setValue(storedValue ?? '');
  }, []);

  // Refs for cleanup
  const isMountedRef = useRef<boolean>(true);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🚀 Initialize app and determine starting URL
  useEffect(() => {
    const initializeApp = async () => {
      try {
        safeLog.info('Initializing web component...');

        // Check for existing token
        const existingToken = await TokenService.getValidAccessToken();

        if (existingToken) {
          setInitialUrl('https://www.arkafile.org/dashboard');
          safeLog.info('Token found, starting at dashboard');
        } else {
          setInitialUrl('https://www.arkafile.org/login');
          safeLog.info('No token found, starting at login');
        }

        // Add small delay to ensure URL is set before rendering
        initTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setIsInitialized(true);
          }
        }, 100);
      } catch (error) {
        safeLog.error('Error initializing app', error);
        setInitialUrl('https://www.arkafile.org/login'); // Fallback to login
        setIsInitialized(true);
      }
    };

    initializeApp();

    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  // 🌐 Navigation handler with security checks
  const handleNavigation = useCallback((event: any) => {
    const url = event.url;

    try {
      // Handle special protocols
      if (url.startsWith('tel:') || url.startsWith('mailto:')) {
        Linking.openURL(url).catch(error => {
          safeLog.error('Failed to open external link', error);
        });
        return false;
      }

      // Check domain whitelist
      const allowedDomains = ['arkafile.org', 'arkafile.info'];
      const isAllowedDomain = allowedDomains.some(domain =>
        url.includes(domain),
      );

      if (!isAllowedDomain) {
        safeLog.info('Opening external URL in browser:', url);
        Linking.openURL(url).catch(error => {
          safeLog.error('Failed to open external browser', error);
        });
        return false;
      }

      // Allow navigation within allowed domains
      return true;
    } catch (error) {
      safeLog.error('Navigation error', error);
      return false;
    }
  }, []);

  // 🔌 Initialize SSE connection (called once)
  const initializeSSEConnection = useCallback(async () => {
    try {
      if (isInitialized) {
        safeLog.warn('SSE connection already initialized, skipping...');
        return;
      }

      safeLog.info('Initializing SSE connection for the first time...');

      await BackgroundNotifModule?.StartConnection();
      setIsInitialized(true);
      safeLog.info('SSE Connection initialized successfully');
    } catch (error) {
      safeLog.error('Error initializing SSE connection', error);
    }
  }, [isInitialized]);

  // 🔄 Retry token search with timeout
  const waitForToken = useCallback(
    async (maxTimeoutSeconds: number = 30): Promise<string | null> => {
      const startTime = Date.now();
      const timeout = maxTimeoutSeconds * 1000;
      let attempt = 0;

      while (Date.now() - startTime < timeout) {
        attempt++;

        try {
          // Try multiple sources
          let token = await TokenService.getValidAccessToken();

          if (!token) {
            token = await TokenService.forceSyncFromCookies();
          }

          if (!token) {
            const cookieTokens = await TokenService.getTokensFromCookies();
            token = cookieTokens?.token || null;
          }

          if (token && token.length > 10) {
            return token;
          }

          // Wait before next attempt (exponential backoff)
          const delay = Math.min(1000 + attempt * 500, 3000);
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return null;
    },
    [],
  );

  // 🔍 Smart token check and sync with retry
  const syncTokenFromCookies = useCallback(async () => {
    try {
      // Prevent concurrent token checks
      if (tokenCheckInProgress) {
        safeLog.info('Token sync already in progress, skipping...');
        return;
      }

      setTokenCheckInProgress(true);

      const newToken = await waitForToken(30);

      if (newToken) {
        try {
          await BackgroundNotifModule?.SetToken(newToken);
        } catch (serviceError) {
          // Silent fail
        }

        if (isInitialized) {
          await BackgroundNotifModule?.RestartConnection();
        } else {
          await initializeSSEConnection();
        }
      } else {
        if (!isInitialized) {
          await initializeSSEConnection();
        }
      }
    } catch (error) {
      if (!isInitialized) {
        try {
          await initializeSSEConnection();
        } catch (connectionError) {
          // Silent fail
        }
      }
    } finally {
      setTokenCheckInProgress(false);
    }
  }, [
    tokenCheckInProgress,
    isInitialized,
    initializeSSEConnection,
    waitForToken,
  ]);

  // 📱 Handle WebView load completion
  const handleLoadEnd = useCallback(async () => {
    try {
      setLoading(false);
      safeLog.info('WebView load completed');

      // Initialize SSE connection if needed
      if (!isInitialized && !tokenCheckInProgress) {
        safeLog.info('First load completed - initializing SSE...');
        await syncTokenFromCookies();
      }
    } catch (error) {
      safeLog.error('Error in handleLoadEnd', error);
    }
  }, [isInitialized, tokenCheckInProgress, syncTokenFromCookies]);

  // 📨 Handle messages from WebView
  const handleMessage = useCallback(
    async (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case 'CHECK_COOKIES':
            try {
              const existingToken = await waitForToken(60);

              if (existingToken) {
                await BackgroundNotifModule?.SetToken(existingToken);
                await BackgroundNotifModule?.RestartConnection();
              } else {
                await BackgroundNotifModule?.RestartConnection();
              }
            } catch (error) {
              await BackgroundNotifModule?.RestartConnection();
            }
            break;

          case 'LOGOUT':
            await TokenService.clearTokens();
            await TokenService.clearCookies();
            await BackgroundNotifModule?.RestartConnection();
            break;

          default:
            // Ignore non-JSON or unrecognized messages
            break;
        }
      } catch (error) {
        // Silent handling for non-JSON messages - this is normal
      }
    },
    [waitForToken],
  );

  // 🚨 Handle WebView errors
  const handleError = useCallback(
    (error?: any) => {
      try {
        safeLog.error('WebView error occurred', error);
        setHasError(true);

        // Show user-friendly error with native Alert
        Alert.alert(
          'خطای اتصال',
          'مشکلی در بارگذاری صفحه پیش آمده. لطفاً اتصال اینترنت خود را بررسی کنید.',
          [
            {
              text: 'تلاش مجدد',
              onPress: () => {
                try {
                  setHasError(false);
                  webViewRef.current?.reload();
                } catch (reloadError) {
                  safeLog.error('Error reloading WebView', reloadError);
                }
              },
            },
            {text: 'بستن', style: 'cancel'},
          ],
        );
      } catch (alertError) {
        safeLog.error('Error showing alert', alertError);
      }
    },
    [setHasError, webViewRef],
  );

  // 🔄 Handle load progress
  const handleLoadProgress = useCallback(
    (event: any) => {
      try {
        setCanGoBack(event.nativeEvent.canGoBack);
      } catch (error) {
        safeLog.error('Error in handleLoadProgress', error);
      }
    },
    [setCanGoBack],
  );

  // 📱 Handle notification navigation with proper timing
  useEffect(() => {
    if (!isInitialized) return;

    const checkPendingNavigation = async () => {
      try {
        safeLog.info('Checking for pending navigation...');

        if (!BackgroundNotifModule?.getPendingPath) {
          safeLog.warn('getPendingPath method not available');
          return;
        }

        const path = await BackgroundNotifModule.getPendingPath();
        safeLog.info('Pending path received:', path);

        if (path && path.trim() && webViewRef.current) {
          // Wait a bit to ensure WebView is fully loaded
          setTimeout(() => {
            try {
              const jsCode = `
                (function() {
                  try {
                    console.log('🚀 Next.js Navigation to: ${path}');
                    
                    // Check if we're already on the target path
                    if (window.location.pathname === "${path}") {
                      console.log('✅ Already on target path');
                      return true;
                    }
                    
                    // Next.js navigation - try multiple methods
                    
                    // Method 1: Use Next.js router if available
                    if (window.next && window.next.router) {
                      window.next.router.push("${path}");
                      console.log('✅ Navigation via Next.js router');
                      return true;
                    }
                    
                    // Method 2: Try global router variable (some Next.js setups)
                    if (window.__NEXT_ROUTER__) {
                      window.__NEXT_ROUTER__.push("${path}");
                      console.log('✅ Navigation via __NEXT_ROUTER__');
                      return true;
                    }
                    
                    // Method 3: Direct navigation - works best with Next.js
                    window.location.href = "${path}";
                    console.log('✅ Navigation via location.href');
                    
                  } catch (e) {
                    console.error('❌ Navigation error:', e);
                    // Fallback
                    try {
                      window.location.href = "${path}";
                    } catch (fallbackError) {
                      console.error('❌ Fallback navigation failed:', fallbackError);
                    }
                  }
                  return true;
                })();
              `;

              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(jsCode);
                safeLog.info('Navigation JavaScript injected successfully');
              }
            } catch (injectionError) {
              safeLog.error(
                'Error injecting navigation JavaScript',
                injectionError,
              );
            }
          }, 1000); // Give WebView time to fully load
        } else if (path) {
          safeLog.warn('WebView not ready or path empty:', {
            path,
            webViewReady: !!webViewRef.current,
          });
        }
      } catch (error) {
        safeLog.error('Error in checkPendingNavigation', error);
      }
    };

    // Check immediately and also with delay for safety
    checkPendingNavigation();

    // Also check after a delay in case the first check was too early
    const delayedCheck = setTimeout(checkPendingNavigation, 2000);

    return () => {
      clearTimeout(delayedCheck);
    };
  }, [isInitialized]); // Only depend on initialization state

  // Don't render until URL is determined
  if (!isInitialized || !initialUrl) {
    return null;
  }

  return (
    <WebView
      source={{uri: initialUrl}}
      ref={webViewRef}
      onLoadProgress={handleLoadProgress}
      onLoadEnd={handleLoadEnd}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleNavigation}
      onError={handleError}
      onHttpError={handleError}
      originWhitelist={['*']}
      style={{flex: 1}}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={true}
      domStorageEnabled={true}
      javaScriptEnabled={true}
      startInLoadingState={true}
      mixedContentMode={'compatibility'}
      allowUniversalAccessFromFileURLs={false} // Security improvement
      setSupportMultipleWindows={false}
      cacheEnabled={true}
      allowsInlineMediaPlayback={true}
      // Modern user agent
      userAgent="Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 ArkaFile/2.0"
      // 🛡️ Crash-Free JavaScript injection
      injectedJavaScript={`
        (function() {
          'use strict';
          
          // Safe logging function to prevent crashes
          function safeLog(message, data) {
            try {
              // Only log in development, and use a safer method
              if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
                // Silent logging - don't use console methods that might crash
              }
            } catch (e) {
              // Silent fail
            }
          }
          
          // Optimized click handler with debouncing
          let lastClickTime = 0;
          const CLICK_DEBOUNCE = 300;
          
          function handleClick(e) {
            try {
              const currentTime = Date.now();
              if (currentTime - lastClickTime < CLICK_DEBOUNCE) {
                return; // Debounce rapid clicks
              }
              lastClickTime = currentTime;
              
              if (!e.target) return;
              
              const text = e.target.textContent || e.target.innerText || '';
              const lowerText = text.toLowerCase();
              
              if (lowerText.includes('خروج') || lowerText.includes('logout')) {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOGOUT',
                    timestamp: currentTime
                  }));
                }
              } else if (lowerText.includes('ورود') || lowerText.includes('login')) {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CHECK_COOKIES',
                    timestamp: currentTime
                  }));
                }
              }
            } catch (error) {
              // Silent fail to prevent crashes
              safeLog('Error in click handler', error);
            }
          }
          
          // Use passive event listener for better performance
          try {
            document.addEventListener('click', handleClick, { passive: true });
            
            // Cleanup function
            window.addEventListener('beforeunload', function() {
              try {
                document.removeEventListener('click', handleClick);
              } catch (e) {
                // Silent fail
              }
            });
          } catch (error) {
            // Silent fail if event listeners can't be added
            safeLog('Error setting up event listeners', error);
          }
        })();
        
        true; // Required for injection
      `}
    />
  );
}

export default React.memo(Web);
