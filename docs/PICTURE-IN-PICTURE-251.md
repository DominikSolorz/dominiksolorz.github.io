# Native picture-in-picture, web build 251

The original video element enters the browser's native PiP window. No extra
capture, fake DOM overlay, forced sound, visibilitychange request loop or
recorder/stream restart is introduced. The original manual click calls the
PiP request before awaiting playback or other operations.

- Standard API and Safari presentation mode support are checked for the actual
  source. Safari's negative source-capability probe is respected even if the
  standard API exists, as installed iOS PWAs may expose an unusable API.
- Buttons follow enter/leave/presentation events and real capability, not a
  fictional successful state. Metadata alone is not treated as decoded video.
- Options expose a persisted automatic-PiP preference. The Media Session
  enterpictureinpicture action requests native PiP when the browser invokes it.
  Disabling keeps a no-op action handler where supported to prevent automatic
  browser takeover. Unsupported actions leave manual controls usable.
- Automatic browser promotion is a preference/request, not guaranteed support
  on iPhone/Android. Chrome's documented automatic media-playback mechanism is
  for desktop and has eligibility and user-permission requirements. Do not
  describe this as equivalent to a native YouTube mobile application's support.
- Users should enter PiP manually while video is visible before hiding the
  browser when automatic promotion is unavailable. Closing the tab is distinct
  from hiding the browser. No promise of playback after closing the tab is made.
- Native and fallback fullscreen exit controls are both supported; the panel's
  acquired orientation lock is released after exiting native fullscreen.

Verification: real Chrome PiP API was exercised with an isolated synthetic canvas
stream: enter succeeded, exit succeeded, the track remained live in both states.
No camera/microphone/account was opened. Physical mobile verification and actual
OS-background promotion are not claimed. Unit tests cover Safari, rejected
permission, no frames, supported/unsupported automatic action and cleanup.

Primary references:
- https://developer.apple.com/documentation/webkitjs/adding_picture_in_picture_to_your_safari_media_controls
- https://developer.chrome.com/blog/automatic-picture-in-picture-media-playback
- https://developer.chrome.com/blog/automatic-picture-in-picture-initiated-by-the-browser
