import { emptyLayers } from "./Plan.ts"
import type { ClassId, Layers, Plan } from "./Plan.ts"

type SlotNames = Readonly<Record<string, string>>
type LayerNames = {
  readonly base?: SlotNames
  readonly lt?: SlotNames
  readonly rt?: SlotNames
  readonly both?: SlotNames
}

export type Starter = { readonly id: string; readonly plan: Plan }

const refs = (names: SlotNames | undefined) =>
  Object.fromEntries(Object.entries(names ?? {}).map(([key, name]) => [key, { ref: name }]))
const layers = ({ base, lt, rt, both }: LayerNames): Layers => ({
  base: refs(base),
  lt: refs(lt),
  rt: refs(rt),
  both: refs(both)
})

const starter = (
  id: string,
  name: string,
  className: ClassId,
  why: string,
  sets: ReadonlyArray<LayerNames>,
  extra?: Partial<Plan>
): Starter => ({
  id: `builtin:${id}`,
  plan: {
    version: 2,
    name,
    class: className,
    controller: "xbox",
    level: 60,
    activeSet: 0,
    why,
    sets: [
      { name: "Combat", layers: layers(sets[0] ?? {}) },
      { name: "Out of combat", layers: layers(sets[1] ?? {}) },
      { name: "Spare", layers: layers(sets[2] ?? {}) }
    ],
    paddles: emptyLayers(),
    back: {},
    controls: {},
    ...extra
  }
})

const RULES =
  "Cast-time spells sit on the d-pad with no trigger: you stop to cast them anyway, so moving your thumb off the stick costs nothing. Instant spells sit on the trigger layers' face buttons, which you can press while moving. Main attacks are on RT, the interrupt is always RT + B and the emergency defensive is always LT + B, so they are the same button on every class. Cooldowns and rare utility are behind LT + RT. Set 2 (LB + RB + d-pad right) holds out-of-combat things: buffs, pets, travel, hearth."
const HEALER =
  " Healers: turn on Fixed Party Targeting in the gamepad settings so LB + d-pad picks party members, and with gyro or a trackpad as a mouse turn on mouseover casting to heal whoever is under the cursor."
const FLYOUTS =
  " Where the spellbook groups a family (forms, aspects, pets, auras, stances) into one flyout, drag the flyout instead to free slots."

const WARLOCK_OUT = {
  base: { DL: "Summon Imp", DU: "Summon Voidwalker", DR: "Summon Succubus", DD: "Summon Felhunter" },
  rt: {
    X: "Create Healthstone",
    Y: "Create Soulstone",
    B: "Create Spellstone",
    A: "Create Firestone",
    DL: "Eye of Kilrogg",
    DU: "Unending Breath",
    DR: "Sense Demons",
    DD: "Detect Invisibility"
  },
  lt: {
    X: "Ritual of Summoning",
    Y: "Banish",
    B: "Subjugate Demon",
    A: "Summon Felsteed",
    DL: "Curse of Tongues",
    DU: "Pet Passive",
    DR: "Drain Mana",
    DD: "Pet Defensive"
  },
  both: { X: "Ritual of Doom", Y: "Soulstone me", B: "Use Healthstone", A: "Hearthstone" }
}

