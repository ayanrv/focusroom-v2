ALTER TABLE "FocusSession"
ADD COLUMN "initialPlannedSeconds" INTEGER,
ADD COLUMN "completed" BOOLEAN,
ADD COLUMN "clientSessionId" TEXT;

CREATE UNIQUE INDEX "FocusSession_clientSessionId_key"
ON "FocusSession"("clientSessionId");
