Object.defineProperty(globalThis, '__stack', {
  get: function () {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    const err = new Error();
    // eslint-disable-next-line no-caller
    Error.captureStackTrace(err, arguments.callee);
    const stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});

Object.defineProperty(globalThis, '__line', {
  get: function () {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    return __stack[2].getLineNumber();
  }
});
