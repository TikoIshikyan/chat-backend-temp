var WebSocketServer = require("ws").Server;
var request = require('request');
var async = require('async');
var couchbase = require('couchbase');
var N1qlQuery = require('couchbase').N1qlQuery;

var cluster = new couchbase.Cluster('couchbase://127.0.0.1');
var chat = cluster.openBucket('chat2');

chat.enableN1ql(['localhost:8093']);

console.log("ok!!!!");
var wss = new WebSocketServer({port: 6000});

//process.on('uncaughtException', function (err) {
//    console.log({
//        error_type: 'exception',
//        error_message: err.message,
//        stack: err.stack
//    });
//});

//**************  ather functions

function rand() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 20; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

var isPresence = function (user, last_date, callback) {
    connectionManager.getConnectionById(user.id, function (err, conn) {
        if (conn) {
            user.isPresence = true;
            return callback(user);
        } else {
            user.isPresence = false;
            user.last_date = last_date;
            return callback(user);
        }
    })
}

var isChatUser = function (users, callback) {
    var users_ids = [];

    users.forEach(function (user) {
        users_ids.push(user.id);
    })

    getUsers(users_ids, function (err, chatUsers) {
        var result = [];
        var chatUserIds = [];
        chatUsers.forEach(function (chatUser) {
            chatUserIds.push(chatUser.id);
        })
        async.each(users, function (user, cb) {
            if (chatUserIds.indexOf(user.id) !== -1) {
                user.isUseChat = true;
                isPresence(user, chatUsers[chatUserIds.indexOf(user.id)].last_date, function (user) {
                    result.push(user);
                    cb();
                });
            } else {
                user.isUseChat = false;
                result.push(user);
                cb();
            }
        }, function (err) {
            return callback(null, result);
        })
    })
}

var isOnlineOrOffline = function (key, callback) {
    getFollowings(key, function (err, followings) {
        if (err) {
            return callback(err);
        }
        var ids = [];
        followings.forEach(function (fol) {
            ids.push(fol.id);
        });
        connectionManager.getConnectionsByIds(ids, function (connections) {
            return callback(null, connections);
        })
    })
}

var sortRooms = function (users_ids, room_id) {
    if (users_ids.length > 1) {
        getUsers(users_ids, function (err, users) {
            users.forEach(function (user) {
                if (user.history.length > 0) {
                    user.history.splice(user.history.indexOf(room_id), 1);
                    user.history.push(room_id);
                    updateUser(user, function (err, res) {

                    })
                }
            })
        })
    }
}

var authenticate = function (params, connection, callback) {
    if (!params) {
        return callback("params does not exist");
    }
    if ('token' in params && params.token && params.token !== 'null') {
        for (var i = 0; i < connectionManager.connections.length; i++) {
            if (connectionManager.connections[i].token === params.token) {
                return callback();
            }
        }
        return callback("connection for this token does not exist");
    } else if (!connection.key) {
        if ('key' in params && params.key && params.key !== 'null') {
            getUserByKey(params.key, function (err, user) {
                if (err) {
                    return callback("key error " + err);
                }
                return callback(null, user);
            })
        } else {
            return callback("for sign-up or sign-in");
        }
    } else {
        return callback("you are already signed in, please logout or send token");
    }
}

//******************  url-s functions

var signup = function (params, callback) {
    console.log("----- signup -----");
    var form = request.post('https://api.picsart.com/users/signup.json', {
        json: true
    }, function (error, response, body) {
        if (error || body.status === "error") {
            return callback(error || body);
        }
        return callback(null, body);
    }).form();
    form.append("name", params.name || "");
    form.append("username", params.username || "");
    form.append("password", params.password || "");
    form.append("email", params.email || "");
}

var signin = function (params, callback) {
    console.log("----- signin -----");
    console.log(params.username);
    console.log(params.password);
    var form = request.post('https://api.picsart.com/users/signin.json', {
        json: true
    }, function (error, response, body) {
        if (error || body.status === "error") {
            return callback(error || body);
        }
        return callback(null, body);
    }).form();
    form.append("username", params.username || "");
    form.append("password", params.password || "");
}

