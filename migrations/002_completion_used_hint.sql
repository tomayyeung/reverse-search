ALTER TABLE "puzzle_completion_events"
	ADD COLUMN IF NOT EXISTS "used_hint" boolean DEFAULT false NOT NULL;
