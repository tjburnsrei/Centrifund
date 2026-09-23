import type { Contact } from './types';
// vCard must not carry control bytes into Contacts.
// eslint-disable-next-line no-control-regex
const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
function fold(line: string) {
    const rows: string[] = [];
    let current = '';
    let bytes = 0;
    for (const char of line) {
        const n = new TextEncoder().encode(char).length;
        if (bytes + n > 74) {
            rows.push(current);
            current = ' ';
            bytes = 1;
        }
        ;
        current += char;
        bytes += n;
    }
    rows.push(current);
    return rows.join('\r\n');
}
export function contactVcard(contact: Pick<Contact, 'id' | 'name' | 'company' | 'email' | 'phones'>) {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'UID:urn:uuid:' + contact.id, 'FN:' + escape(contact.name),
        'N:;' + escape(contact.name) + ';;;', 'ORG:' + escape(contact.company)];
    for (const p of contact.phones.filter(p => !p.is_bad))
        lines.push('TEL;TYPE=VOICE:' + escape(p.value));
    if (contact.email)
        lines.push('EMAIL;TYPE=INTERNET:' + escape(contact.email));
    return [...lines, 'END:VCARD'].map(fold).join('\r\n') + '\r\n';
}
