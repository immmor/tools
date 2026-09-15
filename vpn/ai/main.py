"""
本地 RAG 知识库（基于 Ollama: qwen2.5:latest + nomic-embed-text）

架构：
  1. 文档摄取：读取 knowledge_base/ 目录下的 .txt/.md/.html/.pdf 文档
  2. 分块：按字符数切分并保留重叠，提升检索精度
  3. 向量化：调用本地 Ollama /api/embeddings 生成句向量（nomic-embed-text）
  4. 索引缓存：向量与文本保存为本地 .pkl，重复构建索引无需重新嵌入
  5. 检索：查询向量与所有块做余弦相似度，取 top-k
  6. 生成：把检索到的上下文拼进 prompt，交给 qwen2.5:latest 回答

用法：
  python main.py build        # 构建/重建向量索引
  python main.py query "你的问题"   # 单次问答
  python main.py chat         # 进入交互式对话（多轮带历史）
  python main.py serve        # 启动 Web 界面（默认 http://localhost:8080）

依赖：
  pip install requests numpy
  # 可选：pip install pypdf   （用于解析 .pdf）
  # 可选：pip install flask    （用于 serve 模式）

需先在本地启动 Ollama 并拉取模型：
  ollama pull qwen2.5:latest
  ollama pull nomic-embed-text
"""

import os
import sys
import json
import pickle
import shutil
import argparse
from typing import List, Dict, Optional

import requests
import numpy as np
import faiss

# ----------------------------- 配置 -----------------------------
OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "qwen2.5:latest")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")

# 知识库目录（可放 .txt/.md/.html/.pdf）
KB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base")
# 索引文件：FAISS 向量索引 + 元数据（文本/来源）
INDEX_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.faiss")
META_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index_meta.pkl")

CHUNK_SIZE = 800          # 每个文本块字符数
CHUNK_OVERLAP = 120       # 块间重叠字符数
TOP_K = 4                 # 检索返回的块数量
SIMILARITY_THRESHOLD = 0.25  # 相似度低于此值视为无相关资料

SYSTEM_PROMPT = (
    "你是一个严谨的中文知识库助手。请只依据下面提供的【参考资料】回答用户问题，"
    "不要编造资料中没有的信息。如果参考资料不足以回答问题，请明确说明“资料中没有相关信息”。"
    "回答尽量简洁、有条理，必要时使用分点。"
)


