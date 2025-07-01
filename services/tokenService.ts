import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';

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
          console.log(`Retrieved cookies from ${domain}:`, cookies);

          // Extract token if found
          if (cookies.token && cookies.token.value) {
            tokenData.token = cookies.token.value;
            console.log(`✅ Token found in ${domain} cookies`);
            break; // Use first found token
          }

          // Also check without www
          const cookiesNonWWW = await CookieManager.get(`https://${domain}`);
          if (cookiesNonWWW.token && cookiesNonWWW.token.value) {
            tokenData.token = cookiesNonWWW.token.value;
            console.log(`✅ Token found in ${domain} cookies (non-www)`);
            break;
          }
        } catch (domainError) {
          console.log(
            `⚠️ Could not get cookies from ${domain}:`,
            (domainError as Error).message || domainError,
          );
        }
      }

      return tokenData.token ? tokenData : null;
    } catch (error) {
      console.error('Error retrieving token from cookies:', error);
      return null;
    }
  }

  /**
   * Save token to local storage
   */
  static async saveTokens(tokens: Token): Promise<boolean> {
    try {
      const tokenData = {
        ...tokens,
        saved_at: Date.now(),
      };

      await AsyncStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
      console.log('Token saved successfully');
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
   * Clear stored token
   */
  static async clearTokens(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.TOKEN_KEY);
      console.log('Token cleared successfully');
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
        // Save newly retrieved tokens to storage
        await this.saveTokens(tokens);
        console.log('✅ Token found in cookies and saved to storage');
        return tokens.token;
      }

      // If no cookies, try storage as fallback
      tokens = await this.getStoredTokens();
      if (tokens && tokens.token) {
        console.log('⚠️ Token found only in storage (cookies may be expired)');
        return tokens.token;
      }

      console.log('❌ No valid token found');
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
        console.log('Token synced from cookies');
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
          console.log(
            `⚠️ Could not get cookies from ${domain} for debugging:`,
            (domainError as Error).message || domainError,
          );
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
      console.log('🔄 Smart syncing token from cookies...');

      // Get current stored token
      const storedTokens = await this.getStoredTokens();
      const storedToken = storedTokens?.token;

      // Get fresh token from cookies
      const cookieTokens = await this.getTokensFromCookies();
      const cookieToken = cookieTokens?.token;

      if (cookieToken) {
        // Only update if different from stored token
        if (storedToken !== cookieToken) {
          await this.saveTokens({token: cookieToken});
          console.log('✅ Token updated - was different from stored version');
          return cookieToken;
        } else {
          console.log('✅ Token unchanged - same as stored version');
          return cookieToken;
        }
      }

      console.log('❌ No token found in cookies during sync');
      return null;
    } catch (error) {
      console.error('Error syncing token:', error);
      return null;
    }
  }
}
