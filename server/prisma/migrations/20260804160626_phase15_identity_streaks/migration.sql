-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT 'Player',
    "email" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakFreezes" INTEGER NOT NULL DEFAULT 0,
    "restoreUsedSeason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'normal',
    "score" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "clientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastDate" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_memberKey_key" ON "UserProfile"("memberKey");

-- CreateIndex
CREATE INDEX "UserProfile_lastSeenAt_idx" ON "UserProfile"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRun_clientKey_key" ON "DailyRun"("clientKey");

-- CreateIndex
CREATE INDEX "DailyRun_gameId_dateKey_idx" ON "DailyRun"("gameId", "dateKey");

-- CreateIndex
CREATE INDEX "DailyRun_userId_dateKey_idx" ON "DailyRun"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRun_userId_gameId_dateKey_key" ON "DailyRun"("userId", "gameId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStreak_userId_scope_key" ON "DailyStreak"("userId", "scope");

-- AddForeignKey
ALTER TABLE "DailyRun" ADD CONSTRAINT "DailyRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStreak" ADD CONSTRAINT "DailyStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