export const STARTERS: ReadonlyArray<Starter> = [
  starter(
    "warlock",
    "Warlock starter",
    "WARLOCK",
    RULES + " The pet's interrupt (Spell Lock or Seduction) is the RT + B macro." + FLYOUTS,
    [
      {
        base: { DU: "Shadow Bolt", DR: "Immolate", DD: "Drain Life", DL: "Fear" },
        rt: {
          X: "Corruption",
          Y: "Curse of Agony",
          A: "Shadowburn",
          B: "Seduce / Spell Lock",
          DL: "Drain Soul",
          DU: "Searing Pain",
          DR: "Rain of Fire",
          DD: "Shoot"
        },
        lt: {
          X: "Life Tap",
          Y: "Curse of Weakness",
          A: "Siphon Life",
          B: "Use Healthstone",
          DU: "Pet Attack",
          DR: "Health Funnel",
          DD: "Pet Follow",
          DL: "Curse of Recklessness"
        },
        both: {
          X: "Death Coil",
          Y: "Howl of Terror",
          A: "Amplify Curse",
          B: "Shadow Ward",
          DL: "Inferno",
          DU: "Fel Domination",
          DR: "Hellfire",
          DD: "Curse of Doom"
        }
      },
      WARLOCK_OUT
    ]
  ),
  starter(
    "warrior",
    "Warrior starter",
    "WARRIOR",
    RULES +
      " Everything a warrior presses is instant, so the d-pad with no trigger holds the core rotation instead." +
      FLYOUTS,
    [
      {
        base: { DU: "Heroic Strike", DR: "Rend", DD: "Hamstring", DL: "Charge" },
        rt: {
          X: "Overpower",
          Y: "Execute",
          A: "Mortal Strike",
          B: "Pummel",
          DL: "Sunder Armor",
          DU: "Cleave",
          DR: "Thunder Clap",
          DD: "Victory Rush"
        },
        lt: {
          X: "Demoralizing Shout",
          Y: "Battle Shout",
          A: "Intimidating Shout",
          B: "Shield Block",
          DU: "Battle Stance",
          DR: "Defensive Stance",
          DD: "Bloodrage",
          DL: "Taunt"
        },
        both: {
          X: "Retaliation",
          Y: "Shield Wall",
          A: "Berserker Rage",
          B: "Challenging Shout",
          DU: "Whirlwind",
          DR: "Intercept",
          DD: "Mocking Blow",
          DL: "Disarm"
        }
      },
      {
        base: { DU: "Battle Shout", DD: "Hearthstone" },
        rt: { X: "Shield Bash", Y: "Revenge", A: "Slam", B: "Bloodthirst" }
      }
    ]
  ),
  starter(
    "paladin",
    "Paladin starter",
    "PALADIN",
    RULES + " Hammer of Justice is the RT + B stop." + HEALER + FLYOUTS,
    [
      {
        base: { DU: "Holy Light", DR: "Flash of Light", DD: "Hammer of Wrath", DL: "Holy Wrath" },
        rt: {
          X: "Judgement",
          Y: "Seal of Righteousness",
          A: "Seal of the Crusader",
          B: "Hammer of Justice",
          DL: "Consecration",
          DU: "Exorcism",
          DR: "Seal of Command",
          DD: "Holy Shock"
        },
        lt: {
          X: "Purify",
          Y: "Blessing of Freedom",
          A: "Seal of Justice",
          B: "Divine Protection",
          DU: "Seal of Wisdom",
          DR: "Seal of Light",
          DD: "Turn Undead",
          DL: "Righteous Fury"
        },
        both: {
          X: "Lay on Hands",
          Y: "Blessing of Protection",
          A: "Divine Intervention",
          B: "Blessing of Sacrifice",
          DU: "Devotion Aura",
          DR: "Retribution Aura",
          DD: "Concentration Aura",
          DL: "Cleanse"
        }
      },
      {
        base: { DU: "Blessing of Might", DR: "Blessing of Wisdom", DD: "Blessing of Kings", DL: "Redemption" },
        rt: {
          X: "Greater Blessing of Might",
          Y: "Greater Blessing of Wisdom",
          A: "Greater Blessing of Kings",
          B: "Hearthstone"
        }
      }
    ]
  ),
  starter(
    "hunter",
    "Hunter starter",
    "HUNTER",
    RULES +
      " Hunters have no baseline interrupt, so RT + B holds Concussive Shot, and the emergency LT + B is Feign Death." +
      FLYOUTS,
    [
      {
        base: { DU: "Aimed Shot", DR: "Multi-Shot", DD: "Volley", DL: "Scare Beast" },
        rt: {
          X: "Arcane Shot",
          Y: "Serpent Sting",
          A: "Auto Shot",
          B: "Concussive Shot",
          DL: "Raptor Strike",
          DU: "Mongoose Bite",
          DR: "Wing Clip",
          DD: "Hunter's Mark"
        },
        lt: {
          X: "Mend Pet",
          Y: "Pet Attack",
          A: "Pet Follow",
          B: "Feign Death",
          DU: "Freezing Trap",
          DR: "Immolation Trap",
          DD: "Frost Trap",
          DL: "Explosive Trap"
        },
        both: {
          X: "Rapid Fire",
          Y: "Disengage",
          A: "Counterattack",
          B: "Flare",
          DU: "Aspect of the Hawk",
          DR: "Aspect of the Monkey",
          DD: "Aspect of the Cheetah",
          DL: "Aspect of the Pack"
        }
      },
      {
        base: { DU: "Call Pet", DR: "Revive Pet", DD: "Feed Pet", DL: "Dismiss Pet" },
        rt: { X: "Tame Beast", Y: "Track Beasts", A: "Track Humanoids", B: "Hearthstone" },
        lt: { X: "Eagle Eye", Y: "Eyes of the Beast", A: "Beast Lore", B: "Aspect of the Wild" }
      }
    ]
  ),
  starter(
    "rogue",
    "Rogue starter",
    "ROGUE",
    RULES + " Everything a rogue presses is instant, so the d-pad with no trigger holds the core rotation instead.",
    [
      {
        base: { DU: "Sinister Strike", DR: "Eviscerate", DD: "Slice and Dice", DL: "Backstab" },
        rt: {
          X: "Gouge",
          Y: "Rupture",
          A: "Ambush",
          B: "Kick",
          DL: "Garrote",
          DU: "Cheap Shot",
          DR: "Kidney Shot",
          DD: "Expose Armor"
        },
        lt: {
          X: "Sap",
          Y: "Feint",
          A: "Stealth",
          B: "Evasion",
          DU: "Distract",
          DR: "Pick Pocket",
          DD: "Pick Lock",
          DL: "Disarm Trap"
        },
        both: { X: "Sprint", Y: "Vanish" }
      },
      { base: { DD: "Hearthstone" } }
    ]
  ),
  starter(
    "priest",
    "Priest starter",
    "PRIEST",
    RULES +
      " Priests have no baseline interrupt, so RT + B holds Psychic Scream; the emergency LT + B is Desperate Prayer." +
      HEALER,
    [
      {
        base: { DU: "Heal", DR: "Flash Heal", DD: "Mind Blast", DL: "Smite" },
        rt: {
          X: "Shadow Word: Pain",
          Y: "Power Word: Shield",
          A: "Renew",
          B: "Psychic Scream",
          DL: "Mind Flay",
          DU: "Holy Fire",
          DR: "Devouring Plague",
          DD: "Shoot"
        },
        lt: {
          X: "Dispel Magic",
          Y: "Cure Disease",
          A: "Abolish Disease",
          B: "Desperate Prayer",
          DU: "Prayer of Healing",
          DR: "Holy Nova",
          DD: "Mana Burn",
          DL: "Fade"
        },
        both: {
          X: "Fear Ward",
          Y: "Inner Fire",
          A: "Penance",
          B: "Prayer of Mending",
          DU: "Mind Control",
          DR: "Shackle Undead",
          DD: "Mind Soothe",
          DL: "Feedback"
        }
      },
      {
        base: { DU: "Power Word: Fortitude", DR: "Divine Spirit", DD: "Shadow Protection", DL: "Resurrection" },
        rt: { X: "Levitate", Y: "Mind Vision", B: "Hearthstone" }
      }
    ]
  ),
  starter(
    "shaman",
    "Shaman starter",
    "SHAMAN",
    RULES +
      " Earth Shock interrupts, so it is the RT + B button; Grounding Totem is the emergency LT + B." +
      HEALER +
      FLYOUTS,
    [
      {
        base: { DU: "Healing Wave", DR: "Lesser Healing Wave", DD: "Lightning Bolt", DL: "Chain Lightning" },
        rt: {
          X: "Lightning Shield",
          Y: "Flame Shock",
          A: "Frost Shock",
          B: "Earth Shock",
          DL: "Searing Totem",
          DU: "Magma Totem",
          DR: "Fire Nova",
          DD: "Purge"
        },
        lt: {
          X: "Earthbind Totem",
          Y: "Stoneskin Totem",
          A: "Strength of Earth Totem",
          B: "Grounding Totem",
          DU: "Healing Stream Totem",
          DR: "Mana Spring Totem",
          DD: "Tremor Totem",
          DL: "Poison Cleansing Totem"
        },
        both: {
          X: "Chain Heal",
          Y: "Mana Tide Totem",
          A: "Windfury Totem",
          B: "Stoneclaw Totem",
          DU: "Rockbiter Weapon",
          DR: "Flametongue Weapon",
          DD: "Windfury Weapon",
          DL: "Frostbrand Weapon"
        }
      },
      {
        base: { DU: "Ghost Wolf", DR: "Ancestral Spirit", DD: "Astral Recall", DL: "Water Walking" },
        rt: { X: "Far Sight", Y: "Water Breathing", A: "Cure Poison", B: "Hearthstone" }
      }
    ]
  ),
  starter(
    "mage",
    "Mage starter",
    "MAGE",
    RULES + " Counterspell is RT + B; the emergency LT + B is Ice Barrier (Mana Shield before you have it)." + FLYOUTS,
    [
      {
        base: { DU: "Frostbolt", DR: "Fireball", DD: "Polymorph", DL: "Pyroblast" },
        rt: {
          X: "Fire Blast",
          Y: "Ice Lance",
          A: "Frost Nova",
          B: "Counterspell",
          DL: "Arcane Missiles",
          DU: "Scorch",
          DR: "Blizzard",
          DD: "Flamestrike"
        },
        lt: {
          X: "Arcane Explosion",
          Y: "Cone of Cold",
          A: "Blink",
          B: "Ice Barrier",
          DU: "Frost Ward",
          DR: "Fire Ward",
          DD: "Remove Lesser Curse",
          DL: "Shoot"
        },
        both: {
          X: "Evocation",
          Y: "Blast Wave",
          A: "Mana Shield",
          B: "Arcane Blast",
          DU: "Frost Armor",
          DR: "Ice Armor",
          DD: "Mage Armor",
          DL: "Dampen Magic"
        }
      },
      {
        base: { DU: "Arcane Intellect", DR: "Conjure Water", DD: "Conjure Food", DL: "Conjure Mana Agate" },
        rt: { X: "Teleport: Stormwind", Y: "Teleport: Ironforge", A: "Teleport: Orgrimmar", B: "Hearthstone" },
        lt: { X: "Slow Fall", Y: "Amplify Magic" }
      }
    ]
  ),
  starter(
    "druid",
    "Druid starter",
    "DRUID",
    RULES +
      " RT holds caster spells and LT holds cat and bear moves; Bash is the RT + B stop and Barkskin the emergency LT + B. The forms sit together on the LT + RT d-pad." +
      HEALER +
      FLYOUTS,
    [
      {
        base: { DU: "Healing Touch", DR: "Regrowth", DD: "Wrath", DL: "Starfire" },
        rt: {
          X: "Moonfire",
          Y: "Rejuvenation",
          A: "Insect Swarm",
          B: "Bash",
          DL: "Entangling Roots",
          DU: "Faerie Fire",
          DR: "Hibernate",
          DD: "Hurricane"
        },
        lt: {
          X: "Claw",
          Y: "Rake",
          A: "Shred",
          B: "Barkskin",
          DU: "Maul",
          DR: "Swipe",
          DD: "Ferocious Bite",
          DL: "Rip"
        },
        both: {
          X: "Innervate",
          Y: "Tranquility",
          A: "Rebirth",
          B: "Frenzied Regeneration",
          DU: "Bear Form",
          DR: "Cat Form",
          DD: "Travel Form",
          DL: "Aquatic Form"
        }
      },
      {
        base: { DU: "Mark of the Wild", DR: "Thorns", DD: "Revive", DL: "Teleport: Moonglade" },
        rt: { X: "Prowl", Y: "Dash", A: "Remove Curse", B: "Hearthstone" },
        lt: { X: "Abolish Poison", Y: "Cure Poison" }
      }
    ]
  ),
  starter(
    "shane",
    "Shane's level 10 Warlock (Steam Controller)",
    "WARLOCK",
    "Thumb-on-the-stick style: no attacks on the d-pad on any layer, so the left thumb never leaves the stick. Every attack and DoT is on the back buttons or a trigger plus a face button, and everything needed in combat is in set 1, so there's no set switching in a fight. The back buttons with no trigger hold the four spells pressed most: R4 Shadow Bolt, R5 Corruption, L4 Curse of Agony, L5 Immolate. RT holds the rest of the damage and Pet Attack. LT holds Life Tap, Curse of Weakness and the emergency Healthstone. LT + RT holds spells for the next levels (Health Funnel, Searing Pain, Rain of Fire, Curse of Recklessness), which PadPlan places as soon as they're learned. The d-pad holds only pets, summons, buffs and stones. Set 2 is for rare out-of-combat spells. Voice chat is a long press of Select, and its keys (Home, Insert, Delete, End, Page Up, Page Down) are listed as keys other tools send, so WoW ignores them. The back buttons send F9, F10, F11 and F12 (L4, L5, R4, R5), keys Steam's keyboard picker shows; PadPlan clears WoW's bag bindings on them and hands them to Backhand.",
    [
      {
        base: { DU: "Summon Voidwalker", DR: "Summon Imp", DD: "Pet Follow", DL: "Demon Skin" },
        rt: { X: "Drain Soul", Y: "Fear", A: "Shoot", B: "Pet Attack", DU: "Create Healthstone", DD: "Hearthstone" },
        lt: {
          X: "Life Tap",
          Y: "Curse of Weakness",
          A: "Drain Life",
          B: "Use Healthstone",
          DU: "Pet Passive",
          DD: "Pet Defensive"
        },
        both: { X: "Health Funnel", Y: "Searing Pain", A: "Rain of Fire", B: "Curse of Recklessness" }
      },
      {
        base: { DU: "Unending Breath", DR: "Eye of Kilrogg", DD: "Sense Demons", DL: "Detect Invisibility" },
        rt: { X: "Ritual of Summoning", Y: "Create Soulstone", A: "Summon Succubus", B: "Summon Felhunter" }
      }
    ],
    {
      controller: "steam",
      level: 10,
      useBackButtons: true,
      otherKeys: ["Home", "Insert", "Delete", "End", "Page Up", "Page Down"],
      paddles: layers({ base: { R4: "Shadow Bolt", R5: "Corruption", L4: "Curse of Agony", L5: "Immolate" } }),
      back: {
        L4: { use: "slot", key: "F9", note: "" },
        L5: { use: "slot", key: "F10", note: "" },
        R4: { use: "slot", key: "F11", note: "" },
        R5: { use: "slot", key: "F12", note: "" }
      }
    }
  ),
  starter(
    "shane-60",
    "Shane's level 60 Warlock (Steam Controller)",
    "WARLOCK",
    "Thumb-on-the-stick style for a level 60 Warlock: no attacks on any d-pad, all combat in set 1, and set 2 for rare and out-of-combat spells. The 16 back-button slots (four on each layer) carry most of the damage, so it can be cast without leaving the sticks. No trigger: Shadow Bolt, Corruption, Curse of Agony, Immolate, the spells pressed most. RT: the pet's interrupt (Spell Lock or Seduction), Searing Pain, Siphon Life, Conflagrate, plus Drain Soul, Fear, Shoot and Pet Attack on the face buttons. LT: Life Tap, Curse of Weakness, Drain Life and the emergency Healthstone on the face buttons, with Health Funnel, Dark Pact and the other curses on the back buttons. LT + RT: cooldowns (Death Coil, Howl of Terror, Amplify Curse, Shadowburn) and the AoE and big hitters (Rain of Fire, Hellfire, Soul Fire, Curse of Doom). The d-pads hold summons, pet commands, armor and stones (Healthstone, Soulstone, Spellstone, Firestone). Talent spells from all three trees are included; the ones you don't have are skipped. Voice chat is a long press of Select; its keys are listed as keys other tools send. The back buttons send F9, F10, F11 and F12 (L4, L5, R4, R5).",
    [
      {
        base: { DU: "Summon Voidwalker", DR: "Summon Felhunter", DD: "Pet Follow", DL: "Demon Armor" },
        rt: {
          X: "Drain Soul",
          Y: "Fear",
          A: "Shoot",
          B: "Pet Attack",
          DU: "Create Healthstone",
          DR: "Create Soulstone",
          DD: "Hearthstone",
          DL: "Summon Succubus"
        },
        lt: {
          X: "Life Tap",
          Y: "Curse of Weakness",
          A: "Drain Life",
          B: "Use Healthstone",
          DU: "Pet Passive",
          DR: "Pet Defensive",
          DD: "Pet ability",
          DL: "Torment"
        },
        both: {
          X: "Death Coil",
          Y: "Howl of Terror",
          A: "Amplify Curse",
          B: "Shadowburn",
          DU: "Inferno",
          DR: "Fel Domination",
          DD: "Create Spellstone",
          DL: "Create Firestone"
        }
      },
      {
        base: { DU: "Summon Imp", DR: "Summon Incubus", DD: "Summon Felsteed", DL: "Ritual of Summoning" },
        rt: {
          X: "Banish",
          Y: "Subjugate Demon",
          A: "Drain Mana",
          B: "Curse of Exhaustion",
          DU: "Unending Breath",
          DR: "Detect Invisibility",
          DD: "Sense Demons",
          DL: "Eye of Kilrogg"
        },
        lt: {
          X: "Ritual of Doom",
          Y: "Demonic Sacrifice",
          A: "Soul Link",
          B: "Incinerate",
          DU: "Sacrifice",
          DR: "Soulstone me"
        }
      }
    ],
    {
      controller: "steam",
      level: 60,
      useBackButtons: true,
      otherKeys: ["Home", "Insert", "Delete", "End", "Page Up", "Page Down"],
      paddles: layers({
        base: { R4: "Shadow Bolt", R5: "Corruption", L4: "Curse of Agony", L5: "Immolate" },
        rt: { R4: "Seduce / Spell Lock", R5: "Searing Pain", L4: "Siphon Life", L5: "Conflagrate" },
        lt: { R4: "Health Funnel", R5: "Dark Pact", L4: "Curse of Recklessness", L5: "Curse of Tongues" },
        both: { R4: "Rain of Fire", R5: "Hellfire", L4: "Soul Fire", L5: "Curse of Doom" }
      }),
      back: {
        L4: { use: "slot", key: "F9", note: "" },
        L5: { use: "slot", key: "F10", note: "" },
        R4: { use: "slot", key: "F11", note: "" },
        R5: { use: "slot", key: "F12", note: "" }
      }
    }
  )
]
