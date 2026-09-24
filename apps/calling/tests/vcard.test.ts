import { describe, it, expect } from 'vitest';
import { contactVcard } from '../shared/vcard';
describe('iPhone contact cards', () => {
    it('exports only shared address-book fields and excludes bad numbers', () => {
        const card = contactVcard({ id: '11111111-1111-4111-8111-111111111111', name: 'Casey Example', company: 'Example; Homes', email: 'casey@example.invalid', phones: [{ id: '1', value: '+1 202-555-0141', is_bad: false }, { id: '2', value: '202-555-0199', is_bad: true }] });
        expect(card).toContain('VERSION:3.0\r\n');
        expect(card).toContain('ORG:Example\\; Homes');
        expect(card).toContain('TEL;TYPE=VOICE:+1 202-555-0141');
        expect(card).not.toContain('0199');
        expect(card).not.toContain('NOTE:');
    });
    it('escapes line injection and folds long Unicode lines without breaking characters', () => {
        const card = contactVcard({ id: 'id', name: 'Zoë '.repeat(50) + '\nTEL:evil', company: 'A,B\\C', email: '', phones: [] });
        expect(card).not.toContain('\r\nTEL:evil');
        for (const line of card.split('\r\n'))
            expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
        expect(card).not.toContain('�');
    });
});
