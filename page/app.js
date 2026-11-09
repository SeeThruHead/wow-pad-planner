"use strict";

const STORAGE_KEY = "wow-pad-planner:v2";
const SHARE_PREFIX = "WPP1:";
const CATALOG = window.CATALOG;
const ICONS = window.ICONS;

const LAYERS = ["base", "lt", "rt", "both"];
const DPAD = ["DU", "DR", "DD", "DL"];
const FACE = ["Y", "B", "A", "X"];
const DPAD_NAMES = { DU: "D-pad up", DR: "D-pad right", DD: "D-pad down", DL: "D-pad left" };
const PAGE_UNIT_BUTTON = { DL: 1, DU: 2, DR: 3, DD: 4, X: 5, Y: 6, B: 7, A: 8 };
const PAGE_UNIT_BAR = { base: 0, lt: 1, rt: 2, both: 3 };
const ARROWS = { DU: "▲", DR: "▶", DD: "▼", DL: "◀" };
const CLUSTERS = {
  base: { dpad: [380, 140], face: [540, 140] },
  lt: { dpad: [95, 235], face: [245, 235] },
  rt: { dpad: [690, 235], face: [845, 235] },
  both: { dpad: [380, 330], face: [540, 330] },
};
const DPAD_OFFSET = { DU: [0, -46], DR: [46, 0], DD: [0, 46], DL: [-46, 0] };
const FACE_OFFSET = { Y: [0, -44], B: [44, 0], A: [0, 44], X: [-44, 0] };
const CLIENT_FACE = {
  X: { label: "Interact", svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#1c1c1c"/><path d="M13 27 l4-12 l3 7 l3-9 l4 14z" fill="#d9b25a" stroke="#6b4e18" stroke-width="1.5"/></svg>' },
  Y: { label: "Inspect", svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#0d0d0d"/><circle cx="20" cy="18" r="9" fill="#2b2b2b" stroke="#555"/><circle cx="17" cy="15" r="3" fill="#888"/></svg>' },
  B: { label: "Back", svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#d4a62a"/><path d="M12 12 L28 28 M28 12 L12 28" stroke="#b3201a" stroke-width="6" stroke-linecap="round"/></svg>' },
  A: { label: "Jump", svg: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19" fill="#e5c22e"/><path d="M20 8 L30 22 H24 V32 H16 V22 H10z" fill="#2b2410"/></svg>' },
};
const RING_SVG = (color) =>
  `<svg viewBox="0 0 52 46" width="52" height="46"><path d="M6 4 H40 L48 12 V40 H12 L4 32 V6z" fill="#1d1d1d" stroke="#8a7a5a" stroke-width="2"/><circle cx="26" cy="23" r="10" fill="none" stroke="${color}" stroke-width="3"/><path d="M26 9 V16 M26 30 V37 M12 23 H19 M33 23 H40" stroke="${color}" stroke-width="3"/></svg>`;

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const el = (id) => document.getElementById(id);

const controllerOf = (plan) => CONTROLLERS[plan.controller] || CONTROLLERS.xbox;
const layerName = (plan, layer) => {
  const names = controllerOf(plan).names;
  return { base: "No trigger", lt: names.lt, rt: names.rt, both: `${names.lt} + ${names.rt}` }[layer];
};
const buttonName = (plan, key) => DPAD_NAMES[key] || controllerOf(plan).face[key].glyph;

const classSpells = (plan) => {
  const data = CATALOG.classes[plan.class] || CATALOG.classes.WARRIOR;
  return [...data.spells, ...data.macros, ...CATALOG.shared];
};
const lookup = (plan, name) => classSpells(plan).find((spell) => spell.name === name);

const emptyLayers = () => ({ base: {}, lt: {}, rt: {}, both: {} });
const defaultBack = (controller) => Object.fromEntries(CONTROLLERS[controller].back.map((id, index) => [id, { use: "slot", key: FREE_KEYS[index], note: "" }]));

const emptyPlan = (className, controller) => ({
  version: 2,
  name: `${CATALOG.classes[className].name}: empty`,
  class: className,
  controller,
  level: 60,
  activeSet: 0,
  why: "",
  sets: [{ name: "Combat", layers: emptyLayers() }, { name: "Out of combat", layers: emptyLayers() }, { name: "Spare", layers: emptyLayers() }],
  paddles: emptyLayers(),
  back: defaultBack(controller),
  controls: {},
});

const loadLibrary = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : { layouts: [], currentId: STARTERS[0].id };
};

const store = { library: loadLibrary(), selected: null, picked: null };

const isBuiltin = (id) => id.startsWith("builtin:");
const currentPlan = () => {
  const id = store.library.currentId;
  const starter = STARTERS.find((item) => item.id === id);
  if (starter) return starter.plan;
  const saved = store.library.layouts.find((item) => item.id === id);
  return saved ? saved.plan : STARTERS[0].plan;
};
const nextId = (library) => `layout-${library.layouts.reduce((max, item) => Math.max(max, Number(item.id.split("-")[1]) || 0), 0) + 1}`;

const saveLibrary = (library) => {
  store.library = library;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  render();
};

const addLayout = (plan) => {
  const id = nextId(store.library);
  store.selected = null;
  saveLibrary({ layouts: [...store.library.layouts, { id, plan }], currentId: id });
};

const toast = (text) => {
  const node = el("toast");
  node.textContent = text;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 3200);
};

const edit = (change) => {
  const id = store.library.currentId;
  if (isBuiltin(id)) {
    const copy = change({ ...clone(currentPlan()), name: `${currentPlan().name} (my copy)` });
    toast("Built-in layouts are read-only, so this is now your own copy.");
    return addLayout(copy);
  }
  saveLibrary({ ...store.library, layouts: store.library.layouts.map((item) => (item.id === id ? { id, plan: change(clone(item.plan)) } : item)) });
};

const view = (patch) => {
  const id = store.library.currentId;
  if (isBuiltin(id)) {
    STARTERS.find((item) => item.id === id).plan = { ...currentPlan(), ...patch };
    return render();
  }
  edit((plan) => ({ ...plan, ...patch }));
};

const entryAt = (plan, loc) =>
  loc.kind === "paddle" ? (plan.paddles[loc.layer] || {})[loc.key] || null : (plan.sets[plan.activeSet].layers[loc.layer] || {})[loc.key] || null;

const withEntry = (plan, loc, entry) => {
  const next = clone(plan);
  const holder = loc.kind === "paddle" ? next.paddles : next.sets[next.activeSet].layers;
  const layer = { ...(holder[loc.layer] || {}) };
  holder[loc.layer] = entry ? { ...layer, [loc.key]: entry } : Object.fromEntries(Object.entries(layer).filter(([key]) => key !== loc.key));
  return next;
};

const swap = (plan, from, to) => withEntry(withEntry(plan, to, entryAt(plan, from)), from, entryAt(plan, to));
const sameLoc = (a, b) => Boolean(a && b) && a.kind === b.kind && a.layer === b.layer && a.key === b.key;
const ref = (name) => ({ ref: name });

const describe = (plan, entry) => {
  if (!entry) return null;
  if (entry.custom) return { name: entry.custom.label || "Custom", custom: true, body: entry.custom.body || "" };
  return lookup(plan, entry.ref) || { name: entry.ref, missing: true };
};

const slotBackIds = (plan) => controllerOf(plan).back.filter((id) => ((plan.back || {})[id] || {}).use !== "other");

const slotTitle = (plan, loc, info) => {
  const place = loc.kind === "paddle" ? `${layerName(plan, loc.layer)} + ${loc.key}` : `${layerName(plan, loc.layer)} + ${buttonName(plan, loc.key)}`;
  return info ? `${place}: ${info.name}` : `${place}: empty`;
};

const iconHtml = (info) => {
  if (info.custom || info.missing || !ICONS[info.icon]) return `<div class="custom-text">${escapeHtml(info.name)}</div>`;
  return `<img src="${ICONS[info.icon]}" alt="">`;
};

const badgeHtml = (plan, loc) => {
  if (loc.kind === "paddle") return `<span class="badge">${loc.key}</span>`;
  const face = controllerOf(plan).face[loc.key];
  return face ? `<span class="badge" style="color:${face.color}">${face.glyph}</span>` : "";
};

const emptyGlyph = (plan, loc, shape) => {
  if (loc.kind === "paddle") return `<span class="glyph-big" style="font-size:14px">${loc.key}</span>`;
  if (shape === "square") return `<span class="glyph-big" style="font-size:18px">${ARROWS[loc.key]}</span>`;
  const face = controllerOf(plan).face[loc.key];
  return `<span class="glyph-big" style="color:${face.color};opacity:0.55">${face.glyph}</span>`;
};

const slotNode = (plan, loc, shape, x, y) => {
  const info = describe(plan, entryAt(plan, loc));
  const node = document.createElement("div");
  const tooHigh = info && info.level && info.level > plan.level;
  node.className = ["slot", shape, info && info.custom ? "custom" : "", tooHigh ? "too-high" : "", sameLoc(store.selected, loc) ? "selected" : ""].join(" ");
  node.style.left = typeof x === "number" ? `${x}px` : x;
  node.style.top = `${y}px`;
  setTip(node, slotTip(plan, loc, info));
  const level = info && info.level > 1 ? `<span class="lvl">${info.level}</span>` : "";
  node.innerHTML = `<div class="face">${info ? iconHtml(info) : emptyGlyph(plan, loc, shape)}</div>${info ? badgeHtml(plan, loc) : ""}${level}`;
  node.draggable = Boolean(info);
  node.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", JSON.stringify({ slot: loc })));
  node.addEventListener("dragover", (event) => { event.preventDefault(); node.classList.add("drop"); });
  node.addEventListener("dragleave", () => node.classList.remove("drop"));
  node.addEventListener("drop", (event) => { event.preventDefault(); dropOnSlot(loc, event.dataTransfer.getData("text/plain")); });
  node.addEventListener("click", () => clickSlot(loc));
  node.addEventListener("contextmenu", (event) => { event.preventDefault(); edit((plan) => withEntry(plan, loc, null)); });
  return node;
};

const lockedNode = (plan, key, x, y) => {
  const node = document.createElement("div");
  const face = controllerOf(plan).face[key];
  node.className = "slot round locked";
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  setTip(node, clientFaceTip(plan, key));
  node.innerHTML = `<div class="face">${CLIENT_FACE[key].svg}</div><span class="badge" style="color:${face.color}">${face.glyph}</span>`;
  return node;
};

const dropOnSlot = (loc, data) => {
  if (!data) return;
  const payload = JSON.parse(data);
  if (payload.palette) return edit((plan) => withEntry(plan, loc, ref(payload.palette)));
  if (payload.slot) return edit((plan) => swap(plan, payload.slot, loc));
};

const clickSlot = (loc) => {
  if (store.picked) {
    const name = store.picked;
    store.picked = null;
    store.selected = loc;
    return edit((plan) => withEntry(plan, loc, ref(name)));
  }
  store.selected = sameLoc(store.selected, loc) ? null : loc;
  render();
};

const tips = new WeakMap();

const setTip = (node, tip) => {
  tips.set(node, tip);
  node.setAttribute("aria-label", [tip.place ? `${tip.place}: ${tip.title}` : tip.title, tip.sub, tip.line].filter(Boolean).join(". "));
  return node;
};

const firstSentence = (text) => {
  const clean = String(text || "").replace(/\? /g, "some ").replace(/\s+/g, " ").trim();
  const end = clean.search(/\.(\s|$)/);
  return end > 0 ? clean.slice(0, end + 1) : clean;
};

const spellTip = (info, place) => {
  if (info.custom) return { title: info.name, sub: "Custom slot", line: info.body ? "Runs this macro text:" : "A reminder; nothing is placed in game.", code: info.body, place };
  if (info.missing) return { title: info.name, sub: "Not in this class's spell list", line: "", place };
  const kind = info.kind === "macro" ? "Macro" : info.kind === "item" ? "Item" : `Learned at level ${info.level}${info.talent ? ", talent" : ""}`;
  const line = info.kind === "macro" ? info.about : firstSentence(info.desc);
  return { icon: info.icon, title: info.name, sub: kind, line, code: info.kind === "macro" ? info.desc : "", place };
};

const slotTip = (plan, loc, info) => {
  const place = slotTitle(plan, loc, null).replace(/: empty$/, "");
  if (!info) return { title: `${place}: empty`, sub: "Empty slot", line: "Drag a spell here, or tap a spell and then this slot." };
  return spellTip(info, place);
};

const CLIENT_ABOUT = {
  X: "Talks to, loots or uses whatever is in front of you.",
  Y: "Inspects your target.",
  B: "Goes back: closes the open window or cancels.",
  A: "Jumps.",
};

const clientFaceTip = (plan, key) => ({
  title: CLIENT_FACE[key].label,
  sub: `${controllerOf(plan).face[key].glyph} with no trigger held, the game's own`,
  line: `${CLIENT_ABOUT[key]} Hold a trigger to use this button for spells.`,
});

const ringTip = (plan, kind) => {
  const names = controllerOf(plan).names;
  return kind === "friendly"
    ? { title: "Friendly target", sub: names.lb, line: `Tap ${names.lb} to cycle friendly targets; hold it and use the stick to pick one. ${names.lb} + face buttons act on the target.` }
    : { title: "Enemy target", sub: names.rb, line: `Tap ${names.rb} to cycle enemies; hold it and use the stick to pick one.` };
};

const tipHtml = (tip) =>
  `<div class="tip-head">${tip.icon && ICONS[tip.icon] ? `<img src="${ICONS[tip.icon]}" alt="">` : ""}<div><div class="tip-title">${escapeHtml(tip.title)}</div>${tip.sub ? `<div class="tip-sub">${escapeHtml(tip.sub)}</div>` : ""}</div></div>` +
  `${tip.line ? `<p>${escapeHtml(tip.line)}</p>` : ""}${tip.code ? `<pre>${escapeHtml(tip.code)}</pre>` : ""}${tip.place ? `<div class="tip-place">${escapeHtml(tip.place)}</div>` : ""}`;

const tipTarget = (target) => {
  const node = target instanceof Element ? target.closest(".slot, .spell, .ring") : null;
  return node && tips.has(node) ? node : null;
};

const showTip = (node) => {
  const tip = el("tip");
  tip.innerHTML = tipHtml(tips.get(node));
  tip.hidden = false;
  const box = node.getBoundingClientRect();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, box.left + box.width / 2 - width / 2));
  const below = box.bottom + 10 + height < window.innerHeight;
  tip.style.left = `${left + window.scrollX}px`;
  tip.style.top = `${(below ? box.bottom + 10 : box.top - height - 10) + window.scrollY}px`;
};

