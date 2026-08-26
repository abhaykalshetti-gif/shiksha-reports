require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./db');

// ── Config ─────────────────────────────────────────────────────────────────────
const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
const TARGET_ASSES_TYPE = 'Pre Test';
const LOGS_DIR = path.join(__dirname, 'logs');
const API_TIMEOUT_MS = 10000;

// Full hierarchy API — contentId appended at the end
const HIERARCHY_API_BASE = 'https://interface.prathamdigital.org/interface/v1/action/questionset/v2/hierarchy';

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function writeLog(logObj) {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const filePath = path.join(LOGS_DIR, `deletion-assessment-tracking-source-${todayStr()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(logObj, null, 2), 'utf8');
  return filePath;
}

// ── Step 1: SELECT all duplicate rows from source DB ──────────────────────────
async function selectDuplicates(client) {
  const sql = `
    SELECT
      t."assessmentTrackingId",
      t."contentId",
      t."userId",
      t."courseId",
      t."createdOn",
      t.rn
    FROM (
      SELECT
        t.*,
        ROW_NUMBER() OVER (
          PARTITION BY t."userId", t."contentId"
          ORDER BY t."createdOn" ASC
        ) AS rn
      FROM public.assessment_tracking AS t
      WHERE t."evaluatedBy" = 'Online'
        AND t."tenantId" = $1
        AND t."contentId" = t."courseId"
    ) t
    WHERE t.rn > 1
    ORDER BY t."userId", t."contentId", t."createdOn"
  `;
  const res = await client.query(sql, [TENANT_ID]);
  return res.rows;
}

// ── Per-record: Call API to get assessmentType for a contentId ─────────────────
// Cache to avoid duplicate API calls for the same contentId
const assessmentTypeCache = new Map();

async function getAssessmentType(contentId) {
  if (assessmentTypeCache.has(contentId)) {
    return assessmentTypeCache.get(contentId);
  }

  // GET https://interface.prathamdigital.org/interface/v1/action/questionset/v2/hierarchy/{contentId}
  const url = `${HIERARCHY_API_BASE}/${contentId}`;

  try {
    const response = await axios.get(url, {
      timeout: API_TIMEOUT_MS,
      headers: {
        'accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
    });

    // Response shape: { result: { questionset: { assessmentType: '...' } } }
    const assessmentType = response.data?.result?.questionset?.assessmentType || null;
    assessmentTypeCache.set(contentId, assessmentType);
    return assessmentType;
  } catch (err) {
    console.error(`      [API ERROR] contentId: ${contentId} — ${err.message}`);
    assessmentTypeCache.set(contentId, null);
    return null;
  }
}

// ── Per-record: Delete a single row by assessmentTrackingId ───────────────────
async function deleteOne(client, trackingId) {
  const sql = `DELETE FROM public.assessment_tracking WHERE "assessmentTrackingId" = $1`;
  const res = await client.query(sql, [trackingId]);
  return res.rowCount;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(65)}`);
  console.log(`  DELETE-ASSESSMENT-TRACKING-SOURCE-DUPLICATES`);
  console.log(`  TenantID        : ${TENANT_ID}`);
  console.log(`  Assessment type : ${TARGET_ASSES_TYPE}`);
  console.log(`  Source DB       : ${dbConfig.source.database} @ ${dbConfig.source.host}`);
  console.log(`${'='.repeat(65)}\n`);

  const client = new Client(dbConfig.source);
  await client.connect();
  console.log('Connected to source DB (assessment_tracking)\n');

  const startedAt = new Date().toISOString();

  // ── Step 1: Fetch ALL duplicate rows at once ──────────────────────────────────
  console.log('── Step 1: Fetching all duplicate rows ─────────────────────');
  const allDuplicates = await selectDuplicates(client);
  console.log(`  Total duplicate rows found (rn > 1): ${allDuplicates.length.toLocaleString()}\n`);

  if (allDuplicates.length === 0) {
    console.log('✅ No duplicate rows found. Nothing to process. Exiting.\n');
    await client.end();
    process.exit(0);
  }

  // Print all fetched rows
  console.log(`  ${'#'.padEnd(5)} ${'assessmentTrackingId'.padEnd(38)} ${'contentId'.padEnd(38)} rn`);
  console.log(`  ${'─'.repeat(88)}`);
  allDuplicates.forEach((row, i) => {
    console.log(
      `  ${String(i + 1).padEnd(5)} ${String(row.assessmentTrackingId).padEnd(38)} ${String(row.contentId).padEnd(38)} ${row.rn}`
    );
  });
  console.log();

  // ── Step 2: Process each record ONE BY ONE ────────────────────────────────────
  console.log(`── Step 2: Processing each record one by one ───────────────`);
  console.log(`  Logic: call API → if assessmentType = '${TARGET_ASSES_TYPE}' → delete, else skip\n`);

  const total = allDuplicates.length;
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const processLog = [];

  for (let i = 0; i < allDuplicates.length; i++) {
    const row = allDuplicates[i];
    const index = i + 1;

    console.log(`  [${index}/${total}] assessmentTrackingId : ${row.assessmentTrackingId}`);
    console.log(`          contentId            : ${row.contentId}`);

    // Call API to get assessmentType for this record's contentId
    const assessmentType = await getAssessmentType(row.contentId);
    console.log(`          API assessmentType   : ${assessmentType ?? '(not found)'}`);

    const entry = {
      assessmentTrackingId: row.assessmentTrackingId,
      contentId: row.contentId,
      userId: row.userId,
      createdOn: row.createdOn,
      rn: row.rn,
      apiAssessmentType: assessmentType,
      action: null,
    };

    if (assessmentType !== TARGET_ASSES_TYPE) {
      // Type does not match — skip
      console.log(`          ⏭  Skipped — type is '${assessmentType ?? 'null'}', not '${TARGET_ASSES_TYPE}'\n`);
      entry.action = 'skipped';
      skippedCount++;
    } else {
      // Type matches — delete this record
      // try {
      //   const rowCount = await deleteOne(client, row.assessmentTrackingId);
      //   console.log(`          ✅ Deleted (${rowCount} row removed)\n`);
      //   entry.action = 'deleted';
      //   deletedCount++;
      // } catch (err) {
      //   console.error(`          ❌ DELETE failed — ${err.message}\n`);
      //   entry.action = 'error';
      //   failedCount++;
      // }
    }

    processLog.push(entry);
  }

  await client.end();

  // ── Write log ─────────────────────────────────────────────────────────────────
  const finishedAt = new Date().toISOString();
  const logObj = {
    script: 'delete-assessment-tracking-source-duplicates.js',
    tenantId: TENANT_ID,
    targetAssessmentType: TARGET_ASSES_TYPE,
    apiUsed: `${HIERARCHY_API_BASE}/{contentId}`,
    startedAt,
    finishedAt,
    totalDuplicatesFound: allDuplicates.length,
    deleted: deletedCount,
    skipped: skippedCount,
    failed: failedCount,
    records: processLog,
  };
  const logPath = writeLog(logObj);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`${'='.repeat(65)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(65)}`);
  console.log(`  Total duplicate rows  : ${total}`);
  console.log(`  Deleted               : ${deletedCount}`);
  console.log(`  Skipped               : ${skippedCount}  (non-matching type)`);
  console.log(`  Failed                : ${failedCount}`);
  console.log(`  Log written to        : ${logPath}`);
  console.log(`${'='.repeat(65)}\n`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
