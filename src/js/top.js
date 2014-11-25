/*!
* currentScriptPath
* 
* Author: ???
* Modified by: Jack Matier (self@jackalyst.com) to return String instead of calling function.
* Updated: 20141026
* License: MIT
*/
var currentScriptPath = (function () {
    var scripts = document.querySelectorAll( 'script[src]' );
    var currentScript = scripts[ scripts.length - 1 ].src;
    var currentScriptChunks = currentScript.split( '/' );
    var currentScriptFile = currentScriptChunks[ currentScriptChunks.length - 1 ];

    return currentScript.replace( currentScriptFile, '' );
})();
var currentStylePath = currentScriptPath.replace(/[a-z]*\/$/g,'') + 'css/';


/*!
 * Backwards Compatibility for addEventListener, removeEventListener, Event.preventDefault and Event.stopPropagation
 *
 * Author: ???
 * Source: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget.addEventListener
 * Browsers: IE8
 * License: ???
 */
(function() {
  if (!Event.prototype.preventDefault) {
    Event.prototype.preventDefault=function() {
      this.returnValue=false;
    };
  }
  if (!Event.prototype.stopPropagation) {
    Event.prototype.stopPropagation=function() {
      this.cancelBubble=true;
    };
  }
  if (!Element.prototype.addEventListener) {
    var eventListeners=[];
    
    var addEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var self=this;
      var wrapper=function(e) {
        e.target=e.srcElement;
        e.currentTarget=self;
        if (listener.handleEvent) {
          listener.handleEvent(e);
        } else {
          listener.call(self,e);
        }
      };
      if (type=="DOMContentLoaded") {
        var wrapper2=function(e) {
          if (document.readyState=="complete") {
            wrapper(e);
          }
        };
        document.attachEvent("onreadystatechange",wrapper2);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper2});
        
        if (document.readyState=="complete") {
          var e=new Event();
          e.srcElement=window;
          wrapper2(e);
        }
      } else {
        this.attachEvent("on"+type,wrapper);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper});
      }
    };
    var removeEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var counter=0;
      while (counter<eventListeners.length) {
        var eventListener=eventListeners[counter];
        if (eventListener.object==this && eventListener.type==type && eventListener.listener==listener) {
          if (type=="DOMContentLoaded") {
            this.detachEvent("onreadystatechange",eventListener.wrapper);
          } else {
            this.detachEvent("on"+type,eventListener.wrapper);
          }
          eventListeners.splice(counter, 1);
          break;
        }
        ++counter;
      }
    };
    Element.prototype.addEventListener=addEventListener;
    Element.prototype.removeEventListener=removeEventListener;
    if (HTMLDocument) {
      HTMLDocument.prototype.addEventListener=addEventListener;
      HTMLDocument.prototype.removeEventListener=removeEventListener;
    }
    if (Window) {
      Window.prototype.addEventListener=addEventListener;
      Window.prototype.removeEventListener=removeEventListener;
    }
  }
})();

/*!
 * top.js
 *
 * Loading in of requirejs and components.
 *
 * Author: Jack Matier
 * 
 */
(function(url,callback) {
	'use strict';

	  var head = document.getElementsByTagName('head')[0];
	var script = document.createElement('script');

   script.type = 'text/javascript';
	script.src = url;

	script.onreadystatechange = callback;
	script.onload = callback;

	head.appendChild(script);
})(currentScriptPath + 'require.min.js', function() {
	require.config({
		baseUrl: currentScriptPath
	});

	function top_init() {
		console.log('okay');
		function checkcss(selector, callback) {			
			return (document.querySelector(selector) === null) ? false : true; 
		}

		// Is this blocking?
		function loadcss(selector, url) {
			if(document.querySelector(selector) !== null) {
			    var link = document.createElement("link");
			    link.type = "text/css";
			    link.rel = "stylesheet";
			    link.href = url;
			    document.getElementsByTagName("head")[0].appendChild(link);
			}
		}

		/* font-awesome */
		loadcss('[class*=fa-]',  currentStylePath + 'font-awesome.min.css');

		/* Is topio used */
		if(checkcss('.topio')) {
			require(['topio.min'], function(io) {});
		}
	}

	if(document.readyState != 'complete' && document.readyState != 'interactive') {
		document.onreadystatechange = function() {
				if(document.readyState == 'complete' || document.readyState == 'interactive') {
					top_init();
				}
		};
	} else {
		top_init();
	}
});