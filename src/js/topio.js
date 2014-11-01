define(
	'topio.min',
	['jquery'],
	function($) {

			     var element = document.documentElement;
		var scroll_direction = 'down';
		 var scroll_position = 0;

		// Expand the document
		element.className = element.className.replace(
			/\btopio\b/,
			'topio-scrolltop--true topio-scrolldir--none topio-domloaded'
		);

		// Scroll Direction
		$(document).on('scroll', element, function() {
			var new_scroll_position = $(document).scrollTop();

			if(new_scroll_position<100) {
				scroll_top='true';
			} else {
				scroll_top='false';
			}

			element.className = element.className.replace(
				/\btopio-scrolltop--[a-z]*\b/,
				'topio-scrolltop--' + scroll_top
			);

			if(new_scroll_position>scroll_position) {
				scroll_direction = 'down';
			} else {
				scroll_direction = 'up';
			}

			scroll_position = new_scroll_position;
			element.className = element.className.replace(
				/\btopio-scrolldir--[a-z]+\b/,
				'top-io--scrolldir--' + scroll_direction
			);
		});

		var myModule = function() {

		};

		return myModule;
	}
);