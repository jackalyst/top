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
		function checkcss(selector, callback) { /* querySelector: IE8 */
			return (document.querySelector(selector)!==null);
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

        /* Is topio used */
        if(checkcss('[class*=topfn]')) {
          require(['topfn.min'], function(fn) {});
        }

	}

    /* Why didn't I write comments on this!? */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9wLmpzIiwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsInNvdXJjZXMiOlsidG9wLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxuKiBjdXJyZW50U2NyaXB0UGF0aFxuKiBcbiogQXV0aG9yOiA/Pz9cbiogTW9kaWZpZWQgYnk6IEphY2sgTWF0aWVyIChzZWxmQGphY2thbHlzdC5jb20pIHRvIHJldHVybiBTdHJpbmcgaW5zdGVhZCBvZiBjYWxsaW5nIGZ1bmN0aW9uLlxuKiBVcGRhdGVkOiAyMDE0MTAyNlxuKiBMaWNlbnNlOiBNSVRcbiovXG52YXIgY3VycmVudFNjcmlwdFBhdGggPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBzY3JpcHRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ3NjcmlwdFtzcmNdJyApO1xuICAgIHZhciBjdXJyZW50U2NyaXB0ID0gc2NyaXB0c1sgc2NyaXB0cy5sZW5ndGggLSAxIF0uc3JjO1xuICAgIHZhciBjdXJyZW50U2NyaXB0Q2h1bmtzID0gY3VycmVudFNjcmlwdC5zcGxpdCggJy8nICk7XG4gICAgdmFyIGN1cnJlbnRTY3JpcHRGaWxlID0gY3VycmVudFNjcmlwdENodW5rc1sgY3VycmVudFNjcmlwdENodW5rcy5sZW5ndGggLSAxIF07XG5cbiAgICByZXR1cm4gY3VycmVudFNjcmlwdC5yZXBsYWNlKCBjdXJyZW50U2NyaXB0RmlsZSwgJycgKTtcbn0pKCk7XG52YXIgY3VycmVudFN0eWxlUGF0aCA9IGN1cnJlbnRTY3JpcHRQYXRoLnJlcGxhY2UoL1thLXpdKlxcLyQvZywnJykgKyAnY3NzLyc7XG5cblxuXG5cbi8qIVxuICogQmFja3dhcmRzIENvbXBhdGliaWxpdHkgZm9yIGFkZEV2ZW50TGlzdGVuZXIsIHJlbW92ZUV2ZW50TGlzdGVuZXIsIEV2ZW50LnByZXZlbnREZWZhdWx0IGFuZCBFdmVudC5zdG9wUHJvcGFnYXRpb25cbiAqXG4gKiBBdXRob3I6ID8/P1xuICogU291cmNlOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRXZlbnRUYXJnZXQuYWRkRXZlbnRMaXN0ZW5lclxuICogQnJvd3NlcnM6IElFOFxuICogTGljZW5zZTogPz8/XG4gKi9cbihmdW5jdGlvbigpIHtcbiAgaWYgKCFFdmVudC5wcm90b3R5cGUucHJldmVudERlZmF1bHQpIHtcbiAgICBFdmVudC5wcm90b3R5cGUucHJldmVudERlZmF1bHQ9ZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJldHVyblZhbHVlPWZhbHNlO1xuICAgIH07XG4gIH1cbiAgaWYgKCFFdmVudC5wcm90b3R5cGUuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgRXZlbnQucHJvdG90eXBlLnN0b3BQcm9wYWdhdGlvbj1mdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuY2FuY2VsQnViYmxlPXRydWU7XG4gICAgfTtcbiAgfVxuICBpZiAoIUVsZW1lbnQucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICB2YXIgZXZlbnRMaXN0ZW5lcnM9W107XG4gICAgXG4gICAgdmFyIGFkZEV2ZW50TGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lciAvKiwgdXNlQ2FwdHVyZSAod2lsbCBiZSBpZ25vcmVkKSAqLykge1xuICAgICAgdmFyIHNlbGY9dGhpcztcbiAgICAgIHZhciB3cmFwcGVyPWZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS50YXJnZXQ9ZS5zcmNFbGVtZW50O1xuICAgICAgICBlLmN1cnJlbnRUYXJnZXQ9c2VsZjtcbiAgICAgICAgaWYgKGxpc3RlbmVyLmhhbmRsZUV2ZW50KSB7XG4gICAgICAgICAgbGlzdGVuZXIuaGFuZGxlRXZlbnQoZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGlzdGVuZXIuY2FsbChzZWxmLGUpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKHR5cGU9PVwiRE9NQ29udGVudExvYWRlZFwiKSB7XG4gICAgICAgIHZhciB3cmFwcGVyMj1mdW5jdGlvbihlKSB7XG4gICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGU9PVwiY29tcGxldGVcIikge1xuICAgICAgICAgICAgd3JhcHBlcihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGRvY3VtZW50LmF0dGFjaEV2ZW50KFwib25yZWFkeXN0YXRlY2hhbmdlXCIsd3JhcHBlcjIpO1xuICAgICAgICBldmVudExpc3RlbmVycy5wdXNoKHtvYmplY3Q6dGhpcyx0eXBlOnR5cGUsbGlzdGVuZXI6bGlzdGVuZXIsd3JhcHBlcjp3cmFwcGVyMn0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGU9PVwiY29tcGxldGVcIikge1xuICAgICAgICAgIHZhciBlPW5ldyBFdmVudCgpO1xuICAgICAgICAgIGUuc3JjRWxlbWVudD13aW5kb3c7XG4gICAgICAgICAgd3JhcHBlcjIoZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYXR0YWNoRXZlbnQoXCJvblwiK3R5cGUsd3JhcHBlcik7XG4gICAgICAgIGV2ZW50TGlzdGVuZXJzLnB1c2goe29iamVjdDp0aGlzLHR5cGU6dHlwZSxsaXN0ZW5lcjpsaXN0ZW5lcix3cmFwcGVyOndyYXBwZXJ9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciByZW1vdmVFdmVudExpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIgLyosIHVzZUNhcHR1cmUgKHdpbGwgYmUgaWdub3JlZCkgKi8pIHtcbiAgICAgIHZhciBjb3VudGVyPTA7XG4gICAgICB3aGlsZSAoY291bnRlcjxldmVudExpc3RlbmVycy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGV2ZW50TGlzdGVuZXI9ZXZlbnRMaXN0ZW5lcnNbY291bnRlcl07XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyLm9iamVjdD09dGhpcyAmJiBldmVudExpc3RlbmVyLnR5cGU9PXR5cGUgJiYgZXZlbnRMaXN0ZW5lci5saXN0ZW5lcj09bGlzdGVuZXIpIHtcbiAgICAgICAgICBpZiAodHlwZT09XCJET01Db250ZW50TG9hZGVkXCIpIHtcbiAgICAgICAgICAgIHRoaXMuZGV0YWNoRXZlbnQoXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIixldmVudExpc3RlbmVyLndyYXBwZXIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRldGFjaEV2ZW50KFwib25cIit0eXBlLGV2ZW50TGlzdGVuZXIud3JhcHBlcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGV2ZW50TGlzdGVuZXJzLnNwbGljZShjb3VudGVyLCAxKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICArK2NvdW50ZXI7XG4gICAgICB9XG4gICAgfTtcbiAgICBFbGVtZW50LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyPWFkZEV2ZW50TGlzdGVuZXI7XG4gICAgRWxlbWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcj1yZW1vdmVFdmVudExpc3RlbmVyO1xuICAgIGlmIChIVE1MRG9jdW1lbnQpIHtcbiAgICAgIEhUTUxEb2N1bWVudC5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcj1hZGRFdmVudExpc3RlbmVyO1xuICAgICAgSFRNTERvY3VtZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyPXJlbW92ZUV2ZW50TGlzdGVuZXI7XG4gICAgfVxuICAgIGlmIChXaW5kb3cpIHtcbiAgICAgIFdpbmRvdy5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcj1hZGRFdmVudExpc3RlbmVyO1xuICAgICAgV2luZG93LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyPXJlbW92ZUV2ZW50TGlzdGVuZXI7XG4gICAgfVxuICB9XG59KSgpO1xuXG4vKiFcbiAqIHRvcC5qc1xuICpcbiAqIExvYWRpbmcgaW4gb2YgcmVxdWlyZWpzIGFuZCBjb21wb25lbnRzLlxuICpcbiAqIEF1dGhvcjogSmFjayBNYXRpZXJcbiAqIFxuICovXG4oZnVuY3Rpb24odXJsLGNhbGxiYWNrKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHQgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcblx0dmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXG4gICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xuXHRzY3JpcHQuc3JjID0gdXJsO1xuXG5cdHNjcmlwdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBjYWxsYmFjaztcblx0c2NyaXB0Lm9ubG9hZCA9IGNhbGxiYWNrO1xuXG5cdGhlYWQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbn0pKGN1cnJlbnRTY3JpcHRQYXRoICsgJ3JlcXVpcmUubWluLmpzJywgZnVuY3Rpb24oKSB7XG5cdHJlcXVpcmUuY29uZmlnKHtcblx0XHRiYXNlVXJsOiBjdXJyZW50U2NyaXB0UGF0aFxuXHR9KTtcblxuXHRmdW5jdGlvbiB0b3BfaW5pdCgpIHtcblx0XHRmdW5jdGlvbiBjaGVja2NzcyhzZWxlY3RvciwgY2FsbGJhY2spIHsgLyogcXVlcnlTZWxlY3RvcjogSUU4ICovXG5cdFx0XHRyZXR1cm4gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpIT09bnVsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gSXMgdGhpcyBibG9ja2luZz9cblx0XHRmdW5jdGlvbiBsb2FkY3NzKHNlbGVjdG9yLCB1cmwpIHtcblx0XHRcdGlmKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpICE9PSBudWxsKSB7XG5cdFx0XHQgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlua1wiKTtcblx0XHRcdCAgICBsaW5rLnR5cGUgPSBcInRleHQvY3NzXCI7XG5cdFx0XHQgICAgbGluay5yZWwgPSBcInN0eWxlc2hlZXRcIjtcblx0XHRcdCAgICBsaW5rLmhyZWYgPSB1cmw7XG5cdFx0XHQgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdLmFwcGVuZENoaWxkKGxpbmspO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qIGZvbnQtYXdlc29tZSAqL1xuXHRcdGxvYWRjc3MoJ1tjbGFzcyo9ZmEtXScsICBjdXJyZW50U3R5bGVQYXRoICsgJ2ZvbnQtYXdlc29tZS5taW4uY3NzJyk7XG5cblx0XHQvKiBJcyB0b3BpbyB1c2VkICovXG5cdFx0aWYoY2hlY2tjc3MoJy50b3BpbycpKSB7XG5cdFx0XHRyZXF1aXJlKFsndG9waW8ubWluJ10sIGZ1bmN0aW9uKGlvKSB7fSk7XG5cdFx0fVxuXG4gICAgICAgIC8qIElzIHRvcGlvIHVzZWQgKi9cbiAgICAgICAgaWYoY2hlY2tjc3MoJ1tjbGFzcyo9dG9wZm5dJykpIHtcbiAgICAgICAgICByZXF1aXJlKFsndG9wZm4ubWluJ10sIGZ1bmN0aW9uKGZuKSB7fSk7XG4gICAgICAgIH1cblxuXHR9XG5cbiAgICAvKiBXaHkgZGlkbid0IEkgd3JpdGUgY29tbWVudHMgb24gdGhpcyE/ICovXG5cdGlmKGRvY3VtZW50LnJlYWR5U3RhdGUgIT0gJ2NvbXBsZXRlJyAmJiBkb2N1bWVudC5yZWFkeVN0YXRlICE9ICdpbnRlcmFjdGl2ZScpIHtcbiAgICAgIGRvY3VtZW50Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScgfHwgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PSAnaW50ZXJhY3RpdmUnKSB7XG4gICAgICAgICAgICB0b3BfaW5pdCgpO1xuICAgICAgICB9XG4gICAgICB9O1xuXHR9IGVsc2Uge1xuICAgICAgdG9wX2luaXQoKTtcblx0fVxufSk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9