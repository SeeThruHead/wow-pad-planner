local _, ns = ...

local BAR = { base = 0, lt = 1, rt = 2, both = 3 }
local BUTTON = { DL = 1, DU = 2, DR = 3, DD = 4, X = 5, Y = 6, B = 7, A = 8 }
local LAYERS = { "base", "lt", "rt", "both" }
local LAYER_LABEL = { base = "No trigger", lt = "LT", rt = "RT", both = "LT+RT" }
local BAR_KEYS = { base = { "DU", "DR", "DD", "DL" }, lt = { "DU", "DR", "DD", "DL", "X", "Y", "B", "A" } }
BAR_KEYS.rt, BAR_KEYS.both = BAR_KEYS.lt, BAR_KEYS.lt
local PANEL = { base = 1, lt = 2, rt = 3, both = 4 }

local function Print(text, ...)
    DEFAULT_CHAT_FRAME:AddMessage("|cff33ccffPadPlan|r " .. string.format(text, ...))
end

local function SpellName(id)
    if C_Spell and C_Spell.GetSpellName then return C_Spell.GetSpellName(id) end
    return GetSpellInfo and (GetSpellInfo(id))
end

local function KnownSpellID(name)
    if C_Spell and C_Spell.GetSpellInfo then
        local info = C_Spell.GetSpellInfo(name)
        return info and info.spellID
    end
    return GetSpellInfo and select(7, GetSpellInfo(name))
end

