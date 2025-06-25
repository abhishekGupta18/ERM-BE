const express = require("express");
const { body, validationResult } = require("express-validator");
const Assignment = require("../models/assignment");
const User = require("../models/user");
const Project = require("../models/project");
const { isManager, auth } = require("../middleware/auth");

const assignmentRouter = express.Router();

// Get all assignments
assignmentRouter.get("/getAllAssignment", auth, async (req, res) => {
  try {
    let query = {};

    // If engineer, only show their assignments
    if (req.user.role === "engineer") {
      query.engineerId = req.user.userId;
    }

    const assignments = await Assignment.find(query)
      .populate("engineerId", "name email skills seniority")
      .populate("projectId", "name status startDate endDate")
      .sort({ startDate: -1 });

    res.json(assignments);
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create assignment
assignmentRouter.post(
  "/createAssignment",
  [
    auth,
    isManager,
    body("engineerId").isMongoId(),
    body("projectId").isMongoId(),
    body("allocationPercentage").isInt({ min: 1, max: 100 }),
    body("startDate").isISO8601(),
    body("endDate").isISO8601(),
    body("role").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        engineerId,
        projectId,
        allocationPercentage,
        startDate,
        endDate,
        role,
      } = req.body;

      // Validate dates
      if (new Date(endDate) <= new Date(startDate)) {
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
      }

      // Check if engineer exists and is actually an engineer
      const engineer = await User.findById(engineerId);
      if (!engineer || engineer.role !== "engineer") {
        return res.status(404).json({ message: "Engineer not found" });
      }

      // Check if project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if engineer has enough capacity during the assignment period
      const overlappingAssignments = await Assignment.find({
        engineerId,
        $or: [
          {
            startDate: { $lte: new Date(endDate) },
            endDate: { $gte: new Date(startDate) },
          },
        ],
      });

      const totalAllocated = overlappingAssignments.reduce(
        (sum, assignment) => {
          return sum + assignment.allocationPercentage;
        },
        0
      );

      if (totalAllocated + allocationPercentage > engineer.maxCapacity) {
        return res.status(400).json({
          message: `Engineer capacity exceeded. Available: ${
            engineer.maxCapacity - totalAllocated
          }%, Requested: ${allocationPercentage}%`,
        });
      }

      // Create assignment
      const assignment = new Assignment({
        engineerId,
        projectId,
        allocationPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        role: role || "Developer",
      });

      await assignment.save();

      const populatedAssignment = await Assignment.findById(assignment._id)
        .populate("engineerId", "name email skills seniority")
        .populate("projectId", "name status startDate endDate");

      res.status(201).json(populatedAssignment);
    } catch (error) {
      console.error("Create assignment error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update assignment
assignmentRouter.put(
  "/updateAssignment/:id",
  [
    auth,
    isManager,
    body("allocationPercentage").optional().isInt({ min: 1, max: 100 }),
    body("startDate").optional().isISO8601(),
    body("endDate").optional().isISO8601(),
    body("role").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const assignmentId = req.params.id;
      const updates = req.body;

      // Get current assignment
      const currentAssignment = await Assignment.findById(assignmentId);
      if (!currentAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Validate dates if provided
      const newStartDate = updates.startDate
        ? new Date(updates.startDate)
        : currentAssignment.startDate;
      const newEndDate = updates.endDate
        ? new Date(updates.endDate)
        : currentAssignment.endDate;

      if (newEndDate <= newStartDate) {
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
      }

      // Check capacity if allocation percentage is being updated
      if (updates.allocationPercentage) {
        const engineer = await User.findById(currentAssignment.engineerId);

        // Get overlapping assignments (excluding current one)
        const overlappingAssignments = await Assignment.find({
          _id: { $ne: assignmentId },
          engineerId: currentAssignment.engineerId,
          $or: [
            {
              startDate: { $lte: newEndDate },
              endDate: { $gte: newStartDate },
            },
          ],
        });

        const totalAllocated = overlappingAssignments.reduce(
          (sum, assignment) => {
            return sum + assignment.allocationPercentage;
          },
          0
        );

        if (
          totalAllocated + updates.allocationPercentage >
          engineer.maxCapacity
        ) {
          return res.status(400).json({
            message: `Engineer capacity exceeded. Available: ${
              engineer.maxCapacity - totalAllocated
            }%, Requested: ${updates.allocationPercentage}%`,
          });
        }
      }

      const assignment = await Assignment.findByIdAndUpdate(
        assignmentId,
        updates,
        { new: true, runValidators: true }
      )
        .populate("engineerId", "name email skills seniority")
        .populate("projectId", "name status startDate endDate");

      res.json(assignment);
    } catch (error) {
      console.error("Update assignment error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete assignment
assignmentRouter.delete(
  "/deleteAssignment/:id",
  auth,
  isManager,
  async (req, res) => {
    try {
      const assignment = await Assignment.findByIdAndDelete(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Assignment deleted successfully" });
    } catch (error) {
      console.error("Delete assignment error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get team utilization analytics
assignmentRouter.get(
  "/analytics/utilization",
  auth,
  isManager,
  async (req, res) => {
    try {
      const currentDate = new Date();

      // Get all engineers
      const engineers = await User.find({ role: "engineer" }).select(
        "-password"
      );

      const utilization = [];

      for (const engineer of engineers) {
        // Get current active assignments
        const activeAssignments = await Assignment.find({
          engineerId: engineer._id,
          startDate: { $lte: currentDate },
          endDate: { $gte: currentDate },
        }).populate("projectId", "name status");

        const totalAllocated = activeAssignments.reduce((sum, assignment) => {
          return sum + assignment.allocationPercentage;
        }, 0);

        const utilizationPercentage =
          (totalAllocated / engineer.maxCapacity) * 100;

        utilization.push({
          engineer: {
            _id: engineer._id,
            name: engineer.name,
            skills: engineer.skills,
            seniority: engineer.seniority,
            maxCapacity: engineer.maxCapacity,
          },
          totalAllocated,
          availableCapacity: engineer.maxCapacity - totalAllocated,
          utilizationPercentage,
          status:
            utilizationPercentage > 100
              ? "overallocated"
              : utilizationPercentage > 80
              ? "high"
              : utilizationPercentage > 50
              ? "medium"
              : "low",
          activeAssignments,
        });
      }

      // Sort by utilization percentage
      utilization.sort(
        (a, b) => b.utilizationPercentage - a.utilizationPercentage
      );

      // Calculate team statistics
      const teamStats = {
        totalEngineers: engineers.length,
        averageUtilization:
          utilization.reduce((sum, u) => sum + u.utilizationPercentage, 0) /
          engineers.length,
        overallocated: utilization.filter((u) => u.status === "overallocated")
          .length,
        highUtilization: utilization.filter((u) => u.status === "high").length,
        underutilized: utilization.filter((u) => u.status === "low").length,
      };

      res.json({
        teamStats,
        engineerUtilization: utilization,
      });
    } catch (error) {
      console.error("Get utilization analytics error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get timeline data for calendar view
assignmentRouter.get("/timeline", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};

    if (startDate && endDate) {
      query.$or = [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
        },
      ];
    }

    // If engineer, only show their assignments
    if (req.user.role === "engineer") {
      query.engineerId = req.user.userId;
    }

    const assignments = await Assignment.find(query)
      .populate("engineerId", "name email skills seniority")
      .populate("projectId", "name status description")
      .sort({ startDate: 1 });

    // Format for calendar display
    const timelineData = assignments.map((assignment) => ({
      id: assignment._id,
      title: `${assignment.engineerId.name} - ${assignment.projectId.name}`,
      start: assignment.startDate,
      end: assignment.endDate,
      engineer: assignment.engineerId,
      project: assignment.projectId,
      allocation: assignment.allocationPercentage,
      role: assignment.role,
      color: getColorByAllocation(assignment.allocationPercentage),
    }));

    res.json(timelineData);
  } catch (error) {
    console.error("Get timeline error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Helper function to get color based on allocation
function getColorByAllocation(allocation) {
  if (allocation <= 25) return "#10B981"; // Green
  if (allocation <= 50) return "#F59E0B"; // Yellow
  if (allocation <= 75) return "#EF4444"; // Red
  return "#7C3AED"; // Purple
}


// Get a single assignment by ID
assignmentRouter.get("/getAssignment/:id", auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("engineerId", "name email skills seniority")
      .populate("projectId", "name status startDate endDate");
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Get assignment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = assignmentRouter;
