/**
 * Qboot.load v0.6 lite
 * lite版 去除引入核心文件自动加载机制
 * Date:2012.8.25+
 * Copyright 2012, irideas & 月影
 *
 * CHANGE LOG:
 * 03.19 2013 第一个参数是方法失败的情况
 * 06.11 2012 document.getElementsByTagName('script')[0].hasOwnProperty("parentNode"); Chrome18返回TRUE,坑爹啊
 * 12.09 2011 加入done方法 外部可设置该模块状态为完成
 * 11.16 2011 qboot.add 配置中加入force属性 强行拉取
 * 05.09 2011 qboot.load.css 支持传入第二个可选参数 默认为:inline-css-id
 *
 * BUG :
 * load.css 在HEAD中使用 IE6会中止加载 某些特殊条件下...(都遗忘了)
 *

 * TODO:
 * 场景load(url) 需要用一个通用配置 如charset等
 * load.css(string,id) 对同一ID的使用有时不需要追加 而是剔除
 
 * USAGE:
 * var qload = qboot.load;

 * [1] qload("http://tuan.360.cn/scripts/jquery-1.4.4.min.js"); 
 * //直接调用外部JS

 * [2] qload("http://tuan.360.cn/styles/reset.css");
 * //直接调用外部CSS
 
 * [3] qload.add('lightBoxCss', {path: 'http://leandrovieira.com/projects/jquery/lightbox/css/jquery.lightbox-0.4.css', type: 'css'});
 * //定义lightBoxCss 配置 path:'文件地址',type:'css'

 * [4] qload.add('lightBoxJs', {path: 'http://leandrovieira.com/projects/jquery/lightbox/js/jquery.lightbox-0.4.js', type: 'js', requires: ['lightBox-css']});
 * //定义lightBoxJs  配置 path:'文件地址',type:'js',requires['定义1','定义2'],force:true/false（是否每次强行拉取 默认:false） 

 * [5] qload('lightBoxJs', function(){});
 * //引用lightBoxJs 

 * [6] qload.done('lightBoxJs');
 * //当配置lightBoxJs不强行拉取时，可在某些时机设置以完成

 * [7] qload.css(".dialog .hd h3 { margin:0; }.dialog-close:link { text-decoration:none; }","qboot-inline-css");
 * //直接插入CSS代码,参数2为指定ID
 
 * [8] qload.delay(2000,'lightBoxJs',function() {});
 * //延期执行或延期加载
 
 * [9] qload({name: 'jQuery1.4.4', path:"http://tuan.360.cn/scripts/jquery-1.4.4.min.js",type:"js"}, callback);
 * //直接用配置的方式加载js
 *
 * [10] qload(function(){});
 * //塞入方法
**/
qboot.load = qboot.load||{};
qboot.load = (function() {
var _doc = document,
_win = window,
// 已加载模块, _loaded[fileURL]=true
_loaded = {},
// 加载中的模块，对付慢文件，_loadingQueue[url]=true|false
_loadingQueue = {},
_isArray = function(e) { return e.constructor === Array; },
// 内部配置文件
_config = {
    //模块依赖
    //{
    // moduleName: {
    //     path: 'URL',
    //     type:'js|css',
    //     requires:['moduleName1', 'fileURL']
    //   }
    //}
    mods: {}
},
// 插入的参考结点
_jsFiles = _doc.getElementsByTagName('script'),
_jsSelf = _jsFiles[_jsFiles.length - 1],
_do,
_removeScriptTag = function(node){
    if (node.clearAttributes) {
        node.clearAttributes();
    } else {
        for (var attr in node) {
            if (node.hasOwnProperty(attr)&&attr.toLowerCase()!=="parentnode") {
                delete node[attr];
            }
        }
    }
    if(node && node.parentNode){
        node.parentNode.removeChild(node);
    }
    node = null;
},
_addScriptOnload = _doc.createElement('script').readyState ?
    function(node, callback) {
        node.onreadystatechange = function() {
            var rs = node.readyState;
            if (rs === 'loaded' || rs === 'complete') {
                node.onreadystatechange = null;
                callback.apply(this);
            }
        };
    } :
    function(node, callback) {
        node.addEventListener('load', callback, false);
    },
// 加载js/css文件
_load = function(url, type, charset, force, cb, context) {
    var refFile = _jsSelf;
    if (!url) {
        return;
    }
    if (_loaded[url]) {
        _loadingQueue[url] = false;
        if(!force)
        {
            cb&&cb(url, context);
            return;
        }
    }
    // 加载中的文件有可能是太大，有可能是404
    // 当加载队列中再次出现此模块会再次加载，理论上会出现重复加载
    if (_loadingQueue[url]) {
        setTimeout(function() {
            _load(url, type, charset, force, cb, context);
        }, 1);
        return;
    }
    _loadingQueue[url] = true;
    var n;
    if (type === 'js' || url.indexOf('.js') >= 0) {
        n = _doc.createElement('script');
        n.setAttribute('type', 'text/javascript');
        charset&&(n.charset = charset);
        n.setAttribute('src', url);
        n.setAttribute('async', true);

        _addScriptOnload(n,function(){
            _loaded[url] = true;
            cb&&cb(url, context);
            _removeScriptTag(n);
        });
        refFile.parentNode.insertBefore(n, refFile);
    } else if (type === 'css' || url.indexOf('.css') >= 0) {
        n = _doc.createElement('link');
        n.setAttribute('type', 'text/css');
        charset&&(n.charset = charset);
        n.setAttribute('rel', 'stylesheet');
        n.setAttribute('href', url);
        _loaded[url] = true;
        // CSS无必要监听是否加载完毕
        refFile.parentNode.insertBefore(n, refFile);
        cb&&cb(url, context);
        return;
    }
},
// 计算加载队列。参数e是一个数组
_calculate = function(e) {
    if (!e || !_isArray(e)) {
        return;
    }
    var i = 0,
    item,
    result = [],
    mods = _config.mods,
    depeList = [],
    hasAdded = {},
    getDepeList = function(e) {
        var i = 0, m, reqs;

        // break loop require.
        if (hasAdded[e]) {
            return depeList;
        }
        hasAdded[e] = true;

        if (mods[e].requires) {
            reqs = mods[e].requires;
            for (; typeof (m = reqs[i++]) !== 'undefined';) {
              // is a module.
              if (mods[m]) {
                getDepeList(m);
                depeList.push(m);
               } else {
                // is a file.
                depeList.push(m);
               }
            }
            return depeList;
        }
        return depeList;
    };
    for (; typeof (item = e[i++]) !== 'undefined'; ) {
        if (mods[item] && mods[item].requires && mods[item].requires[0]) {
            depeList = [];
            hasAdded = {};
            result = result.concat(getDepeList(item));
        }
        result.push(item);
    }

    return result;
},
// 一个异步队列对象
_Queue = function(e) {
    if (!e || !_isArray(e)) {
        return;
    }
    this.queue = e;
    // 队列当前要加载的模块
    this.current = null;
};
_Queue.prototype = {
    _interval: 10,
    start: function() {
        var o = this;
        this.current = this.next();
        if (!this.current) {
            this.end = true;
            return;
        }
        this.run();
    },
    run: function() {
        var o = this, mod, currentMod = this.current;
        if (typeof currentMod === 'function') {
            currentMod();
            this.start();
            return;
        } else if (typeof currentMod === 'string') {
            if (_config.mods[currentMod]) {
              mod = _config.mods[currentMod];
              _load(mod.path, mod.type, mod.charset, mod.force , function(e) {
                 o.start();
              }, o);
            } else if (/\.js|\.css/i.test(currentMod)) {
              // load a file.
              _load(currentMod, '', '', '', function(e, o) {
                 o.start();
              }, o);
            } else {
              // no found module. skip to next
              this.start();
           }
        }
    },
    next: function() { return this.queue.shift(); }
};
//API
_do = function() {
    var args = [].slice.call(arguments), thread;
    var target = args[0];
    //处理第一个参数是JSON的情况
    if(typeof target !== 'string'&&typeof target !== 'function'){
        var sName = target.name || target.path, 
            cb = target.callback || args[1];

        _do.add(sName, target);
        args[0] = sName;
        args[1] = cb;
    }
    thread = new _Queue(_calculate(args));
    thread.start();
};
_do.add = function(sName, oConfig) {
    if (!sName || !oConfig || !oConfig.path) {
        return;
    }
    _config.mods[sName] = oConfig;
};
_do.delay = function() {
   var args = [].slice.call(arguments), delay = args.shift();
   _win.setTimeout(function() {
     _do.apply(this, args);
   }, delay);
};
_do.done = function() {
    var args = [].slice.call(arguments),i=0,currentMod;
    for(;currentMod=args[i++];)
    {
        if (typeof currentMod === 'string') {
            if (_config.mods[currentMod]) {
              mod = _config.mods[currentMod];
              _loaded[mod.path] = true;
            } else if (/\.js|\.css/i.test(currentMod)) {
              _loaded[currentMod] = true;
            }
       }
    }
};
_do.css = function(str,id) {
 id = id || "qboot-inline-css";
 var css = _doc.getElementById(id);
 if (!css) {
   css = _doc.createElement('style');
   css.type = 'text/css';
   css.id = id;
   _doc.getElementsByTagName('head')[0].appendChild(css);
 }
 if (css.styleSheet) {
   css.styleSheet.cssText = css.styleSheet.cssText + str;
 } else {
   css.appendChild(_doc.createTextNode(str));
 }
};
return _do;
})();