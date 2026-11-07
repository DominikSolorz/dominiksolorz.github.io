# Routes and recording-folder audit, web build 247

Rebased on the latest published source, retaining atomic IndexedDB folder
selection and prompt permission restoration introduced in build 246.

## Repairs

- Legacy recordings entry opens `panel.html?section=recordings` directly.
  The old `?section=recordings` and `?wroc=nagrania` homepage links also enter
  the private panel, preserving their query parameters.
- Gallery project-status links and first-run download links point to real pages.
- The panel no longer links to the removed 1.4.22 installer. It opens the current
  download page so subsequent releases cannot strand this link again.
- The desktop Mobile link explicitly selects the phone layout.
- An owner can close and verify the current segment with **Zapisz bieżący
  fragment do folderu**, independently of Drive availability. This rotates only
  the recorder segment, does not stop the live source and does not await upload.
  Errors, unchanged old receipts and missing permission cannot report success.
- A newly selected, write-tested folder clears stale write errors and resets
  the prior folder receipt; a new recording confirmation is still required.

## Evidence and limits

- Fresh Chrome context: 56 desktop/mobile route checks of all 23 HTML pages
  and five query variants. No page exceptions, blank pages, horizontal overflow
  or visibly broken images were observed. No account or camera was opened.
- `verify-site-links.mjs --live`: 93 distinct local destinations, no missing
  files/fragments or HTTP errors after corrections. Link checking is now a
  frontend publication gate. This checks destinations, not authenticated actions.
- Frontend regression tests cover local segment completion and refusal to
  confirm a failed write; see current test output for total.
- The running installed app was 1.4.22 / bundled panel 241 and reported a folder
  write problem. Drive sync was ready but discovered no new files. These are
  separate from website deployment and code-level regression results.
- Computer Use could read the running app, but clicking failed with
  `coordinate input geometry is unavailable`. No successful real-camera file
  write, user-folder reauthorization or installed-app upgrade is claimed here.
  Existing recordings, browser databases, credentials and live capture were kept.

## Final publication evidence

- Web build 247 was verified after deployment with 56 fresh-browser checks and 93 link targets, all passing.
- Windows installer 1.4.26 passed the release workflow, including agent crash tests and the isolated WebView2 camera UI test.
- Synthetic browser test used actual FileSystemHandle persistence in a fresh OPFS directory: a 1502-byte WebM was written, restored after reload and decoded at 320 x 180. It did not access a physical camera or user directory.
- Installed executable remained 1.4.22. Latest UI observation showed the pre-login page; a real-camera folder write remains unverified.
