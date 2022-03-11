#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Media Interaction Lab
 *  Licensed under the MIT License. See LICENSE file in the package root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

const { KnitoutWrapper, LEFT, RIGHT, NODIR, SWG, SINTRAL, backendToString } = require('./knitoutWrapper.js');

const FRONT = 0x01;
const BACK  = 0x02;

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

var dirToString = function(dir) {
    if(dir === LEFT)
        return "<-";
    else if(dir === RIGHT)
        return "->";
    else if(dir === NODIR)
        return "<>";
    return "??";
}

var createDrops = function() {
    return {
        left: 0,
        ops: ''
    }
}

var createTransfers = function() {
    return {
        left: 0,
        ops: ''
    }
}

var parseCommand = function(command) {
    let p0 = 0;
    let p1 = command.indexOf('|', p0);

    let cmd = command.substring(p0, p1);

    p0 = p1 + 1;
    p1 = command.length;
    
    let arg = command.substring(p0, p1);

    return {cmd, arg};
}

var sndToString = function(snd) {
    let ret = '';
    snd.forEach( s => {
        ret += (s == 0 ? ' ' : '^');
    });
    return ret;
}

const FIXATION_DISTANCE = 2;
const FIXATION_WALES = 6;

const STITCHNUMBER_CASTON  = 2;
const STITCHNUMBER_CASTOFF = 3;

const CHAINLOOPS_CASTOFF = 3;

