"""
PostgreSQL 数据库初始化模块
负责创建所有表结构和索引
"""

import asyncio
import asyncpg
import logging
from .config import POSTGRES_CONFIG

logger = logging.getLogger(__name__)

# 初始化状态标记，避免重复执行DDL
_db_initialized = False


async def init_database():
    """
    初始化 PostgreSQL 数据库，创建所有必要的表和索引
    只在首次调用时执行DDL语句，避免重复创建表和索引
    """
    global _db_initialized
    
    # 如果已经初始化过，直接返回
    if _db_initialized:
        logger.debug("数据库已初始化，跳过重复初始化")
        return
    
    conn = await asyncpg.connect(**POSTGRES_CONFIG)
    
    try:
        # ====================================================================
        # 会话管理表
        # ====================================================================
        
        # 创建会话表
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default_user',
                title TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                mode TEXT NOT NULL,
                resume_filename TEXT,
                resume_content TEXT,
                job_description TEXT,
                company_info TEXT,
                interview_plan JSONB,
                question_count INTEGER DEFAULT 0,
                max_questions INTEGER DEFAULT 5,
                status TEXT DEFAULT 'active',
                pinned BOOLEAN DEFAULT FALSE,
                candidate_profile JSONB,
                series_id TEXT,
                round_index INTEGER DEFAULT 1,
                round_type TEXT DEFAULT 'tech_initial',
                parent_session_id TEXT REFERENCES sessions(session_id)
            )
        ''')
        logger.info("✓ sessions 表已创建/验证")
        
        # 创建消息表
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                question_index INTEGER DEFAULT 0,
                timestamp TIMESTAMP NOT NULL
            )
        ''')
        logger.info("✓ messages 表已创建/验证")
        
        # 创建用户综合能力画像表
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS user_profile (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                profile_data JSONB NOT NULL,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        ''')
        logger.info("✓ user_profile 表已创建/验证")
        
        # 创建简历优化/分析结果表
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS resume_results (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                result_type TEXT NOT NULL,
                resume_content TEXT NOT NULL,
                job_description TEXT,
                session_ids JSONB,
                include_profile BOOLEAN DEFAULT FALSE,
                result_data JSONB NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
        ''')
        logger.info("✓ resume_results 表已创建/验证")
        
        # 创建生成的简历表
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS generated_resumes (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                optimization_result_id INTEGER,
                job_description TEXT,
                content TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
        ''')
        logger.info("✓ generated_resumes 表已创建/验证")
        
        # ====================================================================
        # 索引创建
        # ====================================================================
        
        # 会话表索引
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_updated 
            ON sessions(updated_at DESC)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_status 
            ON sessions(status)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_mode 
            ON sessions(mode)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_user 
            ON sessions(user_id)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_user_pinned 
            ON sessions(user_id, pinned DESC, updated_at DESC)
        ''')
        
        # 多轮面试相关索引
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_series 
            ON sessions(series_id)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_parent 
            ON sessions(parent_session_id)
        ''')
        
        # 消息表索引
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_session 
            ON messages(session_id, timestamp)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_timestamp 
            ON messages(timestamp DESC)
        ''')
        
        # 简历结果表索引
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_resume_results_user 
            ON resume_results(user_id, created_at DESC)
        ''')
        
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_resume_results_type 
            ON resume_results(result_type)
        ''')
        
        # 生成的简历表索引
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_generated_resumes_user 
            ON generated_resumes(user_id, created_at DESC)
        ''')
        
        logger.info("✓ 所有索引已创建/验证")
        
        # ====================================================================
        # LangGraph Checkpoints 表 (由 PostgresSaver 自动创建)
        # ====================================================================
        # 注意：LangGraph 的 PostgresSaver 会自动创建 checkpoints 和 writes 表
        
        logger.info(f"✓ 数据库初始化完成: {POSTGRES_CONFIG['database']}")
        
        # 标记初始化完成
        _db_initialized = True
        
    except Exception as e:
        logger.error(f"✗ 数据库初始化失败: {e}")
        raise
    finally:
        await conn.close()


async def get_database_info() -> dict:
    """
    获取数据库信息（用于调试和验证）
    """
    conn = await asyncpg.connect(**POSTGRES_CONFIG)
    
    try:
        # 获取所有表
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_names = [row['table_name'] for row in tables]
        
        # 获取所有索引
        indexes = await conn.fetch("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public'
        """)
        index_names = [row['indexname'] for row in indexes]
        
        # 获取每个表的行数
        table_counts = {}
        for table in table_names:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
            table_counts[table] = count
        
        return {
            "database": POSTGRES_CONFIG['database'],
            "host": POSTGRES_CONFIG['host'],
            "tables": table_names,
            "indexes": index_names,
            "table_counts": table_counts
        }
        
    finally:
        await conn.close()


def init_database_sync():
    """同步版本的数据库初始化（用于启动时调用）"""
    asyncio.get_event_loop().run_until_complete(init_database())


if __name__ == "__main__":
    # 如果直接运行此文件，则初始化数据库
    logging.basicConfig(level=logging.INFO)
    asyncio.run(init_database())
    
    # 打印数据库信息
    info = asyncio.run(get_database_info())
    print("\n" + "="*60)
    print("数据库信息")
    print("="*60)
    print(f"数据库: {info['database']} @ {info['host']}")
    print(f"\n表: {', '.join(info['tables'])}")
    print(f"\n索引: {', '.join(info['indexes'])}")
    print(f"\n表记录数:")
    for table, count in info['table_counts'].items():
        print(f"  - {table}: {count}")
    print("="*60)
