import { getSupabase, GameRoom, RoomPlayer } from "./supabase";
import { GameState, initializeGame, processRevealRound, determineWinner } from "./game";

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
    });

  if (joinError) {
    console.error("Failed to join room:", joinError);
    return null;
  }

  return { room: room as GameRoom, playerId };
}

// Join an existing room
export async function joinRoom(
  roomCode: string,
  playerName: string
): Promise<{ room: GameRoom; playerId: string; slot: number } | null> {
  const supabase = getSupabase();
  const playerId = getPlayerId();

  // Find the room
  const { data: room, error: roomError } = await supabase
    .from("game_rooms")
    .select()
    .eq("room_code", roomCode.toUpperCase())
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
    });

  if (joinError) {
    console.error("Failed to join room:", joinError);
    return null;
  }

  return { room: room as GameRoom, playerId, slot };
}

// Leave a room
export async function leaveRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  const playerId = getPlayerId();

  await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("player_id", playerId);
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

  if (players.length !== 5) {
    console.error("Need exactly 5 players");
    return null;
  }

  // Initialize game with player names
  const playerNames = players.sort((a, b) => a.slot - b.slot).map((p) => p.player_name);
  const gameState = initializeGame(playerNames);

  // Update room with game state
  const { error } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
      game_state: JSON.stringify(gameState),
    })
    .eq("id", roomId);

  if (error) {
    console.error("Failed to start game:", error);
    return null;
  }

  return gameState;
}

// Process next reveal round
export async function processNextRound(roomId: string, currentState: GameState): Promise<GameState | null> {
  const supabase = getSupabase();
  let newState = currentState;

  if (currentState.phase === "revealing") {
    newState = processRevealRound(currentState);
  } else if (currentState.phase === "showdown") {
    newState = determineWinner(currentState);
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
    console.error("Failed to update game state:", error);
    return null;
  }

  return newState;
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
        event: "*",
        schema: "public",
        table: "game_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
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
      async () => {
        // Refetch all players on any change
        const players = await getRoomPlayers(roomId);
        onPlayersUpdate(players);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(roomChannel);
  };
}
