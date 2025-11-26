"""
FastAPI 主入口文件
AI 面试助手后端服务
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, upload
from app.models.schemas import ErrorResponse

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    """
    # 启动时执行
    logger.info("AI 面试助手后端服务启动中...")
    
    # 确保数据目录存在
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(os.path.join(data_dir, "resumes"), exist_ok=True)
    
    logger.info("数据目录初始化完成")
    
    yield
    
    # 关闭时执行
    logger.info("AI 面试助手后端服务关闭中...")


# 创建 FastAPI 应用实例
app = FastAPI(
    title="AI 面试助手 API",
    description="基于 FastAPI + LangGraph 的智能面试系统后端",
    version="1.0.0",
    lifespan=lifespan
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境中应该限制具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理器
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP 异常处理"""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail if isinstance(exc.detail, dict) else {
            "error": "HTTPException",
            "message": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理"""
    logger.error(f"未处理的异常: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "服务器内部错误，请稍后重试"
        }
    )


# 根路径
@app.get("/")
async def root():
    """
    根路径，返回 API 信息
    """
    return {
        "message": "AI 面试助手 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


# 健康检查
@app.get("/health")
async def health_check():
    """
    健康检查端点
    """
    return {
        "status": "healthy",
        "message": "服务运行正常"
    }


# 注册路由
app.include_router(chat.router)
app.include_router(upload.router)


# 启动信息
if __name__ == "__main__":
    import uvicorn
    
    # 从环境变量读取配置，如果没有则使用默认值
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    logger.info(f"启动服务器: http://{host}:{port}")
    logger.info(f"API 文档: http://{host}:{port}/docs")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )