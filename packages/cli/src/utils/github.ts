const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/gpolanco/dev-workflows/${BRANCH}/content/rules`;
const API_BASE = 'https://api.github.com/repos/gpolanco/dev-workflows/contents/content/rules';

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

function handleResponseError(status: number, path: string): never {
  if (status === 404) {
    throw new GitHubError(`Rule not found: ${path}`, 404);
  }
  if (status === 403) {
    throw new GitHubError(
      'GitHub API rate limit exceeded. Try again later or set a GITHUB_TOKEN environment variable.',
      403,
    );
  }
  throw new GitHubError(`GitHub request failed (HTTP ${String(status)})`, status);
}

export async function fetchRawContent(path: string): Promise<string> {
  const url = `${RAW_BASE}/${path}.md`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(`Network error fetching rule: ${msg}`, 0);
  }

  if (!response.ok) {
    handleResponseError(response.status, path);
  }

  return response.text();
}

interface GitHubContentsEntry {
  name: string;
  type: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'dir';
}

export async function listDirectory(path?: string): Promise<DirectoryEntry[]> {
  const segments = [API_BASE];
  if (path) segments.push(path);
  const base = segments.join('/');
  const url = `${base}?ref=${BRANCH}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  const token = process.env['GITHUB_TOKEN'];
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(`Network error listing directory: ${msg}`, 0);
  }

  if (!response.ok) {
    handleResponseError(response.status, path ?? 'rules');
  }

  const data = (await response.json()) as GitHubContentsEntry[];

  return data
    .filter((entry) => entry.type === 'file' || entry.type === 'dir')
    .map((entry) => ({
      name: entry.name.replace(/\.md$/, ''),
      type: entry.type === 'dir' ? ('dir' as const) : ('file' as const),
    }));
}
