import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { asc } from 'drizzle-orm';

import { ensureUserDriveFolder } from '../lib/google-drive-core';

interface SyncSummary {
  created: number;
  existing: number;
  adopted: number;
  failed: number;
}

async function main() {
  const [{ db }, { users }] = await Promise.all([
    import('../db/core'),
    import('../db/schema'),
  ]);

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  const summary: SyncSummary = {
    created: 0,
    existing: 0,
    adopted: 0,
    failed: 0,
  };

  console.log(`Syncing Google Drive folders for ${allUsers.length} users...`);

  for (const user of allUsers) {
    try {
      const result = await ensureUserDriveFolder({
        userId: user.id,
        name: user.name,
        email: user.email,
      });

      summary[result.status] += 1;

      console.log(
        `[${result.status.toUpperCase()}] ${user.name ?? user.email ?? user.id} -> ${result.folderName} (${result.folderId})`
      );
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[FAILED] ${user.name ?? user.email ?? user.id} -> ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log('');
  console.log('Google Drive user-folder sync summary');
  console.log(`Created: ${summary.created}`);
  console.log(`Existing: ${summary.existing}`);
  console.log(`Adopted: ${summary.adopted}`);
  console.log(`Failed: ${summary.failed}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Google Drive user-folder sync failed to start.', error);
  process.exit(1);
});
