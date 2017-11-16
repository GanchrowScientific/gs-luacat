/* Copyright © 2017 Ganchrow Scientific, SA all rights reserved */
'use strict';

const DEFAULT_AUXILLARY_CLOSE = '\nend)\n';

const DEFAULT_AUXILLARY_FUNCTION = (moduleName: string) => `registerModule('${moduleName}', function()`;

const DEFAULT_MODULE_PREFIX = (basePath: string) => {
  return `
-- Module Wrapper
-- Copyright © 2017 Ganchrow Scientific, SA all rights reserved
local modules = {}

local function resolvePath(path)
  return path
end

local function registerModule(path, moduleFunction)
  local resolvedPath = resolvePath(path)
  if not modules[resolvedPath] then
    modules[resolvedPath] = moduleFunction()
  end
end

local function require(path)
  return modules[resolvePath(path)]
end
-- End Module Wrapper
`;
};

export class ModuleWrapper {
  constructor(
    private prefix = DEFAULT_MODULE_PREFIX,
    private auxillaryFunction = DEFAULT_AUXILLARY_FUNCTION,
    private auxillaryClose = DEFAULT_AUXILLARY_CLOSE
  ) { /**/ }

  public header(basePath: string) {
    return this.prefix(basePath);
  }

  public close() {
    return this.auxillaryClose;
  }

  public wrapAuxillary(moduleName: string) {
    return this.auxillaryFunction(moduleName);
  }
}

