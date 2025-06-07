import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';

export interface Token {
  token?: string;
}

export class TokenService {
  private static readonly TOKEN_KEY = 'app_token';
  private static readonly DOMAIN = 'arkafile.info';

  /**
   * Extract token from cookies for the current domain
   */
  static async getTokensFromCookies(): Promise<Token | null> {
    try {
      const cookies = await CookieManager.get(`https://${this.DOMAIN}`);
      console.log('Retrieved cookies:', cookies);

      const tokenData: Token = {};

      // Extract only the main token
      if (cookies.token) {
        tokenData.token = cookies.token.value;
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
   * Get valid token (from storage or cookies)
   */
  static async getValidAccessToken(): Promise<string | null> {
    try {
      // First try to get from stored tokens
      let tokens = await this.getStoredTokens();
      
      if (!tokens || !tokens.token) {
        // If no stored tokens, try to get from cookies
        tokens = await this.getTokensFromCookies();
        
        if (tokens) {
          // Save newly retrieved tokens
          await this.saveTokens(tokens);
        }
      }

      return tokens?.token || null;
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
   * Get all cookies for debugging
   */
  static async getAllCookies(): Promise<any> {
    try {
      return await CookieManager.get(`https://${this.DOMAIN}`);
    } catch (error) {
      console.error('Error getting all cookies:', error);
      return {};
    }
  }
} 