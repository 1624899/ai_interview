"""
FastAPI 后端测试脚本
用于验证各个 API 接口是否正常工作
"""

import asyncio
import json
import requests
import os
from pathlib import Path

# API 基础 URL
BASE_URL = "http://localhost:8000"

def test_health_check():
    """测试健康检查接口"""
    print("🔍 测试健康检查接口...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ 健康检查通过")
            print(f"   响应: {response.json()}")
            return True
        else:
            print(f"❌ 健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 健康检查异常: {str(e)}")
        return False

def test_root():
    """测试根路径接口"""
    print("\n🔍 测试根路径接口...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ 根路径访问正常")
            print(f"   响应: {response.json()}")
            return True
        else:
            print(f"❌ 根路径访问失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 根路径访问异常: {str(e)}")
        return False

def test_upload_endpoints():
    """测试文件上传相关接口"""
    print("\n🔍 测试文件上传接口...")
    
    # 1. 测试获取简历列表
    try:
        response = requests.get(f"{BASE_URL}/api/upload/resumes")
        if response.status_code == 200:
            print("✅ 获取简历列表成功")
            print(f"   响应: {response.json()}")
        else:
            print(f"❌ 获取简历列表失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取简历列表异常: {str(e)}")
        return False
    
    # 2. 测试文件上传（如果有测试文件）
    test_file_path = Path("test_resume.txt")
    if test_file_path.exists():
        try:
            with open(test_file_path, 'rb') as f:
                files = {'file': ('test_resume.txt', f, 'text/plain')}
                response = requests.post(f"{BASE_URL}/api/upload/resume", files=files)
                
            if response.status_code == 200:
                print("✅ 文件上传成功")
                print(f"   响应: {response.json()}")
                return True
            else:
                print(f"❌ 文件上传失败: {response.status_code}")
                print(f"   错误信息: {response.text}")
                return False
        except Exception as e:
            print(f"❌ 文件上传异常: {str(e)}")
            return False
    else:
        print("ℹ️  跳过文件上传测试（没有测试文件）")
        print("   提示: 创建 test_resume.txt 文件来测试上传功能")
    
    return True

def test_chat_endpoints():
    """测试聊天相关接口"""
    print("\n🔍 测试聊天接口...")
    
    # 1. 测试开始面试会话
    try:
        start_data = {
            "thread_id": "test_thread_123",
            "mode": "coach",
            "resume_context": "这是一个测试简历内容，包含Python开发经验。",
            "job_description": "Python后端开发工程师，需要熟悉Django和FastAPI。",
            "max_questions": 3
        }
        
        response = requests.post(
            f"{BASE_URL}/api/chat/start",
            json=start_data
        )
        
        if response.status_code == 200:
            print("✅ 开始面试会话成功")
            print(f"   响应: {response.json()}")
            
            # 2. 测试流式聊天
            print("\n🔍 测试流式聊天接口...")
            chat_data = {
                "message": "你好，我想开始面试",
                "thread_id": "test_thread_123",
                "mode": "coach",
                "resume_context": "这是一个测试简历内容，包含Python开发经验。",
                "job_description": "Python后端开发工程师，需要熟悉Django和FastAPI。",
                "max_questions": 3
            }
            
            response = requests.post(
                f"{BASE_URL}/api/chat/stream",
                json=chat_data,
                stream=True
            )
            
            if response.status_code == 200:
                print("✅ 流式聊天连接成功")
                print("   接收到的数据:")
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        if decoded_line.startswith('data: '):
                            data = decoded_line[6:]  # 移除 'data: ' 前缀
                            try:
                                json_data = json.loads(data)
                                print(f"     {json_data}")
                                if json_data.get('type') == 'done':
                                    break
                            except json.JSONDecodeError:
                                print(f"     原始数据: {data}")
                
                return True
            else:
                print(f"❌ 流式聊天失败: {response.status_code}")
                print(f"   错误信息: {response.text}")
                return False
                
        else:
            print(f"❌ 开始面试会话失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 聊天接口测试异常: {str(e)}")
        return False

def create_test_file():
    """创建测试文件"""
    test_content = """
测试简历

姓名：张三
联系方式：test@example.com

教育背景：
- 计算机科学与技术 本科 2020-2024

工作经验：
- Python开发工程师 2024-至今
  * 负责后端API开发
  * 使用Django和FastAPI框架
  * 熟悉数据库设计和优化

技能：
- 编程语言：Python, JavaScript
- 框架：Django, FastAPI, React
- 数据库：MySQL, PostgreSQL, Redis
- 其他：Git, Docker, Linux

项目经验：
1. 电商平台后端开发
2. 用户管理系统重构
3. 数据分析平台搭建
"""
    
    with open("test_resume.txt", "w", encoding="utf-8") as f:
        f.write(test_content)
    
    print("📝 创建测试简历文件: test_resume.txt")

def main():
    """主测试函数"""
    print("🚀 开始测试 FastAPI 后端 API")
    print("=" * 50)
    
    # 创建测试文件
    create_test_file()
    
    # 运行测试
    tests = [
        test_health_check,
        test_root,
        test_upload_endpoints,
        test_chat_endpoints
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！后端 API 运行正常。")
    else:
        print("⚠️  部分测试失败，请检查后端服务。")
    
    # 清理测试文件
    if os.path.exists("test_resume.txt"):
        os.remove("test_resume.txt")
        print("🧹 清理测试文件")

if __name__ == "__main__":
    print("⚠️  请确保 FastAPI 后端服务已启动 (python backend/main.py)")
    print("⚠️  请确保已安装所需依赖 (pip install -r backend/requirements.txt)")
    print()
    
    input("按 Enter 键开始测试...")
    main()