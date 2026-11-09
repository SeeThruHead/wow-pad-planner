import html
import json
import pathlib
import re
import sys
import urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) < 2:
    sys.exit("usage: build-catalog.py <path to the WhatsTraining addon's Classes/Camelot folder>")
source = pathlib.Path(sys.argv[1])
cache_file = root / "data" / "wowhead-cache.json"
icons_dir = root / "page" / "icons"

CLASSES = {
    "WARRIOR": ("Warrior", "#C69B6D", "Warrior.lua"),
    "PALADIN": ("Paladin", "#F48CBA", "Paladin.lua"),
    "HUNTER": ("Hunter", "#AAD372", "Hunter.lua"),
    "ROGUE": ("Rogue", "#FFF468", "Rogue.lua"),
    "PRIEST": ("Priest", "#FFFFFF", "Priest.lua"),
    "SHAMAN": ("Shaman", "#0070DD", "Shaman.lua"),
    "MAGE": ("Mage", "#3FC7EB", "Mage.lua"),
    "WARLOCK": ("Warlock", "#8788EE", "Warlock.lua"),
    "DRUID": ("Druid", "#FF7C0A", "Druid.lua"),
}

STARTING = {
    "WARRIOR": [(2457, 1), (78, 1), (6603, 1)],
    "PALADIN": [(635, 1), (21084, 1), (6603, 1)],
    "HUNTER": [(2973, 1), (75, 1), (6603, 1)],
    "ROGUE": [(1752, 1), (2098, 1), (6603, 1)],
    "PRIEST": [(585, 1), (2050, 1), (5019, 1)],
    "SHAMAN": [(403, 1), (331, 1), (6603, 1)],
    "MAGE": [(133, 1), (168, 1), (5019, 1)],
    "WARLOCK": [(686, 1), (687, 1), (5019, 1)],
    "DRUID": [(5176, 1), (5185, 1), (6603, 1)],
}

WARLOCK_EXTRA = [(688, 1), (697, 10), (712, 20), (713, 20), (691, 30), (5784, 40), (1122, 50), (18540, 60), (18788, 20), (18708, 20), (18288, 20), (19028, 40), (18223, 30), (17877, 20), (18265, 30), (18220, 40)]
TALENT_LEVEL = {"Shadowburn": 20, "Siphon Life": 30, "Conflagrate": 32, "Incinerate": 50, "Amplify Curse": 20, "Dark Pact": 40, "Fel Domination": 20, "Demonic Sacrifice": 20, "Soul Link": 40, "Curse of Exhaustion": 30}

ALIASES = {
    "Curse of Agony": ["Bane of Agony"],
    "Subjugate Demon": ["Enslave Demon"],
    "Demon Armor": ["Demon Skin"],
}

NOT_PRESSED = {"Parry", "Dual Wield", "Plate Mail", "Mail", "Great Stamina", "Natural Armor", "Arcane Resistance", "Fire Resistance", "Frost Resistance", "Nature Resistance", "Shadow Resistance", "Sharpened Claws", "Feline Grace", "Safe Fall", "Detect Traps"}

RANKED_SUFFIX = re.compile(r" \((Minor|Lesser|Greater|Major|Superior)\)$")
ITEM = re.compile(r"\{id = (\d+)((?:[^{}]|\{[^{}]*\})*)\}")
LEVEL = re.compile(r"^\s*\[(\d+)\]\s*=\s*\{")


def trainer_spells(text):
    found = []
    level = 1
    for line in text.splitlines():
        heading = LEVEL.match(line)
        level = int(heading.group(1)) if heading else level
        for item in ITEM.finditer(line):
            rest = item.group(2)
            talent = re.search(r"requiredTalentId = (\d+)", rest)
            found.append({"id": int(item.group(1)), "level": level, "talentRoot": int(talent.group(1)) if talent else None})
    return found


