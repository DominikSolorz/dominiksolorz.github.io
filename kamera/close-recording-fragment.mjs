// Close one recording segment without stopping the live source or waiting for Drive.
export async function closeRecordingFragment({current,ready,receipt,rotate,flush,error}) {
  if(!ready())throw Error('Najpierw wybierz folder nagrań i zatwierdź dostęp do zapisu.');
  const segment=current();
  if(!segment)throw Error('Nagrywanie nie jest uruchomione. Włącz zapis, zanim domkniesz fragment.');
  const previous=receipt();
  const pending=rotate(segment);
  await flush(pending);
  if(error())throw Error(error());
  const confirmed=receipt();
  if(!confirmed||confirmed===previous||!confirmed.bytes)throw Error('Nie potwierdzono nowego pliku w folderze. Sprawdź stan zapisu.');
  return confirmed;
}
