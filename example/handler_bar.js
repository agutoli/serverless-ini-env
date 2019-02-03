'use strict';

module.exports.bar = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `This lambda is: ${process.env.NAME}`
    }),
  };
};
