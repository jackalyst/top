/**
 * topio.min.js
 *
 * Replacing the top with information much in the same way that modernizr does feature detection.
 */
define(
	'topio.min',
	function() {

			     var element = document.documentElement;
		var scroll_direction = 'down';
		 var scroll_position = 0;

		// Expand the document
		element.className = element.className.replace(
			/\btopio\b/,
			'topio-scrolltop--true topio-scrolldir--none topio-domcontentloaded'
		);

		window.addEventListener('load', function(e) {
			element.className += ' topio-windowloaded';
		});


		window.addEventListener("scroll", function(e) {
			var supportPageOffset = window.pageXOffset !== undefined;
			var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

			var scrollpos = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;

			var scrolltop = (scrollpos < 100)           ? 'true' : 'false';
			var scrolldir = (scrollpos_old < scrollpos) ? 'up'   : 'down';

			element.className = element.className.replace(
				/\btopio-scrolltop--[a-z]*\b/,
				'topio-scrolltop--' + scrolltop				
			);

			element.className = element.className.replace(
				/\btopio-scrolldir--[a-z]+\b/,
				'topio-scrolldir--' + scrolldir
			);

			var scrollpos_old = scrollpos;
		});


		/* Module */
		var myModule = function() {

		};

		return myModule;
	}
);