import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# 获取项目根目录路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(project_root, ".env")
load_dotenv(env_path)

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
