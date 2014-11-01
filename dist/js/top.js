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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9wLmpzIiwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsInNvdXJjZXMiOlsidG9wLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxuKiBjdXJyZW50U2NyaXB0UGF0aFxuKlxuKiBBdXRob3I6ID8/P1xuKiBNb2RpZmllZCBieTogSmFjayBNYXRpZXIgKHNlbGZAamFja2FseXN0LmNvbSkgdG8gcmV0dXJuIFN0cmluZyBpbnN0ZWFkIG9mIGNhbGxpbmcgZnVuY3Rpb24uXG4qIFVwZGF0ZWQ6IDIwMTQxMDI2XG4qIExpY2Vuc2U6IE1JVFxuKi9cbnZhciBjdXJyZW50U2NyaXB0UGF0aCA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNjcmlwdHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnc2NyaXB0W3NyY10nICk7XG4gICAgdmFyIGN1cnJlbnRTY3JpcHQgPSBzY3JpcHRzWyBzY3JpcHRzLmxlbmd0aCAtIDEgXS5zcmM7XG4gICAgdmFyIGN1cnJlbnRTY3JpcHRDaHVua3MgPSBjdXJyZW50U2NyaXB0LnNwbGl0KCAnLycgKTtcbiAgICB2YXIgY3VycmVudFNjcmlwdEZpbGUgPSBjdXJyZW50U2NyaXB0Q2h1bmtzWyBjdXJyZW50U2NyaXB0Q2h1bmtzLmxlbmd0aCAtIDEgXTtcblxuICAgIHJldHVybiBjdXJyZW50U2NyaXB0LnJlcGxhY2UoIGN1cnJlbnRTY3JpcHRGaWxlLCAnJyApO1xufSkoKTtcblxudmFyIGN1cnJlbnRTdHlsZVBhdGggPSBjdXJyZW50U2NyaXB0UGF0aC5yZXBsYWNlKC9bYS16XSpcXC8kL2csJycpICsgJ2Nzcy8nO1xuXG4oZnVuY3Rpb24odXJsLGNhbGxiYWNrKSB7XG5cdCAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xuXHR2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cbiAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG5cdHNjcmlwdC5zcmMgPSB1cmw7XG5cblx0c2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGNhbGxiYWNrO1xuXHRzY3JpcHQub25sb2FkID0gY2FsbGJhY2s7XG5cblx0aGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xufSkoY3VycmVudFNjcmlwdFBhdGggKyAncmVxdWlyZS5taW4uanMnLCBmdW5jdGlvbigpIHtcblx0Ly8gSW1hZ2luZSByZXF1aXJlanMgKyBib3dlciFcblx0cmVxdWlyZS5jb25maWcoe1xuXHRcdGJhc2VVcmw6IGN1cnJlbnRTY3JpcHRQYXRoXG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRvcGluaXQoKSB7XG5cdFx0ZnVuY3Rpb24gY2hlY2tjc3Moc2VsZWN0b3IpIHtcblx0XHRcdHJldHVybiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcikgPT09IG51bGwpID8gZmFsc2UgOiB0cnVlOyBcblx0XHR9XG5cdFx0Ly8gSXMgdGhpcyBibG9ja2luZz9cblx0XHRmdW5jdGlvbiBsb2FkY3NzKHNlbGVjdG9yLCB1cmwpIHtcblx0XHRcdGlmKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpICE9PSBudWxsKSB7XG5cdFx0XHQgICAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlua1wiKTtcblx0XHRcdCAgICBsaW5rLnR5cGUgPSBcInRleHQvY3NzXCI7XG5cdFx0XHQgICAgbGluay5yZWwgPSBcInN0eWxlc2hlZXRcIjtcblx0XHRcdCAgICBsaW5rLmhyZWYgPSB1cmw7XG5cdFx0XHQgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdLmFwcGVuZENoaWxkKGxpbmspO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qIExvYWQgZm9udC1hd2Vzb21lIHdoZW4gaW4gdXNlICovXG5cdFx0bG9hZGNzcygnW2NsYXNzKj1mYS1dJywgIGN1cnJlbnRTdHlsZVBhdGggKyAnZm9udC1hd2Vzb21lLm1pbi5jc3MnKTtcblxuXHRcdC8qIElzIHRvcGlvIHVzZWQ/IExvYWQganF1ZXJ5ICovXG5cdFx0aWYoY2hlY2tjc3MoJy50b3BpbycpKSB7XG5cdFx0XHRyZXF1aXJlKFsndG9waW8ubWluJ10sIGZ1bmN0aW9uKGlvKSB7fSk7XG5cdFx0fVxuXHR9XG5cblx0ZG9jdW1lbnQub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHRcdHZhciByZWFkeSA9IGRvY3VtZW50LnJlYWR5U3RhdGU7XG5cblx0XHRpZiAocmVhZHkgPT0gXCJpbnRlcmFjdGl2ZVwiIHx8IHJlYWR5ID09IFwiY29tcGxldGVcIikge1xuXHRcdFx0dG9waW5pdCgpO1xuXHRcdH1cblx0fTtcbn0pOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==