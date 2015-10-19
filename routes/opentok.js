/**
 *
 *
 * TODO: tsmart 10192015 - this isn't the right place for opentok init/management
 *
 * @type {*|exports|module.exports}
 */

var express = require('express');
var router = express.Router();
var OpenTok = require('opentok');

// Verify that the API Key and API Secret are defined
var apiKey = process.env.API_KEY,
    apiSecret = process.env.API_SECRET;
if (!apiKey || !apiSecret) {
    console.log('You must specify API_KEY and API_SECRET environment variables');
    process.exit(1);
}

// Initialize OpenTok
var opentok = new OpenTok(apiKey, apiSecret);

// Create a session and store it for lookup later
opentok.createSession(function(err, session) {
    if (err) throw err;
    opentok.sessionId = session.sessionId;
});

router.get('/', function(req, res, next) {
    var sessionId = opentok.sessionId,
        token = opentok.generateToken(sessionId); // generate a fresh token for this client

    res.render('opentok', {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token
    });
});

module.exports = router;
