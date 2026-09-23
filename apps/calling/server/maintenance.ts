import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hash } from './auth.js';
import { rpc } from './db.js';
import { parseImport } from '../shared/import.js';
import { actionSchemas } from './handler.js';

const allowed = new Set(['contact.edit', 'contact.share', 'contact.privateNote', 'contact.addPhone', 'contact.phoneFlag', 'session.revoke']);
// Called only by the local maintenance script. This is not an HTTP endpoint.
export async function maintain(command: string, input: unknown = {}) {
    const token = randomBytes(32).toString('hex');
    await rpc('centrifund_crm_create_session', { p_token_hash: token, p_owner_id: 'maintenance', p_role: 'admin', p_password_version: null });
    const call = (action: string, args: object = {}) => rpc('centrifund_crm_request', { p_session_hash: token, p_password_version: '', p_action: action, p_args: args, p_allow_admin: true });
    try {
        switch (command) {
            case 'health': return await call('admin.health');
            case 'list': return await call('contacts.list', { view: 'all' });
            case 'show': return await call('contact.get', { contactId: z.string().uuid().parse(input) });
            case 'import-preview': {
                const source = z.string().max(2000000).parse(input);
                return await call('import.preview', { sourceHash: hash(source), rows: parseImport(source) });
            }
            case 'import-confirm': {
                const args = z.object({ id: z.string().uuid(), sourceHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(input);
                return await call('import.confirm', args);
            }
            case 'apply': {
                const value = z.object({ action: z.string(), args: z.unknown() }).strict().parse(input);
                if (!allowed.has(value.action)) throw new Error('Unsupported maintenance operation');
                return await call(value.action, actionSchemas[value.action].parse(value.args) as object);
            }
            default: throw new Error('Unknown maintenance command');
        }
    } finally {
        await call('session.logout');
    }
}
