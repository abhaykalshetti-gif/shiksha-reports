const { Client } = require('pg');
const dbConfig = require('./db');

console.log('=== Loading content-tracking-userid-migration.js ===');

// eid priority: higher number = more advanced state
const EID_PRIORITY = {
  'START': 1,
  'END': 2,
};
function getEidPriority(eid) {
  return EID_PRIORITY[eid] ?? 0;
}

// Fill in paired arrays of the same length.
//   DEST_USER_IDS[i]  <->  SOURCE_USER_IDS[i]
//
// For each pair (destUserId, sourceUserId):
//
//   OPERATION 1:
//     Fetch all content_tracking rows for destUserId,
//     LEFT JOIN content_tracking_details to get max progress per contentId.
//
//   OPERATION 2: For each entry's contentId:
//     a) sourceUser has NO record for that contentId
//          → UPDATE content_tracking.userId        = sourceUserId
//          → UPDATE content_tracking_details.userId = sourceUserId  (all rows via contentTrackingId)
//
//     b) sourceUser ALREADY has a record for that contentId
//          → Compare max progress (dest vs source from content_tracking_details)
//          → dest progress > source progress  : SKIP (source owns its record)
//          → else                             : SKIP
const DEST_USER_IDS = [
  '5dd8280a-8cba-45b0-a0e8-214066e748cf',
  '44c629bd-f0c4-40a6-b6dd-e44dd391cb2b',
  '6e485afd-b4fc-410f-bec1-50828281d462',
  'c3bd0251-6998-451f-9f5d-5636bff8105e',
  '034c2cb6-fd76-477f-a331-79e6799960ad',
  'c6a1f4ef-8a4e-4afd-bc8e-e26a42e41c7b',
  'def41aae-d199-41d3-85a9-ee753fa31c5e',
  '319a3829-2d03-4344-9c00-e042e789a8cd',
  '8b6d49ce-a9e0-4f74-a7c0-c374a386a7f2',
  '5399511c-6f83-4d53-b4d9-a409f01f061e',
  'f440ff4c-c94a-4bf6-aa6a-798d14876d9d',
  '6447dec6-f637-4c73-9ae8-d586f753b3ff',
  '8a69e9b2-5c6f-4a9e-9a70-6812f73820d0',
  '70a9d401-a8b5-4f43-8ee4-6f2ca1fa6583',
  '9f891975-0225-40bd-9b91-3294db8bdefa',
  'c645534a-8fb5-4f6e-9cd3-f2fd314e6367',
  'b047b91f-61dc-4f23-b30a-b9fae10532dd',
  'd84756e1-27a7-4728-ad0a-1ce95655a165',
  '1d7f79d3-522f-433b-b099-f68fd55cbcdc',
  'ea713b80-d37b-4587-b349-672c7f4540db',
  'e2af06c0-13f4-4377-af59-070e6dd47cf1',
  '052b5559-6081-419f-858d-2fdcba1d03ce',
  '61ed28f4-3e85-45a0-be69-5b0936bd8383',
  'be911769-6303-411f-b3b9-ec89b042e588',
  '167e58cf-242b-48c5-993b-f512bdc306bf',
  '358d8cdd-7ea3-4117-8b48-3863aaa854cd',
  '10ae0727-4afb-455d-8b40-e4ab4f33e6c1',
  '6f8c746a-f818-44f3-aff6-53e654e06f74',
  'b8553f46-dceb-4a42-bdae-69a5e90101bf',
  '5e44f26d-1be2-4479-88b9-f647178f3cde',
  '6460494c-1f31-481d-a293-2d4a03604384',
  'e3f8be8d-21be-4fe5-bb03-c072af93d224',
  '0f8ab549-1264-4d89-9e26-c92b2ae2e6ee',
  '50e7f1cd-c53a-4dbd-9bee-23fee6e84c56',
  '281760ec-1f0a-4f0f-9fe4-1d7a78bf16f6',
  '63dc9090-a431-4dfe-933c-374f14e336d3',
  '4e8a47df-aec5-4a43-952f-d1c7736d1301',
  '146562c4-76b8-4b22-80b2-e10317abe9db',
  // 'f20471f2-3ff2-41da-b2a3-1d9e8f86d5da',
  '31ec30f5-fca5-4df0-ba79-322aea86c8d6',
  '5be3318c-ae0b-4a5c-8e1e-d21fdaa61fb2',
  'c2d4fe11-7592-47c2-a939-c7c6af6a49d4',
  '0e6f2446-ad62-47d9-b61e-8fe5bac7e4c2',

];

