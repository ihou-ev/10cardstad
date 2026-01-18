import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase環境変数が設定されていません。.env.localファイルを確認してください。"
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

export type GameRoom = {
  id: string;
  room_code: string;
  host_id: string;
  game_state: string | null; // JSON serialized GameState
  status: "waiting" | "playing" | "finished";
  created_at: string;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  slot: number; // 0-4
  is_online: boolean;
  joined_at: string;
};
