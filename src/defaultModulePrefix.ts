/* Copyright © 2017 Ganchrow Scientific, SA all rights reserved */
'use strict';

export const DEFAULT_MODULE_PREFIX = (basePath) => {
  return `
-- Module Prefix
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
-- End Module Prefix
`;
};