const hideTip = () => { el("tip").hidden = true; };

const touch = { timer: 0, shown: false };

const bindTips = () => {
  document.addEventListener("mouseover", (event) => {
    const node = tipTarget(event.target);
    if (node) showTip(node);
    if (!node) hideTip();
  });
  document.addEventListener("dragstart", hideTip);
  document.addEventListener("scroll", hideTip, true);
  document.addEventListener("pointerdown", (event) => {
    clearTimeout(touch.timer);
    touch.shown = false;
    if (event.pointerType !== "touch") return;
    const node = tipTarget(event.target);
    if (!node) return hideTip();
    touch.timer = setTimeout(() => { touch.shown = true; showTip(node); }, 450);
  });
  document.addEventListener("pointerup", () => clearTimeout(touch.timer));
  document.addEventListener("pointercancel", () => clearTimeout(touch.timer));
  document.addEventListener("click", (event) => {
    if (!touch.shown) return;
    touch.shown = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);
  document.addEventListener("contextmenu", (event) => { if (touch.shown) event.preventDefault(); });
};

const positioned = (className, x, y, htmlText) => {
  const node = document.createElement("div");
  node.className = className;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.innerHTML = htmlText;
  return node;
};

const clusterNodes = (plan, layer) => {
  const { dpad, face } = CLUSTERS[layer];
  const dpadNodes = DPAD.map((key) => slotNode(plan, { kind: "bar", layer, key }, "square", dpad[0] + DPAD_OFFSET[key][0], dpad[1] + DPAD_OFFSET[key][1]));
  const faceNodes = FACE.map((key) =>
    layer === "base"
      ? lockedNode(plan, key, face[0] + FACE_OFFSET[key][0], face[1] + FACE_OFFSET[key][1])
      : slotNode(plan, { kind: "bar", layer, key }, "round", face[0] + FACE_OFFSET[key][0], face[1] + FACE_OFFSET[key][1]));
  return [...dpadNodes, ...faceNodes];
};

const renderStage = (plan) => {
  const names = controllerOf(plan).names;
  const labels = [
    positioned("cluster-label", 300, 290, names.lt),
    positioned("cluster-label", 640, 290, names.rt),
    positioned("cluster-label", 432, 400, names.lt),
    positioned("cluster-label plus", 460, 400, "+"),
    positioned("cluster-label", 488, 400, names.rt),
  ];
  const rings = [setTip(positioned("ring", 300, 40, RING_SVG("var(--friendly)")), ringTip(plan, "friendly")), setTip(positioned("ring", 640, 40, RING_SVG("var(--hostile)")), ringTip(plan, "hostile"))];
  el("stage").replaceChildren(...rings, ...LAYERS.flatMap((layer) => clusterNodes(plan, layer)), ...labels);
};

const backRow = (plan, id) => {
  const setting = (plan.back || {})[id] || { use: "slot", key: "F13", note: "" };
  const row = document.createElement("div");
  row.className = "back-row";
  const keys = FREE_KEYS.map((key) => `<option value="${key}"${key === setting.key ? " selected" : ""}>${key}${WINDOWS_ONLY_KEYS.includes(key) ? " (Windows only)" : ""}</option>`).join("");
  row.innerHTML = `<strong>${escapeHtml(BACK_LABELS[id] || id)}</strong>
    <select data-field="use"><option value="slot"${setting.use === "slot" ? " selected" : ""}>Spell slots</option><option value="other"${setting.use === "other" ? " selected" : ""}>Used by something else</option></select>
    <label class="sub">${setting.use === "other" ? "Sends" : "Steam key"} <select data-field="key"><option value="">none</option>${keys}</select></label>
    ${setting.use === "other" ? `<input type="text" data-field="note" placeholder="What uses it" value="${escapeHtml(setting.note)}">` : ""}`;
  row.querySelectorAll("[data-field]").forEach((input) =>
    input.addEventListener("change", () => edit((next) => ({ ...next, back: { ...(next.back || {}), [id]: { ...setting, [input.dataset.field]: input.value } } }))));
  return row;
};

const renderBack = (plan) => {
  const controller = controllerOf(plan);
  const section = el("back");
  if (controller.back.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const slots = slotBackIds(plan);
  el("back-settings").replaceChildren(...controller.back.map((id) => backRow(plan, id)));
  const groups = LAYERS.map((layer) => {
    const group = document.createElement("div");
    group.className = "paddle-group";
    group.innerHTML = `<h3>${escapeHtml(layerName(plan, layer))}</h3>`;
    const grid = document.createElement("div");
    grid.className = "paddle-grid";
    grid.replaceChildren(...slots.map((key) => slotNode(plan, { kind: "paddle", layer, key }, "square", BACK_POSITION[key][0], BACK_POSITION[key][1])));
    group.appendChild(grid);
    return group;
  });
  el("paddles").replaceChildren(...groups);
};

const mirrorDpad = (plan) => {
  const slots = slotBackIds(plan);
  const layers = plan.sets[plan.activeSet].layers;
  const paddles = Object.fromEntries(LAYERS.map((layer) => [layer, Object.fromEntries(slots.map((id, index) => [id, (layers[layer] || {})[["DU", "DR", "DD", "DL"][index]]]).filter(([, entry]) => entry))]));
  return { ...plan, paddles };
};

const renderLibrary = (plan) => {
  const id = store.library.currentId;
  const builtins = STARTERS.map((starter) => `<option value="${starter.id}"${starter.id === id ? " selected" : ""}>${escapeHtml(starter.plan.name)}</option>`).join("");
  const mine = store.library.layouts.map((item) => `<option value="${item.id}"${item.id === id ? " selected" : ""}>${escapeHtml(item.plan.name)}</option>`).join("");
  el("layout-pick").innerHTML = `<optgroup label="My layouts">${mine || '<option disabled>None yet</option>'}</optgroup><optgroup label="Built-in (read-only)">${builtins}</optgroup>`;
  el("layout-name").value = plan.name;
  el("layout-name").disabled = isBuiltin(id);
  el("readonly-hint").hidden = !isBuiltin(id);
  el("delete").disabled = isBuiltin(id);
  el("class-pick").innerHTML = Object.entries(CATALOG.classes).map(([key, data]) => `<option value="${key}"${key === plan.class ? " selected" : ""}>${data.name}</option>`).join("");
  el("controller-pick").innerHTML = Object.entries(CONTROLLERS).map(([key, data]) => `<option value="${key}"${key === plan.controller ? " selected" : ""}>${data.name}</option>`).join("");
  el("level").value = plan.level;
  el("why").value = plan.why || "";
};

const renderSets = (plan) => {
  const buttons = plan.sets.map((set, index) => {
    const button = document.createElement("button");
    button.className = index === plan.activeSet ? "on" : "";
    button.textContent = `Set ${index + 1}: ${set.name}`;
    button.addEventListener("click", () => { store.selected = null; view({ activeSet: index }); });
    return button;
  });
  const rename = document.createElement("input");
  rename.type = "text";
  rename.value = plan.sets[plan.activeSet].name;
  rename.title = "Name of this set";
  rename.style.width = "150px";
  rename.addEventListener("change", () => edit((next) => ({ ...next, sets: next.sets.map((set, index) => (index === next.activeSet ? { ...set, name: rename.value.trim() || `Set ${index + 1}` } : set)) })));
  const names = controllerOf(plan).names;
  const hint = document.createElement("span");
  hint.className = "sub";
  hint.textContent = `${names.lb} + ${names.rb} + d-pad left/right switches set in game.`;
  el("sets").replaceChildren(...buttons, rename, hint);
};

const slotInfoText = (plan, loc) => {
  if (loc.kind === "paddle") {
    const setting = (plan.back || {})[loc.key] || {};
    return `${loc.key}${setting.key ? ` sends ${setting.key}` : ""}: Backhand paddle ${slotBackIds(plan).indexOf(loc.key) + 1} on the ${layerName(plan, loc.layer)} layer (same in every set).`;
  }
  return `Set ${plan.activeSet + 1}, gamepad bar slot ${PAGE_UNIT_BAR[loc.layer] * 8 + PAGE_UNIT_BUTTON[loc.key]} of 32.`;
};

const renderDetails = (plan) => {
  const node = el("details");
  const loc = store.selected;
  if (!loc) {
    node.innerHTML = store.picked ? `<p class="sub">Picked <strong>${escapeHtml(store.picked)}</strong>: click a slot to put it there.</p>` : "";
    return;
  }
  const info = describe(plan, entryAt(plan, loc));
  const heading = `<div class="row"><span class="what">${escapeHtml(slotTitle(plan, loc, info))}</span><button id="clear-slot">Empty</button><button id="custom-slot">Make custom</button></div><div class="desc">${escapeHtml(slotInfoText(plan, loc))}</div>`;
  const body = !info ? "" : info.custom
    ? `<div class="row"><label class="sub">Label <input type="text" id="custom-label" value="${escapeHtml(info.name)}"></label></div>
       <div class="sub">Macro text (leave it empty for a reminder that isn't placed in game):</div>
       <textarea id="custom-body">${escapeHtml(info.body)}</textarea>`
    : `<div class="desc">${info.level ? `Level ${info.level}. ` : ""}${info.talent ? "Talent. " : ""}${info.missing ? "Not in this class's spell list. " : ""}${escapeHtml(info.desc || "")}</div>`;
  node.innerHTML = heading + body;
  el("clear-slot").addEventListener("click", () => { store.selected = null; edit((next) => withEntry(next, loc, null)); });
  el("custom-slot").addEventListener("click", () => edit((next) => withEntry(next, loc, { custom: { label: info ? info.name : "Custom", body: info && info.kind === "macro" ? info.desc : "" } })));
  if (!info || !info.custom) return;
  const save = () => edit((next) => withEntry(next, loc, { custom: { label: el("custom-label").value, body: el("custom-body").value } }));
  el("custom-label").addEventListener("change", save);
  el("custom-body").addEventListener("change", save);
};

const usedCounts = (plan) => {
  const entries = [
    ...plan.sets.flatMap((set) => LAYERS.flatMap((layer) => Object.values(set.layers[layer] || {}))),
    ...LAYERS.flatMap((layer) => Object.values(plan.paddles[layer] || {})),
  ];
  return entries.filter((entry) => entry.ref).reduce((counts, entry) => ({ ...counts, [entry.ref]: (counts[entry.ref] || 0) + 1 }), {});
};

const BANDS = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60]];

