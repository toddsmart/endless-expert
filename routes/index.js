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
        data : '{"name" : "' + name + '"}',
        role : 'subscriber'
    });

    response = {
        'token' : token
    }

    res.send(response);
});

// Create a chat
//
// Request: (JSON encoded)
// *  `invitee`: the name of the other user who is being invited to the chat
//
// Response: (JSON encoded)
// *  `apiKey`: an OpenTok API key that owns the session ID
// *  `sessionId`: an OpenTok session ID to conduct the chat within
// *  `token`: a token that the creator of the chat (or inviter) can use to connect to the chat
//    session
//
// NOTE: This request is designed in a manner that would make it convenient to add user
// authentication in the future. The `invitee` field is not currently used but could be used to help
// verify that a user who attempts to create a chat is allowed to do so. An alternative design could
// be to hand both the `inviterToken` and `inviteeToken` to the inviter, who could then send the
// invitee a token over an OpenTok signal. The drawback of that design would be that the server
// loses the ability to keep track of the state of a user (such as if they have joined a chat or not).
router.post('/chats', function(req, res, next) {
    opentok.createSession(function(err, session) {
        if (err) throw err;
        var responseData = {
            apiKey : apiKey,
            sessionId : session.sessionId,
            token : session.generateToken()
        };

        res.send(responseData);
    });
});

module.exports = router;
