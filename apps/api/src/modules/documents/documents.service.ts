import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../storage/s3.service';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  private readonly strictStorage: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {
    this.strictStorage =
      (process.env.STRICT_STORAGE ?? 'false').toLowerCase() === 'true';
  }

  private computeSha256(buffer: Buffer): string {
    const h = createHash('sha256');
    h.update(buffer);
    return h.digest('hex');
  }

  private isPdf(buffer: Buffer): boolean {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  async upload(params: {
    title: string;
    file: Express.Multer.File;
    createdById: string;
  }) {
    const { title, file, createdById } = params;
    const mimeType = file.mimetype || 'application/octet-stream';
    const size = file.size;

    if (!this.isPdf(file.buffer)) {
      throw new ConflictException({
        code: 'INVALID_PDF_SIGNATURE',
        message: 'Invalid PDF signature',
      });
    }

    const contentSha256 = this.computeSha256(file.buffer);

    const existing = await this.prisma.document.findUnique({
      where: { contentSha256 },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CONTENT',
        message: 'Duplicate document content',
      });
    }

    const storageKey = `documents/${contentSha256}-${randomUUID()}.pdf`;

    let s3Ok = false;
    try {
      if (await this.s3.readiness()) {
        await this.s3.putObject(storageKey, file.buffer, mimeType);
        s3Ok = true;
      } else if (this.strictStorage) {
        throw new ServiceUnavailableException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'S3 unavailable',
        });
      }

      const doc = await this.prisma.document.create({
        data: {
          title,
          mimeType,
          size,
          storageKey: s3Ok ? storageKey : '',
          contentSha256,
          createdById,
        },
      });

      return doc;
    } catch (err) {
      if (s3Ok) {
        try {
          await this.s3.deleteObject(storageKey);
        } catch {
          // ignore
        }
      }
      if (err instanceof ServiceUnavailableException) throw err;
      throw err;
    }
  }

  getMetadata(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  async listSignatures(limit = 50) {
    const docs = await this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return docs.map((d) => ({
      documentId: d.id,
      name: d.title,
      date: d.createdAt,
      cpf: '',
      hash: d.contentSha256,
    }));
  }

  async createSignature(params: {
    documentId: string;
    name: string;
    cpf: string;
  }) {
    const { documentId, name, cpf } = params;
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new ConflictException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado',
      });
    }
    // Evita assinaturas duplicadas por CPF no mesmo documento
    const existing = await this.prisma.signature.findFirst({
      where: { documentId, cpf },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SIGNER_ALREADY_ADDED',
        message: 'Assinante já adicionado',
      });
    }
    const sig = await this.prisma.signature.create({
      data: { documentId, name, cpf },
    });
    return sig;
  }

  listSignaturesByDocument(documentId: string) {
    return this.prisma.signature.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sign(signatureId: string) {
    const now = new Date();
    const updated = await this.prisma.signature.update({
      where: { id: signatureId },
      data: { status: 'SIGNED', signedAt: now },
    });
    return updated;
  }
}
