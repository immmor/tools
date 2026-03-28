import webview
import os

class WindowAPI:
    def __init__(self):
        self.window = None
        self.is_maximized = False
        
    def set_window(self, window):
        self.window = window
        
    def minimize_window(self):
        if self.window:
            self.window.minimize()
        
    def close_window(self):
        if self.window:
            self.window.destroy()
            import sys
            sys.exit(0)
        
    def toggle_maximize(self):
        if not self.window:
            return
        if self.is_maximized:
            self.window.toggle_fullscreen()
            self.is_maximized = False
        else:
            self.window.toggle_fullscreen()
            self.is_maximized = True
        js_bool = "true" if self.is_maximized else "false"
        self.window.evaluate_js(f'updateMaxButton({js_bool})')

api = WindowAPI()

html_template = '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif;
            background: rgba(28, 28, 28, 0.95);
            height: 100vh;
            display: flex;
            overflow: hidden;
        }
        
        .sidebar {
            width: 70px;
            background: rgba(0, 0, 0, 0.2);
            border-right: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 20px;
        }
        
        .nav-btn {
            width: 26px;
            height: 26px;
            border-radius: 13px;
            border: 1.5px solid;
            background: transparent;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            transition: all 0.2s;
        }
        
        .nav-btn.close { color: #ff5f57; border-color: #ff5f57; }
        .nav-btn.close:hover { background: #ff5f57; color: white; }
        
        .nav-btn.min { color: #febc2e; border-color: #febc2e; }
        .nav-btn.min:hover { background: #febc2e; color: white; }
        
        .nav-btn.max { color: #28c840; border-color: #28c840; }
        .nav-btn.max:hover { background: #28c840; color: white; }
        
        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 15px;
        }
        
        .url-bar {
            height: 35px;
            background: rgba(60, 60, 60, 0.7);
            border: none;
            border-radius: 8px;
            color: white;
            padding: 0 15px;
            font-size: 14px;
            outline: none;
            margin-bottom: 15px;
        }
        
        .url-bar:focus {
            background: white;
            color: black;
        }
        
        .url-bar::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        
        .web-container {
            flex: 1;
            background: black;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .drag-region {
            -webkit-app-region: drag;
        }
        
        .no-drag {
            -webkit-app-region: no-drag;
        }
    </style>
</head>
<body>
    <div class="sidebar drag-region">
        <button class="nav-btn close no-drag" onclick="pywebview.api.close_window()">×</button>
        <button class="nav-btn min no-drag" onclick="pywebview.api.minimize_window()">−</button>
        <button class="nav-btn max no-drag" id="maxBtn" onclick="pywebview.api.toggle_maximize()">□</button>
    </div>
    
    <div class="content">
        <input type="text" class="url-bar no-drag" id="urlBar" placeholder="输入网址或搜索内容..." value="https://www.bilibili.com/video/BV1GJ411x7h7">
        <div class="web-container">
            <iframe id="webframe" src="https://www.bilibili.com/video/BV1GJ411x7h7"></iframe>
        </div>
    </div>
    
    <script>
        var urlBar = document.getElementById('urlBar');
        var webframe = document.getElementById('webframe');
        
        urlBar.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                var text = urlBar.value.trim();
                if (!text) return;
                
                var url = text;
                if (!text.includes('.') || text.includes(' ')) {
                    url = 'https://www.bing.com/search?q=' + encodeURIComponent(text);
                } else if (!text.startsWith('http')) {
                    url = 'https://' + text;
                }
                
                webframe.src = url;
                urlBar.value = url;
            }
        });
        
        webframe.addEventListener('load', function() {
            try {
                urlBar.value = webframe.contentWindow.location.href;
            } catch(e) {}
        });
        
        function updateMaxButton(isMaximized) {
            document.getElementById('maxBtn').innerHTML = isMaximized ? '❐' : '□';
        }
    </script>
</body>
</html>
'''

def start_browser():
    html_file = '/tmp/video_browser.html'
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    window = webview.create_window(
        '视频浏览器',
        html_file,
        width=1100,
        height=750,
        resizable=True,
        background_color='#1c1c1c',
        text_select=True,
        frameless=True,
        js_api=api
    )
    
    api.set_window(window)
    
    webview.start(debug=False)

if __name__ == "__main__":
    start_browser()
