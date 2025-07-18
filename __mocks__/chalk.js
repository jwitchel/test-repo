// Mock for chalk to avoid ES module issues in tests
const chalk = {
  blue: (str) => str,
  green: (str) => str,
  red: (str) => str,
  yellow: (str) => str,
  gray: (str) => str,
  bold: (str) => str,
  bgRed: {
    white: (str) => str
  },
  bgGreen: {
    white: (str) => str
  },
  bgYellow: {
    black: (str) => str
  }
};

// Support chaining
Object.keys(chalk).forEach(key => {
  if (typeof chalk[key] === 'function') {
    Object.assign(chalk[key], chalk);
  }
});

module.exports = chalk;
module.exports.default = chalk;