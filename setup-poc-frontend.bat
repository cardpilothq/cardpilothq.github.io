@echo off
setlocal

set "SRC=Frontend"
set "DEST=Frontend-POC"

if not exist "%SRC%\config.poc.json" (
  echo Missing %SRC%\config.poc.json
  exit /b 1
)

if exist "%DEST%" (
  echo Removing existing %DEST% ...
  rmdir /s /q "%DEST%"
)

echo Copying %SRC% to %DEST% ...
robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /NC /NS >nul
if %errorlevel% geq 8 (
  echo Copy failed.
  exit /b 1
)

echo Applying POC config ...
copy /Y "%DEST%\config.poc.json" "%DEST%\config.json" >nul

echo Done.
echo Publish %DEST% as your POC frontend site.
endlocal