var update = function (key, params, callback) {
    console.log("----- update -----");
    var form = request.post('https://api.picsart.com/users/update.json?key=' + key, {
        json: true
    }, function (error, response, body) {
        if (error || body.status === "error") {
            return callback(error || body);
        }
        return callback(null, body);
    }).form();
    if (params.name) {
        form.append("name", params.name)
    }
    if (params.username) {
        form.append("username", params.username)
    }
    if (params.password) {
        form.append("password", params.password)
    }
    if (params.email) {
        form.append("email", params.email)
    }
    if (params.status_message) {
        form.append("status_message", params.status_message)
    }
    if (params.location_street) {
        form.append("location_street", params.location_street)
    }
    if (params.location_city) {
        form.append("location_city", params.location_city)
    }
    if (params.location_state) {
        form.append("location_state", params.location_state)
    }
    if (params.location_country) {
        form.append("location_country", params.location_country)
    }
    if (params.location_zip) {
        form.append("location_zip", params.location_zip)
    }
}

var getFollowings = function (key, callback) {
    console.log("----- getfollowings -----");
    request.get('https://api.picsart.com/following/show/me.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            var body = JSON.parse(body);

            return callback(null, body.response || []);
        })
}

var addFollowing = function (key, id, callback) {
    if (!id) {
        return callback("id doesn't exist");
    }
    console.log("----- addfollowing -----");
    request.post('https://api.picsart.com/following/add/' + id + '.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            var body = JSON.parse(body);
            //getUser(connection.id, function (err, user) {
            //user.friends.push(id);
            return callback(null, body);
            //})
        })
}

var removeFollowing = function (key, id, callback) {
    if (!id) {
        return callback("id doesn't exist");
    }
    console.log("----- removefollowing -----");
    request.post('https://api.picsart.com/following/remove/' + id + '.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            var body = JSON.parse(body);

            return callback(null, body);
        })
}

var getFollowers = function (id, callback) {
    console.log("----- getfollowers -----");
    request.get('https://api.picsart.com/followers/show/' + id + '.json',
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            var body = JSON.parse(body);

            return callback(null, body.response || []);
        })
}

var blockUser = function (key, id, callback) {
    console.log("----- blockUser -----");
    if (!id) {
        return callback("id doesn't exist");
    }
    request.post('https://api.picsart.com/blocks/add/' + id + '.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            return callback(null, body);
        })
}

var unblockUser = function (key, id, callback) {
    console.log("----- unblockUser -----");
    if (!id) {
        return callback("id doesn't exist");
    }
    request.post('https://api.picsart.com/blocks/remove/' + id + '.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            return callback(null, body);
        })
}

var searchUser = function (id, key, callback) {
    console.log("----- searchUser -----");
    if (!id) {
        return callback("id doesn't exist");
    }
    request.get('https://api.picsart.com/users/show/' + id + '.json?key=' + key,
        function (err, response, body) {
            if (err || body.status === "error") {
                return callback(err || body);
            }
            var body = JSON.parse(body);
            return callback(null, body);
        })
}

var search = function (q, callback) {
    console.log("----- searchUser -----");
    request.get({
        url: 'http://api.picsart.com/users/search.json',
        json: true,
        qs: {
            q: q,
            limit: 10
        }
    }, function (err, response, user) {
        if (err) {
            return callback(err);
        }
        return callback(null, user && user.response ? user.response : []);
    });
}

