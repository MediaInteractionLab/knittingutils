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

    let yarnCotton0 =    ks.makeYarn("Cotton0");
    let yarnCotton1 =    ks.makeYarn("Cotton1");

    ks.comment("basic interlock");
    for(let j = 0; j < 40; j++) {

        ks.newCourse(yarnCotton0);
        ks.insert(yarnCotton0, "kK", 50);

        ks.newCourse(yarnCotton1);
        ks.insert(yarnCotton1, "Kk", 50);
    }

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnCotton0, 3);
    ks.mapYarn(yarnCotton1, 4);

    ks.generate(outFileName, "interlock fabric");
}

generateKnit();