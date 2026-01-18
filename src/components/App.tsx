"use client";

import { useState, useEffect, useCallback } from "react";
import { GameState } from "@/lib/game";
import { GameRoom, RoomPlayer } from "@/lib/supabase";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomPlayers,
  startGame,
  processNextRound,
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

  const playerId = typeof window !== "undefined" ? getPlayerId() : "";

  // Subscribe to room updates when in waiting or playing state
  useEffect(() => {
    if (state.type !== "waiting" && state.type !== "playing") return;

    const roomId = state.room.id;

    const unsubscribe = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        // Room updated
        if (updatedRoom.status === "playing" && updatedRoom.game_state) {
          const gameState = JSON.parse(updatedRoom.game_state as string) as GameState;
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
      unsubscribe();
    };
  }, [state.type, state.type === "waiting" || state.type === "playing" ? state.room.id : null]);

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

  const handleJoinRoom = useCallback(async (roomCode: string, playerName: string) => {
    setIsLoading(true);
    setError(null);

    const result = await joinRoom(roomCode, playerName);

    if (result) {
      const players = await getRoomPlayers(result.room.id);
      setState({
        type: "waiting",
        room: result.room,
        players,
        mySlot: result.slot,
      });
    } else {
      setError("ルームへの参加に失敗しました。コードを確認してください。");
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

  const handleNextRound = useCallback(async () => {
    if (state.type !== "playing") return;

    const newState = await processNextRound(state.room.id, state.gameState);

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
        roomCode={state.room.room_code}
        players={state.players}
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
        onNextRound={handleNextRound}
        onLeave={handleLeave}
      />
    );
  }

  return null;
}