const SOURCE_USER_IDS = [
  '371ffefc-36f7-4eef-ad69-a2399ddca348',
  '4e3b4126-8b8f-4cd4-bfda-1b04a625300e',
  'a38eeca1-6265-413c-b88e-d592e760b021',
  'dff5a494-60d1-4e34-bb51-53fb5cb49b37',
  'f066d5e0-ecdf-4247-808e-021da0a111a4',
  'dfcf39f3-bb1b-4d41-a263-01cce80bb24c',
  '2ed25268-d435-4dd1-bb28-8151870ac181',
  '8f19d53b-bc49-4d50-a70a-7ae9005ed950',
  'c4dbed8b-45ba-4fb0-a3c0-65e2103b4bcb',
  '8f90eb08-ee3b-43d0-9085-4b31117b5c9a',
  'e4a70393-bc8e-43d2-9eb9-3f77abc99314',
  'a590bf50-6aad-481f-8f83-702434259a75',
  'b2a2ce27-12a0-45b1-bad0-31d6e34bacdb',
  '13275da3-ddc7-4cfa-b58b-709f9a4d1a7b',
  '0d35f664-5a2d-462f-bc33-9680639b5449',
  '642b0dbe-9b0c-46b9-a5b1-58a77ebe939c',
  '2a574c66-5505-4bf3-b839-3ef1f9bcb911',
  'be2e9ec2-b610-4a14-bd62-553e5466e34f',
  'fc127317-0a72-480f-a5f0-8b06c6cb0c27',
  'bb44f2a9-6f0f-433e-80fa-d9a59191b0c6',
  '65e6030f-3527-4e2b-9c33-b3909726a59e',
  '48d9bc40-0a3b-4c70-a803-9e36e97e19bc',
  '0a368b23-5a21-4e76-88a2-ecd1389f7a47',
  '0ecaef07-a534-4ff5-8192-ee463abf948d',
  '838dd6d7-d8b2-4256-b035-5aa7792a01e6',
  '8b33ac4b-449f-4728-87f6-d6096fda34cc',
  '0c515b3b-7fbb-400d-9989-29683eb4a9bb',
  '67c76358-b931-4dde-960a-6855de8a23d1',
  'c86deab5-5e2f-4aa7-ad09-308fa764cec8',
  'e1520fc1-1cd1-46f5-8829-bdc9d4206e9e',
  '1cfb4a69-b5ce-46ee-8f93-9992667658b2',
  '0a964b08-f0c8-4562-907b-d223fc289651',
  'fc43f940-be2c-4a17-a687-2f1ad5debc7c',
  'f1e0f67a-807f-4e4d-bb80-0ad8515e1ae6',
  'c97dd36d-db54-49c0-9ffc-6672f00a5835',
  'edee8781-fb80-49a4-8534-d41f5dff945f',
  '3d406b10-dacf-4822-b7ed-dbb12a44c639',
  '8560b566-3c1c-4f00-a2e6-f507f067afc5',
  // '4eaf3a87-00fb-4612-a866-121e57e471c7',
  '36e2b6e8-63f6-44fe-a7e9-54d94b7e2374',
  'be258d95-1196-4678-a6c3-7e407f30360f',
  'f476bd64-7a79-4653-885a-66f6789b5025',
  '967b4ad5-6e96-447e-b8b5-39e59ebb9051',

];

