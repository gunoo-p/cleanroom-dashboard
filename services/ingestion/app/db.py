import asyncpg
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DB_URL")

pool: Optional[asyncpg.Pool] = None

async def init_pool():
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=10)

async def close_pool():
    global pool
    if pool is not None:
        await pool.close()
        pool = None
