var Urls = require('./lib/url.js');
var async = require('async');


var startUrl = 'http://cnodejs.org/?page='

var urls = new Urls(startUrl);

urls.next(function(err, topics){
  var self = this;
  var items = [];
  async.filter(topics, function(topic, cb){
    items.push(urls.parseTopic(topic));
    cb(null);
  },function(err){
    urls.Pipeline(items);
  })

})

