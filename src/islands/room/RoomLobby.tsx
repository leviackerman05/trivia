import { useMemo } from 'react';
import { useRoom } from './useRoom';
import RoomLobbyPanel from './RoomLobbyPanel';
import { getGame } from '../../lib/games';

interface Props {
  gameSlug: string;
}

/**
 * Generic room lobby for multiplayer games (M3). The presentational UI lives
 * in RoomLobbyPanel (reused by game islands like Skribbl Arena); this island
 * is the thin hook wrapper Astro hydrates on the 11 non-Skribbl pages.
 */
export default function RoomLobby({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions } = useRoom();

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );

  return (
    <RoomLobbyPanel
      game={game}
      status={status}
      error={error}
      room={room}
      messages={messages}
      actions={actions}
      isHost={isHost}
      gamePlayable={game?.playable === true}
    />
  );
}
