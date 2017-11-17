#!/usr/bin/env node

let luaCat = require('./lib/luaCat');
let ModuleWrapper = require('./lib/moduleWrapper').ModuleWrapper;

if (process.argv.length < 4) {
  usage();
}

function usage () {
  console.error('usage: luacat <in-dir> <out-dir>');
  process.exit(1);
}

luaCat.concatDirectory({
  inDir: process.argv[2],
  outDir: process.argv[3],
  moduleWrapper: new ModuleWrapper()
});
