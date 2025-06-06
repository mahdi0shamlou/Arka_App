export interface AuthToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  expires_at?: number;
  saved_at?: number;
}

export interface AuthUser {
  id?: string | number;
  email?: string;
  name?: string;
  username?: string;
  avatar?: string;
  roles?: string[];
  permissions?: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  tokens: AuthToken | null;
  error: string | null;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  remember_me?: boolean;
}

export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface WebViewMessage {
  type: 'TOKEN_UPDATE' | 'LOGOUT' | 'USER_UPDATE' | 'ERROR';
  data?: any;
  tokens?: AuthToken;
  user?: AuthUser;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
} 