# ----------------------------- Ollama 接口 -----------------------------
def _post(path: str, payload: dict) -> dict:
    """调用 Ollama 本地 API，失败时给出友好提示。"""
    try:
        resp = requests.post(f"{OLLAMA_BASE}{path}", json=payload, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        raise SystemExit(
            f"无法连接 Ollama（{OLLAMA_BASE}）。\n"
            "请先启动 Ollama 并确保模型已拉取：\n"
            f"  ollama pull {CHAT_MODEL}\n"
            f"  ollama pull {EMBED_MODEL}"
        )


def get_embedding(text: str) -> List[float]:
    """用本地 Ollama 生成单个文本的向量。"""
    data = _post("/api/embeddings", {"model": EMBED_MODEL, "prompt": text})
    return data["embedding"]


def chat(messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
    """调用 qwen2.5:latest 生成回答。"""
    data = _post(
        "/api/chat",
        {
            "model": CHAT_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        },
    )
    return data["message"]["content"].strip()


# ----------------------------- 文档处理 -----------------------------
def _read_text(path: str) -> str:
    """读取纯文本类文件。"""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def _read_pdf(path: str) -> str:
    """读取 PDF（需 pypdf）。"""
    try:
        from pypdf import PdfReader
    except ImportError:
        print(f"  [跳过] 未安装 pypdf，无法解析 PDF：{os.path.basename(path)}（pip install pypdf）")
        return ""
    reader = PdfReader(path)
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def load_documents() -> List[Dict[str, str]]:
    """从知识库目录加载所有文档，返回 [{source, text}]。"""
    if not os.path.isdir(KB_DIR):
        os.makedirs(KB_DIR, exist_ok=True)
        print(f"已创建知识库目录：{KB_DIR}\n请将文档放入该目录后重新运行 build。")
        return []

    docs = []
    handlers = {
        (".txt", ".md", ".py"): _read_text,
        (".html", ".htm"): lambda p: _read_text(p),  # 简单读取，保留可见文字
        (".pdf",): _read_pdf,
    }
    for name in sorted(os.listdir(KB_DIR)):
        full = os.path.join(KB_DIR, name)
        if not os.path.isfile(full):
            continue
        ext = os.path.splitext(name)[1].lower()
        reader = next((r for exts, r in handlers.items() if ext in exts), None)
        if reader is None:
            continue
        text = reader(full)
        if text.strip():
            docs.append({"source": name, "text": text})
            print(f"  [已加载] {name}  ({len(text)} 字符)")
    return docs


def chunk_text(text: str, source: str) -> List[Dict[str, str]]:
    """将长文本切成带重叠的块。"""
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        piece = text[start:end].strip()
        if piece:
            chunks.append({"source": source, "text": piece})
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


# ----------------------------- 索引构建 -----------------------------
def build_index(force: bool = False):
    """构建并缓存 FAISS 向量索引 + 元数据。"""
    docs = load_documents()
    if not docs:
        return None, []

    chunks = []
    for d in docs:
        chunks.extend(chunk_text(d["text"], d["source"]))

    print(f"共切分为 {len(chunks)} 个文本块，开始生成向量（可能需要一会儿）...")
    embeddings = []
    for i, c in enumerate(chunks, 1):
        embeddings.append(get_embedding(c["text"]))
        if i % 10 == 0 or i == len(chunks):
            print(f"  向量化进度：{i}/{len(chunks)}")

    # 归一化后用内积 = 余弦相似度
    mat = np.array(embeddings, dtype="float32")
    faiss.normalize_L2(mat)
    index = faiss.IndexFlatIP(mat.shape[1])
    index.add(mat)

    faiss.write_index(index, INDEX_FILE)
    # 向量交给 FAISS，文本/来源单独存元数据
    meta = [{"source": c["source"], "text": c["text"]} for c in chunks]
    with open(META_FILE, "wb") as f:
        pickle.dump(meta, f)
    print(f"索引已保存：{INDEX_FILE}（{len(meta)} 块）")
    return index, meta


def load_index():
    """加载已缓存的索引；不存在则自动构建。返回 (faiss_index, meta)。"""
    if not (os.path.isfile(INDEX_FILE) and os.path.isfile(META_FILE)):
        print("未找到索引缓存，自动构建中...")
        return build_index()
    index = faiss.read_index(INDEX_FILE)
    with open(META_FILE, "rb") as f:
        meta = pickle.load(f)
    return index, meta


# ----------------------------- 检索与问答 -----------------------------
def retrieve(index, meta: List[Dict], query: str, top_k: int = TOP_K) -> List[Dict]:
    """用 FAISS 做余弦相似度检索，返回最相关的文本块。"""
    q = np.array(get_embedding(query), dtype="float32").reshape(1, -1)
    faiss.normalize_L2(q)
    scores, ids = index.search(q, top_k)
    scores, ids = scores[0], ids[0]
    hits = []
    for s, idx in zip(scores, ids):
        if idx == -1 or s < SIMILARITY_THRESHOLD:
            continue
        hits.append({**meta[idx], "score": round(float(s), 3)})
    return hits


# 严格模式：检索不到相关资料时，直接返回固定拒答，不调用 LLM（防幻觉）
NO_DATA_REPLY = "抱歉，知识库中暂无相关内容，无法回答。如有需要可联系人工客服。"


def answer(index, meta: List[Dict], query: str, history: Optional[List[Dict]] = None) -> str:
    """基于检索结果生成回答。严格模式：无相关资料则直接拒答，不调模型。"""
    hits = retrieve(index, meta, query)
    if not hits:
        print("\n（严格模式：未检索到相关资料，已直接拒答，未调用模型）")
        return NO_DATA_REPLY

    context = "\n\n".join(
        f"【资料 {i + 1}｜来源：{h['source']}｜相似度：{h['score']}】\n{h['text']}"
        for i, h in enumerate(hits)
    )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({
        "role": "user",
        "content": f"【参考资料】\n{context}\n\n【问题】{query}",
    })

    return chat(messages)


# ----------------------------- 交互模式 -----------------------------
def interactive_chat():
    chunks = load_index()
    if not chunks[1]:
        print("知识库为空，请先放入文档并 build。")
        return
    index, meta = chunks
    print("进入对话模式（输入 exit / quit 退出）：")
    history: List[Dict] = []
    while True:
        try:
            q = input("\n你：").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见。")
            break
        if not q:
            continue
        if q.lower() in ("exit", "quit"):
            print("再见。")
            break
        reply = answer(index, meta, q, history)
        history.append({"role": "user", "content": q})
        history.append({"role": "assistant", "content": reply})
        # 控制历史长度，避免越积越长
        if len(history) > 8:
            history = history[-8:]
        print(f"\n助手：{reply}")


# ----------------------------- Web 界面（serve） -----------------------------
def serve():
    try:
        from flask import Flask, request, jsonify, send_from_directory
        from flask_cors import CORS
    except ImportError:
        raise SystemExit("serve 模式需要 flask：pip install flask flask-cors")

    app = Flask(__name__)
    CORS(app, origins=["*"])
    chunks_cache = {"data": None}

    @app.route("/")
    def index():
        return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "web.html")

    @app.route("/api/query", methods=["POST", "OPTIONS"])
    def api_query():
        if request.method == "OPTIONS":
            return ("", 204)
        if chunks_cache["data"] is None:
            chunks_cache["data"] = load_index()
        data = request.get_json(silent=True) or {}
        q = (data.get("query") or "").strip()
        if not q:
            return jsonify({"error": "query 不能为空"}), 400
        if not chunks_cache["data"][1]:
            return jsonify({"error": "知识库为空，请先 build"}), 400
        index, meta = chunks_cache["data"]
        hits = retrieve(index, meta, q)
        reply = answer(index, meta, q)
        return jsonify({
            "answer": reply,
            "sources": [{"source": h["source"], "score": h["score"]} for h in hits],
        })

    print("RAG Web 服务已启动：http://localhost:8080")
    app.run(host="0.0.0.0", port=8080, debug=False)


# ----------------------------- 命令行入口 -----------------------------
def main():
    parser = argparse.ArgumentParser(description="本地 RAG 知识库（Ollama + qwen2.5:latest）")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("build", help="构建/重建向量索引")
    p_query = sub.add_parser("query", help="单次问答")
    p_query.add_argument("question", help="你的问题")
    sub.add_parser("chat", help="交互式多轮对话")
    sub.add_parser("serve", help="启动 Web 界面（:8080）")

    args = parser.parse_args()

    if args.cmd == "build":
        build_index()
    elif args.cmd == "query":
        index, meta = load_index()
        if not meta:
            print("知识库为空，请先放入文档并 build。")
            return
        print(answer(index, meta, args.question))
    elif args.cmd == "chat":
        interactive_chat()
    elif args.cmd == "serve":
        serve()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