const renderPalette = (plan) => {
  const query = el("search").value.trim().toLowerCase();
  const counts = usedCounts(plan);
  const data = CATALOG.classes[plan.class];
  const matches = (spell) => !query || spell.name.toLowerCase().includes(query) || spell.aliases.some((alias) => alias.toLowerCase().includes(query));
  const spellNode = (spell) => {
    const node = document.createElement("div");
    node.className = ["spell", spell.level > plan.level ? "too-high" : "", store.picked === spell.name ? "picked" : ""].join(" ");
    node.draggable = true;
    setTip(node, spellTip(spell, null));
    const used = counts[spell.name] ? `<span class="used">on ${counts[spell.name]}</span>` : "";
    const tags = `${spell.talent ? '<span class="tag">talent</span>' : ""}${spell.kind === "macro" ? '<span class="tag">macro</span>' : ""}`;
    node.innerHTML = `<img src="${ICONS[spell.icon] || ""}" alt=""><span class="name">${escapeHtml(spell.name)} ${tags}</span>${used}<span class="meta">${spell.level > 1 ? spell.level : ""}</span>`;
    node.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", JSON.stringify({ palette: spell.name })));
    node.addEventListener("click", () => { store.picked = store.picked === spell.name ? null : spell.name; store.selected = null; render(); });
    return node;
  };
  const section = (title, spells) => {
    const visible = spells.filter(matches);
    if (visible.length === 0) return [];
    const heading = document.createElement("div");
    heading.className = "group-title";
    heading.textContent = title;
    return [heading, ...visible.map(spellNode)];
  };
  el("palette").replaceChildren(
    ...BANDS.flatMap(([from, to]) => section(`Levels ${from} to ${to}`, data.spells.filter((spell) => spell.level >= from && spell.level <= to))),
    ...section("Macros", data.macros),
    ...section("Everyone", CATALOG.shared),
  );
};

