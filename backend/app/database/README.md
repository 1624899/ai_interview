# 数据库模块使用指南

## 📦 模块结构

```
app/database/
├── __init__.py      # 模块导出
├── config.py        # 数据库配置
├── init_db.py       # 数据库初始化
└── base.py          # 数据库操作基类
```

## 🚀 快速开始

### 1. 导入模块

```python
from app.database import DB_PATH, init_database, db_manager
```

### 2. 初始化数据库

数据库会在应用启动时自动初始化，也可以手动初始化：

```python
from app.database import init_database

# 初始化所有表和索引
init_database()
```

### 3. 使用DatabaseManager

```python
from app.database import db_manager

# 查询多条记录
async def get_active_sessions():
    sessions = await db_manager.execute_query(
        "SELECT * FROM sessions WHERE status = ?",
        ("active",)
    )
    return sessions

# 查询单条记录
async def get_session_by_id(session_id: str):
    session = await db_manager.execute_one(
        "SELECT * FROM sessions WHERE session_id = ?",
        (session_id,)
    )
    return session

# 执行更新
async def update_session_status(session_id: str, status: str):
    rows_affected = await db_manager.execute_update(
        "UPDATE sessions SET status = ?, updated_at = ? WHERE session_id = ?",
        (status, datetime.now().isoformat(), session_id)
    )
    return rows_affected

# 批量插入
async def batch_insert_messages(messages: List[tuple]):
    await db_manager.execute_many(
        "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        messages
    )
```

### 4. 使用事务

```python
from app.database import TransactionManager

async def create_session_with_messages(session_data, messages):
    async with TransactionManager() as conn:
        # 插入会话
        await conn.execute(
            "INSERT INTO sessions (...) VALUES (...)",
            session_data
        )
        
        # 插入消息
        for msg in messages:
            await conn.execute(
                "INSERT INTO messages (...) VALUES (...)",
                msg
            )
        
        # 自动提交，如果出错会自动回滚
```

### 5. 使用连接上下文管理器

```python
from app.database import db_manager

async def complex_query():
    async with db_manager.get_connection() as conn:
        # 执行多个相关查询
        async with conn.execute("SELECT * FROM sessions") as cursor:
            sessions = await cursor.fetchall()
        
        async with conn.execute("SELECT * FROM messages") as cursor:
            messages = await cursor.fetchall()
        
        return sessions, messages
```

## 📊 数据库信息

### 查看数据库状态

```python
from app.database import get_database_info
import json

info = get_database_info()
print(json.dumps(info, indent=2, ensure_ascii=False))
```

### 命令行查看

```bash
# 查看数据库信息
python -m app.database.init_db

# 或使用SQLite命令行
sqlite3 backend/data/ai_interview.db
.tables
.schema sessions
SELECT * FROM sessions;
.quit
```

## 🎯 最佳实践

### 1. 始终使用异步操作

```python
# ✅ 正确
async def get_data():
    return await db_manager.execute_query("SELECT * FROM sessions")

# ❌ 错误
def get_data():
    return db_manager.execute_query("SELECT * FROM sessions")  # 缺少await
```

### 2. 使用参数化查询

```python
# ✅ 正确 - 防止SQL注入
await db_manager.execute_query(
    "SELECT * FROM sessions WHERE session_id = ?",
    (session_id,)
)

# ❌ 错误 - SQL注入风险
await db_manager.execute_query(
    f"SELECT * FROM sessions WHERE session_id = '{session_id}'"
)
```

### 3. 使用事务处理关联操作

```python
# ✅ 正确 - 使用事务
async with TransactionManager() as conn:
    await conn.execute("INSERT INTO sessions ...")
    await conn.execute("INSERT INTO messages ...")

# ❌ 错误 - 可能导致数据不一致
await db_manager.execute_update("INSERT INTO sessions ...")
await db_manager.execute_update("INSERT INTO messages ...")
```

### 4. 正确处理异常

```python
from app.database import TransactionManager
import logging

logger = logging.getLogger(__name__)

async def safe_operation():
    try:
        async with TransactionManager() as conn:
            await conn.execute("...")
    except Exception as e:
        logger.error(f"数据库操作失败: {e}")
        raise
```

## 🔧 配置

### 自定义数据库路径

```python
from app.database import DatabaseManager

# 使用自定义路径
custom_db = DatabaseManager(db_path="/path/to/custom.db")
```

### 环境变量配置

在 `.env` 文件中（可选）：

```env
# 数据库相关配置
DB_PATH=/custom/path/to/ai_interview.db
```

## 📝 常见问题

### Q1: 数据库文件在哪里？
**A**: `backend/data/ai_interview.db`

### Q2: 如何重置数据库？
**A**: 删除数据库文件，重启应用会自动重建：
```bash
rm backend/data/ai_interview.db
python main.py
```

### Q3: 如何备份数据库？
**A**: 
```bash
cp backend/data/ai_interview.db backend/data/ai_interview_backup.db
```

### Q4: 如何查看表结构？
**A**:
```bash
sqlite3 backend/data/ai_interview.db ".schema sessions"
```

### Q5: 数据库操作很慢怎么办？
**A**: 
1. 检查是否使用了索引
2. 使用 `EXPLAIN QUERY PLAN` 分析查询
3. 考虑添加更多索引

## 🎓 进阶用法

### 自定义查询构建器

```python
class SessionQuery:
    def __init__(self):
        self.conditions = []
        self.params = []
    
    def where_status(self, status: str):
        self.conditions.append("status = ?")
        self.params.append(status)
        return self
    
    def where_mode(self, mode: str):
        self.conditions.append("mode = ?")
        self.params.append(mode)
        return self
    
    async def execute(self):
        where_clause = " AND ".join(self.conditions) if self.conditions else "1=1"
        sql = f"SELECT * FROM sessions WHERE {where_clause}"
        return await db_manager.execute_query(sql, tuple(self.params))

# 使用
sessions = await SessionQuery().where_status("active").where_mode("coach").execute()
```

### 数据库迁移助手

```python
async def add_column_if_not_exists(table: str, column: str, column_type: str):
    """安全地添加列"""
    async with db_manager.get_connection() as conn:
        # 检查列是否存在
        async with conn.execute(f"PRAGMA table_info({table})") as cursor:
            columns = await cursor.fetchall()
            column_names = [col[1] for col in columns]
        
        if column not in column_names:
            await conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
            await conn.commit()
            print(f"✅ 添加列: {table}.{column}")
        else:
            print(f"ℹ️  列已存在: {table}.{column}")
```

## 📚 相关文档

- [数据库模块化完成总结](./数据库模块化完成总结.md)
- [会话功能实现总结](./会话功能实现总结.md)
- [快速启动指南](./快速启动指南.md)
