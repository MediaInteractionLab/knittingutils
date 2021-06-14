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

    let yarnPoly =    ks.makeYarn("Polyester");

    let courses = 150;
    let wales = 50;

    ks.comment("basic twill");
    for(let j = 0; j < courses; j++) {

        ks.newCourse(yarnPoly);
        ks.insert(yarnPoly, "-k", wales, j % 2);
    }

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnPoly, 4);

    ks.generate(outFileName, "twill fabric");
}

generateKnit();