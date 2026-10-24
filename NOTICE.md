# Data provenance & license notes

The MIT license in `LICENSE` covers the source code of this repository only.

## Committed CoinMarketCap captures

`fixtures/*.json` holds raw responses from the CoinMarketCap DEX API
(`/v1/dex/search` and related endpoints), each stored with its request
metadata and a sha256 of the body. They are committed deliberately as
**replayable evidence** for the Build with CMC: API Hackathon (2026): the
replay mode serves them when no API key is configured, and every answer can be
re-verified offline.

This data was obtained with a CMC API key issued for the hackathon. It is
published **for evaluation and reproducibility of this submission**, not as a
redistributed market-data feed. Market data remains © CoinMarketCap; see
https://coinmarketcap.com/api/terms/. It is not covered by the MIT license.

## Fonts

`fonts/` bundles Archivo, Fraunces and IBM Plex Mono. They keep their own
license (SIL Open Font License 1.1), not the MIT license.

## No secrets

No API keys or credentials are committed. Keys are read from environment
variables only.
