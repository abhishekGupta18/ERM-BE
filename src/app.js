require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const standardizeResponse = require("./middleware/response");
const authRouter = require("./routes/auth");
const engineerRouter = require("./routes/engineers");
const projectRouter = require("./routes/project");
const assignmentRouter = require("./routes/assignment");
const analyticsRouter = require("./routes/analytics");

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173", // Vite preview port
      "http://localhost:8080"  // Alternative dev port
    ];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["set-cookie"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(standardizeResponse);

app.use("/", authRouter);
app.use("/", engineerRouter);
app.use("/", projectRouter);
app.use("/", assignmentRouter);
app.use("/", analyticsRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: "ERM Backend is Running!",
      timestamp: new Date().toISOString(),
      status: "healthy",
      environment: process.env.NODE_ENV || "development",
    }
  });
});

connectDB()
  .then(() => {
    console.log("DB connection established..");
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`App is running on port ${port}`);
    });
  })
  .catch((e) => {
    console.log("DB connection failed: " + e.message);
  });
