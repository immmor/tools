# -*- coding: utf-8 -*-
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
import onnxruntime as rt

# ============================================================
# 0. 阈值配置（5 类训练，靠阈值拒识“其他”）
# ============================================================
LOW_CONF = 0.30    # 低于此值 -> 其他
HIGH_CONF = 0.45   # 高于此值 -> 高置信

# ============================================================
# 1. 读取数据（只含 5 个真实意图）
# ============================================================
df = pd.read_csv("intent_data.csv", encoding="utf-8")
print(f"总数据量: {len(df)} 条")
print(f"类别分布:\n{df['intent'].value_counts()}")

texts = df["text"].tolist()
labels = df["intent"].tolist()

X_train, X_test, y_train, y_test = train_test_split(
    texts, labels, test_size=0.2, random_state=42, stratify=labels
)
print(f"\n训练集: {len(X_train)} 条, 测试集: {len(X_test)} 条")

# ============================================================
# 2. Pipeline：字符级 TF-IDF + 逻辑回归
# ============================================================
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(
        analyzer='char',
        ngram_range=(1, 3),
        max_features=5000,
        min_df=1
    )),
    ('clf', LogisticRegression(
        C=1.0,
        class_weight='balanced',
        max_iter=1000,
        solver='lbfgs'
    ))
])

pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
print("\n=== 分类报告（5 类真实意图）===")
print(classification_report(y_test, y_pred, zero_division=0))

classes = pipeline.named_steps['clf'].classes_
print("类别顺序（前端 CLASSES 必须一致）:", list(classes))

# ============================================================
# 3. 导出 ONNX，关闭 ZipMap
# ============================================================
initial_type = [('text_input', StringTensorType([None, 1]))]
onnx_model = convert_sklearn(
    pipeline,
    initial_types=initial_type,
    target_opset=12,
    options={id(pipeline): {'zipmap': False}}
)

onnx_path = "taobao_intent.onnx"
with open(onnx_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"\nONNX 模型已保存: {onnx_path}")

# ============================================================
# 4. 交叉验证：sklearn vs ONNX
# ============================================================
sess = rt.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
input_name = sess.get_inputs()[0].name
output_names = [o.name for o in sess.get_outputs()]

sk_preds = pipeline.predict(X_test)
onnx_preds = []
for text in X_test:
    input_data = np.array([[text]], dtype=object)
    outputs = sess.run(output_names, {input_name: input_data})
    onnx_preds.append(outputs[0][0])

sk_preds = np.array(sk_preds)
onnx_preds = np.array(onnx_preds)
match = np.mean(sk_preds == onnx_preds)
print(f"\n=== sklearn vs ONNX 一致性: {match * 100:.1f}% ===")
if match < 1.0:
    for t, s, o in zip(X_test, sk_preds, onnx_preds):
        if s != o:
            print(f"  不一致: {t} | sklearn: {s} | onnx: {o}")
else:
    print("完全一致，导出无误。")

# ============================================================
# 5. 阈值评估：真实意图 vs 杂句的最高概率
# ============================================================
def get_max_prob(text):
    input_data = np.array([[text]], dtype=object)
    outputs = sess.run(output_names, {input_name: input_data})
    probs = np.array(outputs[1][0], dtype=float)
    return float(np.max(probs))

print("\n=== 真实意图样本最高概率 ===")
real_probs = []
for t in X_test:
    p = get_max_prob(t)
    real_probs.append(p)
    print(f"  {t}: {p:.3f}")
print(f"  均值: {np.mean(real_probs):.3f}, 最低: {np.min(real_probs):.3f}")

other_queries = [
    "今天天气怎么样", "你是机器人吗", "哈哈哈哈", "123456",
    "asdfgh", "你是谁", "随便看看", "没什么事", "我不太清楚",
    "等一下再说", "这个怎么弄", "？？？", "……", "好的收到",
    "嗯", "哦哦", "行吧", "知道了谢谢", "再见", "拜拜",
]
print("\n=== 杂句样本最高概率 ===")
other_probs = []
for t in other_queries:
    p = get_max_prob(t)
    other_probs.append(p)
    print(f"  {t}: {p:.3f}")
print(f"  均值: {np.mean(other_probs):.3f}, 最高: {np.max(other_probs):.3f}")

# ============================================================
# 6. 最终验证：分级置信度
# ============================================================
print("\n=== 最终推理验证 ===")
test_queries = [
    "快递三天了还没动", "我要退钱", "这个有M码吗",
    "我要找你们领导投诉", "你好在吗",
    "今天天气怎么样", "你是机器人吗", "哈哈哈哈",
    "123456", "这个怎么弄", "随便看看",
]

for q in test_queries:
    input_data = np.array([[q]], dtype=object)
    outputs = sess.run(output_names, {input_name: input_data})

    model_intent = outputs[0][0]
    probs = np.array(outputs[1][0], dtype=float)
    max_prob = float(np.max(probs))

    if max_prob < LOW_CONF:
        final_intent = "其他"
        level = "拒识"
    elif max_prob < HIGH_CONF:
        final_intent = model_intent
        level = "低置信"
    else:
        final_intent = model_intent
        level = "高置信"

    print(f"\n输入: {q}")
    print(f"  最终意图: {final_intent} [{level}] (最高概率 {max_prob:.3f})")
    print(f"  各类概率: {dict(zip(classes, np.round(probs, 3)))}")