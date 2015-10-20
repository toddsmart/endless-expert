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
    apiSecret = process.env.API_SECRET,
    presenceSessionId = process.env.PRESENCE_SESSION;
if (!apiKey || !apiSecret || !presenceSessionId) {
    console.log('You must specify API_KEY, API_SECRET, and PRESENCE_SESSION environment variables');
    process.exit(1);
}

// Initialize OpenTok
var opentok = new OpenTok(apiKey, apiSecret);

// Create a session and store it for lookup later
opentok.createSession(function(err, session) {
    if (err) throw err;
    opentok.sessionId = session.sessionId;
});

/**
 * Note: this is going to be deprecated once we get the upated API below this method completed
 */
router.get('/', function(req, res, next) {
    var sessionId = opentok.sessionId,
        token = opentok.generateToken(sessionId); // generate a fresh token for this client

    res.render('opentok', {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token
    });
});

// Presence configuration
//
// Response: (JSON encoded)
// *  `apiKey`: The presence session API Key
// *  `sessionId`: The presence session ID
router.get('/presence', function(req, res, next) {
    var sessionId = opentok.sessionId;

    res.send({
        'apiKey': apiKey,
        'sessionId': presenceSessionId
    });
});

// User enters
//
// Request: (JSON encoded)
// *  `name`: A name for the user that will appear in the UI
//
// Response: (JSON encoded)
// *  `token`: A token that can be used to connect to the presence session, which also identifies
//    the user to all other users who connect to it.
//
// NOTE: This request allows anonymous access, but if user authentication is required then the
// identity of the request should be verified (often times with session cookies) before a valid
// response is given.
// NOTE: Uniqueness of names is not enforced.
router.post('/users', function(req, res, next) {
    var name = req.body.name,
        token,
        response;

    if (!name) {
        res.setStatus(400);
        return;
    }

    token = opentok.generateToken(presenceSessionId, {
        data : '"name=' + name + '"' ,
        role : 'subscriber'
    });

    response = {
        'token' : token
    }

    res.send(response);
});

module.exports = router;
