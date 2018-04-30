/* Copyright © 2017-2018 Ganchrow Scientific, SA all rights reserved */
'use strict';

// include this line to fix stack traces
import 'source-map-support/register';

import * as fs from 'fs';

import 'jasmine';

import {testWrapper, JasmineExpectation} from 'gs-utils/lib/jasmineTestWrapper';

import * as luaCat from '../src/luaCat';
import {ModuleWrapper} from '../src/moduleWrapper';

const MODULE = {
  testConcat(test: JasmineExpectation) {
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
      `require(\'${__dirname}/resources/b.lua\')`,
      'local function test(hey)',
      '  return hey',
      'end'
    ];
    test.deepEqual(out, expectedOut);
    test.done();
  }
};

testWrapper.run(MODULE, expect, 'Concat Integration Test');
