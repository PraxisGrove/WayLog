export type MergeTokenPayload = {
  exp: number;
  primaryId: string;
  provider: 'email' | 'phone';
  providerUid: string;
  secondaryId: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = atob(padded);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createMergeToken(
  payload: Omit<MergeTokenPayload, 'exp'>,
  secret: string,
): Promise<string> {
  const encodedPayload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 10 * 60,
      } satisfies MergeTokenPayload),
    ),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await getSigningKey(secret),
    new TextEncoder().encode(encodedPayload),
  );

  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyMergeToken(token: string, secret: string): Promise<MergeTokenPayload> {
  const [encodedPayload, encodedSignature] = token.split('.');

  if (!encodedPayload || !encodedSignature) {
    throw new Error('Invalid merge token.');
  }

  const isValid = await crypto.subtle.verify(
    'HMAC',
    await getSigningKey(secret),
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(encodedPayload),
  );

  if (!isValid) {
    throw new Error('Invalid merge token signature.');
  }

  const payload = JSON.parse(
    new TextDecoder().decode(decodeBase64Url(encodedPayload)),
  ) as MergeTokenPayload;

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Merge token expired.');
  }

  return payload;
}
