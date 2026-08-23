$ErrorActionPreference = 'Stop'

$edgeCandidates = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $edgeCandidates) {
  throw '没有找到 Microsoft Edge，请先安装 Edge 或在 .env 中改用可用的 Chrome CDP 地址。'
}

$profile = Join-Path $PSScriptRoot 'profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null

Start-Process -FilePath $edgeCandidates[0] -WindowStyle Normal -ArgumentList @(
  '--remote-debugging-port=9222',
  "--user-data-dir=$profile",
  '--no-first-run',
  'https://h5.ele.me/'
)

Write-Host '已启动小手机真实外卖专用 Edge。首次只需在这个窗口登录并确认收货地址。'
Write-Host '服务配置：PHONE_DELIVERY_CDP_URL=http://127.0.0.1:9222'
