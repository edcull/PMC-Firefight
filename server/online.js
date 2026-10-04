/* Online campaigns, run by the server: the world and its rules live in
   src/rules/camp-world.js, shared with the browser (a hotseat campaign with AI
   forces is the same world, kept on the device). */
'use strict';
require('./rules.js');
require('./campcmds.js');
module.exports = require('../src/rules/camp-world.js');
