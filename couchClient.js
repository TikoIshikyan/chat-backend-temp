var couchbase = require('couchbase');
var N1qlQuery = require('couchbase').N1qlQuery;
var myCluster = new couchbase.Cluster('couchbase://localhost:8091');
var users = myCluster.openBucket('users');
var chat = myCluster.openBucket('chat');
users.enableN1ql(['localhost:8093']);
var request = require('request');
var async = require('async');


//var ids = ["7f711053-45a8-4d08-b120-b96b1f3e5c93"];
//
//ids.push("aee0e67d-1241-4aa6-9cca-371a7cfe8102");

//rooms.insert("wercfs", {id: "cs"}, function (err, res, info) {
//    console.log(res);
//    console.log(info);
//})

//console.log("".trim().length);

var users_ids = [1814853001102, 181485720001102];

//async.each(users_ids, function (id, cb) {
//    console.log("1");
//    cb();
//}, function (err) {
//    console.log("2");
//})

var room_id = "lQsUoxhGW28W6qCyFnGd";


//var arr1 = [1,2,3,4,5,6];
//var arr2 = arr1.slice();
//
//arr2.push(7);
//
//console.log(arr1);
////
//function getUser(id, done){
//    if (isExsisteInChat()) {
//        db.getUser(arg, function(err, user) {
//            done(user);
//        })
//    } else {
//        createUser(function(err, isCreated){
//           if (isCreated) {
//              getUser(id, done);
//           }
//        });
//    }
//}
//
//function isExisted() {
//    return p;
//}
//
//function getFromDb() {
//    return p;
//}
//
//function createUser() {
//    return p;
//}
//
//function getUser(id){
//    isExisted().then(function(isExisted){
//        if (isExisted) {
//            getFromDb().then(p.resolve);
//        } else{
//            createUser().then(getFromDb).then(p.resolve).then(JSON.parse).catch(errorHandler)
//        }
//    });
//}
//
//function qTest(err, result) {
//    if(err) return p.reject(err);
//    return p.resolve(result);
//}
//
//function qCall(){
//    var p = {};
//    qTest(sepcCall(p));
//    return p;
//}
//
//


//users.get(("hhh").toString(), function (err, res) {
//    if (err && err.code == 13) {
//        console.log("user does not exist");
//    } else {
//        console.log(res);
//    }
//})

var id = 181485386001102;
var rid = "room:tHx5DPq6kNmUL0DuiKoS";
var mid = "message:TpVDSI9WzXGgjy7frbxj"
var body = "poxac 2";

var arr = [1, 2, 3];
console.log(arr.reverse());

//var query = N1qlQuery.fromString("select * from chat where _type = 'message' and room_id = '"
//    + "room:3KGRMmSnFdxub1WJeh0y" + "' order by date desc limit 9");
//

var query = N1qlQuery.fromString("update chat set arr = ARRAY_APPEND(deleted_for, '" + id +
    "') where meta().id = 'message:zbu9hrVJl1D64okjJFQE'");

chat.query(query, function (err, res, info) {
    if (err) {
        console.log(err);
    }
    console.log(res);
})

//var query = N1qlQuery.fromString('Update users set history = ARRAY_REMOVE(history, "' + room_id
//    + '") where id = ' + users_ids[1] );
//
//users.query(query, function (err, metrics, zzz) {
//    if (err) {
//        console.log(err);
//    }
//    console.log(zzz);
//})
//
//var ids = [];
//users_ids.forEach(function (id) {
//    if (typeof  id === 'number') {
//        ids.push(id);
//    }
//})
//
//var query = N1qlQuery.fromString('SELECT * FROM users where id in ' + JSON.stringify(ids));
//users.query(query, function (err, res) {
//
//    console.log("in getbyid res", res);
//    var users = [];
//    res.forEach(function (json) {
//        users.push(json.users);
//    })
//    console.log("in getbyid users", users);
//})

//var users_ids = [181485386001102,181485720001102];
//
//var room_id = "sfsbvjkjfahbrw";
//
//var query = N1qlQuery.fromString('Update users set history = ARRAY_APPEND(history,"' + room_id + '") where id in ' + JSON.stringify(users_ids));

//users.query(query, function (err, res) {
//    if (err) {
//        console.log(err);
//    }
//    console.log(res);
//})

//users.replace("bbb", {x: "xxx"}, function (err, res) {
//    console.log(res);
//})

//var query = N1qlQuery.fromString('SELECT * FROM chat where _type = "message" order by date limit 3');
//chat.query(query, function (err, res) {
//    if (err) {
//
//    }
//    console.log(res);
//})


//chat.getMulti(users_ids, function (err, users, info) {
//    if (err) {
//        console.log(err);
//    } else {
//        console.log(users);
//    }
//
//})
