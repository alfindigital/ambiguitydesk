# Fast-cut VO for AmbiguityDesk demo — Deepgram Aura-2, tighter lines, 1.12x pace.
# Writes video/public/vo-dg/vo-s*.mp3. Run: pwsh scripts/dg-vo-fast.ps1
$ErrorActionPreference = "Stop"
$key = (& "$env:USERPROFILE\.agents\secrets\Get-AgentSecret.ps1" -Name "deepgram-api-key").Trim()

$outDir = Join-Path $PSScriptRoot "..\public\vo-dg"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$model = "aura-2-apollo-en"   # brighter/faster register than mars
$lines = [ordered]@{
  "vo-s0" = "Fifty tokens. One ticker. Which PEPE?"
  "vo-s1" = "One CoinMarketCap call - every impostor shows up. Fifty candidates, eleven chains. Evidence wins, not the name."
  "vo-s2" = "Type WIF, a naive match crowns a pump clone. The canonical one lists as dollar-WIF - the desk normalizes it."
  "vo-s3" = "And when the question is wrong - USDT - the desk says so. One asset, twenty-six chains. Pick yours."
  "vo-s4" = "Evidence, not guesses. AmbiguityDesk."
}

foreach ($k in $lines.Keys) {
  $raw = Join-Path $outDir "$k-raw.mp3"
  $out = Join-Path $outDir "$k.mp3"
  $body = @{ text = $lines[$k] } | ConvertTo-Json -Compress
  Invoke-WebRequest -Uri "https://api.deepgram.com/v1/speak?model=$model&encoding=mp3" `
    -Method Post -Headers @{ Authorization = "Token $key"; "Content-Type" = "application/json" } `
    -Body $body -OutFile $raw | Out-Null
  & ffmpeg -y -loglevel error -i $raw -filter:a "atempo=1.12" $out
  $dur = [math]::Round((& ffprobe -v quiet -show_entries format=duration -of csv=p=0 $out), 2)
  Write-Output "$k.mp3  ${dur}s"
  Remove-Item $raw
}
Write-Output "DONE fast vo -> $outDir"
