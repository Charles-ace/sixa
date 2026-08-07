const encoder = new TextEncoder();

export function toBase64Url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSecretKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET ?? 'sixa-local-dev-secret-change-me';
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await getSecretKey();
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
  return `${data}.${toBase64Url(signature)}`;
}

export async function verifyToken<T extends object>(token: string): Promise<T | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await getSecretKey();
  const valid = await crypto.subtle.verify('HMAC', key, new Uint8Array(fromBase64Url(sig)).buffer, encoder.encode(`${header}.${body}`));
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T & { exp?: number };
    if (parsed.exp && parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}