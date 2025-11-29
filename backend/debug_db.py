import asyncio
import aiosqlite
import os
import sys

# 添加当前目录到 sys.path
sys.path.append(os.getcwd())

from app.database import DB_PATH

async def main():
    async with aiosqlite.connect(DB_PATH) as db:
        # 获取最新的 session_id
        async with db.execute('SELECT session_id FROM sessions ORDER BY updated_at DESC LIMIT 1') as cursor:
            row = await cursor.fetchone()
            if not row:
                print("No sessions found")
                return
            session_id = row[0]
            print(f"Checking Session: {session_id}")

        # 获取该会话的所有消息
        async with db.execute('SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC', (session_id,)) as cursor:
            rows = await cursor.fetchall()
            for i, row in enumerate(rows):
                content_preview = row[1][:20].replace('\n', ' ')
                print(f"Index {i}: [{row[0]}] {content_preview}...")

if __name__ == "__main__":
    asyncio.run(main())
