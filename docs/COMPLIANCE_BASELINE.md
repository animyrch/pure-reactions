# Compliance baseline

Engineering gap review of purereactions.com as of 28 October 2026. This is the spec for the stacked fixes. It is not a legal opinion, and it does not estimate whether any fine would actually be imposed.

Penalty figures below are the statutory maximums named in the review request. They are inflation-adjusted, fact-specific, and are not a prediction.

## Decisions locked for this baseline

- The bar is the stricter of a French establishment and US-user rules. Terms already choose French law. The live site is `https://purereactions.com`.
- Signup blocks anyone under 15. That covers COPPA's under-13 line and France's digital-consent age of 15. Store a confirmation timestamp only. Do not collect a birth date.
- Do not build a marketing-email program or a subscription program. Make the email and billing behavior that already exists conform.
- Self-host Manrope and Inter. Remove the service worker's Google Fonts cache rules.

## Facts the operator still has to supply

These block the legal-page pull request. They do not block fonts, the age gate, or the analytics consent gate.

- Legal name of the publisher (person or company)
- Postal address
- Telephone number
- Company identifiers if the publisher is a company (RCS, share capital, VAT)
- Name, postal address, phone, and email of the DMCA designated agent
- Confirmation, from the Firebase console, that the verification email template contains no promotional copy

## Summary

| # | Topic | Current situation | Minimal requirement | Proposed PR |
| --- | --- | --- | --- | --- |
| 1 | Age | Signup collects email and password only | Block under 15 before the account exists. Confirm existing users once. Keep export and deletion available. | `compliance-age-gate` |
| 2 | Fonts | Named faces are not loaded. The live service worker still caches Google Fonts hosts. | Self-host Manrope and Inter. Delete those cache rules. | `compliance-self-host-fonts` |
| 3 | Session replay | No replay tool is installed | Leave it that way. Do not add one. | None. Covered by the analytics consent PR for what GA actually does. |
| 4 | Email | One transactional verification email. No list, no campaign. | Keep that email transactional. Do not add a campaign. | `compliance-transactional-email` (console check plus a short policy sentence) |
| 5 | Subscriptions | No checkout. A public article says native tipping and subscriptions are coming soon. The repo license forbids commercial use. | Do not add billing. Remove the coming-soon claim. Fix the license page so it matches `LICENSE`. | `compliance-license-and-claims` |
| 6 | Copyright notices | Email intake only. No registered agent, no counter-notice, no unpublish path. | Register the agent, publish the notice details, add repeat-infringer terms, and unpublish on a valid notice. | `compliance-dmca` |
| 7 | GDPR and US privacy | Privacy page, export, and account deletion exist. Consent, controller identity, and complete erasure do not. | Consent before Google Analytics. Name the controller and processors. Fix deletion so it matches the schema. | `compliance-privacy-consent`, then `compliance-erasure` |
| 8 | Other public claims | `/open-source` says Apache 2.0. Landing copy says copyright risk is zero. | Match the real license. Qualify the copyright claims. | Same PR as subscriptions |

Suggested stack, each branched from the previous:

1. `compliance-baseline` — this document
2. `compliance-self-host-fonts`
3. `compliance-age-gate`
4. `compliance-privacy-consent`
5. `compliance-erasure`
6. `compliance-dmca`
7. `compliance-license-and-claims`
8. `compliance-transactional-email`

Player-host work for YouTube and TikTok is called out inside the privacy section. Ship it only after a playback check, as its own PR if the privacy-enhanced host breaks sync.

## 1. Age

### Current situation

Signup and login live on `src/routes/login/+page.svelte`. The signup form asks for email and password. `canSubmitSignUp` is true when the email is non-empty and the password rules pass. There is no age question, no terms checkbox, and no privacy checkbox.

`src/routes/+layout.js` creates the Firebase user with `createUserWithEmailAndPasswordWrapper` as soon as that form submits. The email is stored in Firebase Authentication before any age check can run.

Terms (`src/routes/terms/+page.svelte`) do not state a minimum age. The account-deletion doc mentions COPPA only as a reason deletion exists. Nothing in the signup path records parental consent.