async function migrateContentTrackingUserIds() {
  if (DEST_USER_IDS.length === 0 || SOURCE_USER_IDS.length === 0) {
    console.error('[MIGRATION] ❌ DEST_USER_IDS and SOURCE_USER_IDS must not be empty.');
    process.exit(1);
  }
  if (DEST_USER_IDS.length !== SOURCE_USER_IDS.length) {
    console.error(`[MIGRATION] ❌ Array length mismatch: DEST(${DEST_USER_IDS.length}) vs SOURCE(${SOURCE_USER_IDS.length}). Must be equal.`);
    process.exit(1);
  }

  console.log('=== STARTING CONTENT TRACKING USERID MIGRATION ===');
  console.log(`[MIGRATION] Total pairs to process: ${DEST_USER_IDS.length}`);

  const client = new Client(dbConfig.source);

  let totalPairs = DEST_USER_IDS.length;
  let pairsProcessed = 0;
  let totalUpdated = 0;   // contentId had no source record → both tables updated
  let totalSkipped = 0;   // sourceUser already had a record for this contentId
  let totalNoEntries = 0;

  try {
    await client.connect();
    console.log('[MIGRATION] Connected to database\n');
    console.log('═'.repeat(80));

    for (let i = 0; i < DEST_USER_IDS.length; i++) {
      const destUserId = DEST_USER_IDS[i];
      const sourceUserId = SOURCE_USER_IDS[i];

      console.log(`\n[PAIR ${i + 1}/${totalPairs}]`);
      console.log(`  Dest   userId (current in DB)  : ${destUserId}`);
      console.log(`  Source userId (to replace with) : ${sourceUserId}`);
      console.log('─'.repeat(80));

      // ── OPERATION 1: Fetch destUser's content_tracking rows
      //    JOIN content_tracking_details to get eid (status)
      const destEntries = await client.query(
        `SELECT
           ct."contentTrackingId",
           ct."contentId",
           ctd.eid
         FROM public.content_tracking ct
         LEFT JOIN public.content_tracking_details ctd
           ON ct."contentTrackingId" = ctd."contentTrackingId"
         WHERE ct."userId" = $1`,
        [destUserId]
      );

      if (destEntries.rows.length === 0) {
        console.warn(`  ⚠️  No content_tracking entries found for destUserId. Skipping this pair.`);
        totalNoEntries++;
        pairsProcessed++;
        console.log('═'.repeat(80));
        continue;
      }

      console.log(`  Found ${destEntries.rows.length} content_tracking entry(ies) for destUserId.`);

      let pairUpdated = 0;
      let pairSkipped = 0;

      for (const entry of destEntries.rows) {
        const contentTrackingId = entry.contentTrackingId;
        const contentId = entry.contentId;
        const destEid = entry.eid;

        console.log(`\n  ┌─ contentTrackingId : ${contentTrackingId}`);
        console.log(`  │  contentId          : ${contentId}`);
        console.log(`  │  destUser eid       : ${destEid}`);

        // ── OPERATION 2: Check if sourceUser already has a record for this contentId ──
        const sourceCheck = await client.query(
          `SELECT
             ct."contentTrackingId",
             ctd.eid
           FROM public.content_tracking ct
           LEFT JOIN public.content_tracking_details ctd
             ON ct."contentTrackingId" = ctd."contentTrackingId"
           WHERE ct."userId" = $1 AND ct."contentId" = $2
           GROUP BY ct."contentTrackingId", ctd.eid`,
          [sourceUserId, contentId]
        );

        if (sourceCheck.rows.length > 0) {
          const sourceEids = sourceCheck.rows.map(r => r.eid);

          // If source already has both START and END → skip upgrade entirely
          if (!sourceEids.includes('START') || !sourceEids.includes('END')) {
            console.log(`  │  ⏭️  SKIP: sourceUser already has both START and END for this contentId.`);
            console.log(`  └${'─'.repeat(57)}`);
            pairSkipped++;
            totalSkipped++;
            continue;
          }

          // Iterate each source row and upgrade eid individually if dest is higher
          for (const sourceRow of sourceCheck.rows) {
            const sourceEid = sourceRow.eid;
            const sourceCtTrackerId = sourceRow.contentTrackingId;
            const destEidPriority = getEidPriority(destEid);
            const sourceEidPriority = getEidPriority(sourceEid);

            if (destEidPriority > sourceEidPriority) {
              // destUser has higher eid status → upgrade this sourceRow's eid
              const eidUpgrade = await client.query(
                `UPDATE public.content_tracking_details
                 SET eid = $1
                 WHERE "contentTrackingId" = $2`,
                [destEid, sourceCtTrackerId]
              );
              if (eidUpgrade.rowCount > 0) {
                console.log(`  └─ ⬆️  EID UPGRADED: ${sourceEid} → ${destEid} for contentTrackingId ${sourceCtTrackerId}`);
              } else {
                console.warn(`  └─ ⚠️  EID UPGRADE had no effect for contentTrackingId: ${sourceCtTrackerId}`);
              }
            } else {
              console.log(`  │  ⏭️  SKIP: sourceUser eid (${sourceEid}) is same or higher than destUser (${destEid}).`);
              console.log(`  └${'─'.repeat(57)}`);
            }
          }
          pairSkipped++;
          totalSkipped++;
          continue;
        }

        // sourceUser has NO record for this contentId
        // → UPDATE userId in content_tracking
        // → UPDATE userId in content_tracking_details (all rows via contentTrackingId)
        console.log(`  │  ✅ sourceUser has no record → updating userId in both tables.`);

        const updateTracking = await client.query(
          `UPDATE public.content_tracking
           SET "userId" = $1
           WHERE "contentTrackingId" = $2`,
          [sourceUserId, contentTrackingId]
        );

        const updateDetails = await client.query(
          `UPDATE public.content_tracking_details
           SET "userId" = $1
           WHERE "contentTrackingId" = $2`,
          [sourceUserId, contentTrackingId]
        );

        // if (updateTracking.rowCount > 0) {
        //   console.log(`  └─ 🔄 UPDATED: contentTrackingId ${contentTrackingId}`);
        //   console.log(`       content_tracking         : userId → ${sourceUserId}`);
        //   console.log(`       content_tracking_details : ${updateDetails.rowCount} row(s) updated`);
        //   pairUpdated++;
        //   totalUpdated++;
        // } else {
        //   console.warn(`  └─ ⚠️  UPDATE had no effect for contentTrackingId: ${contentTrackingId}`);
        // }
      }

      pairsProcessed++;
      console.log(`\n  [PAIR ${i + 1} RESULT] Updated: ${pairUpdated} | Skipped: ${pairSkipped}`);
      console.log('═'.repeat(80));
    }

    // ── Final Summary ────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     FINAL CONTENT TRACKING MIGRATION SUMMARY     ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Total pairs provided            : ${String(totalPairs).padEnd(10)} ║`);
    console.log(`║  Pairs processed                 : ${String(pairsProcessed).padEnd(10)} ║`);
    console.log(`║  Pairs with no dest entries      : ${String(totalNoEntries).padEnd(10)} ║`);
    console.log(`║  Rows updated (both tables)      : ${String(totalUpdated).padEnd(10)} ║`);
    console.log(`║  Rows skipped (source has record): ${String(totalSkipped).padEnd(10)} ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('=== MIGRATION COMPLETE ===');

  } catch (err) {
    console.error('[MIGRATION] Critical error:', err);
    throw err;
  } finally {
    await client.end();
    console.log('[MIGRATION] Disconnected from database');
  }
}

if (require.main === module) {
  console.log('Running content-tracking-userid-migration.js directly');
  migrateContentTrackingUserIds().catch((err) => {
    console.error('[MIGRATION] Migration failed with unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { migrateContentTrackingUserIds };
