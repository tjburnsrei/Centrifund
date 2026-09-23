export class ClientError extends Error {
    constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), path.endsWith('/process') ? 245000 : 30000);
    try {
        const response = await fetch('/api' + path, { credentials: 'same-origin', signal: controller.signal, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}) });
        const data = await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
        if (!response.ok) {
            if (response.status === 401 && data.code !== 'PASSWORD')
                window.dispatchEvent(new Event('session-expired'));
            throw new ClientError(data.error ?? 'Request failed.', response.status, data.code ?? 'REQUEST');
        }
        return data as T;
    }
    catch (error) {
        if (error instanceof ClientError)
            throw error;
        throw new ClientError(controller.signal.aborted ? 'The request timed out. Your notes are still on this phone. Check the saved draft or retry.' : 'The connection failed. Your notes are still on this phone. Reconnect and retry.', 0, 'CONNECTION');
    }
    finally {
        clearTimeout(timeout);
    }
}
export const action = <T = any>(name: string, args: object = {}) => api<T>('/action', { action: name, args });
