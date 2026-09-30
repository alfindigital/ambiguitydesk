#!/usr/bin/env python3
"""ElevenLabs VO for AmbiguityDesk demo — one voice per run.
   ELEVENLABS_API_KEY=<key> python gen-vo-eleven.py <voice_id> <out_dir>
   Example: ... nPczCjzI2devNBz1zQrb public/vo-el-m   (Brian, male)
            ... XrExE9yKIg1WjnnlVkGX public/vo-el-f   (Matilda, female)
   Never hardcode a key in this file."""
import json, os, sys, urllib.request

KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not KEY:
    sys.exit("ELEVENLABS_API_KEY env required")

VOICE_ID = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", sys.argv[2])
MODEL = "eleven_v3"

LINES = [
    ("vo-s0", "Fifty tokens answer to the same ticker. Which PEPE is the real one?"),
    ("vo-s1", "AmbiguityDesk makes one CoinMarketCap call - and every impostor shows up. Fifty candidates, eleven chains. The real Pepe wins on liquidity and traders, not the name."),
    ("vo-s2", "Type WIF, and a naive match crowns a pump clone. The real dogwifhat lists as dollar-WIF - the desk normalizes the symbol, and the canonical token wins by seventeen hundred times."),
    ("vo-s3", "And when the question itself is wrong - like USDT - the desk says so. One canonical asset, deep pools on twenty-six chains. Pick your chain."),
    ("vo-s4", "Evidence, not guesses. AmbiguityDesk - one call, every candidate."),
]

os.makedirs(OUT, exist_ok=True)
for name, text in LINES:
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128",
        data=json.dumps({"text": text, "model_id": MODEL}).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        audio = urllib.request.urlopen(req, timeout=60).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"{name}: HTTP {e.code} {e.read()[:200]}")
    path = os.path.join(OUT, name + ".mp3")
    open(path, "wb").write(audio)
    print(f"{name}.mp3 {len(audio)} bytes")
print("DONE")
