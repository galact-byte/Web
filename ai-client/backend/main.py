from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import uvicorn
import os, sys, traceback, datetime
import logging
from typing import List

app = FastAPI()

# ============ 日志配置 ============
LOG_MESSAGES = []  # 内存中保存最近的日志
MAX_LOGS = 1000  # 最多保存1000条日志
LOG_FILE_PATH = None  # 全局日志文件路径

class LogCapture(logging.Handler):
    """自定义日志处理器，捕获日志到内存"""
    def emit(self, record):
        try:
            msg = self.format(record)
            LOG_MESSAGES.append({
                "time": datetime.datetime.now().isoformat(),
                "level": record.levelname,
                "message": msg
            })
            # 保持日志数量在限制内
            if len(LOG_MESSAGES) > MAX_LOGS:
                LOG_MESSAGES.pop(0)
        except Exception:
            pass

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 添加内存日志处理器
log_capture = LogCapture()
log_capture.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s'))
logger.addHandler(log_capture)

# 同时写入文件（按日期命名，方便管理）
try:
    base = os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else __file__)
    logs_dir = os.path.join(base, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    
    # 日志文件按日期命名
    date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    LOG_FILE_PATH = os.path.join(logs_dir, f"api-server-{date_str}.log")
    
    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding='utf-8')
    file_handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s'))
    logger.addHandler(file_handler)
    logger.info(f"日志文件位置: {LOG_FILE_PATH}")
    logger.info(f"日志目录: {logs_dir}")
except Exception as e:
    logger.warning(f"无法创建日志文件: {e}")

# ============ CORS配置 ============
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 数据模型 ============
class ChatRequest(BaseModel):
    prompt: str
    api_url: str
    api_key: str
    model: str = "gemini-2.5-flash"

class LogEntry(BaseModel):
    time: str
    level: str
    message: str

# ============ API端点 ============
@app.get("/health")
def health():
    """健康检查"""
    logger.info("健康检查请求")
    return {"status": "ok", "timestamp": datetime.datetime.now().isoformat()}

@app.get("/logs")
def get_logs(limit: int = 100) -> List[LogEntry]:
    """获取最近的日志"""
    logger.info(f"获取日志请求，限制: {limit}")
    return LOG_MESSAGES[-limit:] if limit > 0 else LOG_MESSAGES

@app.post("/chat")
def chat(req: ChatRequest):
    """聊天接口"""
    logger.info(f"收到聊天请求，模型: {req.model}")
    logger.debug(f"API URL: {req.api_url[:50]}...")
    
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
        logger.info("正在调用远程API...")
        res = requests.post(req.api_url, headers=headers, json=data, timeout=60)
        res.raise_for_status()
        
        j = res.json()
        logger.debug(f"API响应: {str(j)[:100]}...")
        
        # 解析响应
        if "choices" in j:
            content = j["choices"][0]["message"]["content"]
        elif "output" in j:
            content = j["output"]
        elif "content" in j:
            content = j["content"]
        else:
            content = str(j)
        
        logger.info(f"成功获取响应，长度: {len(content)} 字符")
        return {"reply": content}
        
    except requests.exceptions.Timeout:
        error_msg = "请求超时，请检查网络连接"
        logger.error(error_msg)
        return {"error": error_msg}
    
    except requests.exceptions.ConnectionError:
        error_msg = "连接失败，请检查API URL是否正确"
        logger.error(error_msg)
        return {"error": error_msg}
    
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP错误: {e.response.status_code} - {e.response.text[:200]}"
        logger.error(error_msg)
        return {"error": error_msg}
    
    except Exception as e:
        error_msg = f"未知错误: {repr(e)}"
        logger.error(error_msg)
        logger.debug(traceback.format_exc())
        return {"error": error_msg}

# ============ 启动 ============
if __name__ == "__main__":
    try:
        logger.info("=" * 50)
        logger.info("🚀 AI客户端后端服务启动")
        logger.info(f"监听地址: http://127.0.0.1:8000")
        logger.info(f"Python版本: {sys.version}")
        logger.info("=" * 50)
        
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
        
    except Exception as e:
        logger.critical(f"💥 后端启动失败: {repr(e)}")
        logger.critical(traceback.format_exc())
        raise