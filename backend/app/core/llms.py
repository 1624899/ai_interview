import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# 获取项目根目录路径 (现在是 backend 的上级目录)
current_file_path = os.path.abspath(__file__)  # .../backend/app/core/llms.py
app_dir = os.path.dirname(current_file_path)  # .../backend/app/core
backend_app_dir = os.path.dirname(app_dir)  # .../backend/app
backend_dir = os.path.dirname(backend_app_dir)  # .../backend
project_root = os.path.dirname(backend_dir)  # .../ (项目根目录)
env_path = os.path.join(project_root, ".env")

print(f"当前文件路径: {current_file_path}")
print(f"app 目录: {app_dir}")
print(f"backend/app 目录: {backend_app_dir}")
print(f"backend 目录: {backend_dir}")
print(f"项目根目录: {project_root}")
print(f"环境文件路径: {env_path}")

# 尝试加载环境变量
if not load_dotenv(env_path):
    print(f"警告: 无法从 {env_path} 加载环境变量")
    print("当前工作目录:", os.getcwd())
else:
    print("✅ 环境变量加载成功")

# 验证环境变量是否加载成功
api_model = os.getenv("XINLIU_API_MODEL")
if not api_model:
    print("错误: XINLIU_API_MODEL 环境变量未设置")
    print("可用的环境变量:")
    for key, value in os.environ.items():
        if 'API' in key.upper() or 'XINLIU' in key.upper():
            print(f"  {key}: {value}")
    raise ValueError("必需的环境变量 XINLIU_API_MODEL 未设置")

llm = ChatOpenAI(
    temperature=0.7,
    max_tokens=4000,
    model_name=os.getenv("XINLIU_API_MODEL"),
    api_key=os.getenv("XINLIU_API_KEY"),
    base_url=os.getenv("XINLIU_API_BASE")
)

def get_llm():
    return llm

if __name__ == "__main__":
    try:
        llm = get_llm()
        response = llm.invoke("你好，请回复：LLM配置成功！")
        print(response.content)
    except Exception as e:
        print(f"LLM 配置失败: {e}")
