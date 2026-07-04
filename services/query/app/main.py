from fastapi import FastAPI
from app.router import router

app = FastAPI()
app.include_router(router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}