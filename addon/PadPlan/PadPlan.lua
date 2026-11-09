local _, ns = ...

local BAR = { base = 0, lt = 1, rt = 2, both = 3 }
local BUTTON = { DL = 1, DU = 2, DR = 3, DD = 4, X = 5, Y = 6, B = 7, A = 8 }
local LAYERS = { "base", "lt", "rt", "both" }
local LAYER_LABEL = { base = "No trigger", lt = "LT", rt = "RT", both = "LT+RT" }
local BAR_KEYS = { base = { "DU", "DR", "DD", "DL" }, lt = { "DU", "DR", "DD", "DL", "X", "Y", "B", "A" } }
BAR_KEYS.rt, BAR_KEYS.both = BAR_KEYS.lt, BAR_KEYS.lt
local PANEL = { base = 1, lt = 2, rt = 3, both = 4 }
local PADDLE_COUNT = 4
local LOGIN_DELAY = 4

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

local function IsPaddleSlot(slot)
    for _, paddleSlot in ipairs(PaddleSlots() or {}) do
        if paddleSlot == slot then return true end
    end
    return false
end

local function PaddleSlot(slots, layer, paddleIndex)
    return slots and slots[(PANEL[layer] - 1) * 4 + paddleIndex]
end

local function Normalize(text)
    return ((text or ""):gsub("%s", "")):lower()
end

local function MyKeys()
    local name = UnitName("player") or ""
    local realm = (GetNormalizedRealmName and GetNormalizedRealmName()) or (GetRealmName and GetRealmName()) or ""
    return Normalize(name .. "-" .. realm), Normalize(name)
end

local function FileEntry()
    local data = PadPlanData
    if type(data) ~= "table" then return nil end
    if type(data.characters) == "table" then
        local full, short = MyKeys()
        for key, entry in pairs(data.characters) do
            local wanted = Normalize(key)
            if wanted == full or wanted == short then return entry end
        end
        return nil
    end
    local _, playerClass = UnitClass("player")
    if type(data.sets) == "table" and data.class == playerClass then return { autoload = "ask", plan = data } end
    return nil
end

local function FilePlan()
    local entry = FileEntry()
    return entry and entry.plan
end

local function CurrentPlan()
    local imported = PadPlanCharDB and PadPlanCharDB.plan
    return imported or FilePlan()
end

local function Autoload()
    if PadPlanCharDB.plan then return "auto" end
    local entry = FileEntry()
    return entry and entry.autoload or "ask"
end

local function ForEachSlot(visit)
    local data = CurrentPlan()
    for set, plan in ipairs(data.sets) do
        for _, layer in ipairs(LAYERS) do
            local entries = plan.layers[layer] or {}
            for _, key in ipairs(BAR_KEYS[layer]) do
                local slot = BarSlot(set, layer, key)
                if not IsPaddleSlot(slot) then
                    visit(string.format("Set %d %s %s", set, LAYER_LABEL[layer], key), slot, entries[key])
                end
            end
        end
    end
    local slots = PaddleSlots()
    if not slots then return end
    for _, layer in ipairs(LAYERS) do
        local entries = data.paddles[layer] or {}
        for index, key in ipairs(data.paddleOrder or {}) do
            visit(string.format("Back button %s %s", LAYER_LABEL[layer], key), PaddleSlot(slots, layer, index), entries[key])
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

