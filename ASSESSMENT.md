# BeyondClass maths assessment

assessment.html is the public locked introduction. The original assessment app is in private/assessment-app.cjs and is bundled into the server function, never copied into dist. It contains 100 original questions across five topic areas and five broad difficulty bands; each attempt uses at most 20 items over 15 minutes. Adaptation and report thresholds are transparent in the parent report. Results are informal screening evidence, not IQ, diagnosis, grade, or a measured age level.

The downloadable local copy has delivery disabled. The deployed private app must keep delivery disabled until Netlify form detection is enabled and the maths-assessment form has an email notification to hellobeyondclass@gmail.com. Enable CONFIG.deliveryEnabled in private/assessment-app.cjs only after those settings are verified. A successful HTTP submission confirms acceptance by the site, not delivery to the email inbox. Verify a labelled synthetic submission in Netlify and ask the owner to confirm receipt.

## Access code

The server verifies a one-way SHA-256 code hash in lib/assessment-access-config.cjs. The plaintext code is provided privately to the owner and is not saved in the site files. Case, spaces and hyphens are normalized. An unlocked browser receives a signed, HttpOnly, Secure, SameSite cookie limited to assessment routes for two hours. The signing key is generated and stored privately in the production assessment Netlify Blob store. It is never stored in the Git repository or served to the browser. Guess attempts are limited; expired rate records are cleaned daily. Production and preview stores are isolated. Local Node development uses an in-memory signing key and restarts invalidate its sessions.

To rotate the access code, generate a new unpredictable code and replace its normalized SHA-256 hash in the server configuration, then deploy. Rotation invalidates old sessions. Do not reuse a login password or a short guessable code. Users request the shared code by contacting BeyondClass; no automatic code distribution or paid access is implied. Anyone receiving the code can share it. This protects the hosted entry point, not copies of the source in a public repository or downloadable offline previews.

Parent contact email is collected but is not a notification recipient. No API secrets are placed in the HTML. Reports include personal details and are submitted only after parent/tutor permission. Session storage lasts for the tab session with a 24-hour restore expiry. Clear the session on shared devices.

Netlify build processing is enabled for form detection, with script/style minification disabled to preserve CSP hashes. The existing private inbox functions are unchanged. /assessment/start is served by the access function only after cookie verification, with no-store and noindex headers. Its inline-script CSP hash is generated from the private app contents.

Change the BANK array to revise questions; review explanations and test all routes after changes. Assessment answers are in the browser source; this is a low-stakes learning tool, not a secure exam.

## Delivery verification - 26 October 2026

Netlify detected the maths-assessment form. Its notification was saved specifically for that form to hellobeyondclass@gmail.com. Synthetic launch check BC-LAUNCH-CHECK-20261026 was received in Verified submissions, and the owner confirmed the test email arrived. The hosted app now enables report submission. The offline preview remains delivery-disabled.
