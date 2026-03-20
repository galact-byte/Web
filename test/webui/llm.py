import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests as http

# ---------------------------------------------------------------------------
#  国标审计标准加载
# ---------------------------------------------------------------------------

_STANDARDS_DIR = os.path.join(os.path.dirname(__file__), "standards")


def _load_standard(language: str) -> str:
    """根据语言加载对应的国标审计标准，用于嵌入 prompt。"""
    # 通用标准始终加载
    general = os.path.join(_STANDARDS_DIR, "GB∕T 39412-2020.txt")
    text = ""
    if os.path.exists(general):
        with open(general, "r", encoding="utf-8") as f:
            text = f.read()

    # 语言特定标准
    lang = language.lower() if language else ""
    lang_files = {
        "java":  "GB∕T 34944-2017 Java.txt",
        "c":     "GB∕T  34943-2017 C-C++.txt",
        "c++":   "GB∕T  34943-2017 C-C++.txt",
        "c/c++": "GB∕T  34943-2017 C-C++.txt",
        "c#":    "GB∕T 34946-2017 C#.txt",
    }
    for key, fname in lang_files.items():
        if key in lang:
            path = os.path.join(_STANDARDS_DIR, fname)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    text += "\n\n" + f.read()
            break

    return text


# ---------------------------------------------------------------------------
#  Prompt 模板
# ---------------------------------------------------------------------------

AUDIT_PROMPT = """你是一位资深的代码安全审计专家，精通 GB/T 39412-2020《信息安全技术 代码安全审计规范》。

审计依据：
- GB/T 39412-2020 信息安全技术 代码安全审计规范
- OWASP Top 10 2021
- CWE（Common Weakness Enumeration）
{lang_standard}
{standard_text}
代码语言: {language}

```
{code}
```

请按以下格式输出审计报告：

## 总体评估
给出代码的整体安全等级（安全/低风险/中风险/高风险/严重）和简要总结。

## 发现的安全问题
对每个问题用 ### 标题列出，包括：
- **漏洞分类**：标准条款编号及名称（如"39412-A.1.4 SQL注入"、"39412-A.14.1 硬编码密码"）
- **问题描述**：简要说明
- **风险等级**：严重/高/中/低/信息
- **问题位置**：指出具体代码行或函数
- **详细分析**：解释为什么这是一个安全问题
- **修复建议**：给出具体的修复方案和示例代码

## 安全建议
给出改善代码安全性的整体建议。

如果代码没有明显安全问题，也请说明已检查的安全维度。"""

CHUNK_AUDIT_PROMPT = """你是一位资深的代码安全审计专家，精通 GB/T 39412-2020。这是一个大型项目的分批审计（第 {chunk_idx}/{total_chunks} 批）。

审计依据：GB/T 39412-2020、OWASP Top 10 2021、CWE。
{lang_standard}

GB/T 39412-2020 分类参考：
A.1 输入验证（缓冲区溢出/SQL注入/命令注入/XPath注入等）
A.2 输出编码（XSS/响应拆分/HTTP头注入）
A.3 访问控制（直接对象引用/权限提升）
A.4 加密保护（弱加密算法/密钥管理/明文传输）
A.5 错误处理（信息泄露/堆栈外泄）
A.6 日志记录（敏感信息写入日志）
A.7 会话管理（会话固定/令牌生成）
A.8 资源管理（内存泄漏/连接泄漏）
A.9 配置管理（不安全默认配置/明文存储）
A.10 网络通信（明文协议/证书验证缺失）
A.11 系统接口（命令执行/文件包含）
A.14 其他通用（硬编码密码/危险函数/不安全反序列化）

代码语言: {language}

```
{code}
```

请直接列出发现的安全问题，每个问题用 ### 标题列出，包括：
- **漏洞分类**：标准条款编号及名称（如"39412-A.1.4 SQL注入"）
- **问题描述**
- **风险等级**：严重/高/中/低/信息
- **问题位置**：文件名和代码位置
- **详细分析**
- **修复建议**

如果这部分代码没有发现安全问题，回复"本批次未发现安全问题"即可，不要展开。"""

MERGE_PROMPT = """你是一位资深的代码安全审计专家。以下是对一个大型项目分批审计后的所有结果，请整合为一份完整报告。

{chunk_results}

请按以下格式输出最终审计报告（去重、按风险等级从高到低排序）：

## 总体评估
给出代码的整体安全等级（安全/低风险/中风险/高风险/严重）和简要总结。说明本次审计共分 {total_chunks} 批完成。

## 发现的安全问题
合并去重后，按风险等级排序。每个问题用 ### 标题列出，包括：
- **漏洞分类**：标准条款编号及名称
- **问题描述**
- **风险等级**：严重/高/中/低/信息
- **问题位置**
- **详细分析**
- **修复建议**

## 安全建议
给出改善代码安全性的整体建议。"""

