const { Client } = require('pg');
const dbConfig = require('./db');

/**
 * Standalone migration script:
 * Updates ONLY the "UserPreferredModeOfLearning" column in the destination
 * Users table for all users, based on FieldValues in the source database.
 *
 * No inserts. No other columns touched.
 *
 * Run: node shiksha-migration/update-preferred-mode.js
 */

const PREFERRED_MODE_FIELD_ID = '7b43db0a-f4c3-4c77-919f-622509ca7add';

async function updatePreferredModeOfLearning() {
  console.log('=== STARTING UserPreferredModeOfLearning UPDATE ===');

  const sourceClient = new Client(dbConfig.source);
  const destClient = new Client(dbConfig.destination);

  try {
    await sourceClient.connect();
    console.log('[PREFERRED MODE] Connected to source database');

    await destClient.connect();
    console.log('[PREFERRED MODE] Connected to destination database');

    // Fetch the preferred mode value for every user from source FieldValues
    const result = await sourceClient.query(
      `SELECT fv."itemId" AS "userId", fv.value
       FROM public."FieldValues" fv
       WHERE fv."fieldId" = $1`,
      [PREFERRED_MODE_FIELD_ID]
    );

    console.log(`[PREFERRED MODE] Found ${result.rows.length} records to process`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const row of result.rows) {
      const { userId, value } = row;

      // Extract the string value (handle both plain string and array formats)
      let preferredMode = null;
      if (typeof value === 'string') {
        preferredMode = value.trim();
      } else if (Array.isArray(value) && value.length > 0) {
        preferredMode = String(value[0]).trim();
      }

      if (!preferredMode) {
        console.log(`[PREFERRED MODE] ⚠️  Skipping user ${userId} — no value`);
        skipCount++;
        continue;
      }

      try {
        const updateResult = await destClient.query(
          `UPDATE public."Users"
           SET "UserPreferredModeOfLearning" = $1
           WHERE "UserID" = $2`,
          [preferredMode, userId]
        );

        if (updateResult.rowCount > 0) {
          console.log(`[PREFERRED MODE] ✅ User ${userId} → "${preferredMode}"`);
          successCount++;
        } else {
          console.warn(`[PREFERRED MODE] ⚠️  User ${userId} not found in destination — skipped`);
          skipCount++;
        }
      } catch (err) {
        console.error(`[PREFERRED MODE] ❌ Failed for user ${userId}:`, err.message);
        failCount++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`  ✅ Updated : ${successCount}`);
    console.log(`  ⚠️  Skipped : ${skipCount}`);
    console.log(`  ❌ Failed  : ${failCount}`);
    console.log('================\n');
  } catch (error) {
    console.error('[PREFERRED MODE] Fatal error:', error);
    process.exit(1);
  } finally {
    await sourceClient.end();
    await destClient.end();
    console.log('[PREFERRED MODE] Disconnected from both databases');
  }

  console.log('=== COMPLETED UserPreferredModeOfLearning UPDATE ===');
}

updatePreferredModeOfLearning();
