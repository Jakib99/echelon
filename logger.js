// ECHELON — Access Logger + lightweight activity tracking
// =========================================================
// On the login page: records a rich row (IP, geo, device, hardware,
// returning-visitor, environment) to the "Logins" sheet.
// On every other page: records page visits + time-on-page + key events
// to the "Activity" sheet. All client-side. Honors nothing it shouldn't.

const LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxoUo4CiaovVrEzJbTmaAqXwcBpR3LE10rWWTWIgxQ48ZfhE8zK7DXECIazwFSmi-xZ/exec';

// Shared secret — must match LOG_KEY in the Apps Script. Visible in source
// (client-side), so it deters casual/bot junk but isn't bulletproof.
const LOG_KEY = '3658e246beb3ae3e8c40fbae283248cff0d51ad6';

// ── IP + geolocation (ipwho.is → GeoJS → ipify) ─────────────
async function getIpInfo() {
    try {
        const r = await fetch('https://ipwho.is/', { cache: 'no-store' });
        if (r.ok) {
            const d = await r.json();
            if (d && d.success !== false) {
                return {
                    ip: d.ip || '', city: d.city || '', region: d.region || '',
                    country: d.country || '',
                    org: (d.connection && (d.connection.isp || d.connection.org)) || ''
                };
            }
        }
    } catch (e) {}
    try {
        const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { cache: 'no-store' });
        if (r.ok) {
            const d = await r.json();
            return { ip: d.ip || '', city: d.city || '', region: d.region || '',
                     country: d.country || '', org: d.organization_name || d.organization || '' };
        }
    } catch (e) {}
    try {
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (r.ok) { const d = await r.json(); return { ip: d.ip || '' }; }
    } catch (e) {}
    return {};
}

// ── Returning-visitor identity (persists across sessions) ───
function getVisitorInfo() {
    const now = new Date().toISOString();
    let id = localStorage.getItem('ech_vid');
    let first = localStorage.getItem('ech_first');
    let count = parseInt(localStorage.getItem('ech_count') || '0', 10);
    const lastSeen = localStorage.getItem('ech_last') || '';
    if (!id) { id = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); first = now; }
    count += 1;
    try {
        localStorage.setItem('ech_vid', id);
        localStorage.setItem('ech_first', first || now);
        localStorage.setItem('ech_count', String(count));
        localStorage.setItem('ech_last', now);
    } catch (e) {}
    return { deviceId: id, visitCount: count, firstSeen: first || now, lastSeen };
}

// ── GPU / graphics chip (via WebGL) ─────────────────────────
function getGPU() {
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!gl) return '';
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    } catch (e) { return ''; }
}

// ── High-entropy UA data (device model, OS version, browser) ─
async function getUACH() {
    try {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            const d = await navigator.userAgentData.getHighEntropyValues(
                ['model', 'platformVersion', 'architecture', 'bitness', 'fullVersionList']);
            const brand = (d.fullVersionList || []).find(b => !/Not.?A.?Brand/i.test(b.brand));
            return {
                deviceModel: d.model || '',
                osVersion: d.platformVersion || '',
                browser: brand ? (brand.brand + ' ' + brand.version) : ''
            };
        }
    } catch (e) {}
    return {};
}

// ── Battery (where supported) ───────────────────────────────
async function getBatteryStr() {
    try {
        if (navigator.getBattery) {
            const b = await navigator.getBattery();
            return Math.round(b.level * 100) + '%' + (b.charging ? ' (charging)' : '');
        }
    } catch (e) {}
    return '';
}

// ── Connection type / speed ─────────────────────────────────
function getConnStr() {
    const c = navigator.connection || {};
    if (!c.effectiveType) return '';
    return c.effectiveType + (c.downlink ? ' · ~' + c.downlink + ' Mbps' : '');
}

