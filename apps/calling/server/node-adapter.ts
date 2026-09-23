// Local development HTTP bridge; production uses Vercel's Web Standard handler.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle } from './handler.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 2100000) {
            res.statusCode = 413;
            res.end('Request too large');
            return;
        }
        ;
        chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value)
            headers.set(key, Array.isArray(value) ? value.join(',') : value);
    }
    const request = new Request(new URL(req.url ?? '/', process.env.APP_ORIGIN ?? 'http://localhost:5180'), { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method ?? 'GET') ? { body: Buffer.concat(chunks) } : {}) });
    const response = await handle(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => { if (key !== 'set-cookie')
        res.setHeader(key, value); });
    const cookies = response.headers.getSetCookie();
    if (cookies.length)
        res.setHeader('Set-Cookie', cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
}
