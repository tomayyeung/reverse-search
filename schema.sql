CREATE SCHEMA "public";
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
	"description" text
);
CREATE UNIQUE INDEX "puzzles_pkey" ON "puzzles" ("id");