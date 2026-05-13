# DECK-ECHO 로컬 서버 (PowerShell)
$Host.UI.RawUI.WindowTitle = 'DECK-ECHO'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$py = $null
foreach ($c in 'py','python','python3') {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) { $py = $cmd.Source; break }
}
if (-not $py) {
    Write-Host ""
    Write-Host "[에러] Python 이 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "Microsoft Store 에서 'Python' 검색 후 설치하거나 https://python.org 에서 받으세요."
    pause
    exit 1
}

& $py (Join-Path $root 'serve.py')
Write-Host ""
Write-Host "(서버가 종료됨)" -ForegroundColor DarkGray
pause
