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
    let yarnPoly0 =    ks.makeYarn("Polyester0");
    let yarnPoly1 =    ks.makeYarn("Polyester1");

    let courses = 150;
    let wales = 50;

    //create yarn descriptor set for use during plating
    let yarnSet = [yarnPoly0, yarnPoly1];

    ks.comment("plated single jersey");
    for(let j = 0; j < courses; j++) {

        //create new course using plating set
        ks.newCourse(yarnSet);
        //fill course with operation 'k' for front knit ('k') using the yarn set
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnSet, "k", wales);
    }

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarns to carriers
    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);

    //create knitout and write file
    ks.generate(outFileName, "plated single jersey fabric");
}

generateKnit();