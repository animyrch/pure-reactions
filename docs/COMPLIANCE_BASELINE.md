# Compliance baseline

Engineering gap review of purereactions.com as of 28 October 2026. This is the spec for the stacked fixes. It is not a legal opinion, and it does not estimate whether any fine would actually be imposed.

Penalty figures below are the statutory maximums named in the review request. They are inflation-adjusted, fact-specific, and are not a prediction.

## Decisions locked for this baseline

- The bar is the stricter of a French establishment and US-user rules. Terms already choose French law. The live site is `https://purereactions.com`.
- Signup blocks anyone under 15. That covers COPPA's under-13 line and France's digital-consent age of 15. Store a confirmation timestamp only. Do not collect a birth date.
- Do not build a marketing-email program or a subscription program. Make the email and billing behavior that already exists conform.
- Self-host Manrope and Inter. Remove the service worker's Google Fonts cache rules.
- The public contact stays the existing addresses: `purereactions.app+privacy@gmail.com` and `purereactions.app+copyright@gmail.com`. Do not publish a personal name, postal address, or phone number.
- The app does not upload or host video. Originals and reactions play through the official YouTube and TikTok embeds. The copyright minimum is to say that on the copyright page, keep the copyright email, and remove absolute risk claims. Registering a DMCA agent is optional and later.

## Operator input still needed

No personal identity facts are required for any pull request in this stack.

The email pull request still needs one check in the Firebase console: the verification template identifies Pure Reactions, the subject line matches a verification message, and the body has no promotional copy. That check does not block fonts, the age gate, or the privacy pages.

## Summary

| # | Topic | Current situation | Minimal requirement | Proposed PR |
| --- | --- | --- | --- | --- |
| 1 | Age | Signup collects email and password only | Block under 15 before the account exists. Confirm existing users once. Keep export and deletion available. | `compliance-age-gate` |
| 2 | Fonts | Named faces are not loaded. The live service worker still caches Google Fonts hosts. | Self-host Manrope and Inter. Delete those cache rules. | `compliance-self-host-fonts` |
| 3 | Session replay | No replay tool is installed | Leave it that way. Do not add one. | None. Covered by the analytics consent PR for what GA actually does. |
| 4 | Email | One transactional verification email. No list, no campaign. | Keep that email transactional. Do not add a campaign. | `compliance-transactional-email` (console check plus a short policy sentence) |
| 5 | Subscriptions | No checkout. A public article says native tipping and subscriptions are coming soon. The repo license forbids commercial use. | Do not add billing. Remove the coming-soon claim. Fix the license page so it matches `LICENSE`. | `compliance-license-and-claims` |
| 6 | Copyright | No media upload. Both streams play through official YouTube and TikTok embeds. The copyright page is an email intake. The homepage promises zero copyright risk. | Keep the copyright email. Describe the embed model on the copyright page. Remove the absolute risk lines. | `compliance-license-and-claims` |
| 7 | GDPR and US privacy | Privacy page, export, and account deletion exist. Analytics loads before consent. Erasure does not match the schema. | Consent before Google Analytics. Identify the controller by the product name and the privacy email. Name the processors. Fix deletion so it matches the schema. | `compliance-privacy-consent`, then `compliance-erasure` |
| 8 | Other public claims | `/open-source` says Apache 2.0. Landing copy says copyright risk is zero. | Match the real license. Describe the embed model instead of guaranteeing a legal outcome. | Same PR as the copyright copy |

Suggested stack, each branched from the previous:

1. `compliance-baseline` — this document
2. `compliance-self-host-fonts`
3. `compliance-age-gate`
4. `compliance-privacy-consent`
5. `compliance-erasure`
6. `compliance-license-and-claims`
7. `compliance-transactional-email`

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
- If a commercial message is ever proposed later, it needs a prior opt-in and a working unsubscribe. That work is outside this baseline. A postal address is a commercial-email duty only if that program is added.

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

## 6. Copyright

### Current situation

The app has no media upload. There is no file input and no Firebase Storage upload in `src/`. A creator pastes a YouTube or TikTok URL. The original and the reaction both stay on those platforms and play through their official embeds. The YouTube IFrame API is loaded from `https://www.youtube.com/iframe_api`. TikTok is embedded as an iframe.

What this app stores is the URL, the sync timings, titles, playlists, queues, moment labels, and channel-claim records. Those records are not copies of the video.

`src/routes/copyright/+page.svelte` already says Pure Reactions does not host or reupload original third-party videos, and it already gives rightsholders `purereactions.app+copyright@gmail.com`. Terms point at the same inbox. Removing a reaction deletes the link and the sync record. The video file stays on YouTube or TikTok.

The homepage still promises a legal outcome the embed design does not deliver: "Copyright-safe. Always.", "No copyright headaches", and "Clean separation. Zero risk."

The DMCA storage safe harbor, the $6 designated-agent registration, and statutory damages for a willfully infringed copy are about a service that stores the copyrighted file. This app does not. Registering an agent also publishes a name, street address, and phone. That registration is optional insurance for the links and the index, not part of this minimum.

### Minimal requirement

- On `/copyright`, state the product model in plain language: Pure Reactions does not upload or host the original or the reaction. Both play from YouTube or TikTok through those platforms' official embeds. The app stores the link and the sync timings.
- Keep `purereactions.app+copyright@gmail.com` as a contact for questions. Do not add an agent name, postal address, or phone.
- Say that the video stays on YouTube or TikTok, under the control of whoever published it. They can make it private, turn embedding off, or ask that platform to remove an unauthorized upload. Do not offer the copyright email as a way to have a reaction page deleted. Do not build a notice log, a counter-notice flow, or a separate unpublish tool.
- Remove the absolute risk lines on the homepage. The replacement describes the embed model. It does not say the copyright risk is zero. That copy lands in `compliance-license-and-claims` with the license-page fix.

