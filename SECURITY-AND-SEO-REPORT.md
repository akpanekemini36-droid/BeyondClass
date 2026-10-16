# BeyondClass: SEO and security changes

Prepared 15 October 2026, following the three recordings supplied by Ekemini Akpan. They discuss Google discovery, a security checklist, and tools for animations, reusable components, backend features and analytics. These are practical changes and a local code review, not a guarantee against every vulnerability or a guarantee of Google rankings.

## Search improvements

- Replaced the unconfirmed `www.beyondclassmath.com` metadata with the owner's current address, `https://beyondclassmath.netlify.app`.
- Retained and improved the existing descriptive page titles, descriptions, share metadata and organization information. Titles describe each page's purpose. Existing business coverage—UK, US, Canada and Nigeria; GCSE, A Level, SAT, Common Core, WAEC and NECO—remains accurate to the supplied content.
- Added branded sharing imagery, an XML sitemap with the ten public pages, and a robots file pointing to that sitemap. The owner's inbox is excluded from the sitemap and has `noindex` instructions; actual inbox data also requires authentication.
- Added support for the real Google verification code through the `GOOGLE_SITE_VERIFICATION` build setting. No verification token has been invented.
- Added `SITE_URL` support for the new domain, including canonical links, structured data, sitemap/robots updates and a redirect from the current Netlify address.
- Preview builds receive a noindex header. Published production pages remain available to search engines.

The home page's requested headline, Comic Sans font, monochrome styling, images and hover effects remain in place. The privacy page explains the newly requested anonymous page-count feature. There is no keyword-stuffing or invented review-rating markup.

## Animation, components and analytics

The third recording recommends Motion Primitives, Watermelon UI and Manus as tools. The relevant features are implemented in the existing HTML/CSS/JavaScript site: subtle hero-text entrances, directional card-link animation, existing shared card/button/form styles, the Netlify backend and SEO setup, and the private analytics dashboard requested by the owner. Animations respect reduced-motion preferences. No new builder subscription or React migration is needed for these features; no external component code has been copied.

The private inbox now shows today's views, a daily chart and totals for each public page over 7 or 30 days. Analytics records contain only a UTC date and aggregate page counts. The client sends no visitor identifier, referral address, page query string or authentication cookie with its count request. It respects Do Not Track and Global Privacy Control; both backends also honor the corresponding request headers. The inbox is not counted, and reading counts requires owner authentication.

These are approximate page-load counts, including repeat loads, rather than unique-visitor counts. Blocked JavaScript, privacy preferences, network failures and abuse limits can reduce the counts. No historic traffic is imported. Netlify counts use the site's existing Functions/storage allowances rather than an external analytics service.

## Security checklist and implementation

| Area from the recording | Outcome |
| --- | --- |
| Admin access and permissions | Inbox reads, filters and status changes are checked on the server. Hiding a button is not used as authorization. |
| Database access / row-level protection | Local SQLite is private and queried only by the server. Netlify storage is private and accessed only by the function. The site has no browser-accessible PostgreSQL/Supabase database, so a PostgreSQL RLS switch is not applicable. |
| Password handling | Local passwords already use scrypt and random salts. The Netlify handler also uses scrypt, a persistent random salt, and constant-time comparison. The owner's hosted password comes from a private Functions environment variable; plaintext passwords are not stored in blobs or public files. |
| Login sessions | Authentication stays in HttpOnly, Secure, SameSite=Strict cookies on Netlify. Tokens are not put in localStorage. Stored session keys use token hashes; sessions expire after 12 hours. Sign-out revokes a session, and a password change followed by redeployment invalidates previous sessions. |
| Private files and credentials | `.env` variants, local request data, previews, dependency folders and Netlify credentials are excluded from source control. The build copies an explicit list of public pages and asset types into `dist`; it does not publish the project folder. |
| API secrets | No private credentials are added to frontend JavaScript. Stripe configuration contains only public Payment Links when the owner supplies them. |
| Logs and production diagnostics | Application responses do not expose internal errors, stack traces, submitted details, passwords, cookies or tokens. The application does not log request contents. Netlify may retain its own normal platform/access logs. |
| SQL injection | Existing SQLite queries remain parameterized. The Netlify implementation stores structured JSON and has no SQL string interpolation. |
| Request validation | Both hosting implementations use the same validation rules. The backend checks allowed request types, fields, lengths, email format and request-reference format. Requests have a 16 KB body limit. |
| Form retry integrity | Identical retries return the original confirmation. Reusing a reference with different details is rejected. Editing a form after a failed attempt creates a new reference token. Netlify's conditional storage writes prevent concurrent retries from creating duplicates. |
| Script injection | Inbox entries are rendered with textContent. A Content Security Policy blocks inline event handlers, embedded objects, foreign scripts and framing; inline structured data is covered by content hashes. Existing inline styling remains permitted to preserve the design. |
| Cross-site access | Mutating API requests require JSON and the exact site origin on Netlify. No permissive CORS header is added. The local server also checks origins. Browser cookies add cross-site protections. |
| Abuse controls | API traffic is bounded; login and public submissions have stricter limits. Netlify limits are stored persistently with atomic updates, rather than resetting whenever a function instance starts. An additional Netlify function rate limit is configured. |
| Dependency checks | The required Netlify storage library is pinned in package.json and package-lock.json. Dependency installation reported no known vulnerabilities at the time of the check. This must be rechecked as dependencies and advisories change. |
| Email verification | Parents do not create accounts or gain access by claiming an email address, so account-verification emails are not applicable. Syntax validation does not prove ownership of a parent's submitted address. Confirm the parent before sharing private student information. |
| Upload validation | Public file uploads are not offered, so no upload endpoint was added. This must be reviewed before enabling uploads. |
| Webhook verification | No payment webhook exists. Stripe Payment Links remain unconfigured, and this site does not claim to activate lessons based on a payment message. Signature verification will be required if webhooks are added later. |
| External security-review skill | The recording names Anthropic's Claude Code security-review skill. That skill is not installed in this workspace. A direct code review and automated checks were performed; no claim is made that Anthropic's skill ran. |

