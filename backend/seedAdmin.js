import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete old admin if exists (to replace with new structure)
    const existingAdmin = await User.findOne({ email: 'admin@aracrm.com' });

    if (existingAdmin) {
      console.log('Deleting old admin user to replace with new structure...');
      await User.deleteOne({ email: 'admin@aracrm.com' });
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@aracrm.com',
      password: 'Admin@123',
      phone: '+91 9876543210',
      department: 'Management',
      role: 'superadmin',
      isActive: true,
      permissions: [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'lead:create', 'lead:read', 'lead:update', 'lead:delete',
        'client:create', 'client:read', 'client:update', 'client:delete',
        'fund:create', 'fund:read', 'fund:update', 'fund:delete',
        'entry:create', 'entry:read', 'entry:update', 'entry:delete',
        'vault:read', 'vault:update',
        'report:view', 'report:export',
        'settings:update'
      ],
    });

    console.log('Admin user created successfully!');
    console.log('-------------------------------');
    console.log('Login credentials:');
    console.log('  Email: admin@aracrm.com');
    console.log('  Password: Admin@123');
    console.log('-------------------------------');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    process.exit(1);
  }
};

seedAdmin();
