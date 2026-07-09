import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.router import router
from app.db import init_pool, close_pool
from app.mqtt_subscriber import mqtt_listen_forever

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    mqtt_task = asyncio.create_task(mqtt_listen_forever())
    yield
    mqtt_task.cancel()
    await close_pool()

app = FastAPI(lifespan=lifespan)
app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}
