import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

const HAS_DB = Boolean(process.env.DATABASE_URL);

jest.setTimeout(30000);

type LoginBody = { accessToken?: unknown };
type UploadBody = { id?: unknown };

const d = HAS_DB ? describe : describe.skip;

d('DocumentsController - cache 304', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let token: string;
  let docId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const login = (await request(server)
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200)) as unknown as { body?: LoginBody };
    token =
      typeof login.body?.accessToken === 'string' ? login.body.accessToken : '';
    const uniquePdf = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.from(String(Date.now() + Math.random())),
    ]);
    const up = (await request(server)
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', uniquePdf, {
        filename: 'm.pdf',
        contentType: 'application/pdf',
      })
      .field('title', 'Cache Doc')
      .expect(201)) as unknown as { body?: UploadBody };
    docId = typeof up.body?.id === 'string' ? up.body.id : '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /documents/:id responde 304 quando If-None-Match coincide', async () => {
    const first = await request(server)
      .get(`/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const etag = String(first.headers['etag'] ?? '');
    await request(server)
      .get(`/documents/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', etag)
      .expect(304);
  });

  it('upload PDF inválido retorna 409 INVALID_PDF_SIGNATURE', async () => {
    const bad = Buffer.from('not-a-pdf');
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const res = await request(server)
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bad, {
        filename: 'x.bin',
        contentType: 'application/octet-stream',
      })
      .field('title', 'Bad')
      .expect(409);
    const body: unknown = res.body;
    const code =
      body &&
      typeof body === 'object' &&
      typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : '';
    expect(code).toBe('INVALID_PDF_SIGNATURE');
  });
});
