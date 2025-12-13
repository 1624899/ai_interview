<p align="center">
  <img src="web/public/logo.png" alt="AI Interview Agent" width="80" height="80" style="border-radius: 20%">
</p>

<h1 align="center">🎯 AI 面试 & 简历智能体</h1>

<p align="center">
  <strong>基于 LangGraph 的全能求职助手：智能面试模拟 + 简历深度优化</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#️-技术栈">技术栈</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-项目结构">项目结构</a> •
  <a href="#-docker-部署">部署</a>
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

面面-AI求职助手是一个利用大语言模型（LLM）和 LangGraph 状态机技术构建的综合求职辅助系统。它不仅能进行全真模拟面试，还能像专业的职业咨询师一样，通过多智能体协作（Multi-Agent）对简历进行深度诊断和定向优化，帮助求职者全方位提升竞争力。

### 🎬 演示

![Demo Screenshot](Screenshot/1.png) ![Demo Screenshot](Screenshot/2.png) ![Demo Screenshot](Screenshot/3.png) ![Demo Screenshot](Screenshot/4.png)

*(更多演示图待更新)*

---

## ✨ 功能特性

### 📄 智能简历优化与生成 (New!)
- **多专家协同诊断**: 采用创新圆桌会议架构，由 **匹配分析师**（分析 JD 匹配度）、**内容优化师**（提供修改建议）、**HR 审核官**（模拟筛选视角）三位 AI 专家共同会诊。
- **深度反思机制**: 内置 Quality Assurance (Reflector) 节点，对专家建议进行二次审核与反思精炼，确保输出高质量、可落地的优化方案。
- **JD 定向优化**: 深度分析目标职位描述（JD），精准提取关键词，提供针对性的经验重写建议（如 STAR 法则应用）。
- **简历生成**: 支持整合面试对话中挖掘出的亮点，从零生成或针对特定职位定制专业简历。

### 🎙️ 智能面试模拟
- **智能规划**: 根据简历和职位描述（JD）自动生成个性化面试题目清单
- **全真模拟**: 模拟真实面试体验，面试过程中不给即时反馈
- **多类型题目**: 自我介绍、技术问题、行为面试、系统设计
- **流畅过渡**: AI 面试官自然引导对话，逐题推进
- **结束报告**: 面试结束后生成综合评价报告（评分、优缺点、录用建议）

### 🔄 多轮面试系统
- **连续面试流程**: 一面完成后可一键开启下一轮，简历/JD 自动继承
- **智能轮次推断**: 自动区分一面（基础）、二面（深度）、三面（综合）不同策略
- **问题去重机制**: 下一轮自动避免重复上一轮已问过的问题
- **灵活题数**: 支持自选 3-10 道题目，适应不同面试长度

### 📊 能力评估系统
- **多维度评分**: 技术能力、沟通能力、问题解决、学习能力、团队协作
- **雷达图可视化**: 直观展示各项能力得分
- **技能标签提取**: 自动识别展现的技术技能
- **累计档案**: 多次面试后的综合能力趋势

### ⚙️ 灵活的配置
- **多 LLM 支持**: OpenAI、Azure、以及兼容 API（如 DeepSeek、通义千问）
- **前端动态配置**: 用户可在界面上配置 API Key 和模型
- **流式响应**: 全链路 SSE 流式输出，体验丝滑

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端核心** | LangGraph | 复杂 Agent 工作流编排（面试流、优化流） |
| | LangChain | LLM 交互与工具调用 |
| | FastAPI | 高性能 Python Web 框架 |
| **前端** | Next.js 15 | React 全栈框架 (App Router) |
| | TypeScript | 类型安全 |
| | Tailwind CSS | 原子化样式 |
| | shadcn/ui | 精美 UI 组件库 |
| | Zustand | 轻量状态管理 |
| **数据存储** | PostgreSQL 16 | 关系型数据库 |
| | asyncpg | 异步数据库驱动 |
| **部署** | Docker | 容器化部署 |

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
2. 点击左侧 "+" 创建新会话，体验模拟面试
3. 点击 "简历工具" 标签，体验简历优化与生成功能

---

## 📁 项目结构

