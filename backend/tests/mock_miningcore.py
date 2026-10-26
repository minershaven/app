"""Tiny fake Miningcore API for local testing of DATA_SOURCE=miningcore.

Run: cd /app/backend && uvicorn tests.mock_miningcore:app --port 4000
Shapes follow Miningcore's camelCase REST API (/api/pools, blocks, payments, performance, miners).
"""

from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException

app = FastAPI()
NOW = datetime.now(timezone.utc)
WALLET = "ltc1qtestminer000000000000000000000000000"


def ts(hours: float = 0) -> str:
    return (NOW - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


POOLS = [
    {
        "id": "ltc1", "coin": {"type": "LTC", "name": "Litecoin", "symbol": "LTC", "algorithm": "Scrypt"},
        "ports": {"3062": {"difficulty": 0.5, "name": "GPU"}, "3052": {"difficulty": 8, "name": "ASIC"}},
        "paymentProcessing": {"enabled": True, "minimumPayment": 0.25, "payoutScheme": "PPLNS"},
        "poolStats": {"connectedMiners": 7, "poolHashrate": 12.5e9, "sharesPerSecond": 3},
        "networkStats": {"networkHashrate": 2.1e15, "networkDifficulty": 4.2e7, "blockHeight": 2812900},
        "totalPaid": 120.5, "totalBlocks": 3, "lastPoolBlockTime": ts(2), "poolEffort": 0.4321, "poolFeePercent": 1.25,
    },
    {
        "id": "zano-main", "coin": {"type": "ZANO", "name": "Zano", "symbol": "ZANO", "algorithm": "ProgPowZ"},
        "ports": {"4001": {"difficulty": 1000}},
        "paymentProcessing": {"enabled": True, "minimumPayment": 1, "payoutScheme": "PROP"},
        "poolStats": {"connectedMiners": 2, "poolHashrate": 3.3e8, "sharesPerSecond": 1},
        "networkStats": {"networkHashrate": 1.9e12},
        "lastPoolBlockTime": None, "poolEffort": 0.0, "poolFeePercent": 0.5,
    },
]


def _pool(pid: str) -> dict:
    p = next((p for p in POOLS if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pool not found")
    return p


@app.get("/api/pools")
def pools():
    return {"pools": POOLS}


@app.get("/api/pools/{pid}")
def pool(pid: str):
    return {"pool": _pool(pid)}


@app.get("/api/pools/{pid}/performance")
def perf(pid: str):
    p = _pool(pid)
    return {"stats": [{"poolHashrate": p["poolStats"]["poolHashrate"] * (1 + (i % 5) / 20), "connectedMiners": 7,
                       "created": ts(23 - i)} for i in range(24)]}


@app.get("/api/pools/{pid}/miners")
def miners(pid: str):
    _pool(pid)
    return [{"miner": WALLET, "hashrate": 5e9, "sharesPerSecond": 1.2}, {"miner": "ltc1qother", "hashrate": 7e9}] if pid == "ltc1" else []


@app.get("/api/pools/{pid}/blocks")
def blocks(pid: str):
    _pool(pid)
    if pid != "ltc1":
        return []
    return [
        {"poolId": "ltc1", "blockHeight": 2812900, "status": "pending", "confirmationProgress": 0.35, "effort": 0.8123,
         "reward": 6.25, "hash": "ab" * 32, "miner": WALLET, "created": ts(2), "infoLink": "https://blockchair.com/litecoin/block/2812900"},
        {"poolId": "ltc1", "blockHeight": 2812500, "status": "confirmed", "confirmationProgress": 1, "effort": 1.4,
         "reward": 6.25, "hash": "cd" * 32, "miner": "ltc1qother", "created": ts(30)},
    ]


def _payments():
    return [{"coin": "LTC", "address": WALLET, "amount": 0.31, "transactionConfirmationData": "ef" * 32,
             "transactionInfoLink": "https://blockchair.com/litecoin/transaction/" + "ef" * 32, "created": ts(5)}]


@app.get("/api/pools/{pid}/payments")
def payments(pid: str):
    _pool(pid)
    return _payments() if pid == "ltc1" else []


@app.get("/api/pools/{pid}/miners/{addr}")
def miner(pid: str, addr: str):
    _pool(pid)
    if pid != "ltc1" or addr != WALLET:
        raise HTTPException(404, "Miner not found")
    return {
        "pendingShares": 1234.5, "pendingBalance": 0.1234, "totalPaid": 0.31, "todayPaid": 0,
        "performance": {"created": ts(0.05), "workers": {"rig1": {"hashrate": 3e9, "sharesPerSecond": 0.8},
                                                          "": {"hashrate": 2e9, "sharesPerSecond": 0.4}}},
        "performanceSamples": [
            {"created": ts(24 - i), "workers": {"rig1": {"hashrate": 3e9}, "old-rig": {"hashrate": 1e9}, "": {"hashrate": 2e9}}}
            for i in range(24)
        ],
    }


@app.get("/api/pools/{pid}/miners/{addr}/payments")
def miner_payments(pid: str, addr: str):
    return _payments() if addr == WALLET else []


@app.get("/api/pools/{pid}/miners/{addr}/earnings/daily")
def miner_daily(pid: str, addr: str):
    if addr != WALLET:
        return []
    return [{"amount": round(0.02 + (i % 4) * 0.005, 6), "date": (NOW - timedelta(days=i)).date().isoformat() + "T00:00:00Z"}
            for i in range(14)]


@app.get("/api/pools/{pid}/miners/{addr}/balancechanges")
def miner_balance_changes(pid: str, addr: str):
    if addr != WALLET:
        return []
    return [{"poolId": pid, "address": addr, "amount": 0.0123, "usage": "Reward for block 2812900", "created": ts(2)},
            {"poolId": pid, "address": addr, "amount": 0.0211, "usage": "Reward for block 2812500", "created": ts(30)}]
