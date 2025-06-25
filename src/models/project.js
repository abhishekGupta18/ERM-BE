const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    requiredSkills: [
      {
        type: String, // No enum here, allow any skill
        trim: true,
      },
    ],
    teamSize: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Planning", "Active", "Completed"],
      default: "Planning",
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Check that endDate is after startDate
projectSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error("End date must be after start date"));
  }
  next();
});

const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
module.exports = Project;
