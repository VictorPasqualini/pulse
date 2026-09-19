@echo off
setlocal
cd /d "%~dp0"

rem Porta: usa a definida pelo usuario (set PORT=... ou pulse.cmd 3500).
rem Sem nada definido, comeca em 3210 e pula portas ocupadas.
set AUTOPORT=1
if not "%PORT%"=="" set AUTOPORT=0
if not "%~1"=="" (
  echo %~1| findstr /r /c:"^[0-9][0-9]*$" >nul
  if not errorlevel 1 (
    set PORT=%~1
    set AUTOPORT=0
  )
)
if "%PORT%"=="" set PORT=3210
if "%AUTOPORT%"=="0" goto :portok

set TRIES=0
:checkport
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if errorlevel 1 goto :portok
set /a TRIES+=1
if %TRIES% gtr 30 (
  echo Nenhuma porta livre entre 3210 e %PORT%.
  pause
  exit /b 1
)
set /a PORT+=1
goto :checkport
:portok

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado no PATH. Instale em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install || goto :erro
)

if /i "%~1"=="dev" (
  echo Pulse em modo desenvolvimento: http://localhost:%PORT%
  start "" "http://localhost:%PORT%"
  call npm run dev -- --port %PORT%
  goto :fim
)

rem next start serve o build que ja existe. Sem esta checagem, um arquivo editado
rem depois do ultimo build fica invisivel e a tela mostra numeros velhos.
set STALE=nao
if not exist ".next\BUILD_ID" set STALE=sim
if "%STALE%"=="nao" for /f "usebackq delims=" %%s in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=(Get-Item '.next\BUILD_ID').LastWriteTime; $s='nao'; foreach ($f in @(Get-ChildItem -Recurse -File -Path src,public,package.json,next.config.ts,tsconfig.json -ErrorAction SilentlyContinue)) { if ($f.LastWriteTime -gt $b) { $s='sim'; break } }; $s"`) do set STALE=%%s
if /i "%STALE%"=="sim" (
  echo Codigo mudou desde o ultimo build. Gerando build...
  call npm run build || goto :erro
)

echo Pulse rodando em http://localhost:%PORT%
echo Feche esta janela para parar.
start "" "http://localhost:%PORT%"
call npm start -- --port %PORT%
goto :fim

:erro
echo.
echo Falhou. Veja o erro acima.
pause
exit /b 1

:fim
endlocal
