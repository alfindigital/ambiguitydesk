# Generate VO for AmbiguityDesk demo via Deepgram Aura-2 (replaces edge-tts tracks).
# Reads DPAPI secret, writes video/public/vo-s*.mp3. Run: pwsh scripts/dg-vo.ps1
$ErrorActionPreference = "Stop"
$key = (& "$env:USERPROFILE\.agents\secrets\Get-AgentSecret.ps1" -Name "deepgram-api-key").Trim()

$outDir = Join-Path $PSScriptRoot "..\public"
$model = "aura-2-mars-en"   # deep male, close to en-US-GuyNeural register
$lines = [ordered]@{
  "vo-s0" = "Fifty tokens answer to the same ticker. Which PEPE is the real one?"
  "vo-s1" = "AmbiguityDesk makes one CoinMarketCap call - and every impostor shows up. Fifty candidates, eleven chains. The real Pepe wins on liquidity and traders, not the name."
  "vo-s2" = "Type WIF, and a naive match crowns a pump clone. The real dogwifhat lists as dollar-WIF - the desk normalizes the symbol, and the canonical token wins by seventeen hundred times."
  "vo-s3" = "And when the question itself is wrong - like USDT - the desk says so. One canonical asset, deep pools on twenty-six chains. Pick your chain."
  "vo-s4" = "Evidence, not guesses. AmbiguityDesk - one call, every candidate."
}

foreach ($k in $lines.Keys) {
  $out = Join-Path $outDir "$k.mp3"
  $body = @{ text = $lines[$k] } | ConvertTo-Json -Compress
  Invoke-WebRequest -Uri "https://api.deepgram.com/v1/speak?model=$model&encoding=mp3" `
    -Method Post -Headers @{ Authorization = "Token $key"; "Content-Type" = "application/json" } `
    -Body $body -OutFile $out | Out-Null
  $size = (Get-Item $out).Length
  Write-Output "$k.mp3  $size bytes"
}
Write-Output "DONE deepgram vo -> $outDir"
