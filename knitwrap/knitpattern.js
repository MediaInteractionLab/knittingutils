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
var makeYarn = function(id) {
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

    /**
     * supported operations
     *  n   needle operations (knit, tuck, miss, xfer, etc.)
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
                    courses: []
                };
            };

            this.maps[yarn.id] = createMap();
        };
    };
    
    /**
     * 
     * @param {*} yarn 
     * @param {Number} offset
     */
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

    /**
     * 
     * @param {String} msg 
     */
    this.comment = function(msg) {
        this.commands.push("c|" + msg);
    }

    /**
     * 
     * @param {*} yarn 
     * @param {String} repeat 
     *      * needle operations:
     *      . nop
     *      k knit front
     *      K knit back
     *      b knit front+back
     *      t tuck front
     *      T tuck back
     *      B tuck front + back
     *      x tuck front + back
     *      X knit back + tuck front
     *      - explicit miss front
     *      _ explicit miss back
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

        //TODO: remove hardcoded values here
        this.bringInArea.left = this.rightmost + 2;
        this.bringInArea.right = this.rightmost + 8;
    };

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

        //TODO: remove hardcoded values here
        this.bringInArea.left = this.leftmost + 2;
        this.bringInArea.right = this.leftmost + 8;
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

        for(var key in this.maps) {
            courseCntr[key] = 0;
            maxIdLen = Math.max(key.length, maxIdLen);
            maxCourseLen = Math.max(this.maps[key].courses.length, maxCourseLen);
        }

        var carrierCounter = 0;

        this.commands.forEach(function(command, i) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);
            
            switch (cmd) {
                case 'n':
                    carrierCounter++;

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
                    let il = String(carrierCounter).length;

                    let coul = String(maxCourseLen).length;
                    let cl = String(courseId + 1).length;
                    
                    console.log('N: ' + ' '.repeat(coml - il) + (carrierCounter) + ': ' + ' '.repeat(maxIdLen - arg.length) + arg + ' ' + ' '.repeat(coul - cl) + '(' + (courseId + 1) + '): ' +  ' '.repeat(course.leftPos - 1) + course.ops);

                    courseCntr[arg]++;
                    break;
                case 'r':
                    break;
                case 's':
                    break;
                case 'c':
                    console.log('C: "' + arg + '"');
                    break;
                default:
                    console.error("ERROR: unrecognized command '" + cmd + "'" );
            }
        }, this);
    }

    /**
     * 
     * @param {String} outFileName 
     * @param {*} carrierMapping
     * @param {String} desc 
     * @param {*} machine 
     */
    this.generate = function(outFileName, carrierMapping, desc = "", position = "Keep", machine = undefined) {

        const knitwrap = require('./knitwrap.js');
        let kw = new knitwrap.KnitOutWrapper();

        const LEFT = knitwrap.LEFT;
        const RIGHT = knitwrap.RIGHT;

        //let wales = this.rightmost - this.leftmost + 1;
        kw.initKnitout(machine, position);
        kw.comment("description: " + desc);

        kw.rack(0);

        let cInfo = {};
        for(var key in this.maps) {
            let cm = carrierMapping[key];
            if(!cm)
                throw new Error("mapping for carrier with name \'" + key + "' not found");
            cInfo[key] = {
                courseCntr: 0,
                wasInUse: false,
                wasKnit: false,
                wasTuck: false,
                carrier: kw.machine.carriers[cm.toString()]
            };
        }
        let dropBringIn = null;

        let numActiveCarriers = 0;

        this.commands.forEach(function(command) {

            let p0 = 0;
            let p1 = command.indexOf('|', p0);

            let cmd = command.substring(p0, p1);

            p0 = p1 + 1;
            p1 = command.length;
            
            let arg = command.substring(p0, p1);

            switch (cmd) {
                case 'n':
                    let m = this.maps[arg];
                    if(!m) {
                        console.error("ERROR: map '" + arg + "' not found in pattern" );
                        return;
                    }

                    let ci = cInfo[arg];

                    let courseId = ci.courseCntr;

                    let c = ci.carrier;

                    if(!c.isIn) {
                        kw.bringIn(c, this.bringInArea.left, this.bringInArea.right);
                        numActiveCarriers++;

                        dropBringIn = ci;

                        c.isIn = true;
                    }

                    let course = m.courses[courseId];
                    let dir = 0;

                    if(course.ops.length) {

                        let l = course.leftPos;
                        let r = l + course.ops.length - 1;
                        let center = (l + r) / 2;

                        dir = (c.pos < center ? RIGHT : LEFT);
                        let start = (dir === RIGHT ? l : r);
                        let end = start + course.ops.length * dir;
                        let n = start;
                        let i = 0;

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
                            }

                            n += dir;
                            i++;
                        }
                    }
                    
                    ci.wasInUse = true;
                    ci.courseCntr++;

                    if(ci.courseCntr === m.courses.length) {

                        if(numActiveCarriers === 1) {
                            //TODO: replace this with leftmost and rightmost needles actually holding loops
                            kw.castOff(c, this.leftmost, this.rightmost);
                        }

                        kw.out(c);
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
        }, this);

        for(var key in cInfo) {
            let ci = cInfo[key];
            if(ci.isCarrierIn) {
                console.log("still remaining carrier: " + ci.carrier.desc);
                kw.out(ci.carrier);
                cInfo[key].isCarrierIn = false;
            }
        }

        kw.write(outFileName);

        console.log("generated file '" + outFileName + "'");
    }
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
	module.exports.KnitPattern = KnitPattern;
    module.exports.makeYarn = makeYarn;
}
