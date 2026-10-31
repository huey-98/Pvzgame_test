"""技能养成领域逻辑：等级补齐、成长换算、升级价格与资源扣费。"""
from __future__ import annotations

import math

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config, models
from .errors import ApiError


def _rows_by_skill(db: Session, account_id: int) -> dict[str, models.SkillProgress]:
    statement = select(models.SkillProgress).where(models.SkillProgress.account_id == account_id)
    return {row.skill_id: row for row in db.execute(statement).scalars().all()}


def ensure_rows(db: Session, account_id: int) -> list[models.SkillProgress]:
    rows = _rows_by_skill(db, account_id)
    missing = [skill_id for skill_id in config.SKILL_IDS if skill_id not in rows]
    if missing:
        for skill_id in missing:
            row = models.SkillProgress(account_id=account_id, skill_id=skill_id, level=1)
            db.add(row)
            rows[skill_id] = row
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            rows = _rows_by_skill(db, account_id)
    return [rows[skill_id] for skill_id in config.SKILL_IDS if skill_id in rows]


def _level(level: int) -> int:
    return max(1, min(config.SKILL_MAX_LEVEL, int(level)))


def cost_for(level: int, skill_id: str) -> dict[str, int] | None:
    if skill_id not in config.SKILL_BLUEPRINTS:
        return None
    current = _level(level)
    if current >= config.SKILL_MAX_LEVEL:
        return None
    return {
        "coin": config.SKILL_COIN_BASE + config.SKILL_COIN_PER_LEVEL * (current - 1),
        config.SKILL_BLUEPRINTS[skill_id]: config.SKILL_BLUEPRINT_PER_LEVEL * current,
    }


def skill_payload(row: models.SkillProgress) -> dict:
    level = _level(row.level)
    steps = level - 1
    blueprint_id = config.SKILL_BLUEPRINTS[row.skill_id]
    return {
        "skillId": row.skill_id,
        "level": level,
        "maxLevel": config.SKILL_MAX_LEVEL,
        "blueprintId": blueprint_id,
        "critBonus": steps * config.SKILL_CRIT_PER_LEVEL,
        "damageBonus": steps * config.SKILL_DAMAGE_PER_LEVEL,
        "cooldownReduction": 1 - math.pow(1 - config.SKILL_COOLDOWN_PER_LEVEL, steps),
        "nextCost": cost_for(level, row.skill_id),
        "milestones": list(config.SKILL_MILESTONES),
        "unlockedMilestones": [node for node in config.SKILL_MILESTONES if level >= node],
    }


def payload(rows) -> dict:
    return {row.skill_id: skill_payload(row) for row in rows if row.skill_id in config.SKILL_BLUEPRINTS}


def _resource_rows(db: Session, account_id: int):
    statement = select(models.Resource).where(models.Resource.account_id == account_id)
    return list(db.execute(statement).scalars().all())


def upgrade(db: Session, account_id: int, skill_id: str) -> dict:
    skill_id = (skill_id or "").strip()
    if skill_id not in config.SKILL_IDS:
        raise ApiError(422, "unknown_skill", "未知技能")
    rows = ensure_rows(db, account_id)
    row = next((item for item in rows if item.skill_id == skill_id), None)
    if row is None:
        raise ApiError(422, "unknown_skill", "未知技能")
    if row.level >= config.SKILL_MAX_LEVEL:
        raise ApiError(422, "max_skill_level", "技能已满级")
    cost = cost_for(row.level, skill_id)
    if cost is None:
        raise ApiError(422, "max_skill_level", "技能已满级")
    owned = {item.resource_id: item.amount for item in _resource_rows(db, account_id)}
    for resource_id, amount in cost.items():
        if owned.get(resource_id, 0) < amount:
            raise ApiError(422, "not_enough_resources", "金币或专属技能图纸不足")
    for resource_id, amount in cost.items():
        resource = db.get(models.Resource, (account_id, resource_id))
        if resource is not None:
            resource.amount -= amount
    row.level += 1
    db.commit()
    from . import serializers
    return {
        "skill": skill_payload(row),
        "skills": payload(rows),
        "resources": serializers.resource_payload(_resource_rows(db, account_id)),
        "skillId": row.skill_id,
        "level": row.level,
    }
