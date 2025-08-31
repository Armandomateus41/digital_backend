import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsOptional, IsString } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  password!: string;

  // Permite login passando `cpf` como alias de `identifier`
  @IsOptional()
  @IsString()
  cpf?: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Realiza login com e-mail ou CPF e retorna JWT' })
  @ApiBody({
    description: 'Informe identifier (e-mail) OU cpf, e a senha',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            identifier: { type: 'string', example: 'admin@local.test' },
            password: { type: 'string', example: 'Admin@123' },
          },
          required: ['identifier', 'password'],
        },
        {
          type: 'object',
          properties: {
            cpf: { type: 'string', example: '12345678909' },
            password: { type: 'string', example: 'User@123' },
          },
          required: ['cpf', 'password'],
        },
      ],
    },
  })
  @ApiOkResponse({
    description: 'JWT emitido com sucesso',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        expiresIn: { type: 'number', example: 900000 },
      },
    },
  })
  login(@Body() body: LoginDto) {
    const identifier =
      typeof body.identifier === 'string' && body.identifier.trim().length > 0
        ? body.identifier
        : typeof body.cpf === 'string'
          ? body.cpf
          : undefined;
    if (!identifier)
      throw new BadRequestException({
        code: 'INVALID_BODY',
        message: 'identifier or cpf is required',
      });
    return this.auth.login(identifier, body.password);
  }

  @Get('session')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Valida a sessão usando Authorization: Bearer <token>',
  })
  @ApiHeader({ name: 'Authorization', description: 'Bearer <token>' })
  @ApiOkResponse({
    description: 'Estado da sessão',
    schema: {
      type: 'object',
      properties: {
        authenticated: { type: 'boolean', example: true },
        role: { type: 'string', example: 'ADMIN' },
        email: { type: 'string', example: 'admin@local.test' },
        exp: { type: 'number', example: 1735689600 },
      },
    },
  })
  session(@Req() req: { headers: Record<string, unknown> }) {
    const authRaw = req.headers['authorization'];
    const header: string | undefined =
      typeof authRaw === 'string' ? authRaw : undefined;
    if (!header?.startsWith('Bearer ')) {
      return { authenticated: false };
    }
    const token = header.substring('Bearer '.length);
    try {
      const payloadUnknown: unknown = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET ?? 'change-me',
      });
      const payload =
        payloadUnknown && typeof payloadUnknown === 'object'
          ? (payloadUnknown as Record<string, unknown>)
          : {};
      const role =
        typeof payload.role === 'string'
          ? String(payload.role).toUpperCase()
          : undefined;
      return {
        authenticated: true,
        role,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        exp: typeof payload.exp === 'number' ? payload.exp : undefined,
      };
    } catch {
      return { authenticated: false };
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user?: { userId?: string; role?: string } }) {
    return req.user ?? null;
  }
}
