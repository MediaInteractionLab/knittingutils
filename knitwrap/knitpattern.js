#!/usr/bin/env node

/*
v2
*/

"use strict";

/**
 * 
 * @param {String} id yarn descriptor
 * @returns instance of yarn
 */
var makeYarn = function(id, carrier = undefined) {
    return { 
        id:id,
        carrier:carrier
    };
}

var createTransfer = function() {
    return { 
        srcNeedles: [],
        dstNeedles: []
    };
}

var createDrops = function() {
    return {
        left: 0,
        ops: ''
    }
}

const BRINGIN_DISTANCE = 2;
const BRINGIN_WALES = 6;

var KnitPattern = function() {

    this.prevYarn = null;
    this.leftmost = Infinity;
    this.rightmost = -Infinity;

    this.bringInArea = {
        left: 0,
        right: 0
    }

    this.maps = {};
    this.drops = [];
    this.transfers = [];

    /**
     * supported operations
     *  n   needle operations (knit, tuck, miss, xfer, etc.)
     *  d   drop loops
     *  x   needle transfer
     *  y   loop split
     *  r   rack
     *  s   set stitch setting
     *  c   insert comment
    */
    this.commands = [];

    /**
     * 
     * @param {*} yarn 
     */
    this.prepare = function(yarn) {
        if(!(yarn.id in this.maps)) {

            let createMap = function() {
                return {
                    name: yarn.id,
                    leftPos: Infinity,
                    rightPos: -Infinity,
                    courses: [],
                    carrierID: undefined,
                    doBringin: false,
                    isHookReleased: undefined
                };
            };

            this.maps[yarn.id] = createMap();
        };
    }
    
    /**
     * creates new course, i.e. a 'newline' in the pattern description
     * @param {*} yarn yarn instance
     * @param {Number} offset optional course-directional offset relative to to needle #1
     */
    this.newCourse = function(yarn, offset = 0) {
        let createCourse = function(l) {
            return {
                leftPos: l,
                ops: ''
            };
        };

        this.prepare(yarn);

        this.commands.push("n|" + yarn.id);
        this.prevYarn = yarn;

        this.maps[yarn.id].courses.push(createCourse(offset + 1));
    }

    /**
     * insert comment into generated knitout
     * @param {String} msg 
     */
    this.comment = function(msg) {
        this.commands.push("c|" + msg);
    }

    /**
     * insert a specific pattern repeat into current course of specified yarn
     * @param {*} yarn yarn instance
     * @param {String} repeat char-encoded definition of pattern repeat
     *      * needle operations:
     *      '.' nop
     *      'k' knit front
     *      'K' knit back
     *      'b' knit front+back
     *      't' tuck front
     *      'T' tuck back
     *      'B' tuck front + back
     *      'x' tuck front + back
     *      'X' knit back + tuck front
     *      '-' explicit miss front
     *      '_' explicit miss back
     * @param {Number} needleCount 
     * @param {Number} repeatOffset 
     * @returns 
     */
    this.insert = function(yarn, repeat, needleCount, repeatOffset = 0) {
        if(!yarn.id) {
            console.error("ERROR: no valid yarn passed");
            return;
        }

        this.prepare(yarn);

        if(yarn !== this.prevYarn) {
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

        m.leftPos = Math.min(m.leftPos, course.leftPos);
        m.rightPos = Math.max(m.rightPos, course.leftPos + course.ops.length - 1);

        this.leftmost = Math.min(this.leftmost, m.leftPos);
        this.rightmost = Math.max(this.rightmost, m.rightPos);

        this.bringInArea.left = this.rightmost + BRINGIN_DISTANCE;
        this.bringInArea.right = this.rightmost + BRINGIN_DISTANCE + BRINGIN_WALES;
    }

    /**
     * 
     * @param {Number} racking absolute racking value
     */
    this.rack = function(racking) {
        //TODO: figure out what the deal with half-pitch, quater-pitch is
        this.commands.push("r|" + racking);
    }

    /**
     * 
     * @param {String} repeat char-encoded drop pattern repeat
     *      '.' nop
     *      'd' drop front
     *      'D' drop back
     *      'a' drop all (front + back)
     * @param {Number} needleCount 
     * @param {Number} repeatOffset 
     */
    this.drop = function(repeat, needleCount, repeatOffset = 0) {
        this.commands.push("d|" + this.drops.length);
        let dr = createDrops();

        dr.left = 1;
        for(let i = 0; i < needleCount; i++) {
            dr.ops += repeat[(i + repeatOffset) % repeat.length];
        }

        this.drops.push(dr);
    }

    this.transfer = function(b0, n0, n1) {
        if(Array.isArray(n0) ^ Array.isArray(n1)) {
            throw new Error("either none or both arguments need to be arrays");
        }

        let tf = createTransfer();
        if(Array.isArray(n0)) {
            if(n0.length !== n1.length) {
                console.error("ERROR: needle count of 'n0' and 'n1' must match up");
                return;
            }

            tf.srcNeedles = n0;
            tf.dstNeedles = n1;
        } else {
            tf.srcNeedles.push(n0);
            tf.dstNeedles.push(n1);
        }

        this.commands.push("x|" + b0);
        this.transfers.push(tf);
    }

    /**
     * 
     * @param {Number} offset 
     */
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

        this.drops.forEach(dr => {
            dr.left += offset;
        });

        this.transfers.forEach(tf => {
            tf.srcNeedles.forEach(n => {
                n += offset;
            });
            tf.dstNeedles.forEach(n => {
                n += offset;
            });
        });

        this.bringInArea.left = this.rightmost + BRINGIN_DISTANCE;
        this.bringInArea.right = this.rightmost + BRINGIN_DISTANCE + BRINGIN_WALES;
    }

    /**
     * 
     * @param {*} m 
     */
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

    /**
     * 
     * @param {*} yarn 
     */
    this.printMap = function(yarn) {
        let m = this.maps[yarn.id];
        if(m === undefined) {
            console.error("ERROR: no map for yarn " + yarn.id);
        } else {
            printMapInternal(m);
        }
    }

    /**
     * 
     */
    this.printAllMaps = function() {
        console.log("knit pattern range: " + this.leftmost + " - " + this.rightmost);
        for(var id in this.maps) {
            printMapInternal(this.maps[id]);
        }
    }

    /**
     * 
     */
    this.printOrder = function() {
        let s = '';
        this.commands.forEach(item => { s += item + ", "; });
        console.log("order (" + this.commands.length + "): " + s );
    }

    /**
     * 
     */
    this.printSequence = function() {

        var maxIdLen = 0;
        var maxCourseLen = 0;
        var courseCntr = {};
        var dropCntr = 0;
        var transferCntr = 0;

        for(var key in this.maps) {
            courseCntr[key] = 0;
            maxIdLen = Math.max(key.length, maxIdLen);
            maxCourseLen = Math.max(this.maps[key].courses.length, maxCourseLen);
        }

        var carrierCounter = 0;

        let coul = String(maxCourseLen).length;
        let coml = String(this.commands.length).length;

        this.commands.forEach(function(command) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);
            
            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    carrierCounter++;

                    let m = this.maps[arg];
                    if(!m) {
                        console.error("ERROR: map '" + arg + "' not found in pattern" );
                        return;
                    }
                    let courseNr = courseCntr[arg];
                    //m.leftPos;
                    let course = m.courses[courseNr];
                    //course.leftPos;

                    let il = String(carrierCounter).length;
                    let cl = String(courseNr + 1).length;
                    
                    console.log('N: ' + ' '.repeat(coml - il) + (carrierCounter) + ': ' + ' '.repeat(maxIdLen - arg.length) + arg + ' ' + ' '.repeat(coul - cl) + '(' + (courseNr + 1) + '): ' +  ' '.repeat(course.leftPos - 1) + course.ops);

                    courseCntr[arg]++;
                    break;
                case 'd': //drop
                    let dr = this.drops[dropCntr];
                    console.log('D: ' + ' '.repeat(coml + maxIdLen + coul + dr.left + 6) + dr.ops);

                    dropCntr++;
                    break;
                case 'x': //needle transfer
                    let str = (arg === 'b' ? "b -> f: " : (arg === 'f' ? "f -> b: " : "<invalid> "));

                    let tf = this.transfers[transferCntr];
                    let subs = [];
                    for(let i = 0; i < tf.srcNeedles.length; i++) {
                        subs.push(tf.srcNeedles[i] + " > " + tf.dstNeedles[i]);
                    }
                    str += subs.join(', ');
                    console.log('X: ' + str);

                    transferCntr++;
                    break;
                case 'y': //loop split
                    //TODO
                    break;
                case 'r': //rack
                    console.log('R: ' + arg);
                    break;
                case 's': //set stitch setting
                    //TODO
                    break;
                case 'c': //insert comment
                    console.log('C: "' + arg + '"');
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + cmd + "'" );
            }
        }, this);
    }

    this.mapYarn = function(yarn, carrierID, doBringin = true) {
        let m = this.maps[yarn.id];
        if(!m) {
            console.error("ERROR: yarn '" + yarn.id + "' is unknown at this point");
            return;
        }

        m.carrierID = carrierID;
        m.doBringin = doBringin;
    }

    /**
     * 
     * @param {String} outFileName 
     * @param {String} desc 
     * @param {*} machine 
     */
    this.generate = function(outFileName, desc = "", position = "Keep", machine = undefined) {

        const knitwrap = require('./knitwrap.js');
        let kw = new knitwrap.KnitOutWrapper();

        const LEFT = knitwrap.LEFT;
        const RIGHT = knitwrap.RIGHT;

        let dropCntr = 0;
        let transferCntr = 0;

        //let wales = this.rightmost - this.leftmost + 1;
        kw.initKnitout(machine, position);
        kw.comment("description: " + desc);

        let cInfo = {};
        for(var key in this.maps) {
            //let cm = carrierMapping[key];
            //if(!cm)
            //    throw new Error("mapping for carrier with name \'" + key + "' not found");
            let map = this.maps[key];
            if(!map.carrierID)
                throw new Error("mapping for carrier \'" + key + "' not defined");
            cInfo[key] = {
                courseCntr: 0,
                wasInUse: false,
                wasKnit: false,
                wasTuck: false,
                doBringin: map.doBringin,
                carrier: kw.machine.carriers[map.carrierID.toString()],
                stitchNumber: map.carrierID + 10
            };

            kw.comment("yarn '" + key + "' is mapped to carrier " + cInfo[key].carrier.name);
        }
        let dropBringIn = null;

        let numActiveCarriers = 0;

        kw.rack(0);

        this.commands.forEach(function(command) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);

            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    let m = this.maps[arg];
                    if(!m) {
                        console.error("ERROR: map '" + arg + "' not found in pattern" );
                        return;
                    }

                    let ci = cInfo[arg];

                    let courseNr = ci.courseCntr;

                    let c = ci.carrier;

                    if(!c.isIn) {
                        if(ci.doBringin) {
                            kw.bringIn(c, this.bringInArea.left, this.bringInArea.right);
                            dropBringIn = ci;
                        } else {
                            kw.bringIn(c);
                        }
                        numActiveCarriers++;

                        c.isIn = true;
                    }

                    let course = m.courses[courseNr];
                    let dir = 0;

                    if(course.ops.length) {

                        let l = course.leftPos;
                        let r = l + course.ops.length - 1;
                        let center = (l + r) / 2;

                        dir = (c.pos < center ? RIGHT : LEFT);
                        let start = (dir === RIGHT ? l : r);
                        let end = start + course.ops.length * dir;
                        let n = start;
                        let i = (dir === RIGHT ? 0 : course.ops.length - 1);

                        kw.setStitchNumber(ci.stitchNumber);

                        while(n !== end) {

                            switch (course.ops[i]) {
                                case '.':
                                    //nop --> do nothing
                                    break;
                                case 'k':
                                    kw.knit(dir, 'f', n, c);
                                    ci.wasKnit = true;
                                    break;
                                case 'K':
                                    kw.knit(dir, 'b', n, c);
                                    ci.wasKnit = true;
                                    break;
                                case 'b':
                                    //TODO: not sure about what happens (and what *SHOULD* happen!) when bed is racked
                                    if(dir === LEFT) {
                                        kw.knit(dir, 'b', n, c);
                                        kw.knit(dir, 'f', n, c);
                                    } else {
                                        kw.knit(dir, 'f', n, c);
                                        kw.knit(dir, 'b', n, c);
                                    }
                                    ci.wasKnit = true;
                                    break;
                                case 'B':
                                    //TODO: not sure about what happens (and what *SHOULD* happen!) when bed is racked
                                    if(dir === LEFT) {
                                        kw.tuck(dir, 'b', n, c);
                                        kw.tuck(dir, 'f', n, c);
                                    } else {
                                        kw.tuck(dir, 'f', n, c);
                                        kw.tuck(dir, 'b', n, c);
                                    }
                                    ci.wasTuck = true;
                                    break;
                                case 't':
                                    kw.tuck(dir, 'f', n, c);
                                    ci.wasTuck = true;
                                    break;
                                case 'T':
                                    kw.tuck(dir, 'b', n, c);
                                    ci.wasTuck = true;
                                    break;
                                case '-':
                                    kw.miss(dir, 'f', n, c);
                                    break;
                                case '_':
                                    kw.miss(dir, 'b', n, c);
                                    break;
                                case 'x':
                                    if(dir === LEFT) {
                                        kw.tuck(dir, 'b', n, c);
                                        kw.knit(dir, 'f', n, c);
                                    } else {
                                        kw.knit(dir, 'f', n, c);
                                        kw.tuck(dir, 'b', n, c);
                                    }
                                    ci.wasKnit = true;
                                    ci.wasTuck = true;
                                    break;
                                case 'X':
                                    if(dir === LEFT) {
                                        kw.knit(dir, 'b', n, c);
                                        kw.tuck(dir, 'f', n, c);
                                    } else {
                                        kw.tuck(dir, 'f', n, c);
                                        kw.knit(dir, 'b', n, c);
                                    }
                                    ci.wasKnit = true;
                                    ci.wasTuck = true;
                                    break;
                                default:
                                    console.warn("WARNING: unknown needle operation '" + course.ops[i] + "'");
                                    break;
                            }

                            n += dir;
                            i += dir;
                        }

                        if(c.isHookReleased === false) {
                            kw.comment("bringin was skipped for carrier " + c.name + ", releasing hook after first course");
                            kw.releasehook(c);
                        }
                    }
                    
                    ci.wasInUse = true;
                    ci.courseCntr++;

                    if(ci.courseCntr === m.courses.length) {

                        if(numActiveCarriers === 1) {
                            //TODO: replace this with leftmost and rightmost needles actually holding loops
                            kw.castOff(c, this.leftmost, this.rightmost);
                        } else {
                            kw.outhook(c);
                        }

                        numActiveCarriers--;

                        c.isIn = false;
                    }

                    if(dropBringIn && dir === RIGHT) {
                        if(dropBringIn.wasKnit || dropBringIn.wasTuck) {
                            kw.dropBringIn();
                            dropBringIn = null;
                        }
                    }

                    break;
                case 'd': //drop
                    let dr = this.drops[dropCntr];
                    
                    let n = dr.left;
                    for(let i = 0; i < dr.ops.length; i++, n++) {

                        switch (dr.ops[i]) {
                            case '.':
                                //nop --> do nothing
                                break;
                            case 'd':
                                kw.drop('f', n);
                                break;
                            case 'D':
                                kw.drop('b', n);
                                break;
                            case 'a':
                                //TODO: not sure if order does matter when dropping?
                                kw.drop('f', n);
                                kw.drop('b', n);
                                break;
                            default:
                                console.warn("WARNING: invalid drop operation '" + dr.ops[i] + "'");
                                break;
                        }
                    }

                    dropCntr++;
                    break;
                case 'x': //needle transfer
                    let tf = this.transfers[transferCntr];
                    for(let i = 0; i < tf.srcNeedles.length; i++) {
                        kw.xfer(arg, tf.srcNeedles[i], tf.dstNeedles[i]);
                    }
                    transferCntr++;
                    break;
                case 'y': //loop split
                    //TODO
                    break;
                case 'r': //rack
                    kw.rack(parseFloat(arg));
                    break;
                case 's': //set stitch setting
                    //TODO
                    break;
                case 'c': //insert comment
                    kw.comment(arg);
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + cmd + "'" );
            }
        }, this);

        for(var key in cInfo) {
            let ci = cInfo[key];
            if(ci.isCarrierIn) {
                console.log("still remaining carrier: " + ci.carrier.desc);
                kw.outhook(ci.carrier);
                cInfo[key].isCarrierIn = false;
            }
        }

        kw.dropOff();

        kw.write(outFileName);

        console.log("generated file '" + outFileName + "'");
    }
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
	module.exports.KnitPattern = KnitPattern;
    module.exports.makeYarn = makeYarn;
}
