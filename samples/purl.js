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

    ks.comment("basic purl");

    for(let j = 0; j < courses; j++) {

        if(j % 2) {
            //create new cotton course
            ks.newCourse(yarnCotton);
            //fill course with operations 'K', meaning back knit
            // fill _wales_ needles with repeat pattern "K"
            ks.insert(yarnCotton, "K", wales);
            
            //perform transfer operations 'X' (back to front) for
            // _wales_ needles 
            ks.transfer("X", wales);
        } else {
            //create new cotton course
            ks.newCourse(yarnCotton);
            //fill course with operations 'k', meaning front knit
            // fill _wales_ needles with repeat pattern "k"
            ks.insert(yarnCotton, "k", wales);

            //perform transfer operations 'x' (front to back) for
            // _wales_ needles 
            ks.transfer("x", wales);
        }
    }

    //shift entire pattern one needle to the right, otherwise castOff 
    // would need to access negative needle indices, when done from
    // right-to-left
    ks.shift(1);

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarn to carrier #3
    ks.mapYarn(yarnCotton, 3);

    //create knitout and write file
    ks.generate(outFileName, "purl fabric");
}

generateKnit();