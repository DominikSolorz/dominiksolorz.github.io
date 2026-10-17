export const AUDIO_PROFILES = Object.freeze({
  clean: {noiseSuppression:true,echoCancellation:true,autoGainControl:false},
  voice: {noiseSuppression:true,echoCancellation:true,autoGainControl:true},
  environment: {noiseSuppression:false,echoCancellation:false,autoGainControl:false},
});
export function audioConstraints(profile = 'clean') {
  if (!Object.hasOwn(AUDIO_PROFILES,profile)) throw new Error('Nieprawidłowy tryb mikrofonu.');
  return {...AUDIO_PROFILES[profile]};
}
export async function applyAudioProfile(track,profile,supported = {}) {
  if (!track || track.readyState !== 'live') throw new Error('Brak aktywnego mikrofonu na komputerze nadającym.');
  const wanted=audioConstraints(profile);
  const constraints=Object.fromEntries(Object.entries(wanted).filter(([key])=>supported[key]===true));
  if (!Object.keys(constraints).length) throw new Error('Ten mikrofon lub przeglądarka nie udostępnia regulacji odszumiania.');
  await track.applyConstraints(constraints);
  const actual=track.getSettings();
  return {profile,actual:Object.fromEntries(Object.keys(wanted).map(key=>[key,typeof actual[key]==='boolean'?actual[key]:null]))};
}
export function audioStatus(result) {
  const label=value=>value===true?'włączone':value===false?'wyłączone':'brak potwierdzenia';
  return `Mikrofon komputera: odszumianie ${label(result.actual.noiseSuppression)}, usuwanie echa ${label(result.actual.echoCancellation)}, automatyczne wzmocnienie ${label(result.actual.autoGainControl)}.`;
}
