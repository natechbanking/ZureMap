module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reporters: ['progress', 'kjhtml'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
      ChromeHeadlessWSL: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox'],
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
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
  });
};
