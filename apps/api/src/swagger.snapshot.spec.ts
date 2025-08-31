import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

describe('Swagger snapshot', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new RequestIdInterceptor());
    app.useGlobalFilters(new MulterExceptionFilter(), new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches snapshot', () => {
    const config = new DocumentBuilder()
      .setTitle('Digisign Flow API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);

    // Remover campos voláteis
    if (doc && typeof (doc as any) === 'object') {
      delete (doc as any).servers;
    }

    expect(doc).toMatchSnapshot();
  });
});


