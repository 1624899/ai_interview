import os
import uuid
import json
import logging
import shutil
from typing import List
from datetime import datetime, timedelta
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from fastapi import UploadFile

# 加载环境变量
current_file_path = os.path.abspath(__file__)
backend_dir = os.path.dirname(os.path.dirname(current_file_path))
project_root = os.path.dirname(backend_dir)
env_path = os.path.join(project_root, ".env")

if not load_dotenv(env_path):
    print(f"警告: 文件服务无法从 {env_path} 加载环境变量")

# 从环境变量读取配置，使用 backend/data 作为基准
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(backend_dir, "data", "resumes"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
ALLOWED_EXTENSIONS = os.getenv("ALLOWED_FILE_EXTENSIONS", "pdf,docx,txt").split(',')
MAX_RESUME_COUNT = int(os.getenv("MAX_RESUME_COUNT", "5"))

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FileServiceError(Exception):
    """文件服务基础异常类"""
    pass


class UnsupportedFileTypeError(FileServiceError):
    """不支持的文件类型异常"""
    pass


class FileSizeExceededError(FileServiceError):
    """文件大小超限异常"""
    pass


class FileService:
    """
    文件服务类，支持 Chainlit 和 FastAPI
    
    支持的文件格式：
    - PDF (.pdf)
    - Word (.doc, .docx)
    - 纯文本 (.txt)
    """

    def __init__(self, upload_dir: str = UPLOAD_DIR):
        """初始化文件服务"""
        self.upload_dir = upload_dir
        self.max_file_size_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        self.allowed_extensions = [ext.strip().lower() for ext in ALLOWED_EXTENSIONS]
        
        os.makedirs(self.upload_dir, exist_ok=True)
        logger.info(f"文件服务初始化成功，上传目录: {self.upload_dir}")
    
    def _validate_file_type(self, filename: str) -> bool:
        """验证文件类型"""
        file_ext = os.path.splitext(filename)[1].lower().lstrip('.')
        return file_ext in self.allowed_extensions
    
    def _validate_file_size(self, file_size: int) -> bool:
        """验证文件大小"""
        return file_size <= self.max_file_size_bytes
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """解析 PDF 文件"""
        try:
            logger.info(f"开始解析 PDF: {file_path}")
            loader = PyPDFLoader(file_path)
            pages: List[Document] = loader.load()
            full_text = "\n\n".join([page.page_content for page in pages])
            
            if not full_text.strip():
                raise ValueError("PDF 解析成功但内容为空")
            
            logger.info(f"PDF 解析成功，提取文本长度: {len(full_text)} 字符")
            return full_text
        except Exception as e:
            logger.error(f"PDF 解析失败: {str(e)}")
            raise FileServiceError(f"PDF 解析失败: {str(e)}")
    
    def extract_text_from_docx(self, file_path: str) -> str:
        """解析 Word 文档 (.docx)"""
        try:
            from docx import Document
            logger.info(f"开始解析 Word 文档: {file_path}")
            
            doc = Document(file_path)
            full_text = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            
            if not full_text.strip():
                raise ValueError("Word 文档解析成功但内容为空")
            
            logger.info(f"Word 文档解析成功，提取文本长度: {len(full_text)} 字符")
            return full_text
        except ImportError:
            raise FileServiceError("缺少 python-docx 库")
        except Exception as e:
            logger.error(f"Word 文档解析失败: {str(e)}")
            raise FileServiceError(f"Word 文档解析失败: {str(e)}")
    
    def extract_text_from_txt(self, file_path: str) -> str:
        """读取纯文本文件"""
        try:
            logger.info(f"开始读取文本文件: {file_path}")
            encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1']
            
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        full_text = f.read()
                    if full_text.strip():
                        logger.info(f"文本文件读取成功 (编码: {encoding})")
                        return full_text
                except UnicodeDecodeError:
                    continue
            
            raise ValueError("无法使用常见编码读取文本文件")
        except Exception as e:
            logger.error(f"文本文件读取失败: {str(e)}")
            raise FileServiceError(f"文本文件读取失败: {str(e)}")
    
    def extract_text(self, file_path: str) -> str:
        """根据文件类型自动选择提取方法"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.pdf':
            return self.extract_text_from_pdf(file_path)
        elif file_ext == '.docx':
            return self.extract_text_from_docx(file_path)
        elif file_ext == '.txt':
            return self.extract_text_from_txt(file_path)
        else:
            raise UnsupportedFileTypeError(f"不支持的文件类型: {file_ext}")

    def _generate_unique_filename(self, original_filename: str) -> str:
        """
        生成唯一文件名，使用原文件名，如有重复则添加数字后缀
        
        Args:
            original_filename: 原始文件名
            
        Returns:
            str: 唯一的文件名
        """
        name, ext = os.path.splitext(original_filename)
        base_path = os.path.join(self.upload_dir, original_filename)
        
        # 如果原文件名不存在，直接使用
        if not os.path.exists(base_path):
            return original_filename
        
        # 如果存在，添加数字后缀
        counter = 1
        while True:
            new_filename = f"{name}({counter}){ext}"
            new_path = os.path.join(self.upload_dir, new_filename)
            
            if not os.path.exists(new_path):
                return new_filename
            
            counter += 1
            
            # 防止无限循环
            if counter > 9999:
                raise FileServiceError(f"无法为文件 {original_filename} 生成唯一文件名")

    def _load_metadata(self) -> dict:
        """加载简历元数据"""
        metadata_file = os.path.join(self.upload_dir, "resumes_metadata.json")
        
        if not os.path.exists(metadata_file):
            return {}
        
        try:
            with open(metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载元数据失败: {str(e)}")
            return {}

    def _save_metadata(self, metadata: dict) -> bool:
        """保存简历元数据"""
        metadata_file = os.path.join(self.upload_dir, "resumes_metadata.json")
        
        try:
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"保存元数据失败: {str(e)}")
            return False

    def process_chainlit_file(self, chainlit_file) -> str:
        """
        处理 Chainlit 上传的文件并保存元数据
        
        Args:
            chainlit_file: Chainlit 的文件对象 (包含 name, path, size 属性)
            
        Returns:
            str: 提取的文本内容
        """
        try:
            # 1. 验证文件类型
            if not self._validate_file_type(chainlit_file.name):
                raise UnsupportedFileTypeError(
                    f"不支持的文件类型: {chainlit_file.name}。"
                    f"支持的格式: {', '.join(self.allowed_extensions)}"
                )
            
            # 2. 验证文件大小
            if not self._validate_file_size(chainlit_file.size):
                raise FileSizeExceededError(
                    f"文件大小 ({chainlit_file.size / 1024 / 1024:.2f}MB) "
                    f"超过限制 ({MAX_FILE_SIZE_MB}MB)"
                )
            
            # 3. 生成唯一文件名并保存
            unique_filename = self._generate_unique_filename(chainlit_file.name)
            target_path = os.path.join(self.upload_dir, unique_filename)
            
            # 从 Chainlit 临时文件复制到目标位置
            with open(target_path, "wb") as target_file:
                with open(chainlit_file.path, "rb") as source_file:
                    target_file.write(source_file.read())
            
            logger.info(f"Chainlit 文件已保存: {target_path}")
            
            # 4. 提取文本
            text_content = self.extract_text(target_path)
            
            # 5. 验证内容有效性
            if not text_content or not text_content.strip():
                raise FileServiceError("文件解析成功但内容为空")
            
            # 6. 保存元数据
            metadata = self._load_metadata()
            
            metadata[unique_filename] = {
                "original_name": chainlit_file.name,  # 原始文件名
                "stored_name": unique_filename,  # 实际存储的文件名
                "upload_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "file_size": chainlit_file.size,
                "content_length": len(text_content),
                "use_count": 0,
                "last_used": None
            }
            
            self._save_metadata(metadata)
            
            # 清理旧简历，保持数量不超过限制
            self._cleanup_old_resumes()
            
            logger.info(f"文本提取成功，长度: {len(text_content)} 字符")
            logger.info(f"元数据已保存: {unique_filename}")
            return text_content
            
        except (UnsupportedFileTypeError, FileSizeExceededError, FileServiceError):
            raise
        except Exception as e:
            logger.error(f"处理 Chainlit 文件失败: {str(e)}")
            raise FileServiceError(f"文件处理失败: {str(e)}")

    async def process_fastapi_file(self, upload_file: UploadFile) -> str:
        """
        处理 FastAPI 上传的文件并保存元数据
        
        Args:
            upload_file: FastAPI 的 UploadFile 对象
            
        Returns:
            str: 提取的文本内容
        """
        try:
            # 1. 验证文件类型
            if not self._validate_file_type(upload_file.filename):
                raise UnsupportedFileTypeError(
                    f"不支持的文件类型: {upload_file.filename}。"
                    f"支持的格式: {', '.join(self.allowed_extensions)}"
                )
            
            # 2. 验证文件大小 (注意：UploadFile.size 可能为 None)
            file_size = 0
            if hasattr(upload_file, 'size') and upload_file.size is not None:
                file_size = upload_file.size
            else:
                # 如果 size 为 None，需要读取文件来获取大小
                upload_file.file.seek(0, 2)  # 移动到文件末尾
                file_size = upload_file.file.tell()
                upload_file.file.seek(0)  # 重置到文件开头
            
            if not self._validate_file_size(file_size):
                raise FileSizeExceededError(
                    f"文件大小 ({file_size / 1024 / 1024:.2f}MB) "
                    f"超过限制 ({MAX_FILE_SIZE_MB}MB)"
                )
            
            # 3. 生成唯一文件名并保存
            unique_filename = self._generate_unique_filename(upload_file.filename)
            target_path = os.path.join(self.upload_dir, unique_filename)
            
            # 保存文件
            try:
                with open(target_path, "wb") as buffer:
                    shutil.copyfileobj(upload_file.file, buffer)
            finally:
                upload_file.file.close()
            
            logger.info(f"FastAPI 文件已保存: {target_path}")
            
            # 4. 提取文本
            text_content = self.extract_text(target_path)
            
            # 5. 验证内容有效性
            if not text_content or not text_content.strip():
                raise FileServiceError("文件解析成功但内容为空")
            
            # 6. 保存元数据
            metadata = self._load_metadata()
            
            metadata[unique_filename] = {
                "original_name": upload_file.filename,  # 原始文件名
                "stored_name": unique_filename,  # 实际存储的文件名
                "upload_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "file_size": file_size,
                "content_length": len(text_content),
                "use_count": 0,
                "last_used": None
            }
            
            self._save_metadata(metadata)
            
            # 清理旧简历，保持数量不超过限制
            self._cleanup_old_resumes()
            
            logger.info(f"文本提取成功，长度: {len(text_content)} 字符")
            logger.info(f"元数据已保存: {unique_filename}")
            return text_content
            
        except (UnsupportedFileTypeError, FileSizeExceededError, FileServiceError):
            raise
        except Exception as e:
            logger.error(f"处理 FastAPI 文件失败: {str(e)}")
            raise FileServiceError(f"文件处理失败: {str(e)}")

    def get_resume_list(self) -> list:
        """获取简历列表"""
        metadata = self._load_metadata()
        return list(metadata.values())

    def get_resume_by_filename(self, filename: str) -> dict:
        """根据文件名获取简历信息"""
        metadata = self._load_metadata()
        
        if filename in metadata:
            return metadata[filename]
        
        raise FileNotFoundError(f"未找到文件: {filename}")

    def update_usage_stats(self, filename: str) -> bool:
        """更新简历使用统计"""
        try:
            metadata = self._load_metadata()
            
            if filename in metadata:
                metadata[filename]["last_used"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                metadata[filename]["use_count"] += 1
                return self._save_metadata(metadata)
            
            return False
        except Exception as e:
            logger.error(f"更新使用统计失败: {str(e)}")
            return False

    def _cleanup_old_resumes(self) -> bool:
        """
        清理旧简历，保持简历数量不超过最大限制
        按照先进先出（FIFO）原则删除最旧的简历
        
        Returns:
            bool: 清理是否成功
        """
        try:
            metadata = self._load_metadata()
            
            # 如果简历数量未超过限制，不需要清理
            if len(metadata) <= MAX_RESUME_COUNT:
                return True
            
            # 按上传时间排序，最旧的在前
            sorted_resumes = sorted(
                metadata.items(),
                key=lambda x: x[1]["upload_time"]
            )
            
            # 计算需要删除的简历数量
            files_to_delete = len(metadata) - MAX_RESUME_COUNT
            
            deleted_count = 0
            for i in range(files_to_delete):
                filename, resume_info = sorted_resumes[i]
                file_path = os.path.join(self.upload_dir, filename)
                
                # 删除物理文件
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"删除旧简历文件: {filename}")
                except Exception as e:
                    logger.error(f"删除文件失败 {filename}: {str(e)}")
                    continue
                
                # 从元数据中删除
                del metadata[filename]
                deleted_count += 1
                logger.info(f"从元数据中删除简历: {filename}")
            
            # 保存更新后的元数据
            if deleted_count > 0:
                self._save_metadata(metadata)
                logger.info(f"清理完成，删除了 {deleted_count} 个旧简历")
            
            return True
            
        except Exception as e:
            logger.error(f"清理旧简历失败: {str(e)}")
            return False


# 实例化默认服务对象
file_service = FileService()