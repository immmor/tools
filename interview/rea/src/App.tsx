import { useState, useRef, useEffect, useCallback } from 'react'
import { FixedSizeList as List } from 'react-window'
import type { ListChildComponentProps } from 'react-window'
import './App.css'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  type?: 'text' | 'code' | 'image'
}

interface AgentNode {
  id: string
  title: string
  description: string
  question: string
  tags: string[]
  category: 'react' | 'agent'
}

const KNOWLEDGE_NODES: AgentNode[] = [
  {
    id: '1',
    title: 'useState & useRef',
    description: '<b>useState:</b> 用于管理对话列表、加载状态。这是 Agent 的"短期记忆"。<br><br><b>useRef:</b> 关键点！用于存储 AbortController（取消请求）或 WebSocket 实例。它不触发重绘，适合存储与 UI 无关的底层控制逻辑。',
    question: '如何手动停止一个正在生成的流？（答：通过 Ref 里的 AbortController 调用 abort）',
    tags: ['Hooks', 'Memory'],
    category: 'react'
  },
  {
    id: '2',
    title: 'useEffect (The Listener)',
    description: '<b>面试重点：</b> 在 AI 开发中，useEffect 常用于处理 SSE 链接的建立与销毁。必须返回 Cleanup 函数来关闭 Stream，否则会导致严重的内存泄漏和 Token 浪费。',
    question: '组件卸载时如果不关闭 SSE 会发生什么？',
    tags: ['Lifecycle', 'Monitor'],
    category: 'react'
  },
  {
    id: '3',
    title: '流式渲染解析',
    description: '<b>原理：</b> 使用 Fetch API 的 body.getReader() 获取 ReadableStream。<br><br><b>优化：</b> 采用"缓冲区"策略，避免每收到一个字符就重新渲染 UI，而是在一定毫秒内合并更新，提升 FPS。',
    question: '如何在高频流式输出时保证页面不卡顿？',
    tags: ['Performance', 'Optimization'],
    category: 'agent'
  },
  {
    id: '4',
    title: '生成式 UI (Dynamic)',
    description: '这是前端 AI 开发的高级阶段。Agent 返回特定格式（如 JSON），前端使用 <b>Dynamic Import</b> 或一个 Map 映射表，根据模型指令动态挂载对应 React 组件。',
    question: '解释一下 Vercel AI SDK 中的 Generative UI 实现思路。',
    tags: ['Decision', 'Dynamic Component'],
    category: 'agent'
  },
  {
    id: '5',
    title: '虚拟列表 (Virtual List)',
    description: '当 Agent 进行数百轮对话后，DOM 节点过载。使用 react-window 或 tanstack-virtual。只渲染可见视口内的消息气泡。',
    question: '长对话场景下，如何保证滚动性能？',
    tags: ['UX', 'Stability'],
    category: 'react'
  }
]

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'system',
      content: '欢迎来到 React x AI Agent 交互演示。点击下方的知识节点卡片，深入了解前端与 Agent 开发的核心知识点。',
      timestamp: 0
    }
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBufferRef = useRef<string>('')
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timestampRef = useRef<number>(0)
  const idCounterRef = useRef<number>(0)

  const getNextId = () => {
    return `${timestampRef.current}_${idCounterRef.current++}`
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    timestampRef.current = Date.now()
    idCounterRef.current = 0
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!target || !(target instanceof HTMLElement)) return
      if (!target.closest('.node-card') && !target.closest('.detail-panel')) {
        setSelectedNode(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNodeClick = (node: AgentNode) => {
    setSelectedNode(node)
    
    if (isStreaming) {
      abortControllerRef.current?.abort()
      setIsStreaming(false)
    }

    const userMsg: Message = {
      id: getNextId(),
      role: 'user',
      content: `我想了解：${node.title}`,
      timestamp: timestampRef.current
    }

    setMessages(prev => [...prev, userMsg])

    const assistantMsg: Message = {
      id: getNextId(),
      role: 'assistant',
      content: '',
      timestamp: timestampRef.current
    }

    setMessages(prev => [...prev, assistantMsg])

    setIsStreaming(true)
    streamBufferRef.current = ''

    const fullContent = node.description + '\n\n' + node.question
    let charIndex = 0
    const chunkSize = 3

    const controller = new AbortController()
    abortControllerRef.current = controller

    const streamChunk = () => {
      if (controller.signal.aborted) {
        setIsStreaming(false)
        return
      }

      if (charIndex >= fullContent.length) {
        setIsStreaming(false)
        return
      }

      const end = Math.min(charIndex + chunkSize, fullContent.length)
      const chunk = fullContent.slice(charIndex, end)
      streamBufferRef.current += chunk
      
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = streamBufferRef.current
        }
        return newMessages
      })

      charIndex = end
      streamTimerRef.current = setTimeout(streamChunk, 50)
    }

    streamChunk()
  }

  const handleClear = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort()
    }
    idCounterRef.current = 0
    setMessages([
      {
        id: 'init',
        role: 'system',
        content: '对话已清空。请选择新的知识点进行了解。',
        timestamp: 0
      }
    ])
    setSelectedNode(null)
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }

  const MessageItem = ({ index, style }: ListChildComponentProps) => {
    const msg = messages[index]
    return (
      <div style={style}>
        <div className={`message ${msg.role}`}>
          <div className="message-role">
            {msg.role === 'user' && '👤 用户'}
            {msg.role === 'assistant' && '🤖 AI'}
            {msg.role === 'system' && '⚙️ 系统'}
          </div>
          <div className="message-content">
            {msg.role === 'system' ? (
              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
            ) : (
              <div className="typewriter-text">{msg.content}</div>
            )}
          </div>
          {msg.role === 'assistant' && selectedNode && (
            <div className="message-footer">
              <p className="interview-question">
                面试官可能会问：<span>{selectedNode.question}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="header-title">React x AI Agent</h1>
        <p className="header-subtitle">点击下方知识点卡片，体验流式渲染与 Agent 交互</p>
      </header>

      <div className="main-content">
        <div className="knowledge-grid">
          <h2 className="section-title">知识点卡片</h2>
          {KNOWLEDGE_NODES.map(node => (
            <div
              key={node.id}
              className="node-card"
              onClick={() => handleNodeClick(node)}
            >
              <div className="node-tags">
                {node.tags.map(tag => (
                  <span key={tag} className={`tag ${node.category}`}>
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="node-title">{node.title}</h3>
              <p className="node-desc">点击了解详情</p>
            </div>
          ))}
        </div>

        <div className="chat-container">
          <div className="chat-header">
            <span className="status-indicator"></span>
            <span>{isStreaming ? 'AI 正在思考...' : '就绪'}</span>
          </div>
          <div className="chat-messages">
            <div className="react-window-list-container">
              <List
                height={Math.min(messages.length * 120 + 100, 600)}
                itemCount={messages.length}
                itemSize={120}
                width="100%"
              >
                {MessageItem}
              </List>
            </div>
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-controls">
            <button
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={isStreaming}
            >
              清空对话
            </button>
            {isStreaming && (
              <button className="btn btn-stop" onClick={handleStop}>
                ⏹ 停止生成
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedNode && (
        <div className="detail-panel">
          <h3 className="detail-title">{selectedNode.title}</h3>
          <div
            className="detail-content"
            dangerouslySetInnerHTML={{ __html: selectedNode.description }}
          />
          <div className="detail-footer">
            <p className="detail-label">面试官可能会问：</p>
            <p className="detail-question">{selectedNode.question}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
