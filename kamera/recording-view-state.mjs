// Presentation only: no storage, recorder or cloud mutations.
export function localRecordingView(rec,{saveError=false}={}) {
  if(!rec)return {text:'Brak aktualnego stanu komputera. Połącz się z nadajnikiem.',details:''};
  const reason=String(rec.reason||'');
  const permission=/ponown.*zgod|przywróć dostęp|folder.*nie.*ustaw|folder.*nie.*wybran/i.test(reason);
  const folder=rec.folder?`Folder: ${rec.folder}.`:'Folder docelowy nie jest potwierdzony.';
  const text=saveError?'Błąd zapisu lokalnego. Sprawdź szczegóły na komputerze z kamerą.':permission||!rec.folder
    ?'Wymagane potwierdzenie folderu na komputerze. Kamera może działać, ale zapis do wybranego folderu nie jest potwierdzony.'
    :`${rec.recording?'Komputer rejestruje obraz.':'Zapis wstrzymany.'} ${folder} Zapisane pliki: ${Number.isSafeInteger(rec.saved)&&rec.saved>=0?rec.saved:0}.`;
  return {text,details:`${folder} ${reason}`.trim()};
}
export function archiveEmptyText({connected,localFailed=false,driveFailed=false,hasOpenSegment=false}) {
  if(!connected)return 'Nie połączono z komputerem nagrywającym. Lista nagrań nie została sprawdzona.';
  if(localFailed)return 'Nie udało się odczytać listy z komputera. To nie oznacza, że nagrania zostały usunięte. Spróbuj ponownie.';
  if(driveFailed)return 'Nie udało się sprawdzić archiwum Google Drive.';
  return hasOpenSegment?'Bieżący fragment jeszcze się nagrywa. Pojawi się na liście po zamknięciu pliku.':'Brak zamkniętych nagrań z wybranego dnia na komputerze. Kopie na Drive sprawdzisz przyciskiem „Otwórz folder Google Drive”.';
}
