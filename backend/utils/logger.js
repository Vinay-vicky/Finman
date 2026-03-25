const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, ...meta }) => {
      const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaText}`;
    })
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
