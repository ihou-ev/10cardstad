"use client";

import { GameState, findWeakestPlayers } from "@/lib/game";
import { PlayerArea } from "./PlayerArea";
import { cn } from "@/lib/utils";

interface OnlineGameBoardProps {
  gameState: GameState;
  isHost: boolean;
  mySlot: number;
  onNextRound: () => void;
  onLeave: () => void;
}

export function OnlineGameBoard({
  gameState,
  isHost,
  mySlot,
  onNextRound,
  onLeave,
}: OnlineGameBoardProps) {
  const weakestPlayerIds =
    gameState.phase === "revealing"
      ? new Set(findWeakestPlayers(gameState.players).map((p) => p.id))
      : new Set<number>();

  const winnerIds = gameState.winner
    ? new Set(gameState.winner.map((p) => p.id))
    : new Set<number>();

  const isMyTurn = weakestPlayerIds.has(mySlot);

  return (
    <div className="min-h-dvh bg-slate-900 text-white p-4">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-balance">10カードスタッド</h1>
            <p className="text-slate-400 text-sm">
              あなた: {gameState.players[mySlot]?.name}
            </p>
          </div>
          <button
            onClick={onLeave}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
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

            {isMyTurn && gameState.phase === "revealing" && (
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600">
                あなたの番です
              </span>
            )}
          </div>

          {isHost && gameState.phase !== "finished" && (
            <button
              onClick={onNextRound}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              次へ進む
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gameState.players.map((player, idx) => (
            <div
              key={player.id}
              className={cn(idx === mySlot && "ring-2 ring-blue-500 rounded-xl")}
            >
              <PlayerArea
                player={player}
                isWeakest={weakestPlayerIds.has(player.id)}
                isWinner={winnerIds.has(player.id)}
                showFinalHand={gameState.phase === "finished"}
              />
            </div>
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
                  <span className="text-slate-300 tabular-nums">
                    R{event.round + 1}:
                  </span>{" "}
                  {event.cards
                    .map((c) => {
                      const player = gameState.players.find(
                        (p) => p.id === c.playerId
                      );
                      return `${player?.name}`;
                    })
                    .join(", ")}{" "}
                  がカードを公開
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
