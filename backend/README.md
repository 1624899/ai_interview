# AI 面试助手 FastAPI 后端

基于 FastAPI + LangGraph 的智能面试系统后端服务，支持简历上传、流式对话等功能。

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 环境配置

确保项目根目录有 `.env` 文件，包含以下配置：

```env
# OpenAI API 配置
XINLIU_API_KEY=your_api_key_here
XINLIU_API_BASE=https://api.openai.com/v1
XINLIU_API_MODEL=gpt-3.5-turbo

# 文件上传配置
UPLOAD_DIR=./data/resumes
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_EXTENSIONS=pdf,docx,txt
MAX_RESUME_COUNT=5

# 服务器配置
HOST=0.0.0.0
PORT=8000
DEBUG=false
```

### 3. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 4. 访问 API 文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 📁 项目结构

```
backend/
├── app/
│   ├── api/                # API 路由
│   │   ├── chat.py        # 聊天相关接口
│   │   └── upload.py      # 文件上传接口
│   ├── core/              # 核心逻辑
│   │   ├── graph.py       # LangGraph 工作流
│   │   ├── llms.py        # LLM 配置
│   │   ├── memory.py      # 记忆管理
│   │   └── prompt.py      # 提示词模板
│   ├── models/            # 数据模型
│   │   └── schemas.py     # Pydantic 模型
│   └── services/          # 业务服务
│       └── file_service.py # 文件处理服务
├── data/                  # 数据存储
│   ├── resumes/          # 简历文件
│   └── interview_checkpoints.sqlite  # 对话状态
├── main.py               # 应用入口
├── requirements.txt      # 依赖列表
├── test_api.py          # API 测试脚本
└── README.md            # 项目说明
```

## 🔌 API 接口

### 1. 健康检查

```http
GET /health
```

### 2. 文件上传

#### 上传简历
```http
POST /api/upload/resume
Content-Type: multipart/form-data

file: <简历文件>
```

#### 获取简历列表
```http
GET /api/upload/resumes
```

#### 获取简历内容
```http
GET /api/upload/resumes/{filename}
```

#### 删除简历
```http
DELETE /api/upload/resumes/{filename}
```

### 3. 聊天功能

#### 开始面试会话
```http
POST /api/chat/start
Content-Type: application/json

{
  "thread_id": "unique_session_id",
  "mode": "coach",
  "resume_context": "简历内容",
  "job_description": "岗位描述",
  "max_questions": 5
}
```

#### 流式聊天
```http
POST /api/chat/stream
Content-Type: application/json

{
  "message": "用户消息",
  "thread_id": "unique_session_id",
  "mode": "coach",
  "resume_context": "简历内容",
  "job_description": "岗位描述",
  "max_questions": 5
}
```

#### 获取会话状态
```http
GET /api/chat/status/{thread_id}
```

#### 结束会话
```http
DELETE /api/chat/session/{thread_id}
```

## 🧪 测试

运行测试脚本来验证 API 功能：

```bash
python test_api.py
```

测试脚本会：
1. 创建测试简历文件
2. 测试所有 API 接口
3. 清理测试文件

## 🎯 核心特性

### 1. 流式对话
- 使用 Server-Sent Events (SSE) 实现实时流式输出
- 支持 LangGraph 的事件流转换
- 自动处理连接异常和错误

### 2. 文件处理
- 支持 PDF、Word、TXT 格式
- 自动提取文本内容
- 文件大小和类型验证
- 自动清理过期文件

### 3. 状态管理
- 基于 SQLite 的持久化存储
- 线程会话隔离
- 自动恢复对话历史

### 4. 错误处理
- 统一的异常处理机制
- 详细的错误信息返回
- 日志记录和监控

## 🔧 开发说明

### 添加新的 API 接口

1. 在 `app/api/` 目录下创建新的路由文件
2. 在 `app/models/schemas.py` 中定义数据模型
3. 在 `main.py` 中注册路由

### 自定义文件处理

1. 修改 `app/services/file_service.py`
2. 添加新的文件格式支持
3. 更新验证逻辑

### 扩展面试模式

1. 在 `app/core/graph.py` 中添加新的节点
2. 在 `app/core/prompt.py` 中添加提示词
3. 更新状态定义和路由逻辑

## 📝 注意事项

1. **环境变量**: 确保正确配置 OpenAI API 密钥
2. **文件权限**: 确保应用有读写 `data/` 目录的权限
3. **端口占用**: 默认端口 8000，如有冲突请修改配置
4. **依赖版本**: 建议使用虚拟环境管理依赖

## 🚀 部署

### Docker 部署

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "main.py"]
```

### 生产环境

1. 使用 Gunicorn 或 Uvicorn 作为 ASGI 服务器
2. 配置反向代理（Nginx）
3. 设置 HTTPS 和安全头
4. 配置日志收集和监控

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 📄 许可证

MIT License