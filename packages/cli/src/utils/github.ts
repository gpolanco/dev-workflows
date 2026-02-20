const BRANCH = 'main';
const REPO = 'gpolanco/dev-workflows';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/content`;
const API_BASE = `https://api.github.com/repos/${REPO}/contents/content`;

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
    throw new GitHubError(`Content not found: ${path}`, 404);
  }
  if (status === 403) {
    throw new GitHubError(
      'GitHub API rate limit exceeded. Try again later or set a GITHUB_TOKEN environment variable.',
      403,
    );
  }
  throw new GitHubError(`GitHub request failed (HTTP ${String(status)})`, status);
}

export async function fetchContent(contentPath: string): Promise<string> {
  const url = `${RAW_BASE}/${contentPath}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(`Network error fetching content: ${msg}`, 0);
  }

  if (!response.ok) {
    handleResponseError(response.status, contentPath);
  }

  return response.text();
}

export async function fetchRawContent(path: string): Promise<string> {
  return fetchContent(`rules/${path}.md`);
}

interface GitHubContentsEntry {
  name: string;
  type: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'dir';
}

export async function listContentDirectory(contentPath: string): Promise<DirectoryEntry[]> {
  const url = `${API_BASE}/${contentPath}?ref=${BRANCH}`;

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
    handleResponseError(response.status, contentPath);
  }

  const data = (await response.json()) as GitHubContentsEntry[];

  return data
    .filter((entry) => entry.type === 'file' || entry.type === 'dir')
    .map((entry) => ({
      name: entry.name.replace(/\.md$/, '').replace(/\.json$/, '').replace(/\.yml$/, ''),
      type: entry.type === 'dir' ? ('dir' as const) : ('file' as const),
    }));
}

export async function listDirectory(path?: string): Promise<DirectoryEntry[]> {
  const contentPath = path ? `rules/${path}` : 'rules';
  const entries = await listContentDirectory(contentPath);
  return entries.map((entry) => ({
    name: entry.name.replace(/\.md$/, ''),
    type: entry.type,
  }));
}
