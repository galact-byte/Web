# CHANGES

## v1.2.0 (2026-02-26)

### 完整版能力补全

- 新增删除申请审批流：
  - 单位删除申请：`POST /api/organizations/{org_id}/delete-request`
  - 系统删除申请：`POST /api/systems/{system_id}/delete-request`
  - 申请列表：`GET /api/delete-requests`
  - 管理员审核：`POST /api/delete-requests/{request_id}/review?action=approve|reject`
- 删除失败原因精细化：返回具体关联系统/关联报告数量，便于定位阻塞项。
- 回收站能力增强：单位/系统回收站列表与过期清理接口。
- 附件能力增强：批量上传与在线预览。
  - `POST /api/attachments/{entity_type}/{entity_id}/batch`
  - `GET /api/attachment-files/{attachment_id}/preview`
  - `GET /api/attachment-files/{attachment_id}/download`
- 知识库检索增强：新增精确匹配模式 `match_mode=exact`（保留模糊检索）。
- 流程提醒增强：支持站内消息/邮件/双通道提醒（邮件为可配置能力）。
- 报告版本管理增强：新增版本差异对比接口 `GET /api/reports/{report_id}/compare/{target_id}`。
- 报告导出格式增强：自动目录段、Word 默认字体/字号/行距、Word/PDF 页码输出。

### 精简交付版（APP_LITE_MODE）

- 新增精简交付版运行模式（不删代码，仅按模式屏蔽模块）。
- 新增启动脚本：`start_lite.bat`。
- 新增交付说明：`README_LITE.md`。
- 新增交付打包脚本：`build_lite_delivery.bat`。

### 版本与测试

- FastAPI 应用版本由 `1.0.0` 升级至 `1.2.0`。
- 自动化测试新增到 9 条，全部通过：
  - `python -m unittest discover -s tests -p "test_*.py" -v`

## v1.0.0

- 初版实现单位、系统、报告、流程、看板、知识库等核心模块。
- 提供基础校验、导入导出、回收站与历史记录能力。
