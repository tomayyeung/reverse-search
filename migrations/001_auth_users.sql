CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"clerk_user_id" text UNIQUE,
	"username" text UNIQUE NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"email" text,
	"role" text DEFAULT 'user' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "users" (
	"id",
	"clerk_user_id",
	"username",
	"display_name",
	"role"
) VALUES (
	'00000000-0000-0000-0000-000000000001',
	NULL,
	'admin',
	'Official',
	'admin'
) ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "puzzles"
	ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;

UPDATE "puzzles"
	SET "created_by_user_id" = '00000000-0000-0000-0000-000000000001'
	WHERE "created_by_user_id" IS NULL;

ALTER TABLE "puzzles"
	ALTER COLUMN "created_by_user_id" SET DEFAULT '00000000-0000-0000-0000-000000000001',
	ALTER COLUMN "created_by_user_id" SET NOT NULL;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'puzzles_created_by_user_id_fkey'
	) THEN
		ALTER TABLE "puzzles"
			ADD CONSTRAINT "puzzles_created_by_user_id_fkey"
			FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "puzzles_created_by_user_id_idx"
	ON "puzzles" ("created_by_user_id");

ALTER TABLE "puzzle_completion_events"
	ADD COLUMN IF NOT EXISTS "user_id" uuid;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'puzzle_completion_events_user_id_fkey'
	) THEN
		ALTER TABLE "puzzle_completion_events"
			ADD CONSTRAINT "puzzle_completion_events_user_id_fkey"
			FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "puzzle_completion_events_user_id_idx"
	ON "puzzle_completion_events" ("user_id");
