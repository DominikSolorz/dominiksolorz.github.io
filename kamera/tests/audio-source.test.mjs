import test from 'node:test';
import assert from 'node:assert/strict';
import { microphoneForCamera, shouldSwitchMicrophone } from '../audio-source.mjs';

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
