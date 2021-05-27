#!/usr/bin/env node

/*
v2
*/

"use strict";

let outFileName = 'out.k';
if(process.argv[2]) {
    outFileName = process.argv[2];
    let lcfn = outFileName.toLowerCase();
    if(!lcfn.endsWith(".k") && !lcfn.endsWith(".knitout")) {
        outFileName += ".k";
        console.warn("filename must end with '.k' or '.knitout', corrected to " + outFileName);
    }
}

function generateKnit(){

    let kp = require("./knitwrap/knitpattern.js");
    let knitPattern = new kp.KnitPattern();

    let yarnPoly0 =    kp.makeYarn("Poly0");
    let yarnPoly1 =    kp.makeYarn("Poly1");
    let yarnNylon =    kp.makeYarn("Nylon");

    let wales = 10;
    let courses = 10;

    knitPattern.comment("spacer button");
    for(let j = 0; j < courses; j++) {

        knitPattern.newCourse(yarnPoly0);
        knitPattern.insert(yarnPoly0, "k", wales);

        knitPattern.newCourse(yarnNylon);
        knitPattern.insert(yarnNylon, "tT", wales);

        knitPattern.newCourse(yarnPoly1);
        knitPattern.insert(yarnPoly1, "K", wales);

        knitPattern.newCourse(yarnNylon);
        knitPattern.insert(yarnNylon, "Tt", wales);
    }

    //BUG??
    knitPattern.shift(1);

    knitPattern.printAllMaps();
    knitPattern.printOrder();

    knitPattern.printSequence();

    knitPattern.mapYarn(yarnPoly0, 3);
    knitPattern.mapYarn(yarnPoly1, 4);
    knitPattern.mapYarn(yarnNylon, 8);

    knitPattern.generate(outFileName, "spacer button");
}

generateKnit();