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
    let yarnPoly0 =    ks.makeYarn("Poly0");
    let yarnPoly1 =    ks.makeYarn("Poly1");
    let yarnNylon =    ks.makeYarn("Nylon");

    let wales = 40;
    let courses = 40;

    ks.comment("spacer fabric");
    for(let j = 0; j < courses; j++) {

        //skip first course, we don't want to start with inlay
        if(j) {
            //create new nylon inlay course
            ks.newCourse(yarnNylon);
            //fill course with operations 'tT' for front tuck ('t') and back tuck ('T')
            // fill _wales_ needles with repeat pattern "tT"
            ks.insert(yarnNylon, "tT", wales);
        }

        //create new front polyester course
        ks.newCourse(yarnPoly0);
        //fill course with operation 'k' for front knit
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnPoly0, "k", wales);

        //create new back polyester course
        ks.newCourse(yarnPoly1);
        //fill course with operation 'K' for back knit
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnPoly1, "K", wales);
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

    //map yarns to according carriers
    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);
    //pass 'false' for doBringin to skip clamping field when yarn is first used
    // which would certainly cause problems with the rather stiff filler filament
    // as it is not supposed to be knit, only tucked
    ks.mapYarn(yarnNylon, 8, false);

    //create knitout and write file
    ks.generate(outFileName, "spacer fabric");
}

generateKnit();