# HOME SECURITY contact delivery

## Actual delivery path

`pomoc.html` -> `marketing-contact.js` -> Supabase Edge Function `home-contact` -> separate Google Apps Script project `HOME SECURITY Contact` -> Google MailApp -> `goldservicepoland@gmail.com`.

The browser never receives relay credentials and never opens an email client as the form's delivery mechanism. A separate direct `mailto:` address remains an explicit alternative. No camera or Drive code was modified to implement delivery.

Apps Script project: `1CSLoFUvVUFfirtTj6WRFZbe1EhfNj3tgdYZyUpMrm7Wt0RdtTH0FtpOm`. Its only Google scope is `script.send_mail`: it cannot read the Gmail inbox. It runs as the owner and only sends to the recipient hardcoded in `supabase/contact-mailer.gs`. The visitor's validated email becomes Reply-To, never an arbitrary recipient or spoofed From address.

Supabase project: `ksacbcrzuwdahnmggfxg`. Deploy `supabase/functions/home-contact/index.ts` and `core.mjs` with gateway JWT verification disabled for signed-out visitors. Configure `CONTACT_RELAY_URL` and `CONTACT_RELAY_SECRET` as Edge Function Secrets; configure the same secret in Apps Script Properties. Never commit secret values or send them to a browser. Google web-app access is public at the transport layer but every mail request needs a server-generated HMAC signature and a timestamp within five minutes.

## Validation and retries

- Required name, surname, email, topic, message (10–4,000 characters), consent and UUIDv4 request ID. Maximum JSON body is 16 KB. No newline injection in identity/header fields, arbitrary receiver, callback URL, model selection or provider configuration from the visitor.
- HMAC is over an explicit JSON array of fields plus the timestamp, UTF-8. This makes authentication independent of JSON object property order across runtimes.
- Script Lock serializes acceptance. A request ID and canonical payload digest are recorded before calling MailApp. A repeat with the same content returns the previous success without sending again. Reusing an ID with different content is refused.
- If delivery is uncertain, the same ID is not automatically sent again. The UI retains all form values and reuses its ID on retry, even when session storage is blocked. A success label requires `ok=true`, `status=sent` and the matching request ID from the backend.
- Limits: one message/minute per sender hash, 50/day globally and MailApp's own remaining-recipient quota. The fixed recipient prevents an open mail relay; these limits are not a replacement for CAPTCHA under sustained abuse.
- Technical request states expire after two days; expired records are removed lazily on subsequent requests. They contain digests/status, not message bodies. Messages are stored in the owner's Gmail. Infrastructure has its own logs; application logs emit safe relay error categories, never message contents, signatures or credentials.

## Verified behavior

- Real server submission returned a matching `sent` receipt; Gmail showed the test message in INBOX, with the correct recipient and Reply-To, and DKIM/SPF/DMARC passing.
- Repeating the identical request returned success while Gmail still contained only one message for that request ID.
- Unit tests cover malformed fields/consent, forbidden origins, mismatched receipts, canonical signatures, send-once behavior, uncertain outcomes and frontend retry state.

Useful primary references: https://developers.google.com/apps-script/reference/mail/mail-app and https://developers.google.com/apps-script/guides/web . MailApp acknowledgement means Google accepted the send call; it is not an unconditional delivery guarantee for future messages.
