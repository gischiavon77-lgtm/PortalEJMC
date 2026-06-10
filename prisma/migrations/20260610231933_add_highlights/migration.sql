-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "slot" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "photoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Highlight_slot_key" ON "Highlight"("slot");
