import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

const HAS_DB = Boolean(process.env.DATABASE_URL);

jest.setTimeout(30000);

type LoginBody = { accessToken?: unknown };
type UploadBody = { id?: unknown };

const d = HAS_DB ? describe : describe.skip;

d('Presigned URL com STRICT_STORAGE=true', () => {
  let app: INestApplication;
  let token: string;
  let docId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const login = (await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200)) as unknown as { body?: LoginBody };
    token =
      typeof login.body?.accessToken === 'string' ? login.body.accessToken : '';

    const uniquePdf = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.from(String(Date.now() + Math.random())),
    ]);
    const up = (await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', uniquePdf, {
        filename: 'p.pdf',
        contentType: 'application/pdf',
      })
      .field('title', 'Presign Doc')
      .expect(201)) as unknown as { body?: UploadBody };
    docId = typeof up.body?.id === 'string' ? up.body.id : '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('STRICT_STORAGE=true e storageKey vazio => 409/503 código coerente', async () => {
    process.env.STRICT_STORAGE = 'true';
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const res = await request(server)
      .get(`/documents/${docId}/certificate-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect((r) => [409, 503].includes(r.status));
    const body: unknown = res.body;
    const code =
      body &&
      typeof body === 'object' &&
      typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : '';
    expect(['STORAGE_UNAVAILABLE', 'CERTIFICATE_UNAVAILABLE']).toContain(code);
  });
});