var addMessage = function (id, users_ids, body, room_id, callback) {
    console.log("----- addMessage -----");
    if (!body || body.trim().length === 0) {
        return callback("body is uncorrect or does not exist");
    }
    var message = {
        id: "message:" + rand(),
        _type: "message",
        author: id,
        body: body,
        date: new Date(),
        deleted_for: []
    };

    if (room_id) {
        message.room_id = room_id;

        chat.insert(message.id, message, function (err, res) {
            if (err) {
                return callback("message insert error" + err);
            }
            getRoom(room_id, function (err, room) {
                if (err) {
                    return callback("get room error" + err);
                }
                //sortRooms(users_ids);
                //room.users_ids.splice(room.users_ids.indexOf(id), 1);
                async.each(room.users_ids, function (user_id, cb) {
                    getUser(user_id, function (err, user) {
                        if (err) {
                            return callback(err);
                        }
                        for (var i = 0; i < user.history.length; i++) {
                            if (user.history[i].room_id == room_id && user_id !== id && user.history[i].status === "read") {
                                //// ste mi hat el stugvum a vor read a ,
                                //// ete ha uremn darnum a unread u id-n pahvum a et namaki,.,.
                                user.history[i].status = "unread";
                                return updateUser(user, cb);
                            }
                        }
                        cb();
                    })
                }, function (err) {
                    connectionManager.getConnectionsByIds(room.users_ids, function (connections) {
                        return callback(null, connections, room_id, message);
                    })
                });
            })
        })
    } else {
        if (!users_ids || users_ids.length == 0) {        //doesn't need if user can send message himself
            return callback("users_ids doesn't exist");
        }
        if (users_ids.indexOf(id) !== -1) {
            return callback("you send your id!!!");
        }

        if (users_ids.length === 1) {
            var query = N1qlQuery.fromString("SELECT * FROM chat2 ch1 NEST chat2 ch2 ON KEYS ARRAY li.room_id FOR li IN ch1.history END where ch1.id = " + id);
            chat.query(query, function (err, res, info) {
                console.log(res);
                async.each((res[0]) ? res[0].ch2 : [], function (room, cb) {
                    if (room.users_ids.length == 2 && room.users_ids.indexOf(users_ids[0]) !== -1) {
                        return cb("you already have room with this user");
                    }
                    cb();
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    var arr = users_ids.slice();
                    arr.push(id);
                    var room = {
                        id: "room:" + rand(),
                        _type: "room",
                        users_ids: arr
                    };

                    message.room_id = room.id;
                    chat.insert(message.id, message, function (err, res) {
                        if (err) {
                            return callback("message insert error " + err);
                        }
                        chat.insert(room.id, room, function (err, res) {
                            if (err) {
                                return callback("room insert error " + err);
                            }

                            async.each(users_ids, function (id, cb) {
                                getUser(id, function (err, user) {
                                    cb(err);
                                })
                            }, function (err) {
                                if (err) {
                                    return callback("get user error " + err);
                                }
                                var data = {
                                    room_id: room.id,
                                    status: "read",
                                    message_id: "new"
                                }
                                var query = N1qlQuery.fromString('Update chat2 set history = ARRAY_APPEND(history, ' + JSON.stringify(data)
                                    + ') where id = ' + id);       ////ste pti nayvi ete grox usern a uremn read-ov @lni,
                                // ..ete che uremn unread u messige_id-n
                                chat.query(query, function (err, res, info) {
                                    console.log("add new room info for current user", info);
                                    if (err) {
                                        return callback("update history error 1 " + err);
                                    }

                                    var data = {
                                        room_id: room.id,
                                        status: "unread",
                                        message_id: "new"
                                    }
                                    var query = N1qlQuery.fromString('Update chat2 set history = ARRAY_APPEND(history, ' + JSON.stringify(data)
                                        + ') where id in ' + JSON.stringify(users_ids));

                                    chat.query(query, function (err, res, info) {
                                        console.log("add new room info for other users", info);
                                        if (err) {
                                            return callback("update history error 2 " + err);
                                        }
                                        connectionManager.getConnectionsByIds(arr, function (connections) {
                                            return callback(null, connections, room.id, message);
                                        })
                                    })
                                });
                            });
                        })
                    })
                })
            });
        } else {
            return callback("not support group chat");
        }
    }
};

var readMessage = function (id, room_id, message_id, callback) {     ////pti darna uxxaki read u fsyo
    console.log("----- readMessage -----");                         //verjum callback-i pah@ nayel ,, nayel tenal uxarkac  namak@ es usern a gre te che.,,.
    if (!room_id) {
        return callback("room id doesn't exist");
    }
    if (!message_id) {
        return callback("message_id doesn't exist");
    }
    getUser(id, function (err, user) {
        if (err) {
            return callback(err);
        }
        for (var i = 0; i < user.history.length; i++) {
            if (user.history[i].room_id == room_id && user.history[i].status === "unread") {
                user.history[i].status = "read";
                user.history[i].message_id = message_id;
                updateUser(user, function (err, user) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, user);
                })
            }
        }
    })
}

var removeMessage = function (id, room_id, message_id, callback) {
    console.log("----- removeMessage -----");
    if (!room_id) {
        return callback("room id doesn't exist");
    }
    if (!message_id) {
        return callback("message id doesn't exist");
    }
    getRoom(room_id, function (err, room) {
        if (err) {
            return callback(err);
        }
        if (room.users_ids.indexOf(id) === -1) {
            return callback("you can not delete this message");
        }

        var query = N1qlQuery.fromString("update chat2 set deleted_for = ARRAY_APPEND(deleted_for, '" + id +
            "') where meta().id = '" + message_id + "' and room_id = '" + room_id + "'");

        chat.query(query, function (err, res, info) {
            console.log(info);
            if (err) {
                return callback(err);
            }
            if (info.metrics.mutationCount === 0) {
                return callback("you can not remove this message or message doesn't exist in this room");
            }
            return callback(null, "success");
        })
    })
}

