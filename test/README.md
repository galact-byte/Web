# CLIProxyAPI 更新脚本

用于自动更新 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 的 Windows 批处理脚本。

## 使用方法

```batch
# 普通更新
update.bat

# 使用代理更新（推荐国内用户）
update.bat --proxy http://127.0.0.1:7890

# 强制重新安装（即使已是最新版本）
update.bat --force

# 组合使用
update.bat --proxy http://127.0.0.1:7890 --force
```

## 功能特性

- **自动版本检测** - 从 GitHub 获取最新版本并与本地对比
- **代理支持** - 通过 `--proxy` 参数设置下载代理
- **自动备份** - 更新前将旧文件备份到 `backup_时间戳` 目录
- **保留配置** - 更新时跳过 `config.yaml`，不覆盖用户配置
- **进程管理** - 更新前自动停止、更新后自动启动 `cli-proxy-api.exe`

## 文件说明

| 文件 | 说明 |
|------|------|
| `update.bat` | 更新脚本 |
| `version.txt` | 当前版本号（自动生成/更新） |
| `config.yaml` | 用户配置（更新时会保留） |
| `backup_*` | 备份目录 |

## 注意事项

1. 首次运行需要先创建 `version.txt` 并写入当前版本号（如 `6.7.47`）
2. 国内用户建议使用 `--proxy` 参数配合代理使用
3. 备份目录可以定期清理以节省空间
