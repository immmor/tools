import sys
from PySide6.QtCore import Qt, QUrl, QPoint, QPropertyAnimation, QEasingCurve, QSequentialAnimationGroup
from PySide6.QtGui import QColor, QPainter, QPen, QLinearGradient, QBrush, QPainterPath
from PySide6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, QWidget, 
                             QLineEdit, QHBoxLayout, QPushButton, QFrame, QGraphicsDropShadowEffect)
from PySide6.QtWebEngineWidgets import QWebEngineView
import ctypes

class WindowEffect:
    @staticmethod
    def set_acrylic(hwnd):
        if sys.platform != "win32": return
        class DATA(ctypes.Structure):
            _fields_ = [("A", ctypes.c_int), ("B", ctypes.p_void_p), ("C", ctypes.c_size_t)]
        accent = ctypes.create_string_buffer(16)
        ctypes.memmove(ctypes.addressof(accent), ctypes.addressof(ctypes.c_int(4)), 4)
        ctypes.memmove(ctypes.addressof(accent)+8, ctypes.addressof(ctypes.c_int(0x201A1A1A)), 4)
        data = DATA(19, ctypes.cast(ctypes.pointer(accent), ctypes.p_void_p), 16)
        ctypes.windll.user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))

class CapsuleBar(QLineEdit):
    """胶囊风格地址栏，带发光动画"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(38)
        self.setPlaceholderText("Search the nebula...")
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet("""
            QLineEdit {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 19px;
                color: #EEE;
                font-family: 'Segoe UI Variable Display';
                font-size: 13px;
                padding: 0 20px;
            }
            QLineEdit:hover {
                background: rgba(255, 255, 255, 0.12);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            QLineEdit:focus {
                background: rgba(255, 255, 255, 1.0);
                color: #111;
                border: 1px solid #0078D4;
            }
        """)

class ArtBrowser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.resize(1200, 800)
        
        # 主布局容器
        self.main_container = QFrame(self)
        self.main_container.setObjectName("Main")
        self.setCentralWidget(self.main_container)
        
        # 整体采用横向布局（左侧导航 + 右侧内容）
        self.root_layout = QHBoxLayout(self.main_container)
        self.root_layout.setContentsMargins(0, 0, 0, 0)
        self.root_layout.setSpacing(0)

        # 1. 侧边栏 (Sidebar) - 极简主义
        self.sidebar = QFrame()
        self.sidebar.setFixedWidth(65)
        self.sidebar.setStyleSheet("background: rgba(0, 0, 0, 0.1); border-right: 1px solid rgba(255,255,255,0.05);")
        side_layout = QVBoxLayout(self.sidebar)
        side_layout.setContentsMargins(0, 20, 0, 20)
        
        # 控制按钮
        self.btn_close = self._create_side_btn("✕", "#FF5F56")
        self.btn_min = self._create_side_btn("─", "#FFBD2E")
        side_layout.addWidget(self.btn_close, 0, Qt.AlignCenter)
        side_layout.addWidget(self.btn_min, 0, Qt.AlignCenter)
        side_layout.addStretch()
        
        self.root_layout.addWidget(self.sidebar)

        # 2. 右侧主体区域
        self.content_area = QWidget()
        self.content_layout = QVBoxLayout(self.content_area)
        self.content_layout.setContentsMargins(20, 15, 20, 20)
        self.content_layout.setSpacing(15)

        # 顶层胶囊导航栏
        self.url_bar = CapsuleBar()
        self.content_layout.addWidget(self.url_bar)

        # 浏览器本体 (放在带圆角的 Frame 里)
        self.browser_frame = QFrame()
        self.browser_frame.setStyleSheet("""
            QFrame { 
                background: white; 
                border-radius: 15px; 
                border: 1px solid rgba(0,0,0,0.1);
            }
        """)
        bf_layout = QVBoxLayout(self.browser_frame)
        bf_layout.setContentsMargins(0,0,0,0)
        
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl("https://www.bing.com"))
        # 强制让浏览器背景透明，配合外层 Frame 的圆角
        self.browser.page().setBackgroundColor(Qt.transparent)
        bf_layout.addWidget(self.browser)
        
        self.content_layout.addWidget(self.browser_frame)
        self.root_layout.addWidget(self.content_area)

        # 应用亚克力
        WindowEffect.set_acrylic(self.winId())
        
        # 按钮事件
        self.btn_close.clicked.connect(self.close)
        self.btn_min.clicked.connect(self.showMinimized)
        self.url_bar.returnPressed.connect(lambda: self.browser.setUrl(QUrl(self.url_bar.text() if "://" in self.url_bar.text() else "https://"+self.url_bar.text())))

    def _create_side_btn(self, text, hover_color):
        btn = QPushButton(text)
        btn.setFixedSize(32, 32)
        btn.setStyleSheet(f"""
            QPushButton {{
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                color: white;
                font-weight: bold;
                border: none;
            }}
            QPushButton:hover {{ background: {hover_color}; }}
        """)
        return btn

    def paintEvent(self, event):
        """绘制高质感的渐变外边框"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 绘制窗口主体的微弱亮边
        path = QPainterPath()
        path.addRoundedRect(self.rect().adjusted(1,1,-1,-1), 15, 15)
        
        gradient = QLinearGradient(0, 0, 0, self.height())
        gradient.setColorAt(0, QColor(255, 255, 255, 50))  # 顶部亮
        gradient.setColorAt(1, QColor(255, 255, 255, 10))  # 底部暗
        
        painter.setPen(QPen(gradient, 1.5))
        painter.drawPath(path)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
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
    # 启用高清图标和抗锯齿
    app.setEffectEnabled(Qt.UI_AnimateCombo, True)
    ex = ArtBrowser()
    ex.show()
    sys.exit(app.exec())