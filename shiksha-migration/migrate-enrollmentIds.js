/**
 * migrate-enrollmentIds.js
 *
 * Reads every userId + enrollmentId from the SOURCE DB (public."Users")
 * and updates the matching row in the DEST DB (public."Users") with that
 * enrollmentId — touching nothing else.
 *
 * Run:  node migrate-enrollmentIds.js
 */

require('dotenv').config();
const { Client } = require('pg');
const dbConfig = require('./db');

async function migrateEnrollmentIds() {
  console.log('\n=== STARTING enrollmentId Migration (source → dest) ===\n');

  const sourceClient = new Client(dbConfig.source);
  const destClient = new Client(dbConfig.destination);

  try {
    // ── Connect ──────────────────────────────────────────────────────────
    await sourceClient.connect();
    console.log('[MIGRATE] Connected to SOURCE DB');

    await destClient.connect();
    console.log('[MIGRATE] Connected to DEST DB');

    // ── Fetch all non-null enrollmentIds from source ──────────────────────
    const { rows: sourceRows } = await sourceClient.query(`
      SELECT "userId", "enrollmentId"
      FROM public."Users"
      WHERE "enrollmentId" IS NOT NULL
    `);

    console.log(`[MIGRATE] Found ${sourceRows.length} users with enrollmentId in source DB\n`);

    if (sourceRows.length === 0) {
      console.log('[MIGRATE] Nothing to migrate. Exiting.');
      return;
    }



    // ── Update dest DB one row at a time ─────────────────────────────────
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const { userId, enrollmentId } of sourceRows) {
      try {
        const result = await destClient.query(
          `UPDATE public."Users"
              SET "UserEnrollmentNumber" = $1
            WHERE "UserID" = $2`,
          [enrollmentId, userId]
        );

        if (result.rowCount === 1) {
          updated++;
          console.log(`  [OK]      userId=${userId}  enrollmentId=${enrollmentId}`);
        } else {
          skipped++;
          console.warn(`  [SKIP]    userId=${userId}  — not found in dest DB`);
        }
      } catch (err) {
        failed++;
        console.error(`  [FAILED]  userId=${userId}  — ${err.message}`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n==============================');
    console.log(' MIGRATION SUMMARY');
    console.log('==============================');
    console.log(`Total in source  : ${sourceRows.length}`);
    console.log(`Updated in dest  : ${updated}`);
    console.log(`Skipped (no match): ${skipped}`);
    console.log(`Failed           : ${failed}`);
    console.log('\n=== Migration COMPLETE ===\n');

  } catch (err) {
    console.error('\n[MIGRATE] Fatal error:', err.message);
    process.exit(1);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[MIGRATE] Disconnected from both databases.');
  }
}

migrateEnrollmentIds().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
