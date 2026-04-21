// One-time helper: assign all client Pages in the Business Portfolio to the
// "ARA CRM NEw" System User so the backend can pull Page access tokens and
// subscribe to leadgen webhooks.
//
// Usage:
//   1. Put your ADMIN USER TOKEN (not the System User token) into
//      META_ADMIN_USER_TOKEN in backend/.env. It needs these scopes:
//        business_management, pages_manage_metadata, pages_show_list
//      Easiest way: Graph API Explorer → User Token → generate with those
//      scopes. The token you pasted in the earlier /client_pages request
//      already has them.
//
//   2. From repo root:
//        node backend/scripts/metaAssignPagesToSystemUser.js
//
//   3. Verify after:
//        curl "https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,tasks&access_token=$META_SYSTEM_USER_TOKEN"
//      should now list all 21 Pages with access tokens.
//
// Safe to re-run — Meta treats duplicate assignment as a no-op (returns
// "already assigned" error, which we ignore).

import dotenv from "dotenv";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BUSINESS_ID = "633026626311825";
const SYSTEM_USER_ID = "122127939423102344";
const TASKS = ["MANAGE"]; // full control: leads, content, ads, insights
const API_VERSION = process.env.META_API_VERSION || "v19.0";

// All 21 client Pages from the /{business_id}/client_pages response.
const PAGES = [
  { id: "101182509326274", name: "Advanced Grohair & Gloskin Clinic Adyar" },
  { id: "109666682092895", name: "WeDo" },
  { id: "121993810994604", name: "Advanced GroHair&GloSkin Trichy" },
  { id: "141481662373214", name: "Advanced GloSkin Clinic Bannerghatta" },
  { id: "169018169619519", name: "Advanced GroHair&GloSkin Coimbatore" },
  { id: "172290759305534", name: "Advanced GroHair Tirupur" },
  {
    id: "177546162105900",
    name: "Advanced Grohair and Gloskin Clinic, Mogappair",
  },
  { id: "180311331831628", name: "Advanced GloSkin Tirupur" },
  { id: "235235633014349", name: "Advanced GroHair Avinashi Road" },
  { id: "301080356412913", name: "Bonitaa Skin and Hair Clinic - Salem" },
  {
    id: "346326028570941",
    name: "Advanced Grohair & Gloskin - Trichy Cantonment",
  },
  { id: "653807541160238", name: "Dr. EduMed Anna Nagar Chennai" },
  { id: "663654716841502", name: "Advanced GloSkin Clinic cuddalore" },
  { id: "723158910877351", name: "Advanced GroHair & GloSkin Dharmapuri" },
  { id: "808512562348192", name: "Bonitaa skin and hair namakkal" },
  { id: "876263568900682", name: "Advanced Grohair & Gloskin Ramanathapuram" },
  {
    id: "911934648678678",
    name: "Advanced GroHair and GloSkin Clinic Neyveli",
  },
  { id: "950946911427936", name: "Advanced GroHair & GloSkin Tenkasi" },
  { id: "952082647987022", name: "Ad Grohair & Gloskin Clinic Ashiyana" },
  { id: "998035133385999", name: "Minus Slimming Clinic Velachery" },
  { id: "1067412303117759", name: "Ad GroGlo Clinic Sahakar Nagar" },
];

const adminToken = process.env.META_ADMIN_USER_TOKEN;
if (!adminToken) {
  console.error(
    "ERROR: META_ADMIN_USER_TOKEN is not set in backend/.env.\n" +
      "Use the User Token you already have in Graph API Explorer (the one that\n" +
      "successfully listed /client_pages). Add a line:\n\n" +
      "  META_ADMIN_USER_TOKEN=<paste token here>\n\n" +
      "Remove it from .env after this script completes.",
  );
  process.exit(1);
}

const postJson = (path, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

const buildBatchItem = (page) => {
  const params = new URLSearchParams({
    user: SYSTEM_USER_ID,
    business: BUSINESS_ID,
    tasks: JSON.stringify(TASKS),
  });
  return {
    method: "POST",
    relative_url: `${API_VERSION}/${page.id}/assigned_users?${params.toString()}`,
    name: page.name,
  };
};

const run = async () => {
  console.log(
    `Assigning ${PAGES.length} Pages to System User ${SYSTEM_USER_ID}\n` +
      `Business Portfolio: ${BUSINESS_ID}\n` +
      `Tasks: ${JSON.stringify(TASKS)}\n`,
  );

  // Meta caps batch at 50 — we're fine with 21.
  const batch = PAGES.map(buildBatchItem);

  const result = await postJson("/", {
    access_token: adminToken,
    batch,
  });

  if (result.status !== 200 || !Array.isArray(result.body)) {
    console.error(`Top-level request failed (HTTP ${result.status}):`);
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(2);
  }

  let ok = 0;
  let alreadyAssigned = 0;
  let failed = 0;
  const failures = [];

  result.body.forEach((entry, i) => {
    const page = PAGES[i];
    const parsed =
      entry && entry.body
        ? (() => {
            try {
              return JSON.parse(entry.body);
            } catch {
              return { raw: entry.body };
            }
          })()
        : null;

    const status = entry?.code ?? 0;

    if (status >= 200 && status < 300 && parsed?.success !== false) {
      ok++;
      console.log(`  ✓ ${page.name} (${page.id})`);
      return;
    }

    const errCode = parsed?.error?.code;
    const errMsg = parsed?.error?.message || "";
    // 3969/33 = already assigned, 190 = token issue, 100 = bad param
    if (errCode === 3969 || /already assigned|already has/i.test(errMsg)) {
      alreadyAssigned++;
      console.log(`  ~ ${page.name} — already assigned`);
      return;
    }

    failed++;
    failures.push({ page, status, error: parsed?.error || parsed });
    console.log(
      `  ✗ ${page.name} — HTTP ${status} — ${errMsg || "unknown error"}`,
    );
  });

  console.log(
    `\nDone. success=${ok}  already_assigned=${alreadyAssigned}  failed=${failed}`,
  );

  if (failures.length) {
    console.log("\nFailures:");
    console.log(JSON.stringify(failures, null, 2));
    process.exitCode = 3;
  }
};

run().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(4);
});
