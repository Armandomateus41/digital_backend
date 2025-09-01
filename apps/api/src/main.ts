import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { EtagInterceptor } from './common/interceptors/etag.interceptor';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// Tracing opcional via OpenTelemetry
const otelEnabled = (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true';
if (otelEnabled) {
  (async () => {
    try {
      const sdkModule: unknown = await import('@opentelemetry/sdk-node');
      const exporterModule: unknown = await import('@opentelemetry/exporter-trace-otlp-http');
      const autoModule: unknown = await import('@opentelemetry/auto-instrumentations-node');
      const NodeSDK = (sdkModule as { NodeSDK: new (args: unknown) => { start: () => void; shutdown: () => void } }).NodeSDK;
      const OTLPTraceExporter = (exporterModule as { OTLPTraceExporter: new (args: unknown) => unknown }).OTLPTraceExporter;
      const getNodeAutoInstrumentations = (autoModule as { getNodeAutoInstrumentations: () => unknown }).getNodeAutoInstrumentations;
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
      const serviceName = process.env.SERVICE_NAME || 'digisign-api';
      const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter({ url: endpoint }), serviceName, instrumentations: [getNodeAutoInstrumentations()] });
      sdk.start();
      process.on('SIGTERM', () => { sdk.shutdown(); });
    } catch {
      // ignore tracing init errors in production
    }
  })();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'location', 'etag'],
  });

  app.useGlobalInterceptors(new RequestIdInterceptor(), new EtagInterceptor());
  app.useGlobalFilters(new MulterExceptionFilter(), new AllExceptionsFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Digisign Flow API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on port ${port}`);
}
void bootstrap();
