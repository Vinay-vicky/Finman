const AppError = require('../utils/appError');

const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    const data = req[source];
    const parsed = schema.parse(data);

    req[source] = parsed;
    next();
  } catch (err) {
    if (err?.issues?.length) {
      const details = err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      return next(new AppError(400, 'Validation failed.', details));
    }

    return next(err);
  }
};

module.exports = validate;
