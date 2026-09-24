# Implementation and release status — September 23, 2026

## Implemented

Independent app in `apps/calling`: mobile caller login, shared contact queue/search, native calling, Save to iPhone vCards, call outcomes, typed/recorded notes, reviewed AI drafts, history, follow-ups, recoverable local drafts, and idempotent saves. The first release uses the shared caller password only; email login is optional and disabled by default. A private maintenance tool handles reviewed imports, contact/phone edits, private notes, sharing, processing health and caller-session revocation.

The app runs in its own dedicated Supabase project. Its app-specific centrifund_crm namespace and private audio bucket also refuse naming collisions. A read-only preflight checks for name collisions, and a restrictive Storage policy prevents broad existing policies from exposing the new audio bucket. The SQL schema separates contact identity, access grants, private business notes, shared activity, sessions and drafts. Credentials are server-only. The app has no runtime dependency on the calculator or Zendra.

The Home Screen setup includes an opaque 180px Apple touch icon, 192px/512px manifest icons, a stable standalone app identity, expandable sign-in instructions and an updated iPhone guide. The instructions tell users to save pending notes to the CRM before switching browser containers.

## Verification completed

- September 23 Home Screen follow-up: lint, both TypeScript checks, production build and all 46 existing tests passed. PNG dimensions/routes/build inclusion verified. Expanded installation instructions checked in Chrome at a measured 391 CSS pixels with no horizontal overflow or browser warnings/errors. Physical iPhone installation and native flows remain part of the pilot.
- Calling app: lint, TypeScript/production build (including the new NodeNext server check), and 46 tests passed after the hosted runtime fixes. GitHub calling and calculator CI passed on commit 0781fa0.
- Calculator: lint, production build, and 107 tests passed.
- Database tests exercise sharing and private-note isolation, unauthorized requests and audio, stale revisions, concurrent follow-up changes, retry-safe saves, phone flags, opt-outs, queue ordering, import collisions, cleanup and local export/restore.
- Shared-project tests preserve another application's schema, function, grants, bucket and policy; reject namespace collisions; and block anonymous/authenticated access to calling audio even with an existing broad Storage policy. API tests reject old admin cookies when email login is disabled. The maintenance import/checksum/share/revocation path is verified against the local database.
- Provider contract tests use synthetic responses: transcript retention after AI failure and human-selected outcomes/dates are covered. These are not live provider tests.
- Chrome browser: password-only login with no administrator/email link, typed save and queue advance reverified after the shared-project change. Earlier synthetic login, note entry, refresh recovery, dated follow-up save, advance to next contact and saved history verified through the real app API and local database functions.
- Narrow-screen layout checked at a measured 391 CSS pixels; no horizontal overflow or application console errors. This is desktop Chrome, not physical iPhone Safari.
- Local private-source rehearsal reconciled **151 contacts / 413 phone methods / 1 contact without a phone**. No identity conflicts. Repeated import and updated-source import preserved synthetic calls, follow-ups, bad-number flags and opt-outs.
- Source SHA-256: `4d30247961b45c917ad4fad591784b819a8e989fd0348140abb590cf6094e642`.
- Original HTML and real contact data were not committed. Rehearsal data existed only in an ephemeral local database.

## Dedicated infrastructure configured

- TJ approved a separate Supabase project and approximately $10/month additional compute under the existing Pro organization, then approved production configuration and removal of the earlier empty setup.
- **centrifund-calling** (`dttvvkayggzzwejfjffq`, US East) belongs to Zendra Labs' existing Supabase Marketplace installation `icfg_BA1mfAJx15tbOS7pqG5kRdAS`. Its resource is `store_5k1RBpQhXkeLpEO1`. The installation reports **$35/month before overages**: one Pro subscription and two Micro projects.
- Applied migrations 001 and 002 to this dedicated project on September 23, 2026. Verified all 11 tables have RLS, anonymous/authenticated roles cannot execute the application RPC, service_role can, and the audio bucket is private. The application's live maintenance health check succeeded.
- Live HTTP checks: anonymous RPC access denied (401 / PostgreSQL 42501); private schema access denied (406); unauthenticated signed audio upload denied; server access to the private bucket succeeded (200).
- Connected this resource only to the **production environment** of `zendra-labs/centrifund-calling` (`prj_3jfOEkGsGzs79OIls1j3PMqWelR6`). Configured origin, caller password, session/cron secrets, disabled email administration and model settings. Caller/session/cron secrets are marked Sensitive. AI provider keys remain pending.
- Ignored local .env.admin.local, .env.production.local and .env.database.local contain only the new project's credentials. The normal synthetic development fixture does not load them. No Postgres runtime dependency was added.
- Prepared a hosted import preview and reconciled **151 contacts / 413 phone methods / 1 without a phone**, with no ambiguous matches and the unchanged source checksum above. The review is retained privately; **confirmation has not run and the calling contact list remains empty**.

