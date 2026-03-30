# 通用部署器 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于 PyQt6 + Paramiko 的通用桌面部署器，支持多项目配置、计划预览和三种部署模式。

**Architecture:** 将系统拆分为配置模型、计划生成、SSH/SFTP 执行、部署运行器和 PyQt6 界面五层。优先用 TDD 实现非 GUI 核心逻辑，再把 GUI 接到已验证的服务层上。

**Tech Stack:** Python 3、PyQt6、Paramiko、pytest、pathlib、zipfile、JSON

---

### Task 1: 工具项目骨架与配置模型

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\requirements.txt`
- Create: `E:\Python\Programs\test\bat\deploy_gui\README.md`
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\__init__.py`
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\models.py`
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\config_store.py`
- Test: `E:\Python\Programs\test\bat\deploy_gui\tests\test_config_store.py`

**Step 1: Write the failing test**

```python
def test_save_and_load_multiple_projects(tmp_path):
    store = ConfigStore(tmp_path / "projects.json")
    store.save_all([ProjectConfig(name="A", mode="zip"), ProjectConfig(name="B", mode="git")])
    loaded = store.load_all()
    assert [p.name for p in loaded] == ["A", "B"]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_config_store.py -v`
Expected: FAIL with import or symbol not found

**Step 3: Write minimal implementation**

实现：
- `ProjectConfig`
- `AppConfig`
- `ConfigStore.load_all/save_all`

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_config_store.py -v`
Expected: PASS

### Task 2: 计划生成器

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\planner.py`
- Test: `E:\Python\Programs\test\bat\deploy_gui\tests\test_planner.py`

**Step 1: Write the failing test**

```python
def test_zip_mode_generates_upload_and_remote_steps():
    project = ProjectConfig(name="Demo", mode="zip")
    steps = build_plan(project)
    assert any(step.side == "upload" for step in steps)
    assert any(step.side == "remote" for step in steps)
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_planner.py -v`
Expected: FAIL because planner is missing

**Step 3: Write minimal implementation**

实现：
- `DeployStep`
- `build_plan(project)`
- 三种模式各自产生最小步骤集合

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_planner.py -v`
Expected: PASS

### Task 3: ZIP 打包服务

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\packager.py`
- Test: `E:\Python\Programs\test\bat\deploy_gui\tests\test_packager.py`

**Step 1: Write the failing test**

```python
def test_create_zip_from_source_directory(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("ok", encoding="utf-8")
    target = tmp_path / "out.zip"
    create_zip(src, target)
    assert target.exists()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_packager.py -v`
Expected: FAIL because packager is missing

**Step 3: Write minimal implementation**

实现：
- `create_zip(source_dir, zip_path)`
- 基础忽略规则支持

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_packager.py -v`
Expected: PASS

### Task 4: SSH/SFTP 服务层

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\ssh_client.py`
- Test: `E:\Python\Programs\test\bat\deploy_gui\tests\test_ssh_client.py`

**Step 1: Write the failing test**

```python
def test_build_remote_command_result_without_network():
    result = CommandResult(command="echo ok", exit_code=0, stdout="ok", stderr="")
    assert result.ok is True
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_ssh_client.py -v`
Expected: FAIL because types are missing

**Step 3: Write minimal implementation**

实现：
- `SSHConfig`
- `CommandResult`
- `SSHService` 接口骨架
- 连接、执行命令、上传文件方法

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_ssh_client.py -v`
Expected: PASS

### Task 5: 部署运行器

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\runner.py`
- Test: `E:\Python\Programs\test\bat\deploy_gui\tests\test_runner.py`

**Step 1: Write the failing test**

```python
def test_runner_stops_on_failed_step():
    runner = DeploymentRunner(...)
    result = runner.run([...])
    assert result.success is False
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_runner.py -v`
Expected: FAIL because runner is missing

**Step 3: Write minimal implementation**

实现：
- 串行执行步骤
- 日志回调
- 失败即停

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_runner.py -v`
Expected: PASS

### Task 6: PyQt6 主界面

**Files:**
- Create: `E:\Python\Programs\test\bat\deploy_gui\deploy_gui\main_window.py`
- Create: `E:\Python\Programs\test\bat\deploy_gui\main.py`

**Step 1: Write minimal manual verification target**

界面需包含：
- 项目列表
- 配置表单
- 计划预览
- 日志面板
- 测试连接/生成计划/开始部署按钮

**Step 2: Implement**

实现：
- 主窗口布局
- 配置绑定
- 计划展示
- 执行线程与日志回传

**Step 3: Run manual verification**

Run: `python main.py`
Expected: 窗口成功打开，可保存项目配置并生成计划

### Task 7: 全量验证

**Files:**
- Modify: `E:\Python\Programs\test\bat\deploy_gui\README.md`

**Step 1: Run tests**

Run: `pytest -v`
Expected: PASS

**Step 2: Run app**

Run: `python main.py`
Expected: GUI 正常打开

**Step 3: Document usage**

在 `README.md` 写明：
- 安装依赖
- 三种模式说明
- 配置文件位置
- 安全说明（密码不落盘）
