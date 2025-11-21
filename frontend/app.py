# -*- coding: utf-8 -*-
"""
AI 面试助手前端应用
基于 Chainlit 框架构建的交互式面试系统，支持模拟面试和辅导两种模式
"""

import sys
import os
import chainlit as cl
from langchain_core.messages import HumanMessage

# 修复模块导入路径
# 获取当前文件 (frontend/app.py) 的绝对路径
current_file_path = os.path.abspath(__file__)
# 获取 frontend 目录路径
frontend_dir = os.path.dirname(current_file_path)
# 获取项目根目录路径 (即 frontend 的上一级)
project_root = os.path.dirname(frontend_dir)

# 将项目根目录添加到 sys.path
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# 尝试导入，如果失败打印调试信息
try:
    from app.services.file_service import file_service
    from app.core.graph import build_mock_interview_graph, build_coach_interview_graph
except ImportError as e:
    print(f"导入失败: {e}")
    print(f"当前 sys.path: {sys.path}")
    print(f"项目根目录: {project_root}")
    raise e

@cl.on_chat_start
async def start():
    """
    聊天开始时的初始化流程
    """
    # 1. 发送欢迎消息
    await cl.Message(content="👋 欢迎来到 AI 面试助手！我是您的面试官。\n\n在开始之前，我需要了解一些信息。").send()

    # 2. 获取简历（选择已有简历或上传新简历）
    resume_text = await get_resume_text()
    if not resume_text:
        return  # 终止流程

    # 3. 请求岗位描述 (JD)
    res = await cl.AskUserMessage(content="请输入您要面试的岗位描述 (JD):", timeout=180).send()
    if res:
        jd_text = res["output"]
        cl.user_session.set("jd_text", jd_text)
    
    # 4. 选择面试模式
    actions = [
        cl.Action(name="mock", value="mock", label="模拟面试 (Mock Interview)", payload={"value": "mock"}),
        cl.Action(name="coach", value="coach", label="辅导模式 (Coaching Mode)", payload={"value": "coach"}),
    ]
    res = await cl.AskActionMessage(
        content="请选择面试模式：",
        actions=actions,
    ).send()
    
    # Chainlit 的 AskActionMessage 返回的是 Action 的 name
    mode = res.get("name") or res.get("value", "coach")  # 兜底默认为 coach
    print(f"[DEBUG] Selected mode: {mode}, res: {res}")
    cl.user_session.set("mode", mode)
    await cl.Message(content=f"已选择模式: {'模拟面试' if mode == 'mock' else '辅导模式'}").send()

    # 5. 根据模式初始化对应的面试图谱
    if mode == "mock":
        graph = build_mock_interview_graph()
        print(f"[DEBUG] Built Mock Interview Graph")
    else:
        graph = build_coach_interview_graph()
        print(f"[DEBUG] Built Coach Interview Graph")
    cl.user_session.set("graph", graph)

    # 初始化状态
    initial_state = {
        "messages": [],
        "resume_context": resume_text,
        "job_description": jd_text,
        "mode": mode,
        "question_count": 0,
        "max_questions": 3 
    }
    print(f"[DEBUG] initial_state mode: {initial_state['mode']}")
    cl.user_session.set("state", initial_state)

    # 6. 开始面试 (触发第一个问题)
    await cl.Message(content="🚀 面试开始！正在生成第一个问题...").send()

    # 运行图谱 (流式)
    inputs = initial_state
    print(f"[DEBUG] Starting interview with mode: {inputs['mode']}")

    # 显示思考中
    msg = cl.Message(content="")
    await msg.send()

    final_state = None

    # 使用 astream_events 获取流式事件
    # 添加必要的配置参数以满足 Checkpointer 要求
    # 使用会话ID作为thread_id以确保唯一性
    import uuid
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    cl.user_session.set("thread_id", thread_id)  # 保存thread_id供后续使用
    async for event in graph.astream_events(inputs, config=config, version="v1"):
        kind = event["event"]
        
        # 监听 LLM 的流式输出
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                await msg.stream_token(content)
        
        # 监听图谱结束事件，获取最终状态（只保存包含有效 messages 的状态）
        elif kind == "on_chain_end":
            output = event["data"].get("output")
            if output and isinstance(output, dict):
                # 只有当 output 包含 messages 且不为空时才更新
                if "messages" in output and len(output.get("messages", [])) > 0:
                    final_state = output
                    print(f"[DEBUG start] Captured valid state with keys: {final_state.keys()}")
                    print(f"[DEBUG start] Messages count: {len(final_state.get('messages', []))}")
                else:
                    print(f"[DEBUG start] Skipping state with keys: {output.keys()} (no valid messages)")
            
            # 流式输出结束后，更新消息状态以通知前端输出已完成
            await msg.update()
        
            # 更新状态
    print(f"[DEBUG start] final_state is None: {final_state is None}")
    if final_state:
        # 手动维护完整的消息历史
        # final_state["messages"] 可能只包含 AI 的回复，我们需要手动合并
        current_state = cl.user_session.get("state") or initial_state
        new_state = current_state.copy()
        
        # 更新非-messages 字段
        for key in final_state:
            if key != "messages":
                new_state[key] = final_state[key]
        
        # 手动合并 messages：初始 messages + AI 回复
        if "messages" in final_state and len(final_state["messages"]) > 0:
            # 初始状态的 messages 已经传给了 graph，现在只需要添加 AI 的回复
            ai_response = final_state["messages"][-1]  # 取最后一条（AI 回复）
            new_state["messages"] = inputs["messages"] + [ai_response]
        else:
            new_state["messages"] = inputs["messages"]
        
        print(f"[DEBUG start] Final merged messages count: {len(new_state.get('messages', []))}")
        cl.user_session.set("state", new_state)
    else:
        # 未能获取状态，使用 initial_state 作为兜底
        print("[WARNING start] final_state is None, using initial_state")
        cl.user_session.set("state", initial_state)

