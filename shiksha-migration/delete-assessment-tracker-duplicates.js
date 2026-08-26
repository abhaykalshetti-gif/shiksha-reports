require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./db');

// ── Config ─────────────────────────────────────────────────────────────────────
const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
const LOGS_DIR = path.join(__dirname, 'logs');

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function writeLog(logObj) {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const filePath = path.join(LOGS_DIR, `deletion-assessment-tracker-${todayStr()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(logObj, null, 2), 'utf8');
  return filePath;
}

// ── Step 1: SELECT all duplicate rows ─────────────────────────────────────────
async function selectDuplicates(client) {
  const sql = `
    SELECT
      t."AssesTrackingID",
      t."UserID",
      t."AssessmentID",
      t."AssessmentType",
      t."createdAt",
      t.rn
    FROM (
      SELECT
        t.*,
        ROW_NUMBER() OVER (
          PARTITION BY t."UserID", t."AssessmentID"
          ORDER BY t."createdAt" ASC
        ) AS rn
      FROM public."AssessmentTracker" AS t
      WHERE t."evaluatedBy"::text = 'Online'
        AND t."TenantID" = $1
        AND t."AssessmentType" = 'Pre Test'
        AND t."AssessmentID" = t."CourseID"
    ) t
    WHERE t.rn > 1
    ORDER BY t."UserID", t."AssessmentID", t."createdAt"
  `;
  const res = await client.query(sql, [TENANT_ID]);
  return res.rows;
}

// ── Per-record: Delete one row by AssesTrackingID ─────────────────────────────
async function deleteOne(client, assesTrackingId, index, total) {
  const sql = `DELETE FROM public."AssessmentTracker" WHERE "AssesTrackingID" = $1`;
  try {
    const res = await client.query(sql, [assesTrackingId]);
    console.log(`  [${index}/${total}] ✅ Deleted AssesTrackingID: ${assesTrackingId} (${res.rowCount} row)`);
    return true;
  } catch (err) {
    console.error(`  [${index}/${total}] ❌ Failed AssesTrackingID: ${assesTrackingId} — ${err.message}`);
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(62)}`);
  console.log(`  DELETE-ASSESSMENT-TRACKER-DUPLICATES`);
  console.log(`  TenantID : ${TENANT_ID}`);
  console.log(`  DB       : ${dbConfig.destination.database} @ ${dbConfig.destination.host}`);
  console.log(`${'='.repeat(62)}\n`);

  const client = new Client(dbConfig.destination);
  await client.connect();
  console.log('Connected to AssessmentTracker DB\n');

  const startedAt = new Date().toISOString();

  // ── Step 1: Fetch all duplicate rows ─────────────────────────────────────────
  console.log('── Step 1: Selecting duplicate rows ───────────────────────');
  const duplicateRows = await selectDuplicates(client);
  console.log(`  Found ${duplicateRows.length.toLocaleString()} duplicate row(s) (rn > 1)\n`);

  if (duplicateRows.length === 0) {
    console.log('✅ No duplicate rows found. Nothing to delete. Exiting.\n');
    await client.end();
    process.exit(0);
  }

  // Print all fetched rows
  console.log(`  ${'#'.padEnd(4)} ${'AssesTrackingID'.padEnd(38)} ${'UserID'.padEnd(38)} rn`);
  console.log(`  ${'─'.repeat(85)}`);
  duplicateRows.forEach((row, i) => {
    console.log(
      `  ${String(i + 1).padEnd(4)} ${String(row.AssesTrackingID).padEnd(38)} ${String(row.UserID).padEnd(38)} ${row.rn}`
    );
  });
  console.log();

  // ── Step 2: Delete each record one by one ────────────────────────────────────
  console.log('── Step 2: Deleting records one by one ────────────────────');
  const total = duplicateRows.length;
  let successCount = 0;
  const failedRows = [];

  for (let i = 0; i < duplicateRows.length; i++) {
    const row = duplicateRows[i];
    // const ok = await deleteOne(client, row.AssesTrackingID, i + 1, total);
    // if (ok) {
    //   successCount++;
    // } else {
    //   failedRows.push(row.AssesTrackingID);
    // }
  }

  console.log(`\n  Done — ${successCount}/${total} rows deleted, ${failedRows.length} failed.\n`);
  if (failedRows.length > 0) {
    console.warn('  Failed AssesTrackingIDs:');
    failedRows.forEach(id => console.warn(`    - ${id}`));
    console.log();
  }

  await client.end();

  // ── Write log ─────────────────────────────────────────────────────────────────
  const finishedAt = new Date().toISOString();
  const logObj = {
    script: 'delete-assessment-tracker-duplicates.js',
    tenantId: TENANT_ID,
    database: dbConfig.assessment_destination.database,
    host: dbConfig.assessment_destination.host,
    startedAt,
    finishedAt,
    filters: {
      evaluatedBy: 'Online',
      assessmentType: 'Pre Test',
      condition: 'AssessmentID = CourseID',
      duplicateRule: 'rn > 1 (kept only the earliest attempt per UserID + AssessmentID)',
    },
    totalDuplicatesFound: duplicateRows.length,
    deleted: successCount,
    failed: failedRows.length,
    failedIds: failedRows,
    deletedRows: duplicateRows.map(r => ({
      AssesTrackingID: r.AssesTrackingID,
      UserID: r.UserID,
      AssessmentID: r.AssessmentID,
      createdAt: r.createdAt,
      rn: r.rn,
    })),
  };

  const logPath = writeLog(logObj);

  console.log(`${'='.repeat(62)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(62)}`);
  console.log(`  Total duplicate rows : ${duplicateRows.length.toLocaleString()}`);
  console.log(`  Deleted              : ${successCount.toLocaleString()}`);
  console.log(`  Failed               : ${failedRows.length.toLocaleString()}`);
  console.log(`  Log written to       : ${logPath}`);
  console.log(`${'='.repeat(62)}\n`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
