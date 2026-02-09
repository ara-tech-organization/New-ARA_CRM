import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Lead from '../models/Lead.js';
import Client from '../models/Client.js';
import { DEFAULT_PERMISSIONS } from '../middleware/permissions.js';

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGODB_URI);

const seedDatabase = async () => {
  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany();
    await Lead.deleteMany();
    await Client.deleteMany();

    // Create Superadmin user
    console.log('Creating superadmin user...');
    const superadmin = await User.create({
      name: 'Super Admin',
      email: 'superadmin@crm-ara.com',
      password: 'password123',
      role: 'superadmin',
      permissions: DEFAULT_PERMISSIONS.superadmin,
      phone: '+1234567890',
      department: 'Management',
      isActive: true,
    });

    console.log(`Created superadmin: ${superadmin.email} (${superadmin.userID})`);

    // Create Admin user
    console.log('Creating admin user...');
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@crm-ara.com',
      password: 'password123',
      role: 'admin',
      permissions: DEFAULT_PERMISSIONS.admin,
      phone: '+1234567891',
      department: 'Sales',
      isActive: true,
    });

    console.log(`Created admin: ${admin.email} (${admin.userID})`);

    // Create Staff users
    console.log('Creating staff users...');
    const staff1 = await User.create({
      name: 'Staff Member 1',
      email: 'staff1@crm-ara.com',
      password: 'password123',
      role: 'staff',
      permissions: DEFAULT_PERMISSIONS.staff,
      phone: '+1234567892',
      department: 'Sales',
      isActive: true,
    });

    const staff2 = await User.create({
      name: 'Staff Member 2',
      email: 'staff2@crm-ara.com',
      password: 'password123',
      role: 'staff',
      permissions: DEFAULT_PERMISSIONS.staff,
      phone: '+1234567893',
      department: 'Marketing',
      isActive: true,
    });

    console.log(`Created staff: ${staff1.email} (${staff1.userID})`);
    console.log(`Created staff: ${staff2.email} (${staff2.userID})`);

    // Create sample leads
    console.log('Creating sample leads...');
    const leads = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567894',
        company: 'ABC Corp',
        status: 'new',
        source: 'website',
        value: 5000,
        assignedTo: staff1._id,
        createdBy: admin._id,
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+1234567895',
        company: 'XYZ Inc',
        status: 'contacted',
        source: 'referral',
        value: 10000,
        assignedTo: staff2._id,
        createdBy: admin._id,
      },
      {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        phone: '+1234567896',
        company: 'Tech Solutions',
        status: 'qualified',
        source: 'social',
        value: 7500,
        assignedTo: staff1._id,
        createdBy: admin._id,
      },
      {
        name: 'Alice Brown',
        email: 'alice.brown@example.com',
        phone: '+1234567897',
        company: 'Digital Agency',
        status: 'proposal',
        source: 'meta',
        value: 12000,
        metaForm: 1,
        metaCPL: 50,
        assignedTo: staff2._id,
        createdBy: admin._id,
      },
      {
        name: 'Charlie Wilson',
        email: 'charlie.wilson@example.com',
        phone: '+1234567898',
        company: 'Marketing Pro',
        status: 'negotiation',
        source: 'google',
        value: 15000,
        googleCall: 1,
        googleCPL: 75,
        assignedTo: staff1._id,
        createdBy: admin._id,
      },
    ];

    const createdLeads = await Lead.insertMany(leads);
    console.log(`Created ${createdLeads.length} sample leads`);

    // Create sample clients
    console.log('Creating sample clients...');
    const clients = [
      {
        name: 'Global Enterprise',
        email: 'contact@global-enterprise.com',
        phone: '+1234567899',
        company: 'Global Enterprise Ltd',
        status: 'active',
        source: 'referral',
        contractValue: 50000,
        billingCycle: 'monthly',
        accountManager: admin._id,
        createdBy: admin._id,
      },
      {
        name: 'StartUp Inc',
        email: 'hello@startup.com',
        phone: '+1234567800',
        company: 'StartUp Inc',
        status: 'active',
        source: 'website',
        contractValue: 25000,
        billingCycle: 'quarterly',
        accountManager: staff1._id,
        createdBy: admin._id,
      },
    ];

    const createdClients = await Client.insertMany(clients);
    console.log(`Created ${createdClients.length} sample clients`);

    console.log('\n========================================');
    console.log('Database seeding completed successfully!');
    console.log('========================================\n');
    console.log('Login Credentials:');
    console.log('------------------');
    console.log('Superadmin:');
    console.log('  Email: superadmin@crm-ara.com');
    console.log('  Password: password123');
    console.log('\nAdmin:');
    console.log('  Email: admin@crm-ara.com');
    console.log('  Password: password123');
    console.log('\nStaff:');
    console.log('  Email: staff1@crm-ara.com');
    console.log('  Password: password123');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
