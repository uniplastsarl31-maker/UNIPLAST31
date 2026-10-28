import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FAMILY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  PRODUCT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER = {
  name: "Client de test",
  phone: "0550000000",
  wilaya: "Oran",
  address: "Adresse de test 123",
  notes: "",
};
const db = new PGlite();
async function identity(uid: string | null, admin = false) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${uid || ""}',false); select set_config('request.jwt.claims','{"is_anonymous":${!admin}}',false);`,
  );
}
async function owner() {
  await db.exec("reset role");
}
async function makeOrder(
  cartons = 5,
  price = 2000,
  key = crypto.randomUUID(),
  product = PRODUCT,
) {
  const r = await db.query<{ doc: any }>(
    "select public.create_order($1::jsonb,$2::jsonb,$3::uuid,0,'DZD') doc",
    [
      JSON.stringify([
        {
          product_id: product,
          cartons,
          expected_unit_price_cents: price,
          expected_pack_size: 10,
        },
      ]),
      JSON.stringify(CUSTOMER),
      key,
    ],
  );
  return r.rows[0].doc;
}
async function stock() {
  await owner();
  const r = await db.query<{ stock_cartons: number }>(
    "select stock_cartons from products where id=$1",
    [PRODUCT],
  );
  return r.rows[0].stock_cartons;
}