const controlRows = (plan) => {
  const controller = controllerOf(plan);
  const names = controller.names;
  const backs = controller.back.map((id) => {
    const setting = (plan.back || {})[id] || {};
    const text = setting.use === "other"
      ? `Used by something else${setting.note ? `: ${setting.note}` : ""}${setting.key ? ` (sends ${setting.key})` : ""}. No spell.`
      : `Spell slots: Steam Input sends ${setting.key || "a free key"}, Backhand paddle ${slotBackIds(plan).indexOf(id) + 1}.`;
    return { key: id, name: BACK_LABELS[id] || id, fixed: text, editable: false };
  });
  const pads = controller.pads.map((pad, index) => ({
    key: `PAD${index}`,
    name: pad,
    fixed: index === controller.pads.length - 1 ? "Suggested: mouse, click is left mouse; hold a trigger while clicking for right mouse." : "Free. Leave unbound or give it your own use.",
    editable: true,
  }));
  return [
    { key: "LS", name: "Left stick", fixed: `Move. Click (${names.ls}): not bound by the game.`, editable: true },
    { key: "RS", name: "Right stick", fixed: `Camera. ${names.lb} + ${names.rb} + forward/back zooms. Click (${names.rs}): not bound by the game.`, editable: true },
    { key: "LB", name: names.lb, fixed: `Target friendly. Hold + stick to pick; ${names.lb} + face buttons: target actions.`, editable: false },
    { key: "RB", name: names.rb, fixed: "Target hostile. Hold + stick to pick.", editable: false },
    { key: "LBRB", name: `${names.lb} + ${names.rb}`, fixed: "Hold: d-pad left/right switches bar set; B bags, d-pad up quests, d-pad down chat, Y buffs.", editable: false },
    { key: "LT", name: names.lt, fixed: `Hold: the ${names.lt} bar (left cluster).`, editable: false },
    { key: "RT", name: names.rt, fixed: `Hold: the ${names.rt} bar (right cluster). Both triggers: bottom cluster.`, editable: false },
    { key: "FACE", name: "Face buttons", fixed: "No trigger: interact, inspect, back, jump. With a trigger: spell slots.", editable: false },
    { key: "DPAD", name: "D-pad", fixed: "Spell slots on every layer.", editable: false },
    ...backs,
    ...pads,
    ...(controller.gyro ? [{ key: "GYRO", name: "Gyro", fixed: "Optional: gyro to mouse, toggled with a stick click.", editable: true }] : []),
    { key: "VIEW", name: names.view, fixed: "Change focus frame.", editable: false },
    { key: "MENU", name: names.menu, fixed: "Main menu (radial).", editable: false },
  ];
};

