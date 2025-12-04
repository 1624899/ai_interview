"""
面试模式策略模式实现
支持 Mock 模式的差异化处理 (简化版 - 仅用于 Summary)
"""

from abc import ABC, abstractmethod
from enum import Enum


class InterviewMode(str, Enum):
    """面试模式枚举"""
    MOCK = "mock"


class ModeStrategy(ABC):
    """面试模式策略基类"""

    mode: InterviewMode

    @abstractmethod
    def get_feedback_prompt(self) -> str:
        """获取反馈提示词 (用于生成面试总结报告)"""
        pass


class MockModeStrategy(ModeStrategy):
    """模拟面试模式策略"""

    mode = InterviewMode.MOCK

    def get_feedback_prompt(self) -> str:
        """Mock 模式的简洁反馈"""
        return """面试结束。请生成一份简洁的面试反馈报告,包含:

1. 综合评分(0-100分,严格打分)
2. 主要优点(1-3条)
3. 主要不足(2-3条)
4. 录用建议(录用/待定/不录用)

报告要简洁专业,避免冗长。"""


class ModeStrategyFactory:
    """模式策略工厂"""
    
    _strategies = {
        InterviewMode.MOCK: MockModeStrategy(),
    }
    
    @classmethod
    def get_strategy(cls, mode: str) -> ModeStrategy:
        """获取对应模式的策略
        
        Args:
            mode: 模式字符串 ("mock")
        
        Returns:
            ModeStrategy: 对应的策略实例
        
        Raises:
            ValueError: 如果模式不支持
        """
        try:
            mode_enum = InterviewMode(mode.lower())
            return cls._strategies[mode_enum]
        except (ValueError, KeyError):
            raise ValueError(f"不支持的模式: {mode}。支持的模式: mock")
    
    @classmethod
    def register_strategy(cls, mode: str, strategy: ModeStrategy):
        """注册自定义策略
        
        Args:
            mode: 模式字符串
            strategy: 策略实例
        """
        try:
            mode_enum = InterviewMode(mode.lower())
            cls._strategies[mode_enum] = strategy
        except ValueError:
            raise ValueError(f"无效的模式: {mode}")
