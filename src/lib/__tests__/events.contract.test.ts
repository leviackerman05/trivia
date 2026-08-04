import { describe, expect, it } from 'vitest';
import { ClientEvents, ServerEvents } from '../events';
import {
  ClientEvents as ServerClientEvents,
  ServerEvents as ServerServerEvents,
} from '../../../server/src/lib/events';

/**
 * Contract lockstep test: the client event constants must exactly mirror the
 * server's (DECISIONS D011). If this fails, both files must be updated
 * together, event-name drift is the classic real-time bug.
 */
describe('socket event contract (client ↔ server lockstep)', () => {
  it('ClientEvents matches the server mirror', () => {
    expect(ClientEvents).toEqual(ServerClientEvents);
  });

  it('ServerEvents matches the server mirror', () => {
    expect(ServerEvents).toEqual(ServerServerEvents);
  });
});