local function Serialize(value)
    if type(value) ~= "table" then return tostring(value) end
    local keys = {}
    for key in pairs(value) do keys[#keys + 1] = tostring(key) end
    table.sort(keys)
    local parts = {}
    for _, key in ipairs(keys) do
        local item = value[key]
        if item == nil then item = value[tonumber(key)] end
        parts[#parts + 1] = key .. "=" .. Serialize(item)
    end
    return "{" .. table.concat(parts, ",") .. "}"
end

local function Blocked()
    if InCombatLockdown() then return "in combat" end
    if not GamepadActionBarBindingUtil then return "the gamepad bars aren't loaded (switch to gamepad mode)" end
    if not CurrentPlan() then return "there is no layout yet" end
    return nil
end

local function SortedNames(set)
    local names = {}
    for name in pairs(set) do names[#names + 1] = name end
    table.sort(names)
    return names
end

local function Place()
    local result = { placed = 0, cleared = 0, skipped = {}, unlearned = {}, back = {} }
    ForEachSlot(function(where, slot, entry)
        if not ValidSlot(slot) then
            if entry then result.skipped[#result.skipped + 1] = where .. " (" .. Describe(entry) .. "): no slot" end
            return
        end
        if not entry then
            if C_ActionBar.HasAction(slot) then result.cleared = result.cleared + 1 end
            ClearSlot(slot)
            return
        end
        ClearCursor()
        local ok, reason = PickUp(entry)
        if ok then
            PlaceAction(slot)
            result.placed = result.placed + 1
            local layer = where:match("^Back button (.-) %S+$")
            if layer then result.back[layer] = (result.back[layer] or 0) + 1 end
        elseif reason == "not learned yet" then
            ClearSlot(slot)
            result.unlearned[Describe(entry)] = true
        else
            ClearSlot(slot)
            result.skipped[#result.skipped + 1] = where .. " (" .. Describe(entry) .. "): " .. reason
        end
        ClearCursor()
    end)
    return result
end

local function BindingAction(key)
    local action = GetBindingAction and GetBindingAction(key, false) or nil
    if not action or action == "" or action:match("^CLICK Backhand") then return nil end
    return action
end

local function SetUpBackhand(plan)
    local order, keys = plan.paddleOrder or {}, plan.paddleKeys or {}
    if #order == 0 or not SlashCmdList.BACKHAND or type(BackhandDB) ~= "table" or type(BackhandDB.paddleKeys) ~= "table" then return false end
    local wanted, changed, freed = {}, false, {}
    for index = 1, PADDLE_COUNT do
        local key = (keys[index] and keys[index] ~= "") and keys[index]:upper() or "NONE"
        wanted[index] = key
        if BackhandDB.paddleKeys["P" .. index] ~= key then changed = true end
        if key ~= "NONE" and BindingAction(key) then
            freed[#freed + 1] = key .. " (was " .. BindingAction(key) .. ")"
            SetBinding(key)
        end
    end
    if #freed > 0 then
        SaveBindings(GetCurrentBindingSet())
        Print("Cleared the old key bindings on %s so the back buttons can use them.", table.concat(freed, ", "))
    end
    if not changed then return false end
    SlashCmdList.BACKHAND("keys " .. table.concat(wanted, " "))
    local described = {}
    for index, button in ipairs(order) do described[#described + 1] = button .. " " .. wanted[index] end
    Print("Set up Backhand's back buttons: %s.", table.concat(described, ", "))
    return true
end

local noop = CreateFrame("Button", "PadPlanNoop", UIParent)

local function ReserveKeys(plan)
    if InCombatLockdown() or not plan then return end
    ClearOverrideBindings(noop)
    local freed = {}
    for _, key in ipairs(plan.reservedKeys or {}) do
        if BindingAction(key) then
            freed[#freed + 1] = key
            SetBinding(key)
        end
        SetOverrideBindingClick(noop, true, key, "PadPlanNoop")
    end
    if #freed > 0 then
        SaveBindings(GetCurrentBindingSet())
        Print("Cleared WoW's bindings on %s, keys another tool sends.", table.concat(freed, ", "))
    end
end

local function Signature(plan)
    return Serialize(plan) .. (PaddleSlots() and "|backhand" or "|nobackhand")
end

local function BackhandProblem()
    if not SlashCmdList.BACKHAND then return "the SNRN Backhand addon isn't installed or is turned off in the AddOns list" end
    local saved = BackhandCharDB and BackhandCharDB.fallbackActions
    if type(saved) == "table" then
        for _, panel in pairs(saved) do
            if type(panel) == "table" and next(panel) then return "Backhand keeps this character's back-button spells in its own list (spells were dragged onto them before), so it has no action slots for PadPlan to fill. Clear them in Backhand's settings and log in again" end
        end
    end
    return "Backhand hasn't reserved its 16 action slots on this character yet (it does that when it finds enough free gamepad slots); log in again"
end

local function BackSummary(result, plan)
    local parts = {}
    for _, layer in ipairs(LAYERS) do
        parts[#parts + 1] = string.format("%s %d", LAYER_LABEL[layer], result.back[LAYER_LABEL[layer]] or 0)
    end
    return string.format("Back buttons (%s): %s.", table.concat(plan.paddleOrder, ", "), table.concat(parts, ", "))
end

local function KeysProblem(plan)
    if type(BackhandDB) ~= "table" or type(BackhandDB.paddleKeys) ~= "table" then return nil end
    local wrong = {}
    for index, button in ipairs(plan.paddleOrder or {}) do
        local want = (plan.paddleKeys or {})[index]
        local have = BackhandDB.paddleKeys["P" .. index]
        if want and want ~= "" and have ~= want:upper() then wrong[#wrong + 1] = string.format("%s should be %s but Backhand has %s", button, want, tostring(have)) end
    end
    return #wrong > 0 and table.concat(wrong, "; ") or nil
end

local function Report(result, plan, automatic)
    local unlearned = SortedNames(result.unlearned)
    local tail = #unlearned > 0 and string.format(" Not learned yet: %s.", table.concat(unlearned, ", ")) or ""
    Print("%s \"%s\": placed %d spells.%s", automatic and "Layout changed, applied" or "Applied", plan.name or "layout", result.placed, tail)
    for _, line in ipairs(result.skipped) do Print("  skipped %s", line) end
    local order = plan.paddleOrder or {}
    if #order == 0 then return end
    if not PaddleSlots() then return Print("Back buttons skipped: %s.", BackhandProblem()) end
    Print(BackSummary(result, plan))
    local keys = KeysProblem(plan)
    if keys then Print("Back-button keys not set: %s.", keys) end
end

local function Apply(automatic)
    local blocked = Blocked()
    if blocked then
        if not automatic then Print("Can't apply: %s.", blocked) end
        ns.pending = blocked == "in combat"
        return
    end
    local plan = CurrentPlan()
    SetUpBackhand(plan)
    local result = Place()
    PadPlanCharDB.applied = Signature(plan)
    PadPlanCharDB.waitingFor = next(result.unlearned) and SortedNames(result.unlearned) or nil
    ns.pending = false
    Report(result, plan, automatic)
end

local function FileChanged()
    local mine = FilePlan()
    if not mine then return false end
    local signature = Serialize(mine)
    if PadPlanCharDB.fileSignature == signature then return false end
    PadPlanCharDB.fileSignature = signature
    return true
end

local function ApplyIfChanged()
    if FileChanged() and PadPlanCharDB.plan then
        PadPlanCharDB.plan = nil
        Print("A new PadPlanData.lua was installed, so it replaces the layout imported earlier.")
    end
    local plan = CurrentPlan()
    if not plan then return end
    ReserveKeys(plan)
    local accepted = PadPlanCharDB.applied == Signature(plan)
    if accepted and not PadPlanCharDB.waitingFor then return end
    if accepted then return Apply(true) end
    local mode = Autoload()
    if mode == "off" then
        return Print("A new layout (\"%s\") is waiting for this character. Apply it from PadPlan in the addon menu.", plan.name or "layout")
    end
    if mode == "ask" then return ns.Ask(plan) end
    Apply(true)
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
    local blocked = Blocked()
    if blocked then return Print("Can't check: %s.", blocked) end
    local matched, problems = 0, {}
    ForEachSlot(function(where, slot, entry)
        if not ValidSlot(slot) then return end
        if Matches(slot, entry) then
            matched = matched + 1
            return
        end
        problems[#problems + 1] = string.format("%s: planned %s, has %s", where, entry and Describe(entry) or "empty", Holds(slot))
    end)
    Print("%d slots match the layout, %d differ.", matched, #problems)
    for _, line in ipairs(problems) do Print("  %s", line) end
end

local function Show()
    local plan = CurrentPlan()
    if not plan then return Print("No layout yet. Install a PadPlanData.lua from the planner, or /padplan import and paste a code.") end
    Print("Layout: %s%s", plan.name or "unnamed", PadPlanCharDB.plan and " (imported)" or " (from PadPlanData.lua)")
    ForEachSlot(function(where, slot, entry)
        if entry then Print("%s: %s (slot %s)", where, Describe(entry), tostring(slot)) end
    end)
    Print("It applies by itself at login. /padplan apply, check, import, forget.")
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
    PadPlanCharDB.plan = plan
    Print("Imported \"%s\" (%d slots).", plan.name, CountEntries(plan))
    local _, playerClass = UnitClass("player")
    if plan.class and playerClass and plan.class ~= playerClass then
        Print("This layout is for a %s, and this character is a %s; spells it can't cast will be skipped.", plan.class, playerClass)
    end
    Apply(false)
end

local function Forget()
    PadPlanCharDB.plan = nil
    PadPlanCharDB.applied = nil
    Print(PadPlanData and "Forgot the imported layout; PadPlanData.lua is used again." or "Forgot the imported layout.")
    ApplyIfChanged()
end

local function AskFrame()
    if ns.askFrame then return ns.askFrame end
    local frame = CreateFrame("Frame", "PadPlanAskFrame", UIParent, "BasicFrameTemplateWithInset")
    frame:SetSize(420, 150)
    frame:SetPoint("CENTER", 0, 120)
    frame:SetFrameStrata("DIALOG")
    local text = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    text:SetPoint("TOPLEFT", 16, -34)
    text:SetPoint("TOPRIGHT", -16, -34)
    text:SetJustifyH("LEFT")
    local apply = CreateFrame("Button", "PadPlanAskApply", frame, "UIPanelButtonTemplate")
    apply:SetSize(140, 28)
    apply:SetPoint("BOTTOMLEFT", 24, 16)
    apply:SetText("Apply")
    apply:SetScript("OnClick", function()
        frame:Hide()
        Apply(false)
    end)
    local later = CreateFrame("Button", "PadPlanAskLater", frame, "UIPanelButtonTemplate")
    later:SetSize(140, 28)
    later:SetPoint("BOTTOMRIGHT", -24, 16)
    later:SetText("Not now")
    later:SetScript("OnClick", function() frame:Hide() end)
    frame.text = text
    ns.askFrame = frame
    return frame
end

function ns.Ask(plan)
    local frame = AskFrame()
    frame.text:SetText(string.format("PadPlan has a new layout for this character: \"%s\".\n\nPut it on your gamepad bars now?", plan.name or "layout"))
    frame:Show()
    ns.asking = plan
end

function PadPlan_OnAddonCompartmentClick(_, button)
    if button == "RightButton" then return ns.ShowImport() end
    Apply(false)
end

SLASH_PADPLAN1 = "/padplan"
SlashCmdList.PADPLAN = function(message)
    local command = strtrim(message or ""):lower()
    if command == "apply" then return Apply(false) end
    if command == "check" then return Check() end
    if command == "import" then return ns.ShowImport() end
    if command == "forget" then return Forget() end
    Show()
end

local events = CreateFrame("Frame")

local function Listen(event)
    pcall(events.RegisterEvent, events, event)
end

Listen("ADDON_LOADED")
Listen("PLAYER_ENTERING_WORLD")
Listen("PLAYER_REGEN_ENABLED")
Listen("LEARNED_SPELL_IN_TAB")
Listen("LEARNED_SPELL_IN_SKILL_LINE")

events:SetScript("OnEvent", function(_, event, name)
    if event == "ADDON_LOADED" then
        if name == "PadPlan" then PadPlanCharDB = PadPlanCharDB or {} end
        return
    end
    if event == "PLAYER_ENTERING_WORLD" then
        C_Timer.After(LOGIN_DELAY, ApplyIfChanged)
    elseif event == "PLAYER_REGEN_ENABLED" then
        if ns.pending then ApplyIfChanged() end
    elseif PadPlanCharDB.waitingFor and CurrentPlan() and PadPlanCharDB.applied == Signature(CurrentPlan()) then
        C_Timer.After(1, function() Apply(true) end)
    end
end)
