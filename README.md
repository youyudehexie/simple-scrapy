simple-scrapy
=============

#详解Node.js API系列 Http模块(2) CNodejs爬虫实现

##简单爬虫设计

    var http = require('http');
    http.get("http://cnodejs.org/", function(res) {
    	var size = 0;
    	var chunks = [];
      res.on('data', function(chunk){
      	size += chunk.length;
      	chunks.push(chunk);
      });
      res.on('end', function(){
      	var data = Buffer.concat(chunks, size);
      	console.log(data.toString())
      });
    }).on('error', function(e) {
      console.log("Got error: " + e.message);
    });
    
###http.get(options, callback)

- http://cnodejs.org/ 爬行目标地址。
- res.on('data') 监听data事件。
- res.on('end') 数据获取完毕事件。
- Buffer.concat(chunks, size); 连接多次data的buff。
- data.toString() 将data二进制数据转换成utf-8的字符串，如果页面是GBK的时候，请使用iconv模块进行转换，原生Node.js不支持GBK。

##设计目标

- 制定爬虫的url规则
- 分析页面信息
- 清洗没用数据
- 存储有用数据

##制定爬虫的url规则

观察 http://cnodejs.org/ 的url规则，http://cnodejs.org/?page=页数， 根据规则，不难想出处理的思路，首先获取用迭代器模式是最方便的，首先，获取单个page页里面的单个page路径，通过路径爬取page的页面内容。采用迭代器模式是最方便的，next()做page的页面索引，hasNext()判断page页是否超出了有效范围,超出范围则停止索引，下面是伪代码

    var Urls = function(start_url){
      this.start_url = start_url; //base url
      this.page = 0;  //url page
      this.targetPage = ''; //topic page
    }
    Urls.prototype.next = function(){
      var data;
      if (!this.hasNext()) {
          return null;
      }
      this.page += 1;
      data = request.get(this.targetPage)  //get topic page
      return data;
    }
    Urls.prototype.hasNext = function(){
      //http://cnodejs.org/p=[1,2,3,4]
      var url = this.start_url + this.page;
      // if get page success from url,return ture,or return false
      // get topic page url
    }
    // main     
    var urls = new Urls();
    while(urls.hasNext()){
      console.log(urls.next());
    }
    
##分析页面数据

分析页面的过程，主要工作是分析页面的元素提取出目标的内容，例如正文和评论等。这里我们需要采用cheerio的第三方库,该模块采取类似Jquery方式的DOM选择器，通过DOM选择器来实现信息提取。

    npm install cheerio

项目地址：https://github.com/MatthewMueller/cheerio

官方demo例子

    var cheerio = require('cheerio'),
        $ = cheerio.load('<h2 class="title">Hello world</h2>');
    
    $('h2.title').text('Hello there!');
    $('h2').addClass('welcome');
    
    $.html();
    //=> <h2 class="title welcome">Hello there!</h2>
    
提取cnodejs的topics 链接

    $ = cheerio.load(data); //data是的页面数据
    topics = $('.cell .topic_wrap a')
    for(var i=0; i < topics.length; i++){
    console.log(topics[i].attribs['href'])
    
    result：
    
    /topic/52386d26101e574521a12ccd
    /topic/5232cd39101e57452106ce5a
    /topic/52390cdb101e574521b1e252
    /topic/521b1dcabee8d3cb128c56dd
    /topic/5238c6d2101e574521aaca13
    /topic/52380b4e101e57452193617c
    
内容信息提取

提取condejs帖子内容和标题

    $ = cheerio.load(data);  
    var topic = $('.inner.topic');  
    console.log(topic.children('h3').text()) //标题
    var content = topic.children('.topic_content').text()
    console.log(content);   //文章内容
    
##清洗没用的数据

由于爬取的内容，可能带有html标签或者表情方面的信息，可能跟目标内容不符合，通过这个环节来过滤，这里向大家推荐一个模块 validator,该模块可以过滤xss攻击，字符串里面的空格，判断内容的属性等，详细可以到项目地址学习 https://github.com/chriso/node-validator

安装

    npm install validator

demo例子

    var check = require('validator').check,
        sanitize = require('validator').sanitize
    //Validate
    check('test@email.com').len(6, 64).isEmail();        //Methods are chainable
    check('abc').isInt();                                //Throws 'Invalid integer'
    check('abc', 'Please enter a number').isInt();       //Throws 'Please enter a number'
    check('abcdefghijklmnopzrtsuvqxyz').is(/^[a-z]+$/);
    //Set a message per validator
    check('foo', {
        isNumeric: 'This is not a number',
        contains: 'The value doesn\'t have a 0 in it'
    }).isNumeric().contains('0');
    //Referencing validator args from the message
    check('foo', 'The message needs to be between %1 and %2 characters long (you passed "%0")').len(2, 6);
    //Sanitize / Filter
    var int = sanitize('0123').toInt();                  //123
    var bool = sanitize('true').toBoolean();             //true
    var str = sanitize(' \t\r hello \n').trim();         //'hello'
    var str = sanitize('aaaaaaaaab').ltrim('a');         //'b'
    var str = sanitize(large_input_str).xss();
    var str = sanitize('&lt;a&gt;').entityDecode();      //'<a>'
    
过滤刚才爬取的内容，主要是过滤空格

    var topic = $('.inner.topic');  
    title = topic.children('h3').text() //标题
    sanitize(title).trim()

##存储有用数据

咸鱼白菜各有所需，对于游泳的数据，可以存成文本，也可以存到数据库，本次实例，为了足够精简，所以不采用数据库存储，采用文本的方式记录和json的格式记录数据。

一个爬虫的流程完成了，我们来重新看看实现代码

vi url.js

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
    
vi app.js
    
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
    
完整项目地址：https://github.com/youyudehexie/simple-scrapy





    

    







