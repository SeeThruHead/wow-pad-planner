import base64
import json
import pathlib

root = pathlib.Path(__file__).parent
page = root / "page"
catalog = json.loads((page / "catalog.json").read_text())
entries = [spell for data in catalog["classes"].values() for spell in data["spells"] + data["macros"]] + catalog["shared"]
icon_path = lambda icon: page / "icons" / f"{icon}.jpg"
icons = {spell["icon"]: "data:image/jpeg;base64," + base64.b64encode(icon_path(spell["icon"]).read_bytes()).decode() for spell in entries if spell["icon"] and icon_path(spell["icon"]).exists()}
parts = {
    "/*STYLE*/": (page / "style.css").read_text(),
    "/*CATALOG*/": json.dumps(catalog, separators=(",", ":")),
    "/*ICONS*/": json.dumps(icons, separators=(",", ":")),
    "/*CONTROLLERS*/": (page / "controllers.js").read_text(),
    "/*STARTERS*/": (page / "starters.js").read_text(),
    "/*APP*/": (page / "app.js").read_text(),
}
html = (page / "index.html").read_text()
for marker, text in parts.items():
    html = html.replace(marker, text)
(root / "dist").mkdir(exist_ok=True)
(root / "dist" / "wow-pad-planner.html").write_text(html)
print(f"{sum(len(data['spells']) for data in catalog['classes'].values())} spells, {len(icons)} icons, {len(html) // 1024} KB")
