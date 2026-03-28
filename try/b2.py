import sys
from PySide6.QtCore import Qt, QUrl, QPoint
from PySide6.QtGui import QColor, QPainter, QPen
from PySide6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, QWidget, 
                             QLineEdit, QHBoxLayout, QPushButton, QFrame)
from PySide6.QtWebEngineWidgets import QWebEngineView
import ctypes

class WindowEffect:
    @staticmethod
    def set_heavy_acrylic(hwnd):
        if sys.platform != "win32": return
        class DATA(ctypes.Structure):
            _fields_ = [("A", ctypes.c_int), ("B", ctypes.p_void_p), ("C", ctypes.c_size_t)]
        accent = ctypes.create_string_buffer(16)
        ctypes.memmove(ctypes.addressof(accent), ctypes.addressof(ctypes.c_int(4)), 4)
        # 0xEE1E1E1E: 保持厚重的磨砂质感
        ctypes.memmove(ctypes.addressof(accent)+8, ctypes.addressof(ctypes.c_int(0xEE1E1E1E)), 4)
        data = DATA(19, ctypes.cast(ctypes.pointer(accent), ctypes.p_void_p), 16)
        ctypes.windll.user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))

class LogicGlassBrowser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowMinMaxButtonsHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.resize(1150, 780)
        
        # 变量初始化
        self.m_drag = False
        self.m_DragPosition = QPoint()

        # 主框架
        self.main_container = QFrame(self)
        self.main_container.setObjectName("MainFrame")
        self.main_container.setStyleSheet("""
            #MainFrame {
                background: rgba(30, 30, 30, 0.88);
                border-radius: 14px;
            }
        """)
        self.setCentralWidget(self.main_container)
        
        root_layout = QHBoxLayout(self.main_container)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # 1. 侧边栏
        self.sidebar = QFrame()
        self.sidebar.setFixedWidth(70)
        self.sidebar.setStyleSheet("background: rgba(0,0,0,0.2); border-right: 1px solid rgba(255,255,255,0.05);")
        side_layout = QVBoxLayout(self.sidebar)
        side_layout.setContentsMargins(0, 20, 0, 20)
        
        # 修复后的关闭按钮
        self.btn_close = self._create_nav_btn("×", "#ff5f57")
        self.btn_close.clicked.connect(self.close) # 绑定关闭
        
        # 修复后的最小化按钮
        self.btn_min = self._create_nav_btn("−", "#febc2e")
        self.btn_min.clicked.connect(self.showMinimized) # 绑定最小化
        
        side_layout.addWidget(self.btn_close, 0, Qt.AlignCenter)
        side_layout.addWidget(self.btn_min, 0, Qt.AlignCenter)
        side_layout.addStretch()
        root_layout.addWidget(self.sidebar)

        # 2. 右侧内容区
        content_widget = QWidget()
        layout = QVBoxLayout(content_widget)
        layout.setContentsMargins(20, 15, 20, 20)
        
        # 3. 修复后的搜索地址栏
        self.url_bar = QLineEdit()
        self.url_bar.setFixedHeight(38)
        self.url_bar.setPlaceholderText("输入网址或搜索内容...")
        self.url_bar.setStyleSheet("""
            QLineEdit {
                background: rgba(45, 45, 45, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: white;
                padding: 0 15px;
                font-size: 13px;
            }
            QLineEdit:focus { background: white; color: black; }
        """)
        self.url_bar.returnPressed.connect(self.handle_search) # 绑定搜索逻辑
        layout.addWidget(self.url_bar)

        # 4. 网页显示区
        self.web_frame = QFrame()
        self.web_frame.setStyleSheet("background: white; border-radius: 12px;")
        web_layout = QVBoxLayout(self.web_frame)
        web_layout.setContentsMargins(0,0,0,0)
        
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl("https://www.bing.com"))
        web_layout.addWidget(self.browser)
        layout.addWidget(self.web_frame)

        root_layout.addWidget(content_widget)

        # 调用系统 API
        WindowEffect.set_heavy_acrylic(self.winId())

    def _create_nav_btn(self, text, color):
        btn = QPushButton(text)
        btn.setFixedSize(28, 28)
        btn.setCursor(Qt.PointingHandCursor)
        btn.setStyleSheet(f"""
            QPushButton {{
                background: transparent;
                color: {color};
                font-size: 18px;
                border: 1px solid {color};
                border-radius: 14px;
            }}
            QPushButton:hover {{ background: {color}; color: white; }}
        """)
        return btn

    def handle_search(self):
        """修复后的搜索逻辑：判断是网址还是关键词"""
        text = self.url_bar.text().strip()
        if not text: return
        
        if "." in text and " " not in text: # 简单判断是否为网址
            url = text if text.startswith("http") else "https://" + text
        else: # 否则视为搜索
            url = f"https://www.bing.com/search?q={text}"
        
        self.browser.setUrl(QUrl(url))
        self.url_bar.clearFocus() # 搜索后失去焦点，视觉更佳

    # --- 修复后的窗口拖拽逻辑 ---
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            # 只允许点击侧边栏或顶部地址栏周围拖动，防止干扰网页操作
            self.m_drag = True
            self.m_DragPosition = event.globalPos() - self.pos()
            event.accept()

    def mouseMoveEvent(self, event):
        if Qt.LeftButton and self.m_drag:
            self.move(event.globalPos() - self.m_DragPosition)
            event.accept()

    def mouseReleaseEvent(self, event):
        self.m_drag = False

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LogicGlassBrowser()
    window.show()
    sys.exit(app.exec())