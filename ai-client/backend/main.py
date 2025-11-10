from fastapi import FastAPI
from pydantic import BaseModel
import requests
import uvicorn

app = FastAPI()

class ChatRequest(BaseModel):
    prompt: str
    api_url: str
    api_key: str
    model: str = "gemini-2.5-flash"

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
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
