exports.requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Please sign in to continue." });
  next();
};
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.session.role || !roles.includes(req.session.role)) return res.status(403).json({ error: "You are not authorized to perform this action." });
  next();
};
