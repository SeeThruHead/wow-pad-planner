-- Shane's level 10 Warlock (Steam Controller), from the gamepad bar planner.
PadPlanData = {
  version = 1,
  name = "Shane's level 10 Warlock (Steam Controller)",
  class = "WARLOCK",
  paddleOrder = { "L4", "L5", "R4", "R5" },
  paddleKeys = { "F9", "F10", "F11", "F12" },
  reservedKeys = { "HOME", "INSERT", "DELETE", "END", "PAGEUP", "PAGEDOWN" },
  sets = {
    {
      name = "Combat",
      layers = {
        base = {
          DU = { kind = "spell", id = 697, names = { "Summon Voidwalker" } },
          DR = { kind = "spell", id = 688, names = { "Summon Imp" } },
          DD = { kind = "macro", name = "PP Pet Follow", icon = "ability_tracking", body = "/petfollow" },
          DL = { kind = "spell", id = 687, names = { "Demon Skin" } },
        },
        lt = {
          DU = { kind = "macro", name = "PP Pet Passive", icon = "ability_seal", body = "/petpassive" },
          DD = { kind = "macro", name = "PP Pet Defensive", icon = "ability_defend", body = "/petdefensive" },
          Y = { kind = "spell", id = 702, names = { "Curse of Weakness" } },
          B = { kind = "macro", name = "PP Use Healthsto", icon = "inv_stone_04", body = "#showtooltip\n/use Major Healthstone\n/use Greater Healthstone\n/use Healthstone\n/use Lesser Healthstone\n/use Minor Healthstone" },
          A = { kind = "spell", id = 689, names = { "Drain Life" } },
          X = { kind = "spell", id = 1454, names = { "Life Tap" } },
        },
        rt = {
          DU = { kind = "spell", id = 6201, names = { "Create Healthstone", "Create Healthstone (Major)", "Create Healthstone (Greater)", "Create Healthstone (Lesser)", "Create Healthstone (Minor)" } },
          DD = { kind = "item", id = 6948, name = "Hearthstone" },
          Y = { kind = "spell", id = 5782, names = { "Fear" } },
          B = { kind = "macro", name = "PP Pet Attack", icon = "ability_ghoulfrenzy", body = "/petattack" },
          A = { kind = "spell", id = 5019, names = { "Shoot" } },
          X = { kind = "spell", id = 1120, names = { "Drain Soul" } },
        },
        both = {
          Y = { kind = "spell", id = 5676, names = { "Searing Pain" } },
          B = { kind = "spell", id = 704, names = { "Curse of Recklessness" } },
          A = { kind = "spell", id = 5740, names = { "Rain of Fire" } },
          X = { kind = "spell", id = 755, names = { "Health Funnel" } },
        },
      },
    },
    {
      name = "Out of combat",
      layers = {
        base = {
          DU = { kind = "spell", id = 5697, names = { "Unending Breath" } },
          DR = { kind = "spell", id = 126, names = { "Eye of Kilrogg" } },
          DD = { kind = "spell", id = 5500, names = { "Sense Demons" } },
          DL = { kind = "spell", id = 2970, names = { "Detect Invisibility" } },
        },
        lt = {},
        rt = {
          Y = { kind = "spell", id = 693, names = { "Create Soulstone", "Create Soulstone (Major)", "Create Soulstone (Greater)", "Create Soulstone (Lesser)", "Create Soulstone (Minor)" } },
          B = { kind = "spell", id = 691, names = { "Summon Felhunter" } },
          A = { kind = "spell", id = 712, names = { "Summon Succubus" } },
          X = { kind = "spell", id = 698, names = { "Ritual of Summoning" } },
        },
        both = {},
      },
    },
    {
      name = "Spare",
      layers = {
        base = {},
        lt = {},
        rt = {},
        both = {},
      },
    },
  },
  paddles = {
    base = {
      L4 = { kind = "spell", id = 980, names = { "Curse of Agony", "Bane of Agony" } },
      L5 = { kind = "spell", id = 348, names = { "Immolate" } },
      R4 = { kind = "spell", id = 686, names = { "Shadow Bolt" } },
      R5 = { kind = "spell", id = 172, names = { "Corruption" } },
    },
    lt = {},
    rt = {},
    both = {},
  },
}
