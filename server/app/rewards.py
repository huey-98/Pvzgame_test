"""关卡奖励：按本局达到的等级与是否通关结算资源、宝石与装备。"""
from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config, equipment, gems, models, serializers
from .errors import ApiError


def tier_for(level: int, win: bool) -> int:
    if win:
        return 3
    if level >= config.REWARD_VETERAN_LEVEL:
        return 2
    if level >= config.REWARD_LEVEL_UP_LEVEL:
        return 1
    return 0


def gem_quality_for(roll: float) -> int:
    value = max(0.0, min(99.999999, float(roll)))
    total = 0.0
    for quality, weight in enumerate(config.REWARD_GEM_QUALITY_WEIGHTS):
        total += float(weight)
        if value < total:
            return quality
    return len(config.REWARD_GEM_QUALITY_WEIGHTS) - 1


def _resource_rows(db: Session, account_id: int):
    statement = select(models.Resource).where(models.Resource.account_id == account_id)
    return list(db.execute(statement).scalars().all())


def _add_resource(db: Session, account_id: int, resources: dict, resource_id: str, amount: int) -> None:
    if amount <= 0:
        return
    resources[resource_id] = resources.get(resource_id, 0) + amount
    row = db.get(models.Resource, (account_id, resource_id))
    if row is None:
        row = models.Resource(account_id=account_id, resource_id=resource_id, amount=0)
        db.add(row)
        db.flush()
    row.amount += amount


def grant(db: Session, account_id: int, level_id: int, level: int, win: bool, rng=None) -> dict:
    rng = rng or secrets.SystemRandom()
    level = max(1, min(config.MAX_PLAYER_LEVEL, int(level)))
    if win and level < config.MAX_PLAYER_LEVEL:
        raise ApiError(422, "invalid_reward_state", "通关奖励需要达到满级")
    tier = tier_for(level, win)
    resources: dict[str, int] = {}
    created_gems = []
    created_equipment = []
    if tier == 0:
        _add_resource(db, account_id, resources, "coin", config.REWARD_COIN_BASE)
    elif tier == 1:
        _add_resource(db, account_id, resources, "coin", config.REWARD_COIN_LEVEL_UP)
        created_gems.append(gems.create(db, account_id, rng.choice(config.EQUIPMENT_SLOTS), 0, rng=rng))
        for _ in range(config.REWARD_SKILL_BLUEPRINT_LEVEL_UP):
            _add_resource(db, account_id, resources, rng.choice(config.SKILL_BLUEPRINT_IDS), 1)
    else:
        _add_resource(db, account_id, resources, "coin", config.REWARD_COIN_VETERAN)
        if tier == 3:
            _add_resource(db, account_id, resources, "coin", config.REWARD_COIN_CLEAR)
        _add_resource(db, account_id, resources, "steel", rng.randint(*config.REWARD_STEEL))
        if rng.random() < config.REWARD_RARE_EARTH_CHANCE:
            _add_resource(db, account_id, resources, "rareEarth", config.REWARD_RARE_EARTH_AMOUNT)
        for _ in range(rng.randint(*config.REWARD_GEMS)):
            quality = gem_quality_for(rng.random() * 100)
            created_gems.append(gems.create(db, account_id, rng.choice(config.EQUIPMENT_SLOTS), quality, rng=rng))
        for _ in range(rng.randint(*config.REWARD_BLUEPRINTS)):
            _add_resource(db, account_id, resources, rng.choice(config.BLUEPRINT_IDS), 1)
        skill_blueprints = rng.randint(*config.REWARD_SKILL_BLUEPRINTS)
        if tier == 3:
            skill_blueprints += config.REWARD_SKILL_BLUEPRINT_CLEAR
        for _ in range(skill_blueprints):
            _add_resource(db, account_id, resources, rng.choice(config.SKILL_BLUEPRINT_IDS), 1)
        count = config.REWARD_EQUIPMENT_VETERAN + (config.REWARD_EQUIPMENT_CLEAR if tier == 3 else 0)
        for _ in range(count):
            created_equipment.append(
                equipment.create_bag_item(
                    db,
                    account_id,
                    rng.choice(config.EQUIPMENT_SLOTS),
                    rng.choice(config.EQUIPMENT_ELEMENTS),
                )
            )
    db.commit()
    rows = equipment.ensure_rows(db, account_id)
    return {
        "levelId": int(level_id),
        "level": level,
        "win": bool(win),
        "tier": tier,
        "rewards": {
            "resources": resources,
            "gems": gems.payload(created_gems),
            "equipment": equipment.bag_payload(created_equipment),
        },
        "resources": serializers.resource_payload(_resource_rows(db, account_id)),
        "equipment": serializers.equipment_payload(rows),
        "equipmentBag": equipment.bag_payload(equipment.bag_rows(db, account_id)),
        "gems": gems.payload(gems.rows(db, account_id)),
    }
