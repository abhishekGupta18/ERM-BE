const jwt = require("jsonwebtoken");
require("dotenv").config();
const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

const isManager = (req, res, next) => {
  if (req.user.role !== "manager") {
    return res
      .status(403)
      .json({ message: "Access denied. Manager role required." });
  }
  next();
};

module.exports = auth;
module.exports.isManager = isManager;
