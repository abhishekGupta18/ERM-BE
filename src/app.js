require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRouter = require("./routes/auth");
const engineerRouter = require("./routes/engineers");
const projectRouter = require("./routes/project");
const assignmentRouter = require("./routes/assignment");

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ["http://localhost:5173"];
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

app.use("/", authRouter);
app.use("/", engineerRouter);
app.use("/", projectRouter);
app.use("/", assignmentRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "ERM Backend is Running!",
    timestamp: new Date().toISOString(),
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
  });
});

connectDB()
  .then(() => {
    console.log("DB connection established..");
    app.listen(process.env.PORT, () => {
      console.log(`App is running on port ${process.env.PORT}`);
    });
  })
  .catch((e) => {
    console.log("DB connection failed: " + e.message);
  });
