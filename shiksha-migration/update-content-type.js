const { Client } = require('pg');
const axios = require('axios');
const dbConfig = require('./db');

const CONTENT_READ_BASE_URL =
    process.env.CONTENT_READ_BASE_URL ||
    'https://interface.prathamdigital.org/interface/v1/api/content/v1/read';

const DELAY_BETWEEN_RECORDS_MS = parseInt(process.env.DELAY_BETWEEN_RECORDS_MS || '200', 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Read Content API ────────────────────────────────────────────────────────

async function readContentType(identifier) {
    const url =
        `${CONTENT_READ_BASE_URL}/${identifier}` +
        `?fields=description,name,appIcon,posterImage,artifactUrl,mimeType,contentLanguage,program` +
        `&mode=edit` +
        `&licenseDetails=name,description,url`;

    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ5TGlWakRTOGFrd1JkOTI4aTJnbXluNG9Na1ZkdERpcXk0V3NaNHZLeHF3In0.eyJleHAiOjE3ODkxODYzODYsImlhdCI6MTc4OTA5OTk4NiwianRpIjoiZDBjZTFiOTYtNDJjMS00ZjdjLWI1OWMtNTI2NDhiMmM1ODcyIiwiaXNzIjoiaHR0cHM6Ly9rZXljbG9hay1wcm9kLnByYXRoYW1kaWdpdGFsLm9yZy9hdXRoL3JlYWxtcy9wcmF0aGFtIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjJlN2M3YTY2LWU4NjktNDdmNy1hMDc3LWRmOWE1OGFiM2ZmMSIsInR5cCI6IkJlYXJlciIsImF6cCI6InByYXRoYW0iLCJzZXNzaW9uX3N0YXRlIjoiZGM5MjdkZWYtM2U3NC00M2E5LTgyOTMtMjdkMDJkNjczZDBlIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIvKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtcHJhdGhhbSJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCBwcmF0aGFtLXJvbGUiLCJzaWQiOiJkYzkyN2RlZi0zZTc0LTQzYTktODI5My0yN2QwMmQ2NzNkMGUiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsIm5hbWUiOiJBZGl0eWEgVGVrZGkiLCJ1c2VyX3JvbGVzIjoiQ2VudHJhbCBMZWFkIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYXRhd2FyZTM3QHByYXRoYW0ub3JnIiwiZ2l2ZW5fbmFtZSI6IkFkaXR5YSIsImZhbWlseV9uYW1lIjoiVGVrZGkiLCJlbWFpbCI6ImF0YXdhcmUzN0BwcmF0aGFtLm9yZyJ9.UqWkPQuVWHFNG2V3tu0ZWj1MF6JNI1Q2dGjlxdTy828-Ok3NVT-Brtak6gvfItKbP5oPKna6ZSt7HPMnBZSqv4ee1E7eRNMnaxQI_fxBO_XB2Vp2-PqnyGflUck5AZUYxxD01Z_0S3DZMvuY-C_U16UkdCc4NL0w_Atrw6758M21OEgNj7ObrCPEH3vm1UaHRXUGlm8VoqLgN1mGVzOPoWu4eggV-7auSYbtSlpekJZFOcrwhq3bxMUuKLve8iGanyflzmEHz6lPZEoGb2Yb_AlJo63NgfsCYM5YMYWdVSQHten_TzfxTOgsUKp49VJjAqRbxU0xcHW8lzDGZoT90w',
        'sec-fetch-mode': 'cors',
    };

    try {
        const res = await axios.get(url, { headers, timeout: 10000 });
        const content = res?.data?.result?.content;
        if (!content) {
            console.warn(`[UPDATE-CONTENT-TYPE] ⚠️  No content in API response for: ${identifier}`);
            return null;
        }
        return content.mimeType || null;
    } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
            console.warn(`[UPDATE-CONTENT-TYPE] ⚠️  Content not found (404) for: ${identifier}`);
        } else {
            console.error(
                `[UPDATE-CONTENT-TYPE] ❌ API error for ${identifier}: ${err.message}`
            );
        }
        return null;
    }
}

