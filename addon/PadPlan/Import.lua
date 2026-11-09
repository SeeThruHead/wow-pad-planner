local _, ns = ...

local PREFIX = "PADPLAN1:"
local ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local INDEX = {}
for position = 1, #ALPHABET do
    INDEX[ALPHABET:sub(position, position)] = position - 1
end
local LAYER_NAMES = { base = true, lt = true, rt = true, both = true }

local function DecodeBase64(text)
    local clean = text:gsub("[^%w%+/]", "")
    local out = {}
    for position = 1, #clean, 4 do
        local a, b = INDEX[clean:sub(position, position)], INDEX[clean:sub(position + 1, position + 1)]
        local c, d = INDEX[clean:sub(position + 2, position + 2)], INDEX[clean:sub(position + 3, position + 3)]
        if not a or not b then break end
        local value = a * 262144 + b * 4096 + (c or 0) * 64 + (d or 0)
        out[#out + 1] = string.char(math.floor(value / 65536) % 256)
        if c then out[#out + 1] = string.char(math.floor(value / 256) % 256) end
        if d then out[#out + 1] = string.char(value % 256) end
    end
    return table.concat(out)
end

local function Split(text, separator)
    local parts = {}
    for part in (text .. separator):gmatch("(.-)" .. separator) do
        parts[#parts + 1] = part
    end
    return parts
end

local function Unescape(text)
    return (text:gsub("\\(.)", { n = "\n", t = "\t", ["\\"] = "\\" }))
end

local function ReadEntry(fields, first)
    local kind = fields[first]
    if kind == "spell" then
        return { kind = "spell", id = tonumber(fields[first + 1]), names = Split(fields[first + 2] or "", "|") }
    elseif kind == "macro" then
        return { kind = "macro", name = fields[first + 1], icon = fields[first + 2], body = Unescape(fields[first + 3] or "") }
    elseif kind == "item" then
        return { kind = "item", id = tonumber(fields[first + 1]), name = fields[first + 2] }
    end
    return nil
end

local function EmptyLayers()
    return { base = {}, lt = {}, rt = {}, both = {} }
end

local function ReadLine(plan, fields)
    local tag = fields[1]
    if tag == "name" then
        plan.name = fields[2]
    elseif tag == "class" then
        plan.class = fields[2]
    elseif tag == "order" then
        plan.paddleOrder = fields[2] ~= "" and Split(fields[2], ",") or {}
    elseif tag == "reserved" then
        plan.reservedKeys = fields[2] ~= "" and Split(fields[2], ",") or {}
    elseif tag == "keys" then
        plan.paddleKeys = fields[2] ~= "" and Split(fields[2], ",") or {}
    elseif tag == "set" then
        local set = plan.sets[tonumber(fields[2])]
        if set then set.name = fields[3] end
    elseif tag == "b" then
        local set = plan.sets[tonumber(fields[2])]
        if set and LAYER_NAMES[fields[3]] then set.layers[fields[3]][fields[4]] = ReadEntry(fields, 5) end
    elseif tag == "p" then
        if LAYER_NAMES[fields[2]] then plan.paddles[fields[2]][fields[3]] = ReadEntry(fields, 4) end
    end
end

function ns.DecodeCode(code)
    local trimmed = (code or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if trimmed:sub(1, #PREFIX) ~= PREFIX then
        return nil, "That isn't a PadPlan code. In the planner, use \"Copy code for the addon\"."
    end
    local lines = Split(DecodeBase64(trimmed:sub(#PREFIX + 1)), "\n")
    if lines[1] ~= "PADPLAN\t1" then
        return nil, "The code is damaged or from a newer planner."
    end
    local plan = {
        version = 1,
        name = "Imported layout",
        paddleOrder = {},
        paddleKeys = {},
        sets = { { name = "Set 1", layers = EmptyLayers() }, { name = "Set 2", layers = EmptyLayers() }, { name = "Set 3", layers = EmptyLayers() } },
        paddles = EmptyLayers(),
    }
    for index = 2, #lines do
        if lines[index] ~= "" then ReadLine(plan, Split(lines[index], "\t")) end
    end
    return plan
end

local function ImportFrame()
    if ns.importFrame then return ns.importFrame end
    local frame = CreateFrame("Frame", "PadPlanImportFrame", UIParent, "BasicFrameTemplateWithInset")
    frame:SetSize(520, 300)
    frame:SetPoint("CENTER")
    frame:SetFrameStrata("DIALOG")
    frame:EnableMouse(true)
    frame:SetMovable(true)
    frame:RegisterForDrag("LeftButton")
    frame:SetScript("OnDragStart", frame.StartMoving)
    frame:SetScript("OnDragStop", frame.StopMovingOrSizing)
    local title = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    title:SetPoint("TOP", 0, -5)
    title:SetText("PadPlan: paste the code from the planner")
    local scroll = CreateFrame("ScrollFrame", nil, frame, "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 14, -32)
    scroll:SetPoint("BOTTOMRIGHT", -34, 46)
    local box = CreateFrame("EditBox", nil, scroll)
    box:SetMultiLine(true)
    box:SetMaxLetters(0)
    box:SetFontObject(ChatFontNormal)
    box:SetWidth(460)
    box:SetAutoFocus(true)
    box:SetScript("OnEscapePressed", function() frame:Hide() end)
    scroll:SetScrollChild(box)
    local button = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
    button:SetSize(140, 24)
    button:SetPoint("BOTTOMRIGHT", -14, 14)
    button:SetText("Import")
    button:SetScript("OnClick", function()
        ns.Import(box:GetText())
        box:SetText("")
        frame:Hide()
    end)
    frame.box = box
    tinsert(UISpecialFrames, "PadPlanImportFrame")
    ns.importFrame = frame
    return frame
end

function ns.ShowImport()
    local frame = ImportFrame()
    frame:Show()
    frame.box:SetFocus()
end
