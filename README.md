# BeyondClass Math

A multipage website with direct parent-request forms and a private owner inbox. Run `npm start` with Node.js 22.13 or newer, then open `http://127.0.0.1:4173/`. No dependency installation is required.

Opening the HTML files directly, or publishing only the static files, lets visitors browse the pages but cannot save requests. Netlify hosting is now supported through `netlify/functions/api.mjs` and persistent private Netlify Blobs storage. Run `npm ci` to install that function's dependency. Follow **SETUP-NETLIFY-AND-GOOGLE.md** for deployment and Google setup. The local Node server still uses SQLite and needs no external service.

## Netlify and Google setup

The launch workflow is deferred until the owner has purchased a custom domain. Follow `SETUP-NETLIFY-AND-GOOGLE.md`: connect the domain, verify Google's Domain property through DNS, set the final `SITE_URL` and private inbox password, then deploy and submit the final domain's sitemap. The recommended DNS verification method does not require `GOOGLE_SITE_VERIFICATION` or an extra deployment for a verification tag.

`netlify.toml` builds the site with `npm run build`, publishes only `dist`, and bundles the API, separate logout route and scheduled cleanup function. Set a private `INBOX_PASSWORD` of at least 16 characters in Netlify's Functions environment settings before deploying. Hosted inbox passwords are managed through the hosting settings; changing the value and redeploying invalidates earlier sessions. Local SQLite records are not automatically migrated to Netlify.

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
- `payment.html`: Plan selection, Cleva USD and OPay NGN bank details, transfer notices and optional Stripe checkout
- `tutors.html`: Tutor screening and curriculum support
- `faq.html`: Frequently asked questions
- `resources.html`: Free worksheet requests and a link to the interactive tool
- `privacy.html`: Child protection and privacy
- `inbox.html`: Password-protected owner inbox for materials requests, trial bookings and bank transfer notices

Shared design and behavior are in `assets/site.css` and `assets/site.js`. Comic Relief is embedded in regular and bold weights and used first on every device for a consistent, close match to Comic Sans. The font loads from the website stylesheet without a third-party font service or an installed-font requirement. Comic Sans is a fallback only. Font source: https://github.com/loudifier/Comic-Relief (SIL Open Font License 1.1; the complete copyright and license notice is included in assets/site.css). The design stays black and white, including gradients, and respects reduced motion preferences.

Each photo has a single placement: the supplied online tutor on Home, the original exam photo on Our Tutors, the original study-desk photo on Resources, and Ekemini Akpan’s small portrait in the founder section on About. Main photos span the full page width with text over a dark gradient; photography is presented in monochrome to match the brand. Original image files are preserved in `assets/images`. The original math patterns are shared through `assets/math-pattern.svg` and `assets/math-pattern-dark.svg`, with the light pattern layered over content-section gradients. All public page headers have a soft white/grey radial glow over the black gradient, plus a medium-width white streak falling from top-left to bottom-right. The streak fades smoothly on both sides and drifts slowly behind the content, taking 26 seconds per pass. Reduced-motion preferences keep it stationary.

The three Why cards and six Explore cards use their separately assigned photo or video backgrounds, with white text over a dark gradient. The teaching card uses the supplied five-second recording as a muted looping background, with a play/pause button and a still frame when motion or data-saving preferences disable autoplay. Off-screen videos pause. The founder uses the newer square portrait, `ekemini-akpan-profile.jpg`.

The four parent names on Reviews are labelled display names: Mr Adewale Adeyemi, Mrs Nneka Okafor, Chinedu's mum, and Mrs Imaobong Udo. The original review text and locations are preserved.

Phone and tablet layouts retain the laptop styling and visible page navigation. On phones, groups of cards use horizontally scrollable rows with readable text and swipe hints. Tablets keep multi-column card and photo layouts where space permits. The viewport supports normal pinch-to-zoom.

## Bank transfers and optional Stripe checkout

