/**
 * Seed 21 Meta-enabled clients from the page_id/ad_account mapping sheet.
 *
 * Idempotent — uses updateOne + upsert keyed on clientName so re-running
 * is safe.
 *
 * Run from backend/ directory:
 *   node scripts/seedMetaClients.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Client from '../models/Client.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

// ─── 21 clients ────────────────────────────────────────────────────────────
// ad_account_id values come from the sheet (numeric strings); they are stored
// as "act_<number>" to satisfy the schema validator.
// Clients with no ad account omit meta_ad_account_id (sparse unique index).
const CLIENTS = [
  {
    clientName: 'Advanced GroGlo Clinic Sahakar Nagar',
    meta_ad_account_id: 'act_2234562450649014',
    meta_pages: [
      { page_id: '1067412303117759', page_name: 'Ad GroGlo Clinic Sahakar Nagar' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Kaloor',
    meta_ad_account_id: 'act_2422612424877041',
    meta_pages: [
      { page_id: '1003619826175907', page_name: 'Ad GroHair and GloSkin Kaloor' },
    ],
  },
  {
    clientName: 'Advanced Grohair & Gloskin Theni',
    meta_ad_account_id: 'act_9223620000995629',
    meta_pages: [
      { page_id: '432405749963339', page_name: 'Ad Grohair and Gloskin Theni' },
    ],
  },
  {
    clientName: 'Advanced Grohair & Gloskin Namakkal',
    meta_ad_account_id: 'act_800798932805550',
    meta_pages: [
      { page_id: '486601624546388', page_name: 'Adgro hair & glo skin Namakkal' },
    ],
  },
  {
    clientName: 'Advanced Grohair Clinic Tirunelveli',
    meta_ad_account_id: 'act_139689712518622',
    meta_pages: [
      { page_id: '102397179627147', page_name: 'Adgrohair Clinic Tirunelveli' },
    ],
  },
  {
    clientName: 'Advanced Grohair & Gloskin Karaikudi',
    meta_ad_account_id: 'act_1237523015045625',
    meta_pages: [
      { page_id: '533560986507970', page_name: 'AdgrohairandgloskinKaraikudi' },
    ],
  },
  {
    clientName: 'Advanced Grohair Clinic Warangal',
    meta_ad_account_id: 'act_1226632599261703',
    meta_pages: [
      { page_id: '746115951916297', page_name: 'Adgrohairclinicwaragal' },
    ],
  },
  {
    // Two FB pages share the same ad account in Cuddalore
    clientName: 'Advanced GroHair & GloSkin Cuddalore',
    meta_ad_account_id: 'act_1543617913485113',
    meta_pages: [
      { page_id: '663654716841502', page_name: 'Advanced GloSkin Clinic Cuddalore' },
      { page_id: '758799753976825', page_name: 'Advanced GroHair & GloSkin Clinic Cuddalore' },
    ],
  },
  {
    // Nellore — single client, both pages under the GroHair ad account
    clientName: 'Advanced GroHair Nellore',
    meta_ad_account_id: 'act_1663450124176309',
    meta_pages: [
      { page_id: '156662764188249', page_name: 'Advanced GroHair Clinic Nellore' },
      { page_id: '161892617008749', page_name: 'Advanced Gloskin Clinic Nellore' },
    ],
  },
  {
    // Two FB pages share the same ad account in Thoothukudi
    clientName: 'Advanced GroHair & GloSkin Thoothukudi',
    meta_ad_account_id: 'act_1302928354818236',
    meta_pages: [
      { page_id: '462647150276098', page_name: 'Advanced Gloskin Thoothukudi' },
      { page_id: '501151089754880', page_name: 'Advanced GroHair Thoothukudi' },
    ],
  },
  {
    // Two FB pages share the same ad account in Thrissur
    clientName: 'Advanced GroHair & GloSkin Thrissur',
    meta_ad_account_id: 'act_1291692652323407',
    meta_pages: [
      { page_id: '282590644932674', page_name: 'Advanced GloSkin Thrissur' },
      { page_id: '284224394770691', page_name: 'Advanced GroHair Thrissur' },
    ],
  },
  {
    // Tirupur has two pages but no ad account yet
    clientName: 'Advanced GroHair & GloSkin Tirupur',
    meta_pages: [
      { page_id: '180311331831628', page_name: 'Advanced GloSkin Tirupur' },
      { page_id: '172290759305534', page_name: 'Advanced GroHair Tirupur' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Karaikal',
    meta_ad_account_id: 'act_2206355606869460',
    meta_pages: [
      { page_id: '1160434143813673', page_name: 'Advanced GroHair & GloSkin - Karaikal' },
    ],
  },
  {
    clientName: 'Advanced Grohair & Gloskin Trichy Cantonment',
    meta_ad_account_id: 'act_1034742498800360',
    meta_pages: [
      { page_id: '346326028570941', page_name: 'Advanced Grohair & Gloskin - Trichy Cantonment' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Dharmapuri',
    meta_ad_account_id: 'act_967896905356867',
    meta_pages: [
      { page_id: '723158910877351', page_name: 'Advanced GroHair & GloSkin Dharmapuri' },
    ],
  },
  {
    clientName: 'Advanced Grohair & Gloskin Ramanathapuram',
    meta_ad_account_id: 'act_1325544962209648',
    meta_pages: [
      { page_id: '876263568900682', page_name: 'Advanced Grohair & Gloskin Ramanathapuram' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Tenkasi',
    meta_ad_account_id: 'act_1170135608078953',
    meta_pages: [
      { page_id: '950946911427936', page_name: 'Advanced GroHair & GloSkin Tenkasi' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Neyveli',
    meta_ad_account_id: 'act_863781803176205',
    meta_pages: [
      { page_id: '911934648678678', page_name: 'Advanced GroHair and GloSkin Clinic Neyveli' },
    ],
  },
  {
    clientName: 'Advanced GroHair & GloSkin Kanchipuram',
    meta_ad_account_id: 'act_470559796046378',
    meta_pages: [
      { page_id: '318404981360134', page_name: 'Advanced GroHair and GloSkin Kanchipuram' },
    ],
  },
  {
    // Avinashi Road — no ad account yet
    clientName: 'Advanced GroHair Avinashi Road',
    meta_pages: [
      { page_id: '235235633014349', page_name: 'Advanced GroHair Avinashi Road' },
    ],
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  let created = 0;
  let updated = 0;

  for (const data of CLIENTS) {
    const { clientName, meta_ad_account_id, meta_pages } = data;

    const setPayload = {
      meta_enabled: true,
      meta_pages: meta_pages.map((p) => ({
        page_id: p.page_id,
        page_name: p.page_name,
        subscribed: false,
      })),
      status: 'active',
    };

    // Only set meta_ad_account_id when one is provided — omitting it
    // leaves the field absent so the sparse unique index is not violated.
    if (meta_ad_account_id) {
      setPayload.meta_ad_account_id = meta_ad_account_id;
    }

    const result = await Client.updateOne(
      { clientName },
      { $set: setPayload, $setOnInsert: { clientName } },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created++;
      console.log(`  CREATED  ${clientName}`);
    } else if (result.modifiedCount > 0) {
      updated++;
      console.log(`  UPDATED  ${clientName}`);
    } else {
      console.log(`  NO-CHANGE ${clientName}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}, Total: ${CLIENTS.length}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
