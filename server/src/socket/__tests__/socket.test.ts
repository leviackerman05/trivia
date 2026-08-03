import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { attachSocketIo } from '../index.js';
import { RoomEngine } from '../../engine/room-engine.js';
import { createDefaultLimiters } from '../../lib/rate-limit.js';

describe('socket.io boot', () => {
  let httpServer: ReturnType<typeof createHttpServer> | undefined;
  let io: SocketServer | undefined;
  const clients: ClientSocket[] = [];

  async function startServer(): Promise<number> {
    httpServer = createHttpServer();
    io = attachSocketIo(httpServer, {
      engine: new RoomEngine(),
      limiters: createDefaultLimiters(),
    });
    await new Promise<void>((resolve) => httpServer!.listen(0, resolve));
    return (httpServer!.address() as AddressInfo).port;
  }

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    if (io) {
      await new Promise<void>((resolve) => io!.close(() => resolve()));
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
  });

  it('accepts a client connection and disconnects cleanly', async () => {
    const port = await startServer();
    const client: ClientSocket = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', (error) => reject(error));
    });

    expect(client.connected).toBe(true);

    client.disconnect();
    expect(client.connected).toBe(false);
  });
});
