-- Add columns username and isAdmin to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create unique index on username if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_username_key') THEN
    CREATE UNIQUE INDEX "User_username_key" ON "User" (lower("username"));
  END IF;
END $$;

