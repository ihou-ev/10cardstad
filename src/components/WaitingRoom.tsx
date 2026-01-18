"use client";

import { RoomPlayer } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface WaitingRoomProps {
  players: RoomPlayer[];
  hostPlayerId: string;
  myPlayerId: string;
  isHost: boolean;
  onStartGame: () => void;
  onLeave: () => void;
}

export function WaitingRoom({ players, hostPlayerId, myPlayerId, isHost, onStartGame, onLeave }: WaitingRoomProps) {
  const canStart = players.length >= 2 && players.length <= 5;

  return (
    <div className="min-h-dvh bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-balance">待機ルーム</h1>

        <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-slate-400 mb-3">
            プレイヤー ({players.length}/5) - 2人から開始可能
          </h2>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((slot) => {
              const player = players.find((p) => p.slot === slot);
              return (
                <div
                  key={slot}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg",
                    player ? "bg-slate-700" : "bg-slate-800/50 border border-dashed border-slate-700"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center text-sm font-bold tabular-nums",
                      player ? "bg-emerald-600" : "bg-slate-700 text-slate-500"
                    )}
                  >
                    {slot + 1}
                  </div>
                  {player ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.player_name}</span>
                      {player.player_id === hostPlayerId && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-600 text-amber-100 rounded">
                          ホスト
                        </span>
                      )}
                      {player.player_id === myPlayerId && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-blue-100 rounded">
                          あなた
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">待機中...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={cn(
              "w-full py-4 rounded-xl font-medium text-lg transition-colors",
              canStart
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
          >
            {canStart ? "ゲームを開始" : "あと1人必要"}
          </button>
        ) : (
          <div className="text-center py-4 text-slate-400">
            ホストがゲームを開始するのを待っています...
          </div>
        )}

        <button
          onClick={onLeave}
          className="w-full mt-3 py-3 text-slate-400 hover:text-white transition-colors"
        >
          ルームを退出
        </button>
      </div>
    </div>
  );
}
