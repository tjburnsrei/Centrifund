import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseImport } from '../shared/import';
import { contactVcard } from '../shared/vcard';
import type { Contact } from '../shared/types';
import { fieldSchema, processDraft } from './ai';
import { ApiError, rpc, storage } from './db';
import { adminAllowed, adminAuth, checkOrigin, createSession, hash, requestDb, requireAdmin, throttle, verifyPassword } from './auth';
import { setting } from './config';
const uuid = z.string().uuid();
const revision = z.number().int().positive();
const actionSchemas: Record<string, z.ZodType> = {
    'draft.ensure': z.object({ id: uuid, contactId: uuid }).strict(),
    'draft.get': z.object({ id: uuid }).strict(),
    'draft.update': z.object({ id: uuid, revision, mutationId: uuid, rawText: z.string().max(20000), fields: fieldSchema, phoneId: uuid.nullable() }).strict(),
    'draft.save': z.object({ id: uuid, revision, completeFollowUp: z.boolean() }).strict(),
    'draft.discard': z.object({ id: uuid }).strict(),
    'contact.addPhone': z.object({ contactId: uuid, value: z.string().trim().min(7).max(50).refine(s => { const n = s.replace(/\D/g, ''); return n.length >= 7 && n.length <= 15; }) }).strict(),
    'contact.phoneFlag': z.object({ contactId: uuid, phoneId: uuid, isBad: z.boolean() }).strict(),
    'contact.share': z.object({ contactId: uuid, shared: z.boolean() }).strict(),
    'contact.edit': z.object({ contactId: uuid, revision, name: z.string().trim().min(1).max(300), company: z.string().max(300), city: z.string().max(200), county: z.string().max(200), email: z.union([z.email(), z.literal('')]) }).strict(),
    'contact.privateNote': z.object({ contactId: uuid, workspaceId: z.enum(['zendra', 'centrifund']), body: z.string().max(20000) }).strict(),
    'import.confirm': z.object({ id: uuid }).strict(),
    'session.revoke': z.object({}).strict(),
    'admin.health': z.object({}).strict()
};
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
function json(data: unknown, status = 200, cookies: string[] = []) { const h = new Headers({ ...headers, 'Content-Type': 'application/json' }); for (const c of cookies)
    h.append('Set-Cookie', c); return new Response(JSON.stringify(data), { status, headers: h }); }
async function body(request: Request) { const text = await request.text(); if (text.length > 2100000)
    throw new ApiError(413, 'TOO_LARGE', 'This request is too large.'); return JSON.parse(text); }
