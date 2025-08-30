import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { LoggerModule } from 'nestjs-pino';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';
import { MulterExceptionFilter } from '../src/common/filters/multer-exception.filter';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { randomUUID } from 'crypto';

function makePdfBuffer(sizeBytes = 1024, salt?: string): Buffer {
  const header = Buffer.from('%PDF-');
  const bodySize = Math.max(sizeBytes - header.length, 0);
  const body = Buffer.alloc(bodySize, 0x20);
  if (salt) {
    const saltBuf = Buffer.from(salt);
    const start = Math.max(bodySize - saltBuf.length, 0);
    saltBuf.copy(body, start, 0, Math.min(saltBuf.length, bodySize));
  }
  return Buffer.concat([header, body]);
}

async function createAppWithEnv(env: Record<string, string | undefined>): Promise<INestApplication> {
  const old = { ...process.env };
  Object.assign(process.env, env);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule, LoggerModule.forRoot()] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new MulterExceptionFilter(), new AllExceptionsFilter());
  await app.init();

  // restore env for subsequent apps
  process.env = old;
  return app;
}

describe('Auth e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createAppWithEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      STRICT_STORAGE: 'false',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('login sucesso', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it('login inválido -> 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'wrong' })
      .expect(401);
  });
});

describe('Documents e2e', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createAppWithEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      STRICT_STORAGE: 'false',
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('upload happy path -> 201 + Location + ETag', async () => {
    const pdf = makePdfBuffer(2048, randomUUID());
    const res = await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .set('x-request-id', 'e2e-upload-1')
      .attach('file', pdf, { filename: 'test.pdf', contentType: 'application/pdf' })
      .field('title', 'E2E Doc')
      .expect(201);

    expect(res.header['etag']).toBeDefined();
    expect(res.header['location']).toMatch(/^\/documents\//);
    expect(res.body.id).toBeDefined();
  });

  it('upload duplicado -> 409 DUPLICATE_CONTENT', async () => {
    const pdf = makePdfBuffer(2048, randomUUID());
    // primeira
    await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf, { filename: 'dup.pdf', contentType: 'application/pdf' })
      .field('title', 'Dup 1')
      .expect(201);
    // segunda igual
    const res = await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf, { filename: 'dup.pdf', contentType: 'application/pdf' })
      .field('title', 'Dup 2')
      .expect(409);

    expect(res.body.code).toBe('DUPLICATE_CONTENT');
  });

  it('upload 413 quando >10MB', async () => {
    const tooBig = makePdfBuffer(10 * 1024 * 1024 + 1, randomUUID());
    const res = await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tooBig, { filename: 'big.pdf', contentType: 'application/pdf' })
      .field('title', 'Too Big')
      .expect(413);

    expect(res.body.code).toBe('UPLOAD_TOO_LARGE');
  });
});

describe('Documents e2e - STRICT_STORAGE=true (S3 down) -> 503', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createAppWithEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      STRICT_STORAGE: 'true',
      S3_ENDPOINT: 'http://127.0.0.1:59999',
      S3_BUCKET: 'missing-bucket',
      S3_REGION: 'us-east-1',
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200);
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('upload -> 503 STORAGE_UNAVAILABLE', async () => {
    const pdf = makePdfBuffer(2048, randomUUID());
    const res = await request(app.getHttpServer())
      .post('/admin/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf, { filename: 's3down.pdf', contentType: 'application/pdf' })
      .field('title', 'S3 Down')
      .expect(503);

    expect(res.body.code).toBe('STORAGE_UNAVAILABLE');
  });
});
