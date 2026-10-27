# Real camera workspace — web build 222

## Delivered

The desktop dashboard uses real DOM controls and independent preview connections,
not images of controls. A camera has a stable ID, name, location, source adapter
and its own state. Adding an additional camera does not replace the primary
camera. Removing it stops only the resource owned by that additional preview.
Routes and grid pages retain the original video nodes and do not stop sources.
Logout/page exit releases additional preview resources.

Source adapters currently implemented:

- Windows video devices exposed through the operating-system driver. USB,
  capture cards and wireless devices are usable only when Windows exposes them
  as video inputs. A Bluetooth radio by itself does not provide a video stream.
- HTTPS WebRTC/WHEP endpoints with the necessary server CORS/network configuration.
- HTTPS JPEG/MJPEG image endpoints. This adapter does not claim recording or
  measured live FPS from an image; it reports whether an image was decoded.

URL user information and common password/token/authentication query parameters
are rejected before persistence. Other secret-bearing URLs must not be entered
either; the application cannot infer a secret hidden in an arbitrary URL path.
Direct RTSP/ONVIF and credentialed proprietary devices require a native agent
adapter. Do not describe them as currently supported.

Configuration is stored locally on this device, namespaced by the verified
account ID already obtained by the existing account/PIN flow. It is not a new
cloud catalogue. Additional PC USB previews are not relayed to the phone yet.
The existing primary-camera remote view and archive path are preserved.

The catalogue permits 128 additional configurations, with nine tiles per page
and a maximum of nine additional active previews. Saved devices do not all start
automatically. These are resource limits, not proof that a PC can decode 50 live
feeds. Preview quality controls apply to system devices and actual dimensions
are reported from media telemetry, rather than assumed from selected preferences.

**Recording and DVR still concern the primary camera.** Concurrent recording,
per-camera retention/Drive queues, native RTSP/ONVIF ingest and cross-device camera
catalogue/permissions remain separate work. The production UI states this scope.

## Verification

- Unit tests exercise 50 configurations, account separation, persistence failure,
  duplicate/credential rejection, connection budgets, late acquisition cleanup,
  retries and ownership of tracks during removal/logout.
- `HomeSecurityDesktop.exe --camera-workspace-test <absolute-result-path>` runs
  the exact component in an isolated WebView2 profile. It never reads an account
  session, calls IPC or opens camera/microphone devices. It checks 50 entries,
  nine visible tiles, lack of overlapping rectangles, the add dialog and retention
  of the primary video node. Captured PNGs contain clearly marked fixture data.
- Physical verification with a second camera and real network endpoints is still
  required. This computer currently exposes a single Windows camera.

This is an implemented preview-management stage, not certification of a
commercial 50-camera recorder. Marketing and product support must reflect this.
