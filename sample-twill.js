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

    let yarnCotton =    kp.makeYarn("Polyester");

    let courses = 150;
    let wales = 50;

    knitPattern.comment("basic twill");
    for(let j = 0; j < courses; j++) {

        knitPattern.newCourse(yarnCotton);
        knitPattern.insert(yarnCotton, "-k", wales, j % 2);
    }

    knitPattern.printAllMaps();
    knitPattern.printOrder();

    knitPattern.printSequence();

    let carrierMapping = {
        "Polyester":  4
    };

    knitPattern.generate(outFileName, carrierMapping, "twill fabric");
}

generateKnit();