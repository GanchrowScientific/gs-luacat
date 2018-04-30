/* Copyright © 2017-2018 Ganchrow Scientific, SA all rights reserved */

'use strict';

import 'jasmine';

import {testWrapper, JasmineExpectation} from 'gs-utils/lib/jasmineTestWrapper';

const MODULE = {
  testOk(test: JasmineExpectation) {
    test.ok(true);
    test.done();
  }
};

testWrapper.run(MODULE, expect, 'index');