```
ai-interview/
├── backend/                         # Python FastAPI 后端
│   ├── main.py                      # 应用入口
│   ├── app/
│   │   ├── api/                     # 接口路由层
│   │   │   ├── chat.py              # 面试对话 WebSocket/SSE 接口
│   │   │   ├── resume.py            # 简历优化与生成相关接口
│   │   │   ├── sessions.py          # 会话管理接口
│   │   │   ├── upload.py            # 文件上传接口
│   │   │   └── config.py            # API 配置管理
│   │   │
│   │   ├── core/                    # 核心业务逻辑 (Agent Graphs)
│   │   │   ├── graph.py                   # 面试流程状态机 (LangGraph)
│   │   │   ├── resume_optimizer_graph.py  # 简历优化多专家协同 Agent ⭐
│   │   │   ├── resume_generation_graph.py # 简历生成工作流 Agent
│   │   │   ├── resume_analyzer_graph.py   # 简历初步分析 Agent
│   │   │   ├── llms.py                    # LLM 工厂与配置
│   │   │   └── memory.py                  # 对话记忆管理
│   │   │
│   │   ├── database/                # 数据持久层
│   │   │   ├── base.py              # SQLAlchemy 模型定义
│   │   │   ├── init_db.py           # 数据库初始化脚本
│   │   │   ├── session_service.py   # 会话数据服务
│   │   │   ├── resume_service.py    # 简历记录服务
│   │   │   └── resume_generation_service.py # 生成记录服务
│   │   │
│   │   └── services/                # 通用业务服务
│   │       ├── ability_service.py   # 能力画像计算服务
│   │       ├── analysis_service.py  # 报告生成服务
│   │       └── file_service.py      # 文件处理服务
│   └── requirements.txt
│
├── web/                             # Next.js 前端应用
│   ├── app/
│   │   ├── page.tsx                 # 主工作台页面
│   │   └── layout.tsx               # 全局布局
│   │
│   ├── components/                  # React 组件
│   │   ├── ResumeTools.tsx          # 简历工场主容器 ⭐
│   │   ├── ResumeGenerationDialog.tsx # 简历生成对话框
│   │   ├── ResumePreviewDialog.tsx    # 简历预览与导出
│   │   ├── ResumeHistoryList.tsx      # 历史记录列表
│   │   ├── ChatMessage.tsx          # 消息气泡组件
│   │   ├── SessionSidebar.tsx       # 左侧会话导航
│   │   ├── SessionList.tsx          # 会话列表管理
│   │   ├── AbilityProfileView.tsx   # 能力雷达图视图
│   │   └── SettingsDialog.tsx       # 全局设置
│   │
│   ├── store/                       # Zustand 状态管理
│   │   ├── useInterviewStore.ts     # Store 入口
│   │   └── slices/
│   │       ├── interviewSlice.ts    # 面试流程状态
│   │       ├── resumeSlice.ts       # 简历工具状态
│   │       ├── sessionSlice.ts      # 会话列表状态
│   │       └── apiConfigSlice.ts    # 模型配置状态
│   │
│   ├── lib/                         # 工具函数
│   │   └── api/                     # 前端 API 客户端
│   │       ├── resume.ts            # 简历相关 API
│   │       ├── sessions.ts          # 会话相关 API
│   │       └── profile.ts           # 统计相关 API
│   └── public/                      # 静态资源
│
├── docker-compose.yml               # 容器编排配置
└── README.md                        # 项目说明文档
```

---

## 🐳 Docker 部署

```bash
docker-compose --env-file .env.production up -d --build
```


---

## 🗺️ 开发路线图

### ✅ 已完成

- [x] **LangGraph 面试状态机**
  - [x] 多轮面试逻辑
  - [x] 智能追问与引导
- [x] **智能简历工场**
  - [x] 多专家简历诊断（圆桌会议模式）
  - [x] 简历定向优化建议
  - [x] 基于面试数据的简历生成
- [x] **基础设施**
  - [x] 流式响应 (SSE)
  - [x] 会话持久化 (PostgreSQL)
  - [x] Docker 一键部署

### 🚧 计划中

- [ ] 面试题库扩充 (RAG)
- [ ] 语音交互 (Whisper STT + TTS)
- [ ] 更多类型的专家 Agent (如薪资谈判专家)

---

## 📚 文档

- [快速启动指南](docs/快速启动指南.md)
- [项目框架](docs/项目框架.md)

---

## 许可证

本项目采用 **非商业使用许可证 (Non-Commercial Use License)**

- 允许：个人学习、研究、教育用途
- 允许：非商业性质的内部使用
- **禁止：未经授权的任何商业使用**

如需商业授权，请联系作者：1624899229@qq.com

详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [LangGraph](https://langchain-ai.github.io/langgraph/) - 强大的 AI Agent 工作流引擎
- [FastAPI](https://fastapi.tiangolo.com/) - 现代高性能 Python Web 框架
- [Next.js](https://nextjs.org/) - React 全栈框架
- [shadcn/ui](https://ui.shadcn.com/) - 精美的 UI 组件库

---

<p align="center">
  Made with ❤️ by zzt
</p>
