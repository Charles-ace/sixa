import { list, del, get, put } from '@vercel/blob';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch {}

const summarize = async (prefix: string) => {
  let blobs: any[] = [];
  try {
    const res = await list({ prefix });
    blobs = res.blobs;
  } catch (e) {
    console.log(`list ${prefix} FAILED:`, e instanceof Error ? e.message : e);
    return blobs;
  }
  const bytes = blobs.reduce((s, b) => s + (b.size || 0), 0);
  console.log(`[${prefix}] count=${blobs.length} bytes=${bytes} MB=${(bytes / 1048576).toFixed(2)}`);
  return blobs;
};

async function main() {
  const snapshots = await summarize('sixa/snapshots/');
  const jobs = await summarize('sixa/jobs/');
  const root = await summarize('sixa/');
  const names = root.map((b) => b.pathname);
  console.log('root blobs:', names.join(', '));

  console.log('\nsnapshot sample (newest 3):');
  snapshots.sort((a, b) => a.pathname.localeCompare(b.pathname));
  for (const s of snapshots.slice(-3)) console.log(' ', s.pathname, s.size, s.uploadedAt);

  const arg = process.argv[2];
  if (arg === '--delete-snapshots') {
    const keep = snapshots[snapshots.length - 1]?.pathname;
    console.log(`\nDeleting ${snapshots.length - 1} snapshots (keeping newest ${keep})...`);
    for (const s of snapshots) {
      if (s.pathname === keep) continue;
      try { await del(s.pathname); } catch (e) { console.log('del FAILED for', s.pathname, e instanceof Error ? e.message : e); }
    }
    console.log('done');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
