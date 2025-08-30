import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async validateUser(identifier: string, password: string) {
    const user = await this.users.findByEmail(identifier);
    if (!user) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    return user;
  }

  async login(identifier: string, password: string) {
    const user = await this.validateUser(identifier, password);
    const normalizedRole = String(user.role).toUpperCase();
    const payload = { sub: user.id, role: normalizedRole };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : undefined;
    return { accessToken, expiresIn };
  }
}
