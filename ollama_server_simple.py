#!/usr/bin/env python3
"""
简单的Ollama服务模拟器 - 包含API密钥验证
完全避免CORS问题
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import random
import time
from urllib.parse import urlparse, parse_qs

class OllamaHandler(BaseHTTPRequestHandler):
    
    def __init__(self, *args, **kwargs):
        # 设置有效的API密钥
        self.valid_api_key = "sk-ollama-local-123456"
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """处理OPTIONS预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Length', '0')
        self.end_headers()
    
    def end_headers(self):
        """在所有响应中添加CORS头"""
        # 只在没有设置过CORS头的情况下添加
        if 'Access-Control-Allow-Origin' not in self._headers_buffer:
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_POST(self):
        """处理POST请求"""
        if self.path == '/v1/chat/completions':
            self.handle_chat_completions()
        else:
            self.send_error(404)
    
    def do_GET(self):
        """处理GET请求"""
        if self.path == '/v1/models':
            self.handle_list_models()
        elif self.path == '/health':
            self.handle_health()
        else:
            self.send_error(404)
    
    def handle_chat_completions(self):
        """处理聊天补全请求"""
        try:
            # 验证API密钥
            auth_header = self.headers.get('Authorization', '')
            if not self.verify_api_key(auth_header):
                self.send_error(401, "Invalid API Key")
                return
            
            # 读取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            print(f"收到请求 - 模型: {data.get('model', 'unknown')}")
            print(f"消息数量: {len(data.get('messages', []))}")
            
            # 模拟处理时间
            time.sleep(0.5)
            
            # 生成回复内容
            user_message = data.get('messages', [{}])[-1].get('content', '')
            
            # 回复模板
            responses = [
                "这是一个模拟的AI回复。您当前使用的是本地Ollama服务。",
                "您好！我是本地运行的AI助手，可以帮您处理各种问题。",
                "基于您的查询，我建议您检查代码逻辑和数据结构。",
                "这个问题很有趣！让我思考一下如何帮您解决。"
            ]
            
            code_responses = [
                "```python\nprint(\"Hello, World!\")\n```",
                "```javascript\nconsole.log(\"Hello from JavaScript\");\n```"
            ]
            
            if '代码' in user_message or 'code' in user_message.lower():
                content = random.choice(code_responses)
            elif '你好' in user_message or 'hello' in user_message.lower():
                content = "您好！我是本地AI助手，很高兴为您服务。"
            else:
                content = random.choice(responses)
            
            # 构建响应
            response_data = {
                "id": f"chatcmpl-{random.randint(1000, 9999)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": data.get('model', 'llama2'),
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": content
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": len(str(data)),
                    "completion_tokens": len(content.split()),
                    "total_tokens": len(str(data)) + len(content.split())
                }
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            print(f"处理请求时出错: {e}")
            self.send_error(500, str(e))
    
    def handle_list_models(self):
        """列出模型"""
        # 验证API密钥
        auth_header = self.headers.get('Authorization', '')
        if not self.verify_api_key(auth_header):
            self.send_error(401, "Invalid API Key")
            return
            
        models_data = {
            "data": [
                {
                    "id": "llama2",
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "ollama"
                }
            ]
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(models_data).encode())
    
    def handle_health(self):
        """健康检查"""
        health_data = {"status": "ok", "service": "ollama-simple"}
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(health_data).encode())
    
    def verify_api_key(self, auth_header):
        """验证API密钥"""
        if not auth_header.startswith('Bearer '):
            print("API密钥格式错误")
            return False
        
        provided_key = auth_header.replace('Bearer ', '').strip()
        
        if provided_key == self.valid_api_key:
            print("API密钥验证成功")
            return True
        else:
            print(f"API密钥验证失败: {provided_key}")
            return False

if __name__ == '__main__':
    port = 2222
    server = HTTPServer(('localhost', port), OllamaHandler)
    
    print(f"启动简单的Ollama模拟服务...")
    print(f"服务地址: http://localhost:{port}")
    print(f"API端点: http://localhost:{port}/v1/chat/completions")
    print(f"API密钥: sk-ollama-local-123456")
    print("按 Ctrl+C 停止服务")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n停止服务")
        server.shutdown()#!/usr/bin/env python3
"""
简单的Ollama服务模拟器 - 使用内置HTTP服务器
完全避免CORS问题
"""

