-- Add new fields to schedule_time_slots table
ALTER TABLE schedule_time_slots 
ADD COLUMN tone VARCHAR(50),
ADD COLUMN dimensions VARCHAR(20),
ADD COLUMN preferredVoiceAccent VARCHAR(50),
ADD COLUMN reelDuration INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN schedule_time_slots.tone IS 'Content tone: professional, casual, friendly, authoritative, playful, serious';
COMMENT ON COLUMN schedule_time_slots.dimensions IS 'Content dimensions: 1:1, 9:16, 4:5, 16:9';
COMMENT ON COLUMN schedule_time_slots.preferredVoiceAccent IS 'Preferred voice accent: american, british, australian, neutral, canadian';
COMMENT ON COLUMN schedule_time_slots.reelDuration IS 'Reel duration in seconds: 8, 16, 24, 32';
