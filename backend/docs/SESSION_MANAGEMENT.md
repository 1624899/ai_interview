# 历史会话管理功能

## 概述

历史会话管理功能允许保存、查看和管理面试会话的完整历史记录，包括所有对话消息和会话元数据。

## 功能特性

- ✅ **会话持久化**: 所有会话数据保存在本地JSON文件中
- ✅ **消息自动保存**: 聊天过程中自动保存用户和AI的消息
- ✅ **会话列表**: 查看所有历史会话，支持筛选和分页
- ✅ **会话详情**: 查看完整的对话历史和元数据
- ✅ **会话管理**: 支持更新会话标题、状态等信息
- ✅ **会话删除**: 删除不需要的历史会话

## 数据结构

### 会话元数据 (SessionMetadata)
```python
{
    "mode": "coach",              # 面试模式: coach/mock
    "resume_filename": "xxx.pdf", # 简历文件名
    "job_description": "...",     # 岗位描述
    "question_count": 3,          # 已提问数量
    "max_questions": 5,           # 最大问题数
    "status": "active"            # 会话状态: active/completed/archived
}
```

### 消息项 (MessageItem)
```python
{
    "role": "user",               # 角色: user/ai/system
    "content": "...",             # 消息内容
    "timestamp": "2025-11-26T17:00:00"  # 时间戳
}
```

### 完整会话 (InterviewSession)
```python
{
    "session_id": "uuid",         # 会话ID
    "title": "辅导模式 - 2025-11-26 17:00",  # 会话标题
    "created_at": "...",          # 创建时间
    "updated_at": "...",          # 更新时间
    "metadata": {...},            # 会话元数据
    "messages": [...]             # 消息列表
}
```

## API 接口

### 1. 创建会话
```http
POST /api/sessions/
Content-Type: application/json

{
    "mode": "coach",
    "title": "我的面试会话",  # 可选
    "resume_filename": "resume.pdf",
    "job_description": "Python开发工程师",
    "max_questions": 5
}
```

**响应**:
```json
{
    "success": true,
    "session": {
        "session_id": "...",
        "title": "...",
        ...
    }
}
```

### 2. 获取会话列表
```http
GET /api/sessions/?status=active&mode=coach&limit=20&offset=0
```

**查询参数**:
- `status`: 筛选状态 (active/completed/archived)
- `mode`: 筛选模式 (coach/mock)
- `limit`: 返回数量限制 (默认50)
- `offset`: 偏移量 (默认0)

**响应**:
```json
{
    "success": true,
    "sessions": [...],
    "total": 10
}
```

### 3. 获取会话详情
```http
GET /api/sessions/{session_id}
```

**响应**:
```json
{
    "success": true,
    "session": {
        "session_id": "...",
        "title": "...",
        "messages": [
            {
                "role": "user",
                "content": "...",
                "timestamp": "..."
            },
            ...
        ],
        ...
    }
}
```

### 4. 更新会话
```http
PATCH /api/sessions/{session_id}
Content-Type: application/json

{
    "title": "新标题",
    "status": "completed",
    "metadata": {
        "question_count": 5
    }
}
```

### 5. 删除会话
```http
DELETE /api/sessions/{session_id}
```

### 6. 添加消息到会话
```http
POST /api/sessions/{session_id}/messages?role=user&content=你好
```

**注意**: 在使用聊天API (`/api/chat/stream`) 时，消息会自动保存到会话中，无需手动调用此接口。

## 数据存储

会话数据存储在 **SQLite数据库** 中：`backend/data/sessions.db`

### 数据库结构

#### sessions 表（会话主表）
```sql
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    resume_filename TEXT,
    job_description TEXT,
    question_count INTEGER DEFAULT 0,
    max_questions INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active'
);
```

