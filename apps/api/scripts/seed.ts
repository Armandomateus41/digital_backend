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

  console.log(`Seeded admin: ${email}`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