var editMessage = function (id, room_id, message_id, body, callback) {
    console.log("----- editMessage -----");
    if (!body || body.trim().length === 0) {
        return callback("body is uncorrect or does not exist");
    }
    if (!room_id) {
        return callback("room id doesn't exist");
    }
    if (!message_id) {
        return callback("message id doesn't exist");
    }
    getRoom(room_id, function (err, room) {
        console.log("room", room);
        if (err) {
            return callback(err);
        }
        if (room.users_ids.indexOf(id) === -1) {
            return callback("you can not edit messages in this room");
        }

        var query = N1qlQuery.fromString("update chat2 set body = '" + body +
            "' where meta().id = '" + message_id + "' and author = " + id + " and room_id = '" + room_id + "'");

        chat.query(query, function (err, res, info) {
            //console.log("info", info);
            //console.log("res", res);
            //console.log("err", err);

            if (err) {
                return callback(err);
            }
            if (info.metrics.mutationCount === 0) {
                return callback("you can not edit this message or message doesn't exist in this room");
            }
            connectionManager.getConnectionsByIds(room.users_ids, function (connections) {
                return callback(null, connections);
            })
        })
    })
}

//var removeRoom = function (id, room_id, callback) {            //room_id-i tex@ room@ pti @lni
//    if (!room_id) {
//        return callback("room_id doesn't exist");
//    }
//    var query = N1qlQuery.fromString('Update chat set history = ARRAY_REMOVE(history, "' + room_id
//        + '") where meta().id = "user:' + id + '"');
//
//    chat.query(query, function (err, res, info) {
//        if (err) {
//            return callback(err);
//        }
//        if (info.metrics.mutationCount === 0) {
//            return callback("you can not remove this room or this room is not in your history");
//        }
//        return callback(null);
//    })
//}

var getHistory = function (id, callback) {
    console.log("----- getHistory -----");

    var query = N1qlQuery.fromString("SELECT * FROM chat2 ch1 NEST chat2 ch2 ON KEYS ARRAY li.room_id FOR li IN ch1.history END where ch1.id = " + id);

    chat.query(query, function (err, res, info) {
        console.log(info);
        if (err || res.length === 0) {
            return callback(err || "user history not found");
        }

        var history = [];
        async.each(res[0].ch2, function (room, cb_each) {
            var chaat = {
                id: room.id,
                room_users: [],
                message: Object,
                new_messages: 0
            };
            async.parallel({
                room_users: function (cb_parallel) {
                    var room_users = [];
                    room.users_ids.splice(room.users_ids.indexOf(id), 1);
                    getUsers(room.users_ids, function (err, users) {
                        if (err) {
                            cb_parallel(err);
                        } else {
                            users.forEach(function (user) {
                                isPresence(user, user.last_date, function (user) {
                                    room_users.push({
                                        id: user.id,
                                        name: user.name,
                                        username: user.username,
                                        photo: user.photo,
                                        isPresence: user.isPresence,
                                        last_date: (user.isPresence) ? null : user.last_date
                                    });
                                    cb_parallel(null, room_users);              //erb mi qani userov room lini chi ashxati
                                });
                            })
                        }
                    })
                },
                message: function (cb_parallel) {
                    query = N1qlQuery.fromString("select * from chat2 where _type = 'message' and room_id = '"
                        + room.id + "' and ARRAY_CONTAINS(deleted_for, '" + id + "') != true order by date desc limit 1");

                    chat.query(query, function (err, res, info) {
                        if (err || res.length === 0) {
                            return cb_parallel(err || "messages not found");
                        }
                        return cb_parallel(null, res[0].chat2);
                    })
                },
                new_messages: function (cb_parallel) {
                    var query;
                    res[0].ch1.history.forEach(function (history) {
                        if (history.room_id === room.id) {
                            if (history.status === "unread") {
                                query = N1qlQuery.fromString("select * from chat2 where _type = 'message' and room_id = '"
                                    + room.id + "' and author != " + id + " order by date desc limit 30");
                                // and ARRAY_CONTAINS(deleted_for, '"+ id + "') != true
                                chat.query(query, function (err, res, info) {
                                    if (err || res.length === 0) {
                                        return cb_parallel(err || "messages not found");
                                    }
                                    /// prost@ kfranq minchev hasnenq message_id-in
                                    var count = 0;
                                    if (history.message_id === "new") {
                                        return cb_parallel(null, res.length);
                                    }
                                    for (var i = 0; i < res.length; i++) {
                                        if (res[i].chat2.id === history.message_id) {
                                            return cb_parallel(null, count);
                                        } else {
                                            count++;
                                        }
                                    }
                                    if (res.length === count) {
                                        return cb_parallel(null, count);
                                    }
                                })

                            } else {
                                return cb_parallel(null, 0);
                            }
                            ////ste pti select arvi sax messagener@ vor` ete unread a, author es user@ chi u deleted-um inq@ chka,
                            // isk ete read a uremn prost@ vor deleted@ inq@ chka.,.,
                        }
                    })
                }
            }, function (err, results) {
                if (err) {
                    cb_each(err);
                } else {
                    chaat.message = results.message;
                    chaat.room_users = results.room_users;
                    chaat.new_messages = results.new_messages;
                    history.push(chaat);
                    cb_each();
                }
            })
        }, function (err) {
            if (err) {
                return callback(err);
            }
            console.log(history);
            return callback(null, history);
        })
    })
}

