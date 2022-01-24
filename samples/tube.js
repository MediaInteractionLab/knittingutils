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

    ks.comment("basic single jersey tube");

    for(let j = 0; j < courses; j++) {

        //knit there and back for each line:
        // fill one course with front knit operations
        // fill a second course with back knit operations

        //create new cotton course containing front knits
        ks.newCourse(yarnCotton);

        //fill course with operations 'k', meaning front knit
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnCotton, "k", wales);

        //create new cotton course containing back knits
        ks.newCourse(yarnCotton);

        //fill course with operations 'K', meaning back knit
        // fill _wales_ needles with repeat pattern "K"
        ks.insert(yarnCotton, "K", wales);
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
    ks.generate(outFileName, "single jersey tube", undefined, undefined, undefined, undefined, undefined, undefined,
        ku.FRONT | ku.BACK, //castonBeds argument is a bitmask -> add both front and back beds for creation of caston
        true);              //create caston for a tube -> this will not join front and back faces when knitting caston
}

generateKnit();