require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/database");
const User = require("./models/user");
const Project = require("./models/project");
const Assignment = require("./models/assignment");

async function seed() {
  try {
    await connectDB();
    console.log("Connected to DB for seeding");

    // Clear existing data
    await Assignment.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    // Create users
    const manager = new User({
      email: "manager@example.com",
      password: "managerpass",
      name: "Manager One",
      role: "manager",
      department: "Engineering"
    });
    await manager.save();

    const engineer = new User({
      email: "engineer@example.com",
      password: "engineerpass",
      name: "Engineer One",
      role: "engineer",
      skills: ["JavaScript", "Node.js"],
      seniority: "mid",
      maxCapacity: 100,
      department: "Engineering"
    });
    await engineer.save();

    // Create a project
    const project = new Project({
      name: "Project Alpha",
      description: "A sample project for seeding.",
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-12-31"),
      requiredSkills: ["JavaScript", "Node.js"],
      teamSize: 3,
      status: "Active",
      managerId: manager._id
    });
    await project.save();

    // Create an assignment
    const assignment = new Assignment({
      engineerId: engineer._id,
      projectId: project._id,
      allocationPercentage: 50,
      startDate: new Date("2024-06-10"),
      endDate: new Date("2024-09-30"),
      role: "Developer"
    });
    await assignment.save();

    console.log("Database seeded successfully!");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    mongoose.connection.close();
  }
}

seed(); 