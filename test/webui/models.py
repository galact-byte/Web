from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Text

db = SQLAlchemy()

# MySQL Text = 64KB, LONGTEXT = 4GB
LongText = Text(length=2**32 - 1)


class Audit(db.Model):
    __tablename__ = "audits"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, default="未命名审计")
    language = db.Column(db.String(50), default="auto")
    code_content = db.Column(LongText, nullable=False)
    model_used = db.Column(db.String(100))
    result = db.Column(LongText)
    status = db.Column(db.String(20), default="pending")  # pending / running / completed / failed
    severity = db.Column(db.String(20), default="info")  # info / low / medium / high / critical
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Setting(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
