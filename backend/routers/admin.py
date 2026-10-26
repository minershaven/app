import os
from datetime import timedelta
from typing import List

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

from lib.db import db
from lib.seed_data import now_utc
from lib.sources import source_name
from lib.sources.demo import local_coins
from models.pool import AdminLogin, AdminStatus, CoinConfig, CoinUpdate

router = APIRouter(prefix="/admin")
COOKIE = "mh_admin"
# In Miningcore mode fees, payout thresholds and ports live in Miningcore's config.json
MININGCORE_EDITABLE = {"enabled", "pool_id"}


def _secret() -> str:
    return os.environ.get("ADMIN_JWT_SECRET", "minershaven-dev-secret")


def _cookie_secure() -> bool:
    return os.environ.get("COOKIE_SECURE", "true").lower() != "false"


def _is_admin(token: str | None) -> bool:
    if not token:
        return False
    try:
        jwt.decode(token, _secret(), algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


async def require_admin(mh_admin: str | None = Cookie(default=None)) -> None:
    if not _is_admin(mh_admin):
        raise HTTPException(status_code=401, detail="Admin authentication required")


@router.post("/login", response_model=AdminStatus)
async def login(body: AdminLogin, response: Response):
    if body.password != os.environ.get("ADMIN_PASSWORD", "minershaven-admin"):
        raise HTTPException(status_code=401, detail="Invalid passkey")
    token = jwt.encode({"sub": "admin", "exp": now_utc() + timedelta(hours=12)}, _secret(), algorithm="HS256")
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=_cookie_secure(), max_age=12 * 3600, path="/")
    return AdminStatus(authenticated=True)


@router.post("/logout", response_model=AdminStatus)
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return AdminStatus(authenticated=False)


@router.get("/me", response_model=AdminStatus)
async def me(mh_admin: str | None = Cookie(default=None)):
    return AdminStatus(authenticated=_is_admin(mh_admin))


async def _coins() -> List[CoinConfig]:
    if source_name() == "miningcore":
        from lib.sources import miningcore

        return await miningcore.admin_coins()
    return [CoinConfig(**d) for d in await local_coins()]


@router.get("/coins", response_model=List[CoinConfig], dependencies=[Depends(require_admin)])
async def list_coins():
    return await _coins()


@router.put("/coins/{symbol}", response_model=CoinConfig, dependencies=[Depends(require_admin)])
async def update_coin(symbol: str, body: CoinUpdate):
    updates = body.model_dump(exclude_none=True)
    sym = symbol.upper()
    if source_name() == "miningcore":
        blocked = set(updates) - MININGCORE_EDITABLE
        if blocked:
            raise HTTPException(status_code=400, detail=f"{', '.join(sorted(blocked))} are managed in Miningcore's config.json")
    if "pool_id" in updates:
        updates["pool_id"] = updates["pool_id"].strip()
    if "stratum_port" in updates:
        clash = await db.coins.find_one({"stratum_port": updates["stratum_port"], "symbol": {"$ne": sym}})
        if clash:
            raise HTTPException(status_code=409, detail=f"Port already used by {clash['symbol']}")
    if updates:
        res = await db.coins.update_one({"symbol": sym}, {"$set": updates})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Coin not found")
    match = next((c for c in await _coins() if c.symbol == sym), None)
    if not match:
        raise HTTPException(status_code=404, detail="Coin not found")
    return match
