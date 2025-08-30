import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const result: { status: 'ok'; db: 'up' | 'down'; s3: 'up' | 'down' } = {
      status: 'ok',
      db: 'down',
      s3: 'down',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.db = 'up';
    } catch {
      result.db = 'down';
    }

    const strict = (process.env.STRICT_STORAGE ?? 'false').toLowerCase() === 'true';
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? 'us-east-1';
    const bucket = process.env.S3_BUCKET;

    if (endpoint && bucket) {
      try {
        const s3 = new S3Client({
          region,
          endpoint,
          forcePathStyle: true,
          credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
          } : undefined,
        });
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        result.s3 = 'up';
      } catch {
        result.s3 = 'down';
      }
    }

    if (strict && result.s3 === 'down') {
      // Liveness ok, readiness dependerá em ambiente real; aqui só refletimos status
    }

    return result;
  }
}
