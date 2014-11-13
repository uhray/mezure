# Mezure

A simple javascript API to interact with Mezure's api.

* [Quickstart](#quickstart)
* [Overview](#overview)
* [API](#api)
* [Debug](#debug)

## Quickstart

Install:
```
bower install mezure
```

Use:
```js
// configure
mezure.configure({ license: '<LICENSE KEY>' });

// DEPRECATED - log a record
mezure.record('users', 1)  // logging 1 user

// turn on session watching
mezure.session();

// log activity
mezure.activity('view_homepage');
```

## Overview

Mezure allows you to track application behavior to gather and measure insights about your core ideas. When launching an MVP, you need to measure behavior or the launch is a waste of time. We have provided three key methods for behavior tracking with this API:
 
  * DEPRECATED ~~records - records generic stats that can be tracked over time~~
  * activity - track users' activity on the site (what did they do?)
  * sessions - track users' sessions on the site (how many times they came and how long they stayed).

### Glossary

#### Activity Stream

An activity stream is a pathway of actions in the app. It begins when you open the app in a window/tab on your browser and ends when you stop making actions. If you have multiple windows or tabs open, they will count as different activity streams. Likewise, if you click a link that opens a window as a `target="_blank"`, this begins a new activity stream.

To log things to a current activity stream, see the [activity](#activity) method.

#### Sessions

A session has these rules:

  * It starts when you open any page for the site.
  * It ends when you've been inactive for 10 minutes (see [configure](#configure) to change this value).
  * The "end-time" is updated every 10 seconds (see [configure](#configure) to change this value).
  * Having 10 windows open, only counts as 1 session. A session is a segment of time you start interacting with the app and ultimately stop. However, this is not unique to user id but to device/browser. So being active on a phone and on the web at the same time would be two sessions.

#### Metadata

Metadata can be important for tracking the application usage. Metadata is a key-value object that stores information about the record/activity/session that can the be grouped, bucketed, etc. For example, if an activity were `"buy_product"`, a good piece of metadata would be the price of the product. So you could set metadata to `{ price: 7.99 }`. Then, in the Mezure application, you could see all `"buy_product"` activities grouped by price.

#### Identifiers

Identifiers are unique values associated with a record/activity/session. It is a key-value object that stores this information. For example, if you want to log an activity `"buy_product"`, a good identifier would be the username of who bought this product. So you could set identifiers to `{ username: 'uhray_team'}`. Then, in the Mezure application, you could see a breakdown of how many unique usernames bought a product, or how many bought 10+ products, or how many bought 100+ products, etc.

## API

<a href="#configure" name="configure">#</a> mezure.**configure**(*options*)

Merges *options* onto the current configurations. The available options are:

  * *url* (type=String, default=`'http://127.0.0.1:5000/api/v1'`) - Base url for the Mezure API
  * *sessionReset* (type=Number, default=`5 * 60 * 1e3` ... or 5 mins) - Length of time in between activity before a new session is started
  * *sessionTimeout* (type=Number, default=`10e3` ... or 10s) - Length of time in between sending session information to the server

<a href="#record" name="record">#</a> mezure.**record**(*name*,  *value*,  *meta*,  *ids*,  *cb*)

  -- DEPRECATED  --

<a href="#activity" name="activity">#</a> mezure.**activity**(*name*,  *meta*,  *ids*)

Log's the user's activity.

  * *name* (type=String, required) - the unique name of this activity type.
  * *meta* (type=Object, default=`{}`) - [metadata](#metadata) about this action.
  * *ids* (type=Object, default=`{}`) - [identifiers](#identifiers) for this action.

<a href="#session" name="session">#</a> mezure.**session**(*meta*,  *ids*)

If called the first time, this turns on session tracking and then sets the specified metadata and identifiers for the session. Otherwise, it just updates the metadata and identifiers.

  * *meta* (type=Object, default=`{}`) - [metadata](#metadata) about this session.
  * *ids* (type=Object, default=`{}`) - [identifiers](#identifiers) for this session.

Session tracking is pretty simple. Every `sessionTimeout` (see [configure](#configure)) milliseconds it updates the current session with the new end time being "now", unless the browser window is not currently active (leaving a browser window open on a tab does not count as a session). If a session is inactive for `sessionReset` (see [configure](#configure)) milliseconds, then a new session will be created. Mezure uses your browser's [localStorage](http://diveintohtml5.info/storage.html) to keep track of the current active session. So if you have multiple browser windows open, it will be recorded as only one session.

## DEBUG

To turn on debug messages in the console, set `mezure.__debug` to a console log function.

Example:

```js
mezure.__debug = console.log.bind(console);
```

