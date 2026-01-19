"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminStats, getAdminStats, cleanupOrphanedRooms } from "@/lib/online-game";
import { cn } from "@/lib/utils";

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function formatStatus(status: string): { text: string; color: string } {
  switch (status) {
    case "waiting":
      return { text: "待機中", color: "bg-blue-600" };
    case "playing":
      return { text: "プレイ中", color: "bg-amber-600" };
    case "finished":
      return { text: "終了", color: "bg-slate-600" };
    default:
      return { text: status, color: "bg-slate-600" };
  }
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    const data = await getAdminStats();
    setStats(data);
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="min-h-dvh bg-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
              <p className="text-slate-400 text-sm">
                10カードスタッドAOF 利用状況
              </p>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-xs text-slate-500">
                  最終更新: {lastUpdated.toLocaleTimeString("ja-JP")}
                </span>
              )}
              <button
                onClick={fetchStats}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? "更新中..." : "更新"}
              </button>
            </div>
          </div>
        </header>

        {stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-emerald-400 tabular-nums">
                  {stats.totalGamesPlayed}
                </div>
                <div className="text-sm text-slate-400">総ゲーム数</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-400 tabular-nums">
                  {stats.totalGamesToday}
                </div>
                <div className="text-sm text-slate-400">今日のゲーム</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-amber-400 tabular-nums">
                  {stats.activeRooms}
                </div>
                <div className="text-sm text-slate-400">アクティブルーム</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-400 tabular-nums">
                  {stats.activePlayers}
                </div>
                <div className="text-sm text-slate-400">オンラインプレイヤー</div>
              </div>
            </div>

            {/* Recent Games */}
            <div>
              <h2 className="text-lg font-semibold mb-4">最近のゲーム</h2>
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                {stats.recentGames.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    ゲーム履歴がありません
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-300">
                            ステータス
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-slate-300">
                            プレイヤー
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-slate-300">
                            勝者
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-slate-300">
                            ラウンド
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-slate-300">
                            開始日時
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {stats.recentGames.map((game) => {
                          const statusInfo = formatStatus(game.status);
                          return (
                            <tr key={game.id} className="hover:bg-slate-700/50">
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded text-xs font-medium",
                                    statusInfo.color
                                  )}
                                >
                                  {statusInfo.text}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {game.players.join(", ") || "-"}
                              </td>
                              <td className="px-4 py-3">
                                {game.winner ? (
                                  <span className="text-amber-400">
                                    {game.winner}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-slate-400">
                                {game.rounds || "-"}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-slate-400">
                                {formatDateTime(game.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {isLoading && !stats && (
          <div className="text-center py-20 text-slate-500">読み込み中...</div>
        )}
      </div>
    </div>
  );
}
