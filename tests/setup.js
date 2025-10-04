// Test setup file

jest.setTimeout(10000);

global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

expect.extend({
  toBeValidComicStructure(received) {
    const pass =
      typeof received === 'object' &&
      typeof received.id === 'number' &&
      typeof received.title === 'string' &&
      typeof received.img === 'string' &&
      typeof received.alt === 'string' &&
      received.id > 0;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid comic structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid comic structure`,
        pass: false,
      };
    }
  },
});
