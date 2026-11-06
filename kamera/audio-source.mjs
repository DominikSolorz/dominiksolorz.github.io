// Match a USB camera with its actual microphone using browser device group IDs.
// Never guess from a product name or switch when the device identity is ambiguous.
export function microphoneForCamera(devices, cameraTrack) {
  if (!Array.isArray(devices) || !cameraTrack) return null;
  const settings = cameraTrack.getSettings?.() || {};
  const cameras = devices.filter(device => device.kind === 'videoinput' && device.groupId);
  const byId = settings.deviceId
    ? cameras.filter(device => device.deviceId === settings.deviceId)
    : [];
  const byLabel = cameraTrack.label
    ? cameras.filter(device => device.label && device.label === cameraTrack.label)
    : [];
  const groupId = settings.groupId
    || (byId.length === 1 ? byId[0].groupId : '')
    || (byLabel.length === 1 ? byLabel[0].groupId : '');
  if (!groupId) return null;

  const microphones = devices.filter(device =>
    device.kind === 'audioinput' && device.groupId === groupId && device.deviceId
  );
  return microphones.length === 1 ? microphones[0] : null;
}

export function shouldSwitchMicrophone(currentTrack, matchedMicrophone) {
  if (!matchedMicrophone?.deviceId || currentTrack?.readyState !== 'live') return false;
  const currentSettings = currentTrack.getSettings?.() || {};
  if (currentSettings.deviceId && currentSettings.deviceId === matchedMicrophone.deviceId) return false;
  // Audio and video devices in the same hardware group already share a source.
  if (currentSettings.groupId && currentSettings.groupId === matchedMicrophone.groupId) return false;
  return true;
}

/**
 * Prefer the webcam's own microphone when the browser can identify it.
 * Preserve a working recording if re-opening the audio input fails.
 * No audio is uploaded, played locally, or logged by this helper.
 */
export async function preferCameraMicrophone(captured, mediaDevices, constraints, Stream = globalThis.MediaStream) {
  const current = captured?.getAudioTracks?.()[0];
  const camera = captured?.getVideoTracks?.()[0];
  const unchanged = { stream: captured, selected: false, reason: 'default' };
  if (!current || current.readyState !== 'live' || !camera || !mediaDevices?.enumerateDevices || !Stream) {
    return unchanged;
  }
  let devices;
  try { devices = await mediaDevices.enumerateDevices(); }
  catch { return { ...unchanged, reason: 'device_list_unavailable' }; }
  const chosen = microphoneForCamera(devices, camera);
  if (!chosen) return { ...unchanged, reason: 'no_unambiguous_pair' };
  if (!shouldSwitchMicrophone(current, chosen)) return { ...unchanged, reason: 'already_matched' };

  let replacement;
  try {
    replacement = await mediaDevices.getUserMedia({
      video: false,
      audio: { ...constraints, deviceId: { exact: chosen.deviceId } },
    });
    const microphone = replacement.getAudioTracks()[0];
    if (!microphone || microphone.readyState !== 'live') {
      replacement.getTracks().forEach(track => track.stop());
      return { ...unchanged, reason: 'replacement_unavailable' };
    }
    const result = new Stream([...captured.getVideoTracks(), microphone]);
    // Close the old audio capture only when the new stream is ready.
    captured.getAudioTracks().forEach(track => track.stop());
    return { stream: result, selected: true, reason: 'camera_microphone' };
  } catch {
    replacement?.getTracks?.().forEach(track => track.stop());
    return { ...unchanged, reason: 'replacement_failed' };
  }
}
