local known = {
    ["Shadow Bolt"] = 686, ["Immolate"] = 348, ["Corruption"] = 172, ["Life Tap"] = 1454, ["Demon Skin"] = 687,
    ["Summon Imp"] = 688, ["Summon Voidwalker"] = 697, ["Fear"] = 5782, ["Curse of Agony"] = 980, ["Shoot"] = 5019,
    ["Curse of Weakness"] = 702, ["Drain Soul"] = 1120, ["Create Healthstone"] = 6201,
}
local byId = {}
for name, id in pairs(known) do byId[id] = name end

local function Fresh()
    local world = { cursor = nil, actions = {}, macros = {}, printed = {} }
    DEFAULT_CHAT_FRAME = { AddMessage = function(_, message) world.printed[#world.printed + 1] = message end }
    C_Spell = {
        GetSpellName = function(id) return byId[id] end,
        GetSpellInfo = function(name) return known[name] and { spellID = known[name] } end,
        PickupSpell = function(id) world.cursor = { "spell", id } end,
    }
    C_Item = { PickupItem = function(id) world.cursor = { "item", id } end, GetItemNameByID = function() return "Hearthstone" end }
    C_ActionBar = { HasAction = function(slot) return world.actions[slot] ~= nil end }
    C_GamepadUI = { IsValidGamepadActionStorageSlotIndex = function(slot) return slot and slot > 0 end }
    GamepadActionBarBindingUtil = { GetGamepadStorageSlotIndexFromPageAndPageUnitSlotID = function(page, unit) return 200 + (page - 1) * 32 + unit end }
    BackhandCharDB = { nativeSlots = { 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516 } }
    ClearCursor = function() world.cursor = nil end
    GetCursorInfo = function() return world.cursor and world.cursor[1] end
    PlaceAction = function(slot) world.actions[slot] = world.cursor end
    PickupAction = function(slot) world.cursor = world.actions[slot]; world.actions[slot] = nil end
    InCombatLockdown = function() return false end
    GetMacroIndexByName = function(name)
        for index, macro in ipairs(world.macros) do
            if macro.name == name then return index end
        end
        return 0
    end
    GetNumMacros = function() return 0, #world.macros end
    CreateMacro = function(name, _, body) world.macros[#world.macros + 1] = { name = name, body = body }; return #world.macros end
    EditMacro = function() end
    PickupMacro = function(index) world.cursor = { "macro", index } end
    GetFileIDFromPath = function() return 1 end
    GetActionInfo = function(slot)
        local action = world.actions[slot]
        if action then return action[1], action[2] end
    end
    GetActionText = function(slot)
        local action = world.actions[slot]
        return action and world.macros[action[2]] and world.macros[action[2]].name
    end
    UnitClass = function() return "Warlock", "WARLOCK" end
    strtrim = function(text) return (text:gsub("^%s+", ""):gsub("%s+$", "")) end
    SlashCmdList = {}
    PadPlanData = nil
    PadPlanCharDB = nil
    return world
end

local function Load(dataFile)
    local ns = {}
    if dataFile then dofile(dataFile) end
    assert(loadfile("addon/PadPlan/Import.lua"))("PadPlan", ns)
    assert(loadfile("addon/PadPlan/PadPlan.lua"))("PadPlan", ns)
    return ns
end

local function Snapshot(world)
    local rows = {}
    for slot, action in pairs(world.actions) do
        local what = action[1] == "macro" and world.macros[action[2]].name or tostring(action[2])
        rows[#rows + 1] = slot .. "=" .. action[1] .. ":" .. what
    end
    table.sort(rows)
    return table.concat(rows, "\n")
end

local function Check(condition, message)
    if not condition then error(message, 2) end
    print("ok  " .. message)
end

local fromFile = Fresh()
Load("dist/shane-data.lua")
SlashCmdList.PADPLAN("apply")
local fileResult = Snapshot(fromFile)

local fromCode = Fresh()
local ns = Load(nil)
local code = io.open("dist/shane.padplan"):read("a")
ns.Import(code)
Check(PadPlanCharDB and PadPlanCharDB.plan and PadPlanCharDB.plan.name == "Shane's level 10 Warlock (Steam Controller)", "a pasted code is stored per character with its name")
Check(fromCode.printed[1]:find("Imported", 1, true) ~= nil, "importing says what was imported")
SlashCmdList.PADPLAN("apply")
local codeResult = Snapshot(fromCode)

Check(codeResult == fileResult, "applying the imported code places exactly what the Lua file places")
Check(codeResult:find("201=spell:695", 1, true) == nil and codeResult:find("=spell:686", 1, true) ~= nil, "spells go on by name at the rank the character knows")
Check(fromCode.actions[503] ~= nil and fromCode.actions[503][2] == 172, "back-button slots get their spells (R4 is Corruption)")
Check(#fromCode.macros == 3 and fromCode.macros[1].body ~= "", "macros are created with their text")

local damaged = Fresh()
local damagedNs = Load(nil)
damagedNs.Import("PADPLAN1:bm90IGEgcGxhbg==")
Check(PadPlanCharDB == nil, "a damaged code stores nothing")
Check(damaged.printed[1]:find("damaged", 1, true) ~= nil, "a damaged code says so")

local wrong = Fresh()
local wrongNs = Load(nil)
wrongNs.Import("WPP1:abc")
Check(wrong.printed[1]:find("isn't a PadPlan code", 1, true) ~= nil, "a planner share code is refused with a hint")
