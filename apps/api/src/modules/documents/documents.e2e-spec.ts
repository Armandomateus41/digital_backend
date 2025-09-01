import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

type LoginResponse = { body?: { accessToken?: unknown } };

type UploadResponse = { body?: { id?: unknown } };

type SignResponse = { body?: { hash?: unknown } };

describe('Assinatura pública idempotente', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let token: string;
  let documentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    const login = (await request(server)
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200)) as unknown as LoginResponse;
    token =
      typeof login.body?.accessToken === 'string' ? login.body.accessToken : '';

    const upload = (await request(server)
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1234567890'), {
        filename: 'a.pdf',
        contentType: 'application/pdf',
      })
      .field('title', 'Idemp Doc')
      .expect(201)) as unknown as UploadResponse;
    documentId = typeof upload.body?.id === 'string' ? upload.body.id : '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /user/sign com mesma Idempotency-Key retorna 200 com mesmo hash', async () => {
    const key = 'e2e-key-1';
    const r1 = (await request(server)
      .post('/user/sign')
      .set('Idempotency-Key', key)
      .send({ documentId, cpf: '123.456.789-09' })
      .expect(200)) as unknown as SignResponse;
    const r2 = (await request(server)
      .post('/user/sign')
      .set('Idempotency-Key', key)
      .send({ documentId, cpf: '123.456.789-09' })
      .expect(200)) as unknown as SignResponse;
    const h1 = typeof r1.body?.hash === 'string' ? r1.body.hash : '';
    const h2 = typeof r2.body?.hash === 'string' ? r2.body.hash : '';
    expect(h1).toBeDefined();
    expect(h1).toBe(h2);
  });
});
