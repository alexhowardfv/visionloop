'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { setAuthToken as setApiAuthToken, clearAuthToken as clearApiAuthToken, getStoredAuthToken, getAPIClient } from '@/lib/api';

// Types
interface AuthState {
  token: string | null;
  userId: string | null;
  isHydrated: boolean;
}

type AuthAction =
  | { type: 'HYDRATE'; payload: { token: string | null; userId: string | null } }
  | { type: 'LOGIN_SUCCESS'; payload: { token: string; userId: string } }
  | { type: 'LOGOUT' };

interface AuthContextValue {
  token: string | null;
  userId: string | null;
  isHydrated: boolean;
  isAuthenticated: boolean;  // DERIVED - not stored
  login: (token: string, userId: string) => void;
  logout: () => void;
}

// Reducer
const initialState: AuthState = { token: null, userId: null, isHydrated: false };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, token: action.payload.token, userId: action.payload.userId, isHydrated: true };
    case 'LOGIN_SUCCESS':
      return { ...state, token: action.payload.token, userId: action.payload.userId };
    case 'LOGOUT':
      return { ...state, token: null, userId: null };
    default:
      return state;
  }
};

// Context
const AuthContext = createContext<AuthContextValue | null>(null);

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = getStoredAuthToken() || null;
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    dispatch({ type: 'HYDRATE', payload: { token: storedToken, userId: storedUserId } });

    // Sync to API instance if we have auth
    if (storedToken) {
      const apiClient = getAPIClient();
      apiClient.setAuthToken(storedToken);
      if (storedUserId) {
        apiClient.setUserId(storedUserId);
      }
    }
  }, []);

  // Sync state changes TO localStorage and API instance
  useEffect(() => {
    // Only sync after hydration to avoid overwriting localStorage with null
    if (!state.isHydrated) return;

    if (state.token && state.userId) {
      // Sync to localStorage
      setApiAuthToken(state.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('userId', state.userId);
      }
      // Sync to API instance
      const apiClient = getAPIClient();
      apiClient.setAuthToken(state.token);
      apiClient.setCloudToken(state.token);
      apiClient.setUserId(state.userId);
    } else {
      // Clear everything
      clearApiAuthToken();
    }
  }, [state.token, state.userId, state.isHydrated]);

  // Login action - atomic update of token + userId
  const login = useCallback((token: string, userId: string) => {
    dispatch({ type: 'LOGIN_SUCCESS', payload: { token, userId } });
  }, []);

  // Logout action
  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  // DERIVED - not stored, computed on access
  const isAuthenticated = useMemo(
    () => state.token !== null && state.userId !== null,
    [state.token, state.userId]
  );

  const value: AuthContextValue = {
    token: state.token,
    userId: state.userId,
    isHydrated: state.isHydrated,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
