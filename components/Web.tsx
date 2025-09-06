import SmsListener from '@ernestbies/react-native-android-sms-listener';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Linking, NativeModules, PermissionsAndroid} from 'react-native';
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

// 📱 Simple SMS Helper Functions using react-native-android-sms-listener
const smsHelpers = {
  // درخواست SMS permission
  requestSMSPermission: async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'این اپ برای خواندن پیامک‌ها نیاز به دسترسی دارد',
          buttonNeutral: 'بعداً بپرس',
          buttonNegative: 'انصراف',
          buttonPositive: 'OK',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  },

  // شروع SMS monitoring
  startSMSMonitoring: async (onOtpFound: (otp: string) => void) => {
    try {
      // درخواست permission
      const receivePermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      );

      const readPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      );

      if (
        receivePermission === PermissionsAndroid.RESULTS.GRANTED &&
        readPermission === PermissionsAndroid.RESULTS.GRANTED
      ) {
        // استفاده از کتابخانه موجود

        const subscription = SmsListener.addListener(message => {
          if (message && message.body) {
            const messageBody = message.body;

            // Extract OTP (4-6 digits)
            const otpMatch = messageBody.match(/\b\d{4,6}\b/);
            if (otpMatch) {
              const otp = otpMatch[0];
              onOtpFound(otp);
            }
          }
        });

        return subscription;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  },

  // تنظیم کامل SMS
  setupSMS: async (onOtpFound: (otp: string) => void) => {
    try {
      const subscription = await smsHelpers.startSMSMonitoring(onOtpFound);
      if (subscription) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  },
};

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

        // Inject navigation script
        const jsCode = createNavigationScript(path, isCustomerPath, customerId);
        webViewRef.current?.injectJavaScript(jsCode);

        // 🧹 Clear data after action (longer delay for files and customers)
        const needsSlowRegularClear =
          path.includes('/dashboard/files-mobile/') || isCustomerPath;
        const clearDelay = needsSlowRegularClear ? 3000 : 200; // Slow navigation needs more time

        setTimeout(() => {
          NativeLocalStorage.setItem('', 'path'); // Clear path
          if (!isCustomerPath) {
            NativeLocalStorage.setItem('', 'customerId'); // Clear customer ID if not customer page
          }
        }, clearDelay);
      };

      const handleCustomerButtonClick = (customerId: string) => {
        const jsCode = createButtonClickScript(customerId);
        webViewRef.current?.injectJavaScript(jsCode);

        // 🧹 Clear customer ID after click (slower for stability)
        setTimeout(() => {
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
              
              // Navigation function
              function navigate() {
                if (window.next?.router) {
                  window.next.router.push('${path}');
                  return true;
                }
                if (window.__NEXT_ROUTER__) {
                  window.__NEXT_ROUTER__.push('${path}');
                  return true;
                }
                window.location.href = '${path}';
                return true;
              }
              
                           // Customer button click function
               function clickButton(id) {
                 // Primary method: getElementById (as used by user's site)
                 try {
                   const primaryBtn = document.getElementById('customer.' + id + '.button');
                   if (primaryBtn && primaryBtn.offsetParent !== null) {
                     primaryBtn.click();
                     return true;
                   }
                 } catch (e) {}
                 
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
                 
                 for (let i = 0; i < selectors.length; i++) {
                   try {
                     const btn = document.querySelector(selectors[i]);
                     if (btn && btn.offsetParent !== null) {
                       btn.click();
                       return true;
                     }
                   } catch (e) {}
                 }
                 
                 return false;
               }
              
              // Main logic with delay for files and customers
              const navigationDelay = ${needsSlowRegularNav ? '1500' : '0'};
              
              setTimeout(() => {
                if (window.location.pathname === '${path}') {
                  ${
                    isCustomerPath && customerId
                      ? `
                  setTimeout(() => clickButton('${customerId}'), 2500);
                  `
                      : ''
                  }
                } else {
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
                    }
                  }, 500);
                  `
                      : ''
                  }
                }
              }, navigationDelay);
              
            } catch (e) {
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
            // Primary method: getElementById (as used by user's site)
            try {
              const primaryBtn = document.getElementById('customer.${customerId}.button');
              if (primaryBtn && primaryBtn.offsetParent !== null) {
                primaryBtn.click();
                return true;
              }
            } catch (e) {}
            
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
            
            for (let i = 0; i < selectors.length; i++) {
              try {
                const btn = document.querySelector(selectors[i]);
                if (btn && btn.offsetParent !== null) {
                  btn.click();
                  return true;
                }
              } catch (e) {}
            }
            
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
      const storedPath = NativeLocalStorage.getItem('path');
      const storedCustomerId = NativeLocalStorage.getItem('customerId');

      if (!storedPath) {
        return;
      }

      // Wait for WebView to be ready
      let attempts = 0;
      const waitForWebView = () => {
        attempts++;
        if (webViewRef.current && attempts < 50) {
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
        }
      };

      // Give more time for file and customer navigation which needs longer to load
      const delayTime =
        storedPath?.includes('/dashboard/files-mobile/') ||
        storedPath === '/dashboard/customers'
          ? 2000
          : 500;
      setTimeout(waitForWebView, delayTime);
    } catch (error) {}
  };

  // Helper functions for pending navigation
  const handlePendingPathNavigation = (
    path: string,
    customerId: string | null,
  ) => {
    const isCustomerPath = path === '/dashboard/customers';

    // Simple navigation script for pending execution
    const isFilePath = path.includes('/dashboard/files-mobile/');
    const isCustomerNav = path === '/dashboard/customers';
    const needsSlowNavigation = isFilePath || isCustomerNav;

    const jsCode = `
      (function() {
        try {
          function navigate() {
            if (window.next?.router) {
              window.next.router.push('${path}');
              return true;
            }
            if (window.__NEXT_ROUTER__) {
              window.__NEXT_ROUTER__.push('${path}');
              return true;
            }
            window.location.href = '${path}';
            return true;
          }
          
          function clickButton(id) {
            try {
              const btn = document.getElementById('customer.' + id + '.button');
              if (btn && btn.offsetParent !== null) {
                btn.click();
                return true;
              }
            } catch (e) {}
            return false;
          }
          
          // For files and customers, add extra delay before navigation
          const navigationDelay = ${needsSlowNavigation ? '1500' : '0'};
          
          setTimeout(() => {
            if (window.location.pathname === '${path}') {
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
      NativeLocalStorage.setItem('', 'path');
      if (!isCustomerPath) {
        NativeLocalStorage.setItem('', 'customerId');
      }
    }, clearDelay);
  };

  const handlePendingCustomerClick = (customerId: string) => {
    // Simple button click script for pending execution
    const jsCode = `
      (function() {
        try {
          const btn = document.getElementById('customer.${customerId}.button');
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        } catch (e) {}
        
        return false;
      })();
    `;

    webViewRef.current?.injectJavaScript(jsCode);

    // Clear data after execution (slower for stability)
    setTimeout(() => {
      NativeLocalStorage.setItem('', 'customerId');
    }, 3000); // کندتر برای پایداری
  };

  // 🚀 Initialize app and determine starting URL
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 📱 Initialize OTP verification
        try {
          const onOtpFound = (otp: string) => {
            // Advanced OTP injection with timing, DOM observation, and persistence
            const jsCode = `
              (function() {
                // Store OTP globally for persistence
                window.PENDING_OTP = '${otp}';
                
                function attemptOTPInjection(otp, attempt = 1) {
                  let success = false;
                  
                  // Method 1: Direct function calls (multiple possible names)
                  const functionNames = ['setCodeString', 'setCode', 'setOTP', 'setVerificationCode', 'updateCode', 'handleOTPInput'];
                  for (let funcName of functionNames) {
                    try {
                      if (typeof window[funcName] === 'function') {
                        window[funcName](otp);
                        success = true;
                        break;
                      }
                    } catch (e) {}
                  }
                  
                  // Method 2: Enhanced input field detection
                  if (!success) {
                    const selectors = [
                      // Basic selectors
                      'input[name="code"]', 'input[name="otp"]', 'input[name="verificationCode"]',
                      'input[id="code"]', 'input[id="otp"]', 'input[id="verificationCode"]',
                      // Persian text
                      'input[placeholder*="کد"]', 'input[placeholder*="تایید"]',
                      // English text  
                      'input[placeholder*="code"]', 'input[placeholder*="verification"]', 'input[placeholder*="OTP"]',
                      // Length-based detection
                      'input[type="text"][maxlength="6"]', 'input[type="text"][maxlength="4"]', 'input[type="text"][maxlength="5"]',
                      'input[type="number"][maxlength="6"]', 'input[type="number"][maxlength="4"]', 'input[type="number"][maxlength="5"]',
                      // Class-based
                      '.verification-input', '.otp-input', '.code-input', '.verification-code', 
                      '.otp-field', '.code-field', '.pin-input', '.sms-code',
                      // Nested searches
                      '.verification-input input', '.otp-input input', '.code-input input',
                      '.form-control[name*="code"]', '.form-control[name*="otp"]',
                      // Data attributes
                      '[data-testid*="code"]', '[data-testid*="otp"]', '[data-testid*="verification"]',
                      // Any text input that looks like OTP (fallback)
                      'input[type="text"]:not([name]):not([id])', 'input[type="number"]:not([name]):not([id])'
                    ];
                    
                    for (let selector of selectors) {
                      try {
                        const inputs = document.querySelectorAll(selector);
                        for (let input of inputs) {
                          if (input && input.offsetParent !== null && !input.disabled && !input.readOnly) {
                            // Try multiple ways to set value
                            const originalValue = input.value;
                            
                            // Native value setting
                            input.value = otp;
                            
                            // React-style value setting
                            const valueSetter = Object.getOwnPropertyDescriptor(input, 'value') || 
                                              Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');
                            if (valueSetter && valueSetter.set) {
                              valueSetter.set.call(input, otp);
                            }
                            
                            // Trigger all possible events
                            ['focus', 'input', 'change', 'blur', 'keydown', 'keyup'].forEach(eventType => {
                              try {
                                input.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                              } catch (e) {}
                            });
                            
                            // React synthetic events
                            try {
                              const event = new Event('input', { bubbles: true });
                              event.simulated = true;
                              input.dispatchEvent(event);
                            } catch (e) {}
                            
                            if (input.value === otp || input.value !== originalValue) {
                              success = true;
                              break;
                            }
                          }
                        }
                        if (success) break;
                      } catch (e) {}
                    }
                  }
                  
                  // Method 3: React Fiber traversal (advanced)
                  if (!success && window.React) {
                    try {
                      // Find all React components and try to set state
                      const allElements = document.querySelectorAll('*');
                      for (let element of allElements) {
                        const keys = Object.keys(element).filter(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
                        for (let key of keys) {
                          try {
                            const fiber = element[key];
                            if (fiber && fiber.memoizedProps && typeof fiber.memoizedProps.onChange === 'function') {
                              fiber.memoizedProps.onChange({ target: { value: otp } });
                              success = true;
                              break;
                            }
                          } catch (e) {}
                        }
                        if (success) break;
                      }
                    } catch (e) {}
                  }
                  
                  // Method 4: Global state and callbacks
                  try {
                    window.receivedOTP = otp;
                    window.autoFillOTP = otp;
                    window.injectedOTP = otp;
                    
                    // Try various callback names
                    const callbacks = ['handleOTPReceived', 'onOTPReceived', 'setOTPValue', 'fillOTP', 'autoFillOTP'];
                    for (let callback of callbacks) {
                      if (typeof window[callback] === 'function') {
                        window[callback](otp);
                        success = true;
                      }
                    }
                  } catch (e) {}
                  
                  // Method 5: Custom events with different names
                  try {
                    const events = [
                      { name: 'otpReceived', detail: { otp: otp } },
                      { name: 'smsCodeReceived', detail: { code: otp } },
                      { name: 'verificationCodeReceived', detail: { verificationCode: otp } },
                      { name: 'autoFillOTP', detail: { value: otp } },
                      { name: 'codeInput', detail: { code: otp } }
                    ];
                    
                    for (let eventConfig of events) {
                      const customEvent = new CustomEvent(eventConfig.name, { detail: eventConfig.detail });
                      document.dispatchEvent(customEvent);
                      window.dispatchEvent(customEvent);
                    }
                  } catch (e) {}
                  
                  return success;
                }
                
                // Initial attempt
                let success = attemptOTPInjection('${otp}');
                
                // If failed, set up observers and retry with delays
                if (!success) {
                  // Setup MutationObserver for DOM changes
                  const observer = new MutationObserver(function(mutations) {
                    if (window.PENDING_OTP) {
                      if (attemptOTPInjection(window.PENDING_OTP)) {
                        window.PENDING_OTP = null;
                        observer.disconnect();
                      }
                    }
                  });
                  
                  observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'id', 'name']
                  });
                  
                  // Retry with increasing delays
                  const delays = [500, 1000, 2000, 3000, 5000];
                  delays.forEach((delay, index) => {
                    setTimeout(() => {
                      if (window.PENDING_OTP) {
                        if (attemptOTPInjection(window.PENDING_OTP, index + 2)) {
                          window.PENDING_OTP = null;
                          observer.disconnect();
                        }
                      }
                    }, delay);
                  });
                  
                  // Cleanup after 10 seconds
                  setTimeout(() => {
                    observer.disconnect();
                    window.PENDING_OTP = null;
                  }, 10000);
                }
                
                return success;
              })();
            `;

            if (webViewRef && webViewRef.current) {
              webViewRef.current.injectJavaScript(jsCode);
            }
          };

          await smsHelpers.setupSMS(onOtpFound);
        } catch (error) {}

        // Check for existing token
        const existingToken = await TokenService.getValidAccessToken();

        if (existingToken) {
          setInitialUrl('https://www.arkafile.org/dashboard');
        } else {
          setInitialUrl('https://www.arkafile.org/login');
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
      // Update current URL for OTP logic

      // Handle special protocols
      if (url.startsWith('tel:') || url.startsWith('mailto:')) {
        Linking.openURL(url).catch(error => {});
        return false;
      }

      // Check domain whitelist
      const allowedDomains = [
        'arkafile.org',
        'arkafile.info',
        'shaparak.ir',
        'zarinpal.com',
        'zarinpal.ir',
      ];

      const isAllowedDomain = allowedDomains.some(domain =>
        url.includes(domain),
      );

      if (!isAllowedDomain) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      // Allow navigation within allowed domains
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // 🔌 Initialize SSE connection (called once)
  const initializeSSEConnection = useCallback(async () => {
    try {
      if (isInitialized) {
        return;
      }

      await BackgroundNotifModule?.StartConnection();
      setIsInitialized(true);
    } catch (error) {}
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

      // Initialize SSE connection if needed
      if (!isInitialized && !tokenCheckInProgress) {
        await syncTokenFromCookies();
      }
    } catch (error) {}
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
                } catch (reloadError) {}
              },
            },
            {text: 'بستن', style: 'cancel'},
          ],
        );
      } catch (alertError) {}
    },
    [setHasError, webViewRef],
  );

  // 🔄 Handle load progress
  const handleLoadProgress = useCallback(
    (event: any) => {
      try {
        setCanGoBack(event.nativeEvent.canGoBack);
      } catch (error) {}
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
              const targetType = e.target.tagName || 'no';

              if (lowerText.includes('خروج از حساب') && targetType === 'SPAN') {
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
          }
        })();
        
        true; // Required for injection
      `}
    />
  );
}

export default React.memo(Web);
