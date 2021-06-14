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

    let ku = require("./knittingutils.js");
    let ks = new ku.KnitSequence();

    let yarnPoly0 =    ks.makeYarn("Poly0");
    let yarnPoly1 =    ks.makeYarn("Poly1");
    let yarnNylon =    ks.makeYarn("Nylon");

    let wales = 40;
    let courses = 40;

    ks.comment("spacer button");
    for(let j = 0; j < courses; j++) {

        ks.newCourse(yarnPoly0);
        ks.insert(yarnPoly0, "k", wales);

        ks.newCourse(yarnNylon);
        ks.insert(yarnNylon, "tT", wales);

        ks.newCourse(yarnPoly1);
        ks.insert(yarnPoly1, "K", wales);

        ks.newCourse(yarnNylon);
        ks.insert(yarnNylon, "Tt", wales);
    }

    ks.shift(1);

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);
    ks.mapYarn(yarnNylon, 8, false);

    ks.generate(outFileName, "spacer button");
}

generateKnit();