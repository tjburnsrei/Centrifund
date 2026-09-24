// Opt-in live AI check. Only the two AI providers receive network requests.
// Contact, draft and Storage responses are synthetic and stay in memory.
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

if (process.argv.includes('--if-enabled') && process.env.CALLING_VERIFY_PROVIDERS !== '1') process.exit(0)

for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY']) if (!process.env[key]?.trim()) throw new Error('Missing required configuration: ' + key)
const audio = await readFile(new URL('./fixtures/provider-note.wav', import.meta.url))
const fixtureOrigin = 'https://calling-check.invalid'
Object.assign(process.env, { SUPABASE_URL: fixtureOrigin, SUPABASE_SECRET_KEY: 'sb_secret_synthetic_provider_check', CALLER_PASSWORD: 'synthetic-provider-check', SESSION_SECRET: 'synthetic-provider-check-session-secret', ADMIN_AUTH_ENABLED: 'false' })
const originalFetch = globalThis.fetch
const draftId = randomUUID(), lease = randomUUID()
let transcript = '', fields, transcriptSaved = false
const steps = []
const draft = { id: draftId, contact_id: randomUUID(), revision: 1, lease_token: lease, raw_text: '', transcript: '', audio_path: 'synthetic/note.wav', fields: { summary: '', outcome: '', nextAction: '', followUpDate: '' } }
const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true }, logLevel: 'silent' })
try {
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.href === fixtureOrigin + '/rest/v1/rpc/centrifund_crm_request') {
      const { p_action: action, p_args: args } = JSON.parse(init?.body || '{}')
      if (args.id !== draftId) throw new Error('Unexpected draft.')
      steps.push(action)
      if (action === 'draft.start') return Response.json(draft)
      if (args.lease !== lease) throw new Error('Unexpected processing lease.')
      if (action === 'draft.transcript') { transcript = args.transcript; transcriptSaved = Boolean(transcript); return Response.json({ ...draft, transcript }) }
      if (action === 'draft.complete') { if (!transcriptSaved) throw new Error('Transcript was not retained before generation.'); fields = args.fields; return Response.json({ ...draft, transcript, fields }) }
      if (action === 'draft.fail') return Response.json({ ...draft, transcript, status: 'failed' })
      throw new Error('Database operation blocked.')
    }
    if (url.href === fixtureOrigin + '/storage/v1/object/centrifund-call-audio/synthetic/note.wav') return new Response(audio, { headers: { 'Content-Type': 'audio/wav' } })
    const provider = url.href === 'https://api.openai.com/v1/audio/transcriptions' ? 'openai' : url.href === 'https://api.deepseek.com/chat/completions' ? 'deepseek' : null
    if (!provider || init?.method !== 'POST') throw new Error('Unexpected network destination blocked.')
    const response = await originalFetch(input, init)
    console.log(JSON.stringify({ check: provider, status: response.status }))
    return response
  }
  const { processDraft } = await vite.ssrLoadModule('/server/ai.ts')
  const request = new Request(fixtureOrigin, { headers: { cookie: 'cf_session=' + 'a'.repeat(64) } })
  await processDraft(request, draftId, 1)
  if (!transcriptSaved || !fields?.summary?.trim() || fields.followUpDate !== '2026-10-05' || !/richmond/i.test(transcript)) throw new Error('Synthetic note verification failed.')
  console.log(JSON.stringify({ check: 'live_provider_flow', passed: true, transcriptRetained: transcriptSaved, structuredNoteValidated: true, explicitDatePreserved: true, databaseRequestsSent: 0, storageRequestsSent: 0, steps }))
} catch {
  console.error(JSON.stringify({ check: 'live_provider_flow', passed: false, transcriptRetained: transcriptSaved, databaseRequestsSent: 0, storageRequestsSent: 0, steps }))
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
  await vite.close()
}
