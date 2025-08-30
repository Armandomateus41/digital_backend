import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function run() {
  const prisma = new PrismaClient();
  const email = 'admin@local.test';
  const password = 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.admin },
    create: { email, passwordHash, role: Role.admin },
  });

  // user comum por CPF
  const userEmail = 'user@local.test';
  const userCpf = '12345678909';
  const userPass = 'User@123';
  const userHash = await bcrypt.hash(userPass, 10);
  await prisma.user.upsert({
    where: { email: userEmail },
    update: { passwordHash: userHash, role: Role.user, cpf: userCpf },
    create: { email: userEmail, passwordHash: userHash, role: Role.user, cpf: userCpf },
  });

  console.log(`Seeded admin: ${email} | user: ${userEmail} (cpf ${userCpf})`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