// ── Lightweight UA parse (fallback for browser/OS names) ────
function parseUA() {
    const ua = navigator.userAgent;
    let os = '', browser = '';
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Linux/.test(ua)) os = 'Linux';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\//.test(ua)) browser = 'Opera';
    else if (/Chrome\/(\d+)/.test(ua)) browser = 'Chrome ' + RegExp.$1;
    else if (/Firefox\/(\d+)/.test(ua)) browser = 'Firefox ' + RegExp.$1;
    else if (/Version\/(\d+)[^ ]* Safari/.test(ua)) browser = 'Safari ' + RegExp.$1;
    return { os, browser };
}

function configured() { return LOG_ENDPOINT && LOG_ENDPOINT.indexOf('PASTE_') !== 0; }

function postJSON(payload) {
    return fetch(LOG_ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).catch(() => {});
}

// ── Rich login row ──────────────────────────────────────────
async function logAccess() {
    if (!configured()) return;
    const [ipInfo, uach, battery] = await Promise.all([getIpInfo(), getUACH(), getBatteryStr()]);
    const vis = getVisitorInfo();
    const ua = parseUA();
    const nav = navigator;

    const payload = {
        type:        'login',
        key:         LOG_KEY,
        timestamp:   new Date().toISOString(),
        ip:          ipInfo.ip || '',
        city:        ipInfo.city || '',
        region:      ipInfo.region || '',
        country:     ipInfo.country || '',
        org:         ipInfo.org || '',
        timezone:    (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
        language:    nav.language || '',
        languages:   (nav.languages || []).join(', '),
        platform:    nav.platform || '',
        userAgent:   nav.userAgent || '',
        screen:      (screen.width + 'x' + screen.height),
        viewport:    (window.innerWidth + 'x' + window.innerHeight),
        pixelRatio:  window.devicePixelRatio || 1,
        cpuCores:    nav.hardwareConcurrency || '',
        deviceMemory: nav.deviceMemory || '',
        touch:       ('ontouchstart' in window || nav.maxTouchPoints > 0) ? 'yes' : 'no',
        referrer:    document.referrer || '',
        // ── new fields ──
        gpu:         getGPU(),
        deviceModel: uach.deviceModel || '',
        browser:     uach.browser || ua.browser || '',
        os:          (ua.os + (uach.osVersion ? ' ' + uach.osVersion : '')).trim(),
        deviceId:    vis.deviceId,
        visitCount:  vis.visitCount,
        firstSeen:   vis.firstSeen,
        lastSeen:    vis.lastSeen,
        connection:  getConnStr(),
        battery:     battery,
        darkMode:    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
        reducedMotion: (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'yes' : 'no',
        doNotTrack:  (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.doNotTrack === 'yes') ? 'on' : 'off'
    };
    await postJSON(payload);
}

// ── Activity tracking (page visits, dwell time, key events) ──
function pageName() { return (location.pathname.split('/').pop() || 'index.html'); }

function trackEvent(event, extra) {
    if (!configured()) return;
    const body = JSON.stringify(Object.assign({
        type: 'activity', key: LOG_KEY, event: event,
        page: pageName(), deviceId: localStorage.getItem('ech_vid') || '',
        referrer: document.referrer || ''
    }, extra || {}));
    try {
        const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        if (navigator.sendBeacon && navigator.sendBeacon(LOG_ENDPOINT, blob)) return;
    } catch (e) {}
    postJSON(JSON.parse(body));
}
window.echTrack = trackEvent;   // diagram.html calls this for sim/incident runs

// Auto: on each authed content page, record time-on-page when leaving.
(function () {
    if (pageName() === 'login.html') return;
    if (sessionStorage.getItem('echelon_access') !== 'granted') return;
    const entry = Date.now();
    let sent = false;
    function sendDwell() {
        if (sent) return; sent = true;
        trackEvent('page', { seconds: Math.round((Date.now() - entry) / 1000) });
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) sendDwell(); });
    window.addEventListener('pagehide', sendDwell);
})();
