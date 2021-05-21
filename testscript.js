#!/usr/bin/env node

/*
v2
*/

"use strict";

//TODO: figure out how to use values defined in knitwrap.js
const LEFT = -1;
const RIGHT = 1;

const kw = require('./knitwrap');

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
let left = 1;
let right = left + wales;

kw.createMachine('SWG061N2', 360, 15, 10);
//TODO: remove wales, courses, left -> should henceforth be inferred from KnitPattern
kw.initKnit("distance knit", wales, courses, left);

let courseCntr = 0;

const Direction = {
	LEFT: "-",
	RIGHT: "+"
}

function makeYarn(id) {
    return { id:id };
}

var KnitPattern = function() {

    this.prevYarn = null;
    this.leftmost = Infinity;
    this.rightmost = -Infinity;

    this.bringInArea = {
        left: 0,
        right: 0
    }

    this.maps = {};

    /*
        n   needle operations (knit, tuck, miss, xfer, etc.)
        r   rack
        s   set stitch setting
        c   insert comment
    */
    this.commands = [];

    this.prepare = function(yarn) {
        if(!(yarn.id in this.maps)) {

            let createMap = function() {
                return {
                    name: yarn.id,
                    leftPos: Infinity,
                    rightPos: -Infinity,
                    courses: []
                };
            };

            this.maps[yarn.id] = createMap();
        };
    };
    
    this.newCourse = function(yarn, offset = 0) {
        let createCourse = function(l) {
            return {
                leftPos: l,
                ops: ''
            };
        };

        this.prepare(yarn);

        if(yarn) {
            this.commands.push("n|" + yarn.id);
            this.prevYarn = yarn;
        }

        this.maps[yarn.id].courses.push(createCourse(offset + 1));
    };

    this.comment = function(msg) {
        this.commands.push("c|" + msg);
    }

    /*
        . nop
        k front knit
        K back knit
        b front+back knit
        t front tuck
        T back tuck
        B front+back tuck
        x front knit + back tuck
        X back knit + front tuck
        - front miss
        _ back miss
    */
    this.insert = function(yarn, repeat, needleCount, repeatOffset = 0) {
        if(!yarn.id) {
            console.error("ERROR: no valid yarn passed");
            return;
        }

        this.prepare(yarn);

        if(yarn != this.prevYarn) {
            this.newCourse(yarn);
        }

        let m = this.maps[yarn.id];
        let len = m.courses.length;
        if(!len) {
            console.error("ERROR: pattern for yarn " + yarn.id + " must have at least one course");
            return;
        }
    
        if(!repeat.length) {
            console.error("ERROR: no pattern repeat specified");
            return;
        }
    
        // if(!validate(repeat)) {
        // }
    
        let ops = '';
        for(let i = 0; i < needleCount; i++) {
            ops += repeat[(i + repeatOffset) % repeat.length];
        }
    
        let course = m.courses[len - 1];
        course.ops += ops;

        //let r = course.leftPos + course.ops.length - 1;
        m.leftPos = Math.min(m.leftPos, course.leftPos);//(m.leftPos < course.leftPos ? m.leftPos : course.leftPos);
        m.rightPos = Math.max(m.rightPos, course.leftPos + course.ops.length - 1);// (m.rightPos > r ? m.rightPos : r);

        this.leftmost = Math.min(this.leftmost, m.leftPos);
        this.rightmost = Math.max(this.rightmost, m.rightPos);

        //TODO: remove hardcoded values here
        this.bringInArea.left = this.rightmost + 2;
        this.bringInArea.right = this.rightmost + 8;
    };

    this.shift = function(offset) {
        for(var id in this.maps) {
            let m = this.maps[id];

            for(let i = 0; i < m.courses.length; i++) {
                m.courses[i].leftPos += offset;
            }
            m.leftPos += offset;
            m.rightPos += offset;
        }
        this.leftmost += offset;
        this.rightmost += offset;

        //TODO: remove hardcoded values here
        this.bringInArea.left = this.leftmost + 2;
        this.bringInArea.right = this.leftmost + 8;
    }

    let printMapInternal = function(m) {
        if(isFinite(m.leftPos)) {
            console.log("--- map " + m.name + " (" + m.leftPos + " - " + m.rightPos + ") ---");
            let mw = 0;
            for(let i = m.courses.length - 1; i >= 0; i--) {
                let course = m.courses[i];

                let cs = (i + 1).toString();
                let cw = cs.length;
                if(!mw)
                    mw = cw;
                console.log(' '.repeat(mw - cw) + cs + ": " + ' '.repeat(course.leftPos - 1) + course.ops + " (" + course.leftPos + " - " + (course.leftPos + course.ops.length - 1) + ")");
            }
        } else {
            console.log("--- map " + m.name + " ---");
            console.log("<< empty >>");
        }
    }

    this.printMap = function(yarn) {
        let m = this.maps[yarn.id];
        if(m == undefined) {
            console.error("ERROR: no map for yarn " + yarn.id);
            return;
        }

        printMapInternal(m);
    }

    this.printAllMaps = function() {
        console.log("knit pattern range: " + this.leftmost + " - " + this.rightmost);
        for(var id in this.maps) {
            printMapInternal(this.maps[id]);
        }
    }

    this.printOrder = function() {
        let s = '';
        this.commands.forEach(item => { s += item + ", "; });
        console.log("order (" + this.commands.length + "): " + s );
    }

    this.printSequence = function() {

        var maxIdLen = 0;
        var maxCourseLen = 0;
        var courseCntr = {};

        for(var key in this.maps) {
            courseCntr[key] = 0;
            maxIdLen = Math.max(key.length, maxIdLen);
            maxCourseLen = Math.max(this.maps[key].courses.length, maxCourseLen);
        }

        //print in order
        this.commands.forEach(function(command, i) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);
            
            /*
            n   needle operations (knit, tuck, miss, xfer, etc.)
            r   rack
            s   set stitch setting
            */

            switch (cmd) {
                case 'n':
                    let m = this.maps[arg];
                    if(!m) {
                        console.error("ERROR: map '" + arg + "' not found in pattern" );
                        return;
                    }
                    let courseId = courseCntr[arg];
                    //m.leftPos;
                    let course = m.courses[courseId];
                    //course.leftPos;

                    let coml = String(this.commands.length).length;
                    let il = String(i + 1).length;

                    let coul = String(maxCourseLen).length;
                    let cl = String(courseId + 1).length;
                    
                    console.log('N: ' + ' '.repeat(coml - il) + (i + 1) + ': ' + ' '.repeat(maxIdLen - arg.length) + arg + ' ' + ' '.repeat(coul - cl) + '(' + (courseId + 1) + '): ' +  ' '.repeat(course.leftPos - 1) + course.ops);

                    courseCntr[arg]++;
                    break;
                case 'r':
                    break;
                case 's':
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + c + "'" );
            }

            //console.log("carrier motion " + (i + 1) + ": " + subs);
        }, this);
    }
}


