-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "intention" TEXT,
    "room" TEXT NOT NULL,
    "plannedSeconds" INTEGER NOT NULL,
    "elapsedSeconds" INTEGER NOT NULL,
    "ambienceA" INTEGER NOT NULL DEFAULT 70,
    "ambienceB" INTEGER NOT NULL DEFAULT 45,
    "ambienceC" INTEGER NOT NULL DEFAULT 55,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusSession_profileId_startedAt_idx" ON "FocusSession"("profileId", "startedAt");

-- AddForeignKey
ALTER TABLE "FocusSession"
ADD CONSTRAINT "FocusSession_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
