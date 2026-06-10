# ECHELON Access Logging — Setup

This logs each successful login to a Google Sheet you own: IP address, approximate
location, browser/OS/device, timezone, language, screen size, referrer, and time.

You only do this once. ~10 minutes. Free. No coding.

---

## Step 1 — Create the spreadsheet ("database")

1. Go to https://sheets.google.com and create a **Blank** spreadsheet.
2. Name it something like `ECHELON Access Log`.
   (You don't need to add any columns — the script creates them automatically.)

## Step 2 — Add the logger script

1. In that spreadsheet, click **Extensions → Apps Script**. A code editor opens.
2. Delete whatever starter code is there (the empty `function myFunction() {}`).
3. Open the file **`logger.appsscript.gs`** (in your echelon folder), copy **all** of it,
   and paste it into the Apps Script editor.
4. Click the **Save** icon (💾).

## Step 3 — Deploy it as a Web App

1. Top-right, click **Deploy → New deployment**.
2. Click the gear ⚙️ next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** `ECHELON logger` (anything)
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
     *(This means "anyone can POST a log row" — not "anyone can read your sheet."
     Your sheet stays private to you.)*
4. Click **Deploy**.
5. Google will ask you to **Authorize access** → pick your account → if it warns
   "Google hasn't verified this app", click **Advanced → Go to (your project) → Allow**.
   (It's your own script, so this is expected.)
6. Copy the **Web app URL** it shows you. It looks like:
   `https://script.google.com/macros/s/AKfy...XYZ/exec`

## Step 4 — Plug the URL into the site

1. Open **`logger.js`** in your echelon folder.
2. Find this line near the top:
   ```js
   const LOG_ENDPOINT = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace the placeholder with your web-app URL, keeping the quotes:
   ```js
   const LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfy...XYZ/exec';
   ```
4. Save.

## Step 5 — Test

1. Open your site's login page, enter the password, and sign in.
2. Go back to your Google Sheet — you should see a **`Logins`** tab with a new row.

That's it. Every login from now on adds a row. To deploy the update to GitHub,
re-push (or re-upload) the changed `logger.js` and `login.html`.

---

### Good to know
- **Only logins through the login page are recorded.** Someone who bypasses the
  client-side gate won't appear — this is access telemetry, not a security wall.
- **IP addresses are personal data** under laws like GDPR/CCPA. Logging access to
  your own site is normal, but if others use it, it's good practice to tell them.
- **The endpoint is public-by-design.** In theory someone could send junk rows to it.
  For a low-traffic personal site that's a non-issue; if it ever matters, we can add
  a shared secret or move to Cloudflare/Vercel.
- **To stop logging**, just blank out the URL in `logger.js` (set it back to the
  placeholder) and re-deploy.
