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

let wales = 40;
let courses = 76;

function generateKnit(){

    const kp = require("./knitwrap/knitpattern.js");
    let knitPattern = new kp.KnitPattern();

    let buttonCourses = 16;
    let buttonWales = 14;
    let buttonSafetyCourses = 2;
    let buttonSafetyWales = 2;

    let connectorCourses = 2;

    let madeiraCourses = buttonCourses - buttonSafetyCourses;
    let madeiraWales = buttonWales - buttonSafetyWales * 2;

    let marginCourses = Math.round((courses - buttonCourses) / 2);
    let marginWales = Math.floor((wales - buttonWales) / 2);

    if(connectorCourses % 2) {
        console.warn("connector course count is odd, will be corrected from " + connectorCourses + " to " + (connectorCourses + 1));
        connectorCourses++;
    }

    if(marginCourses % 2) {
        console.warn("margin is odd, will be corrected from " + marginCourses + " to " + (marginCourses + 1));
        marginCourses++;
    }

    if(madeiraCourses <= 0 || madeiraWales <= 0) {
        console.error("ERROR: no conductive field remaining -- margin too large? button area too small?");
        return;
    }

    if(madeiraCourses < connectorCourses * 2) {
        console.error("ERROR: madeira courses must be able to support at least two connectors.");
        return;
    }

    let yarnCotton0 =    kp.makeYarn("Cotton0");
    let yarnCotton1 =    kp.makeYarn("Cotton1");
    let yarnPE =         kp.makeYarn("PE");
    let yarnMadeira0 =   kp.makeYarn("Madeira0");
    let yarnMadeira1 =   kp.makeYarn("Madeira1");

    let carrierMapping = {
        "Cotton0":  3,
        "Cotton1":  4,
        "PE":       6,
        "Madeira0": 2,
        "Madeira1": 7
    };

    //lower margin
    knitPattern.comment("lower margin");
    for(let j = 0; j < marginCourses; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", wales);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", wales);
    }

    //lower safety area
    knitPattern.comment("lower safety area");
    for(let j = 0; j < buttonSafetyCourses; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", marginWales);
        knitPattern.insert(yarnCotton0, "k", buttonWales);
        knitPattern.insert(yarnCotton0, "kK", marginWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "tT", buttonWales, j % 2);
        
        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);
        knitPattern.insert(yarnCotton1, "K", buttonWales);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "Tt", buttonWales, j % 2);
    }

    //lower/front connector
    knitPattern.comment("lower/front connector");
    for(let j = 0; j < connectorCourses; j++) {

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "tT", buttonWales, j % 2);

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "---t", marginWales + buttonWales - buttonSafetyWales, ( j % 2 ) * 2);
        knitPattern.insert(yarnCotton0, "k", buttonSafetyWales);
        knitPattern.insert(yarnCotton0, "kK", marginWales);

        knitPattern.newCourse(yarnMadeira0);
        knitPattern.insert(yarnMadeira0, "k", marginWales + buttonWales - buttonSafetyWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "Tt", buttonWales, j % 2);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "K", marginWales + buttonWales);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);
    }

    //button area
    knitPattern.comment("button ara");
    for(let j = 0; j < madeiraCourses - connectorCourses * 2; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", marginWales);
        knitPattern.insert(yarnCotton0, "k", buttonSafetyWales);
        knitPattern.insert(yarnCotton0, "t-", madeiraWales);
        knitPattern.insert(yarnCotton0, "k", buttonSafetyWales);
        knitPattern.insert(yarnCotton0, "kK", marginWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "tT", buttonWales, j % 2);

        knitPattern.newCourse(yarnMadeira0, marginWales + buttonSafetyWales);
        knitPattern.insert(yarnMadeira0, "k", madeiraWales);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);
        knitPattern.insert(yarnCotton1, "K", buttonSafetyWales);
        knitPattern.insert(yarnCotton1, "T_", madeiraWales);
        knitPattern.insert(yarnCotton1, "K", buttonSafetyWales);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "Tt", buttonWales, j % 2);

        knitPattern.newCourse(yarnMadeira1, marginWales + buttonSafetyWales);
        knitPattern.insert(yarnMadeira1, "K", madeiraWales);
    }

    //upper/back connector
    knitPattern.comment("upper/back connector");
    for(let j = 0; j < connectorCourses; j++) {

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "tT", buttonWales, j % 2);

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "k", marginWales + buttonWales);
        knitPattern.insert(yarnCotton0, "kK", marginWales);

        knitPattern.newCourse(yarnMadeira1);
        knitPattern.insert(yarnMadeira1, "K", marginWales + buttonWales - buttonSafetyWales);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "Tt", buttonWales, j % 2);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "___T", marginWales + buttonWales - buttonSafetyWales, ( j % 2 ) * 2);
        knitPattern.insert(yarnCotton1, "K", buttonSafetyWales);
        knitPattern.insert(yarnCotton1, "Kk", marginWales);
    }

    //upper safety area
    knitPattern.comment("upper safety area");
    for (let j = 0; j < buttonSafetyCourses; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", marginWales, j % 2);
        knitPattern.insert(yarnCotton0, "k", buttonWales);
        knitPattern.insert(yarnCotton0, "kK", marginWales, j % 2);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "tT", buttonWales, j % 2);

        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", marginWales, j % 2);
        knitPattern.insert(yarnCotton1, "K", buttonWales);
        knitPattern.insert(yarnCotton1, "Kk", marginWales, j % 2);

        knitPattern.newCourse(yarnPE, marginWales);
        knitPattern.insert(yarnPE, "Tt", buttonWales, j % 2);
    }

    //upper margin
    knitPattern.comment("upper margin");
    for(let j = 0; j < marginCourses; j++) {

        knitPattern.newCourse(yarnCotton0);
        knitPattern.insert(yarnCotton0, "kK", wales);
        knitPattern.newCourse(yarnCotton1);
        knitPattern.insert(yarnCotton1, "Kk", wales);
    }

    knitPattern.printAllMaps();
    knitPattern.printOrder();

    knitPattern.printSequence();

    knitPattern.generate(outFileName, carrierMapping, "capacitive spacer button");
}

generateKnit();