import { setting, supabaseServerKey } from './config.js';
function databaseHeaders(): Record<string,string> {
    const key = supabaseServerKey();
    return key.startsWith('sb_secret_') ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key };
}
export class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
}
const messages: Record<string, [
    number,
    string
]> = {
    UNAUTHORIZED: [401, 'Please sign in again. Your unfinished notes are still on this phone.'],
    FORBIDDEN: [403, 'Administrator access is required.'], NOT_FOUND: [404, 'This record is unavailable or no longer shared.'],
    FOLLOWUP_CHANGED: [409, 'Another call changed the follow-up. Use Check saved draft to review the latest contact before saving.'],
    STALE: [409, 'This draft changed. Reload the saved draft before continuing.'], CLOSED: [409, 'This draft has already been closed.'],
    BUSY: [409, 'This note is still processing. Please check again shortly.'], INVALID_PHONE: [400, 'Select a phone number for this contact.'],
    OUTCOME_REQUIRED: [400, 'Choose a call outcome.'], NOTE_REQUIRED: [400, 'Add a short note about the conversation.'],
    DATE_REQUIRED: [400, 'Choose a callback date.'], ACTION_REQUIRED: [400, 'Add the next action for this follow-up.'],
    IMPORT_CHANGED: [409, 'Contacts changed after this preview. Review a new import before continuing.'],
    AUDIO_EXISTS: [409, 'A recording is already attached to this note.']
};
export async function rpc<T = any>(name: string, args: object): Promise<T> {
    const response = await fetch(setting('SUPABASE_URL') + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...databaseHeaders() },
        body: JSON.stringify(args), signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const code = String(data?.message ?? '').split(':')[0];
        const [status, message] = messages[code] ?? [503, 'The CRM could not finish that request. Your notes have not been cleared.'];
        throw new ApiError(status, messages[code] ? code : 'DATABASE', message);
    }
    return data as T;
}
export async function storage(path: string, init: RequestInit = {}) {
    return fetch(setting('SUPABASE_URL') + '/storage/v1/' + path, {
        ...init, headers: { ...databaseHeaders(), ...init.headers },
        signal: AbortSignal.timeout(40000)
    });
}