test("PostgreSQL migration, catalogue integrity and server security", async (t) => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}',unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  await db.exec(
    await readFile(
      new URL("../migrations/001_store.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(new URL("../seed-catalog.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    await readFile(
      new URL("../migrations/002_customer_features.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values ($1),($2),($3)", [
    A,
    B,
    ADMIN,
  ]);
  await db.query("insert into public.admin_users(user_id) values($1)", [ADMIN]);
  await db.query("insert into families(id,name) values($1,'Test family')", [
    FAMILY,
  ]);
  await db.query(
    `insert into products(id,name,code,family_id,pack_size,unit_price_cents,available,availability_confirmed,stock_cartons) values($1,'Test product','TEST-ONLY',$2,10,2000,true,true,100)`,
    [PRODUCT, FAMILY],
  );
  let order: any;
  await t.test(
    "350 source references, 17 families, missing prices and duplicate barcodes preserved safely",
    async () => {
      const r = await db.query<{
        n: number;
        missing: number;
        unchecked: number;
      }>(
        "select count(*)::int n,count(*) filter(where price_on_request)::int missing,count(*) filter(where not availability_confirmed)::int unchecked from products where code<>'TEST-ONLY'",
      );
      assert.deepEqual(r.rows[0], { n: 350, missing: 34, unchecked: 350 });
      assert.equal(
        (await db.query<{ n: number }>("select count(*)::int n from families"))
          .rows[0].n,
        18,
      );
      assert.equal(
        (
          await db.query(
            "select barcode from products where barcode is not null group by barcode having count(*)>1",
          )
        ).rows.length,
        0,
      );
      const p = (
        await db.query<{ unit_price_cents: number; pack_size: number }>(
          "select unit_price_cents,pack_size from products where code='B10L'",
        )
      ).rows[0];
      assert.equal(Number(p.unit_price_cents), 11700);
      assert.equal(p.pack_size, 20);
    },
  );
  await t.test(
    "public catalogue readable; customers cannot edit products, promote themselves or insert orders",
    async () => {
      await db.exec("set role anon");
      assert.ok(
        (await db.query("select id from products limit 1")).rows.length,
      );
      await assert.rejects(
        db.query("select * from orders"),
        /permission denied/,
      );
      await identity(A);
      assert.equal(
        (await db.query<{ a: boolean }>("select is_admin() a")).rows[0].a,
        false,
      );
      assert.equal(
        (await db.query("update products set unit_price_cents=1 returning id"))
          .rows.length,
        0,
      );
      await assert.rejects(
        db.query("insert into admin_users(user_id) values($1)", [A]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("insert into orders(reference) values('forged')"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("insert into order_items(name) values('forged')"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "5 cartons × 10 units × 20 DA = 50 units and 1000 DA; duplicate retries reserve once",
    async () => {
      await identity(A);
      const key = crypto.randomUUID();
      order = await makeOrder(5, 2000, key);
      const replay = await makeOrder(5, 2000, key);
      assert.equal(order.id, replay.id);
      assert.equal(order.total_cents, 100000);
      assert.equal(order.items[0].total_units, 50);
      assert.equal(order.items[0].carton_price_cents, 20000);
      assert.equal(await stock(), 95);
      await identity(A);
      const key2 = crypto.randomUUID();
      const results = await Promise.all([
        makeOrder(1, 2000, key2),
        makeOrder(1, 2000, key2),
      ]);
      assert.equal(results[0].id, results[1].id);
      assert.equal(await stock(), 94);
    },
  );
  await t.test(
    "price tampering, fractional quantities and repeated product lines are rejected without stock loss",
    async () => {
      await identity(A);
      await assert.rejects(makeOrder(1, 1), /PRICES_CHANGED/);
      await assert.rejects(makeOrder(0), /Quantité invalide/);
      await assert.rejects(makeOrder(1.5), /integer/);
      const line = {
        product_id: PRODUCT,
        cartons: 1,
        expected_unit_price_cents: 2000,
        expected_pack_size: 10,
      };
      await assert.rejects(
        db.query("select create_order($1::jsonb,$2::jsonb,$3::uuid,0,'DZD')", [
          JSON.stringify([line, line]),
          JSON.stringify(CUSTOMER),
          crypto.randomUUID(),
        ]),
        /répétée/,
      );
      assert.equal(await stock(), 94);
    },
  );
  await t.test(
    "RLS isolates two customers and prevents reading another customer’s order document",
    async () => {
      await identity(B);
      assert.equal(
        (await db.query("select * from orders where id=$1", [order.id])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from order_items where order_id=$1", [
            order.id,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ doc: any }>("select order_document($1) doc", [
            order.id,
          ])
        ).rows[0].doc,
        null,
      );
      await assert.rejects(
        db.query("select set_order_status($1,'confirmed')", [order.id]),
        /ADMIN_REQUIRED/,
      );
    },
  );
  await t.test(
    "server applies active discounts and expires them using actual timestamps",
    async () => {
      await owner();
      await db.query(
        `update products set discount_price_cents=1600,discount_start=now()-interval '1 hour',discount_end=now()+interval '1 hour' where id=$1`,
        [PRODUCT],
      );
      await identity(B);
      const d = await makeOrder(2, 1600);
      assert.equal(d.total_cents, 32000);
      assert.equal(d.discount_cents, 8000);
      await owner();
      await db.query(
        `update products set discount_start=now()-interval '2 hour',discount_end=now()-interval '1 hour' where id=$1`,
        [PRODUCT],
      );
      await identity(B);
      await assert.rejects(makeOrder(1, 1600), /PRICES_CHANGED/);
      const expired = await makeOrder(1, 2000);
      assert.equal(expired.total_cents, 20000);
      await owner();
      await assert.rejects(
        db.query("update products set discount_price_cents=-1 where id=$1", [
          PRODUCT,
        ]),
        /valid_discount/,
      );
      await db.query(
        "update products set discount_price_cents=null where id=$1",
        [PRODUCT],
      );
    },
  );
  await t.test(
    "availability, managed stock, upcoming state and changed shipping are validated on the server",
    async () => {
      await owner();
      await db.query("update products set available=false where id=$1", [
        PRODUCT,
      ]);
      await identity(B);
      await assert.rejects(makeOrder(1), /UNAVAILABLE/);
      await owner();
      await db.query(
        "update products set available=true,stock_cartons=0 where id=$1",
        [PRODUCT],
      );
      await identity(B);
      await assert.rejects(makeOrder(1), /UNAVAILABLE/);
      await owner();
      await db.query(
        "update products set stock_cartons=30,upcoming=true where id=$1",
        [PRODUCT],
      );
      await identity(B);
      await assert.rejects(makeOrder(1), /UNAVAILABLE/);
      await owner();
      await db.query("update products set upcoming=false where id=$1", [
        PRODUCT,
      ]);
      await db.exec("update store_settings set shipping_cents=100");
      await identity(B);
      await assert.rejects(makeOrder(1), /PRICES_CHANGED/);
      await owner();
      await db.exec("update store_settings set shipping_cents=0");
    },
  );
  await t.test(
    "historical item data stays immutable and cancelled orders restore reserved stock only once",
    async () => {
      await owner();
      await db.query(
        "update products set name='New name',unit_price_cents=3000,pack_size=20 where id=$1",
        [PRODUCT],
      );
      await identity(A);
      const doc = (
        await db.query<{ doc: any }>("select order_document($1) doc", [
          order.id,
        ])
      ).rows[0].doc;
      assert.equal(doc.items[0].name, "Test product");
      assert.equal(doc.items[0].pack_size, 10);
      assert.equal(doc.total_cents, 100000);
      await identity(ADMIN, true);
      assert.equal(
        (await db.query<{ a: boolean }>("select is_admin() a")).rows[0].a,
        true,
      );
      await db.query("select set_order_status($1,'confirmed')", [order.id]);
      const sold = (
        await db.query<{ cartons: number }>(
          "select cartons from catalog_sales() where product_id=$1",
          [PRODUCT],
        )
      ).rows[0];
      assert.equal(Number(sold.cartons), 5);
      const before = await stock();
      await identity(ADMIN, true);
      await db.query("select set_order_status($1,'cancelled')", [order.id]);
      await db.query("select set_order_status($1,'cancelled')", [order.id]);
      assert.equal(await stock(), before + 5);
      await identity(ADMIN, true);
      await assert.rejects(
        db.query("select set_order_status($1,'confirmed')", [order.id]),
        /Transition/,
      );
    },
  );
  await t.test(
    "cancelling an unmanaged-stock order does not invent stock after stock management is enabled",
    async () => {
      await owner();
      await db.query("update products set stock_cartons=null where id=$1", [
        PRODUCT,
      ]);
      await identity(A);
      const line = {
        product_id: PRODUCT,
        cartons: 1,
        expected_unit_price_cents: 3000,
        expected_pack_size: 20,
      };
      const r = await db.query<{ doc: any }>(
        "select create_order($1::jsonb,$2::jsonb,$3::uuid,0,'DZD') doc",
        [JSON.stringify([line]), JSON.stringify(CUSTOMER), crypto.randomUUID()],
      );
      await owner();
      await db.query("update products set stock_cartons=10 where id=$1", [
        PRODUCT,
      ]);
      await identity(ADMIN, true);
      await db.query("select set_order_status($1,'cancelled')", [
        r.rows[0].doc.id,
      ]);
      assert.equal(await stock(), 10);
    },
  );
  await t.test(
    "private files, request idempotency and preorder validation enforce ownership",
    async () => {
      await owner();
      await db.query(
        "update products set upcoming=true,preorder_enabled=true where id=$1",
        [PRODUCT],
      );
      const file = A + "/" + crypto.randomUUID() + ".pdf";
      await identity(A);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('request-attachments',$1)",
        [file],
      );
      await identity(B);
      assert.equal(
        (await db.query("select * from storage.objects where name=$1", [file]))
          .rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('request-attachments',$1)",
          [A + "/" + crypto.randomUUID() + ".pdf"],
        ),
        /row-level security/,
      );
      const details = {
        description: "Fabrication spéciale de test",
        quantity: "100 unités",
        attachments: [file],
      };
      await assert.rejects(
        db.query(
          "select create_customer_request('custom',null,0,$1::jsonb,$2::jsonb,$3::uuid)",
          [
            JSON.stringify(CUSTOMER),
            JSON.stringify(details),
            crypto.randomUUID(),
          ],
        ),
        /non autorisée/,
      );
      await identity(A);
      const key = crypto.randomUUID();
      const run = () =>
        db.query<{ doc: any }>(
          "select create_customer_request('custom',null,0,$1::jsonb,$2::jsonb,$3::uuid) doc",
          [JSON.stringify(CUSTOMER), JSON.stringify(details), key],
        );
      const a = await run(),
        b = await run();
      assert.equal(a.rows[0].doc.id, b.rows[0].doc.id);
      const pre = await db.query<{ doc: any }>(
        "select create_customer_request('preorder',$1,3,$2::jsonb,$3::jsonb,$4::uuid) doc",
        [
          PRODUCT,
          JSON.stringify(CUSTOMER),
          JSON.stringify({ attachments: [] }),
          crypto.randomUUID(),
        ],
      );
      assert.equal(pre.rows[0].doc.cartons, 3);
      assert.equal(pre.rows[0].doc.status, "pending");
      await assert.rejects(
        db.query("update customer_requests set details='{}'"),
        /permission denied/,
      );
      await identity(B);
      assert.equal(
        (await db.query("select * from customer_requests")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "family reordering is atomic and rejects missing or duplicated ids",
    async () => {
      await identity(ADMIN, true);
      const ids = (
        await db.query<{ id: string }>(
          "select id from families order by sort_order,id",
        )
      ).rows
        .map((r) => r.id)
        .reverse();
      await db.query("select reorder_families($1::uuid[])", [ids]);
      assert.deepEqual(
        (
          await db.query<{ id: string }>(
            "select id from families order by sort_order",
          )
        ).rows.map((r) => r.id),
        ids,
      );
      await assert.rejects(
        db.query("select reorder_families($1::uuid[])", [ids.slice(1)]),
        /invalide/,
      );
      assert.deepEqual(
        (
          await db.query<{ id: string }>(
            "select id from families order by sort_order",
          )
        ).rows.map((r) => r.id),
        ids,
      );
    },
  );
  await t.test(
    "a non-empty collection can only be deleted with an atomic valid transfer",
    async () => {
      await identity(ADMIN, true);
      await assert.rejects(
        db.query("select delete_family($1,null)", [FAMILY]),
        /FAMILY_NOT_EMPTY/,
      );
      await owner();
      const target = (
        await db.query<{ id: string }>(
          "select id from families where id<>$1 limit 1",
          [FAMILY],
        )
      ).rows[0].id;
      await identity(ADMIN, true);
      await db.query("select delete_family($1,$2)", [FAMILY, target]);
      assert.equal(
        (await db.query("select * from families where id=$1", [FAMILY])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query<{ family_id: string }>(
            "select family_id from products where id=$1",
            [PRODUCT],
          )
        ).rows[0].family_id,
        target,
      );
      await identity(ADMIN, false);
      assert.equal(
        (await db.query<{ a: boolean }>("select is_admin() a")).rows[0].a,
        false,
        "an anonymous JWT cannot use admin privileges even if its id is listed",
      );
    },
  );
  await t.test(
    "restricted prices cannot be extracted by REST, RPC, anonymous sessions or the order endpoint",
    async () => {
      await identity(ADMIN, true);
      await db.exec(
        "update store_settings set price_visibility='approved' where id=true",
      );
      await identity(A);
      assert.equal((await db.query("select * from products")).rows.length, 0);
      const redacted = (
        await db.query<{ p: any }>("select get_catalog_products(0,500) p")
      ).rows;
      assert.ok(redacted.length > 0);
      for (const { p } of redacted) {
        assert.equal(p.price_hidden, true);
        assert.equal(p.unit_price_cents, 0);
        assert.equal(p.discount_price_cents, null);
        assert.equal(p.source_metadata, undefined);
      }
      await assert.rejects(makeOrder(), /APPROVAL_REQUIRED/);
      await assert.rejects(
        db.query(
          "select create_order_internal('[]','{}',gen_random_uuid(),0,'DZD')",
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select request_customer_access('Client A','0550000000')"),
        /confirmé/,
      );
      await db.exec(
        "reset role;set role anon;select set_config('request.jwt.claim.sub','',false)",
      );
      assert.equal((await db.query("select * from products")).rows.length, 0);
      assert.ok(
        (await db.query<{ p: any }>("select get_catalog_products(0,1) p"))
          .rows[0].p.price_hidden,
      );
    },
  );
  await t.test(
    "individual approval is admin-only, revocable, and preserves private historical orders",
    async () => {
      await identity(A, true);
      await db.query("select request_customer_access('Client A','0550000000')");
      await assert.rejects(
        db.query("update customer_access set status='approved'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select set_customer_access($1,'approved')", [A]),
        /ADMIN_REQUIRED/,
      );
      await assert.rejects(
        db.query("select list_customer_access()"),
        /ADMIN_REQUIRED/,
      );
      await identity(ADMIN, true);
      await db.query("select set_customer_access($1,'approved')", [A]);
      assert.ok(
        (await db.query("select list_customer_access()")).rows.length > 0,
      );
      await identity(A, true);
      assert.equal(
        (await db.query<{ ok: boolean }>("select can_view_prices() ok")).rows[0]
          .ok,
        true,
      );
      const p = (
        await db.query<{ p: any }>("select get_catalog_products(0,1) p")
      ).rows[0].p;
      assert.equal(p.price_hidden, false);
      assert.equal(p.source_metadata, undefined);
      await identity(A, false);
      assert.equal(
        (await db.query<{ ok: boolean }>("select can_view_prices() ok")).rows[0]
          .ok,
        false,
        "an anonymous token cannot use approved-account privileges",
      );
      await identity(A, true);
      assert.ok((await db.query("select * from products")).rows.length > 0);
      const own = (await db.query("select * from orders")).rows.length;
      assert.ok(own > 0);
      await identity(B, true);
      assert.equal(
        (await db.query("select * from customer_access")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from orders where user_id=$1", [A])).rows
          .length,
        0,
      );
      await identity(ADMIN, true);
      await db.query("select set_customer_access($1,'revoked')", [A]);
      await identity(A, true);
      await db.query("select request_customer_access('Client A','0550000000')");
      assert.equal(
        (await db.query<{ ok: boolean }>("select can_view_prices() ok")).rows[0]
          .ok,
        false,
      );
      assert.equal((await db.query("select * from products")).rows.length, 0);
      assert.equal((await db.query("select * from orders")).rows.length, own);
      await identity(ADMIN, true);
      await db.exec(
        "update store_settings set price_visibility='public' where id=true",
      );
    },
  );
  await t.test(
    "public catalog PDF uploads require admin and immutable PDF paths",
    async () => {
      await identity(A, true);
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('company-catalogs','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf')",
        ),
        /row-level security/,
      );
      await identity(ADMIN, true);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('company-catalogs','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf')",
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('company-catalogs','evil.html')",
        ),
        /row-level security/,
      );
      await identity(B);
      assert.equal(
        (
          await db.query(
            "select * from storage.objects where bucket_id='company-catalogs'",
          )
        ).rows.length,
        1,
      );
      await db.query(
        "update storage.objects set name='b.pdf' where bucket_id='company-catalogs'",
      );
      assert.equal(
        (
          await db.query<{ name: string }>(
            "select name from storage.objects where bucket_id='company-catalogs'",
          )
        ).rows[0].name,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
      );
    },
  );
  await db.close();
});
