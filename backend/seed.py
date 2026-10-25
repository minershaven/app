"""Reset MinersHaven demo data: `cd /app/backend && python seed.py`."""
import asyncio

from lib.db import ensure_indexes
from lib.seed_data import seed_all


async def main() -> None:
    await seed_all(force=True)
    await ensure_indexes()
    print("seeded")


if __name__ == "__main__":
    asyncio.run(main())
