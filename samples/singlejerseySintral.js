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

    let ku = require("../knittingutils.js");
    let ks = new ku.KnitSequence();

    //create yarn descriptor
    let yarnCotton =    ks.makeYarn("Cotton");

    let courses = 40;
    let wales = 50;

    ks.comment("basic single jersey");

    for(let j = 0; j < courses; j++) {

        //create new cotton course
        ks.newCourse(yarnCotton);

        //fill course with operations 'k', meaning front knit
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnCotton, "k", wales);
    }

    //shift entire pattern one needle to the right, otherwise castOff 
    // would need to access negative needle indices, when done from
    // right-to-left
    ks.shift(50);

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarn to carrier #3
    ks.mapYarn(yarnCotton, 3);

    //create knitout and write file
    ks.generate(outFileName, "single jersey fabric", "Keep", undefined, true, false, ku.SINTRAL);
}

generateKnit();