'use client';

import { useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  message: string;
  type: NotificationType;
  isVisible: boolean;
}

export const useNotification = () => {
  const [notification, setNotification] = useState<Notification>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    setNotification({ message, type, isVisible: true });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
};
