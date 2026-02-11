import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRawContent, listDirectory, GitHubError } from '../../src/utils/github.js';

describe('github edge cases', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('GitHubError constructor', () => {
    it('sets name, statusCode, and message correctly', () => {
      const err = new GitHubError('something went wrong', 502);
      assert.equal(err.name, 'GitHubError');
      assert.equal(err.statusCode, 502);
      assert.equal(err.message, 'something went wrong');
      assert.ok(err instanceof Error);
    });
  });

  describe('fetchRawContent edge cases', () => {
    it('throws GitHubError with status 500 on server error', async () => {
      globalThis.fetch = async () =>
        new Response('Internal Server Error', { status: 500 });

      await assert.rejects(
        () => fetchRawContent('test/rule'),
        (err: unknown) => {
          assert.ok(err instanceof GitHubError);
          assert.equal(err.statusCode, 500);
          assert.ok(err.message.includes('HTTP 500'));
          return true;
        },
      );
    });

    it('throws GitHubError with status 401 on unauthorized', async () => {
      globalThis.fetch = async () =>
        new Response('Unauthorized', { status: 401 });

      await assert.rejects(
        () => fetchRawContent('test/rule'),
        (err: unknown) => {
          assert.ok(err instanceof GitHubError);
          assert.equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it('wraps non-Error throw (string) from fetch into GitHubError', async () => {
      globalThis.fetch = async () => {
        throw 'connection refused';
      };

      await assert.rejects(
        () => fetchRawContent('test/rule'),
        (err: unknown) => {
          assert.ok(err instanceof GitHubError);
          assert.ok(err.message.includes('connection refused'));
          assert.equal(err.statusCode, 0);
          return true;
        },
      );
    });

    it('returns empty string when response body is empty', async () => {
      globalThis.fetch = async () =>
        new Response('', { status: 200 });

      const content = await fetchRawContent('test/rule');
      assert.equal(content, '');
    });
  });

  describe('listDirectory edge cases', () => {
    it('returns empty array when GitHub responds with []', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });

      const entries = await listDirectory('empty-category');
      assert.deepEqual(entries, []);
    });

    it('builds URL without extra segment when path is omitted', async () => {
      let capturedUrl = '';
      globalThis.fetch = async (input: string | URL | Request) => {
        capturedUrl = typeof input === 'string' ? input : String(input);
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };

      await listDirectory();
      // URL should end with /rules?ref=... (no extra path segment)
      assert.ok(capturedUrl.includes('/contents/content/rules?ref='));
      assert.ok(!capturedUrl.includes('/rules/?ref='));
    });
  });
});
