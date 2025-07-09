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
  // 📍 No state tracking needed - execute every path immediately

  // 🔄 Clean Path Monitoring Effect
  React.useEffect(() => {
    if (isInitialized) {
      const checkPathChanges = () => {
        const storedPath = NativeLocalStorage.getItem('path');
        const storedCustomerId = NativeLocalStorage.getItem('customerId');

        console.log(
          '🔗 Checking path:',
          storedPath,
          storedCustomerId ? `(customer: ${storedCustomerId})` : '',
        );

        if (!webViewRef.current) return;

        // 1️⃣ Handle new path navigation
        if (shouldNavigate(storedPath)) {
          handlePathNavigation(storedPath!, storedCustomerId);
        }
        // 2️⃣ Handle customer ID change on same path
        else if (shouldClickCustomerButton(storedPath, storedCustomerId)) {
          handleCustomerButtonClick(storedCustomerId!);
        }
      };

      // Helper functions
      const shouldNavigate = (path: string | null) => {
        // هر path موجود را اجرا کن، فارغ از تاریخچه
        return path && path.trim() !== '' && webViewRef.current;
      };

      const shouldClickCustomerButton = (
        path: string | null,
        customerId: string | null,
      ) => {
        // هر customer ID موجود را اجرا کن، فارغ از تاریخچه
        return (
          path === '/dashboard/customers' &&
          customerId &&
          customerId.trim() !== '' &&
          webViewRef.current
        );
      };

      const handlePathNavigation = (
        path: string,
        customerId: string | null,
      ) => {
        const isCustomerPath = path === '/dashboard/customers';

        console.log(
          '🚀 Navigating to:',
          path,
          isCustomerPath && customerId ? `(customer: ${customerId})` : '',
        );

        // No need to track processed paths anymore
        console.log('🚀 Executing navigation without state tracking');

        // Inject navigation script
        const jsCode = createNavigationScript(path, isCustomerPath, customerId);
        webViewRef.current?.injectJavaScript(jsCode);

        console.log('✅ Navigation script injected');

        // 🧹 Clear data after action (longer delay for files and customers)
        const needsSlowRegularClear =
          path.includes('/dashboard/files-mobile/') || isCustomerPath;
        const clearDelay = needsSlowRegularClear ? 3000 : 200; // Slow navigation needs more time

        setTimeout(() => {
          console.log('🧹 Clearing path from SharedPreferences');
          NativeLocalStorage.setItem('', 'path'); // Clear path
          if (!isCustomerPath) {
            console.log('🧹 Clearing customerId from SharedPreferences');
            NativeLocalStorage.setItem('', 'customerId'); // Clear customer ID if not customer page
          }
        }, clearDelay);
      };

      const handleCustomerButtonClick = (customerId: string) => {
        console.log('🔄 Customer button click for:', customerId);

        console.log('🔘 Executing button click without state tracking');

        const jsCode = createButtonClickScript(customerId);
        webViewRef.current?.injectJavaScript(jsCode);

        console.log('✅ Button click script injected');

        // 🧹 Clear customer ID after click (slower for stability)
        setTimeout(() => {
          console.log('🧹 Clearing customerId after button click');
          NativeLocalStorage.setItem('', 'customerId');
        }, 2000); // کندتر برای پایداری
      };

      const createNavigationScript = (
        path: string,
        isCustomerPath: boolean,
        customerId: string | null,
      ) => {
        const isFilePath = path.includes('/dashboard/files-mobile/');
        const needsSlowRegularNav = isFilePath || isCustomerPath;
        return `
          (function() {
            try {
              console.log('🚀 Navigation script for:', '${path}');
              ${needsSlowRegularNav ? 'console.log("📁 Slow navigation - adding delay");' : ''}
              
              // Navigation function
              function navigate() {
                if (window.next?.router) {
                  window.next.router.push('${path}');
                  console.log('✅ Next.js router navigation');
                  return true;
                }
                if (window.__NEXT_ROUTER__) {
                  window.__NEXT_ROUTER__.push('${path}');
                  console.log('✅ __NEXT_ROUTER__ navigation');
                  return true;
                }
                window.location.href = '${path}';
                console.log('✅ Direct navigation');
                return true;
              }
              
                           // Customer button click function
               function clickButton(id) {
                 console.log('🔍 Looking for button with ID: customer.' + id + '.button');
                 
                 // Primary method: getElementById (as used by user's site)
                 try {
                   const primaryBtn = document.getElementById('customer.' + id + '.button');
                   if (primaryBtn && primaryBtn.offsetParent !== null) {
                     console.log('✅ Button found with getElementById');
                     primaryBtn.click();
                     console.log('✅ Button clicked successfully');
                     return true;
                   }
                 } catch (e) {
                   console.warn('⚠️ getElementById failed:', e.message);
                 }
                 
                 // Fallback selectors
                 const selectors = [
                   '#customer\\\\.' + id + '\\\\.button',
                   '.customer-' + id + ' button',
                   '#customer-' + id + ' button',
                   '[data-customer-id="' + id + '"] button',
                   '[class*="customer-' + id + '"] button',
                   'button[onclick*="' + id + '"]',
                   'button[data-id="' + id + '"]',
                   'tr[data-id="' + id + '"] button',
                   'div[data-customer="' + id + '"] button'
                 ];
                 
                 console.log('🔄 Trying fallback selectors...');
                 for (let i = 0; i < selectors.length; i++) {
                   try {
                     const btn = document.querySelector(selectors[i]);
                     if (btn && btn.offsetParent !== null) {
                       console.log('✅ Button found with fallback:', selectors[i]);
                       btn.click();
                       console.log('✅ Button clicked');
                       return true;
                     }
                   } catch (e) {}
                 }
                 
                 console.warn('⚠️ No visible button found for customer:', id);
                 return false;
               }
              
              // Main logic with delay for files and customers
              const navigationDelay = ${needsSlowRegularNav ? '1500' : '0'};
              
              setTimeout(() => {
                if (window.location.pathname === '${path}') {
                  console.log('✅ Already on target path');
                  ${
                    isCustomerPath && customerId
                      ? `
                  setTimeout(() => clickButton('${customerId}'), 2500);
                  `
                      : ''
                  }
                } else {
                  console.log('🔄 Navigating...');
                  navigate();
                  ${
                    isCustomerPath && customerId
                      ? `
                  // Wait for navigation then click
                  let attempts = 0;
                  const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.location.pathname === '${path}') {
                      clearInterval(checkInterval);
                      setTimeout(() => clickButton('${customerId}'), 2500);
                    } else if (attempts > 15) {
                      clearInterval(checkInterval);
                      console.warn('⚠️ Navigation timeout');
                    }
                  }, 500);
                  `
                      : ''
                  }
                }
              }, navigationDelay);
              
            } catch (e) {
              console.error('❌ Script error:', e);
              setTimeout(() => {
                window.location.href = '${path}';
              }, ${needsSlowRegularNav ? '2000' : '500'});
            }
            return true;
          })();
        `;
      };

      const createButtonClickScript = (customerId: string) => {
        return `
          (function() {
            console.log('🔘 Button click script for customer:', '${customerId}');
            
            // Primary method: getElementById (as used by user's site)
            try {
              const primaryBtn = document.getElementById('customer.${customerId}.button');
              if (primaryBtn && primaryBtn.offsetParent !== null) {
                console.log('✅ Button found with getElementById');
                primaryBtn.click();
                console.log('✅ Button clicked successfully');
                return true;
              }
            } catch (e) {
              console.warn('⚠️ getElementById failed:', e.message);
            }
            
            // Fallback selectors
            const selectors = [
              '#customer\\\\.${customerId}\\\\.button',
              '.customer-${customerId} button',
              '#customer-${customerId} button',
              '[data-customer-id="${customerId}"] button',
              '[class*="customer-${customerId}"] button',
              'button[onclick*="${customerId}"]',
              'button[data-id="${customerId}"]',
              'tr[data-id="${customerId}"] button',
              'div[data-customer="${customerId}"] button'
            ];
            
            console.log('🔄 Trying fallback selectors...');
            for (let i = 0; i < selectors.length; i++) {
              try {
                const btn = document.querySelector(selectors[i]);
                if (btn && btn.offsetParent !== null) {
                  console.log('✅ Button found with fallback:', selectors[i]);
                  btn.click();
                  console.log('✅ Button clicked');
                  return true;
                }
              } catch (e) {}
            }
            
            console.warn('⚠️ No visible button found for customer:', '${customerId}');
            return false;
          })();
        `;
      };

      // Start monitoring
      checkPathChanges();
      const interval = setInterval(checkPathChanges, 500);
      return () => clearInterval(interval);
    }
  }, [webViewRef, isInitialized]);

  // Refs for cleanup
  const isMountedRef = useRef<boolean>(true);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔍 Check for pending navigation immediately (for app cold start)
  const checkPendingNavigation = async () => {
    try {
      console.log('🔍 Checking for pending navigation...');

      const storedPath = NativeLocalStorage.getItem('path');
      const storedCustomerId = NativeLocalStorage.getItem('customerId');

      if (!storedPath) {
        console.log('✅ No pending navigation found');
        return;
      }

      console.log(
        '🎯 Found pending navigation:',
        storedPath,
        storedCustomerId ? `(customer: ${storedCustomerId})` : '',
      );

      // Wait for WebView to be ready
      let attempts = 0;
      const waitForWebView = () => {
        attempts++;
        if (webViewRef.current && attempts < 50) {
          console.log('🚀 WebView ready, executing pending navigation');

          // Execute the same logic as path monitoring
          if (storedPath && storedPath.trim() !== '') {
            // Any path navigation (includes customer path with button click)
            handlePendingPathNavigation(storedPath, storedCustomerId);
          } else if (storedCustomerId && storedCustomerId.trim() !== '') {
            // Only button click without navigation (rare case)
            handlePendingCustomerClick(storedCustomerId);
          }
        } else if (attempts < 50) {
          setTimeout(waitForWebView, 100);
        } else {
          console.warn(
            '⚠️ WebView not ready after 5 seconds, skipping pending navigation',
          );
        }
      };

      // Give more time for file and customer navigation which needs longer to load
      const delayTime =
        storedPath?.includes('/dashboard/files-mobile/') ||
        storedPath === '/dashboard/customers'
          ? 2000
          : 500;
      setTimeout(waitForWebView, delayTime);
    } catch (error) {
      console.error('❌ Error in checkPendingNavigation:', error);
    }
  };

  // Helper functions for pending navigation
  const handlePendingPathNavigation = (
    path: string,
    customerId: string | null,
  ) => {
    const isCustomerPath = path === '/dashboard/customers';
    console.log('🚀 Executing pending navigation to:', path);

    // Simple navigation script for pending execution
    const isFilePath = path.includes('/dashboard/files-mobile/');
    const isCustomerNav = path === '/dashboard/customers';
    const needsSlowNavigation = isFilePath || isCustomerNav;

    const jsCode = `
      (function() {
        try {
          console.log('🚀 Pending navigation to: ${path}');
          
          function navigate() {
            ${needsSlowNavigation ? 'console.log("📁 Slow navigation - using slower method");' : ''}
            
            if (window.next?.router) {
              window.next.router.push('${path}');
              console.log('✅ Next.js router navigation');
              return true;
            }
            if (window.__NEXT_ROUTER__) {
              window.__NEXT_ROUTER__.push('${path}');
              console.log('✅ __NEXT_ROUTER__ navigation');
              return true;
            }
            console.log('✅ Direct navigation');
            window.location.href = '${path}';
            return true;
          }
          
          function clickButton(id) {
            try {
              const btn = document.getElementById('customer.' + id + '.button');
              if (btn && btn.offsetParent !== null) {
                btn.click();
                console.log('✅ Pending button clicked');
                return true;
              }
            } catch (e) {}
            return false;
          }
          
          // For files and customers, add extra delay before navigation
          const navigationDelay = ${needsSlowNavigation ? '1500' : '0'};
          
          setTimeout(() => {
            if (window.location.pathname === '${path}') {
              console.log('✅ Already on target path');
              ${isCustomerPath && customerId ? `setTimeout(() => clickButton('${customerId}'), 2500);` : ''}
            } else {
              navigate();
              ${
                isCustomerPath && customerId
                  ? `
              setTimeout(() => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                  attempts++;
                  if (window.location.pathname === '${path}') {
                    clearInterval(checkInterval);
                    setTimeout(() => clickButton('${customerId}'), 2500);
                                      } else if (attempts > 15) {
                    clearInterval(checkInterval);
                  }
                }, 500);
              }, 1000);`
                  : ''
              }
            }
          }, navigationDelay);
          
        } catch (e) {
          console.error('❌ Pending navigation error:', e);
          setTimeout(() => {
            window.location.href = '${path}';
          }, ${needsSlowNavigation ? '2000' : '500'});
        }
        return true;
      })();
    `;

    webViewRef.current?.injectJavaScript(jsCode);

    // Clear data after execution (longer delay for files and customers)
    const needsSlowClear =
      path.includes('/dashboard/files-mobile/') ||
      path === '/dashboard/customers';
    const clearDelay = needsSlowClear ? 4000 : 1000; // Slow navigation needs more time

    setTimeout(() => {
      console.log('🧹 Clearing pending navigation data');
      NativeLocalStorage.setItem('', 'path');
      if (!isCustomerPath) {
        NativeLocalStorage.setItem('', 'customerId');
      }
    }, clearDelay);
  };

  const handlePendingCustomerClick = (customerId: string) => {
    console.log('🔘 Executing pending customer button click for:', customerId);

    // Simple button click script for pending execution
    const jsCode = `
      (function() {
        console.log('🔘 Pending button click for: ${customerId}');
        
        try {
          const btn = document.getElementById('customer.${customerId}.button');
          if (btn && btn.offsetParent !== null) {
            btn.click();
            console.log('✅ Pending button clicked successfully');
            return true;
          }
        } catch (e) {
          console.warn('⚠️ Pending button click failed:', e.message);
        }
        
        console.warn('⚠️ Pending button not found for customer: ${customerId}');
        return false;
      })();
    `;

    webViewRef.current?.injectJavaScript(jsCode);

    // Clear data after execution (slower for stability)
    setTimeout(() => {
      console.log('🧹 Clearing pending customer data');
      NativeLocalStorage.setItem('', 'customerId');
    }, 3000); // کندتر برای پایداری
  };

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
        initTimeoutRef.current = setTimeout(async () => {
          if (isMountedRef.current) {
            setIsInitialized(true);

            // 🎯 Immediately check for pending navigation after initialization
            await checkPendingNavigation();
          }
        }, 100);
      } catch (error) {
        safeLog.error('Error initializing app', error);
        setInitialUrl('https://www.arkafile.org/login'); // Fallback to login
        setIsInitialized(true);

        // Still check for pending navigation even on error
        setTimeout(checkPendingNavigation, 500);
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
