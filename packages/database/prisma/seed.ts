import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'system-org' },
    update: {},
    create: {
      name: 'MultiWA System',
      slug: 'system-org',
      plan: 'enterprise',
      settings: {},
    },
  });

  // Create default workspace if it doesn't exist
  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      organizationId: org.id,
      slug: 'default',
    },
  });

  if (!existingWorkspace) {
    await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Default Workspace',
        slug: 'default',
        description: 'System Default Workspace',
      },
    });
  }

  // Hash superadmin password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash('admin12345', saltRounds);

  // Create superadmin user
  const superadmin = await prisma.user.upsert({
    where: { email: 'admin@multiwa.com' },
    update: {
      role: 'superadmin',
      isActive: true,
    },
    create: {
      organizationId: org.id,
      email: 'admin@multiwa.com',
      name: 'مدير النظام',
      passwordHash,
      role: 'superadmin',
      isActive: true,
    },
  });

  console.log('Database seeded successfully.');
  console.log('Superadmin email:', superadmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
