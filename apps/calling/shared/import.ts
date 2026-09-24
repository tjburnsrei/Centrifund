import { z } from 'zod';
const sourceRow = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().trim().min(1).max(300), company: z.string().nullish(),
    city: z.string().nullish(), county: z.string().nullish(),
    email: z.string().nullish(), phones: z.array(z.string()).max(30).default([]),
    loans12: z.union([z.number(), z.string()]).nullish(), size: z.union([z.number(), z.string()]).nullish(),
    lender: z.string().nullish(), since: z.union([z.string(), z.number()]).nullish(), projects: z.array(z.unknown()).max(200).default([])
});
export function parseImport(text: string) {
    if (text.length > 2000000)
        throw new Error('Import must be smaller than 2 MB.');
    const match = text.match(/const\s+DATA\s*=\s*(\[[\s\S]*?\]);/);
    const rows = z.array(sourceRow).min(1).max(2000).parse(JSON.parse(match?.[1] ?? text));
    if (new Set(rows.map(r => r.id)).size !== rows.length)
        throw new Error('Source IDs must be unique.');
    return rows.map(r => ({ source_id: r.id, name: r.name, company: r.company ?? '', city: r.city ?? '', county: r.county ?? '',
        email: (r.email ?? '').trim().toLowerCase(),
        phones: [...new Set(r.phones.map(p => p.trim()).filter(Boolean))],
        background: { loans12: r.loans12 ?? null, size: r.size ?? null, lender: r.lender ?? '', since: String(r.since ?? ''), projects: r.projects }
    }));
}
export function normalizePhone(value: string) { const digits = value.replace(/\D/g, ''); return digits.length === 10 ? '1' + digits : digits; }