const renderControls = (plan) => {
  const rows = controlRows(plan).map((control) => {
    const row = document.createElement("tr");
    const setting = (plan.controls || {})[control.key] || {};
    const other = control.editable ? `<label class="sub"><input type="checkbox"${setting.other ? " checked" : ""}> used by something else</label> <input type="text" placeholder="Your note" value="${escapeHtml(setting.note || "")}">` : "";
    row.innerHTML = `<td>${escapeHtml(control.name)}</td><td><div class="fixed">${escapeHtml(setting.other ? `Used by something else${setting.note ? `: ${setting.note}` : ""}.` : control.fixed)}</div>${other}</td>`;
    const save = (patch) => edit((next) => ({ ...next, controls: { ...(next.controls || {}), [control.key]: { ...setting, ...patch } } }));
    const checkbox = row.querySelector("input[type=checkbox]");
    const note = row.querySelector("input[type=text]");
    if (checkbox) checkbox.addEventListener("change", () => save({ other: checkbox.checked }));
    if (note) note.addEventListener("change", () => save({ note: note.value }));
    return row;
  });
  el("controls").replaceChildren(...rows);
};

const keyClashes = (plan) => {
  const controller = controllerOf(plan);
  const sent = controller.back.map((id) => [id, ((plan.back || {})[id] || {}).key]).filter(([, key]) => key);
  return sent.filter(([id, key]) => sent.some(([other, otherKey]) => other !== id && otherKey === key)).map(([id, key]) => `${id} and another back button both send ${key}.`);
};

