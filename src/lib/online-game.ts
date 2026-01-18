import { getSupabase, GameRoom, RoomPlayer } from "./supabase";
import { GameState, initializeGame, determineWinner, startRevealRound, revealSelectedCard } from "./game";

// Generate a random 6-character room code
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate a random player ID
export function generatePlayerId(): string {
  return crypto.randomUUID();
}

// Get or create player ID from localStorage
export function getPlayerId(): string {
  if (typeof window === "undefined") return generatePlayerId();

  let playerId = localStorage.getItem("playerId");
  if (!playerId) {
    playerId = generatePlayerId();
    localStorage.setItem("playerId", playerId);
  }
  return playerId;
}

// Room with player count for lobby display
export interface RoomWithPlayerCount {
  id: string;
  room_code: string;
  host_id: string;
  host_name: string;
  player_count: number;
  created_at: string;
}

// Game history for lobby display
export interface GameHistoryEntry {
  id: string;
  players: string[];
  winner: string | null;
  started_at: string;
}

// Playing room for lobby display
export interface PlayingRoom {
  id: string;
  players: string[];
  current_round: number;
  started_at: string;
}

// Get finished games history
export async function getGameHistory(limit: number = 10): Promise<GameHistoryEntry[]> {
  const supabase = getSupabase();

  const { data: rooms, error } = await supabase
    .from("game_rooms")
    .select("id, game_state, created_at")
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !rooms) {
    console.error("Failed to fetch game history:", error);
    return [];
  }

  const history: GameHistoryEntry[] = [];

  for (const room of rooms) {
    if (room.game_state) {
      try {
        const gameState = JSON.parse(
          typeof room.game_state === "string"
            ? room.game_state
            : JSON.stringify(room.game_state)
        ) as GameState;

        const players = gameState.players.map((p) => p.name);
        const winner = gameState.winner && gameState.winner.length > 0
          ? gameState.winner.map((w) => w.name).join(", ")
          : null;

        history.push({
          id: room.id,
          players,
          winner,
          started_at: room.created_at,
        });
      } catch {
        // Skip invalid game state
      }
    }
  }

  return history;
}

// Get playing rooms
export async function getPlayingRooms(): Promise<PlayingRoom[]> {
  const supabase = getSupabase();

  const { data: rooms, error } = await supabase
    .from("game_rooms")
    .select("id, game_state, created_at")
    .eq("status", "playing")
    .order("created_at", { ascending: false });

  if (error || !rooms) {
    console.error("Failed to fetch playing rooms:", error);
    return [];
  }

  const playingRooms: PlayingRoom[] = [];

  for (const room of rooms) {
    if (room.game_state) {
      try {
        const gameState = JSON.parse(
          typeof room.game_state === "string"
            ? room.game_state
            : JSON.stringify(room.game_state)
        ) as GameState;

        playingRooms.push({
          id: room.id,
          players: gameState.players.map((p) => p.name),
          current_round: gameState.currentRound + 1,
          started_at: room.created_at,
        });
      } catch {
        // Skip invalid game state
      }
    }
  }

  return playingRooms;
}

// Get all waiting rooms
export async function getWaitingRooms(): Promise<RoomWithPlayerCount[]> {
  const supabase = getSupabase();

  // Get waiting rooms
  const { data: rooms, error: roomsError } = await supabase
    .from("game_rooms")
    .select("id, room_code, host_id, created_at")
    .eq("status", "waiting")
    .order("created_at", { ascending: false });

  if (roomsError || !rooms) {
    console.error("Failed to fetch rooms:", roomsError);
    return [];
  }

  // Get player counts for each room
  const roomsWithCounts: RoomWithPlayerCount[] = [];

  for (const room of rooms) {
    const { data: players } = await supabase
      .from("room_players")
      .select("player_name, slot")
      .eq("room_id", room.id)
      .order("slot");

    if (players && players.length > 0) {
      roomsWithCounts.push({
        id: room.id,
        room_code: room.room_code,
        host_id: room.host_id,
        host_name: players[0]?.player_name || "Unknown",
        player_count: players.length,
        created_at: room.created_at,
      });
    }
  }

  return roomsWithCounts;
}

