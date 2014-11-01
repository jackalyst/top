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

(function(url,callback) {
	  var head = document.getElementsByTagName('head')[0];
	var script = document.createElement('script');

   script.type = 'text/javascript';
	script.src = url;

	script.onreadystatechange = callback;
	script.onload = callback;

	head.appendChild(script);
})(currentScriptPath + 'require.min.js', function() {
	// Imagine requirejs + bower!
	require.config({
		baseUrl: currentScriptPath
	});

	function topinit() {
		function checkcss(selector) {
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

		/* Load font-awesome when in use */
		loadcss('[class*=fa-]',  currentStylePath + 'font-awesome.min.css');

		/* Is topio used? Load jquery */
		if(checkcss('.topio')) {
			require(['topio.min'], function(io) {});
		}
	}

	document.onreadystatechange = function () {
		var ready = document.readyState;

		if (ready == "interactive" || ready == "complete") {
			topinit();
		}
	};
});