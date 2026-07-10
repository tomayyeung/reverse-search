CREATE SCHEMA "public";
CREATE TABLE "puzzle_completion_events" (
	"id" bigserial PRIMARY KEY,
	"puzzle_id" uuid NOT NULL,
	"completion_time_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "puzzle_stats" (
	"puzzle_id" uuid PRIMARY KEY,
	"plays" bigint DEFAULT 0 NOT NULL,
	"completions" bigint DEFAULT 0 NOT NULL,
	"likes" bigint DEFAULT 0 NOT NULL
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
	"completion_times" integer[] DEFAULT '{}' NOT NULL
);
CREATE UNIQUE INDEX "puzzle_completion_events_pkey" ON "puzzle_completion_events" ("id");
CREATE INDEX "puzzle_completion_events_puzzle_id_idx" ON "puzzle_completion_events" ("puzzle_id");
CREATE UNIQUE INDEX "puzzle_stats_pkey" ON "puzzle_stats" ("puzzle_id");
CREATE UNIQUE INDEX "puzzles_pkey" ON "puzzles" ("id");
ALTER TABLE "puzzle_completion_events" ADD CONSTRAINT "puzzle_completion_events_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE;
ALTER TABLE "puzzle_stats" ADD CONSTRAINT "puzzle_stats_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE;