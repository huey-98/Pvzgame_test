"""后端静态配置：路径、账号规则、会话参数与静态挂载清单。"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BASE_DIR / "data" / "blockline.db"

HOST = "127.0.0.1"
PORT = 8787

SESSION_COOKIE = "blockline_session"
SESSION_DAYS = 30
SESSION_RENEW_DAYS = 15

USERNAME_MIN = 2
USERNAME_MAX = 16
USERNAME_PATTERN = r"^[\u4e00-\u9fa5A-Za-z0-9_]+$"
PASSWORD_MIN = 6
PASSWORD_MAX = 64

PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 200000
PBKDF2_PREFIX = "pbkdf2_sha256"

SCHEMA_VERSION = 7

RESOURCE_IDS = (
    "coin",
    "gem",
    "tech",
    "blueprintArm",
    "blueprintClothes",
    "blueprintHelmet",
    "blueprintPants",
    "blueprintShoes",
    "blueprintGloves",
    "steel",
    "rareEarth",
    "skillBlueprintBombardment",
    "skillBlueprintThermobaric",
    "skillBlueprintDryIce",
    "skillBlueprintArmoredCar",
    "skillBlueprintElectromagnetic",
    "skillBlueprintHighEnergyBeam",
    "skillBlueprintWhirlwindCannon",
    "skillBlueprintHailGenerator",
    "skillBlueprintFuelBomb",
    "skillBlueprintAirBlade",
    "skillBlueprintDrone",
    "skillBlueprintChainLightning",
)
MAX_LEVEL_ID = 64

WALL_MAX_LEVEL = 200
WALL_HP_PER_LEVEL = 200
WALL_STEEL_PER_LEVEL = 20
WALL_BREAKTHROUGH_STEP = 10
WALL_BREAKTHROUGH_BASE_COST = 2
WALL_BREAKTHROUGH_STEP_COST = 2

EQUIPMENT_SLOTS = ("arm", "clothes", "helmet", "pants", "shoes", "gloves")
EQUIPMENT_ELEMENTS = ("physical", "fire", "ice", "electric", "wind", "energy")
EQUIPMENT_MAX_LEVEL = 100
EQUIPMENT_ATTACK_BASE = 10
EQUIPMENT_ATTACK_PER_LEVEL = 5
EQUIPMENT_ELEMENT_BASE = 10
EQUIPMENT_ELEMENT_PER_LEVEL = 5
EQUIPMENT_COIN_BASE = 80
EQUIPMENT_COIN_PER_LEVEL = 40
EQUIPMENT_BLUEPRINT_BASE = 10
EQUIPMENT_BLUEPRINT_PER_LEVEL = 10
EQUIPMENT_BLUEPRINTS = {
    "arm": "blueprintArm",
    "clothes": "blueprintClothes",
    "helmet": "blueprintHelmet",
    "pants": "blueprintPants",
    "shoes": "blueprintShoes",
    "gloves": "blueprintGloves",
}

SKILL_IDS = (
    "bombardment",
    "thermobaric",
    "dryIce",
    "armoredCar",
    "electromagnetic",
    "highEnergyBeam",
    "whirlwindCannon",
    "hailGenerator",
    "fuelBomb",
    "airBlade",
    "drone",
    "chainLightning",
)
SKILL_MAX_LEVEL = 31
SKILL_CRIT_PER_LEVEL = 0.005
SKILL_DAMAGE_PER_LEVEL = 0.08
SKILL_COOLDOWN_PER_LEVEL = 0.015
SKILL_MILESTONES = (2, 7, 12, 18, 22, 26)
SKILL_COIN_BASE = 150
SKILL_COIN_PER_LEVEL = 50
SKILL_BLUEPRINT_PER_LEVEL = 10
SKILL_BLUEPRINTS = {
    "bombardment": "skillBlueprintBombardment",
    "thermobaric": "skillBlueprintThermobaric",
    "dryIce": "skillBlueprintDryIce",
    "armoredCar": "skillBlueprintArmoredCar",
    "electromagnetic": "skillBlueprintElectromagnetic",
    "highEnergyBeam": "skillBlueprintHighEnergyBeam",
    "whirlwindCannon": "skillBlueprintWhirlwindCannon",
    "hailGenerator": "skillBlueprintHailGenerator",
    "fuelBomb": "skillBlueprintFuelBomb",
    "airBlade": "skillBlueprintAirBlade",
    "drone": "skillBlueprintDrone",
    "chainLightning": "skillBlueprintChainLightning",
}
SKILL_BLUEPRINT_IDS = tuple(SKILL_BLUEPRINTS.values())

GEM_SOCKETS = 6
GEM_MAX_QUALITY = 4
GEM_SYNTHESIS_COST = 5
GEM_MAX_GRANT = 100

GEM_QUALITIES = ("灰色", "绿色", "蓝色", "紫色", "红色")

GEM_AFFIXES = {
    "attack": {"kind": "attack", "name": "攻击力", "values": (10, 20, 30, 40, 50)},
    "elementPhysical": {"kind": "elementAttack", "element": "physical", "name": "物理攻击", "values": (10, 20, 30, 40, 50)},
    "elementFire": {"kind": "elementAttack", "element": "fire", "name": "火系攻击", "values": (10, 20, 30, 40, 50)},
    "elementIce": {"kind": "elementAttack", "element": "ice", "name": "冰系攻击", "values": (10, 20, 30, 40, 50)},
    "elementElectric": {"kind": "elementAttack", "element": "electric", "name": "电系攻击", "values": (10, 20, 30, 40, 50)},
    "elementWind": {"kind": "elementAttack", "element": "wind", "name": "风系攻击", "values": (10, 20, 30, 40, 50)},
    "elementEnergy": {"kind": "elementAttack", "element": "energy", "name": "能量攻击", "values": (10, 20, 30, 40, 50)},
    "cooldownReduction": {"kind": "cooldownReduction", "name": "冷却缩减", "values": (.01, .02, .03, .04, .05), "percent": True},
    "wallHpBonus": {"kind": "wallHpBonus", "name": "防线血量", "values": (200, 400, 600, 800, 1000)},
    "critRate": {"kind": "critRate", "name": "暴击率", "values": (.01, .02, .03, .04, .05), "percent": True},
    "critDamage": {"kind": "critDamage", "name": "暴击伤害", "values": (.10, .20, .30, .40, .50), "percent": True},
    "statusDurationMultiplier": {"kind": "statusDurationMultiplier", "name": "负面时间", "values": (.10, .20, .30, .40, .50), "percent": True},
}
GEM_AFFIX_IDS = tuple(GEM_AFFIXES)

MAX_PLAYER_LEVEL = 15
REWARD_LEVEL_UP_LEVEL = 2
REWARD_VETERAN_LEVEL = 5
REWARD_COIN_BASE = 1
REWARD_COIN_LEVEL_UP = 10
REWARD_COIN_VETERAN = 100
REWARD_COIN_CLEAR = 200
REWARD_STEEL = (1, 3)
REWARD_RARE_EARTH_CHANCE = 0.3
REWARD_RARE_EARTH_AMOUNT = 1
REWARD_GEMS = (2, 5)
REWARD_GEM_QUALITY_WEIGHTS = (50, 30, 15, 5)
REWARD_BLUEPRINTS = (3, 10)
REWARD_EQUIPMENT_VETERAN = 1
REWARD_EQUIPMENT_CLEAR = 1
REWARD_SKILL_BLUEPRINT_LEVEL_UP = 2
REWARD_SKILL_BLUEPRINTS = (6, 12)
REWARD_SKILL_BLUEPRINT_CLEAR = 4
BLUEPRINT_IDS = tuple(EQUIPMENT_BLUEPRINTS.values())

STATIC_DIRS = ("src", "styles", "assets", "pictures")
LOCAL_ORIGIN_HOSTS = ("127.0.0.1", "localhost", "[::1]")


def resolve_db_path(value: str | os.PathLike[str] | None = None) -> Path:
    raw = value or os.environ.get("BLOCKLINE_DB") or DEFAULT_DB_PATH
    return Path(raw).expanduser().resolve()


def allowed_origin(origin: str | None) -> bool:
    if not origin:
        return True
    for scheme in ("http://", "https://"):
        if not origin.startswith(scheme):
            continue
        host = origin[len(scheme):].split("/")[0]
        name = host.rsplit(":", 1)[0]
        if name in LOCAL_ORIGIN_HOSTS:
            return True
    return False
