import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../kamera/auth.js', import.meta.url), 'utf8');
const functionSource = source.slice(source.indexOf('export async function currentAccountUser()'), source.indexOf('export async function accessRoleForCurrentUser()')).replace('export ', '');
function readUser({ user = null, error = null } = {}) {
  const context = { accountClient: { auth: { getUser: async () => ({ data: { user }, error }) } } };
  vm.runInNewContext(functionSource, context);
  return context.currentAccountUser();
}
test('normal signed-out visitor receives an anonymous result, not a startup exception', async () => {
  assert.equal(await readUser({ error: { name: 'AuthSessionMissingError' } }), null);
});
test('network, server and token failures are not treated as valid sessions', async () => {
  for (const name of ['AuthApiError', 'AuthRetryableFetchError', 'AuthInvalidJwtError']) {
    const error = { name };
    await assert.rejects(readUser({ error }), value => value === error);
  }
});
test('a successfully server-verified user is retained', async () => {
  const user = { id: 'verified-user', identities: [] };
  assert.equal(await readUser({ user }), user);
});
test('Google email verification remains required', async () => {
  await assert.rejects(readUser({ user: { id: 'google-user', identities: [{ provider: 'google' }] } }), /nie został potwierdzony/);
});