var loadMessages = function (id, room_id, last_message, limit, callback) {
    console.log("----- loadMessages -----");
    if (!room_id) {
        return callback("room_id does not exist");
    }
    var limit = limit || 60;
    var date = (last_message) ? last_message.date : 0;
    var messages = [];
    var query = N1qlQuery.fromString("select * from chat2 where _type = 'message' and room_id = '"
        + room_id + "' and  date > " + date + "  and ARRAY_CONTAINS(deleted_for, '"
        + id + "') != true order by date desc limit " + limit);

    chat.query(query, function (err, res, info) {
        if (err || res.length === 0) {
            return callback(err || "messages not found");
        }
        res.forEach(function (message) {
            messages.push(message.chat2);
        });
        return callback(null, messages.reverse());
    })
}

var invite = function (key, user_id, callabck) {

}

var typing = function (id, room_id, callback) {
    console.log("----- typing -----");
    if (!room_id) {
        return callback("room id does not exist");
    }
    getRoom(room_id, function (err, room) {
        if (err) {
            return callback(err);
        } else {
            room.users_ids.splice(room.users_ids.indexOf(id), 1);
            connectionManager.getConnectionsByIds(room.users_ids, function (connections) {
                return callback(null, connections);
            })
        }
    })
}

//********** Couchbase functions

var getRoom = function (id, callback) {
    console.log("----- getRoom -----");

    chat.get(id, function (err, res) {
        if (err) {
            return callback(err);
        }
        return callback(null, res.value);
    })
}

var getUser = function (id, callback) {   //get document by its id(user key)
    console.log("----- getUser -----");
    if (!id) {
        return callback("id does not exist");
    }
    chat.get("user:" + id, function (err, res) {
        if (err) {
            return callback(err);
        }
        return callback(null, res.value);
    })
};

var getUserByKey = function (key, callback) {
    console.log("----- getUserByKey -----");
    if (!key) {
        return callback("key does not exist");
    }
    var query = N1qlQuery.fromString("select * from chat2 where apikey = '" + key + "'");

    chat.query(query, function (err, res, info) {
        if (err || res.length === 0) {
            return callback(err || "user with this key does not exist");
        }
        return callback(null, res[0].chat2);
    })
}

var getUsers = function (users_ids, callback) {     //get documents(users datas) by users ids
    console.log("----getUsers---");

    var query = N1qlQuery.fromString('SELECT * FROM chat2 where id in ' + JSON.stringify(users_ids));
    chat.query(query, function (err, res, info) {
        if (err) {
            return callback(err);
        }
        var users = [];
        res.forEach(function (json) {
            users.push(json.chat2);
        })
        return callback(null, users);
    })
}

var saveUser = function (user, callback) {
    console.log("----- saveuser -----");
    user.last_date = Date.now();
    user.history = [];
    user.apikey = user.key;
    user._type = "user";

    var query = N1qlQuery.fromString("insert into chat2 (key, value) values ('user:"
        + user.id + "', " + JSON.stringify(user) + ") returning *");

    chat.query(query, function (err, res, info) {
        console.log(info);
        if (err || res.length === 0) {
            return callback(err || "user insert error");
        }
        return callback(null, res[0].chat2);
    })
}

var updateUser = function (user, callback) {     //update document
    console.log("----- updateuser -----");
    chat.replace("user:" + user.id, user, function (err, res) {
        if (err) {
            return callback(err);
        }
        return callback(null, user);
    })
}

//********************  Connection

var Connection = function (ws) {
    this.token = rand();
    this.ws = ws;
    this.id = null;
    this.key = null;
};

var ConnectionManager = function () {

    this.connections = [];

    this.addConnection = function (connection) {
        this.connections.push(connection);
    };

    this.removeConnectionByToken = function (token) {
        for (var i = 0; i < this.connections.length; i++) {
            if (this.connections[i].token == token) {
                this.connections.splice(i, 1);
            }
        }
    };

    this.getConnectionById = function (id, callback) {
        for (var i = 0; i < this.connections.length; i++) {
            if (this.connections[i].id == id) {
                return callback(null, this.connections[i]);
            }
        }
        return callback("connection doesn't exist");
    }

    this.getConnectionsByIds = function (ids, callback) {
        var conns = [];
        var that = this;
        ids.forEach(function (id) {
            that.connections.forEach(function (connection) {
                if (connection.id === id) {
                    conns.push(connection);
                }
            })
        })
        return callback(conns);
    }
};

