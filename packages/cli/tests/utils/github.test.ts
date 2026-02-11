import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRawContent, listDirectory } from '../../src/utils/github.js';

describe('github helpers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchRawContent', () => {
    it('returns content on success', async () => {
      globalThis.fetch = async () =>
        new Response('# Hello\n- rule 1', { status: 200 });

      const content = await fetchRawContent('typescript/strict');
      assert.equal(content, '# Hello\n- rule 1');
    });

    it('throws "not found" on 404', async () => {
      globalThis.fetch = async () =>
        new Response('Not Found', { status: 404 });

      await assert.rejects(
        () => fetchRawContent('unknown/missing'),
        (err: Error) => {
          assert.ok(err.message.includes('not found'));
          return true;
        },
      );
    });

    it('throws rate limit error on 403', async () => {
      globalThis.fetch = async () =>
        new Response('Forbidden', { status: 403 });

      await assert.rejects(
        () => fetchRawContent('typescript/strict'),
        (err: Error) => {
          assert.ok(err.message.includes('rate limit'));
          return true;
        },
      );
    });

    it('throws on network error', async () => {
      globalThis.fetch = async () => {
        throw new Error('ENOTFOUND');
      };

      await assert.rejects(
        () => fetchRawContent('typescript/strict'),
        (err: Error) => {
          assert.ok(err.message.includes('Network error'));
          return true;
        },
      );
    });
  });

  describe('listDirectory', () => {
    it('parses directory listing correctly', async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify([
            { name: 'strict.md', type: 'file' },
            { name: 'conventions.md', type: 'file' },
            { name: 'subfolder', type: 'dir' },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );

      const entries = await listDirectory('typescript');
      assert.equal(entries.length, 3);

      const first = entries[0];
      const second = entries[1];
      const third = entries[2];
      assert.ok(first);
      assert.ok(second);
      assert.ok(third);
      assert.deepEqual(first, { name: 'strict', type: 'file' });
      assert.deepEqual(second, { name: 'conventions', type: 'file' });
      assert.deepEqual(third, { name: 'subfolder', type: 'dir' });
    });

    it('strips .md extension from file names', async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify([{ name: 'react.md', type: 'file' }]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );

      const entries = await listDirectory('javascript');
      const first = entries[0];
      assert.ok(first);
      assert.equal(first.name, 'react');
    });

    it('filters out non-file/dir entries', async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify([
            { name: 'file.md', type: 'file' },
            { name: 'symlink', type: 'symlink' },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );

      const entries = await listDirectory();
      assert.equal(entries.length, 1);
      const first = entries[0];
      assert.ok(first);
      assert.equal(first.type, 'file');
    });

    it('throws on 404', async () => {
      globalThis.fetch = async () =>
        new Response('Not Found', { status: 404 });

      await assert.rejects(
        () => listDirectory('nonexistent'),
        (err: Error) => {
          assert.ok(err.message.includes('not found'));
          return true;
        },
      );
    });
  });
});
