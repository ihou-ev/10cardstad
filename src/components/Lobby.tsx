"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { RoomWithPlayerCount, GameHistoryEntry, PlayingRoom, getWaitingRooms, getGameHistory, getPlayingRooms, subscribeToLobby } from "@/lib/online-game";

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

interface LobbyProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onPlayLocal: () => void;
  isLoading: boolean;
  error: string | null;
}

export function Lobby({ onCreateRoom, onJoinRoom, onPlayLocal, isLoading, error }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [rooms, setRooms] = useState<RoomWithPlayerCount[]>([]);
  const [playingRooms, setPlayingRooms] = useState<PlayingRoom[]>([]);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const fetchData = useCallback(async () => {
    const [waitingRooms, activeRooms, gameHistory] = await Promise.all([
      getWaitingRooms(),
      getPlayingRooms(),
      getGameHistory(10),
    ]);
    setRooms(waitingRooms);
    setPlayingRooms(activeRooms);
    setHistory(gameHistory);
    setIsLoadingRooms(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to lobby updates
    const unsubscribe = subscribeToLobby(() => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
    }
  };

  const handleJoinRoom = (roomId: string) => {
    if (playerName.trim()) {
      onJoinRoom(roomId, playerName.trim());
    }
  };

  return (
    <div className="min-h-dvh bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center mb-2 text-balance">10カードスタッドAOF</h1>
        <p className="text-slate-400 text-center mb-6 text-pretty">
          2〜5人のプレイヤーが10枚のカードから最強の5枚を選んで勝負
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            あなたの名前
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="名前を入力してください"
            maxLength={20}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Room List */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-300">待機中のルーム</h2>
            <button
              onClick={fetchData}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              更新
            </button>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {isLoadingRooms ? (
              <div className="p-8 text-center text-slate-500">
                読み込み中...
              </div>
            ) : rooms.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                待機中のルームがありません
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{room.host_name} のルーム</div>
                      <div className="text-sm text-slate-400">
                        <span className="tabular-nums">{room.player_count}</span>/5人
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={!playerName.trim() || isLoading || room.player_count >= 5}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        playerName.trim() && !isLoading && room.player_count < 5
                          ? "bg-blue-600 hover:bg-blue-500"
                          : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      )}
                    >
                      {room.player_count >= 5 ? "満員" : "参加"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Playing Rooms */}
        {playingRooms.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-slate-300 mb-3">プレイ中のルーム</h2>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="divide-y divide-slate-700">
                {playingRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <div className="font-medium text-slate-300">
                        {room.players.map((player, idx) => (
                          <span key={idx}>
                            {idx > 0 && ", "}
                            <span className={player.is_online ? "" : "text-slate-500 line-through"}>
                              {player.name}
                            </span>
                            {!player.is_online && <span className="text-red-400 text-xs ml-1">(退出)</span>}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm text-slate-500">
                        ラウンド <span className="tabular-nums">{room.current_round}</span> · {formatDateTime(room.started_at)}
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-600/20 text-amber-400 rounded-lg text-sm">
                      対戦中
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleCreateRoom}
            disabled={!playerName.trim() || isLoading}
            className={cn(
              "w-full py-4 rounded-xl font-medium text-lg transition-colors",
              playerName.trim() && !isLoading
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
          >
            {isLoading ? "作成中..." : "新しいルームを作成"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-slate-900 text-slate-500 text-sm">または</span>
            </div>
          </div>

          <button
            onClick={onPlayLocal}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
          >
            プラクティスモード
          </button>
        </div>

        {/* Game History */}
        {history.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-slate-300 mb-3">最近のゲーム</h2>
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="divide-y divide-slate-700">
                {history.map((game) => (
                  <div key={game.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-slate-300">
                        {game.players.join(", ")}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums">
                        {formatDateTime(game.started_at)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {game.winner ? (
                        <span className="text-amber-400">勝者: {game.winner}</span>
                      ) : (
                        <span>結果なし</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
