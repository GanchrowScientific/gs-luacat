/* Copyright © 2017 Ganchrow Scientific, SA all rights reserved */
'use strict';

import * as fs from 'fs';
import * as path from 'path';

import {PrivateEventEmitter} from 'gs-utils/lib/privateEventEmitter';

import {DEFAULT_MODULE_PREFIX} from './defaultModulePrefix';

export const enum CONCAT_STYLE {
  deploy,
  auxiliary,
  entry,
  unit
}

export interface LuaScriptConcatOptions {
  inFile: string;
  concatStyle: CONCAT_STYLE;
  outFile?: string;
  modulePrefix?: (...args) => string;
}

export class LuaScriptConcat<C extends LuaScriptConcatOptions = LuaScriptConcatOptions> extends PrivateEventEmitter {
  private inFile: string;
  private curDir: string;
  private inDir: string;
  private modulePrefix: (...args) => string;
  private originalScript: string;
  private outFile: string;
  private concatStyle: CONCAT_STYLE;
  private includedFiles: Set<string>;
  private needsTestFlag: boolean;

  private currentScript: string[] = [];
  private finishedScript = '';

  constructor(config: C, includedFiles = new Set()) {
    super();
    this.curDir = process.cwd();
    this.inFile = path.resolve(config.inFile);
    this.inDir = path.dirname(this.inFile);
    this.modulePrefix = config.modulePrefix || DEFAULT_MODULE_PREFIX;

    process.chdir(this.inDir);
    this.originalScript = fs.readFileSync(this.inFile, 'utf8');
    this.outFile = config.outFile;
    this.concatStyle = config.concatStyle;
    this.includedFiles = includedFiles;
  }

  public concat() {
    this.currentScript = [];
    if (this.concatStyle === CONCAT_STYLE.deploy || this.concatStyle === CONCAT_STYLE.unit) {
      this.currentScript.push(this.modulePrefix(this.inDir));
    }
    let scriptByLines = this.originalScript.split('\n');
    let includes = scriptByLines.filter(this.isInclude).map(this.getIncluded);
    includes.forEach(include => {
      if (!this.includedFiles.has(include)) {
        this.includedFiles.add(include);
        let luaScriptConcat = new LuaScriptConcat({
          inFile: path.normalize(this.inDir + '/../../' + include),
          concatStyle: CONCAT_STYLE.auxiliary
        }, this.includedFiles);
        this.currentScript.push(luaScriptConcat.concat());
        luaScriptConcat.finish();
      }
    });

    if (this.concatStyle === CONCAT_STYLE.auxiliary) {
      this.currentScript.push(`-- including file ${path.basename(this.inFile)}`);
      this.currentScript.push(`registerModule('${this.moduleName}', function()`);
    } else {
      this.currentScript.push('-- Including target module');
    }

    let ignoring = false;
    let inMainOnlySection = false;
    let inAuxiliaryOnlySection = false;
    scriptByLines.forEach(ifile => {
      if (this.needsTest(ifile)) {
        this.needsTestFlag = true;
      } else if (this.isIgnoreBegin(ifile)) {
        ignoring = true;
      } else if (this.isIgnoreEnd(ifile)) {
        ignoring = false;
      } else if (this.isMainBegin(ifile)) {
        inMainOnlySection = true;
      } else if (this.isMainEnd(ifile)) {
        inMainOnlySection = false;
      } else if (this.isAuxiliaryBegin(ifile)) {
        inAuxiliaryOnlySection = true;
      } else if (this.isAuxiliaryEnd(ifile)) {
        inAuxiliaryOnlySection = false;
      } else {
        // hides aux sections when in a main file and main sections when in an aux file
        let showSection = (!inAuxiliaryOnlySection && !inMainOnlySection) ||
                          (inAuxiliaryOnlySection && this.concatStyle !== CONCAT_STYLE.deploy) ||
                          (inMainOnlySection && this.concatStyle === CONCAT_STYLE.deploy);
        if (ifile && !this.isComment(ifile) && !ignoring && showSection) {
          this.currentScript.push((this.concatStyle === CONCAT_STYLE.auxiliary ? '  ' : '') + ifile);
        }
      }
    });

    if (this.concatStyle === CONCAT_STYLE.auxiliary) {
      this.currentScript.push('\nend)\n');
    }
    return (this.finishedScript = this.currentScript.join('\n'));
  }

  public finish(entryScript = '') {
    this.writeDeployment(entryScript);
    this.writeUnit();
    this.reset();
  }

  private get moduleName() {
    // returns the last 2 path segments with the file name and no extention
    // so, converts the inFile to something that looks like what the require
    // statement looks like
    let segments = this.inFile.split('/');
    let fileName = segments[segments.length - 1];
    let dotIndex = fileName.indexOf('.');
    fileName = fileName.substring(0, dotIndex);
    let moduleDir = segments.slice(-3, -1);
    return `./${moduleDir[0]}/${moduleDir[1]}/${fileName}`;
  }

  private reset() {
    process.chdir(this.curDir);
  }


  private writeUnit() {
    if (this.needsTestFlag && this.concatStyle === CONCAT_STYLE.unit) {
      fs.writeFileSync(this.outFile, this.finishedScript);
    }
  }

  private writeDeployment(entryScript) {
    if (this.concatStyle === CONCAT_STYLE.deploy) {
      fs.writeFileSync(this.outFile, [this.finishedScript, entryScript].join('\n'));
    }
  }

  private needsTest(data) {
    return /^\-\- !test/.test(data);
  }

  private getIncluded(data) {
    return /require\('(.*)'\)/.exec(data)[1] + '.lua';
  }

  private isInclude(data) {
    return /require\('(.*)'\)/.test(data);
  }

  private isComment(data) {
    return /^\-\-/.test(data);
  }

  private isIgnoreBegin(data) {
    return /^\-\- BEGIN IGNORE/.test(data);
  }

  private isIgnoreEnd(data) {
    return /^\-\- END IGNORE/.test(data);
  }

  private isMainBegin(data) {
    return /^\-\- BEGIN MAIN/.test(data);
  }

  private isMainEnd(data) {
    return /^\-\- END MAIN/.test(data);
  }

  private isAuxiliaryBegin(data) {
    return /^\-\- BEGIN AUXILIARY/.test(data);
  }

  private isAuxiliaryEnd(data) {
    return /^\-\- END AUXILIARY/.test(data);
  }
}

export function concatDirectory(inDir: string, outDir: string, type: CONCAT_STYLE, entryScript = '') {
  let files = fs.readdirSync(inDir);
  files.filter(f => /\.lua$/.test(f)).forEach(luaLib => {
    let testScript = new LuaScriptConcat(
      {
        inFile: `${inDir}/${luaLib}`,
        outFile: outDir,
        concatStyle: type
      }
    );
    testScript.concat();
    testScript.finish(entryScript);
  });
}

export function createEntryScript(entryTarget = 'main.lua') {
  let luaScriptConcat = new LuaScriptConcat({
    inFile: `${__dirname}/../${entryTarget}`,
    concatStyle: CONCAT_STYLE.entry
  });
  let script = luaScriptConcat.concat();
  luaScriptConcat.finish();
  return script;
}
