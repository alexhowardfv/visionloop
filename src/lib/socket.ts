import { io, Socket } from 'socket.io-client';

export const createSocketConnection = (host: string, port: string): Socket => {
  const socket = io(`http://${host}:${port}`, {
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 30000,
    autoConnect: true,
    withCredentials: false,
    forceNew: false,
  });

  return socket;
};