Google sign-in is not offered on the login page. `GoogleAuthProvider` appears only in the account-deletion reauthentication flow.

### Minimal requirement

- Add an unchecked checkbox: "I am 15 or older." The signup button stays disabled until it is checked, the email is present, and the password is valid.
- On the same form, require an unchecked acknowledgement that the person has read the Terms and the Privacy Policy, with links to `/terms` and `/privacy`.
- If the person says they are under 15, do not call Firebase. Do not store the email they typed. Show a short refusal. Do not build a parental-consent flow in this stack.
- Write `ageConfirmedAt` on the `userData` document after the account exists. Store the server timestamp only. Do not store a date of birth, birth year, or age.
- Existing signed-in users who have no `ageConfirmedAt` see one confirmation before the next publish or account edit. Account export and account deletion stay available without that confirmation, so erasure is not gated on the new checkbox.
- A person can lie about their age. This baseline uses a neutral self-declaration, which is the ordinary minimum for a general-audience service. It does not add identity-document checks.

### Out of scope

- Parental consent, age estimation, or ID checks
- A separate under-13 deletion workflow beyond the existing account deletion

## 2. Fonts

### Current situation

`src/app.html` sets `font-family: Arial, sans-serif`.

`src/lib/constants/designTokens.js` names Manrope and Inter. Landing sections in `src/lib/components/landing/` reference `var(--font-display, 'Manrope', 'Inter', sans-serif)`. No stylesheet, `@font-face`, or `fonts.googleapis.com` link exists under `src/`.

The production homepage HTML served on 28 October 2026 does not request `fonts.googleapis.com` or `fonts.gstatic.com`. The five Manrope mentions are those font-family fallbacks. Visitors who do not have those faces installed get the next available font.

`vite.config.js` still registers Workbox runtime caches for `fonts.googleapis.com` and `fonts.gstatic.com`. The live service worker at `https://purereactions.com/sw.js` contains the cache names `google-fonts-cache` and `gstatic-fonts`. Those rules do not fetch a font by themselves. They would cache a Google Fonts response if any later page requested one.

The Munich court case about Google Fonts concerned the browser contacting Google and sending the visitor's IP address. That request is not happening on the current homepage. The service-worker rules are a latent path back to that request.

### Minimal requirement

- Self-host Manrope and Inter as `.woff2` files under `static/fonts/`.
- Declare them with `@font-face` from the site origin. Set `font-display: swap`.
- Point `--font-display` and the body font family at those faces, then the existing Helvetica/Arial fallbacks.
- Remove both Google Fonts `runtimeCaching` entries from `vite.config.js`.
- Keep the SIL Open Font License text beside the font files. Manrope and Inter allow self-hosting under that license.
- After deploy, the homepage, a reaction page, and `sw.js` should contain no `fonts.googleapis.com` or `fonts.gstatic.com` URL.

### Out of scope

- A new type scale or a redesign of landing type

## 3. Session replay

### Current situation

There is no Hotjar, FullStory, LogRocket, Microsoft Clarity, Sentry Replay, Mouseflow, or Smartlook dependency or script.

The only analytics call in `src/` is `src/lib/components/Analytics/GoogleAnalytics.svelte`. In production it injects `https://www.googletagmanager.com/gtag/js` and sends a page view. The code does not call `gtag` with an event, and it does not read input values.

The production HTML embeds `PUBLIC_GA_MEASUREMENT_ID` with value `G-T7TWND1C6C`, so this script is configured on the live site. It loads on mount with no consent check and no opt-out.

The privacy policy says the platform collects player interactions such as pause, play, and scrub. The application code does not send those interactions to Google Analytics. Creators' play, pause, and volume actions are stored as the sync timeline of their own reaction. That is the product, and it is written by the signed-in creator during recording.

`GoogleAnalytics.svelte` is mounted from `src/routes/+layout.svelte` for every route, including login.

### Minimal requirement

- Do not add a session-replay or keystroke-recording tool.
- In the Google Analytics property, leave form-field and session-recording features off. Enhanced measurement must not be turned on for content of form fields.
- The privacy policy should describe Google Analytics as page views, and describe the sync timeline as content the creator saves.
- Loading Google Analytics before consent is a privacy-consent gap, handled in section 7. It is not a reason to add session replay.

