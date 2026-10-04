@echo off
rem CICHY - tryb pracy procesora (glosnosc wentylatorow) dla kamery 24/7
rem Zmienia tylko ustawienia biezacego planu zasilania Windows (zasilanie z sieci i z baterii).
rem Mozna to w kazdej chwili zmienic, uruchamiajac inny plik wentylator-*.bat.
title Wentylatory - CICHY
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 70
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 70
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 0 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 0 >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 0 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT
echo.
echo Ustawiono: CICHY
echo Procesor max 70%%, bez turbo, chlodzenie pasywne - wentylatory najciszej.
echo.
echo Kamera i nagrywanie dzialaja dalej bez zmian.
pause
