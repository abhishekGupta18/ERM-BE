const express = require("express");
const User = require("../models/user");
const Assignment = require("../models/assignment");

const { isManager, auth } = require("../middleware/auth");

const engineerRouter = express.Router();

// Get all engineers
engineerRouter.get("/getAllEngineers", auth, async (req, res) => {
  try {
    const { skills, seniority } = req.query;
    let query = { role: "engineer" };

    if (skills) {
      const skillsArray = skills.split(",");
      query.skills = { $in: skillsArray };
    }

    if (seniority) {
      query.seniority = seniority;
    }

    const engineers = await User.find(query).select("-password");
    res.json(engineers);
  } catch (error) {
    console.error("Get engineers error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

engineerRouter.get("/engineer/:id/capacity", auth, async (req, res) => {
  try {
    const engineerId = req.params.id;

    // Get engineer
    const engineer = await User.findById(engineerId).select("-password");
    if (!engineer || engineer.role !== "engineer") {
      return res.status(404).json({ message: "Engineer not found" });
    }

    const currentDate = new Date();

    const activeAssignments = await Assignment.find({
      engineerId,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    }).populate("projectId", "name status");

    const totalAllocated = activeAssignments.reduce((sum, assignment) => {
      return sum + assignment.allocationPercentage;
    }, 0);

    const availableCapacity = engineer.maxCapacity - totalAllocated;

    res.json({
      engineer,
      maxCapacity: engineer.maxCapacity,
      totalAllocated,
      availableCapacity,
      utilizationPercentage: (totalAllocated / engineer.maxCapacity) * 100,
      activeAssignments,
    });
  } catch (error) {
    console.error("Get capacity error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

engineerRouter.get("/:id/timeline", auth, async (req, res) => {
  try {
    const engineerId = req.params.id;

    const engineer = await User.findById(engineerId).select("-password");
    if (!engineer || engineer.role !== "engineer") {
      return res.status(404).json({ message: "Engineer not found" });
    }

    const assignments = await Assignment.find({ engineerId })
      .populate("projectId", "name status description")
      .sort({ startDate: 1 });

    res.json({
      engineer,
      assignments,
    });
  } catch (error) {
    console.error("Get timeline error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

engineerRouter.put("/engineerProfile/:id", auth, async (req, res) => {
  try {
    const engineerId = req.params.id;
    const { name, skills, seniority, maxCapacity } = req.body;

    // Check if user can update this engineer
    if (req.user.role !== "manager" && req.user.userId !== engineerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (skills) updateData.skills = skills;
    if (seniority) updateData.seniority = seniority;
    if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity;

    const engineer = await User.findByIdAndUpdate(engineerId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!engineer) {
      return res.status(404).json({ message: "Engineer not found" });
    }

    res.json(engineer);
  } catch (error) {
    console.error("Update engineer error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

engineerRouter.post(
  "/getSuitableEngineer",
  auth,
  isManager,
  async (req, res) => {
    try {
      const { requiredSkills, startDate, endDate, requiredCapacity } = req.body;

      // Find engineers with matching skills
      let engineers = await User.find({
        role: "engineer",
        skills: { $in: requiredSkills },
      }).select("-password");

      // Check availability for each engineer
      const suitableEngineers = [];

      for (const engineer of engineers) {
        // Get overlapping assignments
        const overlappingAssignments = await Assignment.find({
          engineerId: engineer._id,
          $or: [
            {
              startDate: { $lte: new Date(endDate) },
              endDate: { $gte: new Date(startDate) },
            },
          ],
        });

        // Calculate available capacity during the project period
        const allocatedCapacity = overlappingAssignments.reduce(
          (sum, assignment) => {
            return sum + assignment.allocationPercentage;
          },
          0
        );

        const availableCapacity = engineer.maxCapacity - allocatedCapacity;

        if (availableCapacity >= requiredCapacity) {
          suitableEngineers.push({
            ...engineer.toObject(),
            availableCapacity,
            skillMatch: requiredSkills.filter((skill) =>
              engineer.skills.includes(skill)
            ),
          });
        }
      }

      // Sort by available capacity and skill match
      suitableEngineers.sort((a, b) => {
        const skillMatchDiff = b.skillMatch.length - a.skillMatch.length;
        if (skillMatchDiff !== 0) return skillMatchDiff;
        return b.availableCapacity - a.availableCapacity;
      });

      res.json(suitableEngineers);
    } catch (error) {
      console.error("Get suitable engineers error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = engineerRouter;
