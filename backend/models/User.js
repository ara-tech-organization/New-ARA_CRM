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
      // Free-form on purpose — admins create their own role names from
      // the Access Management page. The two role strings the rest of
      // the app special-cases are 'admin' and 'superadmin' (full page
      // access). Everything else is a custom role and gets permissions
      // assigned explicitly.
      trim: true,
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
    team: {
      type: String,
      trim: true,
      default: '',
    },
    // Profile photo stored as a data URL (base64). No CDN setup
    // needed — these are small (resized to ≤256x256 client-side
    // before upload) so a string column is fine. Empty string when
    // the user hasn't uploaded one.
    avatar: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique userID before validation
userSchema.pre('validate', async function () {
  if (this.isNew && !this.userID) {
    // Find the highest existing userID number to avoid duplicates
    const lastUser = await mongoose.model('User').findOne({}, { userID: 1 }).sort({ userID: -1 }).lean();
    let nextNum = 1;
    if (lastUser?.userID) {
      const match = lastUser.userID.match(/USR(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    this.userID = `USR${String(nextNum).padStart(3, '0')}`;
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

// Indexes for better query performance (email and userID already indexed via unique: true)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ team: 1 });

const User = mongoose.model('User', userSchema);

export default User;
