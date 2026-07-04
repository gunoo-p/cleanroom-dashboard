import asyncio
from app.subscriber import start_subscriber

if __name__ == "__main__":
    asyncio.run(start_subscriber())