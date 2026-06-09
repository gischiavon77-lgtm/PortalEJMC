-- CreateTable
CREATE TABLE "AlbumMember" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "area" "Area" NOT NULL,
    "gestao" VARCHAR(10) NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumMember_gestao_area_idx" ON "AlbumMember"("gestao", "area");

-- CreateIndex
CREATE INDEX "AlbumMember_gestao_idx" ON "AlbumMember"("gestao");
