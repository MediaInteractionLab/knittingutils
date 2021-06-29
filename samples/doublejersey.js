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

    ks.comment("basic double jersey");

    //rack back bad for front/back knitting
    ks.rack(0.25);

    for(let j = 0; j < courses; j++) {

        //create new cotton course
        ks.newCourse(yarnCotton);

        //fill course with operations 'b' for both (front + back)
        // fill _wales_ needles with repeat pattern "b"
        ks.insert(yarnCotton, "b", wales);
    }

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarn to carrier #3
    ks.mapYarn(yarnCotton, 3);

    //create knitout and write file
    ks.generate(outFileName, "double jersey fabric");
}

generateKnit();