// Presentation only: never changes the stream, recorder or remote camera zoom.
export function mountMobileCameraFrame(stage,video){
  const update=()=>{
    const width=video.videoWidth,height=video.videoHeight;
    if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0)
      stage.style.setProperty('--mobile-camera-ratio',`${width} / ${height}`);
  };
  video.addEventListener('loadedmetadata',update);video.addEventListener('resize',update);update();
  return()=>{video.removeEventListener('loadedmetadata',update);video.removeEventListener('resize',update);};
}
