<p align="center">
  <img src="web\public\mascot.png" alt="AI Interview Agent" width="80" height="80">
</p>

<h1 align="center">🎯 AI 面试智能体</h1>

<p align="center">
  <strong>基于 LangGraph 的智能面试模拟系统</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#项目结构">项目结构</a> •
  <a href="#部署">部署</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/LangGraph-Latest-orange.svg" alt="LangGraph">
  <img src="https://img.shields.io/badge/Next.js-15-black.svg" alt="Next.js">
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791.svg" alt="PostgreSQL">
</p>

---

## 📖 项目简介

AI 面试智能体是一个利用大语言模型（LLM）和 LangGraph 状态机技术构建的智能面试模拟系统。它能够根据用户的简历和目标职位，生成针对性的面试问题，进行实时对话模拟，并提供详细的能力评估报告。

### 🎬 演示

![Demo Screenshot](Screenshot/1.png)
![Demo Screenshot](Screenshot/2.png)
![Demo Screenshot](Screenshot/3.png)
![Demo Screenshot](Screenshot/4.png)

---

## ✨ 功能特性

### 🎙️ 智能面试模拟
- **智能规划**: 根据简历和职位描述（JD）自动生成个性化面试题目清单
- **全真模拟**: 模拟真实面试体验，面试过程中不给即时反馈
- **多类型题目**: 自我介绍、技术问题、行为面试、系统设计
- **流畅过渡**: AI 面试官自然引导对话，逐题推进
- **结束报告**: 面试结束后生成综合评价报告（评分、优缺点、录用建议）

### � 多轮面试系统
- **连续面试流程**: 一面完成后可一键开启下一轮，简历/JD 自动继承
- **智能轮次推断**: 自动区分一面（基础）、二面（深度）、三面（综合）不同策略
- **问题去重机制**: 下一轮自动避免重复上一轮已问过的问题
- **轮次可视化**: 会话列表清晰显示"第N轮"标识
- **灵活题数**: 支持自选 3-10 道题目，适应不同面试长度

### �📊 能力评估系统
- **多维度评分**: 技术能力、沟通能力、问题解决、学习能力、团队协作
- **雷达图可视化**: 直观展示各项能力得分
- **技能标签提取**: 自动识别展现的技术技能
- **累计档案**: 多次面试后的综合能力趋势

### 💬 流畅的对话体验
- **流式响应 (SSE)**: 实时打字效果，无需等待完整回复
- **历史会话管理**: 支持创建、恢复、删除会话
- **对话持久化**: 所有对话自动保存到数据库

### ⚙️ 灵活的配置
- **多 LLM 支持**: OpenAI、Azure、以及兼容 API（如 DeepSeek、通义千问）
- **前端动态配置**: 用户可在界面上配置 API Key 和模型
- **自定义面试参数**: 题目数量、面试模式等

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Next.js 15 | React 全栈框架 (App Router) |
| | TypeScript | 类型安全 |
| | Tailwind CSS | 原子化样式 |
| | shadcn/ui | 精美 UI 组件库 |
| | Zustand | 轻量状态管理 |
| **后端** | FastAPI | 高性能 Python Web 框架 |
| | LangGraph | AI Agent 工作流编排 |
| | LangChain | LLM 应用开发框架 |
| | asyncpg | PostgreSQL 异步驱动 |
| **数据库** | PostgreSQL 16 | 关系型数据库 |
| **部署** | Docker | 容器化 |
| | Nginx | 反向代理 |

---

## 🚀 快速开始

### 前置要求

- Python 3.11+
- Node.js 20+
- PostgreSQL 16 (或使用 Docker)
- OpenAI API Key (或兼容 API)

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/ai-interview.git
cd ai-interview
```

### 2. 配置环境变量

```bash
cp .env.production.example .env

# 编辑 .env 文件
```

`.env` 文件内容：

```bash
# 数据库
DATABASE_URL=postgresql://ai_interview:your_password@localhost:5432/ai_interview

# LLM 配置
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
SMART_MODEL=gpt-4
FAST_MODEL=gpt-3.5-turbo
```

### 3. 启动数据库

使用 Docker 快速启动 PostgreSQL：

```bash
docker run -d \
  --name ai_interview_db \
  -e POSTGRES_USER=ai_interview \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=ai_interview \
  -p 5432:5432 \
  postgres:16-alpine
```

### 4. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python -m app.database.init_db

# 启动服务
python main.py
```

后端将在 `http://localhost:8000` 启动

### 5. 启动前端

```bash
cd web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:3000` 启动

### 6. 开始使用

1. 打开浏览器访问 `http://localhost:3000`
2. 点击左侧 "+" 创建新会话
3. 输入职位描述，可选上传简历
4. 选择面试模式，开始面试！

