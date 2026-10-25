// Presentation only. A live camera is not evidence that a recording was saved.
export function operatorStatus({isLive=false,recording={},storage={}}={}) {
  if(!isLive)return {text:'Brak transmisji',severity:'neutral'};
  if(storage.freshness==='fresh'&&['error','permission_required'].includes(storage.status))
    return {text:'Na żywo · problem z zapisem do folderu',severity:'warning'};
  if(recording.freshness!=='fresh')return {text:'Na żywo · brak aktualnych danych o zapisie',severity:'neutral'};
  if(recording.status==='recording')return {text:'Na żywo · nagrywanie aktywne',severity:'active'};
  if(recording.status==='waiting')return {text:'Na żywo · oczekiwanie na zapis / harmonogram',severity:'neutral'};
  if(['idle','disabled','stopped'].includes(recording.status))return {text:'Na żywo · zapis nieaktywny',severity:'warning'};
  return {text:'Na żywo · stan zapisu niepotwierdzony',severity:'neutral'};
}
