import { useEffect, useState } from 'react';
import type { Contact } from '../shared/types';
import { action, api } from './api';
type Preview = {
    id: string;
    status: string;
    sourceHash: string;
    preview: {
        sourceId: string;
        name: string;
        action: string;
        reason: string | null;
        data: {
            company: string;
            email: string;
            city: string;
            county: string;
            phones: string[];
        };
    }[];
    result?: unknown;
};
export function AdminPanel({ contact, onUpdate }: {
    contact: Contact | null;
    onUpdate: () => Promise<void>;
}) {
    const [preview, setPreview] = useState<Preview | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [health, setHealth] = useState<any>(null), [edit, setEdit] = useState<Contact | null>(contact), [privateNote, setPrivateNote] = useState(contact?.private_notes?.find(n => n.workspace_id === 'zendra')?.body ?? ''), [newPhone, setNewPhone] = useState('');
    useEffect(() => { void action('admin.health').then(setHealth).catch(() => undefined); }, []);
    async function run(task: () => Promise<void>) { setBusy(true); setMessage(''); try {
        await task();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Operation failed.');
    }
    finally {
        setBusy(false);
    } }
    return <section className="admin-panel"><h2>Administrator</h2><p className="muted">Manage the shared list and keep internal notes private.</p>
 {health ? <div className="admin-stats"><span>{health.contacts} contacts</span><span>{health.sharedContacts} shared</span><span>{health.failedDrafts} processing failures</span><span>{health.stalledDrafts} interrupted jobs</span></div> : null}
 <section className="admin-box"><h3>Import contacts</h3><p className="small muted">Upload the private call-list HTML or its JSON data. Preview before importing. Existing call history and phone flags are preserved.</p>
 <input type="file" accept=".html,.json" aria-label="Choose contact import" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file)
        void run(async () => { setPreview(await api('/admin/import/preview', { source: await file.text() })); }); }}/>
 {preview ? <><p>{preview.preview.length} rows · {preview.preview.filter(r => r.action === 'insert').length} new · {preview.preview.filter(r => r.action === 'update').length} updates · {preview.preview.filter(r => r.action === 'review').length} require review</p><p className="small import-hash">Source checksum: {preview.sourceHash}</p><details><summary>Review import rows</summary><ul className="import-rows">{preview.preview.map(r => <li key={r.sourceId}><strong>{r.name}</strong> — {r.action}{r.reason ? <p>{r.reason}</p> : null}<p>{[r.data.company, r.data.city, r.data.county, r.data.email].filter(Boolean).join(' · ')}</p><p>{r.data.phones.join(', ') || 'No phone number'}</p></li>)}</ul></details>
 <button className="button primary" disabled={busy || preview.status === 'committed'} onClick={() => void run(async () => { const result = await action('import.confirm', { id: preview.id }); setPreview({ ...preview, status: 'committed', result }); setMessage('Import complete: ' + result.inserted + ' added, ' + result.updated + ' updated, ' + result.skipped + ' left for review.'); await onUpdate(); })}>{preview.status === 'committed' ? 'Already imported' : 'Confirm reviewed import'}</button></> : null}
 </section>
 {contact && edit ? <section className="admin-box"><h3>Contact details</h3><form onSubmit={e => { e.preventDefault(); void run(async () => { await action('contact.edit', { contactId: edit.id, revision: edit.revision, name: edit.name, company: edit.company, city: edit.city, county: edit.county, email: edit.email }); setMessage('Contact details saved.'); await onUpdate(); }); }}>
 {(['name', 'company', 'city', 'county', 'email'] as const).map(field => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input required={field === 'name'} type={field === 'email' ? 'email' : 'text'} value={edit[field]} disabled={busy} onChange={e => setEdit({ ...edit, [field]: e.target.value })}/></label>)}
 <button className="button secondary" disabled={busy}>Save contact details</button></form>
 <div className="phone-admin"><h3>Phone numbers</h3>{contact.phones.map(p => <label className="checkbox" key={p.id}><input type="checkbox" checked={!p.is_bad} disabled={busy} onChange={e => void run(async () => { await action('contact.phoneFlag', { contactId: contact.id, phoneId: p.id, isBad: !e.target.checked }); await onUpdate(); })}/>{p.value} — {p.is_bad ? 'marked bad' : 'usable'}</label>)}<label>Add a phone number<input type="tel" value={newPhone} disabled={busy} onChange={e => setNewPhone(e.target.value)}/></label><button className="button secondary" disabled={busy || !newPhone.trim()} onClick={() => void run(async () => { await action('contact.addPhone', { contactId: contact.id, value: newPhone }); setNewPhone(''); await onUpdate(); setMessage('Phone number added.'); })}>Add number</button></div>
 <label className="checkbox"><input type="checkbox" checked={contact.shared ?? false} disabled={busy} onChange={e => void run(async () => { await action('contact.share', { contactId: contact.id, shared: e.target.checked }); await onUpdate(); setMessage('Sharing updated.'); })}/> Share this contact and its shared call history with Centrifund</label>
 <label>Private Zendra notes<textarea rows={4} value={privateNote} disabled={busy} onChange={e => setPrivateNote(e.target.value)}/></label>
 <button className="button secondary" disabled={busy} onClick={() => void run(async () => { await action('contact.privateNote', { contactId: contact.id, workspaceId: 'zendra', body: privateNote }); setMessage('Private note saved.'); await onUpdate(); })}>Save private note</button>
 </section> : null}
 <section className="admin-box"><h3>Caller access</h3><button className="button secondary" disabled={busy} onClick={() => { if (window.confirm('Sign out all caller devices? They can sign in again with the current shared password.'))
        void run(async () => { await action('session.revoke'); setMessage('All caller sessions have been revoked.'); }); }}>Sign out all caller devices</button></section>
 {message ? <p className="notice" role="status">{message}</p> : null}
 </section>;
}
