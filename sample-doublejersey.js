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

    let yarnCotton =    kp.makeYarn("Cotton");

    knitPattern.comment("basic double jersey");
    knitPattern.rack(0.25);
    for(let j = 0; j < 40; j++) {

        knitPattern.newCourse(yarnCotton);
        knitPattern.insert(yarnCotton, "b", 50);
    }

    knitPattern.printAllMaps();
    knitPattern.printOrder();

    knitPattern.printSequence();

    let carrierMapping = {
        "Cotton":  3,
    };

    knitPattern.generate(outFileName, carrierMapping, "double jersey fabric");
}

generateKnit();