import http from 'node:http';
import { handler as chatHandler } from './chat-handler.js';

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
};

const normalizeHeaders = (headers) =>
    Object.fromEntries(
        Object.entries(headers || {}).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(',') : String(value ?? ''),
        ])
    );

const readRawBody = (req) =>
    new Promise((resolve, reject) => {
        if (req.method === 'GET' || req.method === 'HEAD') {
            resolve('');
            return;
        }

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });

const toEvent = async (req) => ({
    httpMethod: req.method || 'GET',
    headers: normalizeHeaders(req.headers),
    body: await readRawBody(req),
});

const sendResult = (res, result) => {
    res.writeHead(result?.statusCode || 500, result?.headers || DEFAULT_HEADERS);
    res.end(result?.body || '');
};

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/healthz') {
        res.writeHead(200, DEFAULT_HEADERS);
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (url.pathname !== '/api/chat' && url.pathname !== '/api/chat/') {
        res.writeHead(404, DEFAULT_HEADERS);
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    try {
        const event = await toEvent(req);
        const result = await chatHandler(event, {});
        sendResult(res, result);
    } catch (error) {
        res.writeHead(500, DEFAULT_HEADERS);
        res.end(
            JSON.stringify({
                error: 'Internal server error.',
                ...(process.env.NODE_ENV !== 'production' && {
                    details: error?.message || String(error),
                }),
            })
        );
    }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => {
    console.log(`[V-MATE] Cloud Run server listening on port ${port}`);
});
