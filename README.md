# BeyondClass Math

A multipage website with direct parent-request forms and a private owner inbox. Run `npm start` with Node.js 22.13 or newer, then open `http://127.0.0.1:4173/`. No dependency installation is required.

Opening the HTML files directly, or publishing only the static files, lets visitors browse the pages but cannot save requests. Netlify hosting is now supported through `netlify/functions/api.mjs` and persistent private Netlify Blobs storage. Run `npm ci` to install that function's dependency. Follow **SETUP-NETLIFY-AND-GOOGLE.md** for deployment and Google setup. The local Node server still uses SQLite and needs no external service.

## Netlify and Google setup

The launch workflow is deferred until the owner has purchased a custom domain. Follow `SETUP-NETLIFY-AND-GOOGLE.md`: connect the domain, verify Google's Domain property through DNS, set the final `SITE_URL` and private inbox password, then deploy and submit the final domain's sitemap. The recommended DNS verification method does not require `GOOGLE_SITE_VERIFICATION` or an extra deployment for a verification tag.

`netlify.toml` builds the site with `npm run build`, publishes only `dist`, and bundles the API function. Set a private `INBOX_PASSWORD` of at least 16 characters in Netlify's Functions environment settings before deploying. Hosted inbox passwords are managed through the hosting settings; changing the value and redeploying invalidates earlier sessions. Local SQLite records are not automatically migrated to Netlify.

The public address is configured in `site.config.json`. Use `npm run configure-site -- https://your-real-domain` to update source metadata and search files, or set `SITE_URL` in Netlify's build environment to override it for a build. `GOOGLE_SITE_VERIFICATION` accepts the actual code from Search Console and adds the ownership meta tag during the build. See the setup guide before changing domains.

`sitemap.xml` includes the ten public pages, excluding the owner inbox. `robots.txt` points to it. The build generates Content Security Policy and other security headers, hashes for inline structured data, an index redirect and optional old-domain redirects. Deploy previews receive noindex instructions and separate request storage. Production API access is restricted to the currently published deployment on the project's primary website origin.

`SECURITY-AND-SEO-REPORT.md` records the changes and the security-checklist items that do not apply to the site's current features. `npm test` covers the local server, serverless request handling and safe deployment output.

The owner inbox also shows anonymous page counts for the last 7 or 30 UTC days. Public pages send only an allowed page name to `/api/pageviews`, omitting cookies, query strings and referrer headers. Do Not Track and Global Privacy Control preferences disable this feature. `/api/inbox/analytics` is authenticated; no per-visitor identity is stored in the count records. Counts are approximate page loads, not unique visitors, and start when the updated site is deployed. SQLite stores local counts; Netlify Blobs stores hosted daily aggregates with conditional writes.

## Pages

- `index.html`: Home, interactive triangle tool, tutor photography, how it works, free-materials request form
- `about.html`: Founder’s story and approach
- `pricing.html`: Plans and Confidence Week
- `reviews.html`: Existing family testimonials
- `contact.html`: Trial lesson request and contact details
- `payment.html`: Plan selection and Stripe checkout handoff
- `tutors.html`: Tutor screening and curriculum support
- `faq.html`: Frequently asked questions
- `resources.html`: Free worksheet requests and a link to the interactive tool
- `privacy.html`: Child protection and privacy
- `inbox.html`: Password-protected owner inbox for materials requests and trial bookings

Shared design and behavior are in `assets/site.css` and `assets/site.js`. Comic Relief is embedded in regular and bold weights and used first on every device for a consistent, close match to Comic Sans. The font loads from the website stylesheet without a third-party font service or an installed-font requirement. Comic Sans is a fallback only. Font source: https://github.com/loudifier/Comic-Relief (SIL Open Font License 1.1; the complete copyright and license notice is included in assets/site.css). The design stays black and white, including gradients, and respects reduced motion preferences.

