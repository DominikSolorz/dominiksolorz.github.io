export function requireFolderHost({version,receivedAt},now=Date.now()) {
  if (!receivedAt || now-receivedAt>45000 || now<receivedAt) throw new Error('Komputer nie potwierdza aktualnego połączenia. Sprawdź, czy program jest uruchomiony.');
  if (!/^\d+$/.test(String(version||''))) throw new Error('Komputer nie podał wersji panelu. Nie mogę bezpiecznie wysłać wyboru folderu.');
  if (Number(version)<192) throw new Error(`Program na komputerze ma stary panel ${version}. Zarządzanie folderami wymaga wersji 192 lub nowszej. Najpierw zapisz bieżący fragment i wczytaj nowy panel na komputerze.`);
}
export function hasLocalSaveError(recording) {
  return /Failed to write blobs|InvalidBlob|Nie udało się zapisać|Nie udało się domknąć/i.test(recording?.reason||'');
}
