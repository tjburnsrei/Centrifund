# Centrifund Calls

A private mobile calling app and shared CRM foundation. This app is independent of the root loan calculator.

## Local development

Use Node 24. Install with `npm ci`, copy `.env.example` to ignored `.env.local`, and run `npm run dev`. The UI uses port 5180 and its Node API uses 5181. Never point local development or preview environments at the production database.

`npm run dev:fixture` starts the real application and database functions with synthetic contacts in an ephemeral local PostgreSQL-compatible runtime. It never loads real contact files. The console gives the local fixture password. Open http://localhost:5180 (the configured origin). Live transcription and drafting require separately configured API keys; fixture mode does not fake successful AI output.

Checks: `npm test`, `npm run test:database`, `npm run build`, and `npm run lint`. Also run the root calculator's build and tests from the repository root.

## Database and deployment

1. Reuse an existing project in TJ's **existing Pro organization**, after confirming the actual organization, project and backup status. Do not create another Pro organization. Reusing an existing project avoids another project's compute fee; normal usage charges can still apply. A separate project in the same organization is an optional isolation upgrade, currently from $10/month, and needs cost approval. [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).
2. Run the read-only `supabase/preflight.sql` in the intended project. It must return no collisions. Apply the ordered migration files only after reviewing the target and approving the production change. They create a private `centrifund_crm` schema, `public.centrifund_crm_*` functions and the private `centrifund-call-audio` bucket. The migrations are transactional, refuse existing names, and never change another application's tables, grants, Auth configuration, signup settings or SMTP. They were applied to the existing Zendra Core project on September 23, 2026; see IMPLEMENTATION-STATUS.md. Do not reapply them to that project. If a migration was already applied, use a reviewed forward migration; do not rerun or drop its schema.
3. Leave `ADMIN_AUTH_ENABLED=false`. The first release needs **no Supabase Auth users, email codes, publishable key or SMTP sender**. Use the private maintenance tool below for imports, edits, sharing and session revocation. A future web administrator screen remains optional behind an explicit server setting.
4. Set the app's environment variables privately. The server secret key, shared caller password, session secret and AI keys must never be VITE_* variables or enter the browser bundle. The server secret key is project-wide and bypasses RLS: schema separation is an application access boundary, not separate backend credentials. Keep the deployment and private maintenance environment accessible only to trusted administrators.
5. Create a separate Vercel project rooted at `apps/calling`. Production uses the selected existing project; local development uses synthetic data. Any hosted Preview integration tests must use a separate nonproduction database, never the production project's credentials. A free development project can stay in a Free organization if available; no second paid plan is needed. Match APP_ORIGIN to the exact deployment origin and configure the daily maintenance cron with CRON_SECRET.
6. Test with synthetic records, then approve the exact real-data import checksum and production release. Custom DNS remains separate.

Database migrations live with this application. Future CRM consumers use these stable contact IDs and access grants. Co-hosting does not automatically synchronize with Zendra or expose other records.

The selected Zendra project keeps its general Data API disabled. Its integration must use a server-only direct Postgres connection; enabling public database APIs is not required. The standard Postgres driver integration is pending dependency approval. Until it is complete, the maintenance commands below cannot operate against this project even though Storage authentication works.

## Initial contact import

Keep source files outside Git. Inspect a source without displaying contact details:

`npm run import:preview -- "C:\\Users\\thbur\\Downloads\\call-list.html"`

The private maintenance tool accepts the HTML's DATA array or equivalent JSON. It saves a review file and requires a separate checksum-confirmed import. Possible identity collisions are flagged and skipped; they are never silently merged. Resolve the source identity and upload a corrected file for skipped rows. Imported records are owned by Zendra and explicitly shared with the calling workspace. A repeated checksum is idempotent. A changed database requires a fresh preview before confirmation. Source checksum and row details are saved in the private review file. Contact facts may update; calls, follow-ups, bad numbers, opt-outs, and private notes never do.

If the old HTML was already used, its locally saved call history is not contained in the HTML file. Export and reconcile those browser notes separately before retiring that copy.

For a full import rehearsal, run `npm run import:rehearse -- "<private source path>"`. This creates an ephemeral local database, imports all rows, repeats the import, and verifies that synthetic history, follow-ups and phone/opt-out flags survive. Only aggregate counts are printed; neither source data nor a database file is written.

## Private maintenance without email login

On a trusted computer, place only SUPABASE_URL and SUPABASE_SECRET_KEY in ignored `.env.admin.local`. This tool does not require the caller password, OpenAI key or email setup. Every command requires the exact target project reference and refuses a mismatched URL before connecting. It creates an operator session, uses the same validated database operations, and revokes that session afterward. No maintenance HTTP endpoint or extra shared password is introduced.

Run from `apps/calling`:

`npm run admin -- --project <project-ref> health`

`npm run admin -- --project <project-ref> list`

`npm run admin -- --project <project-ref> show <contact-id>`

