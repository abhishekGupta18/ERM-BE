const express = require("express");
const { body, validationResult } = require("express-validator");
const Project = require("../models/project");
const Assignment = require("../models/assignment");
const User = require("../models/user");
const { auth, isManager } = require("../middleware/auth");
const projectRouter = express.Router();

// Get all projects
projectRouter.get("/getAllproject", auth, async (req, res) => {
  try {
    const { status, skills } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (skills) {
      const skillsArray = skills.split(",");
      query.requiredSkills = { $in: skillsArray };
    }

    // If engineer, only show projects they're assigned to
    if (req.user.role === "engineer") {
      const assignments = await Assignment.find({
        engineerId: req.user.userId,
      });
      const projectIds = assignments.map((a) => a.projectId);
      query._id = { $in: projectIds };
    }

    const projects = await Project.find(query)
      .populate("managerId", "name email")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single project
projectRouter.get("/getProject/:id", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "managerId",
      "name email"
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Get project assignments
    const assignments = await Assignment.find({
      projectId: project._id,
    }).populate("engineerId", "name email skills seniority");

    res.json({
      ...project.toObject(),
      assignments,
    });
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create project
projectRouter.post(
  "/createProject",
  [
    auth,
    isManager,
    body("name").isLength({ min: 3 }).trim(),
    body("description").isLength({ min: 2 }),
    body("startDate").isISO8601(),
    body("endDate").isISO8601(),
    body("teamSize").isInt({ min: 1 }),
    // Allow both string and array for requiredSkills
    body("requiredSkills").custom((value) => {
      if (Array.isArray(value) && value.length > 0) {
        return true;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        return true;
      }
      throw new Error("Required skills must be a non-empty array or string");
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let { requiredSkills, ...otherFields } = req.body;

      // Convert string to array if needed
      if (typeof requiredSkills === "string") {
        requiredSkills = requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // Validate dates
      if (new Date(otherFields.endDate) <= new Date(otherFields.startDate)) {
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
      }

      const project = new Project({
        ...otherFields,
        requiredSkills,
        startDate: new Date(otherFields.startDate),
        endDate: new Date(otherFields.endDate),
        status: otherFields.status || "planning",
        managerId: req.user.userId,
      });

      await project.save();

      const populatedProject = await Project.findById(project._id).populate(
        "managerId",
        "name email"
      );

      res.status(201).json(populatedProject);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);
// Update project
projectRouter.put(
  "/updateProject/:id",
  [
    auth,
    isManager,
    body("name").optional().isLength({ min: 3 }).trim(),
    body("description").optional().isLength({ min: 10 }),
    body("startDate").optional().isISO8601(),
    body("endDate").optional().isISO8601(),
    body("teamSize").optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const projectId = req.params.id;
      const updates = req.body;

      // Validate dates if both are provided
      if (updates.startDate && updates.endDate) {
        if (new Date(updates.endDate) <= new Date(updates.startDate)) {
          return res
            .status(400)
            .json({ message: "End date must be after start date" });
        }
      }

      const project = await Project.findByIdAndUpdate(projectId, updates, {
        new: true,
        runValidators: true,
      }).populate("managerId", "name email");

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete project
projectRouter.delete("/delete/:id", auth, isManager, async (req, res) => {
  try {
    const projectId = req.params.id;

    // Check if project has active assignments
    const activeAssignments = await Assignment.countDocuments({ projectId });
    if (activeAssignments > 0) {
      return res.status(400).json({
        message:
          "Cannot delete project with active assignments. Remove assignments first.",
      });
    }

    const project = await Project.findByIdAndDelete(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get project analytics
projectRouter.get("/project/:id/analytics", auth, async (req, res) => {
  try {
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Get all assignments for the project
    const assignments = await Assignment.find({ projectId }).populate(
      "engineerId",
      "name skills seniority"
    );

    // Calculate analytics
    const totalEngineers = assignments.length;
    const totalAllocation = assignments.reduce(
      (sum, a) => sum + a.allocationPercentage,
      0
    );
    const averageAllocation =
      totalEngineers > 0 ? totalAllocation / totalEngineers : 0;

    // Skill distribution
    const skillDistribution = {};
    assignments.forEach((assignment) => {
      assignment.engineerId.skills.forEach((skill) => {
        skillDistribution[skill] = (skillDistribution[skill] || 0) + 1;
      });
    });

    // Seniority distribution
    const seniorityDistribution = {};
    assignments.forEach((assignment) => {
      const seniority = assignment.engineerId.seniority;
      seniorityDistribution[seniority] =
        (seniorityDistribution[seniority] || 0) + 1;
    });

    res.json({
      project,
      analytics: {
        totalEngineers,
        totalAllocation,
        averageAllocation,
        skillDistribution,
        seniorityDistribution,
        requiredTeamSize: project.teamSize,
        teamSizeFulfillment: (totalEngineers / project.teamSize) * 100,
      },
    });
  } catch (error) {
    console.error("Get project analytics error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = projectRouter;
