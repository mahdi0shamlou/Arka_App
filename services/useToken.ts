import {useEffect, useState, useCallback} from 'react';
import {TokenService, Token} from './tokenService';

export interface UseTokenReturn {
  tokens: Token | null;
  accessToken: string | null;
  isTokenValid: boolean;
  isLoading: boolean;
  error: string | null;
  refreshTokens: () => Promise<void>;
  clearTokens: () => Promise<void>;
  syncFromCookies: () => Promise<void>;
}

export const useToken = (): UseTokenReturn => {
  const [tokens, setTokens] = useState<Token | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isTokenValid, setIsTokenValid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load tokens from storage on mount
  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const storedTokens = await TokenService.getStoredTokens();
        setTokens(storedTokens);
        
        const validToken = await TokenService.getValidAccessToken();
        setAccessToken(validToken);
        
        const valid = await TokenService.isTokenValid();
        setIsTokenValid(valid);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadTokens();
  }, []);

  // Refresh tokens from storage or cookies
  const refreshTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const validToken = await TokenService.getValidAccessToken();
      setAccessToken(validToken);
      
      const storedTokens = await TokenService.getStoredTokens();
      setTokens(storedTokens);
      
      const valid = await TokenService.isTokenValid();
      setIsTokenValid(valid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear all tokens
  const clearTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await TokenService.clearTokens();
      await TokenService.clearCookies();
      
      setTokens(null);
      setAccessToken(null);
      setIsTokenValid(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync tokens from cookies
  const syncFromCookies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const cookieTokens = await TokenService.syncTokensFromCookies();
      
      if (cookieTokens) {
        setTokens(cookieTokens);
        setAccessToken(cookieTokens.access_token || null);
        
        const valid = await TokenService.isTokenValid();
        setIsTokenValid(valid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    tokens,
    accessToken,
    isTokenValid,
    isLoading,
    error,
    refreshTokens,
    clearTokens,
    syncFromCookies,
  };
}; 