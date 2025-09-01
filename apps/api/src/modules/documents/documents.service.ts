import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../storage/s3.service';
import type { S3Port } from '../../storage/s3.port';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class DocumentsService {
  private readonly strictStorage: boolean;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(S3Service) private readonly s3: S3Port,
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

  async listSignatures(limit = 50, cursor?: { createdAt: Date; id: string }) {
    const signs = await this.prisma.signature.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor.id } : undefined,
      include: { document: true },
    });
    const items = signs.map((s) => ({
      documentId: s.documentId,
      name: s.document.title,
      date: s.signedAt ?? s.createdAt,
      cpf: s.cpf,
      hash: s.hash ?? s.document.contentSha256,
      id: s.id,
      createdAt: s.createdAt,
    }));
    const nextCursor =
      items.length > 0
        ? {
            id: items[items.length - 1].id,
            createdAt: items[items.length - 1].createdAt,
          }
        : null;
    return { items, nextCursor };
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

  async getCertificatePresignedUrl(documentId: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc)
      throw new ConflictException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado',
      });
    if (!doc.storageKey) {
      if (this.strictStorage) {
        throw new ServiceUnavailableException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Arquivo não disponível no armazenamento',
        });
      }
      throw new ConflictException({
        code: 'CERTIFICATE_UNAVAILABLE',
        message: 'Certificado indisponível para este documento',
      });
    }
    return this.s3.createPresignedDownloadUrl(doc.storageKey);
  }

  // Público: retorna um documento qualquer (o mais recente) para assinar
  async getNextForUser() {
    const doc = await this.prisma.document.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!doc) return null;
    // Em produção, aqui poderíamos filtrar por usuário/estado; para o teste, retornamos o último
    const downloadUrl = '';
    return { id: doc.id, title: doc.title, downloadUrl };
  }

  // Público: assina documento, gera hash doc+cpf e registra
  async signPublic(documentId: string, cpf: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc)
      throw new ConflictException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado',
      });
    const normalizedCpf = cpf.replace(/\D/g, '');
    const payload = `${doc.contentSha256}:${normalizedCpf}`;
    const hash = createHash('sha256').update(payload).digest('hex');
    const sig = await this.prisma.signature.upsert({
      where: { documentId_cpf: { documentId, cpf: normalizedCpf } },
      update: { status: 'SIGNED', signedAt: new Date(), hash },
      create: {
        documentId,
        name: doc.title,
        cpf: normalizedCpf,
        status: 'SIGNED',
        signedAt: new Date(),
        hash,
      },
    });
    return { hash: sig.hash };
  }
}