// Subscribe to lobby updates (room list changes)
export function subscribeToLobby(onUpdate: () => void) {
  const supabase = getSupabase();

  const channel = supabase
    .channel("lobby")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_rooms",
      },
      () => {
        onUpdate();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_players",
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Create a new room
export async function createRoom(hostName: string): Promise<{ room: GameRoom; playerId: string } | null> {
  const supabase = getSupabase();
  const playerId = getPlayerId();
  const roomCode = generateRoomCode();

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .insert({
      room_code: roomCode,
      host_id: playerId,
      status: "waiting",
    })
    .select()
    .single();

  if (roomError || !room) {
    console.error("Failed to create room:", roomError);
    return null;
  }

  // Join as host (slot 0)
  const { error: joinError } = await supabase
    .from("room_players")
    .insert({
      room_id: room.id,
      player_id: playerId,
      player_name: hostName,
      slot: 0,
      is_online: true,
    });

  if (joinError) {
    console.error("Failed to join room:", joinError);
    return null;
  }

  return { room: room as GameRoom, playerId };
}

// Join an existing room by ID
export async function joinRoomById(
  roomId: string,
  playerName: string
): Promise<{ room: GameRoom; playerId: string; slot: number } | null> {
  const supabase = getSupabase();
  const playerId = getPlayerId();

  // Find the room
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    console.error("Room not found:", roomError);
    return null;
  }

  if (room.status !== "waiting") {
    console.error("Game already started");
    return null;
  }

  // Get current players
  const { data: players } = await supabase
    .from("room_players")
    .select()
    .eq("room_id", room.id);

  // Check if already in room
  const existingPlayer = players?.find((p) => p.player_id === playerId);
  if (existingPlayer) {
    return { room: room as GameRoom, playerId, slot: existingPlayer.slot };
  }

  // Check if room is full
  if (players && players.length >= 5) {
    console.error("Room is full");
    return null;
  }

  // Find next available slot
  const usedSlots = new Set(players?.map((p) => p.slot) || []);
  let slot = 0;
  while (usedSlots.has(slot) && slot < 5) slot++;

  // Join the room
  const { error: joinError } = await supabase
    .from("room_players")
    .insert({
      room_id: room.id,
      player_id: playerId,
      player_name: playerName,
      slot,
      is_online: true,
    });

  if (joinError) {
    console.error("Failed to join room:", joinError);
    return null;
  }

  return { room: room as GameRoom, playerId, slot };
}

// Leave a room (with host transfer)
export async function leaveRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  const playerId = getPlayerId();

  // Get room info
  const { data: room } = await supabase
    .from("game_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (!room) return;

  // Remove player from room
  await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("player_id", playerId);

  // Check remaining players
  const { data: remainingPlayers } = await supabase
    .from("room_players")
    .select()
    .eq("room_id", roomId)
    .order("slot");

  // If no players left, delete the room
  if (!remainingPlayers || remainingPlayers.length === 0) {
    await supabase
      .from("game_rooms")
      .delete()
      .eq("id", roomId);
    return;
  }

  // If leaving player was host, transfer to next player
  if (room.host_id === playerId) {
    const newHost = remainingPlayers[0];
    await supabase
      .from("game_rooms")
      .update({ host_id: newHost.player_id })
      .eq("id", roomId);
  }
}

// Get room players
export async function getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("room_players")
    .select()
    .eq("room_id", roomId)
    .order("slot");

  return (data as RoomPlayer[]) || [];
}

// Mark player as offline (for disconnection during game)
export async function markPlayerOffline(roomId: string, playerId?: string): Promise<void> {
  const supabase = getSupabase();
  const pid = playerId || getPlayerId();

  console.log("markPlayerOffline:", { roomId, playerId: pid });

  const { error } = await supabase
    .from("room_players")
    .update({ is_online: false })
    .eq("room_id", roomId)
    .eq("player_id", pid);

  if (error) {
    console.error("Failed to mark player offline:", error);
  } else {
    console.log("Successfully marked player offline");
  }
}

// Remove offline players from room (called when game ends)
export async function removeOfflinePlayers(roomId: string): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("is_online", false);
}