local function Candidates(entry)
    local fromId = entry.id and SpellName(entry.id)
    local names = { fromId }
    for _, name in ipairs(entry.names or {}) do names[#names + 1] = name end
    return names
end

local function PickUpSpell(entry)
    local pickup = (C_Spell and C_Spell.PickupSpell) or PickupSpell
    for _, name in pairs(Candidates(entry)) do
        local id = name and KnownSpellID(name)
        if id then
            ClearCursor()
            pickup(id)
            if GetCursorInfo() then return true end
        end
    end
    return false, "not learned yet"
end

local function MacroIcon(icon)
    local id = GetFileIDFromPath and GetFileIDFromPath("Interface\\Icons\\" .. icon)
    return id or "INV_MISC_QUESTIONMARK"
end

local function EnsureMacro(entry)
    local index = GetMacroIndexByName(entry.name)
    if index and index > 0 then
        EditMacro(index, entry.name, MacroIcon(entry.icon), entry.body)
        return index
    end
    local _, perCharacter = GetNumMacros()
    if perCharacter >= (MAX_CHARACTER_MACROS or 18) then return nil end
    local ok, created = pcall(CreateMacro, entry.name, MacroIcon(entry.icon), entry.body, true)
    return ok and created or nil
end

local function PickUp(entry)
    if entry.kind == "spell" then return PickUpSpell(entry) end
    if entry.kind == "macro" then
        local index = EnsureMacro(entry)
        if not index then return false, "no free character macro slot" end
        PickupMacro(index)
    elseif entry.kind == "item" then
        local pickup = (C_Item and C_Item.PickupItem) or PickupItem
        pickup(entry.id)
    end
    if not GetCursorInfo() then return false, "could not pick up" end
    return true
end

local function Describe(entry)
    if entry.kind == "spell" then return (entry.names and entry.names[1]) or SpellName(entry.id) or "spell" end
    return entry.name
end

local function BarSlot(set, layer, key)
    return GamepadActionBarBindingUtil.GetGamepadStorageSlotIndexFromPageAndPageUnitSlotID(set, BAR[layer] * 8 + BUTTON[key])
end

local function PaddleSlots()
    local slots = BackhandCharDB and BackhandCharDB.nativeSlots
    if type(slots) ~= "table" or #slots ~= 16 then return nil end
    return slots
end

local function PaddleSlot(slots, layer, paddleIndex)
    return slots and slots[(PANEL[layer] - 1) * 4 + paddleIndex]
end

local function CurrentPlan()
    local imported = PadPlanCharDB and PadPlanCharDB.plan
    return imported or PadPlanData
end

local function ForEachSlot(visit)
    local data = CurrentPlan()
    for set, plan in ipairs(data.sets) do
        for _, layer in ipairs(LAYERS) do
            local entries = plan.layers[layer] or {}
            for _, key in ipairs(BAR_KEYS[layer]) do
                visit(string.format("Set %d %s %s", set, LAYER_LABEL[layer], key), BarSlot(set, layer, key), entries[key])
            end
        end
    end
    local slots = PaddleSlots()
    if not slots then return end
    for _, layer in ipairs(LAYERS) do
        local entries = data.paddles[layer] or {}
        for index, key in ipairs(data.paddleOrder) do
            visit(string.format("Paddle %s %s", LAYER_LABEL[layer], key), PaddleSlot(slots, layer, index), entries[key])
        end
    end
end

local function ValidSlot(slot)
    return slot and C_GamepadUI.IsValidGamepadActionStorageSlotIndex(slot)
end

local function ClearSlot(slot)
    if not C_ActionBar.HasAction(slot) then return end
    PickupAction(slot)
    ClearCursor()
end

local function Ready()
    if InCombatLockdown() then
        Print("Can't change action slots in combat.")
        return false
    end
    if not GamepadActionBarBindingUtil then
        Print("The gamepad bars aren't loaded. Switch to gamepad mode first.")
        return false
    end
    if not CurrentPlan() then
        Print("No layout yet. Type /padplan import and paste the code from the planner.")
        return false
    end
    return true
end

local function Apply()
    if not Ready() then return end
    local placed, cleared, skipped, unlearned = 0, 0, {}, {}
    ForEachSlot(function(where, slot, entry)
        if not ValidSlot(slot) then
            if entry then skipped[#skipped + 1] = where .. " (" .. Describe(entry) .. "): no slot" end
            return
        end
        if not entry then
            if C_ActionBar.HasAction(slot) then cleared = cleared + 1 end
            ClearSlot(slot)
            return
        end
        ClearCursor()
        local ok, reason = PickUp(entry)
        if ok then
            PlaceAction(slot)
            placed = placed + 1
        elseif reason == "not learned yet" then
            ClearSlot(slot)
            unlearned[Describe(entry)] = true
        else
            ClearSlot(slot)
            skipped[#skipped + 1] = where .. " (" .. Describe(entry) .. "): " .. reason
        end
        ClearCursor()
    end)
    Print("Placed %d, emptied %d.", placed, cleared)
    local names = {}
    for name in pairs(unlearned) do names[#names + 1] = name end
    table.sort(names)
    if #names > 0 then Print("Not learned yet, slots left empty: %s.", table.concat(names, ", ")) end
    for _, line in ipairs(skipped) do Print("  skipped %s", line) end
    local order = CurrentPlan().paddleOrder or {}
    if #order > 0 and not PaddleSlots() then
        Print("Backhand has no paddle slots on this character yet, so the back buttons were left out. In /backhand assign P1-P%d by pressing %s, then apply again.", #order, table.concat(order, ", "))
    end
end

local function Holds(slot)
    local kind, id = GetActionInfo(slot)
    if not kind then return "empty" end
    if kind == "spell" then return SpellName(id) or ("spell " .. id) end
    if kind == "macro" then return GetActionText(slot) or "macro" end
    if kind == "item" then return (C_Item.GetItemNameByID and C_Item.GetItemNameByID(id)) or ("item " .. id) end
    return kind
end

local function Matches(slot, entry)
    local holds = Holds(slot)
    if not entry then return holds == "empty" end
    if entry.kind == "spell" then
        for _, name in pairs(Candidates(entry)) do
            if name == holds then return true end
        end
        return false
    end
    return holds == entry.name
end

local function Check()
    if not Ready() then return end
    local matched, problems = 0, {}
    ForEachSlot(function(where, slot, entry)
        if not ValidSlot(slot) then return end
        if Matches(slot, entry) then
            matched = matched + 1
            return
        end
        problems[#problems + 1] = string.format("%s: planned %s, has %s", where, entry and Describe(entry) or "empty", Holds(slot))
    end)
    Print("%d slots match the plan, %d differ.", matched, #problems)
    for _, line in ipairs(problems) do Print("  %s", line) end
end

local function Show()
    local plan = CurrentPlan()
    if not plan then return Print("No layout yet. Type /padplan import and paste the code from the planner.") end
    Print("Layout: %s%s", plan.name or "unnamed", PadPlanCharDB and PadPlanCharDB.plan and " (imported)" or " (from PadPlanData.lua)")
    ForEachSlot(function(where, slot, entry)
        if entry then Print("%s: %s (slot %s)", where, Describe(entry), tostring(slot)) end
    end)
    Print("/padplan import, /padplan apply, /padplan check, /padplan forget.")
end

local function CountEntries(plan)
    local count = 0
    for _, set in ipairs(plan.sets) do
        for _, layer in pairs(set.layers) do
            for _ in pairs(layer) do count = count + 1 end
        end
    end
    for _, layer in pairs(plan.paddles) do
        for _ in pairs(layer) do count = count + 1 end
    end
    return count
end

function ns.Import(code)
    local plan, problem = ns.DecodeCode(code)
    if not plan then return Print(problem) end
    PadPlanCharDB = PadPlanCharDB or {}
    PadPlanCharDB.plan = plan
    Print("Imported \"%s\" (%d slots). Type /padplan apply to place it.", plan.name, CountEntries(plan))
    local _, playerClass = UnitClass("player")
    if plan.class and playerClass and plan.class ~= playerClass then
        Print("This layout is for a %s, and this character is a %s; spells it can't cast will be skipped.", plan.class, playerClass)
    end
end

local function Forget()
    if PadPlanCharDB then PadPlanCharDB.plan = nil end
    Print(PadPlanData and "Forgot the imported layout; PadPlanData.lua is used again." or "Forgot the imported layout.")
end

SLASH_PADPLAN1 = "/padplan"
SlashCmdList.PADPLAN = function(message)
    local command = strtrim(message or ""):lower()
    if command == "apply" then return Apply() end
    if command == "check" then return Check() end
    if command == "import" then return ns.ShowImport() end
    if command == "forget" then return Forget() end
    Show()
end
