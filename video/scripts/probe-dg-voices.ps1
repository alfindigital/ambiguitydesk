$key = (& "$env:USERPROFILE\.agents\secrets\Get-AgentSecret.ps1" -Name "deepgram-api-key").Trim()
$models = "aura-2-ares-en","aura-2-apollo-en","aura-2-orpheus-en","aura-2-odysseus-en","aura-2-zeus-en","aura-2-hera-en","aura-2-athena-en","aura-2-thalia-en","aura-2-mars-en"
foreach ($m in $models) {
  try {
    Invoke-WebRequest -Uri "https://api.deepgram.com/v1/speak?model=$m&encoding=mp3" -Method Post `
      -Headers @{ Authorization = "Token $key"; "Content-Type" = "application/json" } `
      -Body '{"text":"ok"}' -OutFile "$env:TEMP\probe-$m.mp3" -ErrorAction Stop
    Write-Output "$m OK"
  } catch { Write-Output "$m NO" }
}