// Auto-play for offline players - select a random unrevealed card
export async function autoPlayForOfflinePlayers(
  roomId: string,
  currentState: GameState,
  roomPlayers: RoomPlayer[]
): Promise<GameState | null> {
  // Find offline players who need to reveal
  const offlinePlayerSlots = roomPlayers
    .filter((p) => p.is_online === false)
    .map((p) => p.slot);

  const waitingOffline = currentState.waitingForPlayers.filter((slot) =>
    offlinePlayerSlots.includes(slot)
  );

  if (waitingOffline.length === 0) {
    return null; // No offline players waiting
  }

  let newState = currentState;

  // Auto-reveal for each offline player
  for (const slot of waitingOffline) {
    const player = newState.players[slot];
    if (!player) continue;

    // Find an unrevealed card from holeCards
    const unrevealedCard = player.holeCards[0];
    if (!unrevealedCard) continue;

    // Reveal the card
    newState = revealSelectedCard(newState, slot, unrevealedCard.id);
  }

  // If all players have revealed, start next round
  if (newState.phase === "revealing" && newState.waitingForPlayers.length === 0) {
    newState = startRevealRound(newState);
  }

  // If showdown, determine winner
  if (newState.phase === "showdown") {
    newState = determineWinner(newState);
  }

  const status = newState.phase === "finished" ? "finished" : "playing";

  const supabase = getSupabase();
  const { error } = await supabase
    .from("game_rooms")
    .update({
      game_state: JSON.stringify(newState),
      status,
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to auto-play:", error);
    return null;
  }

  // If game finished, remove offline players
  if (newState.phase === "finished") {
    await removeOfflinePlayers(roomId);
  }

  return newState;
}

// Start the game (host only)
export async function startGame(roomId: string, players: RoomPlayer[]): Promise<GameState | null> {
  const supabase = getSupabase();
  const playerId = getPlayerId();

  // Get room to verify host
  const { data: room } = await supabase
    .from("game_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (!room || room.host_id !== playerId) {
    console.error("Only host can start the game");
    return null;
  }

  if (players.length < 2 || players.length > 5) {
    console.error("Need 2-5 players");
    return null;
  }

  // Initialize game with player names
  const playerNames = players.sort((a, b) => a.slot - b.slot).map((p) => p.player_name);
  const gameState = initializeGame(playerNames);

  // Start the first reveal round to identify who needs to select cards
  const stateWithRound = startRevealRound(gameState);

  // Update room with game state
  const { error } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
      game_state: JSON.stringify(stateWithRound),
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to start game:", error);
    return null;
  }

  return stateWithRound;
}

// Start a reveal round - notify which players need to select
export async function startRevealRoundOnline(roomId: string, currentState: GameState): Promise<GameState | null> {
  const supabase = getSupabase();
  const newState = startRevealRound(currentState);

  const { error } = await supabase
    .from("game_rooms")
    .update({
      game_state: JSON.stringify(newState),
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to start reveal round:", error);
    return null;
  }

  return newState;
}

// Player selects which card to reveal
export async function revealCardOnline(
  roomId: string,
  currentState: GameState,
  playerId: number,
  cardId: string
): Promise<GameState | null> {
  const supabase = getSupabase();
  let newState = revealSelectedCard(currentState, playerId, cardId);

  // If all players have revealed and we're still in revealing phase, auto-start next round
  if (newState.phase === "revealing" && newState.waitingForPlayers.length === 0) {
    newState = startRevealRound(newState);
  }

  // If we're in showdown phase, determine the winner
  if (newState.phase === "showdown") {
    newState = determineWinner(newState);
  }

  const status = newState.phase === "finished" ? "finished" : "playing";

  const { error } = await supabase
    .from("game_rooms")
    .update({
      game_state: JSON.stringify(newState),
      status,
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to reveal card:", error);
    return null;
  }

  // If game finished, remove offline players
  if (newState.phase === "finished") {
    await removeOfflinePlayers(roomId);
  }

  return newState;
}

// Start a new game with the same players
export async function startNewGame(roomId: string, playerNames: string[]): Promise<GameState | null> {
  const supabase = getSupabase();

  // Initialize a fresh game with the same players
  const gameState = initializeGame(playerNames);

  // Start the first reveal round
  const stateWithRound = startRevealRound(gameState);

  const { error } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
      game_state: JSON.stringify(stateWithRound),
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to start new game:", error);
    return null;
  }

  return stateWithRound;
}

// Subscribe to room updates
export function subscribeToRoom(
  roomId: string,
  onRoomUpdate: (room: GameRoom) => void,
  onPlayersUpdate: (players: RoomPlayer[]) => void
) {
  const supabase = getSupabase();
  const roomChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "game_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        console.log("Realtime: game_rooms UPDATE received", payload);
        if (payload.new) {
          onRoomUpdate(payload.new as GameRoom);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_players",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        console.log("Realtime: room_players change received", payload);
        // Refetch all players on any change
        const players = await getRoomPlayers(roomId);
        onPlayersUpdate(players);
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });

  return () => {
    supabase.removeChannel(roomChannel);
  };
}
