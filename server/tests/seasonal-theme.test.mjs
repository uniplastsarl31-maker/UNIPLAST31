import { test } from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify-store.mjs";
import { memoryStores } from "./blob-fixture.mjs";

const SITE = "https://seasonal-theme-test.example";
const INSTALL = "TEST-ONLY-seasonal-theme-install-key";
const themes = [
  "classic",
  "ramadan-night",
  "ramadan-ivory",
  "newyear-snow",
  "newyear-midnight",
];
async function fixture() {
  const stores = memoryStores();
  let cookie = "";
  const call = async (name, data, admin = true, binary = false) => {
    // Every request opens a fresh handler and disposable database working copy.
    const response = await createNetlifyHandler({
      origins: [SITE],
      setupKey: INSTALL,
      getStores: () => stores,
    })(
      new Request(SITE + (name.startsWith("/") ? name : "/api/local/" + name), {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined
            ? {}
            : { "content-type": binary ? "image/png" : "application/json" }),
          ...(admin && cookie ? { cookie } : {}),
        },
        body:
          data === undefined ? undefined : binary ? data : JSON.stringify(data),
      }),
      { ip: "192.0.2.90" },
    );
    if (admin && response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return {
      status: response.status,
      data: response.headers.get("content-type")?.startsWith("application/json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    };
  };
  assert.equal(
    (
      await call("setup", {
        setup_key: INSTALL,
        password: "TEST-ONLY-seasonal-theme-admin!",
      })
    ).status,
    200,
  );
  return { stores, call };
}

test("all themes persist through cold requests and CAS retries without changing owner photos or catalogue", async () => {
  const f = await fixture();
  const initial = (await f.call("catalog")).data;
  assert.equal(initial.settings.storefront_theme, undefined);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
  const image = await f.call("upload?public=1", png, true, true);
  assert.equal(image.status, 200);
  const original = {
    ...initial.products[0],
    images: [{ url: image.data, scale: 1.6, x: 17, y: -12 }],
  };
  assert.equal((await f.call("product-save", original)).status, 200);
  const before = (await f.call("catalog")).data;
  f.stores.state.rejectWrites = 1;
  for (const storefront_theme of themes) {
    assert.equal(
      (await f.call("settings-save", { ...before.settings, storefront_theme }))
        .status,
      200,
    );
    const after = (await f.call("catalog")).data;
    assert.equal(after.settings.storefront_theme, storefront_theme);
    assert.deepEqual(after.products, before.products);
    assert.deepEqual(after.families, before.families);
    assert.deepEqual(after.sales, before.sales);
    assert.deepEqual(after.settings, { ...before.settings, storefront_theme });
  }
  assert(f.stores.state.conflicts >= 1);
  const bytes = await f.call(image.data);
  assert.equal(bytes.status, 200);
  assert.deepEqual(bytes.data, png);
  assert.equal(f.stores.files.records.size, 1);
});

test("legacy settings saves preserve the selected theme; invalid and visitor saves cannot replace it", async () => {
  const f = await fixture();
  const settings = (await f.call("catalog")).data.settings;
  assert.equal(
    (
      await f.call("settings-save", {
        ...settings,
        storefront_theme: "ramadan-ivory",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.call("settings-save", {
        ...settings,
        company_name: "TEST propriétaire",
      })
    ).status,
    200,
  );
  const expected = (await f.call("catalog")).data;
  assert.equal(expected.settings.storefront_theme, "ramadan-ivory");
  assert.equal(expected.settings.company_name, "TEST propriétaire");
  for (const storefront_theme of ["autumn", "", null, 5, {}, ["classic"]]) {
    const result = await f.call("settings-save", {
      ...settings,
      storefront_theme,
    });
    assert.equal(result.status, 400);
    assert.match(result.data.error, /thème/);
    assert.deepEqual((await f.call("catalog")).data, expected);
  }
  assert.equal(
    (
      await f.call(
        "settings-save",
        { ...settings, storefront_theme: "classic" },
        false,
      )
    ).status,
    403,
  );
  assert.deepEqual((await f.call("catalog")).data, expected);
});
