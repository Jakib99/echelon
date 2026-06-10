// ECHELON Access Logger — Google Apps Script backend (guarded)
// ----------------------------------------------------------
// Routes by payload "type":
//   type=login    -> rich row in the "Logins" sheet
//   type=activity -> page-view / event row in the "Activity" sheet
// Guards: shared-secret key + basic flood throttle.

const SHEET_NAME = 'Logins';
const LOG_KEY = '3658e246beb3ae3e8c40fbae283248cff0d51ad6'; // must match logger.js
const MAX_PER_MINUTE = 120;

const HEADERS = [
    'Logged At (server)', 'Login Time (client)', 'IP Address', 'City', 'Region',
    'Country', 'ISP / Org', 'Timezone', 'Language', 'All Languages', 'Platform',
    'User Agent', 'Screen', 'Window', 'Pixel Ratio', 'CPU Cores',
    'Device Memory (GB)', 'Touch Device', 'Came From (referrer)',
    'GPU', 'Device Model', 'Browser', 'OS', 'Device ID', 'Visit #',
    'First Seen', 'Last Seen', 'Connection', 'Battery', 'Dark Mode',
    'Reduced Motion', 'Do Not Track'
];

const ACT_HEADERS = ['Logged At (server)', 'Device ID', 'Event', 'Page', 'Seconds on Page', 'Referrer'];

function ensureHeaders(sheet, headers) {
    const need = (sheet.getLastRow() === 0) ||
                 (sheet.getRange(1, 1).getValue() !== headers[0]) ||
                 (sheet.getLastColumn() < headers.length);
    if (need) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.setFrozenRows(1);
    }
}

function doPost(e) {
    const cache = CacheService.getScriptCache();
    const bucket = 'rl_' + Math.floor(Date.now() / 60000);
    const count = parseInt(cache.get(bucket) || '0', 10);
    if (count >= MAX_PER_MINUTE) return ContentService.createTextOutput('rate-limited');
    cache.put(bucket, String(count + 1), 120);

    let d = {};
    try { d = JSON.parse(e.postData.contents); } catch (err) { return ContentService.createTextOutput('bad-request'); }
    if (!d || d.key !== LOG_KEY) return ContentService.createTextOutput('denied');

    const lock = LockService.getScriptLock();
    lock.tryLock(10000);
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        if (d.type === 'activity') {
            let sheet = ss.getSheetByName('Activity') || ss.insertSheet('Activity');
            ensureHeaders(sheet, ACT_HEADERS);
            sheet.appendRow([new Date(), d.deviceId || '', d.event || '', d.page || '', d.seconds || '', d.referrer || '']);
            return ContentService.createTextOutput('ok');
        }

        // default: login
        if (!d.userAgent && !d.timestamp) return ContentService.createTextOutput('bad-shape');
        let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
        ensureHeaders(sheet, HEADERS);
        sheet.appendRow([
            new Date(),
            d.timestamp || '', d.ip || '', d.city || '', d.region || '',
            d.country || '', d.org || '', d.timezone || '', d.language || '',
            d.languages || '', d.platform || '', d.userAgent || '', d.screen || '',
            d.viewport || '', d.pixelRatio || '', d.cpuCores || '',
            d.deviceMemory || '', d.touch || '', d.referrer || '',
            d.gpu || '', d.deviceModel || '', d.browser || '', d.os || '',
            d.deviceId || '', d.visitCount || '', d.firstSeen || '', d.lastSeen || '',
            d.connection || '', d.battery || '', d.darkMode || '',
            d.reducedMotion || '', d.doNotTrack || ''
        ]);
        return ContentService.createTextOutput('ok');
    } finally {
        lock.releaseLock();
    }
}

function doGet() {
    return ContentService.createTextOutput('ECHELON access logger is running.');
}

// ── One-time backfill: fill City/Region on existing rows from their stored IP ──
function backfillGeo() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const last = sheet.getLastRow();
    if (last < 2) return;
    const data = sheet.getRange(2, 3, last - 1, 3).getValues(); // C=IP, D=City, E=Region
    let filled = 0;
    for (let i = 0; i < data.length; i++) {
        const ip = String(data[i][0] || '').trim();
        const city = data[i][1], region = data[i][2];
        if (!ip || (city && region)) continue;
        try {
            const resp = UrlFetchApp.fetch('https://ipwho.is/' + encodeURIComponent(ip), { muteHttpExceptions: true });
            const d = JSON.parse(resp.getContentText());
            if (d && d.success !== false) {
                const rowNum = i + 2;
                if (!city && d.city) sheet.getRange(rowNum, 4).setValue(d.city);
                if (!region && d.region) sheet.getRange(rowNum, 5).setValue(d.region);
                filled++;
            }
        } catch (err) { /* skip this row */ }
        Utilities.sleep(250);
    }
    SpreadsheetApp.getActiveSpreadsheet().toast('Backfill complete — ' + filled + ' rows updated', 'ECHELON', 5);
}
