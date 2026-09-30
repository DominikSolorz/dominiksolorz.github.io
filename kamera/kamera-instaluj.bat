@echo off
rem ============================================================
rem  Kamera na zywo - program w tle + skrot na pulpicie
rem  Tworzy osobne okno kamery (profil przegladarki tylko dla kamery),
rem  ktore startuje razem z Windows, dziala zminimalizowane w tle,
rem  nadaje na zywo i nagrywa na Google Drive.
rem ============================================================
setlocal EnableExtensions
title Kamera na zywo - instalacja
set "URL=https://dominiksolorz.github.io/kamera/#nadaj"
set "PROFILE=%LOCALAPPDATA%\KameraNaZywo"

set "BROWSER="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if not defined BROWSER if exist %%P set "BROWSER=%%~P"
)
if not defined BROWSER (
  echo Nie znaleziono Google Chrome ani Microsoft Edge. Zainstaluj Chrome i uruchom ten plik ponownie.
  pause
  exit /b 1
)

rem Flagi: osobny profil, okno aplikacji, brak usypiania karty w tle, dzwiek bez klikniecia.
set "ARGS=--app=%URL% --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows"

if not exist "%PROFILE%" mkdir "%PROFILE%"

rem Skrot na pulpicie (okno normalne) i w autostarcie (okno zminimalizowane = program w tle).
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "$items = @(@([Environment]::GetFolderPath('Desktop'), 1), @([Environment]::GetFolderPath('Startup'), 7));" ^
  "foreach ($i in $items) { $l = $w.CreateShortcut((Join-Path $i[0] 'Kamera na zywo.lnk')); $l.TargetPath = $env:BROWSER; $l.Arguments = $env:ARGS; $l.WorkingDirectory = $env:PROFILE; $l.IconLocation = $env:BROWSER + ',0'; $l.WindowStyle = $i[1]; $l.Description = 'Kamera na zywo - transmisja i nagrywanie 24/7'; $l.Save() }"
if errorlevel 1 (
  echo Nie udalo sie utworzyc skrotow.
  pause
  exit /b 1
)

rem Komputer nie usypia sie przy zasilaniu z sieci (kamera dziala 24/7). Ekran moze sie wylaczac.
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

echo.
echo Gotowe!
echo  - Na pulpicie jest skrot "Kamera na zywo" (uruchamia transmisje na zywo).
echo  - Kamera uruchomi sie sama po kazdym wlaczeniu komputera (zminimalizowana, w tle).
echo  - Komputer nie bedzie sie usypial przy zasilaniu z sieci.
echo.
echo Teraz otworzy sie okno kamery. Za PIERWSZYM razem:
echo   1. wpisz PIN,
echo   2. zezwol na kamere i mikrofon,
echo   3. kliknij "Wybierz folder Google Drive" i wskaz folder "nagrania"
echo      (wybierz "Zezwalaj przy kazdej wizycie").
echo Potem mozesz zminimalizowac okno - kamera dziala dalej w tle.
echo.
start "" "%BROWSER%" %ARGS%
pause
