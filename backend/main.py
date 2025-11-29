"""
FastAPI 主入口文件
AI 面试助手后端服务
"""

import os
import logging
import signal
import sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import chat, upload, sessions
from app.models.schemas import ErrorResponse

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# 全局变量用于存储需要清理的资源
sqlite_connections = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    """
    # 启动时执行
    logger.info("AI 面试助手后端服务启动中...")
    
    # 初始化数据库
    from app.database import init_database
    init_database()
    
    # 确保数据目录存在
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(os.path.join(data_dir, "resumes"), exist_ok=True)
    
    logger.info("数据目录初始化完成")
    
    yield
    
    # 关闭时执行
    logger.info("AI 面试助手后端服务关闭中...")
    
    # 清理资源
    await cleanup_resources()

async def cleanup_resources():
    """
    清理所有资源，包括数据库连接和图实例
    """
    global sqlite_connections
    
    logger.info("正在清理资源...")
    
    # 清理图实例
    try:
        from app.core.graph import get_graph_instances, clear_graph_instances
        graph_instances = get_graph_instances()
        
        for graph in graph_instances:
            try:
                if hasattr(graph, 'checkpointer') and hasattr(graph.checkpointer, 'conn'):
                    await graph.checkpointer.conn.close()
                    logger.info("已关闭图实例的数据库连接")
            except Exception as e:
                logger.error(f"关闭图实例数据库连接时出错: {e}")
        
        # 清空图实例列表
        clear_graph_instances()
        
    except Exception as e:
        logger.error(f"获取或清理图实例时出错: {e}")
    
    # 清理被跟踪的 SQLite 连接
    try:
        from app.core.memory import get_tracked_connections, clear_tracked_connections
        tracked_connections = get_tracked_connections()
        
        for conn in tracked_connections:
            try:
                await conn.close()
                logger.info("已关闭被跟踪的 SQLite 连接")
            except Exception as e:
                logger.error(f"关闭被跟踪的 SQLite 连接时出错: {e}")
        
        # 清空被跟踪的连接列表
        clear_tracked_connections()
        
    except Exception as e:
        logger.error(f"获取或清理被跟踪的连接时出错: {e}")
    
    # 清理直接的 SQLite 连接
    for conn in sqlite_connections:
        try:
            await conn.close()
            logger.info("已关闭 SQLite 连接")
        except Exception as e:
            logger.error(f"关闭 SQLite 连接时出错: {e}")
    
    # 清空列表
    sqlite_connections.clear()
    
    logger.info("资源清理完成")

def handle_signal(signum, frame):
    """
    处理系统信号，实现优雅关闭
    """
    logger.info(f"接收到信号 {signum}，开始优雅关闭...")
    
    # 使用线程池来执行异步清理
    import concurrent.futures
    import threading
    
    def run_cleanup():
        """在新线程中运行清理函数"""
        try:
            # 创建新的事件循环
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # 运行清理函数
            loop.run_until_complete(cleanup_resources())
            logger.info("资源清理完成")
            
        except Exception as e:
            logger.error(f"清理资源时出错: {e}")
        finally:
            try:
                loop.close()
            except:
                pass
    
    # 启动清理线程
    cleanup_thread = threading.Thread(target=run_cleanup)
    cleanup_thread.start()
    
    # 等待清理线程完成（最多等待3秒）
    cleanup_thread.join(timeout=3)
    
    # 退出程序
    sys.exit(0)


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
            "message": "服务器内部错误,请稍后重试"
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
app.include_router(sessions.router)


# 启动信息
if __name__ == "__main__":
    import uvicorn
    
    # 注册信号处理器
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # 从环境变量读取配置，如果没有则使用默认值
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    logger.info(f"启动服务器: http://{host}:{port}")
    logger.info(f"API 文档: http://{host}:{port}/docs")
    logger.info("按 Ctrl+C 可以正常关闭服务器")
    
    try:
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=debug,
            log_level="info"
        )
    except KeyboardInterrupt:
        logger.info("接收到键盘中断，正在关闭...")
    except Exception as e:
        logger.error(f"服务器运行出错: {e}")
    finally:
        logger.info("服务器已关闭")