"use strict";

const refs = (names) => Object.fromEntries(Object.entries(names || {}).map(([key, name]) => [key, { ref: name }]));
const layers = ({ base, lt, rt, both }) => ({ base: refs(base), lt: refs(lt), rt: refs(rt), both: refs(both) });

const RULES =
  "Cast-time spells sit on the d-pad with no trigger: you stop to cast them anyway, so moving your thumb off the stick costs nothing. Instant spells sit on the trigger layers' face buttons, which you can press while moving. Main attacks are on RT, the interrupt is always RT + B and the emergency defensive is always LT + B, so they are the same button on every class. Cooldowns and rare utility are behind LT + RT. Set 2 (LB + RB + d-pad right) holds out-of-combat things: buffs, pets, travel, hearth.";
const HEALER =
  " Healers: turn on Fixed Party Targeting in the gamepad settings so LB + d-pad picks party members, and with gyro or a trackpad as a mouse turn on mouseover casting to heal whoever is under the cursor.";
const FLYOUTS = " Where the spellbook groups a family (forms, aspects, pets, auras, stances) into one flyout, drag the flyout instead to free slots.";

const starter = (id, name, className, why, sets, extra) => ({
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
      { name: "Combat", layers: layers(sets[0]) },
      { name: "Out of combat", layers: layers(sets[1] || {}) },
      { name: "Spare", layers: layers(sets[2] || {}) },
    ],
    paddles: layers({}),
    back: {},
    controls: {},
    ...extra,
  },
});

const WARLOCK_OUT = {
  base: { DL: "Summon Imp", DU: "Summon Voidwalker", DR: "Summon Succubus", DD: "Summon Felhunter" },
  rt: { X: "Create Healthstone", Y: "Create Soulstone", B: "Create Spellstone", A: "Create Firestone", DL: "Eye of Kilrogg", DU: "Unending Breath", DR: "Sense Demons", DD: "Detect Invisibility" },
  lt: { X: "Ritual of Summoning", Y: "Banish", B: "Subjugate Demon", A: "Summon Felsteed", DL: "Curse of Tongues", DU: "Pet Passive", DR: "Drain Mana", DD: "Pet Defensive" },
  both: { X: "Ritual of Doom", Y: "Soulstone me", B: "Use Healthstone", A: "Hearthstone" },
};

const STARTERS = [
  starter("warlock", "Warlock starter", "WARLOCK", RULES + " The pet's interrupt (Spell Lock or Seduction) is the RT + B macro." + FLYOUTS, [
    {
      base: { DU: "Shadow Bolt", DR: "Immolate", DD: "Drain Life", DL: "Fear" },
      rt: { X: "Corruption", Y: "Curse of Agony", A: "Shadowburn", B: "Seduce / Spell Lock", DL: "Drain Soul", DU: "Searing Pain", DR: "Rain of Fire", DD: "Shoot" },
      lt: { X: "Life Tap", Y: "Curse of Weakness", A: "Siphon Life", B: "Use Healthstone", DU: "Pet Attack", DR: "Health Funnel", DD: "Pet Follow", DL: "Curse of Recklessness" },
      both: { X: "Death Coil", Y: "Howl of Terror", A: "Amplify Curse", B: "Shadow Ward", DL: "Inferno", DU: "Fel Domination", DR: "Hellfire", DD: "Curse of Doom" },
    },
    WARLOCK_OUT,
  ]),
  starter("warrior", "Warrior starter", "WARRIOR", RULES + " Everything a warrior presses is instant, so the d-pad with no trigger holds the core rotation instead." + FLYOUTS, [
    {
      base: { DU: "Heroic Strike", DR: "Rend", DD: "Hamstring", DL: "Charge" },
      rt: { X: "Overpower", Y: "Execute", A: "Mortal Strike", B: "Pummel", DL: "Sunder Armor", DU: "Cleave", DR: "Thunder Clap", DD: "Victory Rush" },
      lt: { X: "Demoralizing Shout", Y: "Battle Shout", A: "Intimidating Shout", B: "Shield Block", DU: "Battle Stance", DR: "Defensive Stance", DD: "Bloodrage", DL: "Taunt" },
      both: { X: "Retaliation", Y: "Shield Wall", A: "Berserker Rage", B: "Challenging Shout", DU: "Whirlwind", DR: "Intercept", DD: "Mocking Blow", DL: "Disarm" },
    },
    { base: { DU: "Battle Shout", DD: "Hearthstone" }, rt: { X: "Shield Bash", Y: "Revenge", A: "Slam", B: "Bloodthirst" } },
  ]),
  starter("paladin", "Paladin starter", "PALADIN", RULES + " Hammer of Justice is the RT + B stop." + HEALER + FLYOUTS, [
    {
      base: { DU: "Holy Light", DR: "Flash of Light", DD: "Hammer of Wrath", DL: "Holy Wrath" },
      rt: { X: "Judgement", Y: "Seal of Righteousness", A: "Seal of the Crusader", B: "Hammer of Justice", DL: "Consecration", DU: "Exorcism", DR: "Seal of Command", DD: "Holy Shock" },
      lt: { X: "Purify", Y: "Blessing of Freedom", A: "Seal of Justice", B: "Divine Protection", DU: "Seal of Wisdom", DR: "Seal of Light", DD: "Turn Undead", DL: "Righteous Fury" },
      both: { X: "Lay on Hands", Y: "Blessing of Protection", A: "Divine Intervention", B: "Blessing of Sacrifice", DU: "Devotion Aura", DR: "Retribution Aura", DD: "Concentration Aura", DL: "Cleanse" },
    },
    {
      base: { DU: "Blessing of Might", DR: "Blessing of Wisdom", DD: "Blessing of Kings", DL: "Redemption" },
      rt: { X: "Greater Blessing of Might", Y: "Greater Blessing of Wisdom", A: "Greater Blessing of Kings", B: "Hearthstone" },
    },
  ]),
  starter("hunter", "Hunter starter", "HUNTER", RULES + " Hunters have no baseline interrupt, so RT + B holds Concussive Shot, and the emergency LT + B is Feign Death." + FLYOUTS, [
    {
      base: { DU: "Aimed Shot", DR: "Multi-Shot", DD: "Volley", DL: "Scare Beast" },
      rt: { X: "Arcane Shot", Y: "Serpent Sting", A: "Auto Shot", B: "Concussive Shot", DL: "Raptor Strike", DU: "Mongoose Bite", DR: "Wing Clip", DD: "Hunter's Mark" },
      lt: { X: "Mend Pet", Y: "Pet Attack", A: "Pet Follow", B: "Feign Death", DU: "Freezing Trap", DR: "Immolation Trap", DD: "Frost Trap", DL: "Explosive Trap" },
      both: { X: "Rapid Fire", Y: "Disengage", A: "Counterattack", B: "Flare", DU: "Aspect of the Hawk", DR: "Aspect of the Monkey", DD: "Aspect of the Cheetah", DL: "Aspect of the Pack" },
    },
    {
      base: { DU: "Call Pet", DR: "Revive Pet", DD: "Feed Pet", DL: "Dismiss Pet" },
      rt: { X: "Tame Beast", Y: "Track Beasts", A: "Track Humanoids", B: "Hearthstone" },
      lt: { X: "Eagle Eye", Y: "Eyes of the Beast", A: "Beast Lore", B: "Aspect of the Wild" },
    },
  ]),
  starter("rogue", "Rogue starter", "ROGUE", RULES + " Everything a rogue presses is instant, so the d-pad with no trigger holds the core rotation instead.", [
    {
      base: { DU: "Sinister Strike", DR: "Eviscerate", DD: "Slice and Dice", DL: "Backstab" },
      rt: { X: "Gouge", Y: "Rupture", A: "Ambush", B: "Kick", DL: "Garrote", DU: "Cheap Shot", DR: "Kidney Shot", DD: "Expose Armor" },
      lt: { X: "Sap", Y: "Feint", A: "Stealth", B: "Evasion", DU: "Distract", DR: "Pick Pocket", DD: "Pick Lock", DL: "Disarm Trap" },
      both: { X: "Sprint", Y: "Vanish" },
    },
    { base: { DD: "Hearthstone" } },
  ]),
  starter("priest", "Priest starter", "PRIEST", RULES + " Priests have no baseline interrupt, so RT + B holds Psychic Scream; the emergency LT + B is Desperate Prayer." + HEALER, [
    {
      base: { DU: "Heal", DR: "Flash Heal", DD: "Mind Blast", DL: "Smite" },
      rt: { X: "Shadow Word: Pain", Y: "Power Word: Shield", A: "Renew", B: "Psychic Scream", DL: "Mind Flay", DU: "Holy Fire", DR: "Devouring Plague", DD: "Shoot" },
      lt: { X: "Dispel Magic", Y: "Cure Disease", A: "Abolish Disease", B: "Desperate Prayer", DU: "Prayer of Healing", DR: "Holy Nova", DD: "Mana Burn", DL: "Fade" },
      both: { X: "Fear Ward", Y: "Inner Fire", A: "Penance", B: "Prayer of Mending", DU: "Mind Control", DR: "Shackle Undead", DD: "Mind Soothe", DL: "Feedback" },
    },
    {
      base: { DU: "Power Word: Fortitude", DR: "Divine Spirit", DD: "Shadow Protection", DL: "Resurrection" },
      rt: { X: "Levitate", Y: "Mind Vision", B: "Hearthstone" },
    },
  ]),
  starter("shaman", "Shaman starter", "SHAMAN", RULES + " Earth Shock interrupts, so it is the RT + B button; Grounding Totem is the emergency LT + B." + HEALER + FLYOUTS, [
    {
      base: { DU: "Healing Wave", DR: "Lesser Healing Wave", DD: "Lightning Bolt", DL: "Chain Lightning" },
      rt: { X: "Lightning Shield", Y: "Flame Shock", A: "Frost Shock", B: "Earth Shock", DL: "Searing Totem", DU: "Magma Totem", DR: "Fire Nova", DD: "Purge" },
      lt: { X: "Earthbind Totem", Y: "Stoneskin Totem", A: "Strength of Earth Totem", B: "Grounding Totem", DU: "Healing Stream Totem", DR: "Mana Spring Totem", DD: "Tremor Totem", DL: "Poison Cleansing Totem" },
      both: { X: "Chain Heal", Y: "Mana Tide Totem", A: "Windfury Totem", B: "Stoneclaw Totem", DU: "Rockbiter Weapon", DR: "Flametongue Weapon", DD: "Windfury Weapon", DL: "Frostbrand Weapon" },
    },
    {
      base: { DU: "Ghost Wolf", DR: "Ancestral Spirit", DD: "Astral Recall", DL: "Water Walking" },
      rt: { X: "Far Sight", Y: "Water Breathing", A: "Cure Poison", B: "Hearthstone" },
    },
  ]),
  starter("mage", "Mage starter", "MAGE", RULES + " Counterspell is RT + B; the emergency LT + B is Ice Barrier (Mana Shield before you have it)." + FLYOUTS, [
    {
      base: { DU: "Frostbolt", DR: "Fireball", DD: "Polymorph", DL: "Pyroblast" },
      rt: { X: "Fire Blast", Y: "Ice Lance", A: "Frost Nova", B: "Counterspell", DL: "Arcane Missiles", DU: "Scorch", DR: "Blizzard", DD: "Flamestrike" },
      lt: { X: "Arcane Explosion", Y: "Cone of Cold", A: "Blink", B: "Ice Barrier", DU: "Frost Ward", DR: "Fire Ward", DD: "Remove Lesser Curse", DL: "Shoot" },
      both: { X: "Evocation", Y: "Blast Wave", A: "Mana Shield", B: "Arcane Blast", DU: "Frost Armor", DR: "Ice Armor", DD: "Mage Armor", DL: "Dampen Magic" },
    },
    {
      base: { DU: "Arcane Intellect", DR: "Conjure Water", DD: "Conjure Food", DL: "Conjure Mana Agate" },
      rt: { X: "Teleport: Stormwind", Y: "Teleport: Ironforge", A: "Teleport: Orgrimmar", B: "Hearthstone" },
      lt: { X: "Slow Fall", Y: "Amplify Magic" },
    },
  ]),
  starter("druid", "Druid starter", "DRUID", RULES + " RT holds caster spells and LT holds cat and bear moves; Bash is the RT + B stop and Barkskin the emergency LT + B. The forms sit together on the LT + RT d-pad." + HEALER + FLYOUTS, [
    {
      base: { DU: "Healing Touch", DR: "Regrowth", DD: "Wrath", DL: "Starfire" },
      rt: { X: "Moonfire", Y: "Rejuvenation", A: "Insect Swarm", B: "Bash", DL: "Entangling Roots", DU: "Faerie Fire", DR: "Hibernate", DD: "Hurricane" },
      lt: { X: "Claw", Y: "Rake", A: "Shred", B: "Barkskin", DU: "Maul", DR: "Swipe", DD: "Ferocious Bite", DL: "Rip" },
      both: { X: "Innervate", Y: "Tranquility", A: "Rebirth", B: "Frenzied Regeneration", DU: "Bear Form", DR: "Cat Form", DD: "Travel Form", DL: "Aquatic Form" },
    },
    {
      base: { DU: "Mark of the Wild", DR: "Thorns", DD: "Revive", DL: "Teleport: Moonglade" },
      rt: { X: "Prowl", Y: "Dash", A: "Remove Curse", B: "Hearthstone" },
      lt: { X: "Abolish Poison", Y: "Cure Poison" },
    },
  ]),
  starter("shane", "Shane's level 10 Warlock (Steam Controller)", "WARLOCK",
    "Voice chat sits on a long press of Select, so all four back buttons hold spells: the instants pressed most (Corruption, Curse of Agony, Life Tap, Shoot), castable without leaving the sticks. They send F23, F24, F9 and F10, keys that reach WoW under Proton as well as on Windows. Cast-time spells sit on the d-pad with no trigger, because you stand still to cast them. The same instants are also on RT for moving. Life Tap stays on LT, close to the attacks, because a warlock taps all the time. RT + B is Pet Attack until the pet's interrupt (Spell Lock or Seduction) arrives, and LT + B is the emergency Healthstone. The summons and Demon Skin are out-of-combat, so they sit behind LT + RT.",
    [
      {
        base: { DU: "Shadow Bolt", DR: "Immolate", DD: "Drain Soul", DL: "Fear" },
        rt: { X: "Corruption", Y: "Curse of Agony", A: "Shoot", B: "Pet Attack" },
        lt: { X: "Life Tap", Y: "Curse of Weakness", A: "Pet Follow", B: "Use Healthstone" },
        both: { X: "Demon Skin", Y: "Create Healthstone", A: "Summon Imp", B: "Summon Voidwalker" },
      },
      { base: { DU: "Summon Imp", DR: "Summon Voidwalker", DD: "Hearthstone", DL: "Demon Skin" }, rt: { X: "Create Healthstone" } },
    ],
    {
      controller: "steam",
      level: 10,
      paddles: layers({ base: { R4: "Corruption", R5: "Curse of Agony", L4: "Life Tap", L5: "Shoot" } }),
      back: {
        L4: { use: "slot", key: "F9", note: "" },
        L5: { use: "slot", key: "F10", note: "" },
        R4: { use: "slot", key: "F23", note: "" },
        R5: { use: "slot", key: "F24", note: "" },
      },
    }),
];