### Out of scope

- DMCA designated-agent registration, a repeat-infringer policy, and a counter-notice process
- Hosting video files, or a file upload
- An automated copyright scanner

## 7. GDPR and the US privacy notices

### Current situation

What already exists:

- `/privacy`, effective 30 January 2026, and `/terms`, effective 20 January 2026, linked from the footer
- A statement that personal information is not sold
- Self-serve export at `POST /api/account/export`, documented in `docs/GDPR_DATA_EXPORT.md`, rate-limited to one export per user per 24 hours
- Self-serve deletion at `POST /api/account/delete`, with reauthentication and a recent sign-in check

What is missing or wrong:

- The privacy policy does not state a legal basis, a retention period, or a supervisory authority. The contact email is already `purereactions.app+privacy@gmail.com`. The international-users section says users are responsible for complying with GDPR and CCPA. That duty belongs to the operator.
- Signup does not link the Terms or the Privacy Policy.
- Google Analytics loads before any choice. There is no consent banner and no prior opt-out.
- The policy does not name the processors the app actually uses: Google (Firebase Authentication, Firestore, Realtime Database, YouTube, Google Analytics), Algolia, Netlify, and Cloudflare. The live site is behind Cloudflare.
- The policy does not say the app uses YouTube API Services, and it does not link to Google's privacy policy. The YouTube API Services terms require that disclosure.
- YouTube and TikTok players are third-party embeds. They receive the visitor's IP address when they load. The embed host in code is `www.youtube.com`, not `www.youtube-nocookie.com`.
- Account deletion in `src/routes/api/account/delete/+server.js` queries playlists and queues with `reactorId`. The schema says playlists use `userId` and queues use `ownerId`. The single-item delete path in `src/lib/server/deleteOwnedContent.js` uses `userId` and `ownerId`. Account deletion can leave playlists and queues in place.
- Account deletion does not delete `youtubeChannelClaims` or `youtubeChannelVerifications`. The export includes both.
- Moments store `creatorId` and `creatorDisplayName`. Account deletion updates `reactionCount` and does not remove the creator's identity from moments they created.
- Algolia removal waits for a later reindex. `docs/ACCOUNT_DELETION.md` says that can take up to five business days.

US additions under the stricter-of-both decision:

- The privacy page should include a California notice: categories collected (identifiers, commercial-free account data, internet activity in the form of page views, user content), the purposes, the statement that the service does not sell personal information, and a contact method for access and deletion. Export and deletion already implement those two requests.
- A small operator may be under the CPRA revenue and volume thresholds. Publish the notice anyway so the page still works if those thresholds are later met.

### Minimal requirement

Privacy consent PR:

- Add a banner with Accept and Reject. Reject is as easy to use as Accept. Nothing is pre-selected.
- Load `GoogleAnalytics.svelte` only after Accept. Remember the choice. Do not write the choice into Google Analytics before consent.
- Treat Firebase Authentication persistence as essential. Do not block login on the analytics choice.
- Rewrite `/privacy` so it identifies the controller as Pure Reactions, gives `purereactions.app+privacy@gmail.com` as the contact, and states the purposes, the legal bases (contract for the account and the sync service, consent for Google Analytics, legitimate interest for security logs), the processors listed above, the retention rule, and the right to complain to the CNIL. Do not add a personal name, postal address, or phone.
- Remove the sentence that makes users responsible for GDPR and CCPA compliance.
- Disclose YouTube API Services use and link to `https://policies.google.com/privacy`.
- Do not add a mentions légales page in this stack. A professional French publisher notice would publish a name and street address. That notice is optional and later, same as the DMCA agent.
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

The live homepage says "Copyright-safe. Always.", "No copyright headaches", and "Clean separation. Zero risk."

Minimal requirement: replace those lines with the embed model from section 6. Both videos stay on YouTube or TikTok and play through the official embeds. Do not claim that copyright risk is zero. Include this in `compliance-license-and-claims` with the copyright-page wording.

### Removal requests

The copyright page explains that playback stops when the host stops serving the video. The copyright email stays as a contact for questions. It is not a promise to delete a reaction page.

Do not add a registered agent, a counter-notice flow, or a moderation product in this stack. A transparency report, if one is ever owed, stays an operational task outside the app.

### Not in the minimal stack

- An accessibility statement and a WCAG audit. Worth a later pass. It is not required to close the eight items in this review.
- New security headers, a `security.txt`, or a change to Cloudflare. Worth knowing Cloudflare is a processor, which section 7 already covers.
- The file `secrets/` is gitignored. Do not commit credential files while doing these PRs.

## Verification for each later PR

- Fonts: load the homepage and a reaction page, confirm Manrope or Inter comes from the site origin, and confirm `sw.js` has no Google Fonts host.
- Age gate: signup with the checkbox off does not create a Firebase user. Signup with the checkbox on writes `ageConfirmedAt` and no birth date. An existing user without the flag can still export and delete.
- Analytics: with Reject, no request to `googletagmanager.com`. With Accept, page views still arrive. Login still works in both states.
- Erasure: the regression test above, plus an Algolia get that misses the deleted reaction ids.
- License and claims: `/open-source` matches `LICENSE`. `/copyright` describes the embed model, says the host controls the video, and does not offer to delete a reaction page. The homepage and the monetization article no longer promise zero copyright risk or native subscriptions.
- Email: the PR records the Firebase template check. No new send is added.
