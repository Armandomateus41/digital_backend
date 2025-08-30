import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(identifier: string, password: string) {
    // aceita e-mail ou CPF
    const normalized = identifier.replace(/\D/g, '');
    const byCpf = normalized.length === 11;
    const user = byCpf
      ? await this.users.findByCpf(normalized)
      : await this.users.findByEmail(identifier);
    if (!user)
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    return user;
  }

  async login(identifier: string, password: string) {
    const user = await this.validateUser(identifier, password);
    const normalizedRole = String(user.role).toUpperCase();
    const payload: { sub: string; role: string } = {
      sub: user.id,
      role: normalizedRole,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const decodedUnknown: unknown = this.jwt.decode(accessToken);
    const decoded =
      decodedUnknown && typeof decodedUnknown === 'object'
        ? (decodedUnknown as Record<string, unknown>)
        : {};
    const expValue = typeof decoded.exp === 'number' ? decoded.exp : undefined;
    const expiresIn =
      typeof expValue === 'number' ? expValue * 1000 - Date.now() : undefined;
    return { accessToken, expiresIn };
  }
}
