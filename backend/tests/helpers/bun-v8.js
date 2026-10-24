const originalGetBuiltinModule = process.getBuiltinModule;
process.getBuiltinModule = function (id) {
  if (id === 'v8') {
    const v8 = require('v8');
    return {
      ...v8,
      startupSnapshot: {
        isBuildingSnapshot: () => false,
      },
    };
  }
  return typeof originalGetBuiltinModule === 'function' ? originalGetBuiltinModule.call(this, id) : require(id);
};
