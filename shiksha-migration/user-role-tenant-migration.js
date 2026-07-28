const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const ExcelJS = require('exceljs');
const dbConfig = require('./db');

console.log('=== Loading user-role-tenant-migration.js ===');

// ─── Config ───────────────────────────────────────────────────────────────────

// Path to the Excel file containing userIds (column header must be "userId")
const EXCEL_FILE_PATH = path.resolve(__dirname, './users-to-migrate.xlsx');

// The role name to remove (case-insensitive match against the Roles table)
const LEARNER_ROLE_NAME = 'Learner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read userIds from the first sheet of an Excel (.xlsx) file.
 * The first row must have a column header named exactly "userId".
 *
 * @param {string} filePath
 * @returns {Promise<string[]>}
 */
async function readUserIdsFromExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file has no worksheets.');
  }

  console.log(`  Reading sheet: "${worksheet.name}"`);

  // Find the "userId" column in the header row
  const headerRow = worksheet.getRow(1);
  let userIdColIndex = null;

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (String(cell.value || '').trim() === 'userId') {
      userIdColIndex = colNumber;
    }
  });

  if (userIdColIndex === null) {
    throw new Error('Could not find a column named "userId" in the first row of the sheet.');
  }

  console.log(`  "userId" column found at index: ${userIdColIndex}`);

  const userIds = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const cellValue = row.getCell(userIdColIndex).value;
    const userId = cellValue != null ? String(cellValue).trim() : '';

    if (userId) {
      userIds.push(userId);
    }
  });

  return userIds;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrateUserRoleAndTenantStatus() {
  console.log('=== STARTING USER ROLE + TENANT STATUS MIGRATION ===');

  console.log(`[CONFIG] Excel file : ${EXCEL_FILE_PATH}`);
  console.log(`[CONFIG] Role to remove: ${LEARNER_ROLE_NAME}`);

  // ── 1. Read userIds from Excel ──
  console.log('\n[STEP 1] Reading Excel file...');

  const userIds = await readUserIdsFromExcel(EXCEL_FILE_PATH);
  console.log(`  Excel: ${userIds.length} userId(s) loaded`);

  // ── 2. Connect to DB ──
  const dbclient = new Client(dbConfig.source);

  try {
    await dbclient.connect();
    console.log('  Connected to database');

    let totalRoleDeleted = 0;
    let totalTenantActivated = 0;
    let totalFailed = 0;

    // ── 3. Loop through each userId ──
    console.log('\n[STEP 2] Processing each userId...');

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      console.log(`\n  [${i + 1}/${userIds.length}] userId=${userId}`);

      try {
        // ── Operation 1: Delete Learner role mapping ──
        const roleResult = await dbclient.query(
          `DELETE FROM public."UserRolesMapping"
           WHERE "userId" = $1::uuid
             AND "roleId" = 'eea7ddab-bdf9-4db1-a1bb-43ef503d65ef'
             AND "tenantId" = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3'`,
          [userId]
        );
        const roleRowsDeleted = roleResult.rowCount;
        totalRoleDeleted += roleRowsDeleted;
        console.log(`    OP1 — Learner role mapping deleted: ${roleRowsDeleted} row(s)`);

        // ── Operation 2: Reactivate UserTenantMapping (archived → active) ──
        const tenantResult = await dbclient.query(
          `UPDATE public."UserTenantMapping"
           SET status = 'active'
           WHERE "userId" = $1::uuid
             AND "tenantId" = 'ef99949b-7f3a-4a5f-806a-e67e683e38f3'`,
          [userId]
        );
        const tenantRowsUpdated = tenantResult.rowCount;
        totalTenantActivated += tenantRowsUpdated;
        console.log(`    OP2 — UserTenantMapping activated: ${tenantRowsUpdated} row(s)`);

      } catch (error) {
        totalFailed++;
        console.error(
          `    FAILED userId=${userId} — ${error.message}`
        );
      }
    }

    // ── 4. Summary ──
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log({
      totalUsersInExcel: userIds.length,
      totalRoleDeleted,
      totalTenantActivated,
      totalFailed,
    });

    console.log('[USER ROLE + TENANT MIGRATION] Completed successfully');

  } catch (err) {
    console.error('[CRITICAL ERROR]', err.message);
  } finally {
    await dbclient.end();
    console.log('  Disconnected from database');
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('Running user-role-tenant-migration.js directly');
  migrateUserRoleAndTenantStatus().catch((err) => {
    console.error('Migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = migrateUserRoleAndTenantStatus;
