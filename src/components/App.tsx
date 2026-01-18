"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameState } from "@/lib/game";
import { GameRoom, RoomPlayer } from "@/lib/supabase";
import {
  createRoom,
  joinRoomById,
  leaveRoom,
  getRoomPlayers,
  startGame,
  revealCardOnline,
  startNewGame,
  subscribeToRoom,
  getPlayerId,
} from "@/lib/online-game";
import { Lobby } from "./Lobby";
import { WaitingRoom } from "./WaitingRoom";
import { OnlineGameBoard } from "./OnlineGameBoard";
import { GameBoard } from "./GameBoard";

type AppState =
  | { type: "lobby" }
  | { type: "local" }
  | { type: "waiting"; room: GameRoom; players: RoomPlayer[]; mySlot: number }
  | { type: "playing"; room: GameRoom; gameState: GameState; mySlot: number };

export function App() {
  const [state, setState] = useState<AppState>({ type: "lobby" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const playerId = typeof window !== "undefined" ? getPlayerId() : "";

  // Get roomId from state
  const roomId = (state.type === "waiting" || state.type === "playing") ? state.room.id : null;

  // Auto-leave room when browser is closed or page is navigated away
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentState = stateRef.current;
      if (currentState.type === "waiting" || currentState.type === "playing") {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const playerId = localStorage.getItem("playerId");

        if (supabaseUrl && supabaseKey && playerId) {
          // Use fetch with keepalive to ensure request completes even after page unload
          fetch(
            `${supabaseUrl}/rest/v1/room_players?room_id=eq.${currentState.room.id}&player_id=eq.${playerId}`,
            {
              method: "DELETE",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
              },
              keepalive: true,
            }
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Subscribe to room updates when in waiting or playing state
  useEffect(() => {
    if (!roomId) return;

    console.log("Subscribing to room:", roomId);

    const unsubscribe = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        console.log("Room updated:", updatedRoom.status, updatedRoom.game_state ? "has game_state" : "no game_state");

        // Room updated
        if ((updatedRoom.status === "playing" || updatedRoom.status === "finished") && updatedRoom.game_state) {
          const gameState = JSON.parse(
            typeof updatedRoom.game_state === "string"
              ? updatedRoom.game_state
              : JSON.stringify(updatedRoom.game_state)
          ) as GameState;

          setState((prev) => {
            if (prev.type === "waiting" || prev.type === "playing") {
              return {
                type: "playing",
                room: updatedRoom,
                gameState,
                mySlot: prev.mySlot,
              };
            }
            return prev;
          });
        } else if (updatedRoom.status === "waiting") {
          setState((prev) => {
            if (prev.type === "waiting") {
              return { ...prev, room: updatedRoom };
            }
            return prev;
          });
        }
      },
      (players) => {
        console.log("Players updated:", players.length);
        // Players updated
        setState((prev) => {
          if (prev.type === "waiting") {
            return { ...prev, players };
          }
          return prev;
        });
      }
    );

    return () => {
      console.log("Unsubscribing from room:", roomId);
      unsubscribe();
    };
  }, [roomId]);

  const handleCreateRoom = useCallback(async (playerName: string) => {
    setIsLoading(true);
    setError(null);

    const result = await createRoom(playerName);

    if (result) {
      const players = await getRoomPlayers(result.room.id);
      setState({
        type: "waiting",
        room: result.room,
        players,
        mySlot: 0,
      });
    } else {
      setError("ルームの作成に失敗しました");
    }

    setIsLoading(false);
  }, []);

  const handleJoinRoom = useCallback(async (roomId: string, playerName: string) => {
    setIsLoading(true);
    setError(null);

    const result = await joinRoomById(roomId, playerName);

    if (result) {
      const players = await getRoomPlayers(result.room.id);
      setState({
        type: "waiting",
        room: result.room,
        players,
        mySlot: result.slot,
      });
    } else {
      setError("ルームへの参加に失敗しました。");
    }

    setIsLoading(false);
  }, []);

  const handlePlayLocal = useCallback(() => {
    setState({ type: "local" });
  }, []);

  const handleStartGame = useCallback(async () => {
    if (state.type !== "waiting") return;

    const gameState = await startGame(state.room.id, state.players);

    if (gameState) {
      setState({
        type: "playing",
        room: state.room,
        gameState,
        mySlot: state.mySlot,
      });
    }
  }, [state]);

  const handleSelectCard = useCallback(async (cardId: string) => {
    if (state.type !== "playing") return;

    const newState = await revealCardOnline(
      state.room.id,
      state.gameState,
      state.mySlot,
      cardId
    );

    if (newState) {
      setState({
        ...state,
        gameState: newState,
      });
    }
  }, [state]);

  const handleNextGame = useCallback(async () => {
    if (state.type !== "playing") return;

    const playerNames = state.gameState.players.map((p) => p.name);
    const newState = await startNewGame(state.room.id, playerNames);

    if (newState) {
      setState({
        ...state,
        gameState: newState,
      });
    }
  }, [state]);

  const handleLeave = useCallback(async () => {
    if (state.type === "waiting" || state.type === "playing") {
      await leaveRoom(state.room.id);
    }
    setState({ type: "lobby" });
  }, [state]);

  // Render based on state
  if (state.type === "lobby") {
    return (
      <Lobby
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onPlayLocal={handlePlayLocal}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  if (state.type === "local") {
    return <GameBoard />;
  }

  if (state.type === "waiting") {
    return (
      <WaitingRoom
        players={state.players}
        hostPlayerId={state.room.host_id}
        myPlayerId={playerId}
        isHost={state.room.host_id === playerId}
        onStartGame={handleStartGame}
        onLeave={handleLeave}
      />
    );
  }

  if (state.type === "playing") {
    return (
      <OnlineGameBoard
        gameState={state.gameState}
        isHost={state.room.host_id === playerId}
        mySlot={state.mySlot}
        onSelectCard={handleSelectCard}
        onNextGame={handleNextGame}
        onLeave={handleLeave}
      />
    );
  }

  return null;
}
