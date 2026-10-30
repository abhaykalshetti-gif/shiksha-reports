const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading fix-duplicate-enrollmentId.js ===');

// Matches the DB trigger: 'PLP-' || LPAD(nextval(...)::TEXT, 7, '0')
function formatEnrollmentId(num) {
  return `PLP-${String(num).padStart(7, '0')}`;
}

// Draws the next ID from the same DB sequence the trigger uses
async function getNextEnrollmentId(client) {
  const res = await client.query(`SELECT nextval('public.enrollment_id_seq') AS "nextId"`);
  const seqVal = parseInt(res.rows[0].nextId, 10);
  return formatEnrollmentId(seqVal);
}

async function fixDuplicateEnrollmentIds() {
  console.log('\n=== STARTING DUPLICATE enrollmentId FIX ===\n');

  const client = new Client(dbConfig.source);

  try {
    await client.connect();
    console.log('[FIX-ENROLLMENT] Connected to source database');

    const duplicateQuery = `
  select u."userId", u."enrollmentId",u."createdAt"
  FROM public."Users" u
  WHERE u."enrollmentId" IN (
      SELECT "enrollmentId"
      FROM public."Users"
      WHERE "enrollmentId" IS NOT NULL
      GROUP BY "enrollmentId"
      HAVING COUNT(*) > 1
  )
  group by u."userId", u."enrollmentId",u."createdAt"
  ORDER BY u."createdAt"
      `;

    const duplicateResult = await client.query(duplicateQuery);
    console.log(`[FIX-ENROLLMENT] Found ${duplicateResult.rows.length} user-rows across all duplicate groups.\n`);

    if (duplicateResult.rows.length === 0) {
      console.log('[FIX-ENROLLMENT] No duplicates found. Nothing to do.');
      return;
    }

    const groups = new Map();
    for (const row of duplicateResult.rows) {
      if (!groups.has(row.enrollmentId)) groups.set(row.enrollmentId, []);
      groups.get(row.enrollmentId).push(row);
    }

    console.log(`[FIX-ENROLLMENT] Duplicate enrollmentId groups found: ${groups.size}`);
    console.log(`[FIX-ENROLLMENT] New IDs will be drawn from DB sequence: public.enrollment_id_seq\n`);
    // return true;
    const auditLog = [];
    const failedLog = [];

    for (const [enrollmentId, rows] of groups) {
      const keeper = rows[0];
      const toUpdate = rows.slice(1);

      console.log(`\n--- Group: ${enrollmentId}  (${rows.length} users) ---`);
      console.log(`  KEEP     userId=${keeper.userId}  createdAt=${keeper.createdAt}`);



      for (const user of toUpdate) {
        let newEnrollmentId = null;

        try {
          newEnrollmentId = await getNextEnrollmentId(client);

          console.log(`  UPDATING userId=${user.userId}  ${enrollmentId} -> ${newEnrollmentId}`);

          const updateResult = await client.query(
            `UPDATE public."Users"
               SET "enrollmentId" = $1
               WHERE "userId" = $2`,
            [newEnrollmentId, user.userId]
          );

          if (updateResult.rowCount !== 1) {
            throw new Error(`Expected rowCount=1 but got ${updateResult.rowCount}`);
          }

          console.log(`    [OK] userId=${user.userId}  newEnrollmentId=${newEnrollmentId}`);

          auditLog.push({
            userId: user.userId,
            oldEnrollmentId: enrollmentId,
            newEnrollmentId,
          });

        } catch (err) {
          console.error(`    [FAILED] userId=${user.userId}: ${err.message} — skipping...`);

          failedLog.push({
            userId: user.userId,
            oldEnrollmentId: enrollmentId,
            assignedId: newEnrollmentId, // null if the failure happened before an ID was drawn
            error: err.message,
          });
        }
      }
    }

    // ----------------------------------------------------------------
    // Step 5 - Audit summary
    // ----------------------------------------------------------------
    console.log('\n==============================');
    console.log(' AUDIT SUMMARY');
    console.log('==============================');
    console.log(`Total processed  : ${auditLog.length + failedLog.length}`);
    console.log(`Successful       : ${auditLog.length}`);
    console.log(`Failed / skipped : ${failedLog.length}`);
    console.log(`Next available ID: (driven by public.enrollment_id_seq)\n`);
    if (auditLog.length > 0) {
      console.log('--- SUCCESSFUL REASSIGNMENTS ---');
      console.log('userId                               | oldEnrollmentId | newEnrollmentId');
      console.log('-------------------------------------|-----------------|----------------');
      for (const e of auditLog) {
        console.log(
          `${String(e.userId).padEnd(36)} | ${String(e.oldEnrollmentId).padEnd(15)} | ${e.newEnrollmentId}`
        );
      }
    }

    if (failedLog.length > 0) {
      console.log('\n--- FAILED REASSIGNMENTS ---');
      console.log('userId                               | oldEnrollmentId | assignedId (not applied) | error');
      console.log('-------------------------------------|-----------------|--------------------------|------');
      for (const e of failedLog) {
        console.log(
          `${String(e.userId).padEnd(36)} | ${String(e.oldEnrollmentId).padEnd(15)} | ${String(e.assignedId).padEnd(24)} | ${e.error}`
        );
      }
    }

    // ----------------------------------------------------------------
    // Step 6 - Post-fix verification: confirm zero duplicates remain
    // ----------------------------------------------------------------
    console.log('\n[FIX-ENROLLMENT] Running post-fix duplicate check...');
    const verifyResult = await client.query(`
        SELECT "enrollmentId", COUNT(*) AS cnt
        FROM public."Users"
        WHERE "enrollmentId" IS NOT NULL
        GROUP BY "enrollmentId"
        HAVING COUNT(*) > 1
      `);

    if (verifyResult.rows.length === 0) {
      console.log('[FIX-ENROLLMENT] ✅ Verification passed — zero duplicate enrollmentIds remain.');
    } else {
      console.warn(`[FIX-ENROLLMENT] ⚠️   WARNING: ${verifyResult.rows.length} duplicate(s) still found after fix:`);
      console.warn(verifyResult.rows);
    }

    console.log('\n=== fix-duplicate-enrollmentId.js COMPLETED ===\n');


  } catch (err) {
    console.error('\n[FIX-ENROLLMENT] Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('[FIX-ENROLLMENT] Disconnected from database.');
  }
}

if (require.main === module) {
  console.log('Running fix-duplicate-enrollmentId.js directly');
  fixDuplicateEnrollmentIds().catch((err) => {
    console.error('fixDuplicateEnrollmentIds failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { fixDuplicateEnrollmentIds };