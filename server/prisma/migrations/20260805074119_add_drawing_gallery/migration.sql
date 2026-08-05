-- CreateTable
CREATE TABLE "DrawingSubmission" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "promptIndex" INTEGER NOT NULL,
    "memberKey" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingVote" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingFlag" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawingSubmission_dateKey_status_votes_idx" ON "DrawingSubmission"("dateKey", "status", "votes");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingSubmission_dateKey_memberKey_key" ON "DrawingSubmission"("dateKey", "memberKey");

-- CreateIndex
CREATE INDEX "DrawingVote_memberKey_idx" ON "DrawingVote"("memberKey");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingVote_submissionId_memberKey_key" ON "DrawingVote"("submissionId", "memberKey");

-- CreateIndex
CREATE INDEX "DrawingFlag_submissionId_idx" ON "DrawingFlag"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingFlag_submissionId_memberKey_key" ON "DrawingFlag"("submissionId", "memberKey");

-- AddForeignKey
ALTER TABLE "DrawingVote" ADD CONSTRAINT "DrawingVote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DrawingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingFlag" ADD CONSTRAINT "DrawingFlag_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DrawingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
