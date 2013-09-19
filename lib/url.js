var http = require('http');
var cheerio = require('cheerio');
var sanitize = require('validator').sanitize;
var async = require('async');
var fs = require('fs');


var BASE_URL = 'http://cnodejs.org'

var scrapy = {}

/**
 * Get page from url.
 *
 * Examples:
 *
 *     scrapy.get('http://www.baidu.com', cb);
 *     // => 'baidu page html
 * 
 * @interface
 * @param {String} url:ex http://www.baidu.com
 * @param {Function} cb
 * @private
 */

scrapy.get = function(url, cb){
  http.get(url, function(res) {

    var size = 0;
    var chunks = [];

    res.on('data', function(chunk){
      size += chunk.length;
      chunks.push(chunk);
    });

    res.on('end', function(){
      var data = Buffer.concat(chunks, size);
      cb(null, data);
    });

  }).on('error', function(e) {
    cb(e, null);
  });
}


var Urls = function(startUrl){
  this.startUrl = startUrl;
  this.page = 0;
  this.homePage = '';
}

Urls.prototype.next = function(cb){
  var self = this;

  this.hasNext(function(err, bRet){
    if(!bRet){
      return null;
    }

    self.homeParse(function(err, topics){
      self.page += 1;
      cb(null, topics);
    })
  })
}

Urls.prototype.hasNext = function(cb){
  var self = this;
  var url = this.startUrl + this.page;

  scrapy.get(url, function(err, data){
    var html = data.toString();
    $ = cheerio.load(html);
    self.homePage = $('.cell .topic_wrap a');

    if(self.homePage.length === 0){
      return cb(null, false);
    }

    return cb(null, true);

  });
};

Urls.prototype.homeParse = function(cb){
  var self = this;
  var topics = [];

  async.filter(self.homePage, function(i, cb){
    var url = BASE_URL + self.homePage[i].attribs['href']
    scrapy.get(url, function(err, topic){
      topics.push(topic.toString());
      cb(null);
    })
    
  },function(err){
    cb(err, topics);
  });
}

Urls.prototype.parseTopic = function(html){
  $ = cheerio.load(html);
  var topic = $('.inner.topic');
  var item = {};
  item.title = sanitize(topic.children('h3').text()).trim();
  item.content = sanitize(topic.children('.topic_content').text()).trim();

  return item;
};


Urls.prototype.Pipeline = function(items){

  var result = JSON.stringify(items);
  fs.writeFileSync('result.txt', result)

}

exports = module.exports = Urls
