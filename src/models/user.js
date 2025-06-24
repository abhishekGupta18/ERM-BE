const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["engineer", "manager"],
      required: true,
    },
    // Engineer specific fields
    skills: [
      {
        type: String, // No enum here, allow any skill
        trim: true,
      },
    ],
    seniority: {
      type: String,
      enum: ["junior", "mid", "senior"],
      required: function () {
        return this.role === "engineer";
      },
    },
    maxCapacity: {
      type: Number,
      default: function () {
        return this.role === "engineer" ? 100 : 0;
      },
    },
    department: {
      type: String,
      default: "Engineering",
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