async function cleanup(onlyId?: string) {
    const pending = await rpc<{
        id: string;
        path: string;
    }[]>('crm_audio_cleanup', { p_completed: [] });
    const selected = pending.filter(row => !onlyId || row.id === onlyId).slice(0, 100);
    const done: string[] = [];
    if (selected.length) {
        const response = await storage('object/call-audio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: selected.map(row => row.path) }) });
        if (response.ok)
            done.push(...selected.map(row => row.id));
        else
            throw new ApiError(503, 'CLEANUP', 'Temporary audio cleanup needs retrying.');
    }
    if (done.length)
        await rpc('crm_audio_cleanup', { p_completed: done });
    return { deleted: done.length, pending: Math.max(0, pending.length - done.length) };
}
export async function handle(request: Request): Promise<Response> {
    const started = Date.now(), requestId = randomUUID();
    try {
        const url = new URL(request.url), path = url.pathname;
        checkOrigin(request);
        if (path === '/api/maintenance' && request.method === 'GET') {
            if (request.headers.get('authorization') !== 'Bearer ' + setting('CRON_SECRET'))
                throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized.');
            return json(await cleanup());
        }
        if (path === '/api/login' && request.method === 'POST') {
            await throttle(request, 'caller-login');
            const { password } = z.object({ password: z.string().max(200) }).parse(await body(request));
            if (!verifyPassword(password))
                throw new ApiError(401, 'PASSWORD', 'That password did not match.');
            return json({ ok: true }, 200, await createSession(request, 'caller'));
        }
        if (path === '/api/admin/code' && request.method === 'POST') {
            await throttle(request, 'admin-code', 5);
            const { email } = z.object({ email: z.email() }).parse(await body(request));
            if (adminAllowed(email))
                await adminAuth('otp', { email: email.toLowerCase(), create_user: false });
            return json({ ok: true });
        }
        if (path === '/api/admin/verify' && request.method === 'POST') {
            await throttle(request, 'admin-verify');
            const { email, code } = z.object({ email: z.email(), code: z.string().regex(/^\d{6,10}$/) }).parse(await body(request));
            if (!adminAllowed(email))
                throw new ApiError(401, 'SIGN_IN', 'Sign-in could not be completed.');
            const data = await adminAuth('verify', { email: email.toLowerCase(), token: code, type: 'email' });
            if (!data.user?.email_confirmed_at || !adminAllowed(data.user.email) || data.user.email.toLowerCase() !== email.toLowerCase())
                throw new ApiError(401, 'SIGN_IN', 'Sign-in could not be completed.');
            return json({ ok: true }, 200, await createSession(request, 'admin', data.user.id));
        }
        if (path === '/api/session' && request.method === 'GET')
            return json(await requestDb(request, 'session.me'));
        if (path === '/api/logout' && request.method === 'POST') {
            await requestDb(request, 'session.logout');
            return json({ ok: true }, 200, ['cf_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict']);
        }
        if (path === '/api/contacts' && request.method === 'GET')
            return json(await requestDb(request, 'contacts.list', { q: (url.searchParams.get('q') ?? '').slice(0, 200), view: url.searchParams.get('view') === 'all' ? 'all' : 'queue' }));
        const contactMatch = path.match(/^\/api\/contacts\/([a-f0-9-]+)(\/contact.vcf)?$/);
        if (contactMatch && request.method === 'GET') {
            const contact = await requestDb<Contact>(request, 'contact.get', { contactId: uuid.parse(contactMatch[1]) });
            if (contactMatch[2])
                return new Response(contactVcard(contact), { headers: { ...headers, 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'inline; filename="contact.vcf"' } });
            return json(contact);
        }
        if (path === '/api/action' && request.method === 'POST') {
            const data = z.object({ action: z.string(), args: z.unknown() }).parse(await body(request));
            const schema = actionSchemas[data.action];
            if (!schema)
                throw new ApiError(400, 'ACTION', 'Unknown operation.');
            const result = await requestDb(request, data.action, schema.parse(data.args) as object);
            if (['draft.save', 'draft.discard'].includes(data.action))
                await cleanup((data.args as {
                    id: string;
                }).id).catch(() => console.error(JSON.stringify({ event: 'calling_audio_cleanup_failed', requestId })));
            return json(result);
        }
        if (path === '/api/admin/import/preview' && request.method === 'POST') {
            await requireAdmin(request);
            const { source } = z.object({ source: z.string().max(2000000) }).parse(await body(request));
            return json(await requestDb(request, 'import.preview', { sourceHash: hash(source), rows: parseImport(source) }));
        }
        const audioMatch = path.match(/^\/api\/drafts\/([a-f0-9-]+)\/audio$/);
        if (audioMatch && request.method === 'POST') {
            const id = uuid.parse(audioMatch[1]);
            const data = z.object({ revision, mime: z.enum(['audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav']), size: z.number().int().positive().max(10485760) }).parse(await body(request));
            const draft = await requestDb(request, 'draft.get', { id });
            if (draft.revision !== data.revision)
                throw new ApiError(409, 'STALE', 'This draft changed. Reload it before uploading.');
            if (draft.status === 'saved' || draft.status === 'discarded' || draft.status === 'processing')
                throw new ApiError(409, 'CLOSED', 'This note has already been closed.');
            if (draft.audio_path) {
                const existing = await storage('object/call-audio/' + draft.audio_path, { method: 'HEAD' });
                if (existing.ok)
                    return json({ uploaded: true, path: draft.audio_path });
            }
            const extensions: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav' };
            const objectPath = draft.audio_path ?? id + '/' + randomBytes(16).toString('hex') + '.' + extensions[data.mime];
            if (!draft.audio_path)
                await requestDb(request, 'draft.audio', { id, revision: data.revision, path: objectPath });
            const r = await storage('object/upload/sign/call-audio/' + objectPath, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'false' }, body: '{}' });
            if (!r.ok)
                throw new ApiError(503, 'UPLOAD', 'Could not prepare the recording upload. Please retry.');
            const signed = await r.json();
            return json({ url: setting('SUPABASE_URL') + '/storage/v1' + signed.url, path: objectPath });
        }
        const processMatch = path.match(/^\/api\/drafts\/([a-f0-9-]+)\/process$/);
        if (processMatch && request.method === 'POST') {
            const id = uuid.parse(processMatch[1]), data = z.object({ revision }).parse(await body(request));
            await requestDb(request, 'draft.get', { id });
            await throttle(request, 'ai', 30, 3600);
            return json(await processDraft(request, id, data.revision));
        }
        throw new ApiError(404, 'NOT_FOUND', 'Page not found.');
    }
    catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError)
            return json({ error: 'Please check the supplied details.', code: 'VALIDATION', requestId }, 400);
        const status = error instanceof ApiError ? error.status : 503;
        const code = error instanceof ApiError ? error.code : 'UNAVAILABLE';
        if (status >= 500)
            console.error(JSON.stringify({ event: 'calling_request_failed', requestId, code, status, durationMs: Date.now() - started }));
        return json({ error: error instanceof ApiError ? error.message : 'The app is temporarily unavailable. Your unfinished notes have not been cleared.', code, requestId }, status);
    }
}
