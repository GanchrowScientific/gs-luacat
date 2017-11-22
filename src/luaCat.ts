/* Copyright © 2017 Ganchrow Scientific, SA all rights reserved */
'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';

import {PrivateEventEmitter} from 'gs-utils/lib/privateEventEmitter';

import {ModuleWrapper} from './moduleWrapper';

export enum CONCAT_STYLE {
  deploy = 1,
  auxiliary,
  entry,
  unit
}

export interface LuaScriptConcatOptions {
  inFile: string;
  concatStyle: CONCAT_STYLE;
  outFile?: string;
  moduleWrapper?: ModuleWrapper;
}

export class LuaScriptConcat<C extends LuaScriptConcatOptions = LuaScriptConcatOptions> extends PrivateEventEmitter {
  private inFile: string;
  private inDir: string;
  private moduleWrapper: ModuleWrapper;
  private originalScript: string;
  private outFile: string;
  private concatStyle: CONCAT_STYLE;
  private includedFiles: Set<string>;

  private currentScript: string[] = [];
  private finishedScript = '';

  constructor(config: C, includedFiles = new Set()) {
    super();
    this.inFile = config.inFile;
    this.inDir = path.dirname(this.inFile);
    this.moduleWrapper = config.moduleWrapper || new ModuleWrapper();
    this.originalScript = fs.readFileSync(this.inFile, 'utf8');
    this.outFile = config.outFile;
    this.concatStyle = config.concatStyle;
    this.includedFiles = includedFiles;
  }

  public concat() {
    this.currentScript = [];
    if (this.concatStyle === CONCAT_STYLE.deploy || this.concatStyle === CONCAT_STYLE.unit) {
      this.currentScript.push(this.moduleWrapper.header(this.inDir));
    }
    let scriptByLines = this.originalScript.split('\n');
    let includes = scriptByLines.filter(this.isInclude).map(this.getIncluded);
    includes.forEach(include => {
      if (!this.includedFiles.has(include)) {
        this.includedFiles.add(include);
        let luaScriptConcat = new LuaScriptConcat({
          inFile: `${this.inDir}/${path.normalize(include)}`,
          concatStyle: CONCAT_STYLE.auxiliary,
          moduleWrapper: this.moduleWrapper
        }, this.includedFiles);
        this.currentScript.push(luaScriptConcat.concat());
        luaScriptConcat.finish();
      }
    });

    if (this.concatStyle === CONCAT_STYLE.auxiliary) {
      this.currentScript.push(`-- including file ${path.basename(this.inFile)}`);
      this.currentScript.push(this.moduleWrapper.wrapAuxillary(this.moduleName));
    } else {
      this.currentScript.push('-- Including target module');
    }

    let ignoring = false;
    let inMainOnlySection = false;
    let inAuxiliaryOnlySection = false;
    scriptByLines.forEach(ifile => {
      if (this.isIgnoreBegin(ifile)) {
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
      this.currentScript.push(this.moduleWrapper.close());
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
    return `${moduleDir[1]}/${fileName}`;
  }

  private reset() { /**/ }

  private writeUnit() {
    if (this.concatStyle === CONCAT_STYLE.unit) {
      fs.writeFileSync(this.outFile, this.finishedScript);
    }
  }

  private writeDeployment(entryScript) {
    if (this.concatStyle === CONCAT_STYLE.deploy) {
      fs.writeFileSync(this.outFile, [this.finishedScript, entryScript].join('\n'));
    }
  }

  private getIncluded(data) {
    let included = /require\('(.*)'\)/.exec(data)[1];
    if (/\.lua$/.test(included)) {
      return included;
    }
    return `${included}.lua`;
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

export function concatDirectory(opts: {
  inDir: string,
  outDir: string,
  type?: CONCAT_STYLE,
  entryScript?: string,
  moduleWrapper?: ModuleWrapper
}) {
  let {inDir, outDir, type, entryScript, moduleWrapper} = opts;
  let files = fs.readdirSync(inDir);
  mkdirp.sync(outDir);
  files.filter(f => /\.lua$/.test(f)).forEach(luaLib => {
    let testScript = new LuaScriptConcat(
      {
        inFile: `${inDir}/${luaLib}`,
        outFile: `${outDir}/${luaLib}`,
        concatStyle: type || CONCAT_STYLE.unit,
        moduleWrapper
      }
    );
    testScript.concat();
    testScript.finish(entryScript);
  });
}

export function createEntryScript(opts: {
  entryTarget: string,
  moduleWrapper?: ModuleWrapper
}) {
  let {entryTarget, moduleWrapper} = opts;
  entryTarget = entryTarget || 'main.lua';
  let luaScriptConcat = new LuaScriptConcat({
    inFile: entryTarget,
    concatStyle: CONCAT_STYLE.entry,
    moduleWrapper
  });
  let script = luaScriptConcat.concat();
  luaScriptConcat.finish();
  return script;
}
