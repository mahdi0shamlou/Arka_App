import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';

export interface Token {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  expires_at?: number;
}

export class TokenService {
  private static readonly TOKEN_KEY = 'app_tokens';
  private static readonly DOMAIN = 'arkafile.info';

  /**
   * Extract tokens from cookies for the current domain
   */
  static async getTokensFromCookies(): Promise<Token | null> {
    try {
      const cookies = await CookieManager.get(`https://${this.DOMAIN}`);
      console.log('Retrieved cookies:', cookies);

      const token: Token = {};

      // Extract common token cookie names
      if (cookies.access_token) {
        token.access_token = cookies.access_token.value;
      }
      if (cookies.token) {
        token.access_token = cookies.token.value;
      }
      if (cookies.auth_token) {
        token.access_token = cookies.auth_token.value;
      }
      if (cookies.refresh_token) {
        token.refresh_token = cookies.refresh_token.value;
      }
      if (cookies.expires_in) {
        token.expires_in = parseInt(cookies.expires_in.value);
      }
      if (cookies.token_type) {
        token.token_type = cookies.token_type.value;
      }

      // Calculate expiration time
      if (token.expires_in) {
        token.expires_at = Date.now() + (token.expires_in * 1000);
      }

      return Object.keys(token).length > 0 ? token : null;
    } catch (error) {
      console.error('Error retrieving tokens from cookies:', error);
      return null;
    }
  }

  /**
   * Save tokens to secure local storage
   */
  static async saveTokens(tokens: Token): Promise<boolean> {
    try {
      const tokenData = {
        ...tokens,
        saved_at: Date.now(),
      };
      
      await AsyncStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
      console.log('Tokens saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving tokens:', error);
      return false;
    }
  }

  /**
   * Get tokens from local storage
   */
  static async getStoredTokens(): Promise<Token | null> {
    try {
      const tokenData = await AsyncStorage.getItem(this.TOKEN_KEY);
      if (!tokenData) {
        return null;
      }

      const tokens = JSON.parse(tokenData);
      
      // Check if token is expired
      if (tokens.expires_at && Date.now() > tokens.expires_at) {
        await this.clearTokens();
        return null;
      }

      return tokens;
    } catch (error) {
      console.error('Error retrieving stored tokens:', error);
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  static async clearTokens(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.TOKEN_KEY);
      console.log('Tokens cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing tokens:', error);
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
   * Get valid access token (from storage or cookies)
   */
  static async getValidAccessToken(): Promise<string | null> {
    try {
      // First try to get from stored tokens
      let tokens = await this.getStoredTokens();
      
      if (!tokens || !tokens.access_token) {
        // If no stored tokens, try to get from cookies
        tokens = await this.getTokensFromCookies();
        
        if (tokens) {
          // Save newly retrieved tokens
          await this.saveTokens(tokens);
        }
      }

      return tokens?.access_token || null;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Check if token is valid and not expired
   */
  static async isTokenValid(): Promise<boolean> {
    try {
      const tokens = await this.getStoredTokens();
      
      if (!tokens || !tokens.access_token) {
        return false;
      }

      // Check expiration
      if (tokens.expires_at && Date.now() > tokens.expires_at) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  /**
   * Sync tokens from cookies to storage periodically
   */
  static async syncTokensFromCookies(): Promise<Token | null> {
    try {
      const cookieTokens = await this.getTokensFromCookies();
      
      if (cookieTokens) {
        await this.saveTokens(cookieTokens);
        console.log('Tokens synced from cookies');
        return cookieTokens;
      }
      
      return null;
    } catch (error) {
      console.error('Error syncing tokens from cookies:', error);
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