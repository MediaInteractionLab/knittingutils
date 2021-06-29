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
    let yarnPoly =    ks.makeYarn("Polyester");

    let courses = 150;
    let wales = 50;

    ks.comment("basic twill");
    for(let j = 0; j < courses; j++) {

        //create new polyester course
        ks.newCourse(yarnPoly);
        //fill course with operations '-k' for miss ('-') + front knit ('k')
        // fill _wales_ needles with repeat pattern "-k"
        // pass alternating repeat pattern offset for every course; toggle between offset of 0 and 1
        ks.insert(yarnPoly, "-k", wales, j % 2);
    }

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarn to carrier #4
    ks.mapYarn(yarnPoly, 4);

    //create knitout and write file
    ks.generate(outFileName, "twill fabric");
}

generateKnit();