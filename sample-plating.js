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

    let yarnPoly0 =    ks.makeYarn("Polyester0");
    let yarnPoly1 =    ks.makeYarn("Polyester1");

    let courses = 150;
    let wales = 50;

    let yarnSet = [yarnPoly0, yarnPoly1];

    ks.comment("plated single jersey");
    for(let j = 0; j < courses; j++) {

        ks.newCourse(yarnSet);
        ks.insert(yarnSet, "k", wales);
    }

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);

    ks.generate(outFileName, "plated single jersey fabric");
}

generateKnit();