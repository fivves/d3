-- Create checklist daily table per user/day
CREATE TABLE "ChecklistDaily" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "checked" JSONB NOT NULL DEFAULT '[]',
  "scored" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique per user/date
CREATE UNIQUE INDEX "ChecklistDaily_userId_date_key" ON "ChecklistDaily"("userId", "date");

-- FK
ALTER TABLE "ChecklistDaily" ADD CONSTRAINT "ChecklistDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


