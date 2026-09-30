$key = (& "$env:USERPROFILE\.agents\secrets\Get-AgentSecret.ps1" -Name "deepgram-api-key").Trim()
$outDir = Join-Path $PSScriptRoot "..\public\vo-dg"
Invoke-WebRequest -Uri "https://api.deepgram.com/v1/speak?model=aura-2-apollo-en&encoding=mp3" -Method Post `
  -Headers @{ Authorization = "Token $key"; "Content-Type" = "application/json" } `
  -Body '{"text":"Fifty tokens. One ticker. Which PEPE?"}' -OutFile (Join-Path $outDir "vo-s0-raw.mp3")
ffmpeg -y -loglevel error -i (Join-Path $outDir "vo-s0-raw.mp3") -filter:a "atempo=1.5" (Join-Path $outDir "vo-s0.mp3")
Remove-Item (Join-Path $outDir "vo-s0-raw.mp3")
ffprobe -v quiet -show_entries format=duration -of csv=p=0 (Join-Path $outDir "vo-s0.mp3")
