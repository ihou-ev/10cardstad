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

// Player info for playing room display
export interface PlayingRoomPlayer {
  name: string;
  is_online: boolean;
}

// Playing room for lobby display
export interface PlayingRoom {
  id: string;
  players: PlayingRoomPlayer[];
  current_round: number;
  started_at: string;
  all_offline: boolean;
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

        // Get room players to check online status
        const { data: roomPlayers } = await supabase
          .from("room_players")
          .select("player_name, is_online, slot")
          .eq("room_id", room.id)
          .order("slot");

        // Map player names with online status
        const players: PlayingRoomPlayer[] = gameState.players.map((p) => {
          const roomPlayer = roomPlayers?.find(rp => rp.player_name === p.name);
          return {
            name: p.name,
            is_online: roomPlayer?.is_online === true,
          };
        });

        const allOffline = players.every(p => !p.is_online);

        // If all players are offline, clean up the room
        if (allOffline) {
          await supabase
            .from("room_players")
            .delete()
            .eq("room_id", room.id);
          await supabase
            .from("game_rooms")
            .delete()
            .eq("id", room.id);
          continue; // Don't add to list
        }

        playingRooms.push({
          id: room.id,
          players,
          current_round: gameState.currentRound + 1,
          started_at: room.created_at,
          all_offline: allOffline,
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
  const { data, error } = await supabase
    .from("room_players")
    .select("id, room_id, player_id, player_name, slot, is_online, joined_at")
    .eq("room_id", roomId)
    .order("slot");

  if (error) {
    console.error("getRoomPlayers error:", error);
  }
  console.log("getRoomPlayers result:", data?.map(p => ({ slot: p.slot, is_online: p.is_online })));

  return (data as RoomPlayer[]) || [];
}

// Mark player as offline (for disconnection during game)
export async function markPlayerOffline(roomId: string, playerId?: string): Promise<void> {
  const supabase = getSupabase();
  const pid = playerId || getPlayerId();

  console.log("markPlayerOffline:", { roomId, playerId: pid });

  // First, check if the player exists in the room
  const { data: existing, error: checkError } = await supabase
    .from("room_players")
    .select("id, player_id, is_online")
    .eq("room_id", roomId)
    .eq("player_id", pid)
    .single();

  console.log("markPlayerOffline - existing player:", existing, "error:", checkError);

  if (!existing) {
    console.error("Player not found in room:", { roomId, playerId: pid });
    return;
  }

  // Perform the update and get the result
  const { data: updated, error } = await supabase
    .from("room_players")
    .update({ is_online: false })
    .eq("room_id", roomId)
    .eq("player_id", pid)
    .select();

  console.log("markPlayerOffline - update result:", updated, "error:", error);

  if (error) {
    console.error("Failed to mark player offline:", error);
  } else if (!updated || updated.length === 0) {
    console.error("Update matched 0 rows - player may not exist or RLS blocking");
  } else {
    console.log("Successfully marked player offline:", updated[0]);
  }

  // Check if all players are now offline - if so, clean up the room
  const { data: allPlayers } = await supabase
    .from("room_players")
    .select("is_online")
    .eq("room_id", roomId);

  const allOffline = allPlayers?.every(p => p.is_online !== true);
  console.log("All players offline check:", { allPlayers, allOffline });

  if (allOffline) {
    console.log("All players offline, cleaning up room:", roomId);
    await supabase
      .from("room_players")
      .delete()
      .eq("room_id", roomId);
    await supabase
      .from("game_rooms")
      .delete()
      .eq("id", roomId);
  }
}

// Remove offline players from room (called when game ends)
export async function removeOfflinePlayers(roomId: string): Promise<void> {
  const supabase = getSupabase();

  // First check who is offline
  const { data: beforeDelete } = await supabase
    .from("room_players")
    .select("player_name, is_online")
    .eq("room_id", roomId);
  console.log("removeOfflinePlayers - before:", beforeDelete);

  const { data: deleted, error } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .or("is_online.eq.false,is_online.is.null")
    .select();
  console.log("removeOfflinePlayers - deleted:", deleted, "error:", error);
}

// Auto-play for offline players - select a random unrevealed card
export async function autoPlayForOfflinePlayers(
  roomId: string,
  currentState: GameState,
  roomPlayers: RoomPlayer[]
): Promise<GameState | null> {
  // Find offline players who need to reveal
  // A player is offline if: is_online !== true OR they don't exist in roomPlayers at all
  const waitingOffline = currentState.waitingForPlayers.filter((slot) => {
    const roomPlayer = roomPlayers.find(p => p.slot === slot);
    // Offline if: not in room_players, or is_online !== true
    return !roomPlayer || roomPlayer.is_online !== true;
  });

  console.log("autoPlayForOfflinePlayers - waitingOffline:", waitingOffline);

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

// Start a new game with online players only
export async function startNewGame(roomId: string): Promise<GameState | null> {
  const supabase = getSupabase();

  // First check current state of players
  const { data: beforePlayers } = await supabase
    .from("room_players")
    .select("player_name, is_online, slot")
    .eq("room_id", roomId)
    .order("slot");
  console.log("startNewGame - before cleanup:", beforePlayers);

  // Remove offline players from the room (is_online = false OR is_online IS NULL)
  const { data: deleted, error: deleteError } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .or("is_online.eq.false,is_online.is.null")
    .select();
  console.log("startNewGame - deleted players:", deleted, "error:", deleteError);

  // Get remaining online players (must have is_online = true explicitly)
  const { data: players, error: playersError } = await supabase
    .from("room_players")
    .select("id, player_name, slot")
    .eq("room_id", roomId)
    .eq("is_online", true)
    .order("slot");
  console.log("startNewGame - remaining players:", players);

  if (playersError || !players || players.length < 2) {
    console.error("Not enough players to start new game:", playersError);
    return null;
  }

  // Reassign slots to be consecutive (0, 1, 2, ...)
  for (let i = 0; i < players.length; i++) {
    if (players[i].slot !== i) {
      await supabase
        .from("room_players")
        .update({ slot: i })
        .eq("id", players[i].id);
    }
  }

  // Initialize a fresh game with online players only
  const playerNames = players.map((p) => p.player_name);
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

// Admin statistics
export interface AdminStats {
  totalGamesPlayed: number;
  totalGamesToday: number;
  activeRooms: number;
  activePlayers: number;
  recentGames: AdminGameEntry[];
}

export interface AdminGameEntry {
  id: string;
  status: string;
  players: string[];
  winner: string | null;
  rounds: number;
  created_at: string;
  finished_at: string | null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = getSupabase();

  // Get total finished games
  const { count: totalGamesPlayed } = await supabase
    .from("game_rooms")
    .select("*", { count: "exact", head: true })
    .eq("status", "finished");

  // Get today's games
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: totalGamesToday } = await supabase
    .from("game_rooms")
    .select("*", { count: "exact", head: true })
    .eq("status", "finished")
    .gte("created_at", today.toISOString());

  // Get active rooms (waiting + playing)
  const { count: activeRooms } = await supabase
    .from("game_rooms")
    .select("*", { count: "exact", head: true })
    .in("status", ["waiting", "playing"]);

  // Get active players
  const { count: activePlayers } = await supabase
    .from("room_players")
    .select("*", { count: "exact", head: true })
    .eq("is_online", true);

  // Get recent games (last 50)
  const { data: rooms } = await supabase
    .from("game_rooms")
    .select("id, status, game_state, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const recentGames: AdminGameEntry[] = [];
  if (rooms) {
    for (const room of rooms) {
      let players: string[] = [];
      let winner: string | null = null;
      let rounds = 0;

      if (room.game_state) {
        try {
          const gameState = JSON.parse(
            typeof room.game_state === "string"
              ? room.game_state
              : JSON.stringify(room.game_state)
          ) as GameState;
          players = gameState.players.map((p) => p.name);
          winner = gameState.winner?.map((w) => w.name).join(", ") || null;
          rounds = gameState.currentRound;
        } catch {
          // Skip invalid game state
        }
      }

      // If no game_state, get players from room_players
      if (players.length === 0) {
        const { data: roomPlayers } = await supabase
          .from("room_players")
          .select("player_name")
          .eq("room_id", room.id)
          .order("slot");
        if (roomPlayers) {
          players = roomPlayers.map((p) => p.player_name);
        }
      }

      recentGames.push({
        id: room.id,
        status: room.status,
        players,
        winner,
        rounds,
        created_at: room.created_at,
        finished_at: room.status === "finished" ? room.created_at : null,
      });
    }
  }

  return {
    totalGamesPlayed: totalGamesPlayed || 0,
    totalGamesToday: totalGamesToday || 0,
    activeRooms: activeRooms || 0,
    activePlayers: activePlayers || 0,
    recentGames,
  };
}
