"""
定时爬取调度器
使用 threading.Timer 实现轻量定时爬取，配置持久化在 progress_config.json 中
"""
import logging
import threading
import time
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.progress import ProgressRecord, ProgressScrapeLog, PROJECT_TYPE_NAMES
from app.services.progress_scraper import ProgressScraper, load_config, save_config

logger = logging.getLogger(__name__)


class ScheduledScraper:
    """定时爬取调度器（单例）"""

    def __init__(self):
        self._timer = None
        self._running = False
        self._lock = threading.Lock()
        self._last_run = None
        self._last_error = None

    @property
    def is_running(self):
        return self._running

    @property
    def last_run(self):
        return self._last_run

    @property
    def last_error(self):
        return self._last_error

    def start(self, interval_minutes: int):
        """启动定时爬取"""
        with self._lock:
            self.stop()
            self._running = True
            # 保存配置
            config = load_config()
            config["schedule_enabled"] = True
            config["schedule_interval"] = interval_minutes
            save_config(config)
            self._schedule_next(interval_minutes)
            logger.info(f"定时爬取已启动，间隔 {interval_minutes} 分钟")

    def stop(self):
        """停止定时爬取"""
        with self._lock:
            self._running = False
            if self._timer:
                self._timer.cancel()
                self._timer = None
            config = load_config()
            config["schedule_enabled"] = False
            save_config(config)
            logger.info("定时爬取已停止")

    def _schedule_next(self, interval_minutes: int):
        """调度下一次执行"""
        if not self._running:
            return
        self._timer = threading.Timer(
            interval_minutes * 60,
            self._run_all,
            args=[interval_minutes],
        )
        self._timer.daemon = True
        self._timer.start()

    def _run_all(self, interval_minutes: int):
        """执行所有类型的爬取"""
        if not self._running:
            return

        logger.info("定时爬取开始执行...")
        db = SessionLocal()
        try:
            for project_type, type_name in PROJECT_TYPE_NAMES.items():
                try:
                    self._scrape_one(db, project_type, type_name)
                except Exception as e:
                    logger.error(f"定时爬取 {type_name} 失败: {e}")
                    self._last_error = f"{type_name}: {e}"

            self._last_run = datetime.now(timezone.utc)
            logger.info("定时爬取全部完成")
        except Exception as e:
            logger.error(f"定时爬取异常: {e}")
            self._last_error = str(e)
        finally:
            db.close()
            # 调度下一次
            if self._running:
                self._schedule_next(interval_minutes)

    def _scrape_one(self, db, project_type: str, type_name: str):
        """爬取单个类型"""
        log = ProgressScrapeLog(project_type=project_type, status="running")
        db.add(log)
        db.commit()
        db.refresh(log)

        start_time = time.time()
        scraper = ProgressScraper(project_type)

        try:
            records = scraper.run()

            batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

            existing = {
                r.system_id: r
                for r in db.query(ProgressRecord).filter(
                    ProgressRecord.project_type == project_type
                ).all()
            }
            new_ids = set()

            for rec_data in records:
                sid = rec_data.get("system_id", "")
                new_ids.add(sid)
                if sid and sid in existing:
                    for key, value in rec_data.items():
                        setattr(existing[sid], key, value)
                    existing[sid].batch_id = batch_id
                else:
                    record = ProgressRecord(
                        project_type=project_type,
                        batch_id=batch_id,
                        **rec_data,
                    )
                    db.add(record)

            for sid, record in existing.items():
                if sid not in new_ids:
                    db.delete(record)

            log.status = "success"
            log.total_records = len(records)
            log.duration_seconds = round(time.time() - start_time, 2)
            log.finished_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"定时爬取 {type_name} 完成，{len(records)} 条记录")

        except Exception as e:
            log.status = "failed"
            log.error_message = str(e)
            log.duration_seconds = round(time.time() - start_time, 2)
            log.finished_at = datetime.now(timezone.utc)
            db.commit()
            raise
        finally:
            scraper.cleanup()

    def get_status(self) -> dict:
        """获取当前状态"""
        config = load_config()
        return {
            "enabled": self._running,
            "interval_minutes": config.get("schedule_interval", 60),
            "last_run": self._last_run.isoformat() if self._last_run else None,
            "last_error": self._last_error,
        }

    def restore_from_config(self):
        """从配置文件恢复定时状态（应用启动时调用）"""
        config = load_config()
        if config.get("schedule_enabled"):
            interval = config.get("schedule_interval", 60)
            self._running = True
            self._schedule_next(interval)
            logger.info(f"从配置恢复定时爬取，间隔 {interval} 分钟")


# 全局单例
scheduler = ScheduledScraper()
