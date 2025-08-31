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
  async getOne(@Param('id') id: string) {
    return this.documents.getMetadata(id);
  }

  // Público (usuário final): próximo documento para assinar
  @Get('user/documents/next')
  @ApiOperation({ summary: 'Próximo documento disponível para o usuário (público)' })
  async nextToSign() {
    return this.documents.getNextForUser();
  }

  // Público (usuário final): assinar documento
  @Post('user/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assina documento público com CPF e retorna hash' })
  async signPublic(@Body() body: { documentId: string; cpf: string }) {
    return this.documents.signPublic(body.documentId, body.cpf);
  }

  @Get('admin/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lista assinaturas (admin)' })
  async listSignatures() {
    return this.documents.listSignatures();
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
  @ApiOperation({ summary: 'Retorna URL pré‑assinada para download do certificado (se disponível)' })
  @ApiOkResponse({ schema: { type: 'object', properties: { url: { type: 'string' } } } })
  async getPresignedCertificate(@Param('id') id: string) {
    const url = await this.documents.getCertificatePresignedUrl(id);
    return { url };
  }
}
