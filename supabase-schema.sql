-- Game Rooms table
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_id VARCHAR(36) NOT NULL,
  game_state JSONB,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room Players table
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id VARCHAR(36) NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0 AND slot <= 4),
  is_online BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, slot),
  UNIQUE(room_id, player_id)
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;

-- RLS Policies
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rooms
CREATE POLICY "Anyone can read rooms" ON game_rooms
  FOR SELECT USING (true);

-- Allow anyone to create rooms
CREATE POLICY "Anyone can create rooms" ON game_rooms
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update rooms (for game state)
CREATE POLICY "Anyone can update rooms" ON game_rooms
  FOR UPDATE USING (true);

-- Allow anyone to read players
CREATE POLICY "Anyone can read players" ON room_players
  FOR SELECT USING (true);

-- Allow anyone to join rooms
CREATE POLICY "Anyone can join rooms" ON room_players
  FOR INSERT WITH CHECK (true);

-- Allow anyone to leave rooms
CREATE POLICY "Anyone can leave rooms" ON room_players
  FOR DELETE USING (true);

-- Allow anyone to update players (for is_online status)
CREATE POLICY "Anyone can update players" ON room_players
  FOR UPDATE USING (true);

-- Index for room code lookups
CREATE INDEX idx_room_code ON game_rooms(room_code);

-- Index for room players
CREATE INDEX idx_room_players ON room_players(room_id);

-- Clean up old rooms (optional: run periodically)
-- DELETE FROM game_rooms WHERE created_at < NOW() - INTERVAL '24 hours';
