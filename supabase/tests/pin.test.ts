import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
const ADMIN = "11111111-1111-4111-8111-111111111111",
  A = "22222222-2222-4222-8222-222222222222",
  B = "33333333-3333-4333-8333-333333333333",
  F = "44444444-4444-4444-8444-444444444444",
  P = "55555555-5555-4555-8555-555555555555";
async function identity(id: string, admin = false) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"is_anonymous":${!admin}}',false);`,
  );
}
async function value(sql: string, args: unknown[] = []) {
  return (await db.query<{ v: any }>(sql, args)).rows[0]?.v;
}
test("hosted PIN access, bcrypt, persistent lockout, private history and presentation migration", async (t) => {
  try {
    await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}',unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema public,auth,storage to anon,authenticated;grant select,insert,update,delete on storage.objects to anon,authenticated;`);
    for (const file of [
      "001_store.sql",
      "002_customer_features.sql",
      "003_pin_and_presentation.sql",
      "004_product_weight.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users(id) values($1),($2),($3)", [
      ADMIN,
      A,
      B,
    ]);
    await db.query("insert into admin_users(user_id) values($1)", [ADMIN]);
    await db.query("insert into families(id,name) values($1,'Test')", [F]);
    await db.query(
      "insert into products(id,name,code,family_id,pack_size,unit_price_cents,available,availability_confirmed,stock_cartons) values($1,'Test produit','TEST-PIN',$2,10,2000,true,true,100)",
      [P, F],
    );
    let code: string, order: any;
    await t.test(
      "admin-only preloaded codes, bcrypt salted hashes, no browser PIN table access",
      async () => {
        await identity(ADMIN, true);
        code = await value("select save_customer_code(null,$1,$2,$3,true) v", [
          "Client test",
          "0550000000",
          "012345",
        ]);
        assert(code);
        const rows = await value(
          "select jsonb_agg(v) v from list_customer_codes() v",
        );
        assert.equal(rows[0].phone, "+213550000000");
        assert(!JSON.stringify(rows).includes("012345"));
        assert(!JSON.stringify(rows).includes("pin_hash"));
        await db.exec("reset role");
        const hash = await value(
          "select pin_hash v from customer_codes where id=$1",
          [code],
        );
        assert(hash.startsWith("$2a$12$"));
        assert.notEqual(hash, "012345");
        await identity(A);
        await assert.rejects(() => db.query("select * from customer_codes"));
        await assert.rejects(() =>
          db.query("select save_customer_code(null,$1,$2,$3,true)", [
            "Intrus",
            "0660000000",
            "123456",
          ]),
        );
        await assert.rejects(() =>
          db.query("select request_customer_access('Intrus','0550000000')"),
        );
      },
    );
    await t.test(
      "public catalog redacts prices; only a correct phone/PIN grants price access",
      async () => {
        const hidden = await value("select get_catalog_products(0,500) v");
        assert.equal(hidden.price_hidden, true);
        assert.equal(hidden.unit_price_cents, 0);
        assert.equal(
          (
            await value("select unlock_customer($1,$2) v", [
              "0550000000",
              "999999",
            ])
          ).ok,
          false,
        );
        assert.equal(
          (
            await value("select unlock_customer($1,$2) v", [
              "٠٥٥٠٠٠٠٠٠٠",
              "٠١٢٣٤٥",
            ])
          ).ok,
          true,
        );
        assert.equal(await value("select can_view_prices() v"), true);
        const visible = await value("select get_catalog_products(0,500) v");
        assert.equal(visible.unit_price_cents, 2000);
        assert(!("source_metadata" in visible));
      },
    );
    await t.test(
      "phone-owned documents work on a second device; unrelated visitor is denied",
      async () => {
        const items = [
            {
              product_id: P,
              cartons: 2,
              expected_unit_price_cents: 2000,
              expected_pack_size: 10,
            },
          ],
          customer = {
            name: "Client test",
            phone: "0550000000",
            wilaya: "Oran",
            address: "Adresse de test 123",
            notes: "",
          };
        order = await value(
          "select create_order($1::jsonb,$2::jsonb,$3::uuid,0,'DZD') v",
          [
            JSON.stringify(items),
            JSON.stringify(customer),
            crypto.randomUUID(),
          ],
        );
        assert.equal(order.total_cents, 40000);
        await identity(B);
        assert.equal(
          await value("select order_document($1) v", [order.id]),
          null,
        );
        assert.equal(
          (
            await value("select unlock_customer($1,$2) v", [
              "0550000000",
              "012345",
            ])
          ).ok,
          true,
        );
        assert.equal(
          (await value("select order_document($1) v", [order.id])).id,
          order.id,
        );
        assert.equal((await db.query("select * from orders")).rows.length, 1);
        await db.query("select lock_customer()");
        assert.equal(await value("select can_view_prices() v"), false);
        assert.equal(
          await value("select order_document($1) v", [order.id]),
          null,
        );
        await identity(A);
        assert.equal(await value("select can_view_prices() v"), true);
      },
    );
    await t.test(
      "code rotation invalidates both old browsers and old PIN; disabled access stays closed",
      async () => {
        await identity(ADMIN, true);
        await value("select save_customer_code($1,$2,$3,$4,true) v", [
          code,
          "Client test",
          "0550000000",
          "654321",
        ]);
        await identity(A);
        assert.equal(await value("select can_view_prices() v"), false);
        assert.equal(
          await value("select order_document($1) v", [order.id]),
          null,
        );
        assert.equal(
          (await db.query("select * from order_items")).rows.length,
          0,
        );
        assert.equal(
          (
            await value("select unlock_customer($1,$2) v", [
              "0550000000",
              "012345",
            ])
          ).ok,
          false,
        );
        assert.equal(
          (
            await value("select unlock_customer($1,$2) v", [
              "0550000000",
              "654321",
            ])
          ).ok,
          true,
        );
        assert.equal(
          (await value("select order_document($1) v", [order.id])).items[0]
            .unit_price_cents,
          2000,
        );
        await identity(ADMIN, true);
        await value("select save_customer_code($1,$2,$3,null,false) v", [
          code,
          "Client test",
          "0550000000",
        ]);
        await identity(A);
        assert.equal(await value("select can_view_prices() v"), false);
      },
    );
    await t.test(
      "failed attempts survive transactions and lock the targeted phone",
      async () => {
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await value("select unlock_customer($1,$2) v", [
                "0660000000",
                "111111",
              ])
            ).ok,
            false,
          );
        const locked = await value("select unlock_customer($1,$2) v", [
          "0660000000",
          "111111",
        ]);
        assert.equal(locked.ok, false);
        assert.match(locked.error, /Trop de tentatives/);
        await db.exec("reset role");
        assert.equal(
          await value(
            "select max(attempts) v from customer_code_attempts where key='p:'||md5('+213660000000')",
          ),
          5,
        );
      },
    );
    await t.test(
      "presentation values are saved and feedback is visible only to administrators",
      async () => {
        await identity(ADMIN, true);
        await db.query(
          "update store_settings set home_slider_height=620,slider_interval=8,about_title='Notre entreprise'",
        );
        await db.query(
          "update families set slider_height=420,slides=$1::jsonb where id=$2",
          [
            JSON.stringify([
              {
                id: crypto.randomUUID(),
                title: "Collection test",
                image: "/assets/basket.webp",
                visible: true,
                scale: 1.2,
              },
            ]),
            F,
          ],
        );
        await identity(B);
        assert.equal(
          await value("select home_slider_height v from store_settings"),
          620,
        );
        await db.query(
          "select submit_feedback('Visiteur','','Un nouveau format serait utile.')",
        );
        assert.equal(
          (await db.query("select id,message from customer_feedback")).rows
            .length,
          0,
        );
        assert.equal(
          (await db.query("update customer_feedback set status='read'"))
            .affectedRows,
          0,
        );
        await identity(ADMIN, true);
        assert.equal(
          (await db.query("select id,message from customer_feedback")).rows
            .length,
          1,
        );
      },
    );
  } finally {
    await db.close();
  }
});