const windowsOnlyKeys = (plan) =>
  slotBackIds(plan).map((id) => [id, ((plan.back || {})[id] || {}).key]).filter(([, key]) => WINDOWS_ONLY_KEYS.includes(key));

const steamSteps = (plan) => {
  const controller = controllerOf(plan);
  const names = controller.names;
  const slots = slotBackIds(plan);
  if (!controller.steamInput) return [`${controller.name}: nothing to set in Steam. The game reads it directly; leave Steam Input off or on its default gamepad layout.`];
  const backSteps = controller.back.map((id) => {
    const setting = (plan.back || {})[id] || {};
    if (setting.use === "other") return `${BACK_LABELS[id] || id}: not a spell slot, ${setting.note || "used by something else"}${setting.key ? ` (sends ${setting.key})` : ""}.`;
    return `${BACK_LABELS[id] || id}: keyboard ${setting.key || "(pick a key above)"}.`;
  });
  const padSteps = controller.pads.map((pad, index) => {
    const setting = (plan.controls || {})[`PAD${index}`] || {};
    if (setting.other) return `${pad}: leave it to ${setting.note || "the other tool"}.`;
    if (index === controller.pads.length - 1) return `${pad}: mouse (trackpad mode), click is left mouse. Add a mode shift on ${names.lt} so a click while holding ${names.lt} is right mouse.`;
    return `${pad}: unbound.`;
  });
  const gyro = (plan.controls || {}).GYRO || {};
  return [
    `In Steam (game mode or Big Picture), add Battle.net as a non-Steam game, start WoW from it, then open its controller settings. Start from the "Gamepad with Mouse Trackpad" template (or "Gamepad" for a controller without a touchpad).`,
    ...backSteps,
    ...padSteps,
    ...(controller.gyro ? [gyro.other ? `Gyro: leave it to ${gyro.note || "the other tool"}.` : `Gyro (optional): gyro to mouse, toggled with ${names.rs}.`] : []),
    ...(slots.length ? [`In game, install SNRN Backhand, open /backhand and assign P1 to P${slots.length} by pressing ${slots.join(", ")} in that order.`] : []),
    ...keyClashes(plan).map((text) => `Clash: ${text}`),
    ...windowsOnlyKeys(plan).map(([id, key]) => `Linux, Steam Deck and Proton: ${id} sends ${key}, which Wine passes to WoW as no key at all (the standard Linux keymap treats F13 to F18 and F20 to F22 as media keys). Pick F9, F10, F11, F19, F23 or F24 instead.`),
  ];
};

