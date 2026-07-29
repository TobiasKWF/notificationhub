/**
 * Database seed – creates the default admin user and default settings.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment (set by install.sh).
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail    = process.env.ADMIN_EMAIL    ?? 'admin@localhost';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  const adminName     = process.env.ADMIN_NAME     ?? 'Administrator';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name:         adminName,
        email:        adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role:         'ADMIN',
      },
    });
    console.log(`✅ Admin user created  →  ${adminEmail} / ${adminPassword}`);
    console.log('⚠️  Change this password immediately after first login!');
  } else {
    console.log(`ℹ️  Admin user already exists (${adminEmail}), skipping.`);
  }

  // Default settings (upsert – safe to re-run)
  const defaults: Record<string, string> = {
    'app.name':              'NotificationHub',
    'app.theme':             'dark',
    'retention.days':        '90',
    'quiet.hours.enabled':   'false',
    'quiet.hours.start':     '22:00',
    'quiet.hours.end':       '07:00',
    'dedup.enabled':         'true',
    'dedup.window.seconds':  '60',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log('✅ Default settings applied.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
