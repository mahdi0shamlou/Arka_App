import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';
import {NativeModules} from 'react-native';

const {BackgroundNotifModule} = NativeModules;

export interface Token {
  token?: string;
}

export class TokenService {
  private static readonly TOKEN_KEY = 'app_token';
  private static readonly DOMAINS = ['arkafile.org', 'arkafile.info'];

  /**
   * Extract token from cookies for both domains
   */
  static async getTokensFromCookies(): Promise<Token | null> {
    try {
      let tokenData: Token = {};

      // Check both domains for cookies
      for (const domain of this.DOMAINS) {
        try {
          const cookies = await CookieManager.get(`https://www.${domain}`);

          if (cookies.token && cookies.token.value) {
            tokenData.token = cookies.token.value;
            break;
          }

          const cookiesNonWWW = await CookieManager.get(`https://${domain}`);
          if (cookiesNonWWW.token && cookiesNonWWW.token.value) {
            tokenData.token = cookiesNonWWW.token.value;
            break;
          }
        } catch (domainError) {
          // Silent fail
        }
      }

      return tokenData.token ? tokenData : null;
    } catch (error) {
      console.error('Error retrieving token from cookies:', error);
      return null;
    }
  }

  /**
   * Save token to local storage and send to service
   */
  static async saveTokens(tokens: Token): Promise<boolean> {
    try {
      const tokenData = {
        ...tokens,
        saved_at: Date.now(),
      };

      await AsyncStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));

      // Send token directly to background service
      if (tokens.token && BackgroundNotifModule?.SetToken) {
        try {
          await BackgroundNotifModule.SetToken(tokens.token);
        } catch (serviceError) {
          // Silent fail
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving token:', error);
      return false;
    }
  }

  /**
   * Get token from local storage
   */
  static async getStoredTokens(): Promise<Token | null> {
    try {
      const tokenData = await AsyncStorage.getItem(this.TOKEN_KEY);
      if (!tokenData) {
        return null;
      }

      const tokens = JSON.parse(tokenData);
      return tokens;
    } catch (error) {
      console.error('Error retrieving stored token:', error);
      return null;
    }
  }

  /**
   * Clear stored token and notify service
   */
  static async clearTokens(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.TOKEN_KEY);

      // Clear token from background service
      if (BackgroundNotifModule?.ClearToken) {
        try {
          await BackgroundNotifModule.ClearToken();
        } catch (serviceError) {
          // Silent fail
        }
      }

      return true;
    } catch (error) {
      console.error('Error clearing token:', error);
      return false;
    }
  }

  /**
   * Clear all cookies for the domain
   */
  static async clearCookies(): Promise<boolean> {
    try {
      await CookieManager.clearAll();
      console.log('Cookies cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing cookies:', error);
      return false;
    }
  }

  /**
   * Get valid token (prioritize cookies over storage)
   */
  static async getValidAccessToken(): Promise<string | null> {
    try {
      // Always check cookies first (most up-to-date)
      let tokens = await this.getTokensFromCookies();

      if (tokens && tokens.token) {
        await this.saveTokens(tokens);
        return tokens.token;
      }

      tokens = await this.getStoredTokens();
      if (tokens && tokens.token) {
        return tokens.token;
      }

      return null;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  /**
   * Check if token exists
   */
  static async isTokenValid(): Promise<boolean> {
    try {
      const tokens = await this.getStoredTokens();
      return !!(tokens && tokens.token);
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  /**
   * Sync token from cookies to storage
   */
  static async syncTokensFromCookies(): Promise<Token | null> {
    try {
      const cookieTokens = await this.getTokensFromCookies();

      if (cookieTokens) {
        await this.saveTokens(cookieTokens);
        return cookieTokens;
      }

      return null;
    } catch (error) {
      console.error('Error syncing token from cookies:', error);
      return null;
    }
  }

  /**
   * Get all cookies for debugging from both domains
   */
  static async getAllCookies(): Promise<any> {
    try {
      const allCookies: any = {};

      for (const domain of this.DOMAINS) {
        try {
          // Get cookies with www
          const cookiesWWW = await CookieManager.get(`https://www.${domain}`);
          if (Object.keys(cookiesWWW).length > 0) {
            allCookies[`www.${domain}`] = cookiesWWW;
          }

          // Get cookies without www
          const cookiesNonWWW = await CookieManager.get(`https://${domain}`);
          if (Object.keys(cookiesNonWWW).length > 0) {
            allCookies[domain] = cookiesNonWWW;
          }
        } catch (domainError) {
          // Silent fail
        }
      }

      return allCookies;
    } catch (error) {
      console.error('Error getting all cookies:', error);
      return {};
    }
  }

  /**
   * Smart sync token from cookies (only if different from stored)
   */
  static async forceSyncFromCookies(): Promise<string | null> {
    try {
      const storedTokens = await this.getStoredTokens();
      const storedToken = storedTokens?.token;

      const cookieTokens = await this.getTokensFromCookies();
      const cookieToken = cookieTokens?.token;

      if (cookieToken) {
        if (storedToken !== cookieToken) {
          await this.saveTokens({token: cookieToken});
          return cookieToken;
        } else {
          // Even if unchanged, ensure service has the token
          if (BackgroundNotifModule?.SetToken) {
            try {
              await BackgroundNotifModule.SetToken(cookieToken);
            } catch (serviceError) {
              // Silent fail
            }
          }

          return cookieToken;
        }
      }

      return null;
    } catch (error) {
      console.error('Error syncing token:', error);
      return null;
    }
  }
}
