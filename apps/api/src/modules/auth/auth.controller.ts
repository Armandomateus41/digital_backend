import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.identifier, body.password);
  }

  @Get('session')
  @HttpCode(200)
  session(@Req() req: any) {
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      return { authenticated: false };
    }
    const token = header.substring('Bearer '.length);
    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET ?? 'change-me' }) as any;
      const role = payload?.role ? String(payload.role).toUpperCase() : undefined;
      return {
        authenticated: true,
        role,
        email: payload?.email ?? undefined,
        exp: payload?.exp ?? undefined,
      };
    } catch {
      return { authenticated: false };
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return req.user ?? null;
  }
}
