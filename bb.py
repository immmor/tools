import requests
import json

# ==================== 配置区 ====================
API_KEY = "app-hhwZsBKC663BChQVxO13WV4V"          # 在 Dify 应用「访问 API」页面获取
BASE_URL = "http://192.168.19.40/v1"           # 本地部署填 http://localhost/v1
USER_ID = "user_001"                          # 自定义用户标识，需保持一致
IMAGE_PATH = "./Gemini_Generated_Image_r3rnx8r3rnx8r3rn.jpeg"                # 你的图片路径

# 工作流开始节点的变量名，必须和你在 Dify 里定义的完全一致
# 你之前的 DSL 里，开始节点的图片变量名是 "image"
FILE_VARIABLE_NAME = "image"


# ==================== 第一步：上传图片 ====================
def upload_image():
    url = f"{BASE_URL}/files/upload"

    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    files = {
        "file": ("test_form.jpg", open(IMAGE_PATH, "rb"), "image/jpeg")
    }
    data = {
        "user": USER_ID
    }

    response = requests.post(url, headers=headers, files=files, data=data)
    response.raise_for_status()
    result = response.json()

    print(f"[上传成功] file_id: {result['id']}")
    return result["id"]


# ==================== 第二步：运行工作流 ====================
def run_workflow(upload_file_id):
    url = f"{BASE_URL}/workflows/run"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": {
            FILE_VARIABLE_NAME: {
                "type": "image",
                "transfer_method": "local_file",
                "upload_file_id": upload_file_id
            }
        },
        "response_mode": "blocking",   # 阻塞模式，等结果返回
        "user": USER_ID
    }

    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    result = response.json()

    print("\n[工作流执行完成]")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


# ==================== 主流程 ====================
if __name__ == "__main__":
    file_id = upload_image()
    run_workflow(file_id)