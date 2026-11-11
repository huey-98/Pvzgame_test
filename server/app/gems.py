"""宝石领域逻辑：部位绑定、六槽镶嵌、五合一与调试注入。"""
from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import config, models
from .errors import ApiError


def rows(db: Session, account_id: int) -> list[models.Gem]:
    statement = select(models.Gem).where(models.Gem.account_id == account_id).order_by(models.Gem.id)
    return list(db.execute(statement).scalars().all())


def _quality(value: int) -> int:
    return max(0, min(config.GEM_MAX_QUALITY, int(value)))


def _affix(affix_id: str) -> dict:
    return config.GEM_AFFIXES.get(affix_id) or config.GEM_AFFIXES["attack"]


def affix_value(affix_id: str, quality: int) -> int | float:
    info = _affix(affix_id)
    return info["values"][_quality(quality)]


def affix_payload(affix_id: str, quality: int) -> dict:
    info = _affix(affix_id)
    value = affix_value(affix_id, _quality(quality))
    suffix = info.get("suffix", "")
    if info.get("percent"):
        text = "{} +{}%{}".format(info["name"], "{:g}".format(round(value * 100, 4)), suffix)
    else:
        text = "{} +{}{}".format(info["name"], value, suffix)
    return {
        "id": affix_id if affix_id in config.GEM_AFFIXES else "attack",
        "kind": info["kind"],
        "element": info.get("element"),
        "name": info["name"],
        "value": value,
        "percent": bool(info.get("percent")),
        "text": text,
    }


def gem_payload(row: models.Gem) -> dict:
    return {
        "id": row.id,
        "partId": row.part_id,
        "quality": _quality(row.quality),
        "slotIndex": row.slot_index,
        "locked": bool(row.locked),
        "affix": affix_payload(row.affix_id, row.quality),
    }


def payload(items) -> list[dict]:
    return [gem_payload(row) for row in items]


def random_affix(rng=None) -> str:
    return (rng or secrets.SystemRandom()).choice(config.GEM_AFFIX_IDS)


def create(db: Session, account_id: int, part_id: str, quality: int, affix_id: str | None = None, rng=None) -> models.Gem:
    row = models.Gem(account_id=account_id, part_id=part_id, quality=_quality(quality), affix_id=affix_id or random_affix(rng), slot_index=None, locked=False)
    db.add(row)
    return row


def first_free_slot(items, part_id: str) -> int | None:
    used = {row.slot_index for row in items if row.part_id == part_id and row.slot_index is not None}
    for index in range(config.GEM_SOCKETS):
        if index not in used:
            return index
    return None


def _owned(db: Session, account_id: int, gem_id: int) -> models.Gem:
    row = db.get(models.Gem, int(gem_id))
    if row is None or row.account_id != account_id:
        raise ApiError(422, "gem_not_found", "宝石不存在")
    return row


def _socket_target(items, row: models.Gem, slot_index: int | None) -> tuple[int, models.Gem | None]:
    socketed = [item for item in items if item.part_id == row.part_id and item.slot_index is not None]
    duplicate = next((item for item in socketed if item.affix_id == row.affix_id), None)
    if duplicate is not None:
        if row.quality <= duplicate.quality:
            raise ApiError(422, "gem_affix_conflict", "同词条宝石不可重复镶嵌，需要更高品质")
        return duplicate.slot_index, duplicate
    if slot_index is not None:
        return slot_index, next((item for item in socketed if item.slot_index == slot_index), None)
    slot = first_free_slot(items, row.part_id)
    if slot is None:
        raise ApiError(422, "gem_slots_full", "该部位宝石槽位已满，请选择要替换的宝石")
    return slot, None


def socket(db: Session, account_id: int, gem_id: int, slot_index: int | None = None) -> dict:
    row = _owned(db, account_id, gem_id)
    if row.slot_index is not None:
        return {"gems": payload(rows(db, account_id)), "gemId": row.id, "slotIndex": row.slot_index, "replacedId": None}
    if slot_index is not None:
        slot_index = int(slot_index)
        if slot_index < 0 or slot_index >= config.GEM_SOCKETS:
            raise ApiError(422, "invalid_gem_slot", "宝石槽位不合法")
    target, previous = _socket_target(rows(db, account_id), row, slot_index)
    replaced = previous.id if previous is not None else None
    if previous is not None:
        previous.slot_index = None
        db.flush()
    row.slot_index = target
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "gem_slot_conflict", "宝石槽位冲突，请重试")
    return {"gems": payload(rows(db, account_id)), "gemId": row.id, "slotIndex": target, "replacedId": replaced}


