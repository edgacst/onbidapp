#Requires -RunAsAdministrator
# 공매레이더 — 폰(Wi-Fi)에서 PC 서버(3000) 접속 허용
$ruleName = "공매레이더 3000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Enable-NetFirewallRule -DisplayName $ruleName | Out-Null
  Write-Host "방화벽 규칙이 이미 있습니다. 활성화했습니다: $ruleName"
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 3000 `
    -Profile Private,Domain `
    -Description "공매레이더 로컬 서버 — 같은 Wi-Fi 폰 접속" | Out-Null
  Write-Host "방화벽 규칙 추가 완료: $ruleName (TCP 3000, Private)"
}
Write-Host ""
Write-Host "폰에서 접속 (같은 Wi-Fi, 모바일 데이터 OFF):"
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } | ForEach-Object {
  Write-Host "  http://$($_.IPAddress):3000"
}
