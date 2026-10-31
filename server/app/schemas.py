"""请求体模型。"""
from __future__ import annotations

from pydantic import BaseModel


class Credentials(BaseModel):
    username: str = ""
    password: str = ""


class PasswordConfirm(BaseModel):
    password: str = ""


class ProgressReport(BaseModel):
    levelId: int
    time: float | None = None
    kills: int | None = None
    win: bool = False


class ResourceChange(BaseModel):
    resourceId: str
    delta: int = 0


class EquipmentUpgrade(BaseModel):
    slotId: str = ""


class EquipmentEquip(BaseModel):
    itemId: int = 0


class SkillUpgrade(BaseModel):
    skillId: str = ""


class RewardClaim(BaseModel):
    levelId: int = 0
    level: int = 1
    win: bool = False


class WallUpgrade(BaseModel):
    action: str = ""


class GemSocket(BaseModel):
    gemId: int = 0
    slotIndex: int | None = None


class GemSynthesis(BaseModel):
    partId: str = ""
    quality: int = -1


class GemLock(BaseModel):
    gemId: int = 0
    locked: bool = True


class GemSynthesizeAll(BaseModel):
    pass


class GemGrant(BaseModel):
    partId: str = ""
    quality: int = -1
    count: int = 0
    affixId: str = ""
