-- CreateTable
CREATE TABLE "BreathDaily" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "scored" BOOLEAN NOT NULL DEFAULT FALSE,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BreathDaily_userId_date_key" ON "BreathDaily"("userId", "date");

-- AddForeignKey
ALTER TABLE "BreathDaily"
ADD CONSTRAINT "BreathDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


