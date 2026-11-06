@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo Meu Financeiro v0.4 - Compilacao Electron Windows
 echo ===================================================
where node >nul 2>nul
if errorlevel 1 (
 echo.
 echo Para COMPILAR e necessario Node.js 22 ou superior.
 echo O aplicativo final nao precisara de Node.js instalado.
 echo Instale em https://nodejs.org/ e execute novamente.
 pause
 exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 ( echo Falhou ao instalar dependencias. & pause & exit /b 1 )
call npm run dist:windows
if errorlevel 1 ( echo Falhou a compilacao. & pause & exit /b 1 )
echo.
echo Concluido! Arquivos EXE na pasta release.
explorer "%~dp0release"
pause