## Protected deployment verified

The protected candidate is [centrifund-calling-6uqjkpizw-zendra-labs.vercel.app](https://centrifund-calling-6uqjkpizw-zendra-labs.vercel.app), deployment `dpl_KWzQQpJrsrxbNH3RMG26hckUtdDt`, source commit `0781fa0`. It was built with production configuration and automatic assignment of the public production URL disabled. It is not Jim's released app. The intended public origin is https://centrifund-calling.vercel.app.

Hosted testing found and fixed two deployment-specific issues: missing ESM file extensions in server imports, and nested API URLs not reaching the server function. Relative server imports now use .js extensions, the build checks NodeNext module rules, and an explicit /api/:path* rewrite targets api/index.ts.

**17 hosted smoke checks passed:** frontend, anonymous contact denial, cross-origin denial, login, Secure/HttpOnly/SameSite cookies, caller session, database-backed empty queue, administrator endpoint/action denial, nested contact/vCard/audio/processing authorization, maintenance authentication, logout and session revocation. Test sessions were logged out. These checks did not import contacts, save calls, upload recordings or call AI providers. The public release and physical phone workflow remain unverified.

## Zendra separation completed

The initial empty Centrifund installation in Zendra Core (`xntkmvovlbzipuhmbesl`) was removed after explicit approval. Guards verified zero contacts, calls, drafts, sessions, imports and audio objects before removal; only three initial workspace labels existed. The empty bucket was removed through Supabase's Storage API, and exactly the Centrifund tables, functions, schema and Storage policy were removed in a guarded transaction.

Zendra's **120 existing public tables** remained in place. Public-column, unrelated-function and existing-policy fingerprints matched before and after cleanup. Zendra's Data API, Auth settings and application configuration were unchanged. The calling app uses only its dedicated project's database, keys and Storage.

## Release gates — not yet completed

1. **AI credentials:** OpenAI transcription and DeepSeek summaries are retained after the September 23 cost comparison. The user authorized reuse of Zendra Website's keys, but both are marked Sensitive in Vercel and normal reads return no value; checked local environment files contain no usable copies. Supply saved copies privately or complete new-key setup before live AI testing. The calling production environment still has neither key. Email/SMTP is not required.
2. **Full integration:** verify real private Storage uploads, transcription, editable AI notes, retries and recovery with synthetic contacts in an isolated nonproduction database. The local fixture is ephemeral and no additional paid development project has been provisioned. Never attach production credentials to a preview for tests.
3. **Restore drill:** the local PostgreSQL-compatible export/restore test passed. Verify hosted daily backups and restore into an isolated development database before release. Hosted backup verification/restore has not been performed.
4. **Import and public release:** approve the exact reviewed source checksum and final configured release after integration checks. Run the checksum-gated import confirmation and promote the validated deployment. No contacts are active and the public URL is not released. Custom DNS remains separate.
5. **Phone pilot:** on Jim's iPhone, open → call → return → record → review → save → reopen history; test microphone denial/interruption and Save to iPhone's native confirmation.

## Local preview

Run `npm run dev:fixture` from `apps/calling`, open http://localhost:5180 and use the synthetic fixture password printed by the script. This previews typed calling workflows only. It does not simulate successful external AI, email or cloud Storage operations.

See [Jim's guide](JIM-GUIDE.md) for daily use and [operating notes](README.md) for import, access rotation, backup and recovery procedures.
