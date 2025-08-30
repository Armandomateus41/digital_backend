import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me',
    });
  }

  // not using await, but required by passport interface
  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: unknown) {
    const obj =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    const role =
      typeof obj.role === 'string' ? obj.role.toLowerCase() : undefined;
    const userId = typeof obj.sub === 'string' ? obj.sub : undefined;
    return { userId, role };
  }
}