def unsocket(db: Session, account_id: int, gem_id: int) -> dict:
    row = _owned(db, account_id, gem_id)
    row.slot_index = None
    db.commit()
    return {"gems": payload(rows(db, account_id)), "gemId": row.id}


def set_locked(db: Session, account_id: int, gem_id: int, locked: bool) -> dict:
    row = _owned(db, account_id, gem_id)
    row.locked = bool(locked)
    db.commit()
    return {"gems": payload(rows(db, account_id)), "gemId": row.id, "locked": row.locked}


def _candidates(items, part_id: str, quality: int) -> list[models.Gem]:
    return [
        row for row in items
        if row.part_id == part_id and row.quality == quality and row.slot_index is None and not row.locked
    ]


def _plan(items) -> list[dict]:
    plan = []
    for part_id in config.EQUIPMENT_SLOTS:
        for quality in range(config.GEM_MAX_QUALITY):
            candidates = _candidates(items, part_id, quality)
            for start in range(0, len(candidates) - config.GEM_SYNTHESIS_COST + 1, config.GEM_SYNTHESIS_COST):
                plan.append({
                    "partId": part_id,
                    "quality": quality,
                    "gems": candidates[start:start + config.GEM_SYNTHESIS_COST],
                })
    return plan


def synthesize(db: Session, account_id: int, part_id: str, quality: int) -> dict:
    if part_id not in config.EQUIPMENT_SLOTS:
        raise ApiError(422, "unknown_gem_part", "未知装备部位")
    quality = int(quality)
    if quality < 0 or quality > config.GEM_MAX_QUALITY:
        raise ApiError(422, "invalid_gem_quality", "宝石品质不合法")
    if quality >= config.GEM_MAX_QUALITY:
        raise ApiError(422, "gem_max_quality", "红色宝石已是最高品质")
    candidates = _candidates(rows(db, account_id), part_id, quality)[:config.GEM_SYNTHESIS_COST]
    if len(candidates) < config.GEM_SYNTHESIS_COST:
        raise ApiError(422, "not_enough_gems", "同部位同品质的未镶嵌宝石不足 5 颗")
    consumed = [row.id for row in candidates]
    for row in candidates:
        db.delete(row)
    created = create(db, account_id, part_id, quality + 1)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "gem_slot_conflict", "宝石合成冲突，请重试")
    return {"gems": payload(rows(db, account_id)), "gem": gem_payload(created), "consumedIds": consumed}


def synthesize_all(db: Session, account_id: int) -> dict:
    items = rows(db, account_id)
    plan = _plan(items)
    if not plan:
        raise ApiError(422, "no_synthesis_candidates", "没有可合成的宝石（锁定与已镶嵌宝石不参与）")
    consumed = []
    created = []
    for recipe in plan:
        for row in recipe["gems"]:
            consumed.append(row.id)
            db.delete(row)
        created.append(create(db, account_id, recipe["partId"], recipe["quality"] + 1))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "gem_slot_conflict", "宝石合成冲突，请重试")
    return {
        "gems": payload(rows(db, account_id)),
        "results": payload(created),
        "synthesized": len(created),
        "consumedIds": consumed,
    }


def grant(db: Session, account_id: int, part_id: str, quality: int, count: int, affix_id: str | None = None) -> dict:
    if part_id not in config.EQUIPMENT_SLOTS:
        raise ApiError(422, "unknown_gem_part", "未知装备部位")
    quality = int(quality)
    if quality < 0 or quality > config.GEM_MAX_QUALITY:
        raise ApiError(422, "invalid_gem_quality", "宝石品质不合法")
    if affix_id and affix_id not in config.GEM_AFFIXES:
        raise ApiError(422, "unknown_gem_affix", "未知宝石词条")
    count = int(count)
    if count < 1 or count > config.GEM_MAX_GRANT:
        raise ApiError(422, "invalid_gem_count", "单次注入数量需要为 1 到 100")
    created = []
    for _ in range(count):
        created.append(create(db, account_id, part_id, quality, affix_id or None))
    db.commit()
    return {"gems": payload(rows(db, account_id)), "granted": payload(created)}
