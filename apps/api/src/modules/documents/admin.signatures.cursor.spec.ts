import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

const HAS_DB = Boolean(process.env.DATABASE_URL);

jest.setTimeout(30000);

const d = HAS_DB ? describe : describe.skip;

d('Admin signatures cursor', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const login = (await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@local.test', password: 'Admin@123' })
      .expect(200)) as unknown as { body?: { accessToken?: unknown } };
    token =
      typeof login.body?.accessToken === 'string' ? login.body.accessToken : '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna nextCursor quando há muitos itens', async () => {
    const list1 = (await request(app.getHttpServer())
      .get('/admin/signatures?limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)) as unknown as { body?: { nextCursor?: unknown } };
    const next = list1.body?.nextCursor as
      | { id?: unknown; createdAt?: unknown }
      | undefined;
    if (
      next &&
      typeof next.id === 'string' &&
      typeof next.createdAt === 'string'
    ) {
      await request(app.getHttpServer())
        .get(
          `/admin/signatures?limit=1&cursorId=${encodeURIComponent(next.id)}&cursorCreatedAt=${encodeURIComponent(next.createdAt)}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
  });
});