const renderSteps = (plan) => {
  el("steam-steps").innerHTML = steamSteps(plan).map((text) => `<li>${escapeHtml(text)}</li>`).join("");
};

const render = () => {
  const plan = currentPlan();
  renderLibrary(plan);
  renderSets(plan);
  renderStage(plan);
  renderBack(plan);
  renderDetails(plan);
  renderPalette(plan);
  renderControls(plan);
  renderSteps(plan);
};

const luaString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
const macroName = (label) => `PP ${label}`.slice(0, 16);

const luaEntry = (plan, entry) => {
  const info = describe(plan, entry);
  if (!info || info.missing) return null;
  if (info.custom) return info.body.trim() ? `{ kind = "macro", name = ${luaString(macroName(info.name))}, icon = "INV_MISC_QUESTIONMARK", body = ${luaString(info.body)} }` : null;
  if (info.kind === "macro") return `{ kind = "macro", name = ${luaString(macroName(info.name))}, icon = ${luaString(info.icon)}, body = ${luaString(info.desc)} }`;
  if (info.kind === "item") return `{ kind = "item", id = ${info.id}, name = ${luaString(info.name)} }`;
  return `{ kind = "spell", id = ${info.id}, names = { ${[info.name, ...info.aliases].map(luaString).join(", ")} } }`;
};

const luaLayer = (plan, layer, keys, indent) => {
  const lines = keys.map((key) => [key, luaEntry(plan, (layer || {})[key])]).filter(([, lua]) => lua).map(([key, lua]) => `${indent}  ${key} = ${lua},`);
  return lines.length ? `{\n${lines.join("\n")}\n${indent}}` : "{}";
};

const toLua = (plan) => {
  const slots = slotBackIds(plan);
  const sets = plan.sets.map((set) => {
    const layers = LAYERS.map((layer) => `        ${layer} = ${luaLayer(plan, set.layers[layer], layer === "base" ? DPAD : [...DPAD, ...FACE], "        ")},`).join("\n");
    return `    {\n      name = ${luaString(set.name)},\n      layers = {\n${layers}\n      },\n    },`;
  }).join("\n");
  const paddles = LAYERS.map((layer) => `    ${layer} = ${luaLayer(plan, plan.paddles[layer], slots, "    ")},`).join("\n");
  return `-- ${plan.name}, from the gamepad bar planner.\nPadPlanData = {\n  version = 1,\n  name = ${luaString(plan.name)},\n  class = ${luaString(plan.class)},\n  paddleOrder = { ${slots.map(luaString).join(", ")} },\n  sets = {\n${sets}\n  },\n  paddles = {\n${paddles}\n  },\n}\n`;
};

const ADDON_PREFIX = "PADPLAN1:";
const addonText = (text) => String(text).replace(/[\t\n]/g, " ");
const addonEscape = (text) => String(text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t");

const addonEntry = (plan, entry) => {
  const info = describe(plan, entry);
  if (!info || info.missing) return null;
  if (info.custom) return info.body.trim() ? ["macro", addonText(macroName(info.name)), "INV_MISC_QUESTIONMARK", addonEscape(info.body)] : null;
  if (info.kind === "macro") return ["macro", macroName(info.name), info.icon, addonEscape(info.desc)];
  if (info.kind === "item") return ["item", String(info.id), info.name];
  return ["spell", String(info.id), [info.name, ...info.aliases].join("|")];
};

const addonRows = (plan, layer, keys, prefix) =>
  keys.map((key) => [key, addonEntry(plan, (layer || {})[key])]).filter(([, entry]) => entry).map(([key, entry]) => [...prefix, key, ...entry]);

const addonLines = (plan) => {
  const slots = slotBackIds(plan);
  const bars = plan.sets.flatMap((set, index) => [
    ["set", String(index + 1), addonText(set.name)],
    ...LAYERS.flatMap((layer) => addonRows(plan, set.layers[layer], layer === "base" ? DPAD : [...DPAD, ...FACE], ["b", String(index + 1), layer])),
  ]);
  const paddles = LAYERS.flatMap((layer) => addonRows(plan, plan.paddles[layer], slots, ["p", layer]));
  return [["PADPLAN", "1"], ["name", addonText(plan.name)], ["class", plan.class], ["order", slots.join(",")], ...bars, ...paddles].map((fields) => fields.join("\t")).join("\n");
};

const addonCode = (plan) => ADDON_PREFIX + btoa(Array.from(new TextEncoder().encode(addonLines(plan)), (byte) => String.fromCharCode(byte)).join(""));

const download = (name, text, type) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const toBase64Url = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const streamBytes = async (bytes, transform) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());

