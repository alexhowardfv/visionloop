'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createSocketConnection } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/constants';
import { SocketInspectionData } from '@/types';

interface UseWebSocketProps {
  onMessage: (data: SocketInspectionData) => void;
  onConnectionChange: (connected: boolean) => void;
  socketHost?: string;
  socketPort?: string;
}

export const useWebSocket = ({ onMessage, onConnectionChange, socketHost, socketPort }: UseWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);

  // Keep refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onMessage, onConnectionChange]);

  useEffect(() => {
    // Don't connect if no host/port configured
    if (!socketHost || !socketPort) {
      console.log('[WebSocket] No host/port configured, waiting for settings...');
      return;
    }

    console.log(`[WebSocket] Attempting connection to: http://${socketHost}:${socketPort}`);
    socketRef.current = createSocketConnection(socketHost, socketPort);

    socketRef.current.on(SOCKET_EVENTS.CONNECT, () => {
      console.log('[WebSocket] Connected:', socketRef.current?.id);
      setIsConnected(true);
      onConnectionChangeRef.current(true);
    });

    socketRef.current.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
      console.error('[WebSocket] Connection error:', err);
      setIsConnected(false);
      onConnectionChangeRef.current(false);
    });

    socketRef.current.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      onConnectionChangeRef.current(false);
    });

    socketRef.current.on(SOCKET_EVENTS.RESPONSE_MESSAGE, (data: SocketInspectionData) => {
      console.log('[WebSocket] Received data:', data);
      // Always process data - AppContext handles pause logic
      onMessageRef.current(data);
    });

    return () => {
      console.log('[WebSocket] Cleaning up connection');
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [socketHost, socketPort]); // Reconnect when host or port changes

  return {
    isConnected,
    socket: socketRef.current,
  };
};
