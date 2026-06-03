const { Client } = require('pg');
const dbConfig = require('./db');

/**
 * Field ID for "UserInterestedToJoin" in the source FieldValues table.
 */
const INTERESTED_TO_JOIN_FIELD_ID = 'f8dc1d5f-9b2b-412e-a22a-351bd8f14963';

const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';

async function updateInterestedToJoin() {
  console.log('=== STARTING UserInterestedToJoin UPDATE ===');

  const sourceClient = new Client(dbConfig.source);
  const destClient = new Client(dbConfig.destination);

  try {
    await sourceClient.connect();
    console.log('[UPDATE] Connected to source database');

    await destClient.connect();
    console.log('[UPDATE] Connected to destination database');

    // Fetch all userIds + their InterestedToJoin value from source in one query
    const sourceQuery = `
      SELECT
        fv."itemId" as "userId",
        fv.value
      FROM  public."FieldValues" fv
      WHERE fv."fieldId" =$1
      AND fv."tenantId" =$2
        AND fv.value IS NOT NULL
    `;

    const sourceResult = await sourceClient.query(sourceQuery, [
      INTERESTED_TO_JOIN_FIELD_ID,
      TENANT_ID,
    ]);

    console.log(`[UPDATE] Found ${sourceResult.rows.length} users with a UserInterestedToJoin value.`);

    if (sourceResult.rows.length === 0) {
      console.log('[UPDATE] Nothing to update. Exiting.');
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const row of sourceResult.rows) {
      const userId = row.userId;

      // Extract the scalar value from the array/text stored in FieldValues
      let rawValue = row.value;
      if (Array.isArray(rawValue) && rawValue.length > 0) {
        rawValue = rawValue[0];
      }
      if (!rawValue) {
        skipped++;
        continue;
      }

      // Only UPDATE — never INSERT. Skip if user does not exist in destination.
      const updateQuery = `
        UPDATE public."Users"
        SET "UserInterestedToJoin" = $2
        WHERE "UserID" = $1
      `;

      const result = await destClient.query(updateQuery, [userId, rawValue]);

      if (result.rowCount > 0) {
        console.log(`[UPDATE] ✅ Updated UserID=${userId}  →  UserInterestedToJoin="${rawValue}"`);
        updated++;
      } else {
        console.log(`[UPDATE] ⚠️  Skipped UserID=${userId} — not found in destination DB`);
        skipped++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`  Total source records : ${sourceResult.rows.length}`);
    console.log(`  Updated              : ${updated}`);
    console.log(`  Skipped (not found)  : ${skipped}`);

  } catch (error) {
    console.error('[UPDATE] ❌ Error:', error.message);
  } finally {
    await sourceClient.end();
    console.log('[UPDATE] Disconnected from source database');

    await destClient.end();
    console.log('[UPDATE] Disconnected from destination database');
  }

  console.log('=== COMPLETED UserInterestedToJoin UPDATE ===');
}

updateInterestedToJoin().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
