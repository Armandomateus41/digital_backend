import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

type MockedPrisma = {
  document: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  signature?: unknown;
};

type MockedS3 = {
  readiness: jest.Mock<Promise<boolean>>;
  putObject: jest.Mock<Promise<void>>;
  deleteObject: jest.Mock<Promise<void>>;
  createPresignedDownloadUrl: jest.Mock<Promise<string>>;
};

function makePdf(bytes = 128, salt = Date.now().toString()) {
  const header = Buffer.from('%PDF-');
  const body = Buffer.alloc(Math.max(bytes - header.length, 0), 0x20);
  Buffer.from(salt).copy(body, 0);
  return Buffer.concat([header, body]);
}

describe('DocumentsService (unit)', () => {
  let prisma: MockedPrisma;
  let s3: MockedS3;

  beforeEach(() => {
    prisma = {
      document: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    s3 = {
      readiness: jest.fn().mockResolvedValue(true),
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      createPresignedDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://presigned.example'),
    } as unknown as MockedS3;
  });

  it('upload happy path salva doc e envia ao S3', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    prisma.document.create.mockResolvedValue({
      id: 'd1',
      title: 't',
      storageKey: 'k',
      contentSha256: 'x',
    });
    const svc = new DocumentsService(prisma as any, s3 as any);
    const file = {
      buffer: makePdf(),
      mimetype: 'application/pdf',
      size: 256,
    } as unknown as Express.Multer.File;
    const doc = await svc.upload({ title: 't', file, createdById: 'u1' });
    expect(s3.readiness).toHaveBeenCalled();
    expect(s3.putObject).toHaveBeenCalled();
    expect(prisma.document.create).toHaveBeenCalled();
    expect(doc.id).toBe('d1');
  });

  it('upload falha quando não é PDF (assinatura inválida)', async () => {
    const svc = new DocumentsService(prisma as any, s3 as any);
    const notPdf = {
      buffer: Buffer.from('not-a-pdf'),
      mimetype: 'application/octet-stream',
      size: 11,
    } as unknown as Express.Multer.File;
    await expect(
      svc.upload({ title: 'bad', file: notPdf, createdById: 'u1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('upload falha com DUPLICATE_CONTENT quando hash já existe', async () => {
    prisma.document.findUnique.mockResolvedValue({ id: 'existing' });
    const svc = new DocumentsService(prisma as any, s3 as any);
    const file = {
      buffer: makePdf(),
      mimetype: 'application/pdf',
      size: 10,
    } as unknown as Express.Multer.File;
    await expect(
      svc.upload({ title: 'dup', file, createdById: 'u1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('upload com STRICT_STORAGE=true e S3 down -> 503 STORAGE_UNAVAILABLE', async () => {
    s3.readiness.mockResolvedValue(false);
    const old = process.env.STRICT_STORAGE;
    process.env.STRICT_STORAGE = 'true';
    const svc = new DocumentsService(prisma as any, s3);
    const file = {
      buffer: makePdf(),
      mimetype: 'application/pdf',
      size: 10,
    } as unknown as Express.Multer.File;
    await expect(
      svc.upload({ title: 'strict', file, createdById: 'u1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    process.env.STRICT_STORAGE = old;
  });

  it('getCertificatePresignedUrl retorna URL quando storageKey existe', async () => {
    prisma.document.findUnique.mockResolvedValue({ id: 'd1', storageKey: 'k' });
    const svc = new DocumentsService(prisma as any, s3);
    const url = await svc.getCertificatePresignedUrl('d1');
    expect(url).toBe('https://presigned.example');
  });
});
