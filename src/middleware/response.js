// Middleware to standardize API responses
const standardizeResponse = (req, res, next) => {
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to wrap responses in standard format
  res.json = function(data) {
    // If response already has success property, return as is
    if (data && typeof data === 'object' && 'success' in data) {
      return originalJson.call(this, data);
    }
    
    // Wrap in standard response format
    const standardizedResponse = {
      success: true,
      data: data
    };
    
    return originalJson.call(this, standardizedResponse);
  };
  
  // Override res.status to handle error responses
  const originalStatus = res.status;
  res.status = function(code) {
    if (code >= 400) {
      // For error status codes, override json to include error format
      const originalJson = this.json;
      this.json = function(data) {
        const errorResponse = {
          success: false,
          error: data.message || data.error || 'An error occurred',
          data: null
        };
        return originalJson.call(this, errorResponse);
      };
    }
    return originalStatus.call(this, code);
  };
  
  next();
};

module.exports = standardizeResponse; 