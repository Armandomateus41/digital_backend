import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Assinatura pública idempotente', () => {
  let app: INestApplication;
  let token: string;
  let documentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200);
    token = String(login.body?.accessToken ?? '');

    const upload = await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1234567890'), { filename: 'a.pdf', contentType: 'application/pdf' })
      .field('title', 'Idemp Doc')
      .expect(201);
    documentId = upload.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /user/sign com mesma Idempotency-Key retorna 200 com mesmo hash', async () => {
    const key = 'e2e-key-1';
    const r1 = await request(app.getHttpServer())
      .post('/user/sign')
      .set('Idempotency-Key', key)
      .send({ documentId, cpf: '123.456.789-09' })
      .expect(200);
    const r2 = await request(app.getHttpServer())
      .post('/user/sign')
      .set('Idempotency-Key', key)
      .send({ documentId, cpf: '123.456.789-09' })
      .expect(200);
    expect(r1.body.hash).toBeDefined();
    expect(r1.body.hash).toBe(r2.body.hash);
  });
});


