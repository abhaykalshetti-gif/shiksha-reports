require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://lap.prathamdigital.org';
const LOGS_DIR = path.join(__dirname, 'logs');
const API_TIMEOUT = 30000;

// Full cookie string from the curl request
const COOKIE = '_ga=GA1.1.105300689.1787227514; AWSALB=E0ecvOZ7QzIUxEiTTG4FewMWfPpl4Qgzf6Xsq6eBhagwA5Sbmu/06mTA3v/Fwrmw8G3EKGFu2kPYfT6wcEvXStY5nMTU5z4JMx1Gwx8DmKlA6rC/uClY+LSC7gjJ; AWSALBCORS=E0ecvOZ7QzIUxEiTTG4FewMWfPpl4Qgzf6Xsq6eBhagwA5Sbmu/06mTA3v/Fwrmw8G3EKGFu2kPYfT6wcEvXStY5nMTU5z4JMx1Gwx8DmKlA6rC/uClY+LSC7gjJ; _ga_M4Q3EBRVFW=GS2.1.s1787661551$o7$g0$t1787661551$j60$l0$h0; _ga_J2ZJK3P8YJ=GS2.1.s1787667140$o2$g0$t1787667140$j60$l0$h0; _ga_NP87XRKQ3L=GS2.1.s1787737087$o874$g1$t1787737259$j37$l0$h0; _ga_YC7FB902FB=GS2.1.s1787737087$o506$g1$t1787737259$j37$l0$h0; _ga_RD4DZRH577=GS2.1.s1787735987$o4$g1$t1787737867$j60$l0$h0; _ga_5W6SV13CC9=GS2.1.s1787737368$o4$g1$t1787737870$j60$l0$h0; authToken=eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ5TGlWakRTOGFrd1JkOTI4aTJnbXluNG9Na1ZkdERpcXk0V3NaNHZLeHF3In0.eyJleHAiOjE3ODc4MjQ0MzcsImlhdCI6MTc4NzczODAzNywianRpIjoiMmZiYWYwOWEtNzc2NC00MzIzLWJjNzEtNjVmMWRmOTJlMTUwIiwiaXNzIjoiaHR0cHM6Ly9rZXljbG9hay1wcm9kLnByYXRoYW1kaWdpdGFsLm9yZy9hdXRoL3JlYWxtcy9wcmF0aGFtIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjExM2Q0ZTNhLTQxNDUtNDkyZi05Y2RkLTllOGEwMzQ2OWVjYyIsInR5cCI6IkJlYXJlciIsImF6cCI6InByYXRoYW0iLCJzZXNzaW9uX3N0YXRlIjoiZWUyM2U5ZjctNTgzNi00MjU3LTk0MjktZjE0OGUzYzA1YjBkIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIvKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtcHJhdGhhbSJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCBwcmF0aGFtLXJvbGUiLCJzaWQiOiJlZTIzZTlmNy01ODM2LTQyNTctOTQyOS1mMTQ4ZTNjMDViMGQiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsIm5hbWUiOiJEaXZ5YXRlaiBTaW5naCIsInVzZXJfcm9sZXMiOiJMZWFybmVyIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiZGl2eWF0ZWouc2luZ2hAcHJhdGhhbS5vcmciLCJnaXZlbl9uYW1lIjoiRGl2eWF0ZWoiLCJmYW1pbHlfbmFtZSI6IlNpbmdoIiwiZW1haWwiOiJkaXZ5YXRlai5zaW5naEBwcmF0aGFtLm9yZyJ9.ogA60vOL9eJlNGzbdIB0v24wSMXmJLennuPWENbMIitPgjhvxVM5i91Sf4Hu6suvsKLkFdXpJUp_JpxX_yDHbFrSH5aVdsMLFpPTLA0TNlFxweZTIB_jwHxJ4oTsEjmy-tFGWkaPER8EMwr4zhP7M-kw7AAFFwMUq7DBmHvN6CBK6E6Ni1fsm7l6IaEsk0g0r435Gsftl5cM_bJnqcVxfXFqSTwO9i729ir6vUCr-80KYEWhsQotakTJnZZ4tSUBCC_GoegbxezvHcDVFSOQIOlTU5YobkiNkAM9OfwlsCxk8QIJMK3Rqrzdr07ADyzAQDIHOCKefk19uBoVwKsUqA; userId=113d4e3a-4145-492f-9cdd-9e8a03469ecc; tenantId=fd8f3180-9988-495b-8a0d-ed201d7d28df; _ga_5KFZSGK9KR=GS2.1.s1787735980$o7$g1$t1787738034$j9$l0$h0';

