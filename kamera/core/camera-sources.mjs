// Pluggable real preview adapters. They never receive or stop the primary stream.
function videoTarget(target){
  const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.controls=true;
  video.setAttribute('aria-label','Podgląd kamery');target.replaceChildren(video);return video;
}
function watchVideo(video,stream,signal,report,close){
  let active=true,frameCallback=null,lastFrame=0,lastReport=0;
  const playing=()=>{lastFrame=lastReport=Date.now();const s=stream.getVideoTracks()[0]?.getSettings?.()||{};const width=video.videoWidth||s.width,height=video.videoHeight||s.height;report({status:'preview',message:width&&height?`Obraz dostępny · ${width} × ${height}`:'Obraz dostępny',width:width||null,height:height||null,fps:s.frameRate||null});};
  const frame=()=>{if(!active)return;lastFrame=Date.now();if(lastFrame-lastReport>3000)playing();if(video.requestVideoFrameCallback)frameCallback=video.requestVideoFrameCallback(frame);};
  if(video.requestVideoFrameCallback)frameCallback=video.requestVideoFrameCallback(frame);
  else video.addEventListener('timeupdate',frame);
  const health=setInterval(()=>{if(active&&lastFrame&&Date.now()-lastFrame>15000&&document.visibilityState==='visible'&&video.getClientRects().length)report({status:'degraded',message:'Brak nowych klatek · podgląd oczekuje na obraz'});},5000);
  const ended=()=>report({status:'offline',message:'Źródło przestało przesyłać obraz'});
  video.addEventListener('playing',playing);stream.getTracks().forEach(t=>t.addEventListener('ended',ended));
  video.addEventListener('ended',ended);
  signal.addEventListener('abort',close,{once:true});
  video.srcObject=stream;void video.play().catch(()=>{});
  return()=>{active=false;clearInterval(health);if(frameCallback!==null)video.cancelVideoFrameCallback?.(frameCallback);video.removeEventListener('timeupdate',frame);video.removeEventListener('playing',playing);video.removeEventListener('ended',ended);stream.getTracks().forEach(t=>t.removeEventListener('ended',ended));video.srcObject=null;video.remove();};
}
async function boundedAnswer(response){
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>262144)throw Error('Invalid answer');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(data);
}
export function cameraSourceAdapters({native=false,mediaDevices=globalThis.navigator?.mediaDevices,primaryVideo}){
  return {
    async system(camera,target,signal,report){
      if(!native)throw Error('Źródła systemowe są dostępne w programie Windows.');
      let primaryId=primaryVideo?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().deviceId;
      if(!primaryId&&typeof document!=='undefined')primaryId=document.getElementById('cameraSelect')?.value;
      if(!primaryId&&mediaDevices.enumerateDevices)primaryId=(await mediaDevices.enumerateDevices()).find(d=>d.kind==='videoinput')?.deviceId;
      if(primaryId&&primaryId===camera.deviceId)throw Error('To źródło obsługuje główna kamera.');
      const [width,height,fps]=({low:[640,360,10],balanced:[1280,720,15],high:[1920,1080,25]})[camera.quality||'balanced'];
      const stream=await mediaDevices.getUserMedia({video:{deviceId:{exact:camera.deviceId},width:{ideal:width},height:{ideal:height},frameRate:{ideal:fps,max:fps}},audio:false});
      if(signal.aborted){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Cancelled','AbortError');}
      const video=videoTarget(target);let closed=false,cleanup=()=>{};
      const close=()=>{if(closed)return;closed=true;stream.getTracks().forEach(t=>t.stop());cleanup();};
      cleanup=watchVideo(video,stream,signal,report,close);return{close};
    },
    async mjpeg(camera,target,signal,report){
      const image=document.createElement('img');image.alt='Podgląd kamery sieciowej';image.referrerPolicy='no-referrer';
      let closed=false;
      const timeout=setTimeout(()=>{if(!image.naturalWidth){report({status:'error',message:'Kamera nie udostępniła obrazu.'});close();}},20000);
      const close=()=>{if(closed)return;closed=true;clearTimeout(timeout);image.onload=null;image.onerror=null;image.removeAttribute('src');image.remove();};
      image.onload=()=>{clearTimeout(timeout);report({status:'preview',message:'Obraz dostępny · źródło JPEG/MJPEG'});};
      image.onerror=()=>{report({status:'error',message:'Nie można odczytać obrazu HTTPS. Sprawdź adres i certyfikat kamery.'});close();};
      signal.addEventListener('abort',close,{once:true});target.replaceChildren(image);image.src=camera.url;
      if(signal.aborted)close();return{close};
    },
    async whep(camera,target,signal,report){
      const pc=new RTCPeerConnection();const stream=new MediaStream();const video=videoTarget(target);
      let session=null,closed=false,cleanup=()=>{},disconnectTimer=null;
      const close=()=>{
        if(closed)return;closed=true;clearTimeout(disconnectTimer);pc.close();stream.getTracks().forEach(t=>t.stop());cleanup();
        if(session)void fetch(session,{method:'DELETE',keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'}).catch(()=>{});
      };
      cleanup=watchVideo(video,stream,signal,report,close);
      pc.addTransceiver('video',{direction:'recvonly'});pc.addTransceiver('audio',{direction:'recvonly'});
      pc.ontrack=e=>{stream.addTrack(e.track);void video.play().catch(()=>{});};
      pc.onconnectionstatechange=()=>{
        if(closed)return;clearTimeout(disconnectTimer);
        if(pc.connectionState==='failed')report({status:'offline',message:'Połączenie WebRTC nie zostało utrzymane'});
        else if(pc.connectionState==='disconnected'){
          report({status:'degraded',message:'Przerwa w połączeniu · oczekiwanie na powrót obrazu'});
          disconnectTimer=setTimeout(()=>{if(pc.connectionState!=='connected')report({status:'offline',message:'Źródło nie wznowiło połączenia'});},10000);
        }else if(pc.connectionState==='connected'&&video.readyState>=2)report({status:'preview',message:'Obraz dostępny'});
      };
      try{
        await pc.setLocalDescription(await pc.createOffer());
        if(pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{
          const done=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',done);resolve();}};
          const timer=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve();},5000);
          pc.addEventListener('icegatheringstatechange',done);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));},{once:true});
        });
        const response=await fetch(camera.url,{method:'POST',headers:{'Content-Type':'application/sdp'},body:pc.localDescription.sdp,signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),credentials:'omit',referrerPolicy:'no-referrer'});
        if(!response.ok)throw Error('WHEP negotiation failed');
        const location=response.headers.get('Location');
        if(location){const resolved=new URL(location,camera.url);if(resolved.origin===new URL(camera.url).origin&&!resolved.username&&!resolved.password)session=resolved.href;}
        const answer=await boundedAnswer(response);
        if(signal.aborted||closed){if(session)void fetch(session,{method:'DELETE',keepalive:true,credentials:'omit'}).catch(()=>{});throw new DOMException('Cancelled','AbortError');}
        await pc.setRemoteDescription({type:'answer',sdp:answer});
        const timeout=setTimeout(()=>{if(!closed&&video.readyState<2){report({status:'error',message:'Połączenie nie dostarczyło obrazu.'});close();}},20000);
        video.addEventListener('playing',()=>clearTimeout(timeout),{once:true});signal.addEventListener('abort',()=>clearTimeout(timeout),{once:true});
        return{close};
      }catch(error){close();throw error;}
    }
  };
}