function generateKnit(){

    let knitPattern = new KnitPattern();

    /*
    let carrier1 = kw.makeCarrier(1, "carrier1");
    let carrier2 = kw.makeCarrier(2, "carrier2");

    knitPattern.newCourse(carrier1, 11);
    knitPattern.newCourse(carrier2);
    knitPattern.insert(carrier1, "kK", 10, 0);
    knitPattern.newCourse(carrier1);
    knitPattern.insert(carrier1, "kK", 10, 1);
    knitPattern.newCourse(carrier1);
    knitPattern.insert(carrier1, "kK", 10, 0);
    knitPattern.newCourse(carrier1);
    knitPattern.insert(carrier1, "Kk", 10, 0);

    knitPattern.shift(2);

    //knitPattern.printMap(carrier1);
    knitPattern.printAllMaps();
    */

    let buttonCourses = 16;
    let buttonWales = 14;
    let buttonSafetyCourses = 2;
    let buttonSafetyWales = 2;

    let connectorCourses = 2;

    let madeiraCourses = buttonCourses - buttonSafetyCourses;
    let madeiraWales = buttonWales - buttonSafetyWales * 2;

    let marginCourses = Math.round((courses - buttonCourses) / 2);
    let marginWales = Math.floor((wales - buttonWales) / 2);

    let buttonLeft = left + marginWales;
    let buttonRight = buttonLeft + buttonWales;

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

    let yarnCotton0 =    makeYarn("Cotton0");
    let yarnCotton1 =    makeYarn("Cotton1");
    let yarnPE =         makeYarn("PE");
    let yarnMadeira0 =   makeYarn("Madeira0");
    let yarnMadeira1 =   makeYarn("Madeira1");


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

    //knitPattern.printSequence();

    kw.createKnitout();

    //TODO: clean this up, should not have to specify twice
    let carriers = {
        "Cotton0":  kw.makeCarrier(3, "Cotton0"),
        "Cotton1":  kw.makeCarrier(4, "Cotton1"),
        "PE":       kw.makeCarrier(6, "PE"),
        "Madeira0": kw.makeCarrier(2, "Madeira0"),
        "Madeira1": kw.makeCarrier(7, "Madeira1"),
    };

    kw.rack(0);

    let mapInfo = {};
    for(var key in knitPattern.maps) {
        mapInfo[key] = {
            courseCntr: 0,
            wasInUse: false,
            wasKnit: false,
            wasTuck: false,
            carrier: carriers[key]
        };
    }
    let dropBringIn = null;

    let numActiveCarriers = 0;

    //print in order
    knitPattern.commands.forEach(function(command) {

        let p0 = 0;
        let p1 = command.indexOf('|', p0);

        let cmd = command.substring(p0, p1);

        p0 = p1 + 1;
        p1 = command.length;
        
        let arg = command.substring(p0, p1);

        switch (cmd) {
            case 'n':
                let m = knitPattern.maps[arg];
                if(!m) {
                    console.error("ERROR: map '" + arg + "' not found in pattern" );
                    return;
                }

                let mi = mapInfo[arg];

                let courseId = mi.courseCntr;

                let c = mi.carrier;
                if(!c.isIn) {
                    kw.bringIn(c, knitPattern.bringInArea.left, knitPattern.bringInArea.right);
                    numActiveCarriers++;

                    dropBringIn = mi;

                    c.isIn = true;
                }

                let course = m.courses[courseId];
                let dir = 0;

                if(course.ops.length) {

                    let l = course.leftPos;
                    let r = l + course.ops.length - 1;
                    let center = (l + r) / 2;

                    dir = (c.pos < center ? RIGHT : LEFT);
                    let start = (dir == RIGHT ? l : r);
                    let end = start + course.ops.length * dir;
                    let n = start;
                    let i = 0;

                    while(n != end) {

                        /*
                        . nop
                        k front knit
                        K back knit
                        b front+back knit
                        B front+back tuck
                        t front tuck
                        T back tuck
                        x front knit + back tuck
                        X back knit + front tuck
                        - front miss
                        _ back miss
                        */
                        switch (course.ops[i]) {
                            case '.':
                                //nop --> do nothing
                                break;
                            case 'k':
                                kw.knit(dir, 'f', n, c);
                                mi.wasKnit = true;
                                break;
                            case 'K':
                                kw.knit(dir, 'b', n, c);
                                mi.wasKnit = true;
                                break;
                            case 'b':
                                //TODO: not sure about what happens (and what *SHOULD* happen!) when bed is racked
                                if(dir == LEFT) {
                                    kw.knit(dir, 'b', n, c);
                                    kw.knit(dir, 'f', n, c);
                                } else {
                                    kw.knit(dir, 'f', n, c);
                                    kw.knit(dir, 'b', n, c);
                                }
                                mi.wasKnit = true;
                                break;
                            case 'B':
                                //TODO: not sure about what happens (and what *SHOULD* happen!) when bed is racked
                                if(dir == LEFT) {
                                    kw.tuck(dir, 'b', n, c);
                                    kw.tuck(dir, 'f', n, c);
                                } else {
                                    kw.tuck(dir, 'f', n, c);
                                    kw.tuck(dir, 'b', n, c);
                                }
                                mi.wasTuck = true;
                                break;
                            case 't':
                                kw.tuck(dir, 'f', n, c);
                                mi.wasTuck = true;
                                break;
                            case 'T':
                                kw.tuck(dir, 'b', n, c);
                                mi.wasTuck = true;
                                break;
                            case '-':
                                kw.miss(dir, 'f', n, c);
                                break;
                            case '_':
                                kw.miss(dir, 'b', n, c);
                                break;
                            case 'x':
                                if(dir == LEFT) {
                                    kw.tuck(dir, 'b', n, c);
                                    kw.knit(dir, 'f', n, c);
                                } else {
                                    kw.knit(dir, 'f', n, c);
                                    kw.tuck(dir, 'b', n, c);
                                }
                                mi.wasKnit = true;
                                mi.wasTuck = true;
                                break;
                            case 'X':
                                if(dir == LEFT) {
                                    kw.knit(dir, 'b', n, c);
                                    kw.tuck(dir, 'f', n, c);
                                } else {
                                    kw.tuck(dir, 'f', n, c);
                                    kw.knit(dir, 'b', n, c);
                                }
                                mi.wasKnit = true;
                                mi.wasTuck = true;
                                break;
                        }

                        n += dir;
                        i++;
                    }
                }
                
                mi.wasInUse = true;
                mi.courseCntr++;

                if(mi.courseCntr == m.courses.length) {

                    if(numActiveCarriers == 1) {
                        //TODO: replace this with leftmost and rightmost needles actually holding loops
                        kw.castOff(c, knitPattern.leftmost, knitPattern.rightmost);
                    }

                    kw.out(c);
                    numActiveCarriers--;

                    c.isIn = false;
                }

                if(dropBringIn && dir == RIGHT) {
                    if(dropBringIn.wasKnit || dropBringIn.wasTuck) {
                        kw.dropBringIn();
                        dropBringIn = null;
                    }
                }

                break;
            case 'r':
                //TODO
                break;
            case 's':
                //TODO
                break;
            case 'c':
                kw.comment(arg);
                break;
            default:
                console.error("ERROR: unrecognized command '" + c + "'" );
        }
    });

    for(var key in mapInfo) {
        let mi = mapInfo[key];
        if(mi.isCarrierIn) {
            console.log("still remaining carrier: " + mi.carrier.desc);
            kw.out(mi.carrier);
            mapInfo[key].isCarrierIn = false;
        }
    }

    kw.writeKnitout(outFileName);

    console.log("generated file '" + outFileName + "'");
}

generateKnit();