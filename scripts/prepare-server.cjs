const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const target = path.join(root, "server/generated");
fs.mkdirSync(target, { recursive: true });
for (const [src, name] of [
  ["domain", "domain"],
  ["catalog", "defaults"],
]) {
  const source = fs.readFileSync(path.join(root, "src", src + ".ts"), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  fs.writeFileSync(path.join(target, name + ".cjs"), result.outputText);
}
fs.copyFileSync(
  path.join(root, "src/data/catalog.json"),
  path.join(target, "seed.json"),
);
const seed = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/catalog.json"), "utf8"),
);
const update = require("../server/catalog-update.json");
seed.products = seed.products.map((p) => {
  const change = update.products.find(x => x.id === p.id && x.code === p.code);
  if (change) Object.assign(p, { name: change.name, name_fr: change.name });
  if (!p.availability_confirmed && !p.upcoming) Object.assign(p, { available: p.stock_cartons !== 0, availability_confirmed: true });
  p.weight_grams = null;
  const { source_metadata, ...safe } = p;
  return {
    ...safe,
    price_hidden: true,
    unit_price_cents: 0,
    price_on_request: true,
    discount_price_cents: null,
    discount_start: null,
    discount_end: null,
  };
});
fs.writeFileSync(
  path.join(root, "src/data/catalog.preview.json"),
  JSON.stringify(seed),
);
