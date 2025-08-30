import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(params: {
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
  }) {
    return this.prisma.user.create({ data: params });
  }
}
