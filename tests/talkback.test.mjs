import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('phone talkback: the computer confirms playback and asks for a click only when the browser blocks sound', async () => {
  const app = await read('kamera/app.js');
  assert.match(app, /type: "talkback-status", viewerId, status/);
  assert.match(app, /report\("playing"\)/);
  assert.match(app, /report\("blocked"\)/);
  assert.match(app, /addEventListener\("pointerdown", resume, \{ once: true, capture: true \}\)/);
  assert.match(app, /sig\.type === "talkback-status"\) return showTalkStatus/);
  assert.match(app, /Komputer nie potwierdził rozmowy/);
  assert.match(app, /echoCancellation: true, noiseSuppression: true/);
});

test('Windows camera computer plays the phone voice without a click', async () => {
  const program = await read('desktop-client/Program.cs');
  assert.match(program, /new CoreWebView2EnvironmentOptions\("--autoplay-policy=no-user-gesture-required"\)/);
  assert.match(program, /CreateAsync\(userDataFolder: dataPath, options: environmentOptions\)/);
});

test('Android app grants only the microphone, only to the official site, after the system permission', async () => {
  const [manifest, activity, access] = await Promise.all([
    read('native-mobile/android/app/src/main/AndroidManifest.xml'),
    read('native-mobile/android/app/src/main/java/pl/solorz/homesecurity/MainActivity.java'),
    read('native-mobile/android/app/src/main/java/pl/solorz/homesecurity/MicrophoneAccess.java')]);
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.doesNotMatch(manifest, /android\.permission\.CAMERA/);
  assert.match(activity, /microphone\.handle\(request\)/);
  assert.match(access, /"dominiksolorz\.github\.io"\.equals\(request\.getOrigin\(\)\.getHost\(\)\)/);
  assert.match(access, /!PermissionRequest\.RESOURCE_AUDIO_CAPTURE\.equals\(resource\)\) return false/);
  assert.match(access, /RequestPermission\(\)/);
  assert.doesNotMatch(access, /RESOURCE_VIDEO_CAPTURE/);
});

test('turning the phone microphone on or off never restarts the live picture or listening', async () => {
  const app = await read('kamera/app.js');
  const toggle = app.slice(app.indexOf('async function toggleTalkback()'), app.indexOf('async function onSignal(sig)', app.indexOf('async function toggleTalkback()')));
  assert.doesNotMatch(toggle, /\breset\(\)/, 'the microphone button must not tear down the connection');
  assert.match(toggle, /talkSender\.replaceTrack\(talkStream\.getAudioTracks\(\)\[0\] \|\| null\)/);
  assert.match(toggle, /talkSender\?\.replaceTrack\(null\)/);
  assert.match(toggle, /enabled: true, live: true/);
  assert.match(app, /talkTransceiver\.direction = "sendrecv"/);
  assert.match(app, /if \(!sig\.live \|\| !peer/, 'older phones still get a fresh connection');
  assert.match(app, /if \(peer\.talkWanted\) return playTalk\(peer, sig\.viewerId, chan\.channel\)/);
});
