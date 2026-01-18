"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface LobbyProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onPlayLocal: () => void;
  isLoading: boolean;
  error: string | null;
}

export function Lobby({ onCreateRoom, onJoinRoom, onPlayLocal, isLoading, error }: LobbyProps) {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  return (
    <div className="min-h-dvh bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-balance">10カードスタッド</h1>
        <p className="text-slate-400 text-center mb-8 text-pretty">
          5人のプレイヤーが10枚のカードから最強の5枚を選んで勝負
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        {mode === "menu" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-lg transition-colors"
            >
              ルームを作成
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium text-lg transition-colors"
            >
              ルームに参加
            </button>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-slate-900 text-slate-500 text-sm">または</span>
              </div>
            </div>
            <button
              onClick={onPlayLocal}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium text-lg transition-colors"
            >
              ローカルでプレイ
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                あなたの名前
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="名前を入力"
                maxLength={20}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
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
              {isLoading ? "作成中..." : "ルームを作成"}
            </button>
            <button
              onClick={() => setMode("menu")}
              className="w-full py-3 text-slate-400 hover:text-white transition-colors"
            >
              戻る
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                あなたの名前
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="名前を入力"
                maxLength={20}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ルームコード
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="6文字のコード"
                maxLength={6}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase tracking-widest text-center text-xl font-mono tabular-nums"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={!playerName.trim() || roomCode.length !== 6 || isLoading}
              className={cn(
                "w-full py-4 rounded-xl font-medium text-lg transition-colors",
                playerName.trim() && roomCode.length === 6 && !isLoading
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {isLoading ? "参加中..." : "ルームに参加"}
            </button>
            <button
              onClick={() => setMode("menu")}
              className="w-full py-3 text-slate-400 hover:text-white transition-colors"
            >
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
