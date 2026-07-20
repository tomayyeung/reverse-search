CREATE SCHEMA "public";

CREATE TABLE "users" (
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
);

CREATE TABLE "puzzles" (
	"letters" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"words" text[] NOT NULL,
	"name" text DEFAULT 'Unnamed puzzle' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"plays" integer DEFAULT 0,
	"completions" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"description" text,
	"completion_times" integer[] DEFAULT '{}' NOT NULL,
	"created_by_user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL
);

CREATE TABLE "puzzle_stats" (
	"puzzle_id" uuid PRIMARY KEY,
	"plays" bigint DEFAULT 0 NOT NULL,
	"completions" bigint DEFAULT 0 NOT NULL,
	"likes" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "puzzle_completion_events" (
	"id" bigserial PRIMARY KEY,
	"puzzle_id" uuid NOT NULL,
	"user_id" uuid,
	"completion_time_seconds" integer NOT NULL,
	"used_hint" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "puzzles_created_by_user_id_idx" ON "puzzles" ("created_by_user_id");
CREATE INDEX "puzzle_completion_events_puzzle_id_idx" ON "puzzle_completion_events" ("puzzle_id");
CREATE INDEX "puzzle_completion_events_user_id_idx" ON "puzzle_completion_events" ("user_id");

ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");
ALTER TABLE "puzzle_stats" ADD CONSTRAINT "puzzle_stats_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE;
ALTER TABLE "puzzle_completion_events" ADD CONSTRAINT "puzzle_completion_events_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE;
ALTER TABLE "puzzle_completion_events" ADD CONSTRAINT "puzzle_completion_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