def quest_spells(text, key):
    block = re.search(key + r" = \{(.*?)\n    \},", text, re.S)
    if not block:
        return []
    return [
        {"id": int(spell), "level": int(level), "talentRoot": None}
        for spell, level in re.findall(r"\[(\d+)\] = \{[^\n]*\n\s*\{[^\n]*?level = (\d+)", block.group(1))
    ]


def load_cache():
    return json.loads(cache_file.read_text()) if cache_file.exists() else {}


def fetch(spell_id, cache):
    key = str(spell_id)
    if key in cache:
        return cache[key]
    try:
        request = urllib.request.Request(f"https://nether.wowhead.com/classic/tooltip/spell/{spell_id}", headers={"User-Agent": "wow-pad-planner"})
        data = json.load(urllib.request.urlopen(request, timeout=10))
    except Exception:
        data = {}
    tooltip = data.get("tooltip", "")
    description = re.search(r'<div class="q">(.*?)</div>', tooltip, re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "", description.group(1))) if description else ""
    passive = "Passive" in tooltip
    cache[key] = {"name": data.get("name"), "icon": data.get("icon"), "desc": re.sub(r"\[[^\]]*\]", "?", text).strip(), "passive": passive} if data.get("name") else None
    return cache[key]


def fetch_icon(icon):
    path = icons_dir / f"{icon}.jpg"
    if path.exists() or not icon:
        return
    try:
        urllib.request.urlretrieve(f"https://wow.zamimg.com/images/wow/icons/large/{icon}.jpg", path)
    except Exception:
        print("no icon", icon)


def class_spells(key, file_name, quests_text, cache):
    text = (source / file_name).read_text()
    trained = trainer_spells(text)
    talent_roots = [{"id": spell["talentRoot"], "level": spell["level"], "talentRoot": spell["talentRoot"]} for spell in trained if spell["talentRoot"]]
    extra = [{"id": spell, "level": level, "talentRoot": None} for spell, level in STARTING[key] + (WARLOCK_EXTRA if key == "WARLOCK" else [])]
    talent_ids = {spell["talentRoot"] for spell in trained if spell["talentRoot"]} | ({18788, 18708, 18288, 19028, 18223, 17877, 18265, 18220} if key == "WARLOCK" else set())
    entries = sorted(extra + trained + talent_roots + quest_spells(quests_text, key), key=lambda spell: spell["level"])
    spells = {}
    for spell in entries:
        info = fetch(spell["id"], cache)
        if not info or info.get("passive"):
            continue
        name = RANKED_SUFFIX.sub("", info["name"])
        if name in spells or name in NOT_PRESSED:
            continue
        talent = spell["id"] in talent_ids or spell["talentRoot"] is not None
        spells[name] = {
            "name": name,
            "id": spell["id"],
            "level": TALENT_LEVEL.get(name, spell["level"]) if key == "WARLOCK" else spell["level"],
            "icon": info["icon"],
            "talent": talent,
            "aliases": ALIASES.get(name, []) + ([f"{name} ({rank})" for rank in ["Major", "Greater", "Lesser", "Minor"]] if name.startswith("Create ") else []),
            "kind": "spell",
            "desc": info["desc"],
        }
    return sorted(spells.values(), key=lambda spell: (spell["level"], spell["name"]))


def macro(name, body, icon, level=1):
    return {"name": name, "id": None, "level": level, "icon": icon, "talent": False, "aliases": [], "kind": "macro", "desc": body}


PET_MACROS = [
    macro("Pet Attack", "/petattack", "ability_ghoulfrenzy"),
    macro("Pet Follow", "/petfollow", "ability_tracking"),
    macro("Pet Passive", "/petpassive", "ability_seal"),
    macro("Pet Defensive", "/petdefensive", "ability_defend"),
]

