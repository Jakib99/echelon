// ECHELON — Access Logger
// Records one row in your Google Sheet each time someone successfully logs in.
//
// SETUP (one time):
//   1. Follow LOGGING-SETUP.md to deploy the Google Apps Script web app.
//   2. Paste the web-app URL it gives you between the quotes below.
// Until that URL is set, logging is simply skipped (the site still works fine).

const LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxoUo4CiaovVrEzJbTmaAqXwcBpR3LE10rWWTWIgxQ48ZfhE8zK7DXECIazwFSmi-xZ/exec';

// Shared secret. The endpoint rejects any request that doesn't carry this exact
// key, which blocks casual/bot junk hitting the bare URL. Note: because this file
// is client-side, the key is visible to anyone who reads the source — it raises
// the bar, it is not bulletproof. Must match LOG_KEY in the Apps Script.
const LOG_KEY = '3658e246beb3ae3e8c40fbae283248cff0d51ad6';

// The browser can't read its own public IP directly, so we ask a free,
// no-key IP service (a server that can see the request). GeoJS first,
// ipify as a fallback for at least the raw IP.
async function getIpInfo() {
    try {
        const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { cache: 'no-store' });
        if (r.ok) {
            const d = await r.json();
            return {
                ip: d.ip || '',
                city: d.city || '',
                region: d.region || '',
                country: d.country || '',
                org: d.organization_name || d.organization || ''
            };
        }
    } catch (e) { /* ignore and try fallback */ }
    try {
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (r.ok) { const d = await r.json(); return { ip: d.ip || '' }; }
    } catch (e) { /* ignore */ }
    return {};
}

async function logAccess() {
    // Not configured yet → do nothing.
    if (!LOG_ENDPOINT || LOG_ENDPOINT.indexOf('PASTE_') === 0) return;

    const ipInfo = await getIpInfo();
    const nav = navigator;

    const payload = {
        key:          LOG_KEY,
        timestamp:    new Date().toISOString(),
        ip:           ipInfo.ip || '',
        city:         ipInfo.city || '',
        region:       ipInfo.region || '',
        country:      ipInfo.country || '',
        org:          ipInfo.org || '',
        timezone:     (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
        language:     nav.language || '',
        languages:    (nav.languages || []).join(', '),
        platform:     nav.platform || '',
        userAgent:    nav.userAgent || '',
        screen:       (screen.width + 'x' + screen.height),
        viewport:     (window.innerWidth + 'x' + window.innerHeight),
        pixelRatio:   window.devicePixelRatio || 1,
        cpuCores:     nav.hardwareConcurrency || '',
        deviceMemory: nav.deviceMemory || '',
        touch:        ('ontouchstart' in window || nav.maxTouchPoints > 0) ? 'yes' : 'no',
        referrer:     document.referrer || ''
    };

    try {
        // no-cors + text/plain keeps this a "simple" request (no CORS preflight),
        // which is what Apps Script web apps accept from a browser.
        await fetch(LOG_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        // Never block or fail login because logging didn't go through.
    }
}
