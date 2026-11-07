// Bounded auxiliary-video initialization. Never owns or stops the original camera.
export function prepareRecordingVideo(video, stream, {timeoutMs=5000}={}) {
 return new Promise((resolve,reject)=>{
  let settled=false,metadata=false,playing=false;
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);video.removeEventListener('loadedmetadata',loaded);video.removeEventListener('error',failed);error?reject(error):resolve(video);};
  const check=()=>{if(metadata&&playing)finish();};
  const loaded=()=>{metadata=true;check();};
  const failed=()=>finish(new Error('Nie udaĹ‚o siÄ™ przygotowaÄ‡ obrazu do zapisu.'));
  const timer=setTimeout(()=>finish(new Error('Przekroczono czas przygotowania obrazu do zapisu.')),timeoutMs);
  video.addEventListener('loadedmetadata',loaded);video.addEventListener('error',failed);
  try{video.srcObject=stream;metadata=video.readyState>=1;Promise.resolve(video.play()).then(()=>{playing=true;metadata ||= video.readyState>=1;check();},error=>finish(error));}catch(error){finish(error);}
 });
}
export function recorderActuallyRunning(recorder){return recorder?.state==='recording';}

export function waitForRecorderData(recorder,{timeoutMs=3000}={}){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=failure=>{if(settled)return;settled=true;clearTimeout(timer);recorder.removeEventListener('dataavailable',data);recorder.removeEventListener('error',error);recorder.removeEventListener('stop',stopped);failure?reject(failure):resolve();};
  const data=event=>{if(event.data?.size>0)finish();};
  const error=event=>finish(event.error||new Error('Błąd kodera nagrania.'));
  const stopped=()=>finish(new Error('Koder zakończył pracę bez danych nagrania.'));
  const timer=setTimeout(()=>finish(new Error('Koder nie przekazał danych nagrania.')),timeoutMs);
  recorder.addEventListener('dataavailable',data);recorder.addEventListener('error',error);recorder.addEventListener('stop',stopped);
 });
}