#### messages 表（消息表）
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);
```

### 索引优化
- `idx_session_updated`: 按更新时间倒序索引
- `idx_session_status`: 按状态索引
- `idx_message_session`: 按会话ID和时间戳索引

### 优势
- ✅ **事务支持**: 保证数据一致性
- ✅ **外键约束**: 自动级联删除消息
- ✅ **索引优化**: 快速查询性能
- ✅ **SQL查询**: 支持复杂查询和聚合
- ✅ **并发安全**: SQLite内置锁机制

## 集成到聊天流程

聊天API已自动集成会话管理：

1. **用户发送消息** → 自动保存到会话
2. **AI流式响应** → 收集完整响应后保存到会话
3. **状态更新** → 自动更新会话元数据（如question_count）

示例流程：
```python
# 1. 创建会话（前端）
session_response = await create_session({
    "mode": "coach",
    "resume_filename": "my_resume.pdf"
})
thread_id = session_response.session.session_id

# 2. 开始聊天（消息自动保存）
await stream_chat({
    "thread_id": thread_id,
    "message": "请介绍一下你自己",
    ...
})

# 3. 查看历史（随时可查）
session_detail = await get_session(thread_id)
print(session_detail.messages)  # 所有历史消息
```

## 测试

运行测试脚本验证功能：

```bash
# 确保后端服务已启动
cd backend
python test_sessions.py
```

测试脚本会执行以下操作：
1. 创建新会话
2. 获取会话列表
3. 获取会话详情
4. 添加消息
5. 更新会话
6. 删除会话（可选）

## 前端集成建议

### 1. 会话列表组件
```typescript
// 获取历史会话列表
const sessions = await fetch('/api/sessions/?limit=20').then(r => r.json())

// 渲染会话列表
sessions.sessions.map(session => (
    <SessionCard
        key={session.session_id}
        title={session.title}
        mode={session.mode}
        messageCount={session.message_count}
        updatedAt={session.updated_at}
        onClick={() => loadSession(session.session_id)}
    />
))
```

### 2. 加载历史会话
```typescript
// 加载会话详情
const loadSession = async (sessionId: string) => {
    const response = await fetch(`/api/sessions/${sessionId}`)
    const { session } = await response.json()
    
    // 恢复消息历史
    setMessages(session.messages)
    setThreadId(session.session_id)
    setMode(session.metadata.mode)
}
```

### 3. 创建新会话
```typescript
const startNewSession = async () => {
    const response = await fetch('/api/sessions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'coach',
            resume_filename: currentResume.filename,
            max_questions: 5
        })
    })
    
    const { session } = await response.json()
    setThreadId(session.session_id)
}
```

## 注意事项

1. **会话ID即线程ID**: `session_id` 和聊天API中的 `thread_id` 是同一个值
2. **自动保存**: 使用聊天API时消息会自动保存，无需手动调用
3. **数据持久化**: 所有数据保存在SQLite数据库中，重启服务后仍然可用
4. **事务安全**: SQLite提供ACID事务保证，确保数据一致性
5. **并发访问**: SQLite内置锁机制，支持多个读取者和单个写入者

## 数据库管理

### 查看数据库内容
```bash
# 使用SQLite命令行工具
sqlite3 backend/data/sessions.db

# 查看所有会话
SELECT * FROM sessions;

# 查看某个会话的消息
SELECT * FROM messages WHERE session_id = 'xxx';

# 退出
.quit
```

### 备份数据库
```bash
# 简单备份
cp backend/data/sessions.db backend/data/sessions_backup.db

# 或使用SQLite备份命令
sqlite3 backend/data/sessions.db ".backup backend/data/sessions_backup.db"
```

### 清空数据
```bash
# 删除所有会话
sqlite3 backend/data/sessions.db "DELETE FROM sessions;"

# 或删除整个数据库文件
rm backend/data/sessions.db
```

## 未来改进

- [ ] 支持会话搜索（按标题、内容搜索）
- [ ] 支持会话标签和分类
- [ ] 支持会话导出（PDF、Markdown）
- [ ] 支持会话分享（生成分享链接）
- [ ] 迁移到数据库存储（PostgreSQL/MongoDB）
- [ ] 添加会话统计和分析功能