### Out of scope

- A replacement analytics vendor
- Deleting the sync timeline feature

## 4. Email

### Current situation

The only application send is Firebase Authentication's verification email, via `sendAccountVerificationEmail` in `src/lib/helpers/verificationEmail.js`. Signup copies tell the person to check that email.

There is no password-reset send in `src/`, no mailing-list provider, no campaign template, no unsubscribe link, and no postal address in the app.

CAN-SPAM's unsubscribe and postal-address duties apply to commercial email. A message whose purpose is to verify an account the person just created is transactional. The Firebase template itself lives in the Firebase console and is not in this repository, so this review could not read its subject line or body.

### Minimal requirement

- Do not add a launch list, newsletter, drip campaign, or any other marketing send.
- In the Firebase console, confirm the verification template identifies Pure Reactions, has a subject line that matches a verification message, and contains no promotional copy. Record that confirmation in the PR.
- Add one sentence to the privacy policy: account email is limited to verifying the address and to security messages required to operate the account.
- If a commercial message is ever proposed later, it needs a prior opt-in, the publisher's postal address, and a working unsubscribe. That work is outside this baseline.

### Out of scope

- A custom mailer, unsubscribe infrastructure, or a new email template in the repo

## 5. Subscriptions

### Current situation

No Stripe, Paddle, Lemon Squeezy, checkout route, price, or renewal button exists in `src/`.

`src/routes/insights/monetization-safety-guide/+page.svelte` says Pure Reactions is developing native tipping and subscription features.

`LICENSE` and the README license table are Creative Commons Attribution-NonCommercial 4.0. That license restricts selling access or subscriptions and running the project as a paid service.

California's automatic-renewal rules, and the federal ROSCA rules, attach when a business charges a consumer on a renewal plan. There is no charge and no renewal button today.

### Minimal requirement

- Do not add a subscription, tip, or other paid plan.
- Remove the "coming soon" tipping and subscription sentences from the monetization article.
- Leave the renewal-disclosure rule as a gate: if a paid renewal is ever added, the price, the renewal term, and the cancellation method have to sit immediately beside the consent button, the customer has to take an affirmative step, and an acknowledgement has to be sent. Do not build that UI now.

### Out of scope

- A billing provider, a pricing page, or a fake purchase button used only to display terms

## 6. Copyright notices and user content

### Current situation

Creators do not upload video files to Pure Reactions. The landing page and the record flow tell them to put the recording on their own YouTube channel and paste the URL. Original videos play from YouTube or TikTok embeds. The YouTube IFrame API is loaded from `https://www.youtube.com/iframe_api`. TikTok is embedded as an iframe. There is no Firebase Storage upload of media in `src/`.

The platform does store user-generated material:

- Reaction documents, including titles, sync timelines, and links to third-party videos
- Playlists and queues, including titles and descriptions
- Moments, including a title, tags, `creatorId`, and `creatorDisplayName`
- YouTube channel-claim documents

`src/routes/copyright/+page.svelte` asks rightsholders to email `purereactions.app+copyright@gmail.com` with a work identification, URLs, a description, and contact information. It does not name a designated agent, postal address, or phone number. Terms point at the same inbox. There is no counter-notice, no repeat-infringer rule, and no admin or API path whose job is to unpublish a reaction after a notice.

A registered agent is necessary for the DMCA safe-harbor notice process. Registration does not, by itself, create safe harbor. The service also has to adopt and reasonably implement a repeat-infringer policy, and it has to respond to valid notices.

### Minimal requirement

- Register a designated agent with the US Copyright Office and publish the agent's name, postal address, phone number, and email on `/copyright`.
- Accept notices that include the elements in 17 USC 512(c)(3): signature, work identified, material identified by URL, contact information, good-faith statement, and accuracy statement under penalty of perjury.
- On a complete notice, unpublish the identified reaction, playlist, queue, or moment. Keep a private log of the notice, the URLs, the date, and the action taken.
- Send the poster a description of what was removed and how to submit a counter-notice.
- Restore material only after a valid counter-notice and the waiting period the statute requires, unless the rightsholder has filed an action.
- Add a repeat-infringer rule to the Terms: accounts that are the subject of repeated valid notices are terminated.
- State on the copyright page that video files stay on YouTube or TikTok, and that Pure Reactions stores the sync data, titles, and links.

