local START_KNOWN = {
    ["Shadow Bolt"] = 686, ["Immolate"] = 348, ["Corruption"] = 172, ["Life Tap"] = 1454, ["Demon Skin"] = 687,
    ["Summon Imp"] = 688, ["Fear"] = 5782, ["Curse of Agony"] = 980, ["Shoot"] = 5019,
    ["Curse of Weakness"] = 702, ["Drain Soul"] = 1120, ["Create Healthstone"] = 6201,
}

local function Copy(source)
    local out = {}
    for key, value in pairs(source) do out[key] = value end
    return out
end

local function Fresh(saved)
    local world = { cursor = nil, actions = {}, macros = {}, printed = {}, backhandCalls = {}, bindings = { F9 = "OPENBAG3", F12 = "OPENALLBAGS", PAGEDOWN = "CHATPAGEDOWN" }, combat = false, frames = {} }
    world.known = Copy(START_KNOWN)
    local function byId(id)
        for name, known in pairs(world.known) do
            if known == id then return name end
        end
    end
    DEFAULT_CHAT_FRAME = { AddMessage = function(_, message) world.printed[#world.printed + 1] = message end }
    C_Spell = {
        GetSpellName = function(id) return byId(id) end,
        GetSpellInfo = function(name) return world.known[name] and { spellID = world.known[name] } end,
        PickupSpell = function(id) world.cursor = { "spell", id } end,
    }
    C_Item = { PickupItem = function(id) world.cursor = { "item", id } end, GetItemNameByID = function() return "Hearthstone" end }
    C_ActionBar = { HasAction = function(slot) return world.actions[slot] ~= nil end }
    C_GamepadUI = { IsValidGamepadActionStorageSlotIndex = function(slot) return slot and slot > 0 end }
    C_Timer = { After = function(_, callback) callback() end }
    GamepadActionBarBindingUtil = { GetGamepadStorageSlotIndexFromPageAndPageUnitSlotID = function(page, unit) return 200 + (page - 1) * 32 + unit end }
    BackhandCharDB = { nativeSlots = { 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516 } }
    BackhandDB = { paddleKeys = { P1 = "PADPADDLE1", P2 = "PADPADDLE2", P3 = "PADPADDLE3", P4 = "PADPADDLE4" } }
    ClearCursor = function() world.cursor = nil end
    GetCursorInfo = function() return world.cursor and world.cursor[1] end
    PlaceAction = function(slot) world.actions[slot] = world.cursor end
    PickupAction = function(slot) world.cursor = world.actions[slot]; world.actions[slot] = nil end
    InCombatLockdown = function() return world.combat end
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
    GetBindingAction = function(key) return world.bindings[key] end
    world.overrides = {}
    ClearOverrideBindings = function() world.overrides = {} end
    SetOverrideBindingClick = function(_, _, key, button) world.overrides[key] = button end
    SetBinding = function(key, action) world.bindings[key] = action end
    SaveBindings = function() world.bindingsSaved = true end
    GetCurrentBindingSet = function() return 2 end
    UnitClass = function() return "Warlock", "WARLOCK" end
    strtrim = function(text) return (text:gsub("^%s+", ""):gsub("%s+$", "")) end
    CreateFrame = function()
        local frame = { events = {} }
        function frame:RegisterEvent(event) self.events[event] = true end
        function frame:SetScript(_, handler) self.handler = handler end
        world.frames[#world.frames + 1] = frame
        return frame
    end
    SlashCmdList = {
        BACKHAND = function(message)
            world.backhandCalls[#world.backhandCalls + 1] = message
            local index = 0
            for key in message:gmatch("%S+") do
                if key ~= "keys" then
                    index = index + 1
                    BackhandDB.paddleKeys["P" .. index] = key
                end
            end
        end,
    }
    PadPlanData = nil
    PadPlanCharDB = saved
    return world
end

local function Load(world, dataFile)
    local ns = {}
    if dataFile then dofile(dataFile) end
    assert(loadfile("addon/PadPlan/Import.lua"))("PadPlan", ns)
    assert(loadfile("addon/PadPlan/PadPlan.lua"))("PadPlan", ns)
    world.ns = ns
    return ns
end

local function Fire(world, event, ...)
    for _, frame in ipairs(world.frames) do
        if frame.handler and frame.events[event] then frame.handler(frame, event, ...) end
    end
end

local function Login(world)
    Fire(world, "ADDON_LOADED", "PadPlan")
    Fire(world, "PLAYER_ENTERING_WORLD")
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

local function Printed(world, text)
    for _, line in ipairs(world.printed) do
        if line:find(text, 1, true) then return true end
    end
    return false
end

local function Check(condition, message)
    if not condition then error(message, 2) end
    print("ok  " .. message)
end

local first = Fresh(nil)
Load(first, "dist/shane-data.lua")
Login(first)
Check(Printed(first, "Layout changed, applied \"Shane's level 10 Warlock (Steam Controller)\": placed"), "a new layout applies by itself at login, with one line saying so")
Check(first.actions[503] ~= nil and first.actions[503][2] == 686, "back-button slots get their spells (R4 is Shadow Bolt)")
Check(first.backhandCalls[1] == "keys F9 F10 F11 F12", "Backhand is given the four back-button keys in order")
Check(first.bindings.F9 == nil and first.bindings.F12 == nil and first.bindingsSaved and Printed(first, "Cleared the old key bindings on F9"), "the bag bindings already on those keys are cleared first")
local function NotLearnedLine(world)
    for _, line in ipairs(world.printed) do
        if line:find("Not learned yet:", 1, true) then return line end
    end
    return ""
end
Check(NotLearnedLine(first):find("Summon Voidwalker", 1, true) ~= nil and NotLearnedLine(first):find("Pet Attack", 1, true) == nil, "the spells not learned yet are named")
Check(first.overrides.HOME == "PadPlanNoop" and first.overrides.PAGEUP == "PadPlanNoop" and first.bindings.PAGEDOWN == nil, "keys another tool sends are cleared and swallowed so WoW ignores them")
local fileResult = Snapshot(first)
local saved = PadPlanCharDB

local LATER = {
    ["Summon Voidwalker"] = 697, ["Drain Life"] = 689, ["Health Funnel"] = 755, ["Searing Pain"] = 5676, ["Rain of Fire"] = 5740,
    ["Curse of Recklessness"] = 704, ["Unending Breath"] = 5697, ["Eye of Kilrogg"] = 126, ["Sense Demons"] = 5500,
    ["Detect Invisibility"] = 2970, ["Ritual of Summoning"] = 698, ["Create Soulstone"] = 693, ["Summon Succubus"] = 712, ["Summon Felhunter"] = 691,
}
local function LearnEverything(world)
    for name, id in pairs(LATER) do world.known[name] = id end
end

local again = Fresh(saved)
Load(again, "dist/shane-data.lua")
LearnEverything(again)
Login(again)
Check(Printed(again, "applied") and again.actions[202] ~= nil, "a layout still waiting for a spell applies again once it is learned")

local quiet = Fresh(PadPlanCharDB)
Load(quiet, "dist/shane-data.lua")
LearnEverything(quiet)
quiet.bindings = {}
BackhandDB.paddleKeys = { P1 = "F9", P2 = "F10", P3 = "F11", P4 = "F12" }
Login(quiet)
Check(#quiet.printed == 0 and #quiet.backhandCalls == 0, "an unchanged, fully applied layout does nothing at the next login")

local fighting = Fresh(nil)
Load(fighting, "dist/shane-data.lua")
fighting.combat = true
Login(fighting)
Check(next(fighting.actions) == nil, "nothing is placed during combat")
fighting.combat = false
Fire(fighting, "PLAYER_REGEN_ENABLED")
Check(Snapshot(fighting) == fileResult, "it applies as soon as combat ends")

local learning = Fresh(nil)
Load(learning, "dist/shane-data.lua")
Login(learning)
learning.printed = {}
learning.known["Summon Voidwalker"] = 697
Fire(learning, "LEARNED_SPELL_IN_TAB")
Check(Printed(learning, "applied") and learning.actions[202] ~= nil, "learning a spell the layout waits for places it")

local imported = Fresh(nil)
local ns = Load(imported, nil)
Fire(imported, "ADDON_LOADED", "PadPlan")
ns.Import(io.open("dist/shane.padplan"):read("a"))
Check(PadPlanCharDB.plan.name == "Shane's level 10 Warlock (Steam Controller)", "a pasted code is stored per character with its name")
Check(Snapshot(imported) == fileResult, "an imported code places exactly what the Lua file places, right away")

local replaced = Fresh(PadPlanCharDB)
Load(replaced, "dist/shane-data.lua")
PadPlanData.name = "A newer layout"
Login(replaced)
Check(PadPlanCharDB.plan == nil and Printed(replaced, "replaces the layout imported earlier") and Printed(replaced, "\"A newer layout\""), "a newly installed PadPlanData.lua replaces an older imported code")

local damaged = Fresh(nil)
local damagedNs = Load(damaged, nil)
Fire(damaged, "ADDON_LOADED", "PadPlan")
damagedNs.Import("PADPLAN1:bm90IGEgcGxhbg==")
Check(PadPlanCharDB.plan == nil and Printed(damaged, "damaged"), "a damaged code stores nothing and says so")

local clicked = Fresh(nil)
Load(clicked, "dist/shane-data.lua")
Fire(clicked, "ADDON_LOADED", "PadPlan")
PadPlan_OnAddonCompartmentClick(nil, "LeftButton")
Check(Snapshot(clicked) == fileResult, "clicking PadPlan in the addon menu applies the layout")
