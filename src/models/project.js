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
        type: String,
        enum: [
          "React",
          "Node.js",
          "Python",
          "Java",
          "TypeScript",
          "MongoDB",
          "PostgreSQL",
          "AWS",
          "Docker",
          "Kubernetes",
        ],
      },
    ],
    teamSize: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["planning", "active", "completed"],
      default: "planning",
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

projectSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("End date must be after start date"));
  }
  next();
});

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
