module.exports = function (config) {
  config.set({
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/zuremap'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'lcovonly', file: 'lcov.info' },
        { type: 'text-summary' },
      ],
      check: {
        global: {
          statements: 23,
          branches: 17,
          functions: 20,
          lines: 24,
        },
      },
    },
  });
};
