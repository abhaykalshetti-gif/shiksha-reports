const { Client } = require('pg');
const dbConfig = require('./db');

/**
 * Field ID for "UserInterestedToJoin" in the source FieldValues table.
 */
const INTERESTED_TO_JOIN_FIELD_ID = 'e6fc5315-61d6-4c7a-88bd-077b8716231b';

const TENANT_ID = 'fd8f3180-9988-495b-8a0d-ed201d7d28df';

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

        const userIds = [];
        const values = [];
        let skipped = 0;

        for (const row of sourceResult.rows) {
            const userId = row.userId;

            // Extract the scalar value from the array/text stored in FieldValues
            let rawValue = row.value;
            if (Array.isArray(rawValue)) {
                rawValue = rawValue.length > 0 ? rawValue[0] : null;
            }
            if (!rawValue) {
                skipped++;
                continue;
            }

            userIds.push(userId);
            values.push(rawValue);
        }

        let updated = 0;
        if (userIds.length > 0) {
            // Bulk update using UNNEST to avoid N+1 query overhead
            const updateQuery = `
                UPDATE public."Users" AS u
                SET "C2CUserSubProgram" = vals.val
                FROM (
                    SELECT unnest($1::uuid[]) AS user_id, unnest($2::varchar[]) AS val
                ) AS vals
                WHERE u."UserID" = vals.user_id
            `;
            const result = await destClient.query(updateQuery, [userIds, values]);
            updated = result.rowCount;
            skipped += (userIds.length - updated);
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