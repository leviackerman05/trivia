-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "clientKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_playerName_key" ON "RoomPlayer"("roomId", "playerName");

-- CreateIndex
CREATE UNIQUE INDEX "Score_clientKey_key" ON "Score"("clientKey");
