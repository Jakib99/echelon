// ECHELON Access Control
// To change the password:
//   1. Open Chrome DevTools console (F12)
//   2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//          .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
//   3. Paste the output hash below

const ACCESS_HASH = "6611032577e5a7b3a146e7b2111117b71a2a7b0fa4ef2861353816730a4f4a02";

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return [...new Uint8Array(hashBuffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function login(password) {
    const hash = await hashPassword(password);
    if (hash === ACCESS_HASH) {
        sessionStorage.setItem('echelon_access', 'granted');
        return true;
    }
    return false;
}

function checkAuth() {
    if (sessionStorage.getItem('echelon_access') !== 'granted') {
        window.location.href = 'login.html';
    }
}

function logout() {
    sessionStorage.removeItem('echelon_access');
    window.location.href = 'login.html';
}
