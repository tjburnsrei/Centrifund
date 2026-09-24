import { useEffect, useRef, useState } from 'react';
import type { Contact, Draft, Fields, LocalDraft, Outcome } from '../shared/types';
import { emptyFields, outcomes } from '../shared/types';
import { action, api } from './api';
import { localDelete, localGet, localPut } from './local';
const draftFromServer = (local: LocalDraft, remote: Draft): LocalDraft => ({ ...local, revision: remote.revision, rawText: remote.raw_text, fields: remote.fields, phoneId: remote.phone_id, transcript: remote.transcript, dirty: false });
function RecordingPlayer({ audio }: {
    audio: Blob;
}) {
    const element = useRef<HTMLAudioElement>(null);
    useEffect(() => { const url = URL.createObjectURL(audio); if (element.current)
        element.current.src = url; return () => URL.revokeObjectURL(url); }, [audio]);
    return <audio ref={element} controls aria-label="Play your recorded notes"/>;
}
export function ContactScreen({ contact, role, onSaved, onRecording, onBusy, onRefresh }: {
    contact: Contact;
    role: string;
    onSaved: () => Promise<void>;
    onRecording: (value: boolean) => void;
    onBusy?: (value: boolean) => void;
    onRefresh?: () => Promise<void>;
}) {
    const key = role + ':' + contact.id;
    const [draft, setDraft] = useState<LocalDraft | null>(null), [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [recording, setRecording] = useState(false), [transcript, setTranscript] = useState(''), [seconds, setSeconds] = useState(0);
    const current = useRef<LocalDraft | null>(null), lock = useRef(false), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const validPhones = contact.phones.filter(p => !p.is_bad);
    const activePhone = contact.phones.find(p => p.id === draft?.phoneId);
    const persist = async (value: LocalDraft) => { current.current = value; setDraft(value); try {
        await localPut(key, value);
        setStatus('Saved on this phone');
    }
    catch {
        setError('This phone could not store the draft. Keep this screen open and save to the CRM before leaving.');
        setStatus('Not saved on this phone');
    } };
    useEffect(() => {
        let alive = true;
        void localGet(key).then(saved => {
            if (!alive)
                return;
            const value = saved ?? { id: crypto.randomUUID(), contactId: contact.id, revision: 1, rawText: '', fields: emptyFields(), phoneId: validPhones[0]?.id ?? null, dirty: true, mutationId: crypto.randomUUID(), completeFollowUp: false, updatedAt: Date.now() };
            current.current = value;
            setDraft(value);
            setTranscript(value.transcript ?? '');
            if (saved)
                setStatus('Restored from this phone');
        }).catch(() => { if (!alive)
            return; const value: LocalDraft = { id: crypto.randomUUID(), contactId: contact.id, revision: 1, rawText: '', fields: emptyFields(), phoneId: validPhones[0]?.id ?? null, dirty: true, mutationId: crypto.randomUUID(), completeFollowUp: false, updatedAt: Date.now() }; current.current = value; setDraft(value); setError('This phone cannot recover drafts. Keep this screen open until your note is saved to CRM.'); });
        return () => { alive = false; if (recorder.current && recorder.current.state !== 'inactive')
            recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); if (timer.current)
            clearInterval(timer.current); };
        // Each contact has its own mounted screen and draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    function change(values: Partial<LocalDraft>) {
        if (!current.current) return;
        // Event-handler timestamp; this callback never runs during render.
        // eslint-disable-next-line react-hooks/purity
        void persist({ ...current.current, ...values, dirty: true, mutationId: crypto.randomUUID(), updatedAt: Date.now() });
    }
    useEffect(() => {
        const stop = () => { const rec = recorder.current; if (document.visibilityState === 'hidden' && rec && rec.state !== 'inactive') {
            setError('Recording stopped when you left the app. Review the captured audio before continuing.');
            rec.stop();
        } };
        document.addEventListener('visibilitychange', stop);
        return () => document.removeEventListener('visibilitychange', stop);
    }, []);
    const field = (values: Partial<Fields>) => { if (current.current)
        change({ fields: { ...current.current.fields, ...values } }); };
    async function sync() {
        let local = current.current!;
        const remote = await action<Draft>('draft.ensure', { id: local.id, contactId: contact.id });
        if (remote.status === 'saved')
            return remote;
        let updated = remote;
        if (local.dirty)
            updated = await action<Draft>('draft.update', { id: local.id, revision: local.revision, mutationId: local.mutationId, rawText: local.rawText, fields: local.fields, phoneId: local.phoneId });
        local = draftFromServer(local, updated);
        await persist(local);
        setTranscript(updated.transcript);
        return updated;
    }
    async function run(task: () => Promise<void>) { if (lock.current)
        return; lock.current = true; setBusy(true); onBusy?.(true); setError(''); try {
        await task();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        lock.current = false;
        setBusy(false);
        onBusy?.(false);
    } }
    async function finishSaved() { const saved = { ...current.current!, serverSaved: true }; await persist(saved); await localDelete(key).catch(() => undefined); setStatus('Saved to CRM'); await onSaved(); }
    const save = () => run(async () => {
        if (current.current?.serverSaved)
            return;
        if (current.current?.audio && !transcript && !window.confirm('This recording has not been transcribed. Save only the written note?'))
            return;
        setStatus('Saving…');
        const remote = await sync();
        if (remote.status !== 'saved')
            await action('draft.save', { id: remote.id, revision: remote.revision, completeFollowUp: current.current!.completeFollowUp, expectedFollowUp: {nextAction:contact.next_action,followUpDate:contact.follow_up_date,lastCalledAt:contact.last_called_at} });
        await finishSaved();
    });
    const generate = () => run(async () => {
        if (!current.current?.rawText.trim() && !current.current?.audio) {
            setError('Record or type some notes first.');
            return;
        }
        let remote = await sync();
        if (remote.status === 'saved') {
            await finishSaved();
            return;
        }
        if (current.current!.audio && !current.current!.audioUploaded) {
            const audio = current.current!.audio!;
            const upload = await api<{
                url?: string;
                uploaded?: boolean;
            }>('/drafts/' + remote.id + '/audio', { revision: remote.revision, mime: audio.type.split(';')[0], size: audio.size });
            setStatus('Uploading recording…');
            const uploaded = upload.uploaded ? null : await fetch(upload.url!, { method: 'PUT', headers: { 'Content-Type': audio.type.split(';')[0] }, body: audio, signal: AbortSignal.timeout(60000) });
            // A retry may find the exact object already uploaded; processing verifies it before transcription.
            if (uploaded && !uploaded.ok && uploaded.status !== 409)
                throw new Error('The recording upload did not finish. Your recording is still on this phone.');
            await persist({ ...current.current!, audioUploaded: true });
        }
        setStatus('Processing');
        try {
            remote = await api<Draft>('/drafts/' + remote.id + '/process', { revision: remote.revision });
        }
        catch (e) {
            const recovered = await action<Draft>('draft.get', { id: remote.id }).catch(() => null);
            if (recovered) {
                setTranscript(recovered.transcript);
                await persist(draftFromServer(current.current!, recovered));
            }
            throw e;
        }
        setTranscript(remote.transcript);
        await persist(draftFromServer(current.current!, remote));
        setStatus('Draft ready — review and save');
    });
    const refresh = () => run(async () => {
        await onRefresh?.();
        const remote = await action<Draft>('draft.get', { id: current.current!.id });
        if (remote.status === 'saved') {
            await finishSaved();
            return;
        }
        if (current.current!.dirty && !window.confirm('Replace the current editor with the server draft? Copy any unsaved edits before continuing.'))
            return;
        setTranscript(remote.transcript);
        await persist(draftFromServer(current.current!, remote));
        setStatus(remote.status === 'processing' ? 'Processing' : 'Recovered server draft');
    });
    async function startRecording() {
        setError('');
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('Recording is unavailable in this browser. Use Safari or type your notes below.');
            return;
        }
        if (current.current?.audioUploaded) {
            setError('This note already has an uploaded recording. You can edit the written note or start a new note.');
            return;
        }
        try {
            if (current.current?.audio && !window.confirm('Replace the recording currently saved on this phone?'))
                return;
            setBusy(true);
            onBusy?.(true);
            const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            stream.current = media;
            const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
            const rec = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
            recorder.current = rec;
            const chunks: Blob[] = [];
            rec.ondataavailable = event => { if (event.data.size) {
                chunks.push(event.data);
                const audio = new Blob(chunks, { type: rec.mimeType });
                if (current.current)
                    void persist({ ...current.current, audio, audioUploaded: false, dirty: true, mutationId: crypto.randomUUID(), updatedAt: Date.now() });
            } };
            rec.onstop = () => { setRecording(false); onRecording(false); media.getTracks().forEach(t => t.stop()); if (timer.current)
                clearInterval(timer.current); };
            media.getAudioTracks().forEach(track => track.addEventListener('ended', () => { if (rec.state !== 'inactive') {
                setError('Recording was interrupted. Review the captured audio or type your notes.');
                rec.stop();
            } }));
            rec.onerror = () => { setError('Recording was interrupted. Play back what was captured, or type your notes.'); if (rec.state !== 'inactive')
                rec.stop(); };
            rec.start(1000);
            setSeconds(0);
            setRecording(true);
            onRecording(true);
            let elapsed = 0;
            timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 120 && rec.state !== 'inactive')
                rec.stop(); }, 1000);
        }
        catch {
            stream.current?.getTracks().forEach(t => t.stop());
            setError('Microphone access was not available. Allow microphone access in Safari, or type your notes.');
        }
        finally {
            setBusy(false);
            onBusy?.(false);
        }
    }
    const discard = () => run(async () => {
        if (!window.confirm('Discard this unfinished note and recording?'))
            return;
        const local = current.current!;
        await action('draft.ensure', { id: local.id, contactId: contact.id });
        await action('draft.discard', { id: local.id });
        await localDelete(key);
        await persist({ id: crypto.randomUUID(), contactId: contact.id, revision: 1, rawText: '', fields: emptyFields(), phoneId: validPhones[0]?.id ?? null, dirty: true, mutationId: crypto.randomUUID(), completeFollowUp: false, updatedAt: Date.now() });
        setTranscript('');
    });
    const date = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(value));
    const metric = (value: unknown) => value === null || value === undefined || value === '' ? 'Not available' : String(value);
    return <section className="contact-screen">
  <div className="eyebrow">CONTACT BRIEF</div>
  <div className="contact-heading"><div><h1>{contact.name}</h1><p className="company">{contact.company || 'Company not listed'}</p><p className="muted">{[contact.city, contact.county].filter(Boolean).join(' · ') || 'Location not listed'}</p></div><span className="initials" aria-hidden="true">{contact.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span></div>
  <div className="metrics"><div><span>Loans · last 12 months</span><strong>{metric(contact.background.loans12)}</strong></div><div><span>Typical loan size</span><strong>{typeof contact.background.size === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(contact.background.size) : metric(contact.background.size)}</strong></div><div><span>Lender on file</span><strong>{metric(contact.background.lender)}</strong></div></div>
  {contact.background.since ? <p className="muted small">Lending history since {contact.background.since}</p> : null}
  {contact.history?.[0]?.summary ? <div className="latest-note"><span className="eyebrow">LATEST SHARED NOTE</span><p>{contact.history[0].summary.slice(0, 300)}{contact.history[0].summary.length > 300 ? '…' : ''}</p><a className="text-button" href="#call-history">View call history ↓</a></div> : null}
  {contact.background.projects?.length ? <details className="project-details"><summary>Project background · {contact.background.projects.length}</summary><p className="muted small">From the supplied contact list; not a live lending feed.</p><ul>{contact.background.projects.map((p, i) => <li key={i}>{Array.isArray(p) ? p.map(v => String(v ?? '')).filter(Boolean).join(' · ') : typeof p === 'object' ? Object.values(p ?? {}).map(String).join(' · ') : String(p)}</li>)}</ul></details> : null}
  {contact.next_action ? <div className="followup"><span className="eyebrow">NEXT ACTION{contact.follow_up_date ? ' · ' + contact.follow_up_date : ''}</span><p>{contact.next_action}</p></div> : null}
  <div className="call-actions">
   {contact.phones.length > 1 ? <label className="phone-select">Phone number<select value={draft?.phoneId ?? ''} disabled={busy || recording} onChange={e => change({ phoneId: e.target.value })}>{contact.phones.map(p => <option key={p.id} value={p.id} disabled={p.is_bad}>{p.value}{p.is_bad ? ' · Bad number' : ''}</option>)}</select></label> : <p className="phone-number">{validPhones[0]?.value || 'No usable phone number on file'}</p>}
   {activePhone && !activePhone.is_bad && !contact.do_not_call ? <a className="button primary call-button" aria-disabled={busy || recording} onClick={e => { if (busy || recording)
        e.preventDefault(); }} href={'tel:' + activePhone.value.replace(/[^+\d]/g, '')} aria-label={'Call ' + contact.name}><span aria-hidden="true">↗</span> Call {contact.name.split(' ')[0]}</a> : <button className="button primary" disabled>{contact.do_not_call ? 'Do not call' : 'Phone number needed'}</button>}
   <a className="button secondary" href={'/api/contacts/' + contact.id + '/contact.vcf'}>＋ Save to iPhone</a>
  </div>
  <p className="hint">After the call, return here to log it. Save to iPhone opens a contact card; confirm the save in iOS.</p>
  <section className="note-panel" aria-label="Log this call"><div className="section-heading"><h2>How did it go?</h2><span className={'status ' + (recording ? 'live' : '')} role="status">{recording ? 'Recording · ' + seconds + 's' : status}</span></div>
   {!draft ? <p>Restoring your notes…</p> : <>
    <fieldset disabled={busy || recording}><legend>Call outcome</legend><div className="outcomes">{Object.entries(outcomes).map(([value, label]) => <button type="button" aria-pressed={draft.fields.outcome === value} className={draft.fields.outcome === value ? 'selected' : ''} key={value} onClick={() => field({ outcome: value as Outcome })}>{label}</button>)}</div></fieldset>
    <div className="record-row"><button type="button" className={'button ' + (recording ? 'stop' : 'secondary')} disabled={busy} onClick={() => recording ? recorder.current?.stop() : void startRecording()}>{recording ? '■ Stop recording' : '● Record notes'}</button><span className="muted small">Up to 2 minutes.<br />You can also type below.</span></div>
    {draft?.audio ? <RecordingPlayer audio={draft.audio}/> : null}
    <label>What happened?<textarea rows={4} maxLength={5000} placeholder="What did you discuss? What is the next step?" value={draft.rawText} disabled={busy || recording} onChange={e => change({ rawText: e.target.value, fields: { ...draft.fields, summary: e.target.value } })}/></label>
    <button type="button" className="button secondary ai-button" disabled={busy || recording || (!draft.rawText.trim() && !draft.audio)} onClick={generate}>{busy ? 'Working…' : 'Organize my notes'}</button>
    {transcript ? <details><summary>Original transcription</summary><p className="preserve">{transcript}</p><button className="text-button" disabled={busy} onClick={() => field({ summary: [draft.rawText, transcript].filter(Boolean).join('\n\n') })}>Use this text as my note</button></details> : null}
    <div className="draft-editor"><label>Note to save<textarea rows={4} maxLength={5000} value={draft.fields.summary} disabled={busy || recording} onChange={e => field({ summary: e.target.value })} placeholder="Review the AI draft here, or write your own note."/></label><div className="form-grid"><label>Next action<input maxLength={1000} value={draft.fields.nextAction} disabled={busy || recording} placeholder="Only if agreed" onChange={e => field({ nextAction: e.target.value })}/></label><label>Follow-up date<input type="date" value={draft.fields.followUpDate} disabled={busy || recording} onInput={e => field({ followUpDate: e.currentTarget.value })}/></label></div>
    {contact.next_action ? <label className="checkbox"><input type="checkbox" checked={draft.completeFollowUp} disabled={busy || recording} onChange={e => change({ completeFollowUp: e.target.checked })}/> Mark the existing follow-up complete</label> : null}
    </div>
    {error ? <div className="error" role="alert">{error}<button className="text-button" disabled={busy || recording} onClick={refresh}>Check saved draft</button></div> : null}
    <div className="save-row"><button className="text-button muted" disabled={busy || recording} onClick={discard}>Discard note</button><button className="button primary" disabled={busy || recording || draft.serverSaved || !draft.fields.outcome} onClick={save}>{busy ? 'Working…' : 'Save & next →'}</button></div>
   </>}
  </section>
  <section className="history" id="call-history"><h2>Shared call history</h2>{!contact.history?.length ? <p className="muted">No calls logged yet.</p> : contact.history.map(entry => <article key={entry.id}><div className="section-heading"><strong>{outcomes[entry.outcome]}</strong><time>{date(entry.created_at)}</time></div><p className="preserve">{entry.summary || 'Outcome recorded without notes.'}</p>{entry.next_action ? <p className="small"><strong>Next:</strong> {entry.next_action}{entry.follow_up_date ? ' · ' + entry.follow_up_date : ''}</p> : null}<span className="muted small">{entry.author}</span></article>)}</section>
 </section>;
}
