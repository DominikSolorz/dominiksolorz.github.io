// Separate Apps Script project: HOME SECURITY Contact. No Drive or inbox access.
// CONTACT_RELAY_SECRET is configured in Script Properties, never in source.
function doGet() { return contactJson({service:'home-security-contact',version:2,ready:!!PropertiesService.getScriptProperties().getProperty('CONTACT_RELAY_SECRET'),serverTime:Date.now()}); }
function doPost(e) {
  var lock=LockService.getScriptLock();
  try {
    var raw=e && e.postData && e.postData.contents;
    if(!raw || raw.length>16000)return contactJson({ok:false,error:'invalid_request'});
    var envelope=JSON.parse(raw),ticket=envelope.ticket;
    var props=PropertiesService.getScriptProperties(),secret=props.getProperty('CONTACT_RELAY_SECRET');
    if(!secret || !ticket || !Number.isSafeInteger(envelope.issuedAt) || Math.abs(Date.now()-envelope.issuedAt)>300000)return contactJson({ok:false,error:'unauthorized',reason:!secret?'not_configured':!ticket?'missing_ticket':!Number.isSafeInteger(envelope.issuedAt)?'invalid_time':'expired'});
    var canonical=JSON.stringify([ticket.requestId,ticket.name,ticket.surname,ticket.email,ticket.topic,ticket.message,ticket.consent]);
    var expected=Utilities.computeHmacSha256Signature(canonical+'\n'+envelope.issuedAt,secret,Utilities.Charset.UTF_8).map(function(b){return ((b+256)%256).toString(16).padStart(2,'0');}).join('');
    if(typeof envelope.signature!=='string'||envelope.signature.length!==expected.length)return contactJson({ok:false,error:'unauthorized',reason:'invalid_signature_format'});
    var diff=0;for(var i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^envelope.signature.charCodeAt(i);
    if(diff)return contactJson({ok:false,error:'unauthorized',reason:'signature_mismatch'});
    if(!/^[a-f0-9-]{36}$/.test(ticket.requestId)||ticket.consent!==true||typeof ticket.name!=='string'||typeof ticket.surname!=='string'||typeof ticket.email!=='string'||typeof ticket.topic!=='string'||typeof ticket.message!=='string')return contactJson({ok:false,error:'invalid_request'});
    if(ticket.name.length>80||ticket.surname.length>80||ticket.email.length>254||ticket.topic.length>100||ticket.message.length<10||ticket.message.length>4000||!ticket.name.trim()||!ticket.surname.trim()||/[\r\n]/.test(ticket.email+ticket.name+ticket.surname+ticket.topic)||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(ticket.email))return contactJson({ok:false,error:'invalid_request'});
    var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,canonical,Utilities.Charset.UTF_8).map(function(b){return ((b+256)%256).toString(16).padStart(2,'0');}).join('');
    lock.waitLock(5000);
    var now=Date.now(),all=props.getProperties();
    Object.keys(all).forEach(function(k){if(k.indexOf('ticket:')===0){try{if(JSON.parse(all[k]).expires<now)props.deleteProperty(k);}catch(_){}}});
    var id='ticket:'+ticket.requestId,previous=props.getProperty(id);
    if(previous){var state=JSON.parse(previous);if(state.digest!==digest)return contactJson({ok:false,error:'conflict'});return contactJson(state.status==='sent'?{ok:true,status:'sent',requestId:ticket.requestId}:{ok:false,error:'delivery_unknown',requestId:ticket.requestId});}
    var day=new Date().toISOString().slice(0,10),daily=JSON.parse(props.getProperty('daily')||'{}');
    if(daily.day!==day)daily={day:day,used:0};
    if(daily.used>=50||MailApp.getRemainingDailyQuota()<1)return contactJson({ok:false,error:'rate_limited'});
    var senderHash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,ticket.email.toLowerCase()).map(function(b){return ((b+256)%256).toString(16).padStart(2,'0');}).join('');
    var senderKey='sender:'+senderHash,last=Number(props.getProperty(senderKey)||0);
    if(now-last<60000)return contactJson({ok:false,error:'rate_limited'});
    Object.keys(all).forEach(function(k){if(k.indexOf('sender:')===0&&Number(all[k])<now-86400000)props.deleteProperty(k);});
    props.setProperty(senderKey,String(now));daily.used++;props.setProperty('daily',JSON.stringify(daily));
    var entry={digest:digest,status:'sending',expires:now+172800000};props.setProperty(id,JSON.stringify(entry));
    try {
      MailApp.sendEmail({to:'goldservicepoland@gmail.com',replyTo:ticket.email,name:'HOME SECURITY — kontakt',subject:'HOME SECURITY — '+ticket.topic+' ['+ticket.requestId.slice(0,8)+']',body:['Nowe zgłoszenie HOME SECURITY','Numer zgłoszenia: '+ticket.requestId,'Imię i nazwisko: '+ticket.name+' '+ticket.surname,'Adres do odpowiedzi: '+ticket.email,'Temat: '+ticket.topic,'','Treść:',ticket.message].join('\n')});
      entry.status='sent';props.setProperty(id,JSON.stringify(entry));
      return contactJson({ok:true,status:'sent',requestId:ticket.requestId});
    }catch(_){entry.status='unknown';props.setProperty(id,JSON.stringify(entry));return contactJson({ok:false,error:'delivery_unknown',requestId:ticket.requestId});}
  }catch(_){return contactJson({ok:false,error:'service_unavailable'});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function contactJson(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
