"""步枪成长领域逻辑：等级补齐、基础伤害与升级扣费。"""
from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config, models
from .errors import ApiError


def _level(value: int) -> int:
    return max(config.RIFLE_BASE_LEVEL, int(value))


def cost_for(level: int) -> dict[str, int]:
    current = _level(level)
    return {
        "coin": config.RIFLE_COIN_BASE + config.RIFLE_COIN_PER_LEVEL * (current - 1),
        config.RIFLE_BLUEPRINT_ID: config.RIFLE_BLUEPRINT_PER_LEVEL * current,
    }


def damage_for(level: int) -> int:
    return config.RIFLE_BASE_DAMAGE + config.RIFLE_DAMAGE_PER_LEVEL * (_level(level) - 1)


def unlocked_milestones(level: int) -> list[int]:
    return [node for node in config.RIFLE_MILESTONES if _level(level) >= node]


def payload(row: models.RifleProgress) -> dict:
    level = _level(row.level)
    return {
        "level": level,
        "maxLevel": None,
        "damage": damage_for(level),
        "damagePerLevel": config.RIFLE_DAMAGE_PER_LEVEL,
        "blueprintId": config.RIFLE_BLUEPRINT_ID,
        "milestones": list(config.RIFLE_MILESTONES),
        "unlockedMilestones": unlocked_milestones(level),
        "nextCost": cost_for(level),
    }


def ensure_row(db: Session, account_id: int) -> models.RifleProgress:
    row = db.get(models.RifleProgress, account_id)
    if row is not None:
        return row
    row = models.RifleProgress(account_id=account_id, level=config.RIFLE_BASE_LEVEL)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return db.get(models.RifleProgress, account_id)


def upgrade(db: Session, account_id: int) -> dict:
    from . import serializers

    row = ensure_row(db, account_id)
    cost = cost_for(row.level)
    amounts: dict[str, int] = {}
    for resource_id, value in cost.items():
        resource = db.get(models.Resource, (account_id, resource_id))
        amounts[resource_id] = resource.amount if resource else 0
        if resource is None or resource.amount < value:
            raise ApiError(422, "not_enough_resources", "金币或步枪图纸不足")
    for resource_id, value in cost.items():
        db.get(models.Resource, (account_id, resource_id)).amount -= value
    row.level = _level(row.level + 1)
    db.commit()
    from sqlalchemy import select

    rows = list(db.execute(select(models.Resource).where(models.Resource.account_id == account_id)).scalars())
    return {
        "rifle": payload(row),
        "resources": serializers.resource_payload(rows),
        "level": row.level,
    }
