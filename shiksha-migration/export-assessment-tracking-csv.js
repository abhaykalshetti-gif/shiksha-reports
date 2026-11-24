// Read-only script: reads assessmentTrackingIds from ../uncommon_ids.csv, fetches the full
// public.assessment_tracking rows from the SOURCE db (only for the given tenantId)
// and writes them to a CSV.
// Usage: node export-assessment-tracking-csv.js [inputCsv] [outputCsv]
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./db');

const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
const INPUT_CSV = path.resolve(process.argv[2] || path.join(__dirname, '../uncommon_ids.csv'));
const OUTPUT_CSV = path.resolve(process.argv[3] || path.join(__dirname, '../assessment_tracking_export.csv'));
const SOURCE_FILTER = 'Prod AssessmentTracker table.csv'; // only IDs with this present_only_in value
const BATCH_SIZE = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadTrackingIds(csvPath) {
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).slice(1);
  const ids = new Set();
  for (const line of lines) {
    const [rawId, rawSource] = line.split(',');
    const id = (rawId || '').trim().replace(/^"|"$/g, '');
    const source = (rawSource || '').trim().replace(/^"|"$/g, '');
    if (source !== SOURCE_FILTER) continue;
    if (UUID_RE.test(id)) ids.add(id);
  }
  return [...ids];
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const ids = loadTrackingIds(INPUT_CSV);
  console.log(`Loaded ${ids.length} unique assessmentTrackingIds from ${INPUT_CSV}`);
  console.log(`Filtering on tenantId = ${TENANT_ID}`);

  const client = new Client(dbConfig.source);
  await client.connect();

  const out = fs.createWriteStream(OUTPUT_CSV);
  let columns = null;
  let written = 0;

  try {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const res = await client.query(
        `SELECT * FROM public.assessment_tracking
         WHERE "assessmentTrackingId" = ANY($1::uuid[])
           AND "tenantId" = $2`,
        [batch, TENANT_ID],
      );
      if (!columns) {
        columns = res.fields.map((f) => f.name);
        out.write(columns.map(csvCell).join(',') + '\n');
      }
      for (const row of res.rows) {
        out.write(columns.map((c) => csvCell(row[c])).join(',') + '\n');
      }
      written += res.rows.length;
      console.log(`Batch ${i / BATCH_SIZE + 1}: ${res.rows.length}/${batch.length} matched`);
    }
  } finally {
    await new Promise((r) => out.end(r));
    await client.end();
  }

  console.log(`Done. ${written} records written to ${OUTPUT_CSV}`);
}

main().catch((e) => {
  console.error('Export failed:', e);
  process.exit(1);
});
