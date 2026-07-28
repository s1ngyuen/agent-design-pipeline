// CLI checklist import — for local/dev databases where DATABASE_URL is a
// plain readable env var. Production import goes through
// `/api/admin/checklist/import` instead — see that route's comment for why.
//
// Usage: npm run db:import-checklist

import 'dotenv/config';
import { loadChecklistFiles, importChecklistRows } from './checklistImport';

async function main(): Promise<void> {
  const files = loadChecklistFiles();
  if (files.length === 0) {
    console.log('No files found in src/db/checklist-data/ — nothing to import.');
    return;
  }

  for (const { file, rows } of files) {
    console.log(`Importing ${rows.length} row(s) from ${file}...`);
    const { inserted, skipped } = await importChecklistRows(rows);
    console.log(`  -> ${inserted} inserted, ${skipped} already present (skipped).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Checklist import failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
