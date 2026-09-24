import type { LocalDraft } from '../shared/types';
let connection: Promise<IDBDatabase> | undefined;
function db() {
    return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('centrifund-calling-v1', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('drafts');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
    });
}
export async function localGet(key: string): Promise<LocalDraft | undefined> {
    const database = await db();
    return new Promise((resolve, reject) => { const r = database.transaction('drafts').objectStore('drafts').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function localPut(key: string, value: LocalDraft) {
    const database = await db();
    return new Promise<void>((resolve, reject) => { const tx = database.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
export async function localDelete(key: string) {
    const database = await db();
    return new Promise<void>((resolve, reject) => { const tx = database.transaction('drafts', 'readwrite'); tx.objectStore('drafts').delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}
export async function hasPending() {
    const database = await db();
    return new Promise<boolean>((resolve, reject) => { const r = database.transaction('drafts').objectStore('drafts').getAll(); r.onsuccess = () => resolve(r.result.some((d: LocalDraft) => !d.serverSaved && (d.rawText || d.audio || d.fields.outcome))); r.onerror = () => reject(r.error); });
}