WARLOCK_MACROS = [
    macro("Torment", "#showtooltip\n/cast [pet:Voidwalker] Torment", "spell_shadow_gathershadows"),
    macro("Sacrifice", "#showtooltip\n/cast [pet:Voidwalker] Sacrifice", "spell_shadow_sacrificialshield"),
    macro("Pet ability", "#showtooltip\n/cast [pet:Voidwalker] Suffering; [pet:Imp] Phase Shift; [pet:Succubus] Lash of Pain; [pet:Felhunter] Devour Magic", "spell_shadow_blackplague"),
    macro("Seduce / Spell Lock", "#showtooltip\n/cast [pet:Succubus] Seduction; [pet:Felhunter] Spell Lock", "spell_shadow_mindsteal"),
    macro("Corruption + pet", "#showtooltip Corruption\n/petattack\n/cast Corruption", "spell_shadow_abominationexplosion"),
    macro("Use Healthstone", "#showtooltip\n/use Major Healthstone\n/use Greater Healthstone\n/use Healthstone\n/use Lesser Healthstone\n/use Minor Healthstone", "inv_stone_04"),
    macro("Soulstone me", "#showtooltip\n/use [@player] Major Soulstone\n/use [@player] Greater Soulstone\n/use [@player] Soulstone\n/use [@player] Lesser Soulstone\n/use [@player] Minor Soulstone", "inv_misc_orb_04"),
]

MACRO_ABOUT = {
    "Pet Attack": "Sends your pet to attack your target.",
    "Pet Follow": "Calls your pet back to follow you.",
    "Pet Passive": "Stops your pet attacking on its own.",
    "Pet Defensive": "Your pet attacks whatever attacks you.",
    "Torment": "Voidwalker taunt: the target attacks your Voidwalker.",
    "Sacrifice": "Sacrifices your Voidwalker to put a shield on you.",
    "Pet ability": "Casts your demon's main ability: Suffering, Phase Shift, Lash of Pain or Devour Magic.",
    "Seduce / Spell Lock": "Your Succubus seduces the target, or your Felhunter interrupts it with Spell Lock.",
    "Corruption + pet": "Sends your pet in and casts Corruption.",
    "Use Healthstone": "Uses the best Healthstone in your bags.",
    "Soulstone me": "Uses the best Soulstone in your bags on yourself.",
    "Start attack": "Starts auto-attack on your target.",
    "Target nearest enemy": "Targets the nearest enemy.",
    "Assist focus": "Targets whatever your focus target is targeting.",
}

SHARED = [
    {"name": "Hearthstone", "id": 6948, "level": 1, "icon": "inv_misc_rune_01", "talent": False, "aliases": [], "kind": "item", "desc": "Returns you to your home inn."},
    macro("Start attack", "/startattack", "ability_meleedamage"),
    macro("Target nearest enemy", "/targetenemy", "ability_hunter_snipershot"),
    macro("Assist focus", "/assist focus", "ability_hunter_markedfordeath"),
]


def main():
    icons_dir.mkdir(parents=True, exist_ok=True)
    cache = {**json.loads((root / "data" / "seed-names.json").read_text()), **load_cache()}
    quests_text = (source / "QuestSpells.lua").read_text()
    classes = {
        key: {
            "name": name,
            "color": color,
            "spells": class_spells(key, file_name, quests_text, cache),
            "macros": [{**item, "about": MACRO_ABOUT[item["name"]]} for item in (PET_MACROS if key in ("HUNTER", "WARLOCK") else []) + (WARLOCK_MACROS if key == "WARLOCK" else [])],
        }
        for key, (name, color, file_name) in CLASSES.items()
    }
    cache_file.write_text(json.dumps(cache, indent=0, sort_keys=True))
    icons = {spell["icon"] for data in classes.values() for spell in data["spells"] + data["macros"]} | {item["icon"] for item in SHARED}
    [fetch_icon(icon) for icon in sorted(icons)]
    shared = [{**item, "about": MACRO_ABOUT[item["name"]]} if item["kind"] == "macro" else item for item in SHARED]
    (root / "page" / "catalog.json").write_text(json.dumps({"classes": classes, "shared": shared}, indent=1))
    print({key: len(data["spells"]) for key, data in classes.items()}, len(icons), "icons")


main()
