import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  it('valida login por cpf normalizado', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const users = {
      findByCpf: jest.fn((cpf: string) => {
        if (cpf === '12345678909')
          return Promise.resolve({
            id: 'u1',
            email: 'user@local.test',
            cpf: '12345678909',
            role: 'USER',
            passwordHash: 'hash',
          });
        return Promise.resolve(null);
      }),
      findByEmail: jest.fn(() => Promise.resolve(null)),
    } as unknown as UsersService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        {
          provide: JwtService,
          useValue: {
            signAsync: () => Promise.resolve('token'),
            decode: () => ({ exp: Math.floor(Date.now() / 1000) + 900 }),
          },
        },
      ],
    }).compile();

    const auth = moduleRef.get(AuthService);
    const res = await auth.login('123.456.789-09', 'User@123');
    expect(res.accessToken).toBe('token');
  });
});
