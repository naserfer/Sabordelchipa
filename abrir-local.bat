@echo off
title Sabor del Chipa - web local
cd /d "%~dp0"
set "PORT=8000"
set "URL=http://localhost:%PORT%/"

echo.
echo   Sabor del Chipa - web local
echo   Carpeta: %CD%
echo.

rem 1) Python: primero el lanzador "py", despues "python"
py -3 --version >nul 2>nul && set "RUN=py -3 -m http.server %PORT% --bind 127.0.0.1" && goto run
python --version >nul 2>nul && set "RUN=python -m http.server %PORT% --bind 127.0.0.1" && goto run
rem 2) Node
where npx >nul 2>nul && set "RUN=call npx --yes serve -l %PORT% ." && goto run

echo   No encontre Python ni Node en esta compu.
echo   Instala Python desde https://www.python.org/downloads/
echo   (marca la opcion "Add python.exe to PATH") y volve a abrir este archivo.
echo.
pause
exit /b 1

:run
echo   Abriendo %URL%
echo   Para apagarlo, cerra esta ventana.
echo.
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start "" %URL%"
%RUN%
echo.
echo   El servidor se cerro. Si arriba dice que el puerto 8000 esta en uso,
echo   cerra la otra ventana negra que lo tenga abierto y volve a intentar.
pause
