const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
});

module.exports = (err, req, res, next) => {
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl || req.url,
    method: req.method,
    requestId: req.requestId || 'N/A'
  });

  let statusCode = 500;
  let response = {
    error: 'Internal Server Error',
    message: 'Something went wrong on our end'
  };

  if (err.name === 'ValidationError') {
    statusCode = 400;
    response = { error: 'Validation Error', message: err.message, details: err.details || null };
  } else if (err.message === 'Comic not found') {
    statusCode = 404;
    response = { error: 'Comic not found', message: 'The requested comic does not exist' };
  } else if (err.message === 'Invalid comic ID') {
    statusCode = 400;
    response = { error: 'Invalid comic ID', message: 'Comic ID must be a positive integer' };
  } else if (err.isOperational && err.statusCode) {
    statusCode = err.statusCode;
    response = { error: err.message, timestamp: new Date().toISOString() };
  }

  response.requestId = req.requestId || null;
  res.status(statusCode).json(response);
};
