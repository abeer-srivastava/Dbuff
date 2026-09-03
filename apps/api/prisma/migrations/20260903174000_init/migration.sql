CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Difficulty" AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE "ProblemStatus" AS ENUM ('Todo', 'Attempted', 'Solved', 'Solved-Optimal', 'Needs Revisit');
CREATE TYPE "RoleLevel" AS ENUM ('intern', 'fresher', 'sde1');
CREATE TYPE "SourcePlatform" AS ENUM ('reddit', 'gfg', 'lc_discuss');

CREATE TABLE "Pattern" (
  "id" SERIAL NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Problem" (
  "id" SERIAL NOT NULL, "title" TEXT NOT NULL, "lc_number" INTEGER, "lc_url" TEXT,
  "difficulty" "Difficulty", "topic" TEXT, "source_sheet" TEXT, "primary_pattern_id" INTEGER NOT NULL,
  "status" "ProblemStatus" NOT NULL DEFAULT 'Todo', "confidence" INTEGER,
  "times_revisited" INTEGER NOT NULL DEFAULT 0, "date_first_attempted" DATE, "date_solved" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProblemPattern" (
  "problem_id" INTEGER NOT NULL, "pattern_id" INTEGER NOT NULL,
  CONSTRAINT "ProblemPattern_pkey" PRIMARY KEY ("problem_id", "pattern_id")
);
CREATE TABLE "Solution" (
  "id" SERIAL NOT NULL, "problem_id" INTEGER NOT NULL, "language" TEXT NOT NULL, "code" TEXT NOT NULL,
  "time_complexity" TEXT, "space_complexity" TEXT, "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RevisionLog" (
  "id" SERIAL NOT NULL, "problem_id" INTEGER NOT NULL, "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confidence_at_review" INTEGER, "next_review_due" DATE,
  CONSTRAINT "RevisionLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OAStory" (
  "id" SERIAL NOT NULL, "company" TEXT, "role_level" "RoleLevel", "source_link" TEXT,
  "source_platform" "SourcePlatform", "story_summary" TEXT NOT NULL, "underlying_pattern_id" INTEGER,
  "closest_lc_problem_id" INTEGER, "my_approach" TEXT,
  "date_added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAStory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IngestionStaging" (
  "id" SERIAL NOT NULL, "source_platform" "SourcePlatform" NOT NULL, "source_link" TEXT NOT NULL,
  "raw_title" TEXT, "raw_excerpt" VARCHAR(500), "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "IngestionStaging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pattern_name_key" ON "Pattern"("name");
CREATE UNIQUE INDEX "Problem_lc_number_key" ON "Problem"("lc_number");
CREATE INDEX "Problem_primary_pattern_id_idx" ON "Problem"("primary_pattern_id");
CREATE INDEX "Problem_status_idx" ON "Problem"("status");
CREATE UNIQUE INDEX "IngestionStaging_source_link_key" ON "IngestionStaging"("source_link");

ALTER TABLE "Problem" ADD CONSTRAINT "Problem_primary_pattern_id_fkey" FOREIGN KEY ("primary_pattern_id") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProblemPattern" ADD CONSTRAINT "ProblemPattern_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProblemPattern" ADD CONSTRAINT "ProblemPattern_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "Pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionLog" ADD CONSTRAINT "RevisionLog_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAStory" ADD CONSTRAINT "OAStory_underlying_pattern_id_fkey" FOREIGN KEY ("underlying_pattern_id") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OAStory" ADD CONSTRAINT "OAStory_closest_lc_problem_id_fkey" FOREIGN KEY ("closest_lc_problem_id") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
