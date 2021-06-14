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

    let ksp = require("./knitSequence.js");
    let ks = new ksp.KnitSequence();

    let yarnCotton =    ks.makeYarn("Cotton");

    ks.comment("basic double jersey");
    ks.rack(0.25);
    for(let j = 0; j < 40; j++) {

        ks.newCourse(yarnCotton);
        ks.insert(yarnCotton, "b", 50);
    }

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnCotton, 3);

    ks.generate(outFileName, "double jersey fabric");
}

generateKnit();