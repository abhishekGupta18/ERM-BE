const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    engineerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    allocationPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    role: {
      type: String,
      default: "Developer",
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("Assignment end date must be after start date"));
  }
  next();
});

assignmentSchema.index({ engineerId: 1, startDate: 1, endDate: 1 });
assignmentSchema.index({ projectId: 1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);
module.exports = Assignment;
