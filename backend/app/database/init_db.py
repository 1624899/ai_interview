"""
数据库初始化模块
负责创建所有表结构和索引
"""

import sqlite3
import logging
from .config import DB_PATH

logger = logging.getLogger(__name__)


def init_database():
    """
    初始化数据库，创建所有必要的表和索引
    这个函数应该在应用启动时调用一次
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # ====================================================================
        # 会话管理表
        # ====================================================================
        
        # 创建会话表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                mode TEXT NOT NULL,
                resume_filename TEXT,
                resume_content TEXT,
                job_description TEXT,
                company_info TEXT,
                interview_plan TEXT,
                question_count INTEGER DEFAULT 0,
                max_questions INTEGER DEFAULT 5,
                status TEXT DEFAULT 'active',
                pinned INTEGER DEFAULT 0,
                candidate_profile TEXT
            )
        ''')
        logger.info("✓ sessions 表已创建/验证")
        
        # 创建消息表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                question_index INTEGER DEFAULT 0,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            )
        ''')
        logger.info("✓ messages 表已创建/验证")
        
        
        # ====================================================================
        # 索引创建
        # ====================================================================
        
        # 会话表索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_updated 
            ON sessions(updated_at DESC)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_status 
            ON sessions(status)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_mode 
            ON sessions(mode)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_session_pinned 
            ON sessions(pinned DESC, updated_at DESC)
        ''')
        
        # 消息表索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_session 
            ON messages(session_id, timestamp)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_timestamp 
            ON messages(timestamp DESC)
        ''')
        
        logger.info("✓ 所有索引已创建/验证")
        
        # ====================================================================
        # LangGraph Checkpoints 表
        # ====================================================================
        # 注意：LangGraph 的 AsyncSqliteSaver 会自动创建所需的表
        # 这里不需要手动创建，只需确保数据库文件存在即可
        
        conn.commit()
        logger.info(f"✓ 数据库初始化完成: {DB_PATH}")
        
    except Exception as e:
        logger.error(f"✗ 数据库初始化失败: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def get_database_info():
    """
    获取数据库信息（用于调试和验证）
    
    Returns:
        dict: 包含表名、索引等信息的字典
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 获取所有表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # 获取所有索引
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]
        
        # 获取每个表的行数
        table_counts = {}
        for table in tables:
            if not table.startswith('sqlite_'):
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                table_counts[table] = count
        
        return {
            "db_path": DB_PATH,
            "tables": tables,
            "indexes": indexes,
            "table_counts": table_counts
        }
        
    finally:
        conn.close()


if __name__ == "__main__":
    # 如果直接运行此文件，则初始化数据库
    logging.basicConfig(level=logging.INFO)
    init_database()
    
    # 打印数据库信息
    info = get_database_info()
    print("\n" + "="*60)
    print("数据库信息")
    print("="*60)
    print(f"路径: {info['db_path']}")
    print(f"\n表: {', '.join(info['tables'])}")
    print(f"\n索引: {', '.join(info['indexes'])}")
    print(f"\n表记录数:")
    for table, count in info['table_counts'].items():
        print(f"  - {table}: {count}")
    print("="*60)