// ── List of content IDs to process ────────────────────────────────────────────
const CONTENT_IDS = [
  'do_214352785717551104110',
  'do_2143464923090124801577',
  'do_2143522102748446721720',
  'do_214352786450489344119',
  'do_21443553854876876815748',
  'do_2143522125906739201784',
  'do_2143579387060469761918',
  'do_2143464523817533441380',
  'do_214351367076708352121',
  'do_214360071846805504131',
  'do_21446808355911270411185',
  'do_2143585184456294401114',
  'do_2143534485794897921249',
  'do_2143465327297413121125',
  'do_2143485847937351681173',
  'do_214344297985884160161',
  'do_2144689075755171841985',
  'do_2143485775582822401137',
  'do_2143535608981831681213',
  'do_21434650556792012811',
  'do_2143486552593121281174',
  'do_2143535608363417601211',
  'do_214461117100531712160',
  'do_21434863214809088018',
  'do_214361898574626816186',
  'do_2143465431899504641169',
  'do_2143513534324326401700',
  'do_2143464083471482881307',
  'do_21446763564127027211165',
  'do_214351380013129728185',
  'do_214344278609371136174',
  'do_2143464952257658881602',
  'do_2143527066565345281300',
  'do_2143484797383147521136',
  'do_2144654200004034561317',
  'do_2143527081836052481309',
  'do_21463880979963904012045',
  'do_214361911232544768192',
  'do_2143485317696471041586',
  'do_21446172987657420811208',
  'do_214462400788676608147',
  'do_21463881409323827212048',
  'do_2143535720003911681575',
  'do_2143463919396208641217',
  'do_2143513999765995521189',
  'do_2143535722399580161582',
  'do_2144590199202611201247',
  'do_21434787200877363216',
  'do_21436424650368614412734',
  'do_21463453133929676811876',
  'do_21463453817986252811878',
  'do_2143445022362583041522',
  'do_2144584817853972481180',
  'do_21463455984906240011887',
  'do_2143443527114833921376',
  'do_2143464483170713601345',
  'do_214348561478090752167',
  'do_2143443534051491841380',
  'do_214461054658715648148',
  'do_214461054658715648148',
  'do_2143484741640355841107',
  'do_2143464651520081921421',
  'do_2143520829818798081284',
  'do_2143484738128936961106',
  'do_2144654200004034561317',
  'do_21463466143711232011914',
  'do_21463511830772940811920',
  'do_21432803707426406418763',
  'do_214348463136399360140',
  'do_2145602626539601921718',
  'do_214461089437966336155',
  'do_2143478625247805441157',
];

// ── Publish checklist ─────────────────────────────────────────────────────────
const PUBLISH_CHECKLIST = [
  'Check for Appropriate Title, Description, Keywords, Tags, and Thumbnails used.',
  'Check for Copyright infringement (images, texts, etc)',
  'No abusive, violent, sexual, offensive, or discriminatory content.',
  'Used Good Quality Content (Audio/Video/pdf, etc) which runs in all the applications.',
  'Correct Spellings, Grammar and Simple Language used.',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function writeLog(logObj) {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const filePath = path.join(LOGS_DIR, `update-publish-content-${todayStr()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(logObj, null, 2), 'utf8');
  return filePath;
}

// Common headers — mirrors the curl request exactly
function getHeaders(extra = {}) {
  return {
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Cookie': COOKIE,
    ...extra,
  };
}

// ── Step 1: Read — fetch versionKey & createdBy ───────────────────────────────
async function readContent(contentId) {
  const fields = 'body,collaborators,editorState,stageIcons,templateId,languageCode,template,gradeLevel,status,concepts,versionKey,name,appIcon,contentType,owner,domain,code,visibility,createdBy,description,language,mediaType,mimeType,osId,languageCode,createdOn,lastUpdatedOn,audience,ageGroup,attributions,artifactUrl,board,subject,keywords,config,resourceType,medium,publisher,year,pkgVersion,framework,rejectReasons,rejectComment,topic,ownedBy,ownershipType,creators,contributors,reservedDialcodes,qrCodeProcessId,channel,purpose,assets,assetsMap,copyright,author,copyrightYear,origin,license,displayScore,courseType,licenseterms,primaryCategory,additionalCategories,maxAttempts,verticals,programs,domain,subDomain,targetAgeGroup,primaryUser,contentLanguage,program,subject,publishedby';

  const url = `${BASE_URL}/action/content/v3/read/${contentId}?mode=edit&fields=${fields}`;

  const response = await axios.get(url, {
    timeout: API_TIMEOUT,
    headers: getHeaders({
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    }),
  });

  const content = response.data?.result?.content;
  if (!content) throw new Error(`Read API returned no content for ${contentId}`);

  return {
    versionKey: content.versionKey,
    createdBy: content.createdBy,
    name: content.name,
    status: content.status,
  };
}

// ── Step 2: Update — set primaryCategory using versionKey ─────────────────────
async function updateContent(contentId, versionKey) {
  const url = `${BASE_URL}/action/content/v3/update/${contentId}`;

  const response = await axios.patch(url, {
    request: {
      content: {
        versionKey,
        primaryCategory: 'Activity',
      },
    },
  }, {
    timeout: API_TIMEOUT,
    headers: getHeaders({
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/mfe_workspace/generic-editor/index.html`,
      'X-Requested-With': 'XMLHttpRequest',
      'user-id': 'content-editor',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    }),
  });

  return response.data;
}

