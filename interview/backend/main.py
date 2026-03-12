from langchain.agents import AgentType, initialize_agent
from langchain_community.llms import Ollama
from langchain.tools import Tool
from langchain.prompts import ChatPromptTemplate
from langchain.memory import ConversationBufferMemory


def search_web(query: str) -> str:
    """搜索网络信息"""
    return f"搜索结果: {query}"


def calculate(expression: str) -> str:
    """计算数学表达式"""
    try:
        result = eval(expression)
        return f"计算结果: {result}"
    except Exception as e:
        return f"计算错误: {str(e)}"


def main():
    llm = Ollama(
        model="qwen2.5",
        base_url="http://localhost:11434"
    )
    
    tools = [
        Tool(
            name="Web Search",
            func=search_web,
            description="用于搜索网络信息"
        ),
        Tool(
            name="Calculator",
            func=calculate,
            description="""
            用于计算数学表达式。
            输入案例:  2 + 3 
                    5 * (2 + 3)
            输出格式: 计算结果
            """
        )
    ]
    
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    
    agent = initialize_agent(
        tools=tools,
        llm=llm,
        agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True
    )
    
    print("Agent 已初始化，可以开始对话！")
    print("输入 'quit' 或 'exit' 退出")
    print("=" * 50)
    
    while True:
        user_input = input("你: ").strip()
        
        if user_input.lower() in ["quit", "exit", "退出"]:
            print("再见！")
            break
        
        if not user_input:
            continue
        
        try:
            response = agent.run({"input": user_input})
            print(f"Agent: {response}")
        except Exception as e:
            print(f"错误: {str(e)}")


if __name__ == "__main__":
    main()