Each photo has a single placement: the supplied online tutor on Home, the original exam photo on Our Tutors, the original study-desk photo on Resources, and Ekemini Akpan’s small portrait in the founder section on About. Main photos span the full page width with text over a dark gradient; photography is presented in monochrome to match the brand. Original image files are preserved in `assets/images`. The original math patterns are shared through `assets/math-pattern.svg` and `assets/math-pattern-dark.svg`, with the light pattern layered over content-section gradients. Page headers use the clean black gradient.

The three Why cards and six Explore cards use their separately assigned photo or video backgrounds, with white text over a dark gradient. The teaching card uses the supplied five-second recording as a muted looping background, with a play/pause button and a still frame when motion or data-saving preferences disable autoplay. Off-screen videos pause. The founder uses the newer square portrait, `ekemini-akpan-profile.jpg`.

The four parent names on Reviews are labelled display names: Mr Adewale Adeyemi, Mrs Nneka Okafor, Chinedu's mum, and Mrs Imaobong Udo. The original review text and locations are preserved.

Phone and tablet layouts retain the laptop styling and visible page navigation. On phones, groups of cards use horizontally scrollable rows with readable text and swipe hints. Tablets keep multi-column card and photo layouts where space permits. The viewport supports normal pinch-to-zoom.

## Activate Stripe checkout

Stripe Payment Links have not been supplied, so the site clearly shows that checkout is being set up and offers a contact link.

1. Create Stripe Payment Links for the plans and currencies you want to accept. Match each link’s price, currency, and billing period to the offer shown on the website.
2. Paste the full `https://buy.stripe.com/...` URLs into the matching entries in `assets/checkout-config.js`.
3. Leave unavailable plan and currency combinations blank. The payment button automatically becomes available for configured combinations.
4. Verify the checkout with Stripe test links before using live links.

Flexible is the featured best plan and the default payment selection: three lessons per week for a month at $200 / ₦280,000, with all Premium benefits and the existing Flexible extras. Starter, Growth and Premium retain their previous prices. Parent calls are optional. Confidence Week is a $19.99 / ₦29,999 deposit, and checkout preserves decimal amounts. GBP quotes and 50% part payments are handled through contact. Stripe hosts checkout and handles payment confirmation; the website does not track payment status or activate enrollment automatically. Never place secret keys in website files.

## Contact and worksheet requests

The free-materials form appears on Home and Resources. Both it and the Contact trial-booking form submit directly to `/api/requests`. The server validates and saves requests in `.data/requests.sqlite` before returning a confirmation and reference number. A failed submission preserves the visitor's entries; retrying the same submission does not duplicate it. No email client or external form service is required.

Requests appear in the owner's website inbox. Saving a request does not automatically send learning materials or book a confirmed lesson: the owner reviews it and arranges fulfillment with the parent.

## Owner inbox

Open `http://127.0.0.1:4173/inbox.html`. On the first server run, a private password is generated in `.data/inbox-password.txt`; it is never printed in server logs or served over HTTP. Use it to sign in, then choose **Change your inbox password** to set your own. The initial plaintext password file is removed after changing the password. Password hashes, sessions, and request contents are never sent to unauthenticated visitors.

The inbox supports filtering by type or unread status, reading full details, marking requests as new or read, and pagination. Sign-in sessions expire after 12 hours and are invalidated on sign-out or password change. Restarting the server signs out inbox users but preserves saved requests.

For non-Netlify Node hosting, run `node server.cjs` and configure `HOST=0.0.0.0` and the host's `PORT`. Set `DATA_DIR` to a persistent private directory, use HTTPS, and set `COOKIE_SECURE=true` when HTTPS terminates at your hosting provider. Back up the data directory with SQLite-aware tooling or while the server is stopped. Keep `.data`, `.env`, and all credentials out of source control; the server does not expose them as static files.

Optionally set a strong `INBOX_PASSWORD` through server environment settings. In that mode the password is managed through the environment, and changing it from the inbox is disabled. No inbox data or credentials should be committed or added to public website assets.

Run `npm test` to check form validation, private access, duplicate prevention, persistent storage, password changes, and rate limits.

Existing bookmarks such as `index.html#pricing` redirect to the section’s new page when JavaScript is enabled.
