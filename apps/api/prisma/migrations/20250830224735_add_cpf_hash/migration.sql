/*
  Warnings:

  - A unique constraint covering the columns `[documentId,cpf]` on the table `Signature` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cpf]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Signature" ADD COLUMN     "hash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Signature_documentId_cpf_key" ON "Signature"("documentId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");
