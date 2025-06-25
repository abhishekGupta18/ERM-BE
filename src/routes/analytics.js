const express = require("express");
const Assignment = require("../models/assignment");
const User = require("../models/user");
const Project = require("../models/project");
const { auth, isManager } = require("../middleware/auth");

const analyticsRouter = express.Router();

// Get utilization analytics
analyticsRouter.get("/analytics/utilization", auth, isManager, async (req, res) => {
  try {
    const engineers = await User.find({ role: "engineer" }).select("-password");
    const currentDate = new Date();

    const utilizationData = [];

    for (const engineer of engineers) {
      const activeAssignments = await Assignment.find({
        engineerId: engineer._id,
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
      }).populate("projectId", "name status");

      const totalAllocated = activeAssignments.reduce((sum, assignment) => {
        return sum + assignment.allocationPercentage;
      }, 0);

      const utilizationPercentage = (totalAllocated / engineer.maxCapacity) * 100;

      utilizationData.push({
        engineerId: engineer._id,
        engineerName: engineer.name,
        currentAllocation: totalAllocated,
        maxCapacity: engineer.maxCapacity,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        assignments: activeAssignments,
      });
    }

    res.json(utilizationData);
  } catch (error) {
    console.error("Utilization analytics error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get project analytics
analyticsRouter.get("/analytics/projects", auth, isManager, async (req, res) => {
  try {
    const projects = await Project.find().populate("managerId", "name email");
    
    const projectAnalytics = [];

    for (const project of projects) {
      const assignments = await Assignment.find({ projectId: project._id });
      const assignedEngineers = assignments.length;
      
      // Calculate skill coverage (simplified - could be more sophisticated)
      const requiredSkills = project.requiredSkills || [];
      const assignedSkills = new Set();
      
      for (const assignment of assignments) {
        const engineer = await User.findById(assignment.engineerId);
        if (engineer && engineer.skills) {
          engineer.skills.forEach(skill => assignedSkills.add(skill));
        }
      }
      
      const skillCoverage = requiredSkills.length > 0 
        ? (assignedSkills.size / requiredSkills.length) * 100 
        : 0;

      // Calculate timeline progress
      const now = new Date();
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      const totalDuration = endDate - startDate;
      const elapsed = now - startDate;
      const timelineProgress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);

      projectAnalytics.push({
        projectId: project._id,
        projectName: project.name,
        teamSize: project.teamSize,
        assignedEngineers,
        skillCoverage: Math.round(skillCoverage * 100) / 100,
        timelineProgress: Math.round(timelineProgress * 100) / 100,
      });
    }

    res.json(projectAnalytics);
  } catch (error) {
    console.error("Project analytics error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get timeline data
analyticsRouter.get("/analytics/timeline", auth, async (req, res) => {
  try {
    let query = {};
    
    // If engineer, only show their assignments
    if (req.user.role === "engineer") {
      query.engineerId = req.user.userId;
    }

    const assignments = await Assignment.find(query)
      .populate("engineerId", "name email")
      .populate("projectId", "name status")
      .sort({ startDate: 1 });

    const timelineEvents = assignments.map((assignment, index) => {
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
      const color = colors[index % colors.length];

      return {
        id: assignment._id,
        title: `${assignment.engineerId.name} - ${assignment.projectId.name}`,
        start: assignment.startDate,
        end: assignment.endDate,
        engineerName: assignment.engineerId.name,
        projectName: assignment.projectId.name,
        allocationPercentage: assignment.allocationPercentage,
        color,
      };
    });

    res.json(timelineEvents);
  } catch (error) {
    console.error("Timeline analytics error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = analyticsRouter; 