@cl.on_message
async def main(message: cl.Message):
    """
    处理用户回复
    """
    graph = cl.user_session.get("graph")
    state = cl.user_session.get("state")
    
    if not graph or not state:
        await cl.Message(content="⚠️ 会话已过期，请刷新页面重新开始。").send()
        return

    # 将用户消息添加到状态中
    user_msg = HumanMessage(content=message.content)
    
    # 获取当前消息历史
    current_messages = state.get("messages", [])
    print(f"[DEBUG main] Current messages count before adding user msg: {len(current_messages)}")
    
    inputs = {
        "messages": current_messages + [user_msg],
        "resume_context": state.get("resume_context", ""),
        "job_description": state.get("job_description", ""),
        "mode": state.get("mode", "coach"),
        "question_count": state.get("question_count", 0),
        "max_questions": state.get("max_questions", 3)
    }
    print(f"[DEBUG main] Inputs messages count: {len(inputs['messages'])}")

    # 显示思考中
    msg = cl.Message(content="")
    await msg.send()

    final_state = None

    # 运行图谱 (流式)
    # 添加必要的配置参数以满足 Checkpointer 要求
    # 使用之前保存的thread_id
    thread_id = cl.user_session.get("thread_id")
    if not thread_id:
        import uuid
        thread_id = str(uuid.uuid4())
        cl.user_session.set("thread_id", thread_id)
    config = {"configurable": {"thread_id": thread_id}}
    async for event in graph.astream_events(inputs, config=config, version="v1"):
        kind = event["event"]
        
        # 监听 LLM 的流式输出
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                await msg.stream_token(content)
        
        # 监听图谱结束事件，获取最终状态（只保存包含有效 messages 的状态）
        elif kind == "on_chain_end":
            output = event["data"].get("output")
            if output and isinstance(output, dict):
                # 只有当 output 包含 messages 且不为空时才更新
                if "messages" in output and len(output.get("messages", [])) > 0:
                    final_state = output
                    print(f"[DEBUG main] Captured valid state with keys: {final_state.keys()}")
                    print(f"[DEBUG main] Messages count: {len(final_state.get('messages', []))}")
                else:
                    print(f"[DEBUG main] Skipping state with keys: {output.keys()} (no valid messages)")
    
    # 流式输出结束后，更新消息状态以通知前端输出已完成
    await msg.update()

    print(f"[DEBUG main] final_state is None: {final_state is None}")
    
    # 更新 session 状态
    if final_state:
        # 手动维护完整的消息历史
        new_state = state.copy()
        
        # 更新非-messages 字段
        for key in final_state:
            if key != "messages":
                new_state[key] = final_state[key]
        
        # 手动合并 messages：inputs messages + AI 回复
        if "messages" in final_state and len(final_state["messages"]) > 0:
            ai_response = final_state["messages"][-1]  # 取最后一条
            new_state["messages"] = inputs["messages"] + [ai_response]
        else:
            new_state["messages"] = inputs["messages"]
        
        print(f"[DEBUG main] Final merged messages count: {len(new_state.get('messages', []))}")
        cl.user_session.set("state", new_state)
        
        # 用于后续判断
        final_state_full = new_state
    else:
        print("[WARNING main] final_state is None, keeping old state")
        final_state_full = state

    # 检查是否结束
    if final_state_full and final_state_full.get("question_count", 0) >= final_state_full.get("max_questions", 5):
        pass


