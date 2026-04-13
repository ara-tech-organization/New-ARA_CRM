import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Client from '../models/Client.js';

// SMM Team 1 members and their clients
const team1 = [
  {
    name: 'Preethi',
    clients: [
      'Advanced Grohair & Gloskin Thanjavur',
      'Advanced Grohair & Gloskin Kanchipuram',
      'Advanced Grohair & Gloskin Namakkal',
      'Advanced Grohair & Gloskin Whitefield',
      'Advanced Grohair & Gloskin Seegehalli',
      'Advanced Grohair & Gloskin RS Puram',
      'Minus - Velacherry',
      'We Do',
      'Elegance',
    ],
  },
  {
    name: 'Kaviya',
    clients: [
      'Advanced Grohair & Gloskin Karaikudi',
      'Advanced Grohair & Gloskin Theni',
      'Advanced Grohair & Gloskin Chidambaram',
      'Advanced Grohair & Gloskin Dindigul',
      'Advanced Grohair & Gloskin Cumbum',
      'Advanced Grohair & Gloskin Cantonment',
      'Dr Edumed Anna Nagar',
      'TML',
      'MMA',
    ],
  },
  {
    name: 'Naseema',
    clients: [
      'Envisol',
      'Advanced Grohair & Gloskin Tenkasi',
      'Advanced Grohair & Gloskin Tiruppur',
      'Advanced Grohair & Gloskin Ramnad',
      'Advanced Grohair & Gloskin Avinashi Road',
      'MSMS',
      'Mahatma School',
    ],
  },
  {
    name: 'Pooja',
    clients: [],
  },
];

// SMM Team 2 members and their clients
const team2 = [
  {
    name: 'Shivasree',
    clients: [
      'Advanced Grohair & Gloskin Kallakurichi',
      'Advanced Grohair & Gloskin Viluppuram',
      'Advanced Grohair & Gloskin Dharmapuri',
      'Advanced Grohair & Gloskin Cuddalore',
      'Advanced Grohair & Gloskin Jayanagar',
      'Advanced Grohair & Gloskin Neyveli',
      'Advanced Grohair & Gloskin Krishnagiri',
      'Nakshathra Farms',
    ],
  },
  {
    name: 'Ramya',
    clients: [
      'Astaderm Clinic',
      'Naturals Thanjavur',
      'Sundex Mahal & Apart',
      'F Taxi',
      'Advanced Grohair & Gloskin Thiruvannamalai',
      'Advanced Grohair & Gloskin Tirumazhisai',
    ],
  },
  {
    name: 'Abarna',
    clients: [
      'Bonitaa Salem',
      'Bonitaa Namakkal',
      'Tenziaa Salem',
      'Amalraj',
      '5K Car Care',
      'Advanced Grohair & Gloskin Thrissur',
      'Advanced Grohair & Gloskin Vellore',
      'Advanced Grohair & Gloskin HRBR',
      'Advanced Grohair & Gloskin Rajajinagar',
    ],
  },
];

const defaultPermissions = [
  'dashboard',
  'daily-entry',
  'daily-lead-data',
  'clients',
  'content-management',
];

async function seed() {
  await connectDB();

  console.log('--- Creating SMM Team Users ---\n');

  // Create Team 1 users
  for (const member of team1) {
    await createUser(member.name, 'SMM Team 1', member.clients);
  }

  // Create Team 2 users
  for (const member of team2) {
    await createUser(member.name, 'SMM Team 2', member.clients);
  }

  console.log('\n--- Assigning Clients to SMEs ---\n');

  // Assign clients to SMEs
  for (const member of team1) {
    await assignClients(member.name, 'SMM Team 1', member.clients);
  }
  for (const member of team2) {
    await assignClients(member.name, 'SMM Team 2', member.clients);
  }

  console.log('\n--- Done! ---');
  process.exit(0);
}

async function createUser(name, team, clients) {
  const email = `${name.toLowerCase()}@aracrm.com`;
  const existing = await User.findOne({ email });

  if (existing) {
    // Update team if not set
    if (!existing.team) {
      existing.team = team;
      await existing.save({ validateBeforeSave: false });
      console.log(`Updated ${name} -> team: ${team}`);
    } else {
      console.log(`User ${name} already exists (${existing.userID}, team: ${existing.team})`);
    }
    return;
  }

  const user = await User.create({
    name,
    email,
    password: 'Ara@12345',
    role: 'SMM',
    team,
    permissions: defaultPermissions,
    isActive: true,
  });

  console.log(`Created: ${user.name} (${user.userID}) - ${team} - password: Ara@12345`);
}

async function assignClients(smeName, team, clientNames) {
  for (const clientName of clientNames) {
    // Try exact match first, then case-insensitive
    let client = await Client.findOne({ clientName });
    if (!client) {
      client = await Client.findOne({ clientName: { $regex: new RegExp(`^${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }

    if (client) {
      client.assignedSME = smeName;
      client.team = team;
      await client.save();
      console.log(`  ${clientName} -> ${smeName} (${team})`);
    } else {
      console.log(`  [NOT FOUND] ${clientName} - will create`);
      await Client.create({
        clientName,
        assignedSME: smeName,
        team,
        status: 'active',
      });
      console.log(`  [CREATED] ${clientName} -> ${smeName} (${team})`);
    }
  }
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
