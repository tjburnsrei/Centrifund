import { describe, it, expect } from 'vitest';
import { parseImport, normalizePhone } from '../shared/import';
describe('contact import', () => {
    const row = { id: 1, name: 'Casey Example', phones: ['(202) 555-0141'], email: 'CASEY@example.invalid', projects: [] };
    it('extracts data without evaluating scripts and retains contacts without phone numbers', () => {
        const source = '<script>const DATA=' + JSON.stringify([row, { ...row, id: 2, name: 'River Example', phones: [], email: '' }]) + '; throw new Error("never execute");</script>';
        const rows = parseImport(source);
        expect(rows).toHaveLength(2);
        expect(rows[1].phones).toEqual([]);
        expect(rows[0].email).toBe('casey@example.invalid');
    });
    it('rejects ambiguous source IDs and malformed data', () => { expect(() => parseImport(JSON.stringify([row, row]))).toThrow('unique'); expect(() => parseImport('alert(1)')).toThrow(); });
    it('normalizes US phone numbers consistently', () => expect(normalizePhone('(202) 555-0141')).toBe('12025550141'));
});
