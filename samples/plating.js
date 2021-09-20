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

    //create new course using only poly0, which is used for automatic
    // cast-on, since it is the first yarn in use.
    ks.newCourse(yarnPoly0);
    //since after cast-on Polyester0 carrier is on the left, while 
    // Polyester1 carrier is still on the right, we have to add one extra
    // course, so both are at the same side of the knit for starting with
    // actual plating: 
    //fill course with operation 'k' for front knit ('k') using the yarn 
    // Polyester0 fill _wales_ needles with repeat pattern "k"
    ks.insert(yarnPoly0, "k", wales);
    
    ks.comment("plated single jersey");
    for(let j = 0; j < courses; j++) {

        //create new course using plating set
        ks.newCourse(yarnSet);
        //fill course with operation 'k' for front knit ('k') using the yarn set
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnSet, "k", wales);
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

    //map yarns to carriers
    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);

    //create knitout and write file
    ks.generate(outFileName, "plated single jersey fabric");
}

generateKnit();