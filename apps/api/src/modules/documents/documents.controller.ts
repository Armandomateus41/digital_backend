import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
  ParseFilePipe,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

class UploadBodyDto {
  @IsString() title!: string;
}

@ApiTags('Documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('admin/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @Body() body: UploadBodyDto,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId?: string }; requestId?: string },
  ) {
    if (!file || !file.buffer || !file.size || file.size <= 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Arquivo ausente ou vazio',
      });
    }
    const userId = typeof req.user?.userId === 'string' ? req.user.userId : '';
    const doc = await this.documents.upload({
      title: body.title,
      file,
      createdById: userId,
    });
    res.setHeader('ETag', `W/"${doc.contentSha256}"`);
    res.setHeader('Location', `/documents/${doc.id}`);
    return res.status(HttpStatus.CREATED).json(doc);
  }

  @Get('documents/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtém metadados de um documento' })
  async getOne(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const doc = await this.documents.getMetadata(id);
    if (!doc)
      return res.status(HttpStatus.NOT_FOUND).json({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado',
      });
    const etag = `W/"${doc.contentSha256}"`;
    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      res.setHeader('ETag', etag);
      return res.status(HttpStatus.NOT_MODIFIED).send();
    }
    res.setHeader('ETag', etag);
    return res.status(HttpStatus.OK).json(doc);
  }

  // Público (usuário final): próximo documento para assinar
  @Get('user/documents/next')
  @ApiOperation({
    summary: 'Próximo documento disponível para o usuário (público)',
  })
  async nextToSign() {
    return this.documents.getNextForUser();
  }

  // Público (usuário final): assinar documento
  @Post('user/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assina documento público com CPF e retorna hash' })
  async signPublic(
    @Body() body: { documentId: string; cpf: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const idempotencyKeyRaw = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyRaw)
      ? idempotencyKeyRaw[0]
      : idempotencyKeyRaw;
    try {
      const result = await this.documents.signPublic(body.documentId, body.cpf);
      if (idempotencyKey) {
        res.setHeader('Idempotency-Key', String(idempotencyKey));
      }
      return res.status(HttpStatus.OK).json(result);
    } catch (err) {
      // Se assinatura já existe para o mesmo documento+CPF, considerar idempotente
      const code = (err as { code?: unknown })?.code;
      if (code === 'SIGNER_ALREADY_ADDED') {
        const result = await this.documents.signPublic(
          body.documentId,
          body.cpf,
        );
        if (idempotencyKey) {
          res.setHeader('Idempotency-Key', String(idempotencyKey));
        }
        return res.status(HttpStatus.OK).json(result);
      }
      throw err;
    }
  }

  @Get('admin/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lista assinaturas (admin)' })
  async listSignatures(@Req() req: Request) {
    const limitRaw = req.query['limit'];
    const cursorId =
      typeof req.query['cursorId'] === 'string'
        ? req.query['cursorId']
        : undefined;
    const cursorCreatedAtRaw =
      typeof req.query['cursorCreatedAt'] === 'string'
        ? req.query['cursorCreatedAt']
        : undefined;
    const format =
      typeof req.query['format'] === 'string' ? req.query['format'] : undefined;
    const limit =
      typeof limitRaw === 'string'
        ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100)
        : 50;
    const cursor =
      cursorId && cursorCreatedAtRaw
        ? { id: cursorId, createdAt: new Date(cursorCreatedAtRaw) }
        : undefined;
    const data = await this.documents.listSignatures(limit, cursor);
    // Compatibilidade: se não pedir envelope, retorna array puro
    if (format !== 'envelope') {
      return data.items;
    }
    return data;
  }

  @Post('admin/documents/:id/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adiciona assinante a um documento (admin)' })
  async createSignature(
    @Param('id') documentId: string,
    @Body() body: { name: string; cpf: string },
  ) {
    return this.documents.createSignature({
      documentId,
      name: body.name,
      cpf: body.cpf,
    });
  }

  @Get('documents/:id/signatures')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lista assinaturas de um documento' })
  async listByDocument(@Param('id') documentId: string) {
    return this.documents.listSignaturesByDocument(documentId);
  }

  @Post('signatures/:id/sign')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca assinatura como SIGNED' })
  async sign(@Param('id') id: string) {
    return this.documents.sign(id);
  }

  @Get('documents/:id/certificate-url')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Retorna URL pré‑assinada para download do certificado (se disponível)',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { url: { type: 'string' } } },
  })
  async getPresignedCertificate(@Param('id') id: string) {
    const url = await this.documents.getCertificatePresignedUrl(id);
    return { url };
  }
}
