import sys
from PySide6.QtCore import Qt, QUrl
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QFrame
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings

class VideoFixedBrowser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.resize(1100, 750)

        # 获取默认配置
        profile = QWebEngineProfile.defaultProfile()
        
        # --- 核心修复：伪装 User-Agent ---
        profile.setHttpUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        
        settings = profile.settings()
        settings.setAttribute(QWebEngineSettings.PlaybackRequiresUserGesture, False)
        settings.setAttribute(QWebEngineSettings.PluginsEnabled, True)
        settings.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)

        # UI 布局
        container = QFrame(self)
        container.setStyleSheet("background: rgba(30,30,30,0.95); border-radius: 12px;")
        self.setCentralWidget(container)
        
        layout = QVBoxLayout(container)
        self.browser = QWebEngineView()
        
        # 强制 B 站使用 HTML5 模式（通过 URL 参数）
        test_url = "https://www.bilibili.com/video/BV1GJ411x7h7/?high_quality=1"
        self.browser.setUrl(QUrl(test_url))
        
        layout.addWidget(self.browser)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = VideoFixedBrowser()
    window.show()
    sys.exit(app.exec())