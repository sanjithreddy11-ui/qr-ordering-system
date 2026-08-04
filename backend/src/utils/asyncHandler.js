// Wraps an async route handler so thrown errors get forwarded to
// Express's error middleware instead of crashing the server.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