## Netlify compatibility

The previous local server uses Node and SQLite and cannot run from a static Netlify upload. The new Netlify function implements the same form and inbox API, backed by private persistent Netlify Blobs storage. Production and preview deployments use separate stores. Retired production deployments and alternate deployment hosts are blocked from the production API, so an older deployed function cannot remain an alternate route into the current inbox. The existing local server remains usable for development.

Production must be built and deployed with the supplied Netlify settings. The owner must configure `INBOX_PASSWORD`; the function refuses to confirm new requests while the inbox is unconfigured. Local requests and credentials are not copied to the public release package.

## Owner actions

The owner has chosen to defer the launch setup until after buying the custom domain. Follow **SETUP-NETLIFY-AND-GOOGLE.md** to connect that domain, verify Google's Domain property through DNS, configure the final website address and inbox password, publish the release, and submit the final domain's sitemap. This avoids first verifying and submitting the temporary Netlify address. Stripe Payment Links are still an owner setup item. The prepared source is not a confirmation that the live Netlify deployment or Google verification has been completed.

## Validation

- Automated checks cover the two inbox implementations, privacy, validation, duplicate prevention, concurrent rate limits, session expiry and password rotation, retired-deployment restrictions, video delivery, search metadata, safe build output and anonymous aggregate page counts.
- Browser checks loaded all ten public pages under the Content Security Policy and exercised the triangle, both forms, owner sign-in/sign-out, safe rendering of script-like text, and tablet/phone menus. No JavaScript or Content Security Policy errors were observed.
- Dashboard and browser checks cover the day-range selector, chart, cookie/referrer-free count requests, query-string omission, privacy preferences, and the new text animation.
- Netlify CLI 27.12.1 completed an offline production build, including API function bundling. Nothing was published by that check.
- The production Netlify storage service and Google ownership verification still need the owner's live setup and checks described in the guide.

References: [OWASP's Content Security Policy guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html), [Netlify Functions](https://docs.netlify.com/build/functions/overview/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), and [Google's sitemap instructions](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).


## Follow-up corrections: 16 October 2026

Logout now has its own Netlify function route outside the main function's hosting-level rate limit. It retains origin, session and deployment-origin validation. Inbox reads use a private metadata index and load only the selected page's detailed request payloads; older request blobs are indexed on first use. Conditional writes and record revisions protect index updates from concurrent submissions and delayed status changes. A production-only scheduled function deletes expired sessions and rate-limit records every 15 minutes without deleting parent requests or active records.

Booking forms now require curriculum, time zone and availability. Worksheet downloads are public and independent of form submission; the local server and safe build support the supplied PDF. Fragment redirects are limited to explicit own properties and also handle legitimate hash changes after initial load. Regression tests cover inherited fragments, hosting logout configuration, filtered page reads, legacy-index migration, concurrent index updates, expiry cleanup and booking validation.

Official implementation references: [Netlify Functions configuration](https://docs.netlify.com/build/functions/api/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## Inbox reliability and presentation follow-up

Request writes now persist a unique repair marker before modifying the canonical record. If an index write fails or its acknowledgement is lost, the next inbox read retries reconciliation. The production cleanup function also reconciles all records every 15 minutes, recovering previously invisible records from older indexes. Target revisions keep a concurrent inbox read from removing a marker before its status write commits; conditional index updates cannot overwrite a newer revision. An unavailable repair produces a retry message rather than a misleading incomplete inbox or unread count.

The inbox serializes automatic and manual status actions for each request, keeps refreshed cards locked while the operation is pending, and rejects responses from obsolete lists or sessions. Lost status responses trigger a fresh authoritative read. Regression checks simulate interrupted writes, failed index updates, older repairs, overlapping actions, refreshes and logout.

Non-Netlify Node hosting supports an explicit `TRUSTED_PROXIES` list of IP addresses or CIDR ranges. It defaults to trusting none; forwarded addresses from other connections are ignored. Trusted chains are evaluated from the nearest hop, stopping at the first untrusted address. IPv4-mapped IPv6 addresses normalize to the same identity. Tests verify independent limits for distinct visitors and rejection of spoofed forwarded identities. Node password setup and login both enforce 12–256 characters. Netlify's separate password policy remains 16–256 characters.

Worksheet request forms and their success messages now promise delivery within 48 hours, as confirmed by the owner. Comic Relief remains embedded in both regular and bold weights, independent of installed fonts; initial text display waits briefly for the embedded font rather than immediately showing a device font. All public page headers share the restored soft white/grey glow over their black background. Following the owner's confirmed direction, they also have a medium-width white streak falling from top-left to bottom-right, with soft fading edges and a slow 26-second drift. It stays behind the text, cannot intercept clicks, and stops moving when reduced motion is enabled.

Proxy implementation references: [Node network address utilities](https://nodejs.org/api/net.html), [Express guidance on trusted proxy address chains](https://expressjs.com/en/guide/behind-proxies/).

Validation of this follow-up: all 58 automated regression checks passed. Chrome checked all ten public page headers at 1440, 768 and 390 pixels, confirmed actual custom-font rendering, submitted a synthetic worksheet request, and exercised delayed status updates with a refresh and an attempted overlapping action. The Netlify production build bundled the API, logout and cleanup functions successfully; nothing was published.
