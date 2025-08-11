-- Add username (unique, nullable) and isAdmin to User
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

-- Unique index for username
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Backfill legacy single-user installs: set first user's username to 'eddie' and mark admin
UPDATE "User" SET "username"='eddie', "isAdmin"=TRUE
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "id" ASC LIMIT 1) AND "username" IS NULL;

-- Add columns username and isAdmin to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create unique index on username if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_username_key') THEN
    CREATE UNIQUE INDEX "User_username_key" ON "User" (lower("username"));
  END IF;
END $$;