USD bank transfer is available through the Cleva/Lead Bank receiving details supplied by the owner on 16 October 2026. Parents select a plan, copy the receiving details into their own bank/payment app, and send USD by ACH or domestic wire. The bank details appear only for USD. The website does not initiate transfers, request bank credentials, promise settlement times, or confirm receipt automatically. The account address is labelled as the account address, not the bank's address. Parents should check provider fees and contact the owner if a SWIFT code is required. Official reference: https://help.getcleva.com/en/articles/10202343-faqs-on-swift-transfers.

For NGN, the same payment section switches to the owner's OPay Digital Services Limited(OPay) account supplied on 16 October 2026. It replaces the USD receiving details, hides the USD routing/type/address fields, and shows the selected plan's naira amount. Both sets of public receiving details are in `assets/checkout-config.js`.

The “I’ve sent my transfer” form sends a private `payment` notice to the website inbox. The amount is the parent's reported amount, not a charge or confirmed payment. Every notice is labelled unverified; the owner must check the relevant Cleva or OPay account before confirming receipt or enrollment. Marking a notice read does not verify payment. Copy buttons fall back to selecting the text if clipboard access is unavailable.

Stripe Payment Links have not been supplied. Card checkout remains hidden until a matching link is configured. Bank transfers in both currencies work independently of Stripe.

1. Create Stripe Payment Links for the plans and currencies you want to accept. Match each link’s price, currency, and billing period to the offer shown on the website.
2. Paste the full `https://buy.stripe.com/...` URLs into the matching entries in `assets/checkout-config.js`.
3. Leave unavailable plan and currency combinations blank. The payment button automatically becomes available for configured combinations.
4. Verify the checkout with Stripe test links before using live links.

Flexible is the featured best plan and the default payment selection: three lessons per week during a calendar month at $160 / ₦224,000, with all Premium benefits and the existing Flexible extras. All four tutoring plan prices were reduced by 20% on 16 October 2026: Starter $16.80 / ₦24,000 per lesson, Growth $28.80 / ₦40,000 per week, Premium $45.60 / ₦64,000 per week, and Flexible $160 / ₦224,000 per calendar month. Confidence Week was excluded from the reduction. Parent calls are optional. Confidence Week is a $19.99 / ₦29,999 deposit, and checkout preserves decimal amounts. GBP quotes and 50% part payments are handled through contact. Stripe hosts checkout and handles payment confirmation; the website does not track payment status or activate enrollment automatically. Never place secret keys in website files.

## Contact and worksheet requests

The free-materials form appears on Home and Resources. Both it and the Contact trial-booking form submit directly to `/api/requests`. The server validates and saves requests in `.data/requests.sqlite` before returning a confirmation and reference number. A failed submission preserves the visitor's entries; retrying the same submission does not duplicate it. No email client or external form service is required.

Requests appear in the owner's website inbox. Saving a request does not automatically send learning materials or book a confirmed lesson: the owner reviews it and arranges fulfillment with the parent. The materials forms and their confirmation state that worksheets will be emailed within 48 hours of receiving the child's grade and topic.

## Owner inbox

Open `http://127.0.0.1:4173/inbox.html`. On the first server run, a private password is generated in `.data/inbox-password.txt`; it is never printed in server logs or served over HTTP. Use it to sign in, then choose **Change your inbox password** to set your own. The initial plaintext password file is removed after changing the password. Password hashes, sessions, and request contents are never sent to unauthenticated visitors.

The inbox supports filtering by type or unread status, reading full details, marking requests as new or read, and pagination. Sign-in sessions expire after 12 hours and are invalidated on sign-out or password change. Restarting the server signs out inbox users but preserves saved requests.