var connectionManager = new ConnectionManager();

wss.on("connection", function (ws) {

    console.log("websocket connection open");
    ws.send(JSON.stringify({message: "websocket connection open"}));

    var connection = new Connection(ws);
    connectionManager.addConnection(connection);

    ws.on('message', function (message) {

        console.log("-----------------------------new message from " + (connection.id || connection.token) + "--------");
        try {
            var json = JSON.parse(message);
            console.log(json);

            if (json && json.method) {
                authenticate(json.params, connection, function (err, user) {
                    if (user) {
                        console.log("restore connection by key");
                        if (json.method == 'key/exist') {
                            connection.id = user.id;
                            connection.key = user.key;
                            console.log("success");
                            ws.send(JSON.stringify({
                                result: {
                                    token: connection.token,
                                    user: user
                                },
                                error: null,
                                method: json.method
                            }));

                            isOnlineOrOffline(connection.key, function (err, connections) {
                                connections.forEach(function (conn) {
                                    console.log(conn.id);
                                    conn.ws.send(JSON.stringify({
                                        result: {user: connection.id, status: true},
                                        error: null,
                                        method: "onlineOrOffline"
                                    }));
                                })
                            });
                        } else {
                            ws.send(JSON.stringify({
                                result: null,
                                error: err,
                                method: json.method
                            }));
                        }

                    } else if (err === "for sign-up or sign-in") {

                        console.log(err);
                        switch (json.method) {
                            case 'sign-in':
                                signin(json.params, function (err, user) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(user.key);
                                        connection.id = user.id;
                                        connection.key = user.key;
                                        getUserByKey(connection.key, function (err, userChat) {
                                            if (userChat) {
                                                console.log("success");
                                                ws.send(JSON.stringify({
                                                    result: {
                                                        token: connection.token,
                                                        user: userChat
                                                    },
                                                    error: null,
                                                    method: json.method
                                                }));
                                                isOnlineOrOffline(connection.key, function (err, connections) {
                                                    connections.forEach(function (conn) {
                                                        console.log(conn.id);
                                                        conn.ws.send(JSON.stringify({
                                                            result: {user: connection.id, status: true},
                                                            error: null,
                                                            method: "onlineOrOffline"
                                                        }));
                                                    })
                                                });
                                            } else {
                                                saveUser(user, function (err, userChat) {
                                                    if (userChat) {
                                                        console.log("success");
                                                        ws.send(JSON.stringify({
                                                            result: {
                                                                token: connection.token,
                                                                user: userChat
                                                            },
                                                            error: null,
                                                            method: json.method
                                                        }));
                                                        isOnlineOrOffline(connection.key, function (err, connections) {
                                                            connections.forEach(function (conn) {
                                                                console.log(conn.id);
                                                                conn.ws.send(JSON.stringify({
                                                                    result: {user: connection.id, status: true},
                                                                    error: null,
                                                                    method: "onlineOrOffline"
                                                                }));
                                                            })
                                                        });
                                                    } else {
                                                        console.log(err);
                                                        ws.send(JSON.stringify({
                                                            result: null,
                                                            error: err,
                                                            method: json.method
                                                        }));
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                                break;
                            case 'sign-up':
                                signup(json.params, function (err, user) {
                                    if (!user) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        connection.id = user.id;
                                        connection.key = user.key;
                                        console.log(user.key);
                                        saveUser(user, function (err, userChat) {
                                            if (userChat) {
                                                console.log("success");
                                                ws.send(JSON.stringify({
                                                    result: {
                                                        token: connection.token,
                                                        user: userChat
                                                    },
                                                    error: null,
                                                    method: json.method

                                                }));
                                                isOnlineOrOffline(connection.key, function (err, connections) {
                                                    connections.forEach(function (conn) {
                                                        console.log(conn.id);
                                                        conn.ws.send(JSON.stringify({
                                                            result: {user: connection.id, status: true},
                                                            error: null,
                                                            method: "onlineOrOffline"
                                                        }));
                                                    })
                                                });
                                            } else {
                                                console.log(err);
                                                ws.send(JSON.stringify({
                                                    result: null,
                                                    error: err,
                                                    method: json.method
                                                }));
                                            }
                                        })
                                    }

                                });
                                break;
                            default :
                                console.log("method error for sign-in or sign-up");
                                ws.send(JSON.stringify({
                                    result: null,
                                    error: "method error for sign-in or sign-up",
                                    method: json.method
                                }));
                        }

                    } else if (err) {

                        ws.send(JSON.stringify({
                            result: null,
                            error: err,
                            method: json.method
                        }));

                    } else {

                        console.log("---commands---");
                        switch (json.method) {
                            case 'history':
                                getHistory(connection.id, function (err, history) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log("success");
                                        ws.send(JSON.stringify({
                                            result: {history: history},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case  'load/messages':
                                loadMessages(connection.id, json.params.room_id, json.params.last_message, json.params.limit, function (err, messages) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log("success");
                                        ws.send(JSON.stringify({
                                            result: {messages: messages},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'read/message':
                                readMessage(connection.id, json.params.room_id, json.params.message_id, function (err, user) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log("success");
                                        ws.send(JSON.stringify({
                                            result: "success",
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'me':
                                getUser(connection.id, function (err, user) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        ws.send(JSON.stringify({
                                            result: {user: user},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case 'user/update':
                                update(connection.key, json.params, function (err, body) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(body);
                                        getUser(connection.id, function (err, user) {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    result: null,
                                                    error: err,
                                                    method: json.method
                                                }));
                                            } else {
                                                user.name = json.params.name || user.name;
                                                user.username = json.params.username || user.username;
                                                user.email = json.params.email || user.email;
                                                user.status_message = json.params.status_message || user.status_message;
                                                user.location.street = json.params.location_street || user.location.street;
                                                user.location.city = json.params.location_city || user.location.city;
                                                user.location.state = json.params.location_state || user.location.state;
                                                user.location.country = json.params.location_country || user.location.country;
                                                user.location.zip = json.params.location_zip || user.location.zip;
                                                updateUser(user, function (err, user) {
                                                    if (err) {
                                                        console.log(err);
                                                        ws.send(JSON.stringify({
                                                            result: null,
                                                            error: err,
                                                            method: json.method
                                                        }));
                                                    } else {
                                                        console.log("success");
                                                        connectionManager.getConnectionsByIds([connection.id], function (connections) {
                                                            connections.forEach(function (conn) {
                                                                conn.ws.send(JSON.stringify({
                                                                    result: {user: user},
                                                                    error: null,
                                                                    method: json.method
                                                                }));
                                                            })
                                                        })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                });
                                break;
                            case 'user/search/id':
                                searchUser(json.params.id, connection.key, function (err, user) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        isChatUser([user], function (err, users) {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    result: null,
                                                    error: err,
                                                    method: json.method
                                                }));
                                            } else {
                                                console.log("success");
                                                ws.send(JSON.stringify({
                                                    result: {user: users[0]},
                                                    error: null,
                                                    method: json.method
                                                }));
                                            }
                                        });
                                    }
                                });
                                break;
                            case 'followings/get':
                                getFollowings(connection.key, function (err, followings) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        isChatUser(followings, function (err, followings) {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    result: null,
                                                    error: err,
                                                    method: json.method
                                                }));
                                            } else {
                                                console.log("success");
                                                ws.send(JSON.stringify({
                                                    result: {followings: followings},
                                                    error: null,
                                                    method: json.method
                                                }));
                                            }
                                        })
                                    }
                                });
                                break;
                            case 'followings/add':
                                addFollowing(connection.key, json.params.user_id, function (err, res) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(res);
                                        ws.send(JSON.stringify({
                                            result: {body: res.message},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case 'followings/remove':
                                removeFollowing(connection.key, json.params.user_id, function (err, res) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(res);
                                        ws.send(JSON.stringify({
                                            result: {message: res.message},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case 'followers/get':
                                getFollowers(connection.id, function (err, followers) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        isChatUser(followers, function (err, followers) {
                                            if (err) {
                                                ws.send(JSON.stringify({
                                                    result: null,
                                                    error: err,
                                                    method: json.method
                                                }));
                                            } else {
                                                console.log("success");
                                                ws.send(JSON.stringify({
                                                    result: {followings: followers},
                                                    error: null,
                                                    method: json.method
                                                }));
                                            }
                                        })
                                    }
                                })
                                break;
                            case 'users/block':
                                blockUser(connection.key, json.params.user_id, function (err, body) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(body);
                                        ws.send(JSON.stringify({
                                            result: {user: json.params.user_id},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case 'users/unblock':
                                unblockUser(connection.key, json.params.user_id, function (err, body) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(body);
                                        ws.send(JSON.stringify({
                                            result: {user: json.params.user_id},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'search':
                                search(json.params.searching, function (err, users) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log("success");
                                        ws.send(JSON.stringify({
                                            result: {users: users},
                                            error: err,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'message/add':
                                addMessage(connection.id, json.params.users_ids || [], json.params.body, json.params.room_id, function (err, connections, room_id, message) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(message);
                                        console.log(connections.length);
                                        connections.forEach(function (connection) {
                                            if (json.params.room_id) {
                                                console.log(connection.id, "exist");
                                                connection.ws.send(JSON.stringify({
                                                    result: {
                                                        room: "exist",
                                                        room_id: room_id,
                                                        message: message
                                                    },
                                                    error: null,
                                                    method: json.method
                                                }));
                                            } else {
                                                console.log(connection.id, "new");
                                                connection.ws.send(JSON.stringify({
                                                    result: {
                                                        room: "new",
                                                        room_id: room_id,
                                                        message: message
                                                    },
                                                    error: null,
                                                    method: json.method
                                                }));
                                            }
                                        })
                                    }
                                })
                                break;
                            case 'message/remove':
                                removeMessage(connection.id, json.params.room_id, json.params.message_id, function (err, res) {
                                    if (err) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        ws.send(JSON.stringify({
                                            result: {
                                                room_id: json.params.room_id,
                                                message_id: json.params.message_id
                                            },
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'message/edit':
                                editMessage(connection.id, json.params.room_id, json.params.message_id, json.params.body, function (err, connections) {
                                    if (err) {
                                        console.log(err);
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err,
                                            method: json.method
                                        }));
                                    } else {
                                        console.log("success");
                                        console.log(connections.length);
                                        connections.forEach(function (connection) {
                                            connection.ws.send(JSON.stringify({
                                                result: {
                                                    room_id: json.params.room_id,
                                                    message_id: json.params.message_id,
                                                    body: json.params.body
                                                },
                                                error: null,
                                                method: json.method
                                            }));
                                        })
                                    }
                                })
                                break;
                            case 'room/remove':
                                removeRoom(connection.id, json.params.room_id, function (err, res) {
                                    if (err) {

                                    } else {
                                        ws.send(JSON.stringify({
                                            result: {room_id: json.params.room_id},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                })
                                break;
                            case 'invite/send':
                                invite(connection.key, json.params.id, function (err, result) {
                                    if (err) {

                                    } else {
                                        ws.send(JSON.stringify({
                                            result: {body: result},
                                            error: null,
                                            method: json.method
                                        }));
                                    }
                                });
                                break;
                            case 'typing':
                                typing(connection.id, json.params.room_id, function (err, connections) {
                                    if (err || (typeof json.params.isTyping === "undefined")) {
                                        ws.send(JSON.stringify({
                                            result: null,
                                            error: err || "isTyping does not exist",
                                            method: json.method
                                        }));
                                    } else {
                                        console.log(connections.length);
                                        connections.forEach(function (conn) {
                                            console.log(conn.id);
                                            conn.ws.send(JSON.stringify({
                                                result: {
                                                    room_id: json.params.room_id,
                                                    user: connection.id,
                                                    isTyping: json.params.isTyping
                                                },
                                                error: null,
                                                method: json.method
                                            }));
                                        })
                                    }
                                });
                                break;
                            default :
                                ws.send(JSON.stringify({
                                    result: null,
                                    error: "url is not correct",
                                    method: json.method
                                }));
                        }

                    }
                })
            } else {
                console.log("method doesn't specified!");
                ws.send(JSON.stringify({
                    result: null,
                    error: "method doesn't specified!",
                    method: json.method
                }));
            }
        } catch (err) {
            console.log("json format errror " + err);
            ws.send(JSON.stringify({
                result: null,
                error: "json format error " + err,
                method: json.method
            }));
        }

    });

    ws.on('error', function (err) {
        console.log("ERROR -> " + err)
    });

    ws.on("close", function () {
        //worked when user click sign-out
        console.log("websocket connection close");

        console.log(connectionManager.connections.length);
        connectionManager.removeConnectionByToken(connection.token);
        console.log(connectionManager.connections.length);

        if (connection.id) {
            var query = N1qlQuery.fromString("update chat2 set last_date = '" + new Date() + "' where id = " + connection.id);

            chat.query(query, function (err, res, info) {
                console.log("update user last_date info", info.metrics.mutationCount);
            })

            isOnlineOrOffline(connection.key, function (err, connections) {
                connections.forEach(function (conn) {
                    console.log(conn.id, "false");
                    conn.ws.send(JSON.stringify({
                        result: {user: connection.id, status: false},
                        error: null,
                        method: "onlineOrOffline"
                    }));
                })
            });
        }
    })
})
