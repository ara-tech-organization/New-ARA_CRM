import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    userID: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'SMM', 'PMM', 'staff'],
      default: 'SMM',
    },
    permissions: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    profileImage: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate userID before validation
userSchema.pre('validate', async function () {
  if (this.isNew && !this.userID) {
    const count = await mongoose.model('User').countDocuments();
    this.userID = `USR${String(count + 1).padStart(3, '0')}`;
  }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to check if user has permission
userSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission) || this.role === 'superadmin' || this.role === 'admin';
};

// Method to update last login
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = Date.now();
  await this.save({ validateBeforeSave: false });
};

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ userID: 1 });
userSchema.index({ role: 1, isActive: 1 }); // Compound index for common queries

const User = mongoose.model('User', userSchema);

export default User;
