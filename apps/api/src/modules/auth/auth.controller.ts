import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.identifier, body.password);
  }

  @Get('session')
  @HttpCode(200)
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
