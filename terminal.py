from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import subprocess
import threading
import time

app = Flask(__name__)
CORS(app, origins=["*"])
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/api/terminal/execute', methods=['POST'])
def execute_command():
    try:
        data = request.get_json()
        command = data['command']
        mode = data.get('mode', 'local')
        
        if mode == 'local':
            process = subprocess.Popen(
                command, 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT,
                text=True,
                cwd=None,  # 使用当前工作目录
                env=None   # 继承当前环境变量
            )
            
            output = process.communicate()[0]
            return jsonify({
                'output': output,
                'returncode': process.returncode
            })
        else:
            return jsonify({
                'output': f"Pyodide模式暂不支持",
                'returncode': 0
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('execute_command')
def handle_execute_command(data):
    try:
        command = data['command']
        mode = data.get('mode', 'local')
        
        if mode == 'local':
            process = subprocess.Popen(
                command, 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT,
                text=True,
                cwd=None,  # 使用当前工作目录
                env=None   # 继承当前环境变量
            )
            
            for line in iter(process.stdout.readline, ''):
                if line:
                    emit('command_output', {'output': line.rstrip()})  # 保留换行符
            
            process.wait()
            emit('command_complete', {'returncode': process.returncode})
        else:
            emit('command_output', {'output': f"Pyodide模式执行: {command}"})
            emit('command_complete', {'returncode': 0})
            
    except Exception as e:
        emit('command_error', {'error': str(e)})

socketio.run(app, host='0.0.0.0', port=5001, debug=True)