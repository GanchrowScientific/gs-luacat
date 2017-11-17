/* Copyright © 2017 Ganchrow Scientific, SA all rights reserved */
'use strict';

// include this line to fix stack traces
import 'source-map-support/register';

import * as nodeunit from 'nodeunit';

import * as fs from 'fs';

import * as luaCat from '../src/luaCat';
import {ModuleWrapper} from '../src/moduleWrapper';

module.exports = {
  testConcat(test: nodeunit.Test) {
    luaCat.concatDirectory({
      inDir: `${__dirname}/resources`,
      outDir: `${__dirname}/resources-out`,
      moduleWrapper: new ModuleWrapper(
        () => '-- HEADER TEST HEADER TEST TEST HEADER',
        () => '',
        ''
      )
    });
    let out = fs.readFileSync(`${__dirname}/resources-out/a.lua`, 'utf-8').split('\n');
    let expectedOut = [
      '-- HEADER TEST HEADER TEST TEST HEADER',
      '-- including file b.lua',
      '',
      '  local foo = \'hey\'',
      '',
      '-- Including target module',
      'require(\'./b.lua\')',
      'local function test(hey)',
      '  return hey',
      'end'
    ];
    test.deepEqual(out, expectedOut);
    test.done();
  }
};
