// DVR time navigation works only with real indexed files, never synthetic footage.
export function localPlaybackTimestamp(day,clock){
  const date=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day||''));
  const time=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(clock||''));
  if(!date||!time)throw RangeError('Podaj dzień i godzinę w formacie GG:MM:SS.');
  const [year,month,d]=date.slice(1).map(Number),[hour,minute,second]=time.slice(1).map(x=>Number(x||0));
  if(hour>23||minute>59||second>59)throw RangeError('Podana godzina nie istnieje.');
  const result=new Date(year,month-1,d,hour,minute,second,0);
  if(result.getFullYear()!==year||result.getMonth()+1!==month||result.getDate()!==d||
     result.getHours()!==hour||result.getMinutes()!==minute||result.getSeconds()!==second){
    throw RangeError('Podany dzień lub godzina nie istnieje w lokalnej strefie czasowej.');
  }
  return result.getTime();
}
export function completedRecordingAt(files,at){
  if(!Number.isFinite(at)||!Array.isArray(files))return null;
  return files.find(f=>!f.recording&&Number.isFinite(f.start)&&Number.isFinite(f.end)&&f.start<=at&&at<f.end)||null;
}
export function nextCompletedRecording(files,at,maxGapMs=15*60000){
  if(!Array.isArray(files)||!Number.isFinite(at)||!Number.isFinite(maxGapMs)||maxGapMs<0)return null;
  return files.filter(f=>!f.recording&&Number.isFinite(f.start)&&f.start>at&&f.start-at<=maxGapMs)
    .sort((a,b)=>a.start-b.start)[0]||null;
}
// Browsers seek by timestamp, which can snap to a keyframe. This is a best-effort
// decoding-time step, NEVER certified forensic frame accuracy.
export function seekLocalPlayback(video,deltaSeconds){
  if(!video||video.readyState<1||!Number.isFinite(video.duration)||video.duration<=0||
     !Number.isFinite(video.currentTime)||!Number.isFinite(deltaSeconds))return null;
  const target=Math.max(0,Math.min(video.duration,video.currentTime+deltaSeconds));
  video.pause();
  video.currentTime=target;
  return target;
}
