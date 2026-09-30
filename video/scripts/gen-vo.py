#!/usr/bin/env python3
"""VO for AmbiguityDesk demo via edge-tts (one voice, all scenes).
   python scripts/gen-vo.py  →  public/vo-s*.mp3"""
import asyncio, os
import edge_tts

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
VOICE = "en-US-GuyNeural"

LINES = {
    "vo-s0": "Fifty tokens answer to the same ticker. Which PEPE is worth inspecting?",
    "vo-s1": "AmbiguityDesk makes one CoinMarketCap call — and every impostor shows up. Fifty candidates, eleven chains. The strongest candidate wins on liquidity and traders, not the name.",
    "vo-s2": "Type WIF, and a naive match crowns a pump clone. The canonical dogwifhat lists as dollar-WIF — the desk normalizes the symbol, and the best-evidenced deployment wins by seventeen hundred times.",
    "vo-s3": "And when the question itself is wrong — like USDT — the desk says so. One asset, deep pools on twenty-six chains. Pick your chain.",
    "vo-s4": "Evidence, not guesses. AmbiguityDesk — one call, every observed candidate.",
}

async def main():
    os.makedirs(BASE, exist_ok=True)
    for name, text in LINES.items():
        out = os.path.join(BASE, name + ".mp3")
        await edge_tts.Communicate(text, VOICE, rate="+5%").save(out)
        print("public/" + name + ".mp3")

asyncio.run(main())
