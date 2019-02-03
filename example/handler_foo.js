'use strict';

module.exports.foo = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `This lambda is: ${process.env.NAME}`
    }),
  };
};
