# Implementation and release status — September 23, 2026

## Implemented

Independent app in `apps/calling`: mobile caller login, shared contact queue/search, native calling, Save to iPhone vCards, call outcomes, typed/recorded notes, reviewed AI drafts, history, follow-ups, recoverable local drafts, and idempotent saves. Administrator email-code login, reviewed import, contact/phone edits, private notes, sharing, processing health and caller-session revocation are included.

The SQL schema separates contact identity, access grants, private business notes, shared activity, sessions and drafts. Credentials are server-only. The app has no runtime dependency on the calculator or Zendra.

## Verification completed

- Calling app: lint, TypeScript/production build, and 39 tests passed.
- Calculator: lint, production build, and 107 tests passed.
- Database tests exercise sharing and private-note isolation, unauthorized requests and audio, stale revisions, retry-safe saves, phone flags, opt-outs, queue ordering, import collisions, cleanup and local export/restore.
- Provider contract tests use synthetic responses: transcript retention after AI failure and human-selected outcomes/dates are covered. These are not live provider tests.
- Chrome browser: synthetic login, note entry, refresh recovery, dated follow-up save, advance to next contact and saved history verified through the real app API and local database functions.
- Narrow-screen layout checked at a measured 391 CSS pixels; no horizontal overflow or application console errors. This is desktop Chrome, not physical iPhone Safari.
- Local private-source rehearsal reconciled **151 contacts / 413 phone methods / 1 contact without a phone**. No identity conflicts. Repeated import and updated-source import preserved synthetic calls, follow-ups, bad-number flags and opt-outs.
- Source SHA-256: `4d30247961b45c917ad4fad591784b819a8e989fd0348140abb590cf6094e642`.
- Original HTML and real contact data were not committed. Rehearsal data existed only in an ephemeral local database.

## Release gates — not yet completed

1. **Provisioning approval:** approve the production database's incremental cost. Suggested isolated setup: a dedicated Pro organization with one Micro production project, currently $25/month base; development stays in a separate Free project if the account has capacity. Supabase lists an additional Micro project on a paid organization from $10/month. Keep its spend cap enabled. Confirm the checkout total before payment; AI and email service usage are separate. [Current Supabase pricing](https://supabase.com/pricing).
2. **Secure configuration:** new Centrifund OpenAI key setup was requested but its confirmed project/key response has not arrived. Configure separate DeepSeek credentials, Supabase service/publishable keys, exact admin email, production SMTP, caller password, session secret and cron secret. No working credentials have been copied from Zendra.
3. **Development integration:** apply both migrations to an isolated Supabase development project and verify real private Storage uploads, transcription, draft generation, admin email delivery and session recovery. Confirm Vercel routing against a preview deployment rooted at `apps/calling`.
4. **Restore drill:** the local PostgreSQL-compatible export/restore test passed. A hosted Supabase backup restore into an isolated development project is still required; it has not been performed.
5. **Production import and deployment:** obtain approval for the exact checksum above and the configured deployment. The app is not publicly deployed, and no production contacts have been imported.
6. **Phone pilot:** on Jim's iPhone, open → call → return → record → review → save → reopen history; test microphone denial/interruption and Save to iPhone's native confirmation. Android Chrome remains an additional cross-browser check from the original plan.

## Local preview

Run `npm run dev:fixture` from `apps/calling`, open http://localhost:5180 and use the synthetic fixture password printed by the script. This previews typed calling workflows only. It does not simulate successful external AI, email or cloud Storage operations.

See [Jim's guide](JIM-GUIDE.md) for daily use and [operating notes](README.md) for import, access rotation, backup and recovery procedures.
