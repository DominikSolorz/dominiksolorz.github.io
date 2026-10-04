@echo off
rem PELNA MOC - tryb pracy procesora (glosnosc wentylatorow) dla kamery 24/7
rem Zmienia tylko ustawienia biezacego planu zasilania Windows (zasilanie z sieci i z baterii).
rem Mozna to w kazdej chwili zmienic, uruchamiajac inny plik wentylator-*.bat.
title Wentylatory - PELNA MOC
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 >nul 2>&1
powercfg /setactive SCHEME_CURRENT
echo.
echo Ustawiono: PELNA MOC
echo Procesor 100%% z turbo - najszybciej, wentylatory moga byc glosne.
echo.
echo Kamera i nagrywanie dzialaja dalej bez zmian.
pause
