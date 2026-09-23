# Implementation and release status — September 23, 2026

## Implemented

Independent app in `apps/calling`: mobile caller login, shared contact queue/search, native calling, Save to iPhone vCards, call outcomes, typed/recorded notes, reviewed AI drafts, history, follow-ups, recoverable local drafts, and idempotent saves. The first release uses the shared caller password only; email login is optional and disabled by default. A private maintenance tool handles reviewed imports, contact/phone edits, private notes, sharing, processing health and caller-session revocation.

The app-specific centrifund_crm namespace and private audio bucket can coexist with an existing Supabase application. A read-only preflight checks for name collisions, and a restrictive Storage policy prevents broad existing policies from exposing the new audio bucket. The SQL schema separates contact identity, access grants, private business notes, shared activity, sessions and drafts. Credentials are server-only. The app has no runtime dependency on the calculator or Zendra.

## Verification completed

- Calling app: lint, TypeScript/production build, and 46 tests passed.
- Calculator: lint, production build, and 107 tests passed.
- Database tests exercise sharing and private-note isolation, unauthorized requests and audio, stale revisions, concurrent follow-up changes, retry-safe saves, phone flags, opt-outs, queue ordering, import collisions, cleanup and local export/restore.
- Shared-project tests preserve another application's schema, function, grants, bucket and policy; reject namespace collisions; and block anonymous/authenticated access to calling audio even with an existing broad Storage policy. API tests reject old admin cookies when email login is disabled. The maintenance import/checksum/share/revocation path is verified against the local database.
- Provider contract tests use synthetic responses: transcript retention after AI failure and human-selected outcomes/dates are covered. These are not live provider tests.
- Chrome browser: password-only login with no administrator/email link, typed save and queue advance reverified after the shared-project change. Earlier synthetic login, note entry, refresh recovery, dated follow-up save, advance to next contact and saved history verified through the real app API and local database functions.
- Narrow-screen layout checked at a measured 391 CSS pixels; no horizontal overflow or application console errors. This is desktop Chrome, not physical iPhone Safari.
- Local private-source rehearsal reconciled **151 contacts / 413 phone methods / 1 contact without a phone**. No identity conflicts. Repeated import and updated-source import preserved synthetic calls, follow-ups, bad-number flags and opt-outs.
- Source SHA-256: `4d30247961b45c917ad4fad591784b819a8e989fd0348140abb590cf6094e642`.
- Original HTML and real contact data were not committed. Rehearsal data existed only in an ephemeral local database.

## Dedicated infrastructure provisioned

- On September 23, 2026, TJ approved a separate Supabase project and approximately $10/month additional compute under the existing Pro organization.
- Created **centrifund-calling** (project ref `dttvvkayggzzwejfjffq`, US East) inside Zendra Labs' existing Supabase Marketplace installation `icfg_BA1mfAJx15tbOS7pqG5kRdAS`. Its Vercel resource is `store_5k1RBpQhXkeLpEO1`. The provider reports it available, on Micro compute. The installation's base total is now **$35/month before overages**, with one Pro subscription and two Micro projects.
- This is a separate database instance from Zendra Core (`xntkmvovlbzipuhmbesl`). The calling app will use only the new project's keys, Storage and database. No runtime connection or automatic synchronization with Zendra is intended.
- Removed Zendra's credentials from both ignored calling environment files and selected the new project URL. The new keys are not installed locally yet. Never run the app with Zendra Core credentials.
- The separate Vercel project is `zendra-labs/centrifund-calling` (`prj_3jfOEkGsGzs79OIls1j3PMqWelR6`), root apps/calling, Vite, Node 24. It has no deployment or Git integration. The calculator project is unchanged.
- Connecting the new database and adding the app's production environment settings was blocked by automatic approval review: the repository requires explicit approval for this specific remote environment write. Approval is pending. No connection or remote environment mutation occurred.
- The existing REST RPC transport is appropriate for the new dedicated project. The previously proposed Postgres runtime dependency is no longer needed and was not installed.

## Earlier empty installation in Zendra

Migrations 001 and 002 were initially applied to Zendra Core before TJ clarified that he wanted a separate project. They added 11 namespaced Centrifund tables, service-only functions and a private audio bucket. Existing public-table and Storage-policy fingerprints were unchanged across that transaction; Zendra's Data API and Auth settings were not changed.

A fresh read-only check after creating the dedicated project found **zero contacts, access grants, phones, private notes, contact states, sessions, rate limits, drafts, activities, imports and audio objects**. Only the three initial workspace labels exist. This earlier scaffolding remains unused. Removing exactly those empty Centrifund objects requires the separately requested database-deletion approval; it has not been removed. Do not import data or run the calling app against Zendra.

## Release gates — not yet completed

1. **Dedicated database setup:** obtain the new project's credentials securely, apply the reviewed migrations only to `dttvvkayggzzwejfjffq`, and verify the empty-schema health and access controls. No contacts have been imported into either hosted project.
2. **Secure configuration:** the new Centrifund OpenAI key setup was requested, but its confirmed project/key response has not arrived. Configure app-specific DeepSeek credentials and complete the separately requested Vercel environment approval. Keep ADMIN_AUTH_ENABLED=false; email, Supabase Auth users and SMTP are not required.
3. **Development integration:** verify real private Storage uploads, transcription, draft generation and session recovery in an isolated nonproduction database. Local development remains synthetic; never connect previews to production for tests. No additional paid development resource has been provisioned.
4. **Restore drill:** the local PostgreSQL-compatible export/restore test passed. Verify hosted daily backups and perform a backup restore into an isolated development project before release. The hosted drill has not been performed.
5. **Production import and deployment:** obtain approval for the exact checksum above and the configured deployment. The app is not publicly deployed and no production contacts have been imported. Custom DNS remains separate.
6. **Phone pilot:** on Jim's iPhone, open → call → return → record → review → save → reopen history; test microphone denial/interruption and Save to iPhone's native confirmation. Android Chrome remains an additional cross-browser check from the original plan.

## Local preview

Run `npm run dev:fixture` from `apps/calling`, open http://localhost:5180 and use the synthetic fixture password printed by the script. This previews typed calling workflows only. It does not simulate successful external AI, email or cloud Storage operations.

See [Jim's guide](JIM-GUIDE.md) for daily use and [operating notes](README.md) for import, access rotation, backup and recovery procedures.
