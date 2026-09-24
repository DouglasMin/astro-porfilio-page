import { createHash, timingSafeEqual } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** Constant-time comparison; hashing first makes both buffers the same length. */
export function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Reads the admin token once per Lambda container. */
export function createSecretTokenReader(secretArn: string, client = new SecretsManagerClient({})): () => Promise<string> {
  let cached: Promise<string> | undefined;
  return () => {
    cached ??= client
      .send(new GetSecretValueCommand({ SecretId: secretArn }))
      .then((result) => {
        if (!result.SecretString) throw new Error('Admin token secret is empty');
        return result.SecretString;
      })
      .catch((error: unknown) => {
        cached = undefined;
        throw error;
      });
    return cached;
  };
}
