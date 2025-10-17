import { io, Socket } from 'socket.io-client';

export const createSocketConnection = (host: string, port: string): Socket => {
  const socket = io(`http://${host}:${port}`, {
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
    withCredentials: false,
    extraHeaders: {
      'Access-Control-Allow-Origin': '*',
    },
  });

  return socket;
};
