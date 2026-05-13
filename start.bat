@echo off
chcp 65001 >nul 2>&1
title DECK-ECHO
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  where python3 >nul 2>nul && set "PY=python3"
)

if not defined PY (
  echo.
  echo [에러] Python 이 설치되어 있지 않습니다.
  echo.
  echo 설치 방법 ^(둘 중 하나^):
  echo   1^) Microsoft Store 에서 "Python" 검색 후 설치 ^(가장 쉬움^)
  echo   2^) https://python.org 에서 다운로드 후 설치
  echo      설치 시 "Add Python to PATH" 체크 필수
  echo.
  echo 설치를 마친 뒤 이 파일을 다시 더블클릭하세요.
  echo.
  pause
  exit /b 1
)

"%PY%" "%~dp0serve.py"

echo.
echo ^(서버가 종료됨^)
pause
