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

    let yarnCotton0 =    kp.makeYarn("Cotton0");
    let yarnCotton1 =    kp.makeYarn("Cotton1");

    knitPattern.comment("basic interlock");
    for(let j = 0; j < 40; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", 50);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", 50);
    }

    knitPattern.printAllMaps();
    knitPattern.printOrder();

    knitPattern.printSequence();

    knitPattern.mapYarn(yarnCotton0, 3);
    knitPattern.mapYarn(yarnCotton1, 4);

    knitPattern.generate(outFileName, "interlock fabric");
}

generateKnit();