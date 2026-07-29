/**
 * Database seed – creates the default admin user and example rules.
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Default admin user
  const existing = await prisma.user.findUnique({ where: { email: 'admin@notificationhub.local' } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name:         'Administrator',
        email:        'admin@notificationhub.local',
        passwordHash: await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD ?? 'changeme', 12),
        role:         'ADMIN',
      },
    });
    console.log('✅ Admin user created  →  admin@notificationhub.local / changeme');
  } else {
    console.log('ℹ️  Admin user already exists, skipping.');
  }

  // Default settings
  const defaults: Record<string,string> = {
    'app.name':        'NotificationHub',
    'app.theme':       'dark',
    'retention.days':  '90',
    'quiet.hours.enabled': 'false',
    'quiet.hours.start': '22:00',
    'quiet.hours.end':   '07:00',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log('✅ Default settings applied.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