const shareCode = async (plan) => SHARE_PREFIX + toBase64Url(await streamBytes(new TextEncoder().encode(JSON.stringify(plan)), new CompressionStream("deflate-raw")));

const readShared = async (text) => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  if (!trimmed.startsWith(SHARE_PREFIX)) throw new Error("not a layout code");
  return JSON.parse(new TextDecoder().decode(await streamBytes(fromBase64Url(trimmed.slice(SHARE_PREFIX.length)), new DecompressionStream("deflate-raw"))));
};

const isPlan = (value) => Boolean(value) && value.version === 2 && Boolean(CATALOG.classes[value.class]) && Array.isArray(value.sets) && value.sets.length === 3;

const importPlan = (plan) => {
  if (!isPlan(plan)) return toast("That isn't a layout from this planner.");
  addLayout({ ...plan, activeSet: 0 });
  toast(`Imported "${plan.name}".`);
};

const bind = () => {
  el("search").addEventListener("input", () => renderPalette(currentPlan()));
  el("level").addEventListener("change", (event) => view({ level: Math.max(1, Math.min(60, Number(event.target.value) || 60)) }));
  el("layout-pick").addEventListener("change", (event) => { store.selected = null; saveLibrary({ ...store.library, currentId: event.target.value }); });
  el("layout-name").addEventListener("change", (event) => edit((plan) => ({ ...plan, name: event.target.value.trim() || plan.name })));
  el("why").addEventListener("change", (event) => edit((plan) => ({ ...plan, why: event.target.value })));
  el("class-pick").addEventListener("change", (event) => {
    if (!confirm("Start an empty layout for that class? Your current layout stays saved.")) return render();
    addLayout(emptyPlan(event.target.value, currentPlan().controller));
  });
  el("controller-pick").addEventListener("change", (event) => edit((plan) => ({ ...plan, controller: event.target.value, back: { ...defaultBack(event.target.value), ...Object.fromEntries(Object.entries(plan.back || {}).filter(([id]) => CONTROLLERS[event.target.value].back.includes(id))) } })));
  el("new").addEventListener("click", () => addLayout(emptyPlan(currentPlan().class, currentPlan().controller)));
  el("duplicate").addEventListener("click", () => addLayout({ ...clone(currentPlan()), name: `${currentPlan().name} (copy)` }));
  el("delete").addEventListener("click", () => {
    const id = store.library.currentId;
    if (isBuiltin(id) || !confirm(`Delete "${currentPlan().name}"?`)) return;
    store.selected = null;
    saveLibrary({ layouts: store.library.layouts.filter((item) => item.id !== id), currentId: STARTERS[0].id });
  });
  el("mirror").addEventListener("click", () => edit(mirrorDpad));
  el("save-wow").addEventListener("click", () => { download("PadPlanData.lua", toLua(currentPlan()), "text/plain"); toast("Saved PadPlanData.lua: put it in Interface/AddOns/PadPlan."); });
  el("addon-code").addEventListener("click", async () => {
    const code = addonCode(currentPlan());
    el("addon-code-text").value = code;
    el("addon-code-box").hidden = false;
    el("addon-code-text").select();
    await navigator.clipboard.writeText(code).then(() => toast("Copied. In game: /padplan import, paste, Import, then /padplan apply."), () => toast("Copy the code from the box."));
  });
  el("export").addEventListener("click", () => download(`${currentPlan().name.replace(/[^\w-]+/g, "-")}.json`, JSON.stringify(currentPlan(), null, 2), "application/json"));
  el("share").addEventListener("click", async () => {
    const code = await shareCode(currentPlan());
    el("share-text").value = code;
    el("share-box").hidden = false;
    el("share-text").select();
    await navigator.clipboard.writeText(code).then(() => toast("Layout code copied."), () => toast("Copy the code from the box."));
  });
  el("import").addEventListener("click", () => { el("share-box").hidden = false; el("share-text").value = ""; el("share-text").focus(); });
  el("import-code").addEventListener("click", async () => importPlan(await readShared(el("share-text").value).catch(() => null)));
  el("import-file-button").addEventListener("click", () => el("import-file").click());
  el("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    importPlan(await readShared(await file.text()).catch(() => null));
  });
  const palette = el("palette");
  palette.addEventListener("dragover", (event) => event.preventDefault());
  palette.addEventListener("drop", (event) => {
    event.preventDefault();
    const data = event.dataTransfer.getData("text/plain");
    const payload = data ? JSON.parse(data) : {};
    if (payload.slot) edit((plan) => withEntry(plan, payload.slot, null));
  });
};

bind();
bindTips();
render();

if (location.hash.startsWith("#lua:")) {
  const starter = STARTERS.find((item) => item.id === `builtin:${location.hash.slice(5)}`);
  const pre = document.createElement("pre");
  pre.id = "lua";
  pre.textContent = starter ? toLua(starter.plan) : "";
  document.body.appendChild(pre);
}
