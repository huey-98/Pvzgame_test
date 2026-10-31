"""数据表模型：账户、登录会话、关卡进度、资源、装备、装备背包、城墙与宝石。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import times
from .database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32, collation="NOCASE"), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=times.now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)


class LoginSession(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=times.now)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    account: Mapped[Account] = relationship()


class LevelProgress(Base):
    __tablename__ = "level_progress"

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    level_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    best_time: Mapped[float | None] = mapped_column(Float, default=None)
    best_kills: Mapped[int | None] = mapped_column(Integer, default=None)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)


class Resource(Base):
    __tablename__ = "resources"

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer, default=0)


class Equipment(Base):
    __tablename__ = "equipment"

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    slot_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    element_id: Mapped[str] = mapped_column(String(16))
    level: Mapped[int] = mapped_column(Integer, default=1)


class WallState(Base):
    __tablename__ = "wall_state"

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    breakthroughs: Mapped[int] = mapped_column(Integer, default=0)


class SkillProgress(Base):
    __tablename__ = "skill_progress"

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, default=1)


class EquipmentItem(Base):
    __tablename__ = "equipment_bag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    slot_id: Mapped[str] = mapped_column(String(16))
    element_id: Mapped[str] = mapped_column(String(16))


class Gem(Base):
    __tablename__ = "gems"
    __table_args__ = (UniqueConstraint("account_id", "part_id", "slot_index", name="uq_gem_socket"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    part_id: Mapped[str] = mapped_column(String(16))
    quality: Mapped[int] = mapped_column(Integer, default=0)
    affix_id: Mapped[str] = mapped_column(String(32))
    slot_index: Mapped[int | None] = mapped_column(Integer, default=None, nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class SchemaVersion(Base):
    __tablename__ = "schema_version"

    version: Mapped[int] = mapped_column(Integer, primary_key=True)
