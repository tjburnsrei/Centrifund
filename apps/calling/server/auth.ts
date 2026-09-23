import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminAllowed, isProduction, origin, setting } from './config';
import { ApiError, rpc } from './db';
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const passwordVersion = () => createHmac('sha256', setting('SESSION_SECRET')).update(setting('CALLER_PASSWORD')).digest('hex');
export function cookie(request: Request, name: string) { return request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) ?? ''; }
export function sessionHash(request: Request) { const token = cookie(request, 'cf_session'); if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in. Your unfinished notes stay on this phone.'); return hash(token); }
export const requestDb = <T = any>(request: Request, action: string, args: object = {}) => rpc<T>('crm_request', { p_session_hash: sessionHash(request), p_password_version: passwordVersion(), p_action: action, p_args: args });
export function checkOrigin(request: Request) {
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin())
        throw new ApiError(403, 'ORIGIN', 'This request did not come from the calling app.');
}
export async function throttle(request: Request, purpose: string, maximum = 10, seconds = 600) {
    // Vercel overwrites x-vercel-forwarded-for. Local development has one loopback bucket.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown' : 'local';
    const allowed = await rpc<boolean>('crm_rate_limit', { p_bucket: purpose + ':' + createHmac('sha256', setting('SESSION_SECRET')).update(ip).digest('hex'), p_max: maximum, p_seconds: seconds });
    if (!allowed)
        throw new ApiError(429, 'RATE_LIMIT', 'Too many attempts. Please wait a few minutes before trying again.');
}
export async function createSession(request: Request, role: 'caller' | 'admin', userId?: string) {
    const token = randomBytes(32).toString('hex');
    let device = cookie(request, 'cf_device');
    if (!/^[a-f0-9]{64}$/.test(device))
        device = randomBytes(32).toString('hex');
    const owner = role === 'admin' ? 'admin:' + userId : 'device:' + hash(device);
    await rpc('crm_create_session', { p_token_hash: hash(token), p_owner_id: owner, p_role: role, p_password_version: role === 'caller' ? passwordVersion() : null });
    const suffix = '; Path=/; HttpOnly; SameSite=Strict' + (isProduction() || origin().startsWith('https:') ? '; Secure' : '');
    return ['cf_session=' + token + '; Max-Age=2592000' + suffix, 'cf_device=' + device + '; Max-Age=31536000' + suffix];
}
export function verifyPassword(value: string) { return timingSafeEqual(Buffer.from(hash(value)), Buffer.from(hash(setting('CALLER_PASSWORD')))); }
export async function adminAuth(path: string, body: object) {
    const r = await fetch(setting('SUPABASE_URL') + '/auth/v1/' + path, { method: 'POST', headers: { apikey: setting('SUPABASE_PUBLISHABLE_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await r.json().catch(() => null);
    if (!r.ok)
        throw new ApiError(400, 'SIGN_IN', 'Sign-in could not be completed. Check the code or request a new one.');
    return data;
}
export async function requireAdmin(request: Request) { const who = await requestDb<{
    role: string;
}>(request, 'session.me'); if (who.role !== 'admin')
    throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.'); }
export { adminAllowed };
