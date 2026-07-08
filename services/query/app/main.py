from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.router import router
from app.repository import init_pool, close_pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()

app = FastAPI(lifespan=lifespan)
app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}