// ── Step 3: Review ────────────────────────────────────────────────────────────
async function reviewContent(contentId) {
  const url = `${BASE_URL}/action/content/v3/review/${contentId}`;

  const response = await axios.post(url, {
    request: { content: {} },
  }, {
    timeout: API_TIMEOUT,
    headers: getHeaders({
      'Referer': 'https://lap.prathamdigital.org/mfe_workspace/upload-editor?identifier=do_21464442711405363212697&isAllContents=true',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    }),
  });

  return response.data;
}

// ── Step 4: Publish — lastPublishedBy = createdBy from step 1 ─────────────────
async function publishContent(contentId, lastPublishedBy) {
  const url = `${BASE_URL}/action/content/v3/publish/${contentId}`;

  const response = await axios.post(url, {
    request: {
      content: {
        lastPublishedBy,
        publishChecklist: PUBLISH_CHECKLIST,
      },
    },
  }, {
    timeout: API_TIMEOUT,
    headers: getHeaders({
      'Referer': 'https://lap.prathamdigital.org/mfe_workspace/upload-editor?identifier=do_21464442711405363212697&isAllContents=true',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    }),
  });

  return response.data;
}

// ── Process one content ID through all 4 steps ────────────────────────────────
async function processOne(contentId, index, total) {
  console.log(`\n  [${index}/${total}] ─────────────────────────────────────────────`);
  console.log(`  contentId : ${contentId}`);

  const result = { contentId, steps: {}, finalStatus: null, error: null };

  try {
    console.log(`    → Step 1: Read API...`);
    const readData = await readContent(contentId);
    console.log(`             versionKey : ${readData.versionKey}`);
    console.log(`             createdBy  : ${readData.createdBy}`);
    console.log(`             name       : ${readData.name}`);
    console.log(`             status     : ${readData.status}`);
    result.steps.read = { success: true, versionKey: readData.versionKey, createdBy: readData.createdBy };

    console.log(`    → Step 2: Update API (primaryCategory=Activity)...`);
    const updateRes = await updateContent(contentId, readData.versionKey);
    console.log(`             responseCode: ${updateRes?.responseCode}`);
    result.steps.update = { success: true, responseCode: updateRes?.responseCode };

    console.log(`    → Step 3: Review API...`);
    const reviewRes = await reviewContent(contentId);
    console.log(`             responseCode: ${reviewRes?.responseCode}`);
    result.steps.review = { success: true, responseCode: reviewRes?.responseCode };

    console.log(`    → Step 4: Publish API (lastPublishedBy=${readData.createdBy})...`);
    const publishRes = await publishContent(contentId, readData.createdBy);
    console.log(`             responseCode: ${publishRes?.responseCode}`);
    result.steps.publish = { success: true, responseCode: publishRes?.responseCode };

    result.finalStatus = 'completed';
    console.log(`  ✅ All 4 steps completed for ${contentId}\n`);
  } catch (err) {
    const errMsg = err.response
      ? `HTTP ${err.response.status} — ${JSON.stringify(err.response.data)}`
      : err.message;
    console.error(`  ❌ FAILED: ${errMsg}\n`);
    result.finalStatus = 'failed';
    result.error = errMsg;
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  if (CONTENT_IDS.length === 0) {
    console.error('ERROR: CONTENT_IDS array is empty.');
    process.exit(1);
  }

  console.log(`\n${'='.repeat(65)}`);
  console.log(`  UPDATE-PUBLISH-CONTENT MIGRATION`);
  console.log(`  Base URL  : ${BASE_URL}`);
  console.log(`  Total IDs : ${CONTENT_IDS.length}`);
  console.log(`  Flow      : Read → Update → Review → Publish`);
  console.log(`${'='.repeat(65)}\n`);

  const startedAt = new Date().toISOString();
  const allResults = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < CONTENT_IDS.length; i++) {
    const result = await processOne(CONTENT_IDS[i], i + 1, CONTENT_IDS.length);
    allResults.push(result);
    if (result.finalStatus === 'completed') successCount++;
    else failedCount++;
  }

  const finishedAt = new Date().toISOString();
  const logPath = writeLog({ script: 'update-publish-content.js', baseUrl: BASE_URL, startedAt, finishedAt, totalIds: CONTENT_IDS.length, succeeded: successCount, failed: failedCount, results: allResults });

  console.log(`${'='.repeat(65)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(65)}`);
  console.log(`  Total     : ${CONTENT_IDS.length}`);
  console.log(`  Succeeded : ${successCount}`);
  console.log(`  Failed    : ${failedCount}`);
  console.log(`  Log       : ${logPath}`);
  console.log(`${'='.repeat(65)}\n`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
