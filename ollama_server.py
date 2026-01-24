from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app, origins=["*"])  # 允许所有域名跨域

@app.route('/v1/chat/completions', methods=['POST', 'OPTIONS'])
def chat_completions():
    if request.method == 'OPTIONS':
        # 处理预检请求
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    try:
        data = request.get_json()
        model = data.get('model', 'qwen2.5:0.5b')
        messages = data.get('messages', [])
        
        # 转换为Ollama API格式
        ollama_data = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "max_tokens": -1
            }
        }
        
        # 调用Ollama本地API
        response = requests.post('http://localhost:11434/api/chat', json=ollama_data)
        response.raise_for_status()
        
        ollama_response = response.json()
        
        # 转换为OpenAI兼容格式
        openai_response = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": ollama_response['message']['content']
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            }
        }
        
        response = jsonify(openai_response)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

app.run(host='0.0.0.0', port=5000, debug=True)