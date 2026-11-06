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
  const currentId = currentTrack.getSettings?.().deviceId;
  return currentId !== matchedMicrophone.deviceId;
}