`npm run admin -- --project <project-ref> import-preview "<private source path>"`

Review the generated file in ignored `private-imports/`, including every ambiguous row, the target project, and exact source checksum. Then:

`npm run admin -- --project <project-ref> import-confirm "<review file>" <approved-sha256>`

For contact edits, phone corrections, private notes, sharing, or caller-session revocation, prepare an ignored JSON file containing `{ "action": "contact.share", "args": { "contactId": "<id>", "shared": false } }`, then run:

`npm run admin -- --project <project-ref> apply "<action JSON file>"`

Allowed actions are contact.edit (including its current revision), contact.share, contact.privateNote, contact.addPhone, contact.phoneFlag and session.revoke (empty args). Input validation is shared with the web API. List/detail/import-review and contact mutation results are saved to ignored private files instead of printing contact data to terminal logs. Never commit or attach those files to a PR. Review production changes before running them.

## Access and sessions

Caller login is a shared password configured in CALLER_PASSWORD. Activities are attributed to **Centrifund caller**, not an asserted individual identity. It grants shared contact access only. Web administrator login is disabled by default.

Opaque session tokens live in HttpOnly, SameSite cookies; the database stores hashes with 30-day expiry. A separate opaque device cookie binds recoverable caller drafts to the same browser across sign-ins. Changing CALLER_PASSWORD invalidates existing caller sessions. The private maintenance tool can revoke every caller session immediately. Changing SESSION_SECRET also invalidates caller password versions. Never claim that access revocation can erase an already exported iPhone contact.

Every API operation authenticates the session. The database operation checks contact sharing before returning or mutating records. Only the server key (mapped to the service_role database role) may invoke the Centrifund RPC functions. When web administration is disabled, the API also rejects old administrator sessions; the caller password cannot enable it. Private tables deny anon/authenticated access and enable RLS; the browser has no general database connection.

## iPhone use

Open in Safari; optionally use Share → Add to Home Screen. Tap **Save to iPhone** for a vCard containing name, company, valid phone numbers, and email. iOS controls its final add/merge confirmation. The website cannot silently write Contacts, detect existing address-book entries, or guarantee duplicate prevention. CRM notes and lending history are excluded from the exported contact.

## Reliability and recovery

A local IndexedDB draft is bound to one contact and one server draft ID. Server inputs are persisted before AI processing. Processing leases and revision checks prevent stale results. Final save appends the call and changes the confirmed follow-up in a single transaction; retrying a saved draft returns the same activity. A follow-up changed by another saved call must be reviewed before an older draft can replace or complete it.

Only completed or emitted audio chunks can be recovered from local storage; iOS may interrupt an active recording when the app is backgrounded. Review interrupted audio before saving. A cleared browser cache or a lost phone can remove notes that have not reached the server.

Raw audio is stored in a private bucket and removed after save/discard, with a daily retry sweep. Abandoned server recordings expire after seven days. The stored transcript and final text remain in the database. Failed drafts retain their input. Signed-upload paths are retained as cleanup tombstones for at least three hours after save/discard, so a late upload cannot become an untracked object. Never report a note as saved to CRM until the save transaction succeeds.

## Operations and backups

Use a paid production Supabase project with daily database backups. Verify backups are enabled and document the actual recovery window in the release record. Database backups do not include Storage object contents; temporary audio is intentionally disposable, while completed text lives in the database.

Before launch, restore a production-like backup into an isolated development project, verify contact counts, a known call and follow-up, and access boundaries, then document the result. Never test restoration against the running production project.

The private maintenance tool exposes processing-failure counts with its health command. Server logs contain request IDs, error codes, and timings without contacts or note text. A daily authenticated maintenance request deletes expired audio and stale rate-limit/session rows. Check Vercel failed executions and Supabase availability when a user reports a failure.

Release rollback: restore the previous Vercel deployment while keeping the additive database schema. Do not roll back by dropping contact or call tables.

## Deliberately deferred

Broader borrower migration, Pipedrive/Lendr sync, a full offline list, business-number telephony, automatic phone-call recording, outbound messaging, and native iPhone app distribution.

## Design references

This implementation follows the persisted-input, reviewed-draft, contact-binding and stale-revision safeguards from Zendra's [CRM capture work](https://github.com/Zendra-Labs/zendra-core/pull/306). It reuses those patterns with independent credentials and schema. It has no runtime dependency on Zendra, Pipedrive or Lendr.

If a web administrator screen is wanted later, explicitly enable ADMIN_AUTH_ENABLED, add confirmed Auth users to ADMIN_EMAILS, and configure the publishable key and production email sender. In a shared project, review its existing Auth configuration before making any project-wide changes. Email setup is not a launch requirement.

Provider contracts were checked against [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [DeepSeek structured chat completions](https://api-docs.deepseek.com/api/create-chat-completion/) and [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js). A configured development project is still required for live integration verification.