var KnitSequence = function() {

    let prevYarn = null;
    let alltimeLeftmost = Infinity;
    let alltimeRightmost = -Infinity;

    let maps = {};
    let drops = [];
    let transfers = [];

    let castonYarn = undefined;

    /**
     * operations reference
     *  n   needle operations (knit, tuck, miss, etc.)
     *  d   drop loops
     *  x   needle transfer
     *  r   rack
     *  s   set stitch setting
     *  c   insert comment
     *  p   pause machine
    */
    let commands = [];

    //TODO: monitor status of needles;
    //let needles[]...
    let currentRacking = 0;

    /**
     * 
     * @param {String} b0 source bed identifier ('b' or 'f')
     * @param {*} n0 source needle index or array of source needle indices
     * @param {*} n1 destination needle index or array of destination needle indices (optional if n1 should equal n0)
     */
    var deprecatedTransfer = function(b0, n0, n1) {

        let x = (b0 === 'b' ? 'X' : b0 === 'f' ? 'x' : undefined);
        if(x === undefined)
            throw Error("invalid source bed for (deprecated) transfer: '" + b0 + "'");

        if(Array.isArray(n0))
            n0.forEach(assertInteger);
        else
            assertInteger(n0);

        if(n1 === undefined || n1 === 0) {
            n1 = n0;
        } else {
            if(Array.isArray(n1))
                n1.forEach(assertInteger);
            else
                assertInteger(n1);
        }

        if(Array.isArray(n0) ^ Array.isArray(n1)) {
            throw Error("either none or both arguments need to be arrays");
        }

        if(Array.isArray(n0)) {
            if(n0.length !== n1.length) {
                throw Error("needle count of 'n0' and 'n1' must match up");
            }

            if(n0.length) {
                let nMin = n0[0];
                let nMax = n0[0];
                for(let i = 0; i < n0.length; i++) {
                    if(n0[i] !== n1[i])
                        throw Error("new-style transfer does not longer support transfer of non-opposing needles!"); //NOTE: in fact, old ones also didn't, but it was planned to auto-rack accordingly, at some point.

                    if(n0[i] < nMin)
                        nMin = n0[i];
                    if(n0[i] > nMax)
                        nMax = n0[i];
                }

                let len = nMax - nMin + 1;
                let repeat = '.'.repeat(len);
                for(let i = 0; i < n0.length; i++) {
                    repeat = repeat.substr(0, i) + x + repeat.substr(i + 1);
                }
                console.log("XFER REPEAT: '" + repeat + "'");
                this.transferAt(nMin - 1, repeat);
            }
        } else {
            if(n0 !== n1)
                throw Error("new-style transfer does not longer support transfer of non-opposing needles!"); //NOTE: in fact, old ones also didn't, but it was planned to auto-rack accordingly, at some point.
            this.transferAt(n0 - 1, x);
        }
    }.bind(this);


    /**
     * 
     * @param {*} y yarn instance or array
     */
    var prepare = function(id) {

        if(id in maps)
            throw Error( "yarn with name '" + id + "' already created");
        
        let createMap = function() {
            return {
                name: id,
                leftPos: Infinity,
                rightPos: -Infinity,
                courses: [],
                isInUse: false,
                carrierPos: undefined,

                // will be defined on-demand:
                carrierID: undefined,
                fix: undefined,
                stitchNumber: undefined,
                speedNumber: undefined
            };
        };

        let m = createMap();
        maps[id] = m;

        return m;

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
                let m = maps[ys[i]];
                let cs = m.courses;
                if(cs.length) {

                    let c = cs[cs.length - 1];
                    //if at least one course was already written, set carrier position to where it's 
                    // supposed to be after knitting this course
                    if(c.ops.length) {
                        c.dir = decideDir(c, m.carrierPos);

                        if(c.dir !== NODIR) {
                            let {first, last} = findBounds(c.ops);

                            //TODO: add racking value if back bed needle
                            //TODO: figure out if 0.5 is a reasonable value to add
                            m.carrierPos = (c.dir === LEFT ? c.leftPos + first : c.leftPos + last) + c.dir * 0.5;
                        }
                    }
                }
                prevYarn = null;
            }
        }
    }.bind(this);

    var assertInteger = function(n) {
        if(!Number.isInteger(n))
            throw Error("invalid argument : " + n + " (expected integer)");
    }

    var assertPositiveInteger = function(n) {
        if(!Number.isInteger(n) || n < 0)
            throw Error("invalid argument : " + n + " (expected positive integer)");
    }

    var assertPositiveNonZeroInteger = function(n) {
        if(!Number.isInteger(n) || n <= 0)
            throw Error("invalid argument : " + n + " (expected positive non-zero integer)");
    }

    var validateKnitRepeat = function(r) {
        if(/[^.kKbBtTxX\-_yY]+/.test(r))
            throw Error("repeat '" + r + "'" + " contains invalid needle command(s)");
    }

    var validateDropRepeat = function(r) {
        if(/[^.dDa]+/.test(r))
            throw Error("repeat '" + r + "'" + " contains invalid drop command(s)");
    }

    var validateTransferRepeat = function(r) {
        if(/[^.xXsSrR]+/.test(r))
            throw Error("repeat '" + r + "'" + " contains invalid transfer command(s)");
    }

    var validate2ndStitchRepeat = function(r) {
        if(/[^.2]+/.test(r))
            throw Error("repeat '" + r + "'" + " contains invalid 2nd stitch command(s)");
    }

    var findBounds = function(ops) {
        let first = undefined;
        let last = undefined;
        for(let i = 0; i < ops.length; i++) {
            if(ops[i] !== '.') {
                if(first === undefined)
                    first = i;
                last = i;
            }
        }
    
        return {first: first, last: last };
    }

    var decideDir = function(course, carrierPos) {

        //if undefined, carrier was not used before -> assume carrier is coming from right
        if(carrierPos === undefined)
            return LEFT;

        let {first, last} = findBounds(course.ops);

        if(first === undefined) //course does not contain any needle operations -> no decision
            return NODIR;

        let center = course.leftPos + (first + last) / 2;

        return (carrierPos < center ? RIGHT : LEFT);
    }


    /**
     * 
     * @param {String} id yarn descriptor
     * @returns instance of yarn
     */
    this.makeYarn = function(id) {
        if(id.indexOf('|') != -1) {
            throw Error("yarn id must not contain '|'");
        }

        let m = prepare(id);

        return { 
            id:id,
            info:m
        };
    }
    
    /**
     * creates new course, i.e. a 'newline' in the pattern description
     * @param {*} yarn yarn instance or array
     * @param {Number} offset optional course-directional offset relative to to needle #1
     */
    this.newCourse = function(yarn, offset = 0) {
        assertInteger(offset);

        finishUp();

        let createCourse = function(l) {
            return {
                leftPos: l,
                ops: '',
                snd: [],    //TODO: create this on-demand only
                dir: undefined
            };
        };

        if(Array.isArray(yarn)) {
           yarn.forEach( y => {
                if(!(y.id in maps))
                    throw Error("yarn + '" + y.id + "' not known -- call makeYarn to create it");
            
                if(!castonYarn) {
                    //first yarn is caston-yarn, will start from left by definition
                    castonYarn = y;
                    let m = maps[y.id];
                    m.carrierPos = 0;
                }
           });

            let idList = [];
            yarn.forEach( y => { idList.push(y.id); });
            commands.push("n|" + idList.join('|'));

            setYarn(yarn);
            yarn.forEach( y => 
                { 
                    let m = maps[y.id];
                    m.courses.push(createCourse(offset + 1));
                    m.isInUse = true;
                }, this);

            return;
        }

        if(!(yarn.id in maps))
            throw Error("yarn + '" + yarn.id + "' not known -- call makeYarn to create it");

        if(!castonYarn) {
            //first yarn is caston-yarn, will start from left by definition
            castonYarn = yarn;
            let m = maps[yarn.id];
            m.carrierPos = 0;
        }

        commands.push("n|" + yarn.id);
        setYarn(yarn);

        let m = maps[yarn.id];
        m.courses.push(createCourse(offset + 1));
        m.isInUse = true;
    }

    /**
     * insert comment into generated knitout
     * @param {String} msg 
     */
    this.comment = function(msg) {
        commands.push("c|" + msg);
    }

    /**
     * 
     * @param {String} comment optional comment
     */
    this.pause = function(comment = undefined) {
        commands.push("p|" + (comment === undefined ? "" : comment));
    }

    let insertInternal = function(yarn, repeat, needleCount, repeatOffset, repeat2ndStitch, nr2ndStitch) {
        let m = maps[yarn.id];
        let len = m.courses.length;
        if(!len) {
            throw Error("pattern for yarn " + yarn.id + " must have at least one course");
        }
    
        if(!repeat.length) {
            throw Error("no pattern repeat specified");
        }

        if(repeatOffset < 0) {
            //transform negative offsets to positive values
            repeatOffset = repeat.length - (Math.abs(repeatOffset) % repeat.length);
        }
    
        let ops = '';
        let snd = [];
        for(let i = 0; i < needleCount; i++) {
            ops += repeat[(i + repeatOffset) % repeat.length];
            snd.push(repeat2ndStitch[(i + repeatOffset) % repeat2ndStitch.length] == '2' ? nr2ndStitch : 0);
        }
    
        let course = m.courses[len - 1];
        course.ops += ops;
        course.snd = course.snd.concat(snd);

        m.leftPos = Math.min(m.leftPos, course.leftPos);
        m.rightPos = Math.max(m.rightPos, course.leftPos + course.ops.length - 1);

        alltimeLeftmost = Math.min(alltimeLeftmost, m.leftPos);
        alltimeRightmost = Math.max(alltimeRightmost, m.rightPos);
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
     *      'x' knit front + tuck back
     *      'X' tuck front + knit back
     *      '-' explicit miss front
     *      '_' explicit miss back
     *      'y' split front to back
     *      'Y' split back to front
     * @param {Number} needleCount number of needle indices to be used. length of repeat is used if needleCount is
     * not specified.
     * @param {Number} repeatOffset optional offset for indexing repeat, for realizing patterns that are offset with 
     * each new course, e.g. by passing a counter. Specifying 0 will start filling with first repeat operation for 
     * first needle, specifying 2 will start with 3rd, and so on.
     * @param {String} repeat2ndStitch char-encoded definition of which needles use 2nd stitch feature
     *      * specifiers
     *      '.' stitch as usual, with carrier-associated stitch number (or stitchnumber override, if set)
     *      '2' use 2nd stitch for corresponding needle
     * @param {Number} nr2ndStitch stitch number used for 2nd stitch loops
     */
    this.insert = function(yarn, repeat, needleCount, repeatOffset = 0, repeat2ndStitch = undefined, nr2ndStitch = undefined) {

        if(!prevYarn) {
            throw Error("previous yarn not set, forgot to call newCourse?");
        }

        if(!repeat.length) {
            console.warn("WARNING: empty repeat pattern passed");
            return;
        }

        if(needleCount === undefined)
            needleCount = repeat.length;
        if(repeat2ndStitch === undefined)
            repeat2ndStitch = '.'.repeat(repeat.length);
        else{
            if(!repeat2ndStitch.length) {
                console.warn("WARNING: empty repeat pattern passed for 2nd stitch");
                repeat2ndStitch = '.'.repeat(repeat.length);
            }
            assertPositiveNonZeroInteger(nr2ndStitch);
        }

        assertInteger(needleCount);
        assertInteger(repeatOffset);

        validateKnitRepeat(repeat);
        validate2ndStitchRepeat(repeat2ndStitch);

        if(Array.isArray(yarn)) {

            yarn.forEach( y => {
                //prepare(y);
                if(!(y.id in maps))
                    throw Error("yarn + '" + y.id + "' not known -- call makeYarn to create it");
            }, this);

            //TODO: compare arrays by content
            if(yarnChanged(yarn)) {
                throw Error("yarn changed, forgot to call newCourse?");
            }

            yarn.forEach( y => {
                insertInternal(y, repeat, needleCount, repeatOffset, repeat2ndStitch, nr2ndStitch);
            }, this);

            return;
        }

        if(!(yarn.id in maps))
            throw Error("yarn + '" + yarn.id + "' not known -- call makeYarn to create it");

        if(yarnChanged(yarn)) {
            throw Error("yarn changed, forgot to call newCourse?");
        }

        insertInternal(yarn, repeat, needleCount, repeatOffset, repeat2ndStitch, nr2ndStitch);
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
        currentRacking = racking;
    }

    this.getRacking = function() {
        return currentRacking;
    }

    this.getAlltimeLeftmost = function() {
        return alltimeLeftmost;
    }

    this.getAlltimeRightmost = function() {
        return alltimeRightmost;
    }

    /**
     * 
     * @param {String} repeat char-encoded drop pattern repeat. supported commands:
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
        if(needleCount === undefined)
            needleCount = repeat.length;

        assertInteger(needleCount);

        this.dropAt(0, repeat, needleCount, repeatOffset);
    }

    /**
     * 
     * @param {Number} needleOffset right-shift repeat by this offset. pass 0 to align first drop command to needle #1
     * @param {String} repeat char-encoded drop pattern repeat. supported commands:
     *      '.' nop
     *      'd' drop front
     *      'D' drop back
     *      'a' drop all (front + back)
     * @param {Number} needleCount number of needle indices to be used. length of repeat is used if needleCount is
     * not specified.
     * @param {Number} repeatOffset optional offset for indexing repeat, for realizing patterns that are offset with 
     * each new course, e.g. by passing a counter. Specifying 0 will start filling with first repeat operation for 
     * first needle, specifying 2 will start with 3rd, and so on.
     */
     this.dropAt = function(needleOffset, repeat, needleCount, repeatOffset = 0) {

        if(!repeat.length) {
            throw Error("invalid repeat pattern passed: " + repeat);
        }

        if(needleCount === undefined)
            needleCount = repeat.length;

        assertInteger(needleOffset);
        assertInteger(needleCount);
        assertInteger(repeatOffset);

        validateDropRepeat(repeat);

        //have to finish up current course, make sure we're not continuing on 
        // the same course because drop command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();

        commands.push("d|" + drops.length);
        let dr = createDrops();

        dr.left = needleOffset + 1;
        for(let i = 0; i < needleCount; i++) {
            dr.ops += repeat[(i + repeatOffset) % repeat.length];
        }

        drops.push(dr);
    }

    /**
     * 
     * @param {String} repeat char-encoded transfer pattern repeat. supported commands:
     *      '.' nop
     *      'x' transfer front-to-back
     *      'X' transfer back-to-front
     *      's' transfer front-to-backslider
     *      'S' transfer back-to-frontslider
     *      'r' transfer frontslider-to-back
     *      'R' transfer backslider-to-front
     * @param {Number} needleCount number of needle indices to be used
     * @param {Number} repeatOffset optional offset for indexing repeat, for realizing patterns that are offset with 
     * each new course, e.g. by passing a counter. Specifying 0 will start filling with first repeat operation for 
     * first needle, specifying 2 will start with 3rd, and so on.
     */
    this.transfer = function(repeat, needleCount, repeatOffset = 0) {

        if(repeat.includes('f') || repeat.includes('b')) {
            //throw Error("old transfer function using arrays no longer supported!");
            console.warn("WARNING: old transfer function using arrays deprecated!")
            deprecatedTransfer(repeat, needleCount, repeatOffset);
            return;
        }

        if(needleCount === undefined)
            needleCount = repeat.length;

        assertInteger(needleCount);

        this.transferAt(0, repeat, needleCount, repeatOffset);
    }

    this.transferAt = function(needleOffset, repeat, needleCount, repeatOffset = 0) {

        if(!repeat.length) {
            throw Error("invalid repeat pattern passed: " + repeat);
        }

        if(needleCount === undefined)
            needleCount = repeat.length;

        assertInteger(needleOffset);
        assertInteger(needleCount);
        assertInteger(repeatOffset);

        validateTransferRepeat(repeat);

        //have to finish up current course, make sure we're not continuing on 
        // the same course because drop command would come after current 
        // needle command and transfer would come after next call of newCourse
        finishUp();

        commands.push("x|" + transfers.length);
        let tr = createTransfers();

        tr.left = needleOffset + 1;
        for(let i = 0; i < needleCount; i++) {
            tr.ops += repeat[(i + repeatOffset) % repeat.length];
        }

        transfers.push(tr);
    }

    /**
     * Overrides the 
     * @param {Number} index index into machine stitch number table
     */
    this.stitchNumberOverride = function(index) {
        assertInteger(index);

        //have to finish up current course, make sure we're not continuing on 
        // the same course because stitch number command would come after current 
        // needle command and new setting would have first effect on next call of 
        // newCourse, which could be confusing -- better force an error instead
        finishUp();

        commands.push("sn|" + index);
    }

    this.clearStitchNumberOverride = function() {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because stitch number command would come after current 
        // needle command and new setting would have first effect on next call of 
        // newCourse, which could be confusing -- better force an error instead
        finishUp();

        commands.push("sn|clear");
    }

    this.cut = function(yarn) {
        //have to finish up current course, make sure we're not continuing on 
        // the same course because cut command would come after current 
        // needle command
        finishUp();

        if(Array.isArray(yarn)) {
            yarn.forEach( y => {
                if(!y.id) {
                    throw Error("no valid yarn passed");
                }
                this.cut(y);
            }, this);
        } else {
            let m = maps[yarn.id];

            if(!m.isInUse)
                console.warn("WARNING: cutting yarn '" + yarn.id + "' which was not in use");

            m.carrierPos = undefined;
            m.isInUse = false;

            commands.push("ct|" + yarn.id);
        }
    }

    /**
     * 
     * @param {Number} offset 
     */
    this.shift = function(offset) {
        assertInteger(offset);

        finishUp();

        for(var id in maps) {
            let m = maps[id];

            for(let i = 0; i < m.courses.length; i++) {
                m.courses[i].leftPos += offset;
            }
            m.leftPos += offset;
            m.rightPos += offset;
        }
        alltimeLeftmost += offset;
        alltimeRightmost += offset;

        drops.forEach(dr => {
            dr.left += offset;
        });

        transfers.forEach(tf => {
            tf.left += offset;
        });
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
                let d = dirToString(course.dir);
                console.log(d + ' '.repeat(mw - cw) + cs + ": " + ' '.repeat(course.leftPos - 1) + course.ops + " (" + course.leftPos + " - " + (course.leftPos + course.ops.length - 1) + ")");

                let snd = 0;
                course.snd.forEach( s => {
                    if(s) {
                        if(snd !== 0 && snd !== s)
                            console.warn("WARNING: multiple 2nd stitch values in row, this is not supported by Shima KnitPaint");
                        snd = s;
                    }
                });
                if(snd !== 0) {
                    let snds = snd.toString();
                    let sw = snds.length;
                    console.log(' '.repeat(d.length + mw - sw - 1) + snds + " @ " + ' '.repeat(course.leftPos - 1) + sndToString(course.snd));
                }
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
        console.log("knit pattern range: " + alltimeLeftmost + " - " + alltimeRightmost);
        for(var id in maps) {
            printMapInternal(maps[id]);
        }
    }

    /**
     * 
     */
    this.printOrder = function() {
        let s = '';
        commands.forEach((item, i) => { s += (i + 1 ) + ": " + item + ", "; });
        console.log("order (" + commands.length + "): " + s );
    }

    /**
     * 
     */
    this.printSequence = function() {

        var maxIdLen = 0;
        var maxCourseLen = 0;
        var courseCntr = {};

        for(var key in maps) {
            courseCntr[key] = 0;
            maxIdLen = Math.max(key.length, maxIdLen);
            maxCourseLen = Math.max(maps[key].courses.length, maxCourseLen);
        }

        var carrierCounter = 0;

        let coul = String(maxCourseLen).length;
        let coml = String(commands.length).length;

        if(String.prototype.replaceAll === undefined)
            String.prototype.replaceAll = function(searchValue, replaceValue) { return this.split(searchValue).join(replaceValue); }

        commands.forEach(function(command) {

            let {cmd, arg} = parseCommand(command);
            
            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    carrierCounter++;

                    let ys = arg.split('|');
                    if(!ys.length) {
                        console.error("ERROR: no yarn IDs found in arg");
                        return;
                    }

                    if(ys.length === 1) {
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
                        
                        let d = dirToString(course.dir);
                        console.log('N:  ' + ' '.repeat(coml - il) + (carrierCounter) + ': ' + ' '.repeat(maxIdLen - y.length) + y  + ' ' + d + ' ' + ' '.repeat(coul - cl) + '(' + (courseNr + 1) + '): ' +  ' '.repeat(course.leftPos - 1) + course.ops);

                        //print 2nd stitch hints
                        let snd = 0;
                        course.snd.forEach( s => {
                            if(s) {
                                if(snd !== 0 && snd !== s)
                                    console.warn("WARNING: multiple 2nd stitch values in row, this is not supported by Shima KnitPaint");
                                snd = s;
                            }
                        });
                        if(snd !== 0) {
                            let snds = snd.toString();
                            let sw = snds.length;
                            console.log(' '.repeat(coml + maxIdLen + d.length + coul - sw + 3) + '<2nd> ' + snds + ' @' +  ' '.repeat(course.leftPos) + sndToString(course.snd));
                        }

                        courseCntr[y]++;
                    } else {

                        //NOTE: for plating, we do everything according to 1st yarn's pattern, just like in generate()
                        let m = maps[ys[0]];
                        if(!m) {
                            console.error("ERROR: map '" + y + "' not found in pattern" );
                            return;
                        }

                        let courseNr = courseCntr[ys[0]];
                        let course = m.courses[courseNr];

                        ys.forEach(function(y, i, arr) {

                            //doublecheck:
                            let temp = maps[y].courses[courseCntr[y]];
                            if(temp.leftPos !== course.leftPos || temp.ops !== course.ops) {
                                throw Error("plated courses differ between '" + y + "' and '" + ys[0] + "' (" 
                                    + temp.leftPos + dirToString(temp.dir) + temp.ops + " vs. "
                                    + course.leftPos + dirToString(course.dir) + course.ops + ")");
                            }
    
                            let d = dirToString(course.dir);

                            let il = String(carrierCounter).length;
                            let cl = String(courseNr + 1).length;

                            let str = "";

                            if(i === 0)
                                str += 'N:  ' + ' '.repeat(coml - il) + (carrierCounter) + ': ';
                            else
                                str += '    ' + ' '.repeat(coml) + '  ';
                            str +=  ' '.repeat(maxIdLen - y.length) + y + ' ' + d + ' ' + ' '.repeat(coul - cl) + '(' + (courseNr + 1) + ')';

                            if(i === arr.length - 1)
                                str += ': ' + ' '.repeat(course.leftPos - 1) + course.ops;
                            else
                                str += ' ↴';

                            console.log(str);

                            courseCntr[y]++;
                        }, this);

                        //print 2nd stitch hints
                        let snd = 0;
                        course.snd.forEach( s => {
                            if(s) {
                                if(snd !== 0 && snd !== s)
                                    console.warn("WARNING: multiple 2nd stitch values in row, this is not supported by Shima KnitPaint");
                                snd = s;
                            }
                        });
                        if(snd !== 0) {
                            let snds = snd.toString();
                            let sw = snds.length;
                            console.log(' '.repeat(coml + maxIdLen + dirToString(NODIR).length + coul - sw + 3) + '<2nd> ' + snds + ' @' +  ' '.repeat(course.leftPos) + sndToString(course.snd));
                        }
                    }
                    break;
                case 'd': //drop
                    let dr = drops[arg];
                    if(!dr)
                        throw Error("drops " + arg + " not found");

                    console.log('D:     ' + ' '.repeat(coml + maxIdLen + coul + dr.left + 6) + dr.ops);
                    break;
                case 'x': //needle transfer
                    let tr = transfers[arg];
                    if(!tr)
                        throw Error("transfers " + arg + " not found");

                    console.log('X:     ' + ' '.repeat(coml + maxIdLen + coul + tr.left + 6) + tr.ops.replaceAll('x', '↑').replaceAll('X', '↓'));
                    break;
                case 'r': //rack
                    console.log('R:  ' + (arg < 0 ? '<< ' + (-arg) : '>> ' + arg));
                    break;
                case 's': //set stitch setting
                    //TODO
                    break;
                case 'ct':
                    console.log('CT: ' + ' '.repeat(coml + 2 + maxIdLen - arg.length) + arg + ' '.repeat(coul + 8) + '✁');
                    break;
                case 'c': //insert comment
                    console.log('C:  "' + arg + '"');
                    break;
                case 'p': //pause machine
                    if(arg !== undefined)
                        console.log('PAUSE with comment "' + arg + '"');
                    else
                        console.log('PAUSE');
                    break;
                case 'sn': //override stitch number (or clear stitch number override) from here on
                    console.log('SN:    ' + arg);
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + cmd + "'" );
            }
        }, this);
    }

    /**
     * 
     * @param {*} yarn instance of yarn object to be mapped to a carrier
     * @param {Number} carrierID ID of carrier to map to (e.g. 1 to 10 for Shima)
     * @param {Boolean} fix set false to skip knitting fixation-field (defaults to true)
     * @param {Number} speedNumber optional speed number associated with this yarn carrier
     * @param {Number} stitchNumber optional stitch number associated with this yarn carrier; is set to (carrierID + 10) if not specified otherwise
     */
    this.mapYarn = function(yarn, carrierID, fix = true, speedNumber = undefined, stitchNumber = undefined) {
        assertInteger(carrierID);

        for(var key in maps) {
            let m = maps[key];
            if(m.carrierID == carrierID)
                throw Error("carrier ID " + carrierID + " already in use for yarn '" + m.name + "'");
        }
    
        let m = maps[yarn.id];
        if(!m) {
            console.warn("WARNING: yarn '" + yarn.id + "' is unknown at this point (maybe yarn never used?) -- mapping has no effect.");
            return;
        }

        m.carrierID = carrierID;
        m.fix = fix;
        m.stitchNumber = (stitchNumber ? stitchNumber : carrierID + 10);
        m.speedNumber = speedNumber;
    }

    /**
     * 
     * @param {String} outFileName 
     * @param {String} desc 
     * @param {String} position
     * @param {*} machine 
     * @param {Boolean} autoRack
     * @param {Boolean} halfGauge
     * @param {Boolean} castOff
     * @param {Number} backend
     * @param {Number} castonBeds
     * @param {Boolean} tube
     */
    this.generate = function(outFileName, desc = "", position = undefined, machine = undefined, autoRack = undefined, halfGauge = undefined, castOff = undefined, backend = undefined, castonBeds = undefined, tube = undefined, castoffBeds = undefined) {

        finishUp();

        if(!commands.length) {
            console.warn("WARNING: no commands found, nothing to generate");
            return;
        }

        for(let i = 0; i < commands.length; i++) {
            let {cmd, arg} = parseCommand(commands[i]);
            if(cmd === 'n')
                break;
            if(cmd === 'x') //NOTE: xfer commands will be written before cast-on!
                console.warn("WARNING: needle operation commands should precede transfer! (otherwise, there's nothing to transfer)!");
        }

        //set default values if not specified otherwise
        if(position === undefined)
            position = "Keep"
        if(autoRack === undefined)
            autoRack = true;
        if(halfGauge === undefined)
            halfGauge = false;
        if(castOff === undefined)
            castOff = true;
        if(tube === undefined)
            tube = false;
        //TODO: maybe better to derive backend from machine somehow?
        if(backend === undefined)
            backend = SWG;

        console.log("creating knitout for backend '" + backendToString(backend) + "'");

        let kw = new KnitoutWrapper(backend);

        let fixationArea = {
            left: 0,
            right: 0
        }
        
        if(backend === SWG) {
            fixationArea.left = alltimeRightmost + FIXATION_DISTANCE;
            fixationArea.right = alltimeRightmost + FIXATION_DISTANCE + FIXATION_WALES;
        } else if(backend === SINTRAL) {
            fixationArea.left = 1;
            fixationArea.right = alltimeLeftmost - 1;
        } else {
            throw Error("fixation area not defined for backend '" + backendToString(backend) + "'");
        }

        //TODO: maybe find a way to infer the required beds from the knit?
        if(castonBeds === undefined)
            castonBeds = (tube ? FRONT | BACK : FRONT);
        if(tube && castonBeds !== (FRONT | BACK))
            console.warn("tube flag is set but not both beds are cast on -- flag will have no effect");

        //TODO: maybe find a way to infer the required beds from the knit?
        if(castoffBeds === undefined)
            castoffBeds = (tube ? FRONT | BACK : FRONT);
        if(tube && castoffBeds !== (FRONT | BACK))
            console.warn("tube flag is set but not both beds are cast off");

        let os = require('os');

        kw.initKnitout(machine, position, halfGauge);
        kw.comment("description: " + desc);

        let userInfo = os.userInfo();
        let host = os.hostname();
        var currentdate = new Date(); 
        kw.comment("generated " + currentdate.getDate().pad(2) + "/"
                + (currentdate.getMonth()+1).pad(2)  + "/" 
                + currentdate.getFullYear().pad(4) + " @ "  
                + currentdate.getHours().pad(2) + ":"  
                + currentdate.getMinutes().pad(2) + ":" 
                + currentdate.getSeconds().pad(2) + " by "
                + userInfo.username + " on "
                + host);

        let cInfo = {};
        for(var key in maps) {
            //let cm = carrierMapping[key];
            //if(!cm)
            //    throw new Error("mapping for carrier with name \'" + key + "' not found");
            let map = maps[key];
            if(!map.carrierID)
                throw Error("mapping for carrier \'" + key + "' not defined");
            
            let cids = map.carrierID.toString();
            if(backend === SINTRAL)
                cids = "L" + cids;

            cInfo[key] = {
                wasInUse: false,
                wasKnit: false,
                wasTuck: false,
                fix: map.fix,
                carrier: kw.machine.carriers[cids],
                stitchNumber: map.stitchNumber,
                speedNumber: map.speedNumber
            };            

            kw.comment("yarn '" + key + "' is mapped to carrier " + cInfo[key].carrier.name);
        }

        let fixatedCarrier = null;
        let numActiveCarriers = 0;

        let currentRacking = 0;
        let prevRacking = undefined;   //TODO: better make a stack out of this?
        kw.rack(currentRacking);

        let alignRacking = function(op) {
            let temp = Math.round(currentRacking);;

            if(temp !== currentRacking) {
                if(autoRack) {

                    console.log("NOTE: have to implicitly rack from " + currentRacking + " to " + temp + " to align for operation '" + op + "'");
                    kw.rack(temp);
                    prevRacking = temp;
                    
                } else {
                    console.warn("WARNING: operation '" + op + "' will fail with racking " + currentRacking + " when converted to DAT -- needles not aligned!");
                }
            }
        }

        let restoreRacking = function() {
            if(autoRack && prevRacking !== undefined) {
                console.log("NOTE: restoring racking to " + prevRacking);
                kw.rack(prevRacking);
                prevRacking = undefined;
            }
        }

        let stitchNumberOverride = undefined;

        let endOfKnit = function(id) {

            //TODO: check remaining knitting commands for a more informed decision here
            // but don't forget this also requires adaping the calling code in generate()!
            return (id >= commands.length);

            // for(var i = id; i < commands.length; i++) {
            //     let c = commands[i];
            //     if(containsKnittingCommand(c))
            //         return false;
            // }
            // return true;
        }

        commands.forEach(function(command, cidx) {

            let {cmd, arg} = parseCommand(command);

            switch (cmd) {
                case 'n': //needle operations (knit, tuck, miss, etc.)
                    let ys = arg.split('|');
                    if(!ys.length) {
                        throw Error("no yarn IDs found in arg");
                    }

                    let dir = NODIR;

                    if(ys.length === 1) {
                        let y = arg;

                        let m = maps[y];
                        if(!m) {
                            throw Error("map '" + y + "' not found in pattern" );
                        }
        
                        let ci = cInfo[y];
                        let course = m.courses[ci.carrier.courseCntr];
                        if(!course.ops.length)
                            console.warn("WARNING: course #" + ci.carrier.courseCntr + " of yarn " + ci.carrier.name + " is empty!");
        
                        if(!ci.carrier.isIn) {
                            if(ci.fix) {
                                kw.bringIn(ci.carrier, ci.stitchNumber, fixationArea.left, fixationArea.right);
                                fixatedCarrier = ci;
                            } else {
                                kw.bringIn(ci.carrier, ci.stitchNumber);
                            }

                            if(!numActiveCarriers) {
                                if(course.ops.length) {
                                    //TODO: adapt function to being able to handle left-out needles or using either bed
                                    // decide depending on bed usage of current course, but provide interface to user
                                    // to intervene in special cases
                                    // also, consider analyzing whole knit to decide what cast-on actually has to support
                                    // maybe we can infer from knit what beds we have cast on? and if it's supposed to be 
                                    // a tube or we should join both faces?
                                    let b = [];
                                    if(castonBeds & FRONT)
                                        b.push('f');
                                    if(castonBeds & BACK)
                                        b.push('b');
                                    kw.castOn(ci.carrier, course.leftPos, course.leftPos + course.ops.length - 1, STITCHNUMBER_CASTON, b, tube);

                                    ci.wasTuck = true;
                                    ci.wasKnit = true;
                                    if(fixatedCarrier) {
                                        kw.dropFixation();
                                        fixatedCarrier = null;
                                    } else {
                                        kw.comment("fixation was skipped for carrier " + ci.carrier.name + ", releasing hook after castOn");
                                        kw.releasehook(ci.carrier);
                                    }
                                } else {
                                    console.warn("WARNING: cast-on was skipped due to empty first course");
                                }
                            }

                            numActiveCarriers++;
                            ci.carrier.isIn = true;

                            if(stitchNumberOverride !== undefined)
                                kw.setStitchNumber(stitchNumberOverride);
                        }
    
                        let {first, last} = findBounds(course.ops);
                        let l = course.leftPos + first;
                        let r = course.leftPos + last;
                        dir = course.dir;
                        if(first !== undefined && dir !== NODIR) {

                            //TODO: remove this, it is redundant -> direction is now encoded into course
                            let start = (dir === RIGHT ? l : r);
                            let end = start + course.ops.length * dir;
                            let n = start;
                            let i = (dir === RIGHT ? 0 : course.ops.length - 1);
    
                            if(stitchNumberOverride === undefined)
                                kw.setStitchNumber(ci.stitchNumber);

                            if(ci.speedNumber !== undefined)
                                kw.setSpeedNumber(ci.speedNumber);
                            else
                                kw.setSpeedNumber(0);
    
                            let prevSnd = 0;
                            let stitchNr = kw.getStitchNumber();
                            let c = ci.carrier;
                            while(n !== end) {

                                //figure out if 2nd stitch is set for this needle
                                //workaround: set via setStitchNumber, since 2nd stitch is not yet supported in 
                                // knitout and consequently in knitout-to-dat converter
                                //TODO: implement this in knitout and knitout-to-dat converter and use it here so the 
                                // generated DAT is more compact (and there are no unnecessary carrier movements)
                                let snd = course.snd[i];
                                if(snd !== prevSnd) {
                                    kw.setStitchNumber(snd ? snd : stitchNr);
                                    prevSnd = snd;
                                }

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
                                        alignRacking('split (front)');
                                        kw.split(dir, 'f', n, n, c);
                                        restoreRacking();
                                        break;
                                    case 'Y':
                                        //TODO: calculate opposite needle from current racking?
                                        alignRacking('split(back)');
                                        kw.split(dir, 'b', n, n, c);
                                        restoreRacking();
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
                                        throw Error("unknown needle operation '" + course.ops[i] + "' in \"" + course.ops + "\" (" + i + ")");
                                }
    
                                n += dir;
                                i += dir;
                            }

                            //check if still set from 2nd stitch workaround and if so, reset accordingly
                            if(kw.getStitchNumber() !== stitchNr)
                                kw.setStitchNumber(stitchNr);
    
                            if(ci.carrier.isHookReleased === false) {
                                kw.comment("fixation was skipped for carrier " + ci.carrier.name + ", releasing hook after first course");
                                kw.releasehook(ci.carrier);
                            }
                        }
                        
                        ci.wasInUse = true;
                        ci.carrier.courseCntr++;
    
                        if(ci.carrier.courseCntr === m.courses.length) {

                            //TODO: fix this -- this is not actually a reliable indication of the knit
                            // reaching its end
                            //let isEndOfKnit = (numActiveCarriers === 1);
                            let isEndOfKnit = endOfKnit(cidx + 1);

                            if(isEndOfKnit) {
                                if(castOff) {
                                    let b = [];
                                    if(castoffBeds & FRONT)
                                        b.push('f');
                                    if(castoffBeds & BACK)
                                        b.push('b');

                                    let range = kw.getCurrentKnittingRange(b);
                                    if(range)
                                        kw.castOff(ci.carrier, range.l, range.r, STITCHNUMBER_CASTOFF, b, CHAINLOOPS_CASTOFF, tube);
                                } else {
                                    let yhh = kw.getYarnHoldingHooks();
                                    let yhs = kw.getYarnHoldingSliders();

                                    if(yhh.f.length > 0 || yhh.b.length > 0 || yhs.f.length > 0 || yhs.b.length > 0) {
                                        console.warn("hook(s) or slider(s) still holding loop(s)");
                                        if(yhh.f.length > 0 || yhh.b.length > 0)
                                            kw.printNeedleStatus();
                                        if(yhs.f.length > 0 || yhs.b.length > 0)
                                            kw.printSliderStatus();
                                        console.log("performing auto-drop of remaining loops");
                                        kw.comment("performing auto-drop of remaining loops");
                                    }

                                    kw.rack(0.25);
                                    //only dropping needles actually holding loops
                                    let mn = Math.min(...yhh.f.concat(yhh.b));
                                    let mx = Math.max(...yhh.f.concat(yhh.b));
                                    //TODO: this halfGauge stuff is not very well abstracted in knitoutWrapper -- fix this
                                    let div = (halfGauge ? 2 : 1);
                                    for(let i = mn; i <= mx; i++) {
                                        if(yhh.f.includes(i))
                                            kw.drop('f', i/div);
                                        if(yhh.b.includes(i))
                                            kw.drop('b', i/div);
                                    }
                                    kw.outhook(ci.carrier);
                                }
                            } else {
                                kw.outhook(ci.carrier);
                            }
    
                            numActiveCarriers--;
    
                            ci.carrier.isIn = false;
                        }

                        if(fixatedCarrier && dir === RIGHT) {
                            if(fixatedCarrier.wasKnit || fixatedCarrier.wasTuck) {
                                kw.dropFixation();
                                fixatedCarrier = null;
                            } else {
                                if(ci.carrier.isHookReleased === false) {
                                    kw.comment("fixation was skipped for carrier " + ci.carrier.name + ", releasing hook after castOn");
                                    kw.releasehook(ci.carrier);
                                }
                            }
                        }
                    } else {

                        let mList = [];
                        let ciList = [];
                        let courseList = [];

                        let broughtIn = false;

                        //TODO: clean up this horrible duplicate code passage
                        ys.forEach( function(y) {
                            let m = maps[y];
                            if(!m) {
                                throw Error("map '" + y + "' not found in pattern" );
                            }
            
                            let ci = cInfo[y];
                            let course = m.courses[ci.carrier.courseCntr];

                            mList.push(m);
                            ciList.push(ci);
                            courseList.push(course);

                            if(!ci.carrier.isIn) {
                                if(ci.fix) {
                                    kw.bringIn(ci.carrier, ci.stitchNumber, fixationArea.left, fixationArea.right);
                                    fixatedCarrier = ci;
                                } else {
                                    //TODO: if fixation area is skipped for plated yarns, the resulting script 
                                    // will try to use inhook for both carriers, which is not possible and will
                                    // cause errors in converter, or in APEX at the latest. E.g., in knitout:
                                    //     ;bringing in carrier with name "7"
                                    //     inhook 7
                                    //     ;bringin done
                                    //     ;bringing in carrier with name "6"
                                    //     inhook 6
                                    //     ;bringin done
                                    //     x-stitch-number 17
                                    //     tuck - f304 7 6
                                    //     tuck - b302 7 6
                                    //     tuck - f300 7 6
                                    //     tuck - b298 7 6
                                    //     ;fixation was skipped for carrier 7, releasing hook after first course
                                    //     releasehook 7
                                    //     ;fixation was skipped for carrier 6, releasing hook after first course
                                    //     releasehook 6
                                    // figure out how to handle this -- (or generate error and let user take 
                                    // care of this? actually, this is quite easy, e.g., considering the example
                                    // above: first do inhook 7, then tuck 4x with 7, then releasehook 7. then repeat
                                    // with carrier 6. from there on you can plate just as you'd like to.)
                                    kw.bringIn(ci.carrier, ci.stitchNumber);
                                }

                                if(!numActiveCarriers) {
                                    if(course.ops.length) {
                                        //TODO: adapt function to being able to handle left-out needles or using either bed
                                        // decide depending on bed usage of current course, but provide interface to user
                                        // to intervene in special cases
                                        // also, consider analyzing whole knit to decide what cast-on actually has to support
                                        // maybe we can infer from knit what beds we have cast on? and if it's supposed to be 
                                        // a tube or we should join both faces?
                                        let b = [];
                                        if(castonBeds & FRONT)
                                            b.push('f');
                                        if(castonBeds & BACK)
                                            b.push('b');
                                        kw.castOn(ci.carrier, course.leftPos, course.leftPos + course.ops.length - 1, STITCHNUMBER_CASTON, b, tube);
    
                                        ci.wasTuck = true;
                                        if(fixatedCarrier) {
                                            kw.dropFixation();
                                            fixatedCarrier = null;
                                        }
                                    } else {
                                        console.warn("WARNING: cast-on was skipped due to empty first course");
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
                        let {first, last} = findBounds(ops);
                        let l = courseList[0].leftPos + first;
                        let r = courseList[0].leftPos + last;
                        //TODO: figure out which one to use here;
                        // for now, setting stitch number of first passed carrier
                        let stitchNumber = ciList[0].stitchNumber;

                        dir = courseList[0].dir;

                        if(first !== undefined && dir !== NODIR) {

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

                            let prevSnd = 0;
                            let stitchNr = kw.getStitchNumber();
                            while(n !== end) {

                                //figure out if 2nd stitch is set for this needle
                                //workaround: set via setStitchNumber, since 2nd stitch is not yet supported in 
                                // knitout and consequently in knitout-to-dat converter
                                //TODO: implement this in knitout and knitout-to-dat converter and use it here so the 
                                // generated DAT is more compact (and there are no unnecessary carrier movements)
                                let snd = courseList[0].snd[i];
                                if(snd !== prevSnd) {
                                    kw.setStitchNumber(snd ? snd : stitchNr);
                                    prevSnd = snd;
                                }

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
                                        alignRacking('split (front)');
                                        kw.split(dir, 'f', n, n, c);
                                        restoreRacking();
                                        break;
                                    case 'Y':
                                        //TODO: calculate opposite needle from current racking?
                                        alignRacking('split (back)');
                                        kw.split(dir, 'b', n, n, c);
                                        restoreRacking();
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
                                        throw Error("unknown needle operation '" + ops[i] + "' in \"" + ops + "\" (" + i + ")");
                                        break;
                                }
    
                                n += dir;
                                i += dir;
                            }

                            //check if still set from 2nd stitch workaround and if so, reset accordingly
                            if(kw.getStitchNumber() !== stitchNr)
                                kw.setStitchNumber(stitchNr);

                            ciList.forEach( ci => 
                                {
                                    if(wasKnit)
                                        ci.wasKnit = true;
                                    if(wasTuck)
                                        ci.wasTuck = true;
                                        
                                    if(ci.carrier.isHookReleased === false) {
                                        kw.comment("fixation was skipped for carrier " + ci.carrier.name + ", releasing hook after first course");
                                        kw.releasehook(ci.carrier);
                                    }
                                }, this );
                        }

                        for(let i = 0; i < ciList.length; i++)
                        {
                            let m = mList[i];
                            let ci = ciList[i];

                            ci.wasInUse = true;
                            ci.carrier.courseCntr++;

                            if(ci.carrier.courseCntr === m.courses.length) {

                                //TODO: fix this -- this is not actually a reliable indication of the knit
                                // reaching its end
                                //let isEndOfKnit = (numActiveCarriers === 1);
                                let isEndOfKnit = endOfKnit(cidx + 1);

                                if(isEndOfKnit) {
                                    if(castOff) {
                                        let b = [];
                                        if(castoffBeds & FRONT)
                                            b.push('f');
                                        if(castoffBeds & BACK)
                                            b.push('b');

                                        let range = kw.getCurrentKnittingRange(b);
                                        if(range)
                                            kw.castOff(ci.carrier, range.l, range.r, STITCHNUMBER_CASTOFF, b, CHAINLOOPS_CASTOFF, tube);
                                    } else {
                                        let yhh = kw.getYarnHoldingHooks();
                                        let yhs = kw.getYarnHoldingSliders();
    
                                        if(yhh.f.length > 0 || yhh.b.length > 0 || yhs.f.length > 0 || yhs.b.length > 0) {
                                            console.warn("hook(s) or slider(s) still holding loop(s)");
                                            if(yhh.f.length > 0 || yhh.b.length > 0)
                                                kw.printNeedleStatus();
                                            if(yhs.f.length > 0 || yhs.b.length > 0)
                                                kw.printSliderStatus();
                                            console.log("performing auto-drop of remaining loops");
                                            kw.comment("performing auto-drop of remaining loops");
                                        }
    
                                        kw.rack(0.25);
                                        //only dropping needles actually holding loops
                                        let mn = Math.min(...yhh.f.concat(yhh.b));
                                        let mx = Math.max(...yhh.f.concat(yhh.b));
                                        //TODO: this halfGauge stuff is not very well abstracted in knitoutWrapper -- fix this
                                        let div = (halfGauge ? 2 : 1);
                                        for(let i = mn; i <= mx; i++) {
                                            if(yhh.f.includes(i))
                                                kw.drop('f', i/div);
                                            if(yhh.b.includes(i))
                                                kw.drop('b', i/div);
                                        }
                                        kw.outhook(ci.carrier);
                                    }
                                } else {
                                    kw.outhook(ci.carrier);
                                }
        
                                numActiveCarriers--;
        
                                ci.carrier.isIn = false;
                            }
                        }

                        if(fixatedCarrier && dir === RIGHT) {
                            if(fixatedCarrier.wasKnit || fixatedCarrier.wasTuck) {
                                kw.dropFixation();
                                fixatedCarrier = null;
                            } else {
                                ciList.forEach( ci => {
                                    if(ci.carrier.isHookReleased === false) {
                                        kw.comment("fixation was skipped for carrier " + ci.carrier.name + ", releasing hook after castOn");
                                        kw.releasehook(ci.carrier);
                                    }
                                });
                            }
                        }
                    }

                    break;
                case 'd': //drop
                    let dr = drops[arg];
                    if(!dr)
                        throw Error("drops " + arg + " not found");

                    let nd = dr.left;
                    for(let i = 0; i < dr.ops.length; i++, nd++) {

                        switch (dr.ops[i]) {
                            case '.':
                                //nop --> do nothing
                                break;
                            case 'd':
                                kw.drop('f', nd);
                                break;
                            case 'D':
                                kw.drop('b', nd);
                                break;
                            case 'a':
                                //TODO: not sure if order does matter when dropping?
                                kw.drop('f', nd);
                                kw.drop('b', nd);
                                break;
                            default:
                                console.warn("WARNING: invalid drop operation '" + dr.ops[i] + "'");
                                break;
                        }
                    }
                    break;
                case 'x': //needle transfer
                    let tr = transfers[arg];
                    if(!tr)
                        throw Error("transfers " + arg + " not found");

                    alignRacking('transfer');

                    let nt = tr.left;
                    for(let i = 0; i < tr.ops.length; i++, nt++) {
                        switch(tr.ops[i]) {
                            case '.':
                                //nop --> do nothing
                                break;
                            case 'x':
                                //transfer front-to-back
                                kw.xfer('f', nt, nt);
                                break;
                            case 'X':
                                //transfer back-to-front
                                kw.xfer('b', nt, nt);
                                break;
                            case 's':
                                //transfer front-to-backslider
                                kw.xfer('f', nt, nt, false, true);
                                break;
                            case 'S':
                                //transfer back-to-frontslider
                                kw.xfer('b', nt, nt, false, true);
                                break;
                            case 'r':
                                //transfer frontslider-to-back
                                kw.xfer('f', nt, nt, true, false);
                                break;
                            case 'R':
                                //transfer backslider-to-front
                                kw.xfer('b', nt, nt, true, false);
                                break;
                            default:
                                console.warn("WARNING: invalid transfer operation '" + tr.ops[i] + "'");
                                break;
                        }
                    }
                    restoreRacking();
                    break;
                case 'r': //rack
                    currentRacking = parseFloat(arg);
                    kw.rack(currentRacking);
                    break;
                case 's': //set stitch setting
                    //TODO
                    break;
                case 'ct': //cut yarn
                    let ci = cInfo[arg];

                    //check if it was already auto-cut
                    if(ci.carrier.isIn) {

                        //TODO: fix this -- this is not actually a reliable indication of the knit
                        // reaching its end
                        //let isEndOfKnit = (numActiveCarriers === 1);
                        let isEndOfKnit = endOfKnit(cidx + 1);

                        if(isEndOfKnit) {
                            if(castOff) {
                                let b = [];
                                if(castoffBeds & FRONT)
                                    b.push('f');
                                if(castoffBeds & BACK)
                                    b.push('b');

                                let range = kw.getCurrentKnittingRange(b);
                                if(range)
                                    kw.castOff(ci.carrier, range.l, range.r, STITCHNUMBER_CASTOFF, b, CHAINLOOPS_CASTOFF, tube);
                            } else {
                                let yhh = kw.getYarnHoldingHooks();
                                let yhs = kw.getYarnHoldingSliders();

                                if(yhh.f.length > 0 || yhh.b.length > 0 || yhs.f.length > 0 || yhs.b.length > 0) {
                                    console.warn("hook(s) or slider(s) still holding loop(s)");
                                    if(yhh.f.length > 0 || yhh.b.length > 0)
                                        kw.printNeedleStatus();
                                    if(yhs.f.length > 0 || yhs.b.length > 0)
                                        kw.printSliderStatus();
                                    console.log("performing auto-drop of remaining loops");
                                    kw.comment("performing auto-drop of remaining loops");
                                }

                                kw.rack(0.25);
                                //only dropping needles actually holding loops
                                let mn = Math.min(...yhh.f.concat(yhh.b));
                                let mx = Math.max(...yhh.f.concat(yhh.b));
                                //TODO: this halfGauge stuff is not very well abstracted in knitoutWrapper -- fix this
                                let div = (halfGauge ? 2 : 1);
                                for(let i = mn; i <= mx; i++) {
                                    if(yhh.f.includes(i))
                                        kw.drop('f', i/div);
                                    if(yhh.b.includes(i))
                                        kw.drop('b', i/div);
                                }
                                kw.outhook(ci.carrier);
                            }
                        } else {
                            kw.outhook(ci.carrier);
                        }

                        numActiveCarriers--;

                        ci.carrier.isIn = false;
                    }

                    break;
                case 'c': //insert comment
                    kw.comment(arg);
                    break;
                case 'p': //pause machine
                    console.log("PAUSE ARGUMENT " + arg);
                    kw.pause(arg === undefined ? "user-defined pause" : arg);
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
            if(ci.carrier.isIn) {
                console.warn("WARNING: carrier " + ci.carrier.name + " still remaining");
                kw.outhook(ci.carrier);
                ci.carrier.isIn = false;
            }
        }

        kw.dropOff();

        kw.write(outFileName);

        console.log("generated file '" + outFileName + "'");
    }
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
	module.exports.KnitSequence = KnitSequence;

    module.exports.FRONT = FRONT;
    module.exports.BACK  = BACK;
}