# 单次审计上限，超过则自动分批（~75K tokens）
CHUNK_SIZE = 300 * 1024


def _split_into_chunks(code: str, chunk_size: int = CHUNK_SIZE) -> list:
    """按文件边界（// ===== path =====）将代码拆分为多个批次。"""
    parts = re.split(r"(?=// ===== .+ =====\n)", code)
    parts = [p for p in parts if p.strip()]

    if not parts:
        parts = [code]

    chunks = []
    current = ""
    for part in parts:
        if len(current) + len(part) > chunk_size and current:
            chunks.append(current)
            current = part
        else:
            current += part
    if current:
        chunks.append(current)

    return chunks if chunks else [code]


class LLMClient:
    """统一的 LLM API 客户端，支持 OpenAI 兼容接口和 Anthropic 原生接口。"""

    def __init__(self, provider: str, api_key: str, base_url: str = "", model: str = "", max_workers: int = 3):
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.model = model
        self.max_workers = max(1, max_workers)

    def audit_code(self, code: str, language: str = "auto", on_progress=None, chunk_size: int = None) -> str:
        """审计代码。小代码单次完成，大代码自动分批并发审计后汇总。"""
        if chunk_size is None:
            chunk_size = CHUNK_SIZE

        lang_standard = ""
        lang_lower = language.lower() if language else ""
        if "java" in lang_lower:
            lang_standard = "- GB/T 34944-2017 Java语言源代码漏洞测试规范"
        elif "c++" in lang_lower or lang_lower in ("c", "c/c++"):
            lang_standard = "- GB/T 34943-2017 C/C++语言源代码漏洞测试规范"
        elif "c#" in lang_lower:
            lang_standard = "- GB/T 34946-2017 C#语言源代码漏洞测试规范"

        if len(code) <= chunk_size:
            # 单次审计：嵌入完整国标条款文本，帮助 LLM 准确分类
            standard_text = _load_standard(language)
            if on_progress:
                on_progress(1, 1)
            prompt = AUDIT_PROMPT.format(
                language=language, code=code,
                lang_standard=lang_standard,
                standard_text=standard_text,
            )
            return self._call(prompt)

        # 分批并发审计
        chunks = _split_into_chunks(code, chunk_size)
        total = len(chunks)
        partial_results = [None] * total

        def audit_chunk(idx, chunk):
            prompt = CHUNK_AUDIT_PROMPT.format(
                chunk_idx=idx + 1, total_chunks=total,
                language=language, code=chunk,
                lang_standard=lang_standard,
            )
            return self._call(prompt)

        workers = min(self.max_workers, total)
        completed_count = 0

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(audit_chunk, i, chunk): i
                for i, chunk in enumerate(chunks)
            }
            for future in as_completed(futures):
                idx = futures[future]
                result = future.result()
                partial_results[idx] = f"### 第 {idx + 1}/{total} 批次\n\n{result}"
                completed_count += 1
                if on_progress:
                    on_progress(completed_count, total)

        # 汇总所有批次结果
        if on_progress:
            on_progress(total, total, merging=True)
        all_results = "\n\n---\n\n".join(partial_results)
        merge_prompt = MERGE_PROMPT.format(
            chunk_results=all_results, total_chunks=total,
        )
        return self._call(merge_prompt, max_tokens=8192)

    def test_connection(self) -> str:
        """发送一条极短的请求来验证 API 连通性，返回模型回复。"""
        return self._call("回复 OK 即可。")

    def _call(self, prompt: str, max_tokens: int = 4096) -> str:
        if self.provider == "anthropic":
            return self._call_anthropic(prompt, max_tokens)
        return self._call_openai(prompt, max_tokens)

    # -- OpenAI 兼容 ----------------------------------------------------------

    def _call_openai(self, prompt: str, max_tokens: int = 4096) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一位专业的代码安全审计专家。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": max_tokens,
        }
        resp = http.post(url, headers=headers, json=body, timeout=300)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    # -- Anthropic -------------------------------------------------------------

    def _call_anthropic(self, prompt: str, max_tokens: int = 4096) -> str:
        url = "https://api.anthropic.com/v1/messages"
        if self.base_url and "anthropic" in self.base_url:
            url = self.base_url.rstrip("/")
            if not url.endswith("/messages"):
                url += "/messages" if url.endswith("/v1") else "/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model or "claude-sonnet-4-20250514",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = http.post(url, headers=headers, json=body, timeout=300)
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]
