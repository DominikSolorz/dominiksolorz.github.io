@echo off
rem NORMALNY - tryb pracy procesora (glosnosc wentylatorow) dla kamery 24/7
rem Zmienia tylko ustawienia biezacego planu zasilania Windows (zasilanie z sieci i z baterii).
rem Mozna to w kazdej chwili zmienic, uruchamiajac inny plik wentylator-*.bat.
title Wentylatory - NORMALNY
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 90
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 90
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 0 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 >nul 2>&1
powercfg /setactive SCHEME_CURRENT
echo.
echo Ustawiono: NORMALNY
echo Procesor max 90%%, bez turbo - cicho i nadal szybko.
echo.
echo Kamera i nagrywanie dzialaja dalej bez zmian.
pause
