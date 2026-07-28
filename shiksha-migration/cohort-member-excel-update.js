const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading cohort-member-excel-update.js ===');

const TENANT_ID = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
const API_BASE_URL = 'http://localhost:3001';
const BEARER_TOKEN = process.env.BEARER_TOKEN;

// ─── CSV FILE PATH (update this before running) ─────────────────────────────────
// REF_SHEET_PATH — CSV with members to PROTECT (userId, cohortId columns)
// For each userId in this CSV, all OTHER cohort memberships will be updated via API.
const REF_SHEET_PATH = path.resolve(__dirname, './ref-sheet.csv');

// ─── HELPERS ─────────────────────────────────────────────────────────────────────

/**
 * Build a composite key from userId and cohortId for fast lookup.
 */
function makeKey(userId, cohortId) {
  return `${String(userId).trim().toLowerCase()}::${String(cohortId).trim().toLowerCase()}`;
}

/**
 * Read a CSV file and extract userId + cohortId.
 * Columns must be named exactly: userId, cohortId
 *
 * @param {string} filePath - Absolute or relative path to the .csv file
 * @returns {Array<{userId: string, cohortId: string}>}
 */
function readCsvMembers(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  // Parse header row to detect column positions
  const headers = lines[0].split(',').map((h) => h.trim());

  const userIdCol = headers.indexOf('userId');
  const cohortIdCol = headers.indexOf('cohortId');

  if (userIdCol === -1) {
    throw new Error(`Could not find "userId" column in header of: ${filePath}`);
  }
  if (cohortIdCol === -1) {
    throw new Error(`Could not find "cohortId" column in header of: ${filePath}`);
  }

  const members = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const userId = cols[userIdCol];
    const cohortId = cols[cohortIdCol];

    if (userId && cohortId) {
      members.push({ userId, cohortId });
    }
  }

  return members;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────────

async function updateCohortMembersFromExcel() {
  console.log('=== STARTING COHORT MEMBER UPDATE ===');

  if (!BEARER_TOKEN) {
    console.error('[ERROR] BEARER_TOKEN is not set in .env');
    process.exit(1);
  }

  console.log(`[CONFIG] API Base URL : ${API_BASE_URL}`);
  console.log(`[CONFIG] Tenant ID    : ${TENANT_ID}`);
  console.log(`[CONFIG] Ref file     : ${REF_SHEET_PATH}`);

  // ── 1. Read ref CSV ──
  console.log('\n[STEP 1] Reading ref CSV...');

  const refMembers = readCsvMembers(REF_SHEET_PATH);
  console.log(`  Ref CSV: ${refMembers.length} entries`);

  // ── 2. Connect to DB ──
  const dbclient = new Client(dbConfig.source);

  try {
    await dbclient.connect();
    console.log('  Connected to database');

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // ── 3. Loop through each ref entry ──
    console.log('\n[STEP 2] Processing each ref entry...');

    for (let i = 0; i < refMembers.length; i++) {
      const refEntry = refMembers[i];
      const { userId, cohortId: protectedCohortId } = refEntry;

      console.log(`\n  [${i + 1}/${refMembers.length}] userId=${userId}, protected cohortId=${protectedCohortId}`);

      // Fetch all cohort memberships for this userId from DB
      const query = `
        SELECT
          cm."cohortMembershipId",
          cm."userId",
          cm."cohortId"
        FROM public."CohortMembers" cm
        WHERE cm."userId" = $1
      `;

      const dbResult = await dbclient.query(query, [userId]);
      const userMembers = dbResult.rows;

      console.log(`    Found ${userMembers.length} cohort memberships in DB`);

      // Nested loop: for each membership, skip if cohortId matches ref, otherwise update
      for (const member of userMembers) {
        // If this member's cohortId matches the protected cohortId from ref sheet → skip
        if (member.cohortId === protectedCohortId) {
          totalSkipped++;
          console.log(`    SKIP cohortId=${member.cohortId} (protected)`);
          continue;
        }

        // Otherwise → update via API
        try {
          await axios.put(
            `${API_BASE_URL}/user/v1/cohortmember/update/${member.cohortMembershipId}`,
            {
              status: 'archived',
              statusReason: 'Incorrect Data Entry'
            },
            {
              headers: {
                'accept': '*/*',
                'tenantid': TENANT_ID,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BEARER_TOKEN}`,
              },
            }
          );

          totalUpdated++;
          console.log(`    UPDATED cohortMemberId=${member.cohortMembershipId}, cohortId=${member.cohortId}`);
        } catch (error) {
          totalFailed++;
          console.error(
            `    FAILED cohortId=${member.cohortId} — ${error.response?.data?.message || error.response?.data || error.message}`
          );
        }
      }
    }

    // ── 4. Summary ──
    console.log('\n=== UPDATE SUMMARY ===');
    console.log({
      totalRefEntries: refMembers.length,
      totalUpdated,
      totalSkipped,
      totalFailed,
    });

    console.log('[COHORT MEMBER UPDATE] Completed successfully');

  } catch (err) {
    console.error('[CRITICAL ERROR]', err.response?.data || err.message);
  } finally {
    await dbclient.end();
    console.log('  Disconnected from database');
  }
}

// ─── RUN ─────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('Running cohort-member-excel-update.js directly');
  updateCohortMembersFromExcel().catch((err) => {
    console.error('Migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = updateCohortMembersFromExcel;
