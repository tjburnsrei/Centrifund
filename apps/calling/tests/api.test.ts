import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { maintain } from '../server/maintenance';
import { handle } from '../server/handler';
import { storage } from '../server/db';
let db: PGlite, cookie = '', contactId = '', privateId = '';
const base = 'http://localhost:5180';
const keys: Record<string, string[]> = { centrifund_crm_request: ['p_session_hash', 'p_password_version', 'p_action', 'p_args', 'p_allow_admin'], centrifund_crm_rate_limit: ['p_bucket', 'p_max', 'p_seconds'], centrifund_crm_create_session: ['p_token_hash', 'p_owner_id', 'p_role', 'p_password_version'], centrifund_crm_audio_cleanup: ['p_completed'] };
async function request(path: string, body?: unknown, session = cookie, requestOrigin = base) {
    return handle(new Request(base + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { cookie: session, origin: requestOrigin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
}
beforeAll(async () => {
    vi.stubEnv('APP_ORIGIN', base);
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('ADMIN_AUTH_ENABLED', 'false');
    vi.stubEnv('SUPABASE_URL', 'https://fixture.invalid');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key');
    vi.stubEnv('CALLER_PASSWORD', 'test-password');
    vi.stubEnv('SESSION_SECRET', 'test-session-secret');
    db = new PGlite();
    await db.exec('create role anon;create role authenticated;create role service_role;');
    await db.exec(await readFile(new URL('../supabase/migrations/001_calling.sql', import.meta.url), 'utf8'));
    contactId = randomUUID();
    privateId = randomUUID();
    await db.query("insert into centrifund_crm.contacts(id,owner_workspace,name,email) values($1,'zendra','Casey Example','casey@example.invalid'),($2,'zendra','Private Example','hidden@example.invalid')", [contactId, privateId]);
    await db.query("insert into centrifund_crm.contact_access values($1,'shared')", [contactId]);
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input), name = url.split('/').at(-1)!;
        if (!url.startsWith('https://fixture.invalid/rest/v1/rpc/') || !keys[name])
            throw new Error('Unexpected external request');
        const args = JSON.parse(String(init?.body));
        try {
            const values = keys[name].map(k => typeof args[k] === 'object' && k !== 'p_completed' ? JSON.stringify(args[k]) : args[k]);
            const data = await db.query<{
                result: unknown;
            }>('select public.' + name + '(' + values.map((_, i) => '$' + (i + 1)).join(',') + ') result', values);
            return Response.json(data.rows[0].result);
        }
        catch (e) {
            return Response.json({ message: (e as Error).message }, { status: 400 });
        }
    });
    const login = await request('/login', { password: 'test-password' }, '');
    cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}, 30000);
afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await db?.close(); });
describe('HTTP access boundary', () => {
    it('uses opaque HttpOnly cookies and private no-store responses', async () => {
        const response = await request('/login', { password: 'test-password' }, '');
        expect(response.status).toBe(200);
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
        expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(await response.text()).not.toContain('test-password');
    });
    it('denies anonymous reads and cross-origin mutations', async () => {
        expect((await request('/contacts', undefined, '')).status).toBe(401);
        expect((await request('/login', { password: 'test-password' }, '', 'https://untrusted.invalid')).status).toBe(403);
    });
    it('returns iPhone contact cards only for accessible contacts', async () => {
        const vcard = await request('/contacts/' + contactId + '/contact.vcf');
        expect(vcard.status).toBe(200);
        expect(vcard.headers.get('content-type')).toContain('text/vcard');
        expect(await vcard.text()).toContain('FN:Casey Example');
        expect((await request('/contacts/' + privateId + '/contact.vcf')).status).toBe(404);
        expect((await request('/contacts/' + contactId + '/contact.vcf', undefined, '')).status).toBe(401);
    });
    it('rejects caller import, private-note edits, and internal processing actions', async () => {
        expect((await request('/admin/import/preview', { source: '[]' })).status).toBe(403);
        expect((await request('/action', { action: 'contact.privateNote', args: { contactId, workspaceId: 'zendra', body: 'attempt' } })).status).toBe(403);
        expect((await request('/action', { action: 'draft.complete', args: {} })).status).toBe(400);
    });
    it('keeps failed processing input recoverable', async () => {
        const id = randomUUID();
        await request('/action', { action: 'draft.ensure', args: { id, contactId } });
        const update = await request('/action', { action: 'draft.update', args: { id, revision: 1, mutationId: randomUUID(), rawText: 'Preserve these new facts.', phoneId: null, fields: { summary: 'Preserve these new facts.', outcome: 'interested', nextAction: '', followUpDate: '' } } });
        const d = await update.json();
        const response = await request('/drafts/' + id + '/process', { revision: d.revision });
        expect(response.status).toBe(502);
        const recovered = await (await request('/action', { action: 'draft.get', args: { id } })).json();
        expect(recovered.raw_text).toBe('Preserve these new facts.');
        expect(recovered.status).toBe('failed');
    });
    it('denies audio preparation for another caller and a revoked contact', async () => {
        const id = randomUUID();
        await request('/action', { action: 'draft.ensure', args: { id, contactId } });
        const second = await request('/login', { password: 'test-password' }, '');
        const secondCookie = second.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
        expect((await request('/drafts/' + id + '/audio', { revision: 1, mime: 'audio/mp4', size: 123 }, secondCookie)).status).toBe(404);
        await db.query("delete from centrifund_crm.contact_access where contact_id=$1 and workspace_id='shared'", [contactId]);
        expect((await request('/drafts/' + id + '/audio', { revision: 1, mime: 'audio/mp4', size: 123 })).status).toBe(404);
        await db.query("insert into centrifund_crm.contact_access values($1,'shared')", [contactId]);
    });
    it('recovers an owned draft after signing back in on the same device', async () => {
        const login = await request('/login', { password: 'test-password' }, '');
        const original = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; '), id = randomUUID();
        await request('/action', { action: 'draft.ensure', args: { id, contactId } }, original);
        await request('/logout', {}, original);
        expect((await request('/action', { action: 'draft.get', args: { id } }, original)).status).toBe(401);
        const again = await request('/login', { password: 'test-password' }, original);
        const resumed = again.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
        expect((await request('/action', { action: 'draft.get', args: { id } }, resumed)).status).toBe(200);
    });
    it('retains transcription after a draft-provider failure and prepares a private signed upload', async () => {
        const id = randomUUID();
        await request('/action', { action: 'draft.ensure', args: { id, contactId } });
        const databaseFetch = fetch;
        vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
        vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
        let capturedPath = '';
        vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/storage/v1/object/upload/sign/')) {
                capturedPath = url.split('/centrifund-call-audio/')[1];
                return Response.json({ url: '/object/upload/sign/centrifund-call-audio/' + capturedPath + '?token=fixture-token' });
            }
            if (url.includes('/storage/v1/object/centrifund-call-audio/'))
                return new Response(new Blob(['synthetic audio'], { type: 'audio/mp4' }));
            if (url === 'https://api.openai.com/v1/audio/transcriptions')
                return Response.json({ text: 'Synthetic transcription preserved.' });
            if (url === 'https://api.deepseek.com/chat/completions')
                return Response.json({ error: 'fixture failure' }, { status: 500 });
            return databaseFetch(input, init);
        });
        try {
            const upload = await request('/drafts/' + id + '/audio', { revision: 1, mime: 'audio/mp4', size: 123 });
            expect(upload.status).toBe(200);
            expect((await upload.json()).url).toBe('https://fixture.invalid/storage/v1/object/upload/sign/centrifund-call-audio/' + capturedPath + '?token=fixture-token');
            expect((await request('/drafts/' + id + '/process', { revision: 1 })).status).toBe(502);
            const recovered = await (await request('/action', { action: 'draft.get', args: { id } })).json();
            expect(recovered.transcript).toBe('Synthetic transcription preserved.');
            expect(recovered.status).toBe('failed');
        }
        finally {
            vi.stubGlobal('fetch', databaseFetch);
        }
    });
    it('preserves human choices in AI drafts without writing a call automatically', async () => {
        const id = randomUUID();
        await request('/action', { action: 'draft.ensure', args: { id, contactId } });
        const update = await request('/action', { action: 'draft.update', args: { id, revision: 1, mutationId: randomUUID(), rawText: 'Discussed a purchase.', phoneId: null, fields: { summary: 'Discussed a purchase.', outcome: 'callback', nextAction: 'Call to discuss', followUpDate: '2026-10-01' } } });
        const draft = await update.json(), databaseFetch = fetch;
        vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
            if (String(input) === 'https://api.deepseek.com/chat/completions') {
                const payload = JSON.parse(String(init?.body));
                expect(JSON.stringify(payload)).not.toContain('hidden@example.invalid');
                return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: 'Discussed a purchase.', outcome: 'interested', nextAction: '', followUpDate: '' }) } }] });
            }
            return databaseFetch(input, init);
        });
        try {
            const result = await request('/drafts/' + id + '/process', { revision: draft.revision });
            expect(result.status).toBe(200);
            expect((await result.json()).fields).toMatchObject({ outcome: 'callback', nextAction: 'Call to discuss', followUpDate: '2026-10-01' });
            expect((await db.query('select * from centrifund_crm.activities where draft_id=$1', [id])).rows).toHaveLength(0);
        }
        finally {
            vi.stubGlobal('fetch', databaseFetch);
        }
    });
    it('disables email login and rejects old admin cookies in password-only mode', async () => {
        expect(await (await request('/config')).json()).toEqual({ adminEnabled: false });
        expect((await request('/admin/code', { email: 'admin@example.invalid' })).status).toBe(403);
        expect((await request('/admin/verify', { email: 'admin@example.invalid', code: '123456' })).status).toBe(403);
        const token = 'a'.repeat(64), tokenHash = createHash('sha256').update(token).digest('hex');
        await db.query("select public.centrifund_crm_create_session($1,'operator','admin',null)", [tokenHash]);
        const previousAdmin = 'cf_session=' + token;
        expect((await request('/session', undefined, previousAdmin)).status).toBe(403);
        expect((await request('/contacts/' + privateId, undefined, previousAdmin)).status).toBe(403);
        expect((await request('/action', { action: 'contact.share', args: { contactId: privateId, shared: true } }, previousAdmin)).status).toBe(403);
    });
    it('lets the private maintenance tool review imports, enforce the checksum, and revoke its sessions', async () => {
        const source = JSON.stringify([{ id: 999, name: 'Maintenance Example', phones: ['202-555-0155'] }]);
        const preview = await maintain('import-preview', source);
        await expect(maintain('import-confirm', { id: preview.id, sourceHash: '0'.repeat(64) })).rejects.toThrow('Contacts changed');
        expect((await maintain('import-confirm', { id: preview.id, sourceHash: preview.sourceHash })).inserted).toBe(1);
        expect((await maintain('import-confirm', { id: preview.id, sourceHash: preview.sourceHash })).inserted).toBe(1);
        await maintain('apply', { action: 'contact.share', args: { contactId, shared: false } });
        expect((await request('/contacts/' + contactId)).status).toBe(404);
        await maintain('apply', { action: 'contact.share', args: { contactId, shared: true } });
        await expect(maintain('apply', { action: 'draft.complete', args: {} })).rejects.toThrow('Unsupported');
        expect((await db.query("select * from centrifund_crm.sessions where owner_id='maintenance' and revoked_at is null")).rows).toHaveLength(0);
    });
    it('uses the current Supabase server key without treating it as a JWT', async () => {
        const databaseFetch = fetch;
        vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_fixture-only');
        vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            expect(headers.get('apikey')).toBe('sb_secret_fixture-only');
            expect(headers.has('authorization')).toBe(false);
            if (String(input).includes('/storage/v1/bucket/')) return Response.json({ public: false });
            return databaseFetch(input, init);
        });
        try {
            expect((await request('/contacts')).status).toBe(200);
            expect((await storage('bucket/centrifund-call-audio')).status).toBe(200);
        }
        finally { vi.stubGlobal('fetch', databaseFetch); vi.stubEnv('SUPABASE_SECRET_KEY', ''); }
    });
    it('invalidates a session on logout', async () => {
        expect((await request('/logout', {})).status).toBe(200);
        expect((await request('/session')).status).toBe(401);
    });
});