The agent's postal address and phone are operator facts. The PR can land the page structure and the unpublish path before those facts are filled in, and the page should not go to production with placeholders.

### Out of scope

- Hosting video files
- An automated copyright scanner
- A public counter-notice form that accepts anonymous submissions. Email replies to the notice address are enough for the minimum.

## 7. GDPR and the US privacy notices

### Current situation

What already exists:

- `/privacy`, effective 30 January 2026, and `/terms`, effective 20 January 2026, linked from the footer
- A statement that personal information is not sold
- Self-serve export at `POST /api/account/export`, documented in `docs/GDPR_DATA_EXPORT.md`, rate-limited to one export per user per 24 hours
- Self-serve deletion at `POST /api/account/delete`, with reauthentication and a recent sign-in check

What is missing or wrong:

- The privacy policy does not name a controller, a postal address, a legal basis, a retention period, or a supervisory authority. The international-users section says users are responsible for complying with GDPR and CCPA. That duty belongs to the operator.
- Signup does not link the Terms or the Privacy Policy.
- Google Analytics loads before any choice. There is no consent banner and no prior opt-out.
- The policy does not name the processors the app actually uses: Google (Firebase Authentication, Firestore, Realtime Database, YouTube, Google Analytics), Algolia, Netlify, and Cloudflare. The live site is behind Cloudflare.
- The policy does not say the app uses YouTube API Services, and it does not link to Google's privacy policy. The YouTube API Services terms require that disclosure.
- YouTube and TikTok players are third-party embeds. They receive the visitor's IP address when they load. The embed host in code is `www.youtube.com`, not `www.youtube-nocookie.com`.
- Account deletion in `src/routes/api/account/delete/+server.js` queries playlists and queues with `reactorId`. The schema says playlists use `userId` and queues use `ownerId`. The single-item delete path in `src/lib/server/deleteOwnedContent.js` uses `userId` and `ownerId`. Account deletion can leave playlists and queues in place.
- Account deletion does not delete `youtubeChannelClaims` or `youtubeChannelVerifications`. The export includes both.
- Moments store `creatorId` and `creatorDisplayName`. Account deletion updates `reactionCount` and does not remove the creator's identity from moments they created.
- Algolia removal waits for a later reindex. `docs/ACCOUNT_DELETION.md` says that can take up to five business days.
- There is no mentions légales page. A French site has to identify its publisher.

US additions under the stricter-of-both decision:

- The privacy page should include a California notice: categories collected (identifiers, commercial-free account data, internet activity in the form of page views, user content), the purposes, the statement that the service does not sell personal information, and a contact method for access and deletion. Export and deletion already implement those two requests.
- A small operator may be under the CPRA revenue and volume thresholds. Publish the notice anyway so the page still works if those thresholds are later met.

### Minimal requirement

Privacy consent PR:

- Add a banner with Accept and Reject. Reject is as easy to use as Accept. Nothing is pre-selected.
- Load `GoogleAnalytics.svelte` only after Accept. Remember the choice. Do not write the choice into Google Analytics before consent.
- Treat Firebase Authentication persistence as essential. Do not block login on the analytics choice.
- Rewrite `/privacy` so it names the controller, the contact email, the postal address once the operator supplies it, the purposes, the legal bases (contract for the account and the sync service, consent for Google Analytics, legitimate interest for security logs), the processors listed above, the retention rule, and the right to complain to the CNIL.
- Remove the sentence that makes users responsible for GDPR and CCPA compliance.
- Disclose YouTube API Services use and link to `https://policies.google.com/privacy`.
- Add `/legal` (mentions légales) with the publisher identity, and link it from the footer. Ship the route with the fields filled only when the operator facts exist.
- Describe retention in concrete terms: account data for the life of the account; deleted account data removed as part of the deletion request; analytics data under Google's retention setting, which should be set to the shortest period the property allows; security logs for no more than 12 months where the host allows that setting.