// ─── Update Query ─────────────────────────────────────────────────────────────

async function updateContentType(client, identifier, newContentType) {
    const updateQuery = `
      UPDATE public."Content"
      SET    "contentType" = $1
      WHERE  "identifier"  = $2
    `;
    const result = await client.query(updateQuery, [newContentType, identifier]);
    return result.rowCount;
}

// ─── Main Migration ───────────────────────────────────────────────────────────

async function migrateContentType() {
    console.log('=== STARTING update-content-type MIGRATION ===');

    const destClient = new Client(dbConfig.destination);

    try {
        await destClient.connect();
        console.log('[UPDATE-CONTENT-TYPE] Connected to destination database');

        // Step 1: Fetch all content rows
        const fetchQuery = `SELECT c.identifier, c."contentType" FROM public."Content" AS c
                       WHERE c."contentType" = 'Resource'`;
        const { rows } = await destClient.query(fetchQuery);

        console.log(`[UPDATE-CONTENT-TYPE] Found ${rows.length} content records to process`);

        if (rows.length === 0) {
            console.log('[UPDATE-CONTENT-TYPE] Nothing to process. Exiting.');
            return;
        }

        let updated = 0;
        let skipped = 0;
        let apiError = 0;
        let noChange = 0;

        // Step 2 & 3: Process one by one
        for (let i = 0; i < rows.length; i++) {
            const { identifier, contentType: dbContentType } = rows[i];

            console.log(
                `[UPDATE-CONTENT-TYPE] [${i + 1}/${rows.length}] Processing identifier: ${identifier} (current contentType: ${dbContentType})`
            );

            // Call Read Content API
            const apiContentType = await readContentType(identifier);

            if (apiContentType === null) {
                console.warn(
                    `[UPDATE-CONTENT-TYPE]   ↳ Skipping — could not fetch contentType from API`
                );
                apiError++;
                await delay(DELAY_BETWEEN_RECORDS_MS);
                continue;
            }

            // Step 4: Update only if value differs
            if (apiContentType === dbContentType) {
                console.log(
                    `[UPDATE-CONTENT-TYPE]   ↳ No change needed (contentType: ${apiContentType})`
                );
                noChange++;
            } else {
                console.log(
                    `[UPDATE-CONTENT-TYPE]   ↳ Updating contentType: "${dbContentType}" → "${apiContentType}"`
                );
                try {
                    const rowCount = await updateContentType(destClient, identifier, apiContentType);
                    if (rowCount > 0) {
                        console.log(`[UPDATE-CONTENT-TYPE]   ✅ Updated successfully`);
                        updated++;
                    } else {
                        console.warn(`[UPDATE-CONTENT-TYPE]   ⚠️  Update matched 0 rows — identifier may not exist`);
                        skipped++;
                    }
                } catch (err) {
                    console.error(
                        `[UPDATE-CONTENT-TYPE]   ❌ DB update error for ${identifier}: ${err.message}`
                    );
                    skipped++;
                }
            }

            // Small delay to avoid hammering the API
            await delay(DELAY_BETWEEN_RECORDS_MS);
        }

        // Summary
        console.log('\n=== SUMMARY ===');
        console.log(`  Total records   : ${rows.length}`);
        console.log(`  Updated         : ${updated}`);
        console.log(`  No change       : ${noChange}`);
        console.log(`  API errors      : ${apiError}`);
        console.log(`  DB skipped/err  : ${skipped}`);
    } catch (err) {
        console.error('[UPDATE-CONTENT-TYPE] ❌ Fatal error:', err.message);
        throw err;
    } finally {
        await destClient.end();
        console.log('[UPDATE-CONTENT-TYPE] Disconnected from destination database');
    }

    console.log('=== COMPLETED update-content-type MIGRATION ===');
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

if (require.main === module) {
    migrateContentType().catch((err) => {
        console.error('Script failed:', err);
        process.exit(1);
    });
}

module.exports = { migrateContentType };
