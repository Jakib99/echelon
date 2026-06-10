// ECHELON Access Logger — Google Apps Script backend (guarded)
// ----------------------------------------------------------
// Appends one row per login to the attached Google Sheet.
// Guards: shared-secret key, payload shape check, basic flood throttle.
//
// This is the reference copy of the code that is deployed as the web app.
// If you ever redeploy, paste this into Extensions -> Apps Script.

const SHEET_NAME = 'Logins';
const LOG_KEY = '3658e246beb3ae3e8c40fbae283248cff0d51ad6'; // must match logger.js
const MAX_PER_MINUTE = 20; // basic flood cap across all requests

const HEADERS = [
    'Logged At (server)', 'Login Time (client)', 'IP Address', 'City', 'Region',
    'Country', 'ISP / Org', 'Timezone', 'Language', 'All Languages', 'Platform',
    'User Agent', 'Screen', 'Window', 'Pixel Ratio', 'CPU Cores',
    'Device Memory (GB)', 'Touch Device', 'Came From (referrer)'
];

function doPost(e) {
    // 1) Basic flood throttle (per-minute, global)
    const cache = CacheService.getScriptCache();
    const bucket = 'rl_' + Math.floor(Date.now() / 60000);
    const count = parseInt(cache.get(bucket) || '0', 10);
    if (count >= MAX_PER_MINUTE) {
        return ContentService.createTextOutput('rate-limited');
    }
    cache.put(bucket, String(count + 1), 120);

    // 2) Parse + validate
    let d = {};
    try { d = JSON.parse(e.postData.contents); } catch (err) {
        return ContentService.createTextOutput('bad-request');
    }

    // 3) Shared-secret check
    if (!d || d.key !== LOG_KEY) {
        return ContentService.createTextOutput('denied');
    }

    // 4) Shape check — must look like a real log entry
    if (!d.userAgent && !d.timestamp) {
        return ContentService.createTextOutput('bad-shape');
    }

    const lock = LockService.getScriptLock();
    lock.tryLock(10000);
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(SHEET_NAME);
        if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

        if (sheet.getLastRow() === 0) {
            sheet.appendRow(HEADERS);
            sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
            sheet.setFrozenRows(1);
        }

        sheet.appendRow([
            new Date(),
            d.timestamp || '', d.ip || '', d.city || '', d.region || '',
            d.country || '', d.org || '', d.timezone || '', d.language || '',
            d.languages || '', d.platform || '', d.userAgent || '', d.screen || '',
            d.viewport || '', d.pixelRatio || '', d.cpuCores || '',
            d.deviceMemory || '', d.touch || '', d.referrer || ''
        ]);

        return ContentService.createTextOutput('ok');
    } finally {
        lock.releaseLock();
    }
}

function doGet() {
    return ContentService.createTextOutput('ECHELON access logger is running.');
}
