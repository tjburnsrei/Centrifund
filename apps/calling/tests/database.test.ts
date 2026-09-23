import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
let db: PGlite;
const caller = 'caller-token', other = 'other-token', admin = 'admin-token', version = 'v1';
let shared: string, privateId: string, phone: string;
const rpc = async (action:string,args:Record<string,any>={},session=caller) => {
 if(action==='draft.save'&&!('expectedFollowUp' in args)){
  const result=await db.query<{result:any}>("select jsonb_build_object('nextAction',s.next_action,'followUpDate',s.follow_up_date,'lastCalledAt',s.last_called_at) result from crm.drafts d left join crm.contact_state s on s.contact_id=d.contact_id and s.workspace_id='shared' where d.id=$1",[args.id]);
  args={...args,expectedFollowUp:result.rows[0]?.result};
 }
 return (await db.query<{result:any}>('select public.crm_request($1,$2,$3,$4::jsonb) result',[session,version,action,JSON.stringify(args)])).rows[0].result;
};
const fields = (outcome = 'interested', summary = 'Discussed a future purchase.') => ({ summary, outcome, nextAction: '', followUpDate: '' });
async function draft(contactId = shared, session = caller) { const id = randomUUID(); await rpc('draft.ensure', { id, contactId }, session); return id; }
async function update(id: string, values = fields(), revision = 1, session = caller, mutationId = randomUUID()) {
    return rpc('draft.update', { id, revision, mutationId, rawText: values.summary, fields: values, phoneId: phone }, session);
}
beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase/migrations/001_calling.sql', import.meta.url), 'utf8'));
    for (const [token, owner, role] of [[caller, 'device-one', 'caller'], [other, 'device-two', 'caller'], [admin, 'admin-one', 'admin']]) {
        await db.query('select public.crm_create_session($1,$2,$3,$4)', [token, owner, role, version]);
    }
    shared = randomUUID();
    privateId = randomUUID();
    phone = randomUUID();
    await db.query("insert into crm.contacts(id,owner_workspace,name,email) values($1,'zendra','Casey Example','casey@example.invalid'),($2,'zendra','Private Example','private@example.invalid')", [shared, privateId]);
    await db.query("insert into crm.contact_access values($1,'shared'),($1,'zendra'),($2,'zendra')", [shared, privateId]);
    await db.query("insert into crm.phones(id,contact_id,value,normalized) values($1,$2,'202-555-0141','12025550141')", [phone, shared]);
    await db.query("insert into crm.private_notes values($1,'zendra','PRIVATE INTERNAL NOTE')", [shared]);
}, 30000);
afterAll(async () => { await db?.close(); });
describe('database authorization and transactional saves', () => {
    it('returns only shared contacts and never includes private notes for callers', async () => {
        const list = await rpc('contacts.list', { view: 'all' });
        expect(list.map((c: any) => c.id)).toContain(shared);
        expect(list.map((c: any) => c.id)).not.toContain(privateId);
        const contact = await rpc('contact.get', { contactId: shared });
        expect(JSON.stringify(contact)).not.toContain('PRIVATE INTERNAL');
        expect(contact.private_notes).toBeUndefined();
        await expect(rpc('contact.get', { contactId: privateId })).rejects.toThrow('NOT_FOUND');
        await expect(rpc('contact.share', { contactId: shared, shared: false })).rejects.toThrow('FORBIDDEN');
        expect((await rpc('contact.get', { contactId: shared }, admin)).private_notes[0].body).toBe('PRIVATE INTERNAL NOTE');
    });
    it('rejects public direct database and RPC access', async () => {
        await db.exec('set role anon');
        await expect(db.query('select * from crm.contacts')).rejects.toThrow('permission denied');
        await expect(db.query("select public.crm_request('x','x','contacts.list','{}')")).rejects.toThrow('permission denied');
        await db.exec('reset role');
    });
    it('keeps drafts bound to their contact and browser owner', async () => {
        const id = await draft();
        await expect(rpc('draft.get', { id }, other)).rejects.toThrow('NOT_FOUND');
        await expect(rpc('draft.ensure', { id, contactId: privateId }, admin)).rejects.toThrow('NOT_FOUND');
        await expect(rpc('draft.audio', { id, revision: 1, path: 'stolen.m4a' }, other)).rejects.toThrow('NOT_FOUND');
    });
    it('retries draft updates and final saves without creating duplicates', async () => {
        const id = await draft(), mutation = randomUUID();
        const value = { ...fields(), nextAction: 'Send the agreed terms', followUpDate: '2026-10-01' };
        const a = await update(id, value, 1, caller, mutation), b = await update(id, value, 1, caller, mutation);
        expect(a.revision).toBe(b.revision);
        const saved = await rpc('draft.save', { id, revision: a.revision, completeFollowUp: false });
        const retry = await rpc('draft.save', { id, revision: a.revision, completeFollowUp: false });
        expect(retry.activityId).toBe(saved.activityId);
        expect((await db.query('select * from crm.activities where draft_id=$1', [id])).rows).toHaveLength(1);
        const c = await rpc('contact.get', { contactId: shared });
        expect(c.next_action).toBe('Send the agreed terms');
        expect(c.follow_up_date).toBe('2026-10-01');
    });
    it('rejects stale editing and processing responses and preserves input', async () => {
        const id = await draft(), updated = await update(id);
        const started = await rpc('draft.start', { id, revision: updated.revision });
        await rpc('draft.transcript', { id, lease: started.lease_token, transcript: 'Original dictated facts.' });
        await update(id, fields('voicemail', 'Corrected note'), updated.revision);
        await expect(rpc('draft.complete', { id, lease: started.lease_token, fields: fields() })).rejects.toThrow('STALE');
        await expect(update(id, fields(), 1)).rejects.toThrow('STALE');
        const d = await rpc('draft.get', { id });
        expect(d.raw_text).toBe('Corrected note');
        expect(d.transcript).toBe('Original dictated facts.');
    });
    it('rejects a revoked contact even if the session or draft still exists', async () => {
        const id = await draft();
        await rpc('contact.share', { contactId: shared, shared: false }, admin);
        await expect(rpc('draft.get', { id })).rejects.toThrow('NOT_FOUND');
        await expect(rpc('contact.get', { contactId: shared })).rejects.toThrow('NOT_FOUND');
        await rpc('contact.share', { contactId: shared, shared: true }, admin);
    });
    it('marks only the selected number bad and prevents DNC queue recycling', async () => {
        const second = randomUUID();
        await db.query("insert into crm.phones(id,contact_id,value,normalized) values($1,$2,'202-555-0198','12025550198')", [second, shared]);
        const bad = await draft(), badUpdate = await update(bad, fields('bad_number', ''));
        await rpc('draft.save', { id: bad, revision: badUpdate.revision });
        const c = await rpc('contact.get', { contactId: shared });
        expect(c.phones.find((p: any) => p.id === phone).is_bad).toBe(true);
        expect(c.phones.find((p: any) => p.id === second).is_bad).toBe(false);
        expect((await rpc('contacts.list', { view: 'queue' })).some((c: any) => c.id === shared)).toBe(true);
        const stop = await draft(), stopUpdate = await update(stop, fields('do_not_call', 'Asked us not to call again.'));
        await rpc('draft.save', { id: stop, revision: stopUpdate.revision });
        expect((await rpc('contacts.list', { view: 'queue' })).some((c: any) => c.id === shared)).toBe(false);
    });
    it('requires a callback date and rejects invalid-phone saves', async () => {
        const id = await draft(), d = await update(id, fields('callback', 'Call next week.'));
        await expect(rpc('draft.save', { id, revision: d.revision })).rejects.toThrow('DATE_REQUIRED');
        await expect(rpc('draft.update', { id, revision: d.revision, mutationId: randomUUID(), rawText: '', fields: fields(), phoneId: randomUUID() })).rejects.toThrow('INVALID_PHONE');
    });
    it('imports all valid source rows idempotently without erasing judgments', async () => {
        const rows = [{ source_id: 'fixture-100', name: 'Import Example', company: 'Example Company', city: 'Example City', county: 'Example County', email: 'import@example.invalid', phones: ['202-555-0163'], background: { loans12: 2 } }, { source_id: 'fixture-101', name: 'No Phone Example', company: '', city: '', county: '', email: '', phones: [], background: {} }];
        const preview = await rpc('import.preview', { sourceHash: 'fixture-hash', rows }, admin);
        const result = await rpc('import.confirm', { id: preview.id }, admin);
        expect(result.inserted).toBe(2);
        expect(result.total).toBe(2);
        expect(await rpc('import.confirm', { id: preview.id }, admin)).toEqual(result);
        const imported = (await rpc('contacts.list', { view: 'all' }, admin)).find((c: any) => c.name === 'Import Example');
        await db.query('update crm.phones set is_bad=true where contact_id=$1', [imported.id]);
        await db.query("insert into crm.contact_state(contact_id,workspace_id,do_not_call,next_action) values($1,'shared',true,'Keep this judgment')", [imported.id]);
        rows[0].company = 'Updated Example';
        const p2 = await rpc('import.preview', { sourceHash: 'fixture-hash-2', rows }, admin);
        await rpc('import.confirm', { id: p2.id }, admin);
        const c = await rpc('contact.get', { contactId: imported.id }, admin);
        expect(c.company).toBe('Updated Example');
        expect(c.do_not_call).toBe(true);
        expect(c.phones[0].is_bad).toBe(true);
        expect(c.next_action).toBe('Keep this judgment');
    });
    it('flags identity collisions instead of silently merging contacts', async () => {
        const rows = [{ source_id: 'collision', name: 'Someone Else', email: 'casey@example.invalid', company: '', city: '', county: '', phones: [], background: {} }];
        const preview = await rpc('import.preview', { sourceHash: 'collision', rows }, admin);
        expect(preview.preview[0].action).toBe('review');
        const result = await rpc('import.confirm', { id: preview.id }, admin);
        expect(result.skipped).toBe(1);
        expect(result.inserted).toBe(0);
    });
    it('rejects expired sessions and sessions from an older password', async () => {
        await db.query("update crm.sessions set expires_at=now()-interval '1 minute' where token_hash=$1", [other]);
        await expect(rpc('contacts.list', {}, other)).rejects.toThrow('UNAUTHORIZED');
        await expect(db.query("select public.crm_request($1,'changed','contacts.list','{}')", [caller])).rejects.toThrow('UNAUTHORIZED');
    });
    it('requires a fresh reviewed preview after contact edits', async () => {
        const rows = [{ source_id: 'repreview', name: 'Repreview Example', company: '', city: '', county: '', email: '', phones: [], background: {} }];
        const first = await rpc('import.preview', { sourceHash: 'repreview-first', rows }, admin);
        await rpc('import.confirm', { id: first.id }, admin);
        const stale = await rpc('import.preview', { sourceHash: 'repreview-update', rows }, admin);
        const c = (await rpc('contacts.list', { view: 'all' }, admin)).find((c: any) => c.name === 'Repreview Example');
        await rpc('contact.edit', { contactId: c.id, revision: c.revision, name: c.name, company: 'Manual edit', city: '', county: '', email: '' }, admin);
        await expect(rpc('import.confirm', { id: stale.id }, admin)).rejects.toThrow('IMPORT_CHANGED');
        const fresh = await rpc('import.preview', { sourceHash: 'repreview-update', rows }, admin);
        expect(fresh.id).not.toBe(stale.id);
        expect((await rpc('import.confirm', { id: fresh.id }, admin)).updated).toBe(1);
    });
    it('flags a reused phone as an ambiguous identity', async () => {
        const rows = [{ source_id: 'phone-collision', name: 'Distinct Example Name', email: '', company: '', city: '', county: '', phones: ['+1 202 555 0141'], background: {} }];
        const preview = await rpc('import.preview', { sourceHash: 'phone-collision', rows }, admin);
        expect(preview.preview[0].action).toBe('review');
        expect((await rpc('import.confirm', { id: preview.id }, admin)).skipped).toBe(1);
    });
    it('orders due follow-ups before uncalled contacts and retains contacts with no phone in All', async () => {
        const due = randomUUID(), uncalled = randomUUID(), missing = randomUUID();
        for (const [id, name, hasPhone] of [[due, 'ZZ Due Example', true], [uncalled, 'AA Uncalled Example', true], [missing, 'Missing Phone Example', false]] as const) {
            await db.query("insert into crm.contacts(id,owner_workspace,name) values($1,'zendra',$2)", [id, name]);
            await db.query("insert into crm.contact_access values($1,'shared')", [id]);
            if (hasPhone)
                await db.query("insert into crm.phones(contact_id,value,normalized) values($1,'2025550122','12025550122')", [id]);
        }
        await db.query("insert into crm.contact_state(contact_id,workspace_id,last_called_at,follow_up_date,next_action) values($1,'shared',now(),current_date-1,'Call')", [due]);
        const queue = await rpc('contacts.list', { view: 'queue' });
        expect(queue.findIndex((c: any) => c.id === due)).toBeLessThan(queue.findIndex((c: any) => c.id === uncalled));
        expect(queue.some((c: any) => c.id === missing)).toBe(false);
        expect((await rpc('contacts.list', { view: 'all' })).some((c: any) => c.id === missing)).toBe(true);
    });
    it('keeps audio cleanup tombstones until late upload tokens expire', async () => {
        const id = await draft();
        await rpc('draft.audio', { id, revision: 1, path: id + '/test.m4a' });
        await rpc('draft.discard', { id });
        await db.query('select public.crm_audio_cleanup($1)', [[id]]);
        expect((await rpc('draft.get', { id })).audio_path).not.toBeNull();
        await db.query("update crm.drafts set updated_at=now()-interval '4 hours' where id=$1", [id]);
        await db.query('select public.crm_audio_cleanup($1)', [[id]]);
        expect((await rpc('draft.get', { id })).audio_path).toBeNull();
    });
    it('cannot clear a follow-up changed by another saved call',async()=>{
        const before=await rpc('contact.get',{contactId:shared});
        const expectedFollowUp={nextAction:before.next_action,followUpDate:before.follow_up_date,lastCalledAt:before.last_called_at};
        const id=await draft(),edited=await update(id,fields('no_answer',''));
        await db.query("update crm.contact_state set next_action='New agreed task',follow_up_date='2026-11-01' where contact_id=$1 and workspace_id='shared'",[shared]);
        await expect(rpc('draft.save',{id,revision:edited.revision,completeFollowUp:true,expectedFollowUp})).rejects.toThrow('FOLLOWUP_CHANGED');
        expect((await db.query('select * from crm.activities where draft_id=$1',[id])).rows).toHaveLength(0);
        expect((await rpc('contact.get',{contactId:shared})).next_action).toBe('New agreed task');
        await rpc('draft.save',{id,revision:edited.revision,completeFollowUp:true});
        expect((await rpc('contact.get',{contactId:shared})).next_action).toBeNull();
    });
    it('retains completed call history through a database export and restore', async () => {
        const before = await db.query('select count(*)::int n from crm.activities');
        const snapshot = await db.dumpDataDir('none');
        const restored = new PGlite({ loadDataDir: snapshot });
        try {
            expect((await restored.query('select count(*)::int n from crm.activities')).rows).toEqual(before.rows);
            expect((await restored.query('select count(*)::int n from crm.private_notes')).rows[0]).toEqual({ n: 1 });
        }
        finally {
            await restored.close();
        }
    }, 30000);
});
