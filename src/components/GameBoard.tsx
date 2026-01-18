"use client";

import { useState, useCallback } from "react";
import {
  GameState,
  initializeGame,
  processRevealRound,
  determineWinner,
  findWeakestPlayers,
} from "@/lib/game";
import { PlayerArea } from "./PlayerArea";
import { cn } from "@/lib/utils";

const DEFAULT_PLAYERS = [
  "プレイヤー 1",
  "プレイヤー 2",
  "プレイヤー 3",
  "プレイヤー 4",
  "プレイヤー 5",
];

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  const startNewGame = useCallback(() => {
    const state = initializeGame(DEFAULT_PLAYERS);
    setGameState(state);
    setAutoPlay(false);
  }, []);

  const nextRound = useCallback(() => {
    if (!gameState) return;

    if (gameState.phase === "revealing") {
      setGameState(processRevealRound(gameState));
    } else if (gameState.phase === "showdown") {
      setGameState(determineWinner(gameState));
    }
  }, [gameState]);

  const runAutoPlay = useCallback(() => {
    if (!gameState || gameState.phase === "finished") return;

    setAutoPlay(true);

    const runStep = () => {
      setGameState((prev) => {
        if (!prev || prev.phase === "finished") {
          setAutoPlay(false);
          return prev;
        }

        if (prev.phase === "revealing") {
          const next = processRevealRound(prev);
          if (next.phase !== "finished") {
            setTimeout(runStep, 800);
          } else {
            setAutoPlay(false);
          }
          return next;
        } else if (prev.phase === "showdown") {
          setAutoPlay(false);
          return determineWinner(prev);
        }

        return prev;
      });
    };

    runStep();
  }, [gameState]);

  const weakestPlayerIds = gameState?.phase === "revealing"
    ? new Set(findWeakestPlayers(gameState.players).map((p) => p.id))
    : new Set<number>();

  const winnerIds = gameState?.winner
    ? new Set(gameState.winner.map((p) => p.id))
    : new Set<number>();

  return (
    <div className="min-h-dvh bg-slate-900 text-white p-4">
      <header className="max-w-6xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-balance">10カードスタッド</h1>
        <p className="text-slate-400 text-pretty">
          5人のプレイヤーが10枚のカードから最強の5枚を選んで勝負
        </p>
      </header>

      <main className="max-w-6xl mx-auto">
        {!gameState ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-slate-400 mb-6 text-pretty">
              ゲームを開始して、最弱プレイヤーから順にカードを公開していきます
            </p>
            <button
              onClick={startNewGame}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
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
                  {gameState.phase === "revealing" && `公開フェーズ (ラウンド ${gameState.currentRound + 1})`}
                  {gameState.phase === "showdown" && "ショーダウン"}
                  {gameState.phase === "finished" && "ゲーム終了"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {gameState.phase !== "finished" && (
                  <>
                    <button
                      onClick={nextRound}
                      disabled={autoPlay}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      次へ
                    </button>
                    <button
                      onClick={runAutoPlay}
                      disabled={autoPlay}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      {autoPlay ? "実行中..." : "自動進行"}
                    </button>
                  </>
                )}
                <button
                  onClick={startNewGame}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                >
                  新しいゲーム
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameState.players.map((player) => (
                <PlayerArea
                  key={player.id}
                  player={player}
                  isWeakest={weakestPlayerIds.has(player.id)}
                  isWinner={winnerIds.has(player.id)}
                  showFinalHand={gameState.phase === "finished"}
                />
              ))}
            </div>

            {gameState.phase === "finished" && gameState.winner && (
              <div className="mt-8 p-6 bg-amber-950/50 border-2 border-amber-400 rounded-xl text-center">
                <h2 className="text-xl font-bold text-amber-400 text-balance">
                  {gameState.winner.length === 1
                    ? `${gameState.winner[0].name} の勝利!`
                    : `引き分け: ${gameState.winner.map((p) => p.name).join(", ")}`}
                </h2>
              </div>
            )}

            {gameState.revealHistory.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3 text-balance">公開履歴</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gameState.revealHistory.map((event, idx) => (
                    <div
                      key={idx}
                      className="text-sm text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-slate-300 tabular-nums">R{event.round + 1}:</span>{" "}
                      {event.cards.map((c) => {
                        const player = gameState.players.find((p) => p.id === c.playerId);
                        return `${player?.name}`;
                      }).join(", ")}{" "}
                      がカードを公開
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
