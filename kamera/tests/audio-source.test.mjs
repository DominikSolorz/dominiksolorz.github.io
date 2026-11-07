import test from 'node:test';
import assert from 'node:assert/strict';
import { microphoneForCamera, shouldSwitchMicrophone, preferCameraMicrophone } from '../audio-source.mjs';

const camera = (id = 'usb-cam', label = 'USB webcam', groupId = '') => ({
  label, readyState: 'live', getSettings: () => ({ deviceId: id, groupId })
});
const device = (kind, deviceId, groupId, label = '') => ({ kind, deviceId, groupId, label });

test('chooses the microphone belonging to the USB webcam, not the computer default', () => {
  const devices = [
    device('audioinput', 'internal-mic', 'laptop'),
    device('videoinput', 'usb-cam', 'usb-group', 'USB webcam'),
    device('audioinput', 'usb-mic', 'usb-group'),
  ];
  assert.equal(microphoneForCamera(devices, camera())?.deviceId, 'usb-mic');
  assert.equal(shouldSwitchMicrophone(camera('internal-mic'), devices[2]), true);
  assert.equal(shouldSwitchMicrophone(camera('usb-mic'), devices[2]), false);
});

test('also matches using camera track groupId when no video device is enumerated', () => {
  const microphone = device('audioinput', 'usb-mic', 'usb-group');
  assert.equal(microphoneForCamera([microphone], camera('unlisted', 'Camera', 'usb-group')), microphone);
});

test('does not guess when device groups are missing or ambiguous', () => {
  const cam = camera();
  assert.equal(microphoneForCamera([device('audioinput', 'default', 'laptop')], cam), null);
  const inputs = [
    device('videoinput', 'usb-cam', 'usb-group', 'USB webcam'),
    device('audioinput', 'mic-a', 'usb-group'),
    device('audioinput', 'mic-b', 'usb-group'),
  ];
  assert.equal(microphoneForCamera(inputs, cam), null);
  assert.equal(microphoneForCamera([], null), null);
  assert.equal(microphoneForCamera(null, cam), null);
});

test('will not replace a stopped or unavailable microphone', () => {
  assert.equal(shouldSwitchMicrophone({ readyState: 'ended' }, { deviceId: 'usb-mic' }), false);
  assert.equal(shouldSwitchMicrophone(null, { deviceId: 'usb-mic' }), false);
  assert.equal(shouldSwitchMicrophone(camera('default'), null), false);
});

test('camera can be located by unique label when settings omit the camera ID', () => {
  const devices = [
    device('videoinput', 'usb-camera-1', 'group-1', 'USB webcam'),
    device('audioinput', 'usb-mic-1', 'group-1'),
  ];
  assert.equal(microphoneForCamera(devices, camera(undefined, 'USB webcam'))?.deviceId, 'usb-mic-1');
});

const mic = (id, groupId = '') => {
  let stopped = false;
  return {
    get stopped() { return stopped; },
    readyState: 'live',
    getSettings: () => ({ deviceId: id, groupId }),
    stop() { stopped = true; }
  };
};
const mockMediaStream = class {
  constructor(tracks) { this.tracks = tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind !== 'video'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
};
const mockVideo = { kind: 'video', label: 'USB webcam', readyState: 'live', getSettings: () => ({ deviceId: 'usb-cam' }) };

test('keeps camera video, switches only audio and closes old microphone after successful selection', async () => {
  const originalMic = mic('laptop');
  const selectedMic = mic('usb-mic');
  const captured = { getAudioTracks: () => [originalMic], getVideoTracks: () => [mockVideo] };
  let requested;
  const media = {
    enumerateDevices: async () => [
      device('videoinput', 'usb-cam', 'usb-group', 'USB webcam'),
      device('audioinput', 'laptop', 'laptop-group'),
      device('audioinput', 'usb-mic', 'usb-group'),
    ],
    getUserMedia: async options => {
      requested = options;
      return { getAudioTracks: () => [selectedMic], getTracks: () => [selectedMic] };
    }
  };
  const result = await preferCameraMicrophone(captured, media, { autoGainControl: false, noiseSuppression: true }, mockMediaStream);
  assert.equal(result.selected, true);
  assert.equal(result.stream.getVideoTracks()[0], mockVideo);
  assert.equal(result.stream.getAudioTracks()[0], selectedMic);
  assert.equal(originalMic.stopped, true);
  assert.equal(selectedMic.stopped, false);
  assert.deepEqual(requested, { video: false, audio: { autoGainControl: false, noiseSuppression: true, deviceId: { exact: 'usb-mic' } } });
});

test('does not switch the already-matched microphone or request additional permissions', async () => {
  const originalMic = mic('usb-mic', 'usb-group');
  const captured = { getAudioTracks: () => [originalMic], getVideoTracks: () => [mockVideo] };
  const media = {
    enumerateDevices: async () => [
      device('videoinput', 'usb-cam', 'usb-group', 'USB webcam'),
      device('audioinput', 'usb-mic', 'usb-group')
    ],
    getUserMedia: () => { throw new Error('should never run'); },
  };
  const result = await preferCameraMicrophone(captured, media, {}, mockMediaStream);
  assert.equal(result.stream, captured);
  assert.equal(result.reason, 'already_matched');
  assert.equal(originalMic.stopped, false);
});

test('keeps existing microphone if replacement fails or hardware pairing is unknown', async () => {
  const originalMic = mic('laptop');
  const captured = { getAudioTracks: () => [originalMic], getVideoTracks: () => [mockVideo] };
  const devices = [
    device('videoinput', 'usb-cam', 'usb-group', 'USB webcam'),
    device('audioinput', 'usb-mic', 'usb-group'),
  ];
  const errorResult = await preferCameraMicrophone(captured, {
    enumerateDevices: async () => devices,
    getUserMedia: async () => { throw new Error('NotReadableError'); }
  }, {}, mockMediaStream);
  assert.equal(errorResult.stream, captured);
  assert.equal(errorResult.reason, 'replacement_failed');
  assert.equal(originalMic.stopped, false);
  const ambiguous = await preferCameraMicrophone(captured, {
    enumerateDevices: async () => [...devices, device('audioinput', 'mic-2', 'usb-group')],
    getUserMedia: async () => { throw new Error('unexpected access'); }
  }, {}, mockMediaStream);
  assert.equal(ambiguous.reason, 'no_unambiguous_pair');
  assert.equal(originalMic.stopped, false);
});

test('does not request microphone when video-only mode is active', async () => {
  const captured = { getAudioTracks: () => [], getVideoTracks: () => [mockVideo] };
  const result = await preferCameraMicrophone(captured, null, {}, mockMediaStream);
  assert.equal(result.stream, captured);
  assert.equal(result.selected, false);
});
