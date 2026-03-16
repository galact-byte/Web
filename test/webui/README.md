# CodeAudit WebUI

轻量级代码安全审计工具。通过调用大模型 API 对代码进行自动化安全审计，生成详细的审计报告并支持导出。

## 功能

- 粘贴或上传代码文件，一键发起安全审计
- 支持 OpenAI 兼容接口（OpenAI / DeepSeek / 通义千问等）和 Anthropic Claude
- 审计记录管理，按状态筛选
- 报告导出（Markdown / HTML）
- 可视化的风险等级标识

## 环境要求

- Python 3.8+
- MySQL 5.7+

## 快速开始

### 1. 启动 MySQL

确保 MySQL 服务已运行。默认连接配置为 `root:root@localhost:3306`，如需修改请编辑 `config.py`。

### 2. 启动应用

**方式一：双击启动脚本**

```
start.bat
```

脚本会自动检查 Python、依赖包和 MySQL 连接。

**方式二：手动启动**

```bash
pip install -r requirements.txt
python app.py
```

### 3. 使用

1. 浏览器打开 `http://localhost:5000`
2. 进入「设置」，填写 API 提供商、密钥和模型名称，点击「测试连接」确认
3. 进入「新建审计」，粘贴代码或上传文件，点击「开始审计」
4. 等待审计完成后查看报告，可导出为 Markdown 或 HTML

## API 配置示例

| 提供商 | API 地址 | 模型名称 |
| :--- | :--- | :--- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Anthropic | （留空即可） | `claude-sonnet-4-20250514` |

## 项目结构

```
├── app.py              # Flask 主应用
├── config.py           # 数据库与应用配置
├── models.py           # 数据模型（Audit / Setting）
├── llm.py              # LLM API 客户端
├── requirements.txt    # Python 依赖
├── start.bat           # Windows 一键启动
├── templates/          # 页面模板
└── static/             # CSS / JS 静态资源
```