For non-Netlify Node hosting, run `node server.cjs` and configure `HOST=0.0.0.0` and the host's `PORT`. Set `DATA_DIR` to a persistent private directory, use HTTPS, and set `COOKIE_SECURE=true` when HTTPS terminates at your hosting provider. Back up the data directory with SQLite-aware tooling or while the server is stopped. Keep `.data`, `.env`, and all credentials out of source control; the server does not expose them as static files.

Optionally set a strong `INBOX_PASSWORD` of 12–256 characters through server environment settings. Setup and login enforce the same bounds. In that mode the password is managed through the environment, and changing it from the inbox is disabled. No inbox data or credentials should be committed or added to public website assets.

For Node hosting behind a reverse proxy, configure `TRUSTED_PROXIES` with only the actual proxy IP addresses or CIDR ranges supplied by the host, separated by commas. The default trusts no proxy and ignores forwarded client-address headers. A local proxy might use `127.0.0.1/32,::1/128`; use that only when it describes the actual connection. The proxy must append or overwrite `X-Forwarded-For` with the address it observes. Address resolution walks from the nearest hop to the first untrusted address, so arbitrary entries farther left cannot reset a visitor's allowance. Trust-all ranges are rejected. This setting is not used by Netlify, which supplies its own client address.

Run `npm test` to check form validation, private access, duplicate prevention, persistent storage, password changes, and rate limits.

Existing bookmarks such as `index.html#pricing` redirect to the section’s new page when JavaScript is enabled.


## Inbox and booking corrections (16 October 2026)

- The main Netlify function excludes `/api/inbox/logout`; `logout.mjs` owns that exact POST route without the hosting rate limit. Origin, session and current-deployment checks still apply. Ordinary API/login/submission limits remain enabled.
- Netlify inbox pages read a compact, private metadata index (`request-index/v1`) for ordering, totals and filters, then fetch only the selected page's request payloads (at most 30). The first use upgrades older indexes and recovers previously invisible stored requests. Before changing a request, a unique durable repair marker records its ID and target revision. Interrupted index updates are retried on inbox reads and by scheduled reconciliation; reads fail with a retry message while a repair is unavailable. In-flight markers survive until their target revision exists. Conditional writes and monotonic revisions reject stale repairs. Request contents are never copied into the index or repair markers.
- Inbox status changes are serialized per request, including automatic marking as read. The status button stays disabled during a pending update, even after refreshing the list. Responses from an older list or sign-in session cannot overwrite current status or counts; uncertain failures reload the authoritative state.
- `cleanup.mjs` runs every 15 minutes on production Netlify to delete expired session and rate-limit blobs and reconcile the inbox index against stored requests. Abandoned repair markers expire after 24 hours. It preserves active counters, credentials, inbox records and page counts. The local server already clears expired in-memory sessions and counters; SQLite inbox queries now use explicit filters and indexes.
- Old section bookmarks use an own-property allowlist on initial load and hash changes. Prototype properties and unexpected fragments cannot redirect or stop form setup.
- The homepage leads with the website booking form. Pricing shows frequency and payment coverage before expandable benefits; mobile card rows have Previous/Next controls and a position indicator.
- Booking requires an explicit curriculum selection, time zone and availability. Canadian provincial, IB, other and unsure options are available; matching is confirmed before booking. Older saved requests remain readable without the new fields.
- The supplied Grade 9 probability PDF is available at `assets/materials/grade9-probability-homework.pdf` from Resources, with a first-page preview and no email requirement. The original PDF is copied unchanged.
- Flexible bills by calendar month, rather than four-week blocks. Actual billing dates and lesson count are confirmed before payment. Tests are every two months; rescheduling requires at least two hours' notice. Extra lessons are limited and tutor-approved, with allowance confirmed before enrollment. No fixed extra-lesson quantity has been invented.
- Payment shows confirm plan → make transfer → send notice, with the selected price beside the receiving details. Verification is within 24 hours after both receipt of funds and receipt of the notice. Tutor profiles are intentionally deferred at the owner's request, and the founder introduction is unchanged.
