import sys
import os
from PySide6.QtCore import Qt, QUrl, QPoint
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, QWidget, 
                             QLineEdit, QHBoxLayout, QPushButton, QFrame)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings

# 针对 Mac 和 Linux 的视频兼容性注入
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--no-sandbox --enable-gpu-rasterization --ignore-gpu-blocklist --enable-features=VaapiVideoDecoder,VaapiVideoEncoder"
os.environ["QTWEBENGINE_DISABLE_SANDBOX"] = "1"

class FinalVideoBrowser(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # 1. 窗口样式：无边框 + 半透明
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowMinMaxButtonsHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.resize(1100, 750)
        
        # 2. 核心设置：开启视频播放权限
        profile = QWebEngineProfile.defaultProfile()
        
        # 伪装 User-Agent，模拟真实浏览器
        profile.setHttpUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        settings = profile.settings()
        # 允许插件、自动播放、硬件加速
        settings.setAttribute(QWebEngineSettings.PluginsEnabled, True)
        settings.setAttribute(QWebEngineSettings.PlaybackRequiresUserGesture, False)
        settings.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.FullScreenSupportEnabled, True)
        settings.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        
        # 设置额外的 WebGL 和媒体配置
        settings.setAttribute(QWebEngineSettings.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
        
        # 3. 界面布局
        self.main_container = QFrame(self)
        self.main_container.setObjectName("Main")
        # Mac 上 0.95 的透明度配合深色背景很有质感
        self.main_container.setStyleSheet("""
            #Main {
                background: rgba(28, 28, 28, 0.95);
                border-radius: 12px;
                border: 0.5px solid rgba(255, 255, 255, 0.15);
            }
        """)
        self.setCentralWidget(self.main_container)
        
        layout = QHBoxLayout(self.main_container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 侧边栏逻辑修复
        self.sidebar = QFrame()
        self.sidebar.setFixedWidth(70)
        self.sidebar.setStyleSheet("background: rgba(0,0,0,0.2); border-right: 1px solid rgba(255,255,255,0.05);")
        side_layout = QVBoxLayout(self.sidebar)
        side_layout.setContentsMargins(0, 20, 0, 20)
        
        self.btn_close = self._create_nav_btn("×", "#ff5f57")
        self.btn_close.clicked.connect(self.close)
        self.btn_min = self._create_nav_btn("−", "#febc2e")
        self.btn_min.clicked.connect(self.showMinimized)
        
        side_layout.addWidget(self.btn_close, 0, Qt.AlignCenter)
        side_layout.addWidget(self.btn_min, 0, Qt.AlignCenter)
        side_layout.addStretch()
        layout.addWidget(self.sidebar)

        # 内容区
        content_widget = QWidget()
        right_layout = QVBoxLayout(content_widget)
        right_layout.setContentsMargins(15, 15, 15, 15)
        
        # 地址栏
        self.url_bar = QLineEdit()
        self.url_bar.setFixedHeight(35)
        self.url_bar.setPlaceholderText("输入网址或搜索内容...")
        self.url_bar.setStyleSheet("""
            QLineEdit {
                background: rgba(60, 60, 60, 0.7);
                border-radius: 8px;
                color: white;
                padding: 0 10px;
                border: none;
            }
            QLineEdit:focus { background: white; color: black; }
        """)
        self.url_bar.returnPressed.connect(self.handle_search)
        right_layout.addWidget(self.url_bar)

        # 视频播放容器 (黑色底色防止闪烁)
        self.web_frame = QFrame()
        self.web_frame.setStyleSheet("background: black; border-radius: 10px;")
        web_layout = QVBoxLayout(self.web_frame)
        web_layout.setContentsMargins(0,0,0,0)
        
        self.browser = QWebEngineView()
        # 直接默认播放一个 Bilibili 视频页面进行测试
        test_url = "https://www.bilibili.com/video/BV1GJ411x7h7/?p=1&high_quality=1&as_wide=1" 
        self.browser.setUrl(QUrl(test_url))
        self.url_bar.setText(test_url)
        
        web_layout.addWidget(self.browser)
        right_layout.addWidget(self.web_frame)

        layout.addWidget(content_widget)

    def _create_nav_btn(self, text, color):
        btn = QPushButton(text)
        btn.setFixedSize(26, 26)
        btn.setCursor(Qt.PointingHandCursor)
        btn.setStyleSheet(f"""
            QPushButton {{
                background: transparent; color: {color}; 
                font-size: 18px; border: 1.5px solid {color}; border-radius: 13px;
            }}
            QPushButton:hover {{ background: {color}; color: white; }}
        """)
        return btn

    def handle_search(self):
        text = self.url_bar.text().strip()
        if not text: return
        url = text if "." in text and " " not in text else f"https://www.bing.com/search?q={text}"
        if not url.startswith("http"): url = "https://" + url
        self.browser.setUrl(QUrl(url))

    # 窗口拖拽
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.m_drag = True
            self.m_pos = event.globalPos() - self.pos()
    def mouseMoveEvent(self, event):
        if hasattr(self, 'm_drag') and self.m_drag:
            self.move(event.globalPos() - self.m_pos)
    def mouseReleaseEvent(self, event):
        self.m_drag = False

if __name__ == "__main__":
    # 解决部分 Mac 环境下的 OpenGL 渲染问题
    app = QApplication(sys.argv)
    
    # 全局字体美化
    font = app.font()
    font.setFamily("PingFang SC")
    app.setFont(font)
    
    window = FinalVideoBrowser()
    window.show()
    sys.exit(app.exec())