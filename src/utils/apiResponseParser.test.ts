import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultResponseParser } from './apiResponseParser';
import { BaseApiError } from './apiClientErrors';

describe('DefaultResponseParser', () => {
    let parser: DefaultResponseParser;

    beforeEach(() => {
        parser = new DefaultResponseParser();
    });

    it('should return empty object for 204 No Content', async () => {
        const res = new Response(null, { status: 204 });
        const result = await parser.parse(res, '/test');
        expect(result).toEqual({});
    });

    it('should parse application/json successfully', async () => {
        const body = JSON.stringify({ key: 'value' });
        const res = new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
        const result = await parser.parse<{key: string}>(res, '/test');
        expect(result).toEqual({ key: 'value' });
    });

    it('should throw BaseApiError when json parsing fails', async () => {
        const res = new Response('invalid json', {
            status: 200,
            headers: { 'content-type': 'application/json', 'x-custom': 'test' }
        });

        await expect(parser.parse(res, '/test')).rejects.toThrow(BaseApiError);
        await expect(parser.parse(res, '/test')).rejects.toThrow('Invalid JSON response from server');
    });

    it('should fallback to returning text if not json', async () => {
        const res = new Response('plain text', {
            status: 200,
            headers: { 'content-type': 'text/plain' }
        });
        const result = await parser.parse<string>(res, '/test');
        expect(result).toBe('plain text');
    });

    it('should return raw response for parseStream', async () => {
        const res = new Response('stream data', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' }
        });
        const result = await parser.parseStream(res, '/test');
        expect(result).toBe(res);
    });
});
