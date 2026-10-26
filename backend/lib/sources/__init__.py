"""Data sources: `demo` (seeded Mongo telemetry) or `miningcore` (live Miningcore REST API).

Selected by DATA_SOURCE in backend/.env. Both expose the same async functions returning API models.
"""

import os

STRATUM_HOST = os.environ.get("STRATUM_HOST", "stratum.minershaven.io")
COIN_ORDER = {"BTC": 0, "LTC": 1, "DOGE": 2, "ZANO": 3}


def source_name() -> str:
    return "miningcore" if os.environ.get("DATA_SOURCE", "demo").lower() == "miningcore" else "demo"


def get_source():
    if source_name() == "miningcore":
        from lib.sources import miningcore

        return miningcore
    from lib.sources import demo

    return demo
