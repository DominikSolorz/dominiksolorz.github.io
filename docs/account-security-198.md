# Account security release 198

## Password recovery

The profile requests Supabase password recovery only for the server-confirmed current account email. The public login screen also offers a generic email recovery request. Neither request changes a password. The email callback uses the existing allowed root callback URL and Supabase's PASSWORD_RECOVERY event. Only an event-confirmed recovery session for the same user enables the new-password submission, with a ten-minute frontend window in addition to the provider's token expiry. Passwords are not saved in browser storage or logs. This is a client flow using Supabase Auth, not a new server-enforced policy preventing all other authenticated Supabase password-update clients.

## PIN change

The user must supply their current PIN and repeat a different 4/6-digit PIN. The existing camera/control/legacy Drive key is preserved and encrypted with AES-GCM under the new PIN-derived PBKDF2 key. The envelope is bound to the authenticated user ID. Only the verifier, salt and encrypted envelope are persisted. An optimistic `pin_hash` predicate rejects concurrent writes; the response must return the updated row before success is shown.

This changes the PIN for subsequent unlocks. It intentionally does not revoke already-unlocked devices or rotate the camera sharing key. Forgotten-PIN recovery is not implemented, since an email-only replacement cannot recover the old encrypted camera key safely.

## Database

Applied remote migration `add_pin_wrapped_access_key` using the Supabase migration connector. It adds nullable `public.user_security.pin_wrapped_access_key jsonb`, limits the JSON object to 1024 bytes and does not rewrite any existing user's PIN. Confirmed that row security is enabled and the existing policy restricts reads and writes to `auth.uid() = user_id`.

The Supabase CLI is unavailable in this environment. No invented local migration timestamp was created; the remote migration history is authoritative and should be pulled with the CLI when available.

## Verification boundaries

Cryptographic tests cover legacy-key compatibility, two successive PIN changes, old-PIN rejection, cross-user substitution, corrupted ciphertext and input validation. Unit tests do not prove email delivery or a real account password/PIN change. These require a user-controlled end-to-end run. No real user's password or PIN was changed during implementation.
