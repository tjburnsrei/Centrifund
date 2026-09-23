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

## Existing infrastructure connected

- Confirmed the Zendra Core project is `xntkmvovlbzipuhmbesl` (supabase-zendra-db) using its saved, working direct Postgres connection. This does not require a new Supabase project or subscription. The browser's Free organization was a different account context; the connected database does not itself expose billing-plan details.
- Applied migrations 001 and 002 on September 23, 2026: 11 Centrifund tables with RLS, namespaced service-only functions, and the private centrifund-call-audio bucket. Public table and existing Storage-policy fingerprints were unchanged across the transaction. No contacts were imported.
- Verified the current server secret authenticates successfully and the new private bucket responds through Storage. The saved legacy service-role JWT is retired; the app now supports the current SUPABASE_SECRET_KEY format.
- Zendra intentionally disables the general Data API (pgrst_no_exposed_schemas). The app's REST RPC transport cannot reach this project. Direct Postgres integration is the remaining compatibility change; adding Zendra's existing postgres@3.4.8 driver is pending explicit dependency approval required by the repository instructions. The rejected install made no dependency/lockfile changes. No public Data API setting was changed.
- Saved credentials only in ignored .env.admin.local and .env.production.local. The production file is separate from the synthetic development environment. No remote Vercel secrets have been written.
- Created an independent Vercel project, `zendra-labs/centrifund-calling` (`prj_3jfOEkGsGzs79OIls1j3PMqWelR6`), root apps/calling, Vite, Node 24. No deployment or Git integration was created. The calculator project is unchanged.

## Release gates — not yet completed

1. **Database transport:** approve the standard Postgres dependency, finish the direct server connection and verify the live empty-schema health check. The existing database is reachable; account switching is no longer the blocker.
2. **Secure configuration:** new Centrifund OpenAI key setup was requested but its confirmed project/key response has not arrived. Configure separate DeepSeek credentials, the selected project's server key, caller password, session secret and cron secret. Keep ADMIN_AUTH_ENABLED=false; email, Supabase Auth users and SMTP are not required. The existing Supabase server credential has been configured privately as authorized; AI credentials remain app-specific.
3. **Development integration:** verify real private Storage uploads, transcription, draft generation and session recovery in an isolated nonproduction database. Local development remains synthetic; do not connect a Vercel preview to the existing production database for tests. Confirm routing in a separate Vercel project rooted at apps/calling.
4. **Restore drill:** the local PostgreSQL-compatible export/restore test passed. A hosted Supabase backup restore into an isolated development project is still required; it has not been performed.
5. **Production import and deployment:** obtain approval for the exact checksum above and the configured deployment. The app is not publicly deployed, and no production contacts have been imported.
6. **Phone pilot:** on Jim's iPhone, open → call → return → record → review → save → reopen history; test microphone denial/interruption and Save to iPhone's native confirmation. Android Chrome remains an additional cross-browser check from the original plan.

## Local preview

Run `npm run dev:fixture` from `apps/calling`, open http://localhost:5180 and use the synthetic fixture password printed by the script. This previews typed calling workflows only. It does not simulate successful external AI, email or cloud Storage operations.

See [Jim's guide](JIM-GUIDE.md) for daily use and [operating notes](README.md) for import, access rotation, backup and recovery procedures.
