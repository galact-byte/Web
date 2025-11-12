from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import uvicorn
import os, sys, traceback, datetime

app = FastAPI()

# ============ 日志辅助函数 ============
def _write_crash_log(msg: str):
    """写入后端崩溃日志"""
    try:
        base = os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else __file__)
        log_path = os.path.join(base, "api-server.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass

# 启用CORS（跨域支持）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str
    api_url: str
    api_key: str
    model: str = "gemini-2.5-flash"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(req: ChatRequest):
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": req.model,
        "messages": [
            {"role": "system", "content": "你是一个有帮助的AI助手"},
            {"role": "user", "content": req.prompt}
        ],
        "max_tokens": 500
    }
    try:
        res = requests.post(req.api_url, headers=headers, json=data, timeout=60)
        res.raise_for_status()
        j = res.json()
        if "choices" in j:
            content = j["choices"][0]["message"]["content"]
        elif "output" in j:
            content = j["output"]
        else:
            content = str(j)
        return {"reply": content}
    except Exception as e:
        _write_crash_log(f"❌ Chat 调用错误: {repr(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    try:
        _write_crash_log("✅ uvicorn 正在启动 (127.0.0.1:8000)")
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception:
        _write_crash_log("💥 后端崩溃:\n" + traceback.format_exc())
        raise
