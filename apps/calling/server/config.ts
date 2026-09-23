export function setting(name: string) {
    const value = process.env[name]?.trim();
    if (!value)
        throw new Error('CONFIGURATION');
    return value;
}
export function origin() { return new URL(setting('APP_ORIGIN')).origin; }
export function isProduction() { return process.env.APP_ENV === 'production' || process.env.VERCEL_ENV === 'production'; }
export function adminAllowed(email: string) { return (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).includes(email.trim().toLowerCase()); }
