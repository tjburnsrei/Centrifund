import { useCallback, useEffect, useRef, useState } from 'react';
import type { Contact } from '../shared/types';
import { api, ClientError } from './api';
import { ContactScreen } from './ContactScreen';
import { AdminPanel } from './AdminPanel';
import { hasPending } from './local';
function Brand() {
    return <><img className="brand-logo" src="/centrifund.jpeg" alt="Centrifund" width="200" height="200"/><span className="brand-product">CRM</span></>;
}
function Login({ onLogin, adminEnabled }: {
    adminEnabled: boolean;
    onLogin: () => Promise<void>;
}) {
    const [admin, setAdmin] = useState(adminEnabled && location.pathname === '/admin'), [password, setPassword] = useState(''), [email, setEmail] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function submit(e: React.FormEvent) { e.preventDefault(); setError(''); setBusy(true); try {
        if (!admin) {
            await api('/login', { password });
            await onLogin();
        }
        else if (!sent) {
            await api('/admin/code', { email });
            setSent(true);
        }
        else {
            await api('/admin/verify', { email, code });
            await onLogin();
        }
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        setBusy(false);
    } }
    return <main className="login-shell"><div className="brand"><Brand/></div><section className="login-card"><h1 className="sr-only">{admin ? 'Centrifund CRM administrator sign in' : 'Centrifund CRM sign in'}</h1><form onSubmit={submit}>{admin ? <><label>Email<input type="email" autoComplete="email" value={email} required disabled={busy || sent} onChange={e => setEmail(e.target.value)}/></label>{sent ? <label>Email code<input value={code} inputMode="numeric" autoComplete="one-time-code" required onChange={e => setCode(e.target.value)} maxLength={10}/></label> : null}</> : <label>Shared password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label>}{error ? <p className="error" role="alert">{error}</p> : null}<button className="button primary" disabled={busy}>{busy ? 'One moment…' : admin && !sent ? 'Send sign-in code' : 'Open CRM →'}</button></form>{adminEnabled ? <button className="text-button muted" onClick={() => { setAdmin(!admin); setError(''); setSent(false); }}>{admin ? 'Back to caller sign-in' : 'Administrator sign-in'}</button> : null}</section>{!admin ? <details className="home-screen-help"><summary>Add Centrifund CRM to your iPhone</summary><ol><li>Open this page in Safari.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li><li>Tap the Centrifund CRM icon on your Home Screen. Sign in if asked.</li></ol><p>Save any unfinished notes to the CRM before switching to the Home Screen app.</p></details> : null}</main>;
}
export default function App() {
    const [adminEnabled, setAdminEnabled] = useState(false);
    useEffect(() => { let active = true; void api<{adminEnabled:boolean}>('/config').then(config => { if (active) setAdminEnabled(config.adminEnabled); }).catch(() => undefined); return () => { active = false; }; }, []);
    const [session, setSession] = useState<{
        role: string;
    } | null>(null), [loading, setLoading] = useState(true), [opening, setOpening] = useState(true), [contacts, setContacts] = useState<Contact[]>([]), [contact, setContact] = useState<Contact | null>(null), [selected, setSelected] = useState(() => { try {
        return localStorage.getItem('cf-selected') ?? '';
    }
    catch {
        return '';
    } }), [view, setView] = useState('queue'), [search, setSearch] = useState(''), [listOpen, setListOpen] = useState(false), [adminOpen, setAdminOpen] = useState(false), [error, setError] = useState(''), [toast, setToast] = useState(''), [recording, setRecording] = useState(false), [working, setWorking] = useState(false), [online, setOnline] = useState(navigator.onLine);
    const detailRequest = useRef(0), listRequest = useRef(0), selectedRef = useRef(selected), openedRef = useRef(false);
    const clearSession = useCallback(() => { detailRequest.current++; listRequest.current++; openedRef.current = false; setSession(null); setContacts([]); setContact(null); setAdminOpen(false); setWorking(false); setRecording(false); setOpening(true); }, []);
    const loadSession = useCallback(async () => { try {
        setSession(await api('/session'));
        setError('');
    }
    catch {
        clearSession();
    }
    finally {
        setLoading(false);
    } }, [clearSession]);
    useEffect(() => {
        let active = true;
        void api<{
            role: string;
        }>('/session').then(value => { if (active)
            setSession(value); }).catch(() => { if (active)
            clearSession(); }).finally(() => { if (active)
            setLoading(false); });
        const updateOnline = () => setOnline(navigator.onLine);
        window.addEventListener('session-expired', clearSession);
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        return () => { active = false; window.removeEventListener('session-expired', clearSession); window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
    }, [clearSession]);
    const loadContacts = useCallback(async () => {
        const request = ++listRequest.current;
        const rows = await api<Contact[]>('/contacts?view=' + view + '&q=' + encodeURIComponent(search));
        if (request === listRequest.current)
            setContacts(rows);
        return rows;
    }, [view, search]);
    const select = useCallback(async (id: string) => {
        const request = ++detailRequest.current;
        const sameContact = selectedRef.current === id;
        if (!sameContact) setOpening(true);
        selectedRef.current = id;
        openedRef.current = true;
        setSelected(id);
        setListOpen(false);
        try {
            localStorage.setItem('cf-selected', id);
        }
        catch { /* Selection memory is optional; notes use IndexedDB. */ }
        try {
            const record = await api<Contact>('/contacts/' + id);
            if (request === detailRequest.current) {
                setContact(record);
                setError('');
            }
        }
        catch (e) {
            if (request === detailRequest.current) {
                if (!sameContact || (e instanceof ClientError && [401, 403, 404].includes(e.status))) setContact(null);
                setError(e instanceof Error ? e.message : 'Unable to load this contact.');
            }
        }
        finally {
            if (request === detailRequest.current)
                setOpening(false);
        }
    }, []);
    useEffect(() => {
        if (!session)
            return;
        let active = true;
        const timer = setTimeout(() => {
            void loadContacts().then(rows => {
                if (active && !openedRef.current) {
                    const id = selectedRef.current || rows[0]?.id;
                    if (id)
                        void select(id);
                    else
                        setOpening(false);
                }
            }).catch(e => { if (active)
                setError(e.message); });
        }, 150);
        return () => { active = false; clearTimeout(timer); };
    }, [session, loadContacts, select]);
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible' && session && !recording && !working) {
            void loadContacts().catch(() => undefined);
            if (selectedRef.current)
                void select(selectedRef.current);
        } };
        document.addEventListener('visibilitychange', refresh);
        return () => document.removeEventListener('visibilitychange', refresh);
    }, [session, recording, working, loadContacts, select]);
    const saved = async () => {
        setToast('Call saved to CRM');
        const rows = await loadContacts(), next = rows.find(r => r.id !== selectedRef.current) ?? (view === 'queue' ? rows[0] : undefined);
        if (next)
            await select(next.id);
        else {
            detailRequest.current++;
            selectedRef.current = '';
            setContact(null);
            setSelected('');
            try {
                localStorage.removeItem('cf-selected');
            }
            catch { /* Optional selection memory. */ }
        }
    };
    const updated = async () => { await loadContacts(); if (selectedRef.current)
        await select(selectedRef.current); };
    async function logout() {
        if (await hasPending().catch(() => true) && !window.confirm('You have unfinished notes saved on this phone. Sign out and keep them here for your next sign-in?'))
            return;
        try {
            await api('/logout', {});
            clearSession();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not sign out.');
        }
    }
    if (loading)
        return <main className="loading">Opening Centrifund CRM…</main>;
    if (!session)
        return <Login key={String(adminEnabled)} adminEnabled={adminEnabled} onLogin={loadSession}/>;
    return <><header className="app-header"><a href="/" className="brand" onClick={e => e.preventDefault()}><Brand/></a><nav><button className="mobile-list text-button" disabled={recording || working} onClick={() => setListOpen(!listOpen)}>Contacts</button>{session.role === 'admin' ? <button className="text-button" disabled={recording || working} onClick={() => setAdminOpen(!adminOpen)}>{adminOpen ? 'Calling view' : 'Admin'}</button> : null}<button className="text-button muted" disabled={recording || working} onClick={() => void logout()}>Sign out</button></nav></header>
 {!online ? <div className="offline" role="status">You’re offline. Keep your notes here; reconnect before saving to the CRM.</div> : null}
 {toast ? <div className="toast" role="status">{toast}<button aria-label="Dismiss saved confirmation" onClick={() => setToast('')}>×</button></div> : null}
 <div className="workspace"><aside className={'contact-list ' + (listOpen ? 'open' : '')}><div className="list-heading"><div><div className="eyebrow">YOUR CONTACTS</div><h2>{contacts.length} contacts</h2></div><button className="mobile-list text-button" onClick={() => setListOpen(false)}>Close</button></div><input aria-label="Search contacts" placeholder="Search name or company" value={search} disabled={recording || working} onChange={e => { setSearch(e.target.value); if (e.target.value)
        setView('all'); }}/><div className="view-tabs"><button aria-pressed={view === 'queue'} disabled={recording || working} onClick={() => setView('queue')}>Up next</button><button aria-pressed={view === 'all'} disabled={recording || working} onClick={() => setView('all')}>All contacts</button></div>
 <div className="list-items">{contacts.map(c => <button key={c.id} className={'list-contact ' + (c.id === selected ? 'active' : '')} disabled={recording || working} onClick={() => void select(c.id)}><span className="list-name">{c.name}</span><span className="muted">{c.company || c.city || 'Contact'}</span><span className="list-tag">{c.do_not_call ? 'Do not call' : c.follow_up_date ? 'Follow-up · ' + c.follow_up_date : c.last_called_at ? 'Previously called' : 'Not called yet'}</span></button>)}{!contacts.length ? <p className="muted empty-list">{search ? 'No matching contacts.' : 'No contacts in this view. Try All contacts.'}</p> : null}</div></aside>
 <main className="main-panel">{error ? <div className="error" role="alert">{error}</div> : null}{adminOpen && session.role === 'admin' ? <AdminPanel key={contact ? JSON.stringify(contact) : 'empty'} contact={contact} onUpdate={updated}/> : opening ? <section className="loading">Opening contact…</section> : contact ? <ContactScreen key={session.role + ':' + contact.id} contact={contact} role={session.role} onSaved={saved} onRecording={setRecording} onBusy={setWorking} onRefresh={() => select(contact.id)}/> : <section className="empty-state"><div className="eyebrow">A CLEAR CALLING LIST</div><h1>You’re caught up.</h1><p>Choose All contacts to review history or select someone to call.</p>{session.role === 'admin' ? <button className="button primary" onClick={() => setAdminOpen(true)}>Manage contacts</button> : <button className="button secondary" onClick={() => { setView('all'); setListOpen(true); }}>Browse contacts</button>}</section>}</main>
 </div></>;
}
