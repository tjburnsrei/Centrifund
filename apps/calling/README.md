# Centrifund Calls

A private mobile calling app and shared CRM foundation. This app is independent of the root loan calculator.

## Local development

Use Node 24. Install with `npm ci`, copy `.env.example` to ignored `.env.local`, and run `npm run dev`. The UI uses port 5180 and its Node API uses 5181. Never point local development or preview environments at the production database.

`npm run dev:fixture` starts the real application and database functions with synthetic contacts in an ephemeral local PostgreSQL-compatible runtime. It never loads real contact files. The console gives the local fixture password. Open http://localhost:5180 (the configured origin). Live transcription and drafting require separately configured API keys; fixture mode does not fake successful AI output.

Checks: `npm test`, `npm run test:database`, `npm run build`, and `npm run lint`. Also run the root calculator's build and tests from the repository root.

## Database and deployment

1. Create separate development and production Supabase projects under TJ's administration. Confirm incremental paid production cost before provisioning.
2. Apply the ordered SQL files in `supabase/migrations` to the correct project. The first migration contains the portable schema and transactional operations; the second provisions the private audio bucket.
3. Create TJ's confirmed Supabase Auth user. Disable public signup, configure email OTP templates and a production SMTP sender, then set the exact email in `ADMIN_EMAILS`.
4. Set the app's environment variables privately. The service-role key, shared caller password, session secret, and AI keys must never be VITE_* variables or enter the browser bundle.
5. Create a separate Vercel project with root directory `apps/calling`. Set Production and Preview to distinct Supabase projects. Match APP_ORIGIN to the exact deployment origin. Configure the daily maintenance cron with CRON_SECRET.
6. Test the preview with synthetic records. Get approval for the exact real-data import checksum and production release. Do not change DNS without approval.

Database migrations live with this application. Future CRM consumers must use these stable contact IDs and access grants; do not introduce a second automatic master or duplicate this schema into the Zendra production project.

## Initial contact import

Keep source files outside Git. Inspect a source without displaying contact details:

`npm run import:preview -- "C:\\Users\\thbur\\Downloads\\call-list.html"`

The administrator screen accepts the HTML's DATA array or equivalent JSON. It saves a preview and requires a separate confirmation. Possible identity collisions are flagged and skipped; they are never silently merged. Resolve the source identity and upload a corrected file for skipped rows. Imported records are owned by Zendra and explicitly shared with the calling workspace. A repeated checksum is idempotent. A changed database requires a fresh preview before confirmation. Source checksum and row details are shown in the review. Contact facts may update; calls, follow-ups, bad numbers, opt-outs, and private notes never do.

If the old HTML was already used, its locally saved call history is not contained in the HTML file. Export and reconcile those browser notes separately before retiring that copy.

For a full import rehearsal, run `npm run import:rehearse -- "<private source path>"`. This creates an ephemeral local database, imports all rows, repeats the import, and verifies that synthetic history, follow-ups and phone/opt-out flags survive. Only aggregate counts are printed; neither source data nor a database file is written.

## Access and sessions

Caller login is a shared password configured in CALLER_PASSWORD. Activities are attributed to **Centrifund caller**, not an asserted individual identity. It grants shared contact access only. Admin email-code login is separate.

Opaque session tokens live in HttpOnly, SameSite cookies; the database stores hashes with 30-day expiry. A separate opaque device cookie binds recoverable caller drafts to the same browser across sign-ins. Changing CALLER_PASSWORD invalidates existing caller sessions. The admin screen can revoke every caller session immediately. Changing SESSION_SECRET also invalidates caller password versions. Never claim that access revocation can erase an already exported iPhone contact.

Every API operation authenticates the session. The database operation checks contact sharing before returning or mutating records. Only the server service role may invoke CRM functions. Private tables deny anon/authenticated access and enable RLS; the browser has no general database connection.

## iPhone use

Open in Safari; optionally use Share → Add to Home Screen. Tap **Save to iPhone** for a vCard containing name, company, valid phone numbers, and email. iOS controls its final add/merge confirmation. The website cannot silently write Contacts, detect existing address-book entries, or guarantee duplicate prevention. CRM notes and lending history are excluded from the exported contact.

## Reliability and recovery

A local IndexedDB draft is bound to one contact and one server draft ID. Server inputs are persisted before AI processing. Processing leases and revision checks prevent stale results. Final save appends the call and changes the confirmed follow-up in a single transaction; retrying a saved draft returns the same activity. A follow-up changed by another saved call must be reviewed before an older draft can replace or complete it.

Only completed or emitted audio chunks can be recovered from local storage; iOS may interrupt an active recording when the app is backgrounded. Review interrupted audio before saving. A cleared browser cache or a lost phone can remove notes that have not reached the server.

Raw audio is stored in a private bucket and removed after save/discard, with a daily retry sweep. Abandoned server recordings expire after seven days. The stored transcript and final text remain in the database. Failed drafts retain their input. Signed-upload paths are retained as cleanup tombstones for at least three hours after save/discard, so a late upload cannot become an untracked object. Never report a note as saved to CRM until the save transaction succeeds.

## Operations and backups

Use a paid production Supabase project with daily database backups. Verify backups are enabled and document the actual recovery window in the release record. Database backups do not include Storage object contents; temporary audio is intentionally disposable, while completed text lives in the database.

Before launch, restore a production-like backup into an isolated development project, verify contact counts, a known call and follow-up, and access boundaries, then document the result. Never test restoration against the running production project.

The admin screen exposes processing-failure counts. Server logs contain request IDs, error codes, and timings without contacts or note text. A daily authenticated maintenance request deletes expired audio and stale rate-limit/session rows. Check Vercel failed executions and Supabase availability when a user reports a failure.

Release rollback: restore the previous Vercel deployment while keeping the additive database schema. Do not roll back by dropping contact or call tables.

## Deliberately deferred

Broader borrower migration, Pipedrive/Lendr sync, a full offline list, business-number telephony, automatic phone-call recording, outbound messaging, and native iPhone app distribution.

## Design references

This implementation follows the persisted-input, reviewed-draft, contact-binding and stale-revision safeguards from Zendra's [CRM capture work](https://github.com/Zendra-Labs/zendra-core/pull/306). It reuses those patterns with independent credentials and schema. It has no runtime dependency on Zendra, Pipedrive or Lendr.

Provider contracts were checked against [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [DeepSeek structured chat completions](https://api-docs.deepseek.com/api/create-chat-completion/) and [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js). A configured development project is still required for live integration verification.
