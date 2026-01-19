"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  GameState,
  Difficulty,
  DIFFICULTY_CONFIGS,
  initializeGame,
  startRevealRound,
  revealSelectedCard,
  determineWinner,
} from "@/lib/game";
import { PlayerArea } from "./PlayerArea";
import { cn } from "@/lib/utils";
import { playCardFlipSound, playWinnerSound } from "@/lib/sounds";

const BOT_NAMES = ["CPU 1", "CPU 2", "CPU 3", "CPU 4"];
const DIFFICULTIES: Difficulty[] = ["normal", "hard", "hell", "nightmare"];

interface GameBoardProps {
  onBack: () => void;
}

export function GameBoard({ onBack }: GameBoardProps) {
  const [playerName, setPlayerName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Track previous state for sound effects
  const prevRevealCount = useRef(0);
  const prevPhase = useRef<string | null>(null);

  const startNewGame = useCallback((diff: Difficulty = difficulty) => {
    if (!playerName.trim()) return;
    const state = initializeGame([playerName.trim(), ...BOT_NAMES], diff);
    const stateWithRound = startRevealRound(state);
    setGameState(stateWithRound);
  }, [playerName, difficulty]);

  // Player selects a card to reveal
  const handleSelectCard = useCallback((cardId: string) => {
    if (!gameState) return;
    if (gameState.phase !== "revealing") return;
    if (!gameState.waitingForPlayers.includes(0)) return; // Player is always slot 0

    let newState = revealSelectedCard(gameState, 0, cardId);

    // If all players have revealed and we're still in revealing phase, start next round
    if (newState.phase === "revealing" && newState.waitingForPlayers.length === 0) {
      newState = startRevealRound(newState);
    }

    // If showdown, determine winner
    if (newState.phase === "showdown") {
      newState = determineWinner(newState);
    }

    setGameState(newState);
  }, [gameState]);

  // Auto-play for bots
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== "revealing") return;

    // Check if any bots need to reveal (slots 1-4)
    const botsWaiting = gameState.waitingForPlayers.filter((slot) => slot > 0);
    if (botsWaiting.length === 0) return;

    // Auto-reveal for bots after a short delay
    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (!prev || prev.phase !== "revealing") return prev;

        let newState = prev;

        // Reveal for each waiting bot
        for (const slot of botsWaiting) {
          if (!newState.waitingForPlayers.includes(slot)) continue;
          const player = newState.players[slot];
          if (!player) continue;

          const unrevealedCard = player.holeCards[0];
          if (!unrevealedCard) continue;

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

        return newState;
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [gameState]);

  // Play sound when cards are revealed
  useEffect(() => {
    if (!gameState) return;

    const currentRevealCount = gameState.revealHistory.reduce(
      (acc, event) => acc + event.cards.length,
      0
    );

    if (currentRevealCount > prevRevealCount.current) {
      playCardFlipSound();
    }
    prevRevealCount.current = currentRevealCount;
  }, [gameState?.revealHistory]);

  // Play sound when winner is determined
  useEffect(() => {
    if (!gameState) return;

    if (prevPhase.current !== "finished" && gameState.phase === "finished") {
      playWinnerSound();
    }
    prevPhase.current = gameState.phase;
  }, [gameState?.phase]);

  const waitingPlayerIds = gameState?.waitingForPlayers
    ? new Set(gameState.waitingForPlayers)
    : new Set<number>();

  const winnerIds = gameState?.winner
    ? new Set(gameState.winner.map((p) => p.id))
    : new Set<number>();

  const isMyTurn = gameState?.phase === "revealing" && waitingPlayerIds.has(0);

  return (
    <div className="min-h-dvh bg-slate-900 text-white p-4">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-balance">プラクティスモード</h1>
            {gameState && (
              <p className="text-slate-400 text-sm">
                あなた: {gameState.players[0]?.name}
                <span className="ml-2 text-amber-400">
                  [{DIFFICULTY_CONFIGS[difficulty].name}]
                </span>
              </p>
            )}
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            戻る
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {!gameState ? (
          <div className="flex flex-col items-center justify-center py-12 max-w-md mx-auto">
            <p className="text-slate-400 mb-6 text-center text-pretty">
              4人のCPUと対戦します。名前を入力してゲームを開始してください。
            </p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="あなたの名前"
              maxLength={20}
              className="w-full px-4 py-3 mb-6 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            {/* Difficulty Selection */}
            <div className="w-full mb-6">
              <p className="text-sm text-slate-400 mb-3 text-center">難易度を選択</p>
              <div className="grid grid-cols-2 gap-2">
                {DIFFICULTIES.map((diff) => {
                  const config = DIFFICULTY_CONFIGS[diff];
                  const isSelected = difficulty === diff;
                  return (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={cn(
                        "px-4 py-3 rounded-lg text-sm font-medium transition-colors border-2",
                        isSelected
                          ? "bg-emerald-600 border-emerald-400 text-white"
                          : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                      )}
                    >
                      <div className="font-bold">{config.name}</div>
                      <div className="text-xs opacity-75">{config.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => startNewGame()}
              disabled={!playerName.trim()}
              className={cn(
                "w-full px-6 py-3 rounded-lg font-medium transition-colors",
                playerName.trim()
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              ゲームを開始
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium",
                    gameState.phase === "revealing" && "bg-blue-600",
                    gameState.phase === "showdown" && "bg-amber-600",
                    gameState.phase === "finished" && "bg-emerald-600"
                  )}
                >
                  {gameState.phase === "revealing" &&
                    `公開フェーズ (ラウンド ${gameState.currentRound + 1})`}
                  {gameState.phase === "showdown" && "ショーダウン"}
                  {gameState.phase === "finished" && "ゲーム終了"}
                </span>

                {isMyTurn && (
                  <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600">
                    あなたの番です
                  </span>
                )}
              </div>

              {isMyTurn && (
                <span className="text-sm text-slate-400">
                  下のカードをクリックして公開
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameState.players.map((player, idx) => {
                const isWaiting = waitingPlayerIds.has(player.id);
                const canSelect = idx === 0 && isMyTurn;
                return (
                  <div
                    key={player.id}
                    className={cn(idx === 0 && "ring-2 ring-blue-500 rounded-xl")}
                  >
                    <PlayerArea
                      player={player}
                      isWeakest={isWaiting}
                      isWinner={winnerIds.has(player.id)}
                      showFinalHand={gameState.phase === "finished"}
                      canSelectCard={canSelect}
                      onSelectCard={handleSelectCard}
                    />
                  </div>
                );
              })}
            </div>

            {gameState.phase === "finished" && gameState.winner && (
              <div className="mt-8 p-6 bg-amber-950/50 border-2 border-amber-400 rounded-xl text-center">
                <h2 className="text-xl font-bold text-amber-400 text-balance">
                  {gameState.winner.length === 1
                    ? `${gameState.winner[0].name} の勝利!`
                    : `引き分け: ${gameState.winner.map((p) => p.name).join(", ")}`}
                </h2>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      prevRevealCount.current = 0;
                      prevPhase.current = null;
                      startNewGame(difficulty);
                    }}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors"
                  >
                    もう一度プレイ
                  </button>
                  <button
                    onClick={() => {
                      setGameState(null);
                      prevRevealCount.current = 0;
                      prevPhase.current = null;
                    }}
                    className="px-6 py-3 bg-slate-600 hover:bg-slate-500 rounded-xl font-medium transition-colors"
                  >
                    難易度を変更
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
