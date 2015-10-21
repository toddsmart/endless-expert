# Endless Expert: Chat with Presence (based on the OpenTok On-Demand Meeting Starter Kit)

## Setup

1. Requires account on (OpenTok)[https://dashboard.tokbox.com/].

2. Copy the config/development/opentok.php.sample file to config/development/opentok.php and 
   replace the key and secret settings with your OpenTok API key and secret, from the TokBox
   Dashboard.
   
3. Generate one relayed session (you may use the Project Tools in the Dashboard)
   and use the Session ID to replace the presenceSession setting.

## Usage

1. Visit the URL mapped to the application by your web server.

2. Input a name to be identified with. You will now see a list of available users, which will start
   as empty.

3. Have another user (possibly in another window or tab) visit the same URL, and input a new user
   name.

   Each of the users will see one another in the Buddies list.

4. In order to start a chat with an available user, click the camera icon next to the user's name.

   A user who has sent an invitation cannot receive invitations from other users. Unavailable users
   do not have a camera icon next to their name in the Buddies list.

   While waiting for a response to an invitation, the user can use the "cancel" button to stop the
   invitation.

5. An invited user receives an invitation to chat, which they can either accept or decline.
   If accepted, the chat begins. If declined, the invitation disappears.

   An invited user can continue to receive invitations from other users. If the user accepts an
   invitation, all other invitations are automatically declined.

6. Once either of the users chooses to "end chat," both users will return to being available.

## Code and Conceptual Walkthrough

### Technologies

This application uses some of the same frameworks and libraries as the
[Learning OpenTok Web](https://github.com/toddsmart/learning-opentok-web) app. If
you have not already gotten familiar with the code in that project, consider doing so before
continuing. The services are built with Node and Express.

In addition, the app uses [Backbone.js](http://documentcloud.github.io/backbone/) library for
client-side functionality. It is a basic MV* library, and while it's helpful in laying some
groundwork for the client, the same functionality could be achieved with other libraries and
frameworks or even with no framework at all. Along with Backbone, the client makes use of its
dependencies: [jQuery](http://jquery.com/), and [Lodash](http://lodash.com/). Lodash is a library
that is compatible with Underscore.js but has better performance, and it is also used for view
templating.

Lastly, the app uses [Bootstrap](http://getbootstrap.com/) to help style the UI and for reusable
components, such as buttons and modals.

### Concepts

Each user needs to be aware of the state of each of the other users -- this is known as _presence_.
This application approaches this from a distributed point of view, which means there is no central
authority required and there's less overhead in storing each user's state. The implementation
requires a basic messaging channel where each user and the whole group can be addressed. OpenTok
includes that exact functionality for clients via the signaling API. This application uses a
**presence session**, a global session which every client connects to in order to communicate
presence information. No video streaming is done in this session.

Each client uses the presence session to build a list of the other users and keep it synchronized
as users' states change. A **remote user** is the representation of another user and its state.
This list of remote users is called the **buddies list**. When a user joins the app (adding a user
name), that client sends a signal to the presence session with details about the user. Each other
user stores the remote user's data and state.

A **local user** is the user who is using the application in the local browser.

Each users state changes based on chat invitations and ongoing chat sessions. For example, the
user's state may be unavailable, outgoingInvitePending, or chatting. The application uses the
state of each remote user, the presence information, to conduct one-to-one chats. These chats begin
as an **invitation** from one user to another. The client who is creating the invitation is in
charge of creating the new chat by requesting it from the server. The server uses the OpenTok Node 
library to create a new OpenTok session for the video streaming of the chat. The **chat** contains
the OpenTok session ID, API Key, and token for the user. When the invitation is accepted, the
invited user requests the same chat from the server, and the server response will contain the same
chat information but with a unique token. Once both parties have this chat, they connect to it and
publish and subscribe to audio-video streams, much like the Hello World sample.

### Server

The server responds in a RESTful manner to a few different paths. Each path is given its own handler
in the Slim application and is individually described below:

*  `GET /presence` -- The server returns the API key and the session ID for the presence session as
   a JSON-encoded response. Notably, the token is not generated.

*  `POST /users` -- In order for a user to connect to the presence session, they must post the
   required details about themselves to this endpoint. In this case, the required details just
   include a JSON encoded `name`. The handler uses the OpenTok token's connection data feature
   to store the user name in the token. The distinction between the name and the other state
   (which is sent over the presence session) is that the name never changes, so its ideal for 
   storing in the connection data. Also, note that the token is given the role `Role::SUBSRCIBER`.
   This is because no users are allowed to publish into the presence session. If you were interested
   in adding authentication for the user, you would do so in this handler.

*  `POST /chats` -- When a user chooses to invite another user to a chat, it receives its the chat's
   representation from this handler. This handler uses the OpenTok Node library to create a new
   session and return its ID along with the API key and a token. The token is unique for each
   participant in the chat. Since there is no authentication in this application, there is no
   opportunity to perform authorization in the chat. If there was, you could use this handler to
   create a record for the chat in a database; then when the invited user requests the chat, the
   handler could authorize data  to make sure the requesting user is the invited user for that chat.

*  `GET /chats?sessionId=[sessionId]` -- When the invited user accepts an invitation, it also needs
   the details required to connect to the chat. Since there is no authentication in this
   application, and there are no database records for each chat that is created, the invited user is
   expected to know the sessionId of the chat they want to join already and send it as a query
   string parameter. The handler then returns the same details required to connect to the chat
   (session ID, API Key, token) but with another unique token.

### Client

The client JavaScript code is divided into separate files that each define a Backbone object used by
the app. These are described below.

#### App (web/js/app.js)

This is the main starting point for the application. Its main responsibilities are:

*  Initializing all models and views that are necessary at start up.
*  Retrieving the presence session on behalf of the other objects that require it.
*  Allowing for event dispatching for decoupled components to communicate with one another.

This file exports a global variable `App`, which contains properties for the views and models it
creates.

#### ConnectModalView (web/js/views/ConnectModalView.js)

The ConnectModalView is responsible for gathering the user details required to connect to the
presence session, and for connecting to the presence session.

The implementation wraps the interface for the basic Bootstrap modal. Within the modal, a form is
used to collect the user name from the user.

This view uses the LocalUser instance as the model to back it. The model assists in validation and
sending the data to the server. Once the server responds with the presence session data, the local
user connects to the presence session, which causes the local user's status to change. When the
modal observes the status changing to 'online', it is dismissed.

#### LocalUser (web/js/models/LocalUser.js)

The LocalUser's responsibilities are: 

*  Storing and managing state about the local user.
*  Requesting presence session details from the server and validating.
*  Updating other users with its state via the presence session.
*  Notifying and allowing other objects to query for its state.

#### UserInfoVIew (web/js/views/UserInfo.js)

The UserInfoView is also backed by the local user model. It is a simple view that is positioned in
the right side of the header. It displays the user's name when connected and "Not connected"
otherwise.

#### BuddyList (web/js/collections/BuddyList.js)

The BuddyList is a collection of RemoteUser model objects. It encapsulates creation and deletion of
remote users by receiving signals from the presence session. It also notifies other objects when the
availability of a remote user changes.

#### RemoteUser (web/js/models/RemoteUser.js)

The RemoteUser is a model that stores and manages the state of a remote user by receiving signals
from the presence session. It notifies other objects when the remote user's status changes.

#### BuddyListView (web/js/views/BuddyListView.js)

The BuddyListView handles presenting the data in the BuddyList collection. This includes enabling
and disabling the UI as the status of remote users and the local user changes. It also handles user
input when the camera icon button is pressed by notifying other objects that an invitation should be
created.

#### InvitationList (web/js/collections/InvitationList.js)

The InvitationList is a collection of Invitation model objects. Its responsibility is to encapsulate
the invitation flow and rules regarding how to handle incoming and outgoing invitations. It uses
signaling in the presence session to send and receive invitations.

#### Invitation (web/js/models/Invitation.js)

The Invitation is a model that represents either an incoming or an outgoing invitation. Each
invitation has a remote user associated with it. This class encapsulates requesting chat data from
the server and allows other objects to query for that data.

#### ChatView (web/js/views/ChatView.js)

The ChatView handles presenting a chat once an invitation has been sent and accepted. It is backed
by a Chat model and listens for events from it to adapt the UI accordingly.

#### Chat (web/js/models/Chat.js)

The Chat model encapsulates the logic used to conduct a video chat including an OpenTok session and
its event handlers. It is created with a reference to the invitation which caused it to be created,
and uses it to read the information needed to connect (API key, session ID, and token).
