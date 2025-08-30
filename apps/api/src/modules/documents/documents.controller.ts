import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UploadedFile, UseInterceptors, Res, ParseFilePipe, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';

class UploadBodyDto { @IsString() title!: string; }

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
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File,
    @Res() res: Response,
    @Req() req: Request & { user?: any; requestId?: string },
  ) {
    if (!file || !file.buffer || !file.size || file.size <= 0) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo ausente ou vazio' });
    }
    const userId = req.user?.userId as string;
    const doc = await this.documents.upload({ title: body.title, file, createdById: userId });
    res.setHeader('ETag', `W/"${doc.contentSha256}"`);
    res.setHeader('Location', `/documents/${doc.id}`);
    return res.status(HttpStatus.CREATED).json(doc);
  }

  @Get('documents/:id')
  @UseGuards(JwtAuthGuard)
  async getOne(@Param('id') id: string) {
    return this.documents.getMetadata(id);
  }

  @Get('admin/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async listSignatures() {
    return this.documents.listSignatures();
  }

  @Post('admin/documents/:id/signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createSignature(@Param('id') documentId: string, @Body() body: { name: string; cpf: string }) {
    return this.documents.createSignature({ documentId, name: body.name, cpf: body.cpf });
  }

  @Get('documents/:id/signatures')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listByDocument(@Param('id') documentId: string) {
    return this.documents.listSignaturesByDocument(documentId);
  }

  @Post('signatures/:id/sign')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sign(@Param('id') id: string) {
    return this.documents.sign(id);
  }
}
