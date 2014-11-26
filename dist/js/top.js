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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9wLmpzIiwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsInNvdXJjZXMiOlsidG9wLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxuKiBjdXJyZW50U2NyaXB0UGF0aFxuKiBcbiogQXV0aG9yOiA/Pz9cbiogTW9kaWZpZWQgYnk6IEphY2sgTWF0aWVyIChzZWxmQGphY2thbHlzdC5jb20pIHRvIHJldHVybiBTdHJpbmcgaW5zdGVhZCBvZiBjYWxsaW5nIGZ1bmN0aW9uLlxuKiBVcGRhdGVkOiAyMDE0MTAyNlxuKiBMaWNlbnNlOiBNSVRcbiovXG52YXIgY3VycmVudFNjcmlwdFBhdGggPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBzY3JpcHRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ3NjcmlwdFtzcmNdJyApO1xuICAgIHZhciBjdXJyZW50U2NyaXB0ID0gc2NyaXB0c1sgc2NyaXB0cy5sZW5ndGggLSAxIF0uc3JjO1xuICAgIHZhciBjdXJyZW50U2NyaXB0Q2h1bmtzID0gY3VycmVudFNjcmlwdC5zcGxpdCggJy8nICk7XG4gICAgdmFyIGN1cnJlbnRTY3JpcHRGaWxlID0gY3VycmVudFNjcmlwdENodW5rc1sgY3VycmVudFNjcmlwdENodW5rcy5sZW5ndGggLSAxIF07XG5cbiAgICByZXR1cm4gY3VycmVudFNjcmlwdC5yZXBsYWNlKCBjdXJyZW50U2NyaXB0RmlsZSwgJycgKTtcbn0pKCk7XG52YXIgY3VycmVudFN0eWxlUGF0aCA9IGN1cnJlbnRTY3JpcHRQYXRoLnJlcGxhY2UoL1thLXpdKlxcLyQvZywnJykgKyAnY3NzLyc7XG5cblxuLyohXG4gKiBCYWNrd2FyZHMgQ29tcGF0aWJpbGl0eSBmb3IgYWRkRXZlbnRMaXN0ZW5lciwgcmVtb3ZlRXZlbnRMaXN0ZW5lciwgRXZlbnQucHJldmVudERlZmF1bHQgYW5kIEV2ZW50LnN0b3BQcm9wYWdhdGlvblxuICpcbiAqIEF1dGhvcjogPz8/XG4gKiBTb3VyY2U6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FdmVudFRhcmdldC5hZGRFdmVudExpc3RlbmVyXG4gKiBCcm93c2VyczogSUU4XG4gKiBMaWNlbnNlOiA/Pz9cbiAqL1xuKGZ1bmN0aW9uKCkge1xuICBpZiAoIUV2ZW50LnByb3RvdHlwZS5wcmV2ZW50RGVmYXVsdCkge1xuICAgIEV2ZW50LnByb3RvdHlwZS5wcmV2ZW50RGVmYXVsdD1mdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmV0dXJuVmFsdWU9ZmFsc2U7XG4gICAgfTtcbiAgfVxuICBpZiAoIUV2ZW50LnByb3RvdHlwZS5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICBFdmVudC5wcm90b3R5cGUuc3RvcFByb3BhZ2F0aW9uPWZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jYW5jZWxCdWJibGU9dHJ1ZTtcbiAgICB9O1xuICB9XG4gIGlmICghRWxlbWVudC5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgIHZhciBldmVudExpc3RlbmVycz1bXTtcbiAgICBcbiAgICB2YXIgYWRkRXZlbnRMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyIC8qLCB1c2VDYXB0dXJlICh3aWxsIGJlIGlnbm9yZWQpICovKSB7XG4gICAgICB2YXIgc2VsZj10aGlzO1xuICAgICAgdmFyIHdyYXBwZXI9ZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnRhcmdldD1lLnNyY0VsZW1lbnQ7XG4gICAgICAgIGUuY3VycmVudFRhcmdldD1zZWxmO1xuICAgICAgICBpZiAobGlzdGVuZXIuaGFuZGxlRXZlbnQpIHtcbiAgICAgICAgICBsaXN0ZW5lci5oYW5kbGVFdmVudChlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsaXN0ZW5lci5jYWxsKHNlbGYsZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAodHlwZT09XCJET01Db250ZW50TG9hZGVkXCIpIHtcbiAgICAgICAgdmFyIHdyYXBwZXIyPWZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZT09XCJjb21wbGV0ZVwiKSB7XG4gICAgICAgICAgICB3cmFwcGVyKGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgZG9jdW1lbnQuYXR0YWNoRXZlbnQoXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIix3cmFwcGVyMik7XG4gICAgICAgIGV2ZW50TGlzdGVuZXJzLnB1c2goe29iamVjdDp0aGlzLHR5cGU6dHlwZSxsaXN0ZW5lcjpsaXN0ZW5lcix3cmFwcGVyOndyYXBwZXIyfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZT09XCJjb21wbGV0ZVwiKSB7XG4gICAgICAgICAgdmFyIGU9bmV3IEV2ZW50KCk7XG4gICAgICAgICAgZS5zcmNFbGVtZW50PXdpbmRvdztcbiAgICAgICAgICB3cmFwcGVyMihlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hdHRhY2hFdmVudChcIm9uXCIrdHlwZSx3cmFwcGVyKTtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnMucHVzaCh7b2JqZWN0OnRoaXMsdHlwZTp0eXBlLGxpc3RlbmVyOmxpc3RlbmVyLHdyYXBwZXI6d3JhcHBlcn0pO1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIHJlbW92ZUV2ZW50TGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lciAvKiwgdXNlQ2FwdHVyZSAod2lsbCBiZSBpZ25vcmVkKSAqLykge1xuICAgICAgdmFyIGNvdW50ZXI9MDtcbiAgICAgIHdoaWxlIChjb3VudGVyPGV2ZW50TGlzdGVuZXJzLmxlbmd0aCkge1xuICAgICAgICB2YXIgZXZlbnRMaXN0ZW5lcj1ldmVudExpc3RlbmVyc1tjb3VudGVyXTtcbiAgICAgICAgaWYgKGV2ZW50TGlzdGVuZXIub2JqZWN0PT10aGlzICYmIGV2ZW50TGlzdGVuZXIudHlwZT09dHlwZSAmJiBldmVudExpc3RlbmVyLmxpc3RlbmVyPT1saXN0ZW5lcikge1xuICAgICAgICAgIGlmICh0eXBlPT1cIkRPTUNvbnRlbnRMb2FkZWRcIikge1xuICAgICAgICAgICAgdGhpcy5kZXRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLGV2ZW50TGlzdGVuZXIud3JhcHBlcik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGV0YWNoRXZlbnQoXCJvblwiK3R5cGUsZXZlbnRMaXN0ZW5lci53cmFwcGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZXZlbnRMaXN0ZW5lcnMuc3BsaWNlKGNvdW50ZXIsIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgICsrY291bnRlcjtcbiAgICAgIH1cbiAgICB9O1xuICAgIEVsZW1lbnQucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXI9YWRkRXZlbnRMaXN0ZW5lcjtcbiAgICBFbGVtZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyPXJlbW92ZUV2ZW50TGlzdGVuZXI7XG4gICAgaWYgKEhUTUxEb2N1bWVudCkge1xuICAgICAgSFRNTERvY3VtZW50LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyPWFkZEV2ZW50TGlzdGVuZXI7XG4gICAgICBIVE1MRG9jdW1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI9cmVtb3ZlRXZlbnRMaXN0ZW5lcjtcbiAgICB9XG4gICAgaWYgKFdpbmRvdykge1xuICAgICAgV2luZG93LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyPWFkZEV2ZW50TGlzdGVuZXI7XG4gICAgICBXaW5kb3cucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI9cmVtb3ZlRXZlbnRMaXN0ZW5lcjtcbiAgICB9XG4gIH1cbn0pKCk7XG5cbi8qIVxuICogdG9wLmpzXG4gKlxuICogTG9hZGluZyBpbiBvZiByZXF1aXJlanMgYW5kIGNvbXBvbmVudHMuXG4gKlxuICogQXV0aG9yOiBKYWNrIE1hdGllclxuICogXG4gKi9cbihmdW5jdGlvbih1cmwsY2FsbGJhY2spIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdCAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xuXHR2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cbiAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG5cdHNjcmlwdC5zcmMgPSB1cmw7XG5cblx0c2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGNhbGxiYWNrO1xuXHRzY3JpcHQub25sb2FkID0gY2FsbGJhY2s7XG5cblx0aGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xufSkoY3VycmVudFNjcmlwdFBhdGggKyAncmVxdWlyZS5taW4uanMnLCBmdW5jdGlvbigpIHtcblx0cmVxdWlyZS5jb25maWcoe1xuXHRcdGJhc2VVcmw6IGN1cnJlbnRTY3JpcHRQYXRoXG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRvcF9pbml0KCkge1xuXHRcdGNvbnNvbGUubG9nKCdva2F5Jyk7XG5cdFx0ZnVuY3Rpb24gY2hlY2tjc3Moc2VsZWN0b3IsIGNhbGxiYWNrKSB7XHRcdFx0XG5cdFx0XHRyZXR1cm4gKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpID09PSBudWxsKSA/IGZhbHNlIDogdHJ1ZTsgXG5cdFx0fVxuXG5cdFx0Ly8gSXMgdGhpcyBibG9ja2luZz9cblx0XHRmdW5jdGlvbiBsb2FkY3NzKHNlbGVjdG9yLCB1cmwpIHtcblx0XHRcdGlmKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpICE9PSBudWxsKSB7XG5cdFx0XHQgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlua1wiKTtcblx0XHRcdCAgICBsaW5rLnR5cGUgPSBcInRleHQvY3NzXCI7XG5cdFx0XHQgICAgbGluay5yZWwgPSBcInN0eWxlc2hlZXRcIjtcblx0XHRcdCAgICBsaW5rLmhyZWYgPSB1cmw7XG5cdFx0XHQgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdLmFwcGVuZENoaWxkKGxpbmspO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qIGZvbnQtYXdlc29tZSAqL1xuXHRcdGxvYWRjc3MoJ1tjbGFzcyo9ZmEtXScsICBjdXJyZW50U3R5bGVQYXRoICsgJ2ZvbnQtYXdlc29tZS5taW4uY3NzJyk7XG5cblx0XHQvKiBJcyB0b3BpbyB1c2VkICovXG5cdFx0aWYoY2hlY2tjc3MoJy50b3BpbycpKSB7XG5cdFx0XHRyZXF1aXJlKFsndG9waW8ubWluJ10sIGZ1bmN0aW9uKGlvKSB7fSk7XG5cdFx0fVxuXHR9XG5cblx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPSAnY29tcGxldGUnICYmIGRvY3VtZW50LnJlYWR5U3RhdGUgIT0gJ2ludGVyYWN0aXZlJykge1xuXHRcdGRvY3VtZW50Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScgfHwgZG9jdW1lbnQucmVhZHlTdGF0ZSA9PSAnaW50ZXJhY3RpdmUnKSB7XG5cdFx0XHRcdFx0dG9wX2luaXQoKTtcblx0XHRcdFx0fVxuXHRcdH07XG5cdH0gZWxzZSB7XG5cdFx0dG9wX2luaXQoKTtcblx0fVxufSk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9