async def get_resume_text() -> str:
    """
    获取简历文本内容，支持选择已有简历或上传新简历
    
    Returns:
        str: 简历文本内容，如果失败返回None
    """
    # 获取已保存的简历列表
    try:
        resume_list = file_service.get_resume_list()
    except Exception as e:
        print(f"获取简历列表失败: {str(e)}")
        resume_list = []
    
    # 如果有已保存的简历，提供选择选项
    if resume_list:
        # 创建选择已有简历和上传新简历的选项
        actions = [
            cl.Action(name="upload_new", value="upload_new", label="上传新简历", payload={"value": "upload_new"}),
        ]
        
        # 为每个已保存的简历创建选择按钮
        for resume in resume_list:
            # 格式化显示信息
            display_name = resume.get("original_name", resume.get("stored_name", "未知文件"))
            upload_time = resume.get("upload_time", "未知时间")
            use_count = resume.get("use_count", 0)
            stored_name = resume.get('stored_name')
            
            # 创建友好的显示名称
            label = f"{display_name} (上传时间: {upload_time}, 使用次数: {use_count})"
            
            actions.append(
                cl.Action(
                    name=stored_name,
                    value=stored_name,
                    label=label,
                    payload={"value": stored_name}
                )
            )
        
        # 询问用户选择
        res = await cl.AskActionMessage(
            content="请选择简历操作：",
            actions=actions,
        ).send()
        
        # Chainlit 的 AskActionMessage 返回的是 Action 的 name 或 value
        selected_value = res.get("name") or res.get("value") if res else None
        print(f"[DEBUG] Selected resume: {selected_value}, res: {res}")
        
        # 如果选择上传新简历
        if selected_value == "upload_new":
            return await upload_new_resume()
        
        # 如果选择已有简历
        elif selected_value and selected_value != "upload_new":
            return await load_existing_resume(selected_value)
        
        else:
            await cl.Message(content="❌ 未选择简历，请重新开始。").send()
            return None
    
    # 如果没有已保存的简历，直接上传新简历
    else:
        return await upload_new_resume()


async def upload_new_resume() -> str:
    """
    上传新简历并处理
    
    Returns:
        str: 简历文本内容，如果失败返回None
    """
    files = None
    while files is None:
        files = await cl.AskFileMessage(
            content="请上传您的简历 (支持 PDF, Word, TXT)",
            accept=["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", ".docx"],
            max_size_mb=10,
            timeout=180,
        ).send()

    file = files[0]
    # 显示处理中状态
    msg = cl.Message(content=f"正在处理简历: {file.name}...")
    await msg.send()

    # 保存并解析简历
    try:
        # 使用 file_service 的 Chainlit 适配方法
        resume_text = file_service.process_chainlit_file(file)
        # 存入 session
        cl.user_session.set("resume_text", resume_text)
        msg.content = f"✅ 简历处理成功！(提取了 {len(resume_text)} 个字符)"
        await msg.update()
        return resume_text
    except Exception as e:
        msg.content = f"❌ 简历处理失败: {str(e)}\n\n请检查文件格式是否正确，或尝试重新上传。"
        await msg.update()
        return None


async def load_existing_resume(stored_name: str) -> str:
    """
    加载已存在的简历
    
    Args:
        stored_name: 存储的文件名
        
    Returns:
        str: 简历文本内容，如果失败返回None
    """
    try:
        # 获取简历信息
        resume_info = file_service.get_resume_by_filename(stored_name)
        
        # 显示处理中状态
        msg = cl.Message(content=f"正在加载简历: {resume_info.get('original_name', stored_name)}...")
        await msg.send()
        
        # 构建文件路径
        file_path = os.path.join(file_service.upload_dir, stored_name)
        
        # 提取文本内容
        resume_text = file_service.extract_text(file_path)
        
        # 更新使用统计
        file_service.update_usage_stats(stored_name)
        
        # 存入 session
        cl.user_session.set("resume_text", resume_text)
        
        # 显示成功信息
        use_count = resume_info.get("use_count", 0) + 1
        msg.content = f"✅ 简历加载成功！(提取了 {len(resume_text)} 个字符)\n📊 这是第 {use_count} 次使用此简历"
        await msg.update()
        
        return resume_text
        
    except FileNotFoundError:
        await cl.Message(content=f"❌ 未找到简历文件: {stored_name}\n\n可能文件已被删除，请尝试上传新简历。").send()
        return None
    except Exception as e:
        await cl.Message(content=f"❌ 简历加载失败: {str(e)}\n\n请尝试重新上传简历。").send()
        return None