---

## 📁 项目结构

```
ai-interview/
├── backend/                 # Python 后端
│   ├── main.py              # FastAPI 入口
│   ├── app/
│   │   ├── api/             # API 路由
│   │   │   ├── chat.py      # 面试对话接口
│   │   │   ├── sessions.py  # 会话管理
│   │   │   └── upload.py    # 文件上传
│   │   ├── core/            # 核心逻辑
│   │   │   ├── graph.py     # LangGraph 状态机 ⭐
│   │   │   └── llms.py      # LLM 客户端
│   │   ├── database/        # 数据层
│   │   │   └── session_service.py
│   │   └── services/        # 业务服务
│   └── requirements.txt
│
├── web/                     # Next.js 前端
│   ├── app/                 # App Router
│   │   ├── page.tsx         # 主页面（面试界面）
│   │   ├── layout.tsx       # 根布局
│   │   └── globals.css      # 全局样式
│   ├── components/          # React 组件
│   │   ├── ChatMessage.tsx       # 聊天消息气泡
│   │   ├── SessionSidebar.tsx    # 会话侧边栏
│   │   ├── SessionList.tsx       # 会话列表
│   │   ├── SettingsDialog.tsx    # API 设置对话框
│   │   ├── AbilityProfileView.tsx # 能力档案展示
│   │   ├── RadarChart.tsx        # 能力雷达图
│   │   ├── SkillTags.tsx         # 技能标签
│   │   └── ui/                   # shadcn/ui 基础组件
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── scroll-area.tsx
│   │       └── ...              # 其他 UI 组件
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useUserIdentity.ts    # 用户身份识别
│   │   └── useSpeechToText.ts    # 语音转文字
│   ├── lib/                 # 工具库
│   │   ├── utils.ts              # 通用工具函数
│   │   └── api/
│   │       └── profile.ts        # 能力画像 API
│   └── store/               # Zustand 状态管理
│       └── useInterviewStore.ts  # 面试状态管理 ⭐
│
├── nginx/                   # Nginx 配置
├── docs/                    # 项目文档
├── docker-compose.yml       # Docker 编排
├── DEPLOYMENT.md            # 部署指南
└── README.md                # 本文件
```

---

## 🐳 Docker 部署

### 一键启动所有服务

```bash
# 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production

# 启动服务
docker-compose --env-file .env.production up -d --build

# 初始化数据库
docker-compose exec backend python -m app.database.init_db

# 查看日志
docker-compose logs -f
```

### 访问服务

- 前端: `http://localhost` (通过 Nginx)
- API 文档: `http://localhost/api/docs`

更多部署细节请参考 [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 📡 API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/chat/stream` | 发送消息，获取流式响应 |
| `POST` | `/api/chat/start` | 开始新面试 |
| `GET` | `/api/sessions/` | 获取会话列表 |
| `POST` | `/api/sessions/` | 创建新会话 |
| `GET` | `/api/sessions/{id}` | 获取会话详情 |
| `POST` | `/api/sessions/{id}/next-round` | 从已完成面试创建下一轮 |
| `DELETE` | `/api/sessions/{id}` | 删除会话 |
| `POST` | `/api/upload/resume` | 上传简历 |
| `GET` | `/health` | 健康检查 |

完整 API 文档: 启动后访问 `http://localhost:8000/docs`

---

## 🗺️ 开发路线图

### ✅ 已完成

- [x] LangGraph 面试状态机
- [x] 流式响应 (SSE)
- [x] 会话管理与持久化
- [x] 能力评估与雷达图
- [x] 多 LLM 支持
- [x] Docker 部署
- [x] 多轮面试系统
  - [x] 轮次自动推断（一面/二面/三面）
  - [x] 问题去重机制
  - [x] 简历/JD 自动继承
  - [x] 灵活题数选择（3-10题）

### 🚧 进行中 / 计划中

- [ ] 面试题库 (RAG)
- [ ] 定向简历优化
- [ ] 语音输入 (Whisper STT)
- [ ] 语音输出 (TTS)

---

## 📚 文档

- [快速启动指南](docs/快速启动指南.md)
- [项目框架](docs/项目框架.md)
- [开发路线](docs/面试智能体项目开发路线.md)
- [部署指南](DEPLOYMENT.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [LangGraph](https://langchain-ai.github.io/langgraph/) - 强大的 AI Agent 工作流引擎
- [FastAPI](https://fastapi.tiangolo.com/) - 现代高性能 Python Web 框架
- [Next.js](https://nextjs.org/) - React 全栈框架
- [shadcn/ui](https://ui.shadcn.com/) - 精美的 UI 组件库

---

<p align="center">
  Made with ❤️ by Your Name
</p>
