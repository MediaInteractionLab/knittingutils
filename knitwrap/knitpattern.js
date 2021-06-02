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
    if(id.indexOf('|') != -1) {
        throw Error("yarn id must not contain '|'");
    }

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

const STITCHNUMBER_CASTON  = 2;
const STITCHNUMBER_CASTOFF = 3;

var KnitPattern = function() {

    let prevYarn = null;
    let leftmost = Infinity;
    let rightmost = -Infinity;

    let bringInArea = {
        left: 0,
        right: 0
    }

    let maps = {};
    let drops = [];
    let transfers = [];

    /**
     * operations reference
     *  n   needle operations (knit, tuck, miss, xfer, etc.)
     *  d   drop loops
     *  x   needle transfer
     *  r   rack
     *  s   set stitch setting
     *  c   insert comment
    */
    let commands = [];

    /**
     * 
     * @param {*} y yarn instance or array
     */
    var prepare = function(y) {

        if(!(y.id in maps)) {

            let createMap = function() {
                return {
                    name: y.id,
                    leftPos: Infinity,
                    rightPos: -Infinity,
                    courses: [],
                    carrierID: undefined,
                    doBringin: false,
                    isHookReleased: undefined
                };
            };

            maps[y.id] = createMap();
        };
    }.bind(this);

    var makeYarnString = function(yarn) {
        let ys = [];
        if(Array.isArray(yarn)) {
            yarn.forEach( y => { ys.push(y.id); } );
        } else {
            ys.push(yarn.id);
        }

        ys.sort();
        return ys.join('|');
    }.bind(this);

    var yarnChanged = function(yarn) {
        return(makeYarnString(yarn) !== prevYarn);
    }.bind(this);

    var setYarn = function(yarn) {
        prevYarn = makeYarnString(yarn);
    }.bind(this);

    var finishUp = function() {
        if(prevYarn) {
            let ys = prevYarn.split('|');
            for(let i = 0; i < ys.length; i++) {
                let cs = maps[ys[i]].courses;
                if(cs.length) {

                    //if at least one course was already written, finish up
                    if(cs[cs.length - 1].ops.length) {
                        prevYarn = null;
                        return;
                    }
                }
            }
        }
    }.bind(this);
    
    /**
     * creates new course, i.e. a 'newline' in the pattern description
     * @param {*} yarn yarn instance or array
     * @param {Number} offset optional course-directional offset relative to to needle #1
     */
    this.newCourse = function(yarn, offset = 0) {
        let createCourse = function(l) {
            return {
                leftPos: l,
                ops: ''
            };
        };

        if(Array.isArray(yarn)) {
            yarn.forEach( y => 
                { 
                    prepare(y);
                }, this);

            let idList = [];
            yarn.forEach( y => { idList.push(y.id); });
            commands.push("n|" + idList.join('|'));

            setYarn(yarn);
            yarn.forEach( y => 
                { 
                    maps[y.id].courses.push(createCourse(offset + 1)) 
                }, this);

            return;
        }

        prepare(yarn);

        commands.push("n|" + yarn.id);
        setYarn(yarn);

        maps[yarn.id].courses.push(createCourse(offset + 1));
    }

    /**
     * insert comment into generated knitout
     * @param {String} msg 
     */
    this.comment = function(msg) {
        commands.push("c|" + msg);
    }

    let insertInternal = function(yarn, repeat, needleCount, repeatOffset) {
        let m = maps[yarn.id];
        let len = m.courses.length;
        if(!len) {
            throw Error("pattern for yarn " + yarn.id + " must have at least one course");
        }
    
        if(!repeat.length) {
            throw Error("no pattern repeat specified");
        }
    
        let ops = '';
        for(let i = 0; i < needleCount; i++) {
            ops += repeat[(i + repeatOffset) % repeat.length];
        }
    
        let course = m.courses[len - 1];
        course.ops += ops;

        m.leftPos = Math.min(m.leftPos, course.leftPos);
        m.rightPos = Math.max(m.rightPos, course.leftPos + course.ops.length - 1);

        leftmost = Math.min(leftmost, m.leftPos);
        rightmost = Math.max(rightmost, m.rightPos);

        bringInArea.left = rightmost + BRINGIN_DISTANCE;
        bringInArea.right = rightmost + BRINGIN_DISTANCE + BRINGIN_WALES;
    }.bind(this);

    /**
     * insert a specific pattern repeat into current course of specified yarn
     * @param {*} yarn yarn instance or array
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
     *      'y' split front to back
     *      'Y' split back to front
     * @param {Number} needleCount number of needle indices to be used
     * @param {Number} repeatOffset optional offset for indexing repeat, for realizing patterns that are offset with 
     * each new course, e.g. by passing a counter. Specifying 0 will start filling with first repeat operation for 
     * first needle, specifying 2 will start with 3rd, and so on.
     */
    this.insert = function(yarn, repeat, needleCount, repeatOffset = 0) {

        if(!prevYarn) {
            throw Error("previous yarn not set, forgot to call newCourse?");
        }

        if(Array.isArray(yarn)) {
            yarn.forEach( y => {
                if(!y.id) {
                    throw Error("no valid yarn passed");
                }
                prepare(y);
            }, this);

            //TODO: compare arrays by content
            if(yarnChanged(yarn)) {
                throw Error("yarn changed, forgot to call newCourse?");
            }

            yarn.forEach( y => {
                insertInternal(y, repeat, needleCount, repeatOffset);
            }, this);

            return;
        }

        if(!yarn.id) {
            throw Error("no valid yarn passed");
        }

        prepare(yarn);

        if(yarnChanged(yarn)) {
            throw Error("yarn changed, forgot to call newCourse?");
        }

        insertInternal(yarn, repeat, needleCount, repeatOffset);
    }

    /**
     * 
     * @param {Number} racking machine racking value (absolute)
     */
    this.rack = function(racking) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because rack command would come after current 
        // needle command and racking would not affect needle ops until the next
        // call of newCourse
        finishUp();

        //TODO: figure out what the deal with half-pitch, quater-pitch is
        commands.push("r|" + racking);
    }

    /**
     * 
     * @param {String} repeat char-encoded drop pattern repeat
     *      '.' nop
     *      'd' drop front
     *      'D' drop back
     *      'a' drop all (front + back)
     * @param {Number} needleCount number of needle indices to be used
     * @param {Number} repeatOffset optional offset for indexing repeat, for realizing patterns that are offset with 
     * each new course, e.g. by passing a counter. Specifying 0 will start filling with first repeat operation for 
     * first needle, specifying 2 will start with 3rd, and so on.
     */
    this.drop = function(repeat, needleCount, repeatOffset = 0) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because drop command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();

        commands.push("d|" + drops.length);
        let dr = createDrops();

        dr.left = 1;
        for(let i = 0; i < needleCount; i++) {
            dr.ops += repeat[(i + repeatOffset) % repeat.length];
        }

        drops.push(dr);
    }

    /**
     * 
     * @param {String} b0 source bed identifier ('b' or 'f')
     * @param {*} n0 source needle index or array of source needle indices
     * @param {*} n1 destination needle index or array of destination needle indices
     */
    this.transfer = function(b0, n0, n1) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because transfers command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();
 
        if(Array.isArray(n0) ^ Array.isArray(n1)) {
            throw Error("either none or both arguments need to be arrays");
        }

        let tf = createTransfer();
        if(Array.isArray(n0)) {
            if(n0.length !== n1.length) {
                throw Error("needle count of 'n0' and 'n1' must match up");
            }

            //clone arrays
            tf.srcNeedles = n0.map((x) => x);
            tf.dstNeedles = n1.map((x) => x);
        } else {
            tf.srcNeedles.push(n0);
            tf.dstNeedles.push(n1);
        }

        commands.push("x|" + b0);
        transfers.push(tf);
    }

    /**
     * Overrides the 
     * @param {Number} index index into machine stitch number table
     */
    this.stitchNumberOverride = function(index) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because stitch number command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();

        commands.push("sn|" + index);
    }

    this.clearStitchNumberOverride = function(index) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because stitch number command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();

        commands.push("sn|clear");
    }

    /**
     * 
     * @param {Number} offset 
     */
    this.shift = function(offset) {
        for(var id in maps) {
            let m = maps[id];

            for(let i = 0; i < m.courses.length; i++) {
                m.courses[i].leftPos += offset;
            }
            m.leftPos += offset;
            m.rightPos += offset;
        }
        leftmost += offset;
        rightmost += offset;

        drops.forEach(dr => {
            dr.left += offset;
        });

        transfers.forEach(tf => {
            tf.srcNeedles.forEach((_, i) => {
                tf.srcNeedles[i] += offset;
            });
            tf.dstNeedles.forEach((_, i) => {
                tf.dstNeedles[i] += offset;
            });
        });

        bringInArea.left = rightmost + BRINGIN_DISTANCE;
        bringInArea.right = rightmost + BRINGIN_DISTANCE + BRINGIN_WALES;
    }

    /**
     * 
     * @param {*} m 
     */
    var printMapInternal = function(m) {
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
    }.bind(this);

    /**
     * 
     * @param {*} yarn 
     */
    this.printMap = function(yarn) {
        let m = maps[yarn.id];
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
        console.log("knit pattern range: " + leftmost + " - " + rightmost);
        for(var id in maps) {
            printMapInternal(maps[id]);
        }
    }

    /**
     * 
     */
    this.printOrder = function() {
        let s = '';
        commands.forEach(item => { s += item + ", "; });
        console.log("order (" + commands.length + "): " + s );
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

        for(var key in maps) {
            courseCntr[key] = 0;
            maxIdLen = Math.max(key.length, maxIdLen);
            maxCourseLen = Math.max(maps[key].courses.length, maxCourseLen);
        }

        var carrierCounter = 0;

        let coul = String(maxCourseLen).length;
        let coml = String(commands.length).length;

        commands.forEach(function(command) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);
            
            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    carrierCounter++;

                    let ys = arg.split('|');
                    if(!ys.length) {
                        console.error("ERROR: no yarn IDs found in arg");
                        return;
                    }

                    if(ys.length == 1) {
                        let y = ys[0];
                        let m = maps[y];
                        if(!m) {
                            console.error("ERROR: map '" + y + "' not found in pattern" );
                            return;
                        }

                        let courseNr = courseCntr[y];
                        let course = m.courses[courseNr];

                        let il = String(carrierCounter).length;
                        let cl = String(courseNr + 1).length;
                        
                        console.log('N:  ' + ' '.repeat(coml - il) + (carrierCounter) + ': ' + ' '.repeat(maxIdLen - y.length) + y + ' ' + ' '.repeat(coul - cl) + '(' + (courseNr + 1) + '): ' +  ' '.repeat(course.leftPos - 1) + course.ops);

                        courseCntr[y]++;
                    } else {

                        ys.forEach( function(y, i, arr) {
                            let m = maps[y];
                            if(!m) {
                                console.error("ERROR: map '" + y + "' not found in pattern" );
                                return;
                            }
    
                            let courseNr = courseCntr[y];
                            let course = m.courses[courseNr];

                            let il = String(carrierCounter).length;
                            let cl = String(courseNr + 1).length;

                            let str = "";

                            if(i === 0)
                                str += 'N:  ' + ' '.repeat(coml - il) + (carrierCounter) + ': ';
                            else
                                str += '   ' + ' '.repeat(coml) + '  ';
                            str +=  ' '.repeat(maxIdLen - y.length) + y + ' ' + ' '.repeat(coul - cl) + '(' + (courseNr + 1) + ')';

                            if(i == arr.length - 1)
                                str += ': ' + ' '.repeat(course.leftPos - 1) + course.ops;
                            else
                                str += ' ↴';

                            console.log(str);

                            courseCntr[y]++;
                        }, this);
                    }
                    break;
                case 'd': //drop
                    let dr = drops[dropCntr];
                    console.log('D:  ' + ' '.repeat(coml + maxIdLen + coul + dr.left + 6) + dr.ops);

                    dropCntr++;
                    break;
                case 'x': //needle transfer
                    let str = (arg === 'b' ? "b -> f: " : (arg === 'f' ? "f -> b: " : "<invalid> "));

                    let tf = transfers[transferCntr];
                    let subs = [];
                    for(let i = 0; i < tf.srcNeedles.length; i++) {
                        subs.push(tf.srcNeedles[i] + " > " + tf.dstNeedles[i]);
                    }
                    str += subs.join(', ');
                    console.log('X:  ' + str);

                    transferCntr++;
                    break;
                case 'r': //rack
                    console.log('R:  ' + arg);
                    break;
                case 's': //set stitch setting
                    //TODO
                    break;
                case 'c': //insert comment
                    console.log('C:  "' + arg + '"');
                    break;
                case 'sn': //override stitch number (or clear stitch number override) from here on
                    console.log('SN: ' + arg);
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + cmd + "'" );
            }
        }, this);
    }

    this.mapYarn = function(yarn, carrierID, doBringin = true) {
        let m = maps[yarn.id];
        if(!m) {
            console.warn("WARNING: yarn '" + yarn.id + "' is unknown at this point (maybe yarn never used?) -- mapping has no effect.");
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

        kw.initKnitout(machine, position);
        kw.comment("description: " + desc);

        let cInfo = {};
        for(var key in maps) {
            //let cm = carrierMapping[key];
            //if(!cm)
            //    throw new Error("mapping for carrier with name \'" + key + "' not found");
            let map = maps[key];
            if(!map.carrierID)
                throw Error("mapping for carrier \'" + key + "' not defined");
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

        let stitchNumberOverride = undefined;

        commands.forEach(function(command) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);

            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    let ys = arg.split('|');
                    if(!ys.length) {
                        throw Error("no yarn IDs found in arg");
                    }

                    let dir = 0;

                    if(ys.length == 1) {
                        let y = arg;

                        let m = maps[y];
                        if(!m) {
                            throw Error("map '" + y + "' not found in pattern" );
                        }
        
                        let ci = cInfo[y];
                        let course = m.courses[ci.courseCntr];
        
                        if(!ci.carrier.isIn) {
                            if(ci.doBringin) {
                                kw.bringIn(ci.carrier, ci.stitchNumber, bringInArea.left, bringInArea.right);
                                dropBringIn = ci;
                            } else {
                                kw.bringIn(ci.carrier, ci.stitchNumber);
                            }
        
                            if(!numActiveCarriers) {
                                //TODO: adapt function to being able to handle left-out neeldes or using either bed
                                kw.castOn(ci.carrier, course.leftPos, course.leftPos + course.ops.length - 1, STITCHNUMBER_CASTON);
                                ci.wasTuck = true;
                                if(dropBringIn) {
                                    kw.dropBringIn();
                                    dropBringIn = null;
                                }
                            }
        
                            numActiveCarriers++;
        
                            ci.carrier.isIn = true;

                            if(stitchNumberOverride !== undefined)
                                kw.setStitchNumber(stitchNumberOverride);
                        }
    
                        if(course.ops.length) {
    
                            let l = course.leftPos;
                            let r = l + course.ops.length - 1;
                            let center = (l + r) / 2;
    
                            dir = (ci.carrier.pos < center ? RIGHT : LEFT);
                            let start = (dir === RIGHT ? l : r);
                            let end = start + course.ops.length * dir;
                            let n = start;
                            let i = (dir === RIGHT ? 0 : course.ops.length - 1);
    
                            if(stitchNumberOverride === undefined)
                                kw.setStitchNumber(ci.stitchNumber);
    
                            let c = ci.carrier;
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
                                    case 'y':
                                        //TODO: calculate opposite needle from current racking?
                                        //TODO: correct racking if not integral number and reset after all splits were done (or just warn?)
                                        kw.split(dir, 'f', n, n, c);
                                        break;
                                    case 'Y':
                                        //TODO: calculate opposite needle from current racking?
                                        //TODO: correct racking if not integral number and reset after all splits were done (or just warn?)
                                        kw.split(dir, 'b', n, n, c);
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
    
                            if(ci.carrier.isHookReleased === false) {
                                kw.comment("bringin was skipped for carrier " + ci.carrier.name + ", releasing hook after first course");
                                kw.releasehook(ci.carrier);
                            }
                        }
                        
                        ci.wasInUse = true;
                        ci.courseCntr++;
    
                        if(ci.courseCntr === m.courses.length) {
    
                            if(numActiveCarriers === 1) {
                                //TODO: replace this with leftmost and rightmost needles actually holding loops
                                kw.castOff(ci.carrier, leftmost, rightmost, STITCHNUMBER_CASTOFF);
                            } else {
                                kw.outhook(ci.carrier);
                            }
    
                            numActiveCarriers--;
    
                            ci.carrier.isIn = false;
                        }
                    } else {

                        let mList = [];
                        let ciList = [];
                        let courseList = [];

                        let broughtIn = false;

                        ys.forEach( function(y) {
                            let m = maps[y];
                            if(!m) {
                                throw Error("map '" + y + "' not found in pattern" );
                            }
            
                            let ci = cInfo[y];
                            let course = m.courses[ci.courseCntr];

                            mList.push(m);
                            ciList.push(ci);
                            courseList.push(course);

                            if(!ci.carrier.isIn) {
                                if(ci.doBringin) {
                                    kw.bringIn(ci.carrier, ci.stitchNumber, bringInArea.left, bringInArea.right);
                                    dropBringIn = ci;
                                } else {
                                    kw.bringIn(ci.carrier, ci.stitchNumber);
                                }
            
                                if(!numActiveCarriers) {
                                    //TODO: adapt function to being able to handle left-out neeldes or using either bed
                                    kw.castOn(ci.carrier, course.leftPos, course.leftPos + course.ops.length - 1, STITCHNUMBER_CASTON);
                                    ci.wasTuck = true;
                                    if(dropBringIn) {
                                        kw.dropBringIn();
                                        dropBringIn = null;
                                    }
                                }
            
                                numActiveCarriers++;
            
                                ci.carrier.isIn = true;

                                broughtIn = true;
                            }
    
                        }, this);

                        if(broughtIn && stitchNumberOverride !== undefined)
                            kw.setStitchNumber(stitchNumberOverride);

                        let ops = courseList[0].ops;
                        let l = courseList[0].leftPos;
                        //TODO: figure out which one to use here;
                        // for now, setting stitch number of first passed carrier
                        let stitchNumber = ciList[0].stitchNumber;
                        for(let i = 1; i < courseList.length; i++) {
                            if(ops !== courseList[i].ops) {
                                throw Error("ops for plating must not differ");
                            }
                            if(l != courseList[i].leftPos) {
                                throw Error("courses must be aligned for plating");
                            }
                        }

                        if(ops.length) {

                            let r = l + ops.length - 1;
                            let center = (l + r) / 2;
    
                            //TODO: figure out what to do here;
                            // for now, deciding on position of first passed carrier
                            dir = (ciList[0].carrier.pos < center ? RIGHT : LEFT);
                            let start = (dir === RIGHT ? l : r);
                            let end = start + ops.length * dir;
                            let n = start;
                            let i = (dir === RIGHT ? 0 : ops.length - 1);
    
                            if(stitchNumberOverride === undefined)
                                kw.setStitchNumber(stitchNumber);
    
                            let c = [];
                            ciList.forEach( ci => { c.push(ci.carrier); } );

                            let wasKnit = false;
                            let wasTuck = false;

                            while(n !== end) {

                                switch (ops[i]) {
                                    case '.':
                                        //nop --> do nothing
                                        break;
                                    case 'k':
                                        kw.knit(dir, 'f', n, c);
                                        wasKnit = true;
                                        break;
                                    case 'K':
                                        kw.knit(dir, 'b', n, c);
                                        wasKnit = true;
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
                                        wasKnit = true;
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
                                        wasTuck = true;
                                        break;
                                    case 't':
                                        kw.tuck(dir, 'f', n, c);
                                        wasTuck = true;
                                        break;
                                    case 'T':
                                        kw.tuck(dir, 'b', n, c);
                                        wasTuck = true;
                                        break;
                                    case '-':
                                        kw.miss(dir, 'f', n, c);
                                        break;
                                    case '_':
                                        kw.miss(dir, 'b', n, c);
                                        break;
                                    case 'y':
                                        //TODO: calculate opposite needle from current racking?
                                        //TODO: correct racking if not integral number and reset after all splits were done (or just warn?)
                                        kw.split(dir, 'f', n, n, c);
                                        break;
                                    case 'Y':
                                        //TODO: calculate opposite needle from current racking?
                                        //TODO: correct racking if not integral number and reset after all splits were done (or just warn?)
                                        kw.split(dir, 'b', n, n, c);
                                        break;
                                    case 'x':
                                        if(dir === LEFT) {
                                            kw.tuck(dir, 'b', n, c);
                                            kw.knit(dir, 'f', n, c);
                                        } else {
                                            kw.knit(dir, 'f', n, c);
                                            kw.tuck(dir, 'b', n, c);
                                        }
                                        wasKnit = true;
                                        wasTuck = true;
                                        break;
                                    case 'X':
                                        if(dir === LEFT) {
                                            kw.knit(dir, 'b', n, c);
                                            kw.tuck(dir, 'f', n, c);
                                        } else {
                                            kw.tuck(dir, 'f', n, c);
                                            kw.knit(dir, 'b', n, c);
                                        }
                                        wasKnit = true;
                                        wasTuck = true;
                                        break;
                                    default:
                                        console.warn("WARNING: unknown needle operation '" + course.ops[i] + "'");
                                        break;
                                }
    
                                n += dir;
                                i += dir;
                            }

                            ciList.forEach( ci => 
                                {
                                    if(wasKnit)
                                        ci.wasKnit = true;
                                    if(wasTuck)
                                        ci.wasTuck = true;
                                        
                                    if(ci.carrier.isHookReleased === false) {
                                        kw.comment("bringin was skipped for carrier " + ci.carrier.name + ", releasing hook after first course");
                                        kw.releasehook(ci.carrier);
                                    }
                                }, this );
                        }

                        for(let i = 0; i < ciList.length; i++)
                        {
                            let m = mList[i];
                            let ci = ciList[i];

                            ci.wasInUse = true;
                            ci.courseCntr++;

                            if(ci.courseCntr === m.courses.length) {

                                if(numActiveCarriers === 1) {
                                    //TODO: replace this with leftmost and rightmost needles actually holding loops
                                    kw.castOff(ci.carrier, leftmost, rightmost, STITCHNUMBER_CASTOFF);
                                } else {
                                    kw.outhook(ci.carrier);
                                }
        
                                numActiveCarriers--;
        
                                ci.carrier.isIn = false;
                            }
                        }
                    }

                    if(dropBringIn && dir === RIGHT) {
                        if(dropBringIn.wasKnit || dropBringIn.wasTuck) {
                            kw.dropBringIn();
                            dropBringIn = null;
                        }
                    }

                    break;
                case 'd': //drop
                    let dr = drops[dropCntr];
                    
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
                    //TODO: correct racking if not integral number and reset after all transferse were done (or just warn?)
                    let tf = transfers[transferCntr];
                    for(let i = 0; i < tf.srcNeedles.length; i++) {
                        kw.xfer(arg, tf.srcNeedles[i], tf.dstNeedles[i]);
                    }
                    transferCntr++;
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
                case 'sn': //override stitch number (or clear stitch number override) from here on
                    if(arg === "clear")
                        stitchNumberOverride = undefined;
                    else {
                        stitchNumberOverride = parseInt(arg);
                        kw.setStitchNumber(stitchNumberOverride);
                    }
                    break;
                default:
                    throw Error("unrecognized command '" + cmd + "'" );
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
