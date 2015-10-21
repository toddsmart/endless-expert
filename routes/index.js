/**
 * The server responds in a RESTful manner to a few different paths. Each path is given its own handler and is individually described below:
 *
 * GET /presence -- The server returns the API key and the session ID for the presence session as a JSON-encoded response. Notably, the token is not generated.
 *
 * POST /users -- In order for a user to connect to the presence session, they must post the required details about themselves to this endpoint.
 * In this case, the required details just include a JSON encoded name. The handler uses the OpenTok token's connection data feature to store the user name in
 * the token. The distinction between the name and the other state (which is sent over the presence session) is that the name never changes, so its ideal for
 * storing in the connection data. Also, note that the token is given the role Role::SUBSRCIBER. This is because no users are allowed to publish into the
 * presence session. If you were interested in adding authentication for the user, you would do so in this handler.
 *
 * POST /chats -- When a user chooses to invite another user to a chat, it receives its the chat's representation from this handler. This handler uses the
 * OpenTok Node library to create a new session and return its ID along with the API key and a token. The token is unique for each participant in the chat.
 * Since there is no authentication in this application, there is no opportunity to perform authorization in the chat. If there was, you could use this handler
 * to create a record for the chat in a database; then when the invited user requests the chat, the handler could authorize data to make sure the requesting user
 * is the invited user for that chat.
 *
 * GET /chats?sessionId=[sessionId] -- When the invited user accepts an invitation, it also needs the details required to connect to the chat. Since there is no
 * authentication in this application, and there are no database records for each chat that is created, the invited user is expected to know the sessionId of the
 * chat they want to join already and send it as a query string parameter. The handler then returns the same details required to connect to the chat (session ID,
 * API Key, token) but with another unique token.
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

// Constants
var NAME_MAX_LENGTH = 100;

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

    // Parameter validation
    if (!name || name.length > NAME_MAX_LENGTH) {
        res.status(400).send('Length larger than: ' + NAME_MAX_LENGTH);
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
    // NOTE: Uses a relayed session. If a routed session is preferred, add that parameter here.
    opentok.createSession(function(err, session) {
        if (err) throw err;
        var responseData = {
            apiKey : apiKey,
            sessionId : session.sessionId,
            token : session.generateToken()
        };

        // NOTE: would add a 'Location' header if a new resource URI were to be created
        res.send(responseData);
    });
});

// Join a chat
//
// Request: (query parameter)
// *  `sessionId`: the OpenTok session ID which corresponds to the chat an invitee is attempting
//    to enter
//
// Response: (JSON encoded)
// *  `apiKey`: an OpenTok API key that owns the session ID
// *  `sessionId`: an OpenTok session ID to conduct the chat within
// *  `token`: a token that the user joining (or invitee) a chat can use to connect to the chat
//    session
//
// NOTE: This request is designed in a manner that would make it convenient to add user
// authentication in the future. The query parameter `sessionId` is like a filter on  the `/chats`
// resource to find the appropriate chat. Alternatively, if new chats were stored for  some time,
// each one could be given an independent URI. The invitee would then GET that specific resource.
// The response would then contain the `sessionId` and an appropriate token (invitee or inviter)
// based on user authentication.
router.get('/chats', function(req, res, nex) {
    var sessionId,
        responseData,
        token;

    // Parameter validation
    sessionId = req.query.sessionId;
    if (!sessionId) {
        res.status(404).send('Must pass valid session ID in request.');
        return;
    }

    // An exception can be generated if the sessionId was an arbitrary string
    try {
        token = opentok.generateToken(sessionId);
    } catch (e) {
        res.status(404).send('Unable to generate token for invalid session ID.');
        return;
    };

    responseData = {
        apiKey : apiKey,
        sessionId : sessionId,
        token : token
    };

    res.send(responseData);
});

module.exports = router;