Erasure PR:

- Delete playlists where `userId` equals the caller, and queues where `ownerId` equals the caller. Keep the `reactorId` query as well so older documents are still found.
- Delete that user's `youtubeChannelClaims`. Delete `youtubeChannelVerifications` only when no other user still relies on that channel verification. If that rule is unsafe, detach the user's claim and leave the verification document, and say so in the PR.
- For moments with `creatorId` equal to the caller: delete the moment when no published reaction by someone else remains. When someone else's reaction remains, clear `creatorDisplayName` and replace `creatorId` with a non-identifying tombstone so the anchor keeps working.
- Delete the user's Algolia reaction records in the same deletion request.
- Add a regression test that a playlist stored with `userId`, a queue stored with `ownerId`, and a channel claim are gone after `POST /api/account/delete`.

YouTube and TikTok, after a playback check:

- Prefer the player host `https://www.youtube-nocookie.com` when the IFrame API and the sync engine still work.
- If that host breaks sync, load the player only after the visitor starts playback, and say that in the privacy policy.
- Do this in a separate PR if the host change is not a one-line config. Do not ship a player change that has not been played through a reaction, a playlist, and a shared session.

### Out of scope

- A data-protection officer appointment
- Standard contractual clauses copied into the repo. Name the processors and rely on their current transfer terms.
- A 30-day deletion grace period
- Changing the 24-hour export rate limit

## 8. Other gaps that should be fixed in this stack

### License page contradicts the license file

`/open-source` says the project is Apache License 2.0 and that commercial use is permitted. `LICENSE` and the README say CC BY-NC 4.0, and the README says selling subscriptions is restricted.

Minimal requirement: rewrite `/open-source` so it describes CC BY-NC 4.0, links to `LICENSE`, and drops the Apache and commercial-use sentences. Include this in `compliance-license-and-claims`.

### Absolute copyright claims on the landing page

The live homepage says "Copyright-safe. Always.", "No copyright headaches", and "Clean separation. Zero risk." The copyright page itself says creators are responsible for their own content and that the platform does not pre-review it.

Minimal requirement: replace those absolute lines with a description of what the product actually does. The recording and the original stay in separate files, and the original plays from its source. Do not claim that copyright risk is zero. Include this in `compliance-license-and-claims`.

### EU hosting duties that share the DMCA path

Pure Reactions stores user-generated text, links, and sync data for the public. Under the DSA, a hosting service needs a contact point, terms that explain what content is disallowed and how notices are handled, and a notice-and-action path.

Minimal requirement: the Terms list illegal content and copyright infringement as grounds for removal, name the contact email, and point at the notice process built in the DMCA PR. One intake path serves both. Do not add a separate moderation product.

A small service can still owe a transparency report. Leave the report as an annual operational task, not an application feature.

### Not in the minimal stack

- An accessibility statement and a WCAG audit. Worth a later pass. It is not required to close the eight items in this review.
- New security headers, a `security.txt`, or a change to Cloudflare. Worth knowing Cloudflare is a processor, which section 7 already covers.
- The file `secrets/` is gitignored. Do not commit credential files while doing these PRs.

## Verification for each later PR

- Fonts: load the homepage and a reaction page, confirm Manrope or Inter comes from the site origin, and confirm `sw.js` has no Google Fonts host.
- Age gate: signup with the checkbox off does not create a Firebase user. Signup with the checkbox on writes `ageConfirmedAt` and no birth date. An existing user without the flag can still export and delete.
- Analytics: with Reject, no request to `googletagmanager.com`. With Accept, page views still arrive. Login still works in both states.
- Erasure: the regression test above, plus an Algolia get that misses the deleted reaction ids.
- DMCA: a fixture notice unpublishes one reaction and writes a log entry. An incomplete notice does not.
- License and claims: `/open-source` matches `LICENSE`. The homepage and the monetization article no longer promise zero copyright risk or native subscriptions.
- Email: the PR records the Firebase template check. No new send is added.
