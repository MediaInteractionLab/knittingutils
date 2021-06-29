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

    //create yarn descriptors
    let yarnCotton0 =    ks.makeYarn("Cotton0");
    let yarnCotton1 =    ks.makeYarn("Cotton1");

    let courses = 40;
    let wales = 50;

    ks.comment("basic interlock");
    for(let j = 0; j < courses; j++) {

        //create new cotton0 course
        ks.newCourse(yarnCotton0);
        //fill course with operations 'k' and 'K' for front knit ('k') + back knit ('K')
        // fill _wales_ needles with repeat pattern "kK"
        ks.insert(yarnCotton0, "kK", wales);

        //create new cotton1 course
        ks.newCourse(yarnCotton1);
        //fill course with operations 'K' and 'k' for back knit ('K') + front knit ('k')
        // fill _wales_ needles with repeat pattern "Kk"
        ks.insert(yarnCotton1, "Kk", wales);
    }

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarns to carriers
    ks.mapYarn(yarnCotton0, 3);
    ks.mapYarn(yarnCotton1, 4);

    //create knitout and write file
    ks.generate(outFileName, "interlock fabric");
}

generateKnit();