'use client';

import React, { useState } from 'react';
import { getAPIClient } from '@/lib/api';

interface LoginPinpadProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const LoginPinpad: React.FC<LoginPinpadProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNumberClick = (num: string) => {
    if (pin.length < 5) {
      setPin(pin + num);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleLogin = async () => {
    if (pin.length === 0) {
      setError('Please enter a PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Login] Authenticating with PIN:', pin);

      // Use the API client's login method which handles user_id parsing
      const apiClient = getAPIClient();
      const { token } = await apiClient.login(pin, 'Administrator');

      if (token) {
        console.log('[Login] Token received successfully');
        onLoginSuccess(token);
        handleClose();
      } else {
        console.error('[Login] No token returned from login');
        throw new Error('No token received from server');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-primary border border-border rounded-lg shadow-2xl p-6 w-96">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-semibold">Login</h2>
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PIN Display */}
        <div className="mb-6">
          <label className="text-text-secondary text-sm mb-2 block">PIN (5 digits)</label>
          <div className="bg-primary-lighter/50 rounded-lg p-4 text-center">
            <div className="flex justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-lg flex items-center justify-center text-2xl font-bold ${
                    i < pin.length
                      ? 'bg-blue-600 text-white'
                      : 'bg-primary-lighter/30 text-text-muted'
                  }`}
                >
                  {i < pin.length ? '•' : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={isLoading}
              className="bg-primary-lighter/30 hover:bg-primary-lighter/50 text-white text-xl font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            disabled={isLoading}
            className="bg-primary-lighter/30 hover:bg-primary-lighter/50 text-white text-xl font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={isLoading}
            className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 text-sm font-semibold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ←
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading || pin.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
        >
          {isLoading ? 'Authenticating...' : 'Login'}
        </button>
      </div>
    </div>
  );
};
