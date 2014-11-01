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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9waW8uanMiLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJ0b3Bpby5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJkZWZpbmUoXG5cdCd0b3Bpby5taW4nLFxuXHRbJ2pxdWVyeSddLFxuXHRmdW5jdGlvbigkKSB7XG5cblx0XHRcdCAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cdFx0dmFyIHNjcm9sbF9kaXJlY3Rpb24gPSAnZG93bic7XG5cdFx0IHZhciBzY3JvbGxfcG9zaXRpb24gPSAwO1xuXG5cdFx0Ly8gRXhwYW5kIHRoZSBkb2N1bWVudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShcblx0XHRcdC9cXGJ0b3Bpb1xcYi8sXG5cdFx0XHQndG9waW8tc2Nyb2xsdG9wLS10cnVlIHRvcGlvLXNjcm9sbGRpci0tbm9uZSB0b3Bpby1kb21sb2FkZWQnXG5cdFx0KTtcblxuXHRcdC8vIFNjcm9sbCBEaXJlY3Rpb25cblx0XHQkKGRvY3VtZW50KS5vbignc2Nyb2xsJywgZWxlbWVudCwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgbmV3X3Njcm9sbF9wb3NpdGlvbiA9ICQoZG9jdW1lbnQpLnNjcm9sbFRvcCgpO1xuXG5cdFx0XHRpZihuZXdfc2Nyb2xsX3Bvc2l0aW9uPDEwMCkge1xuXHRcdFx0XHRzY3JvbGxfdG9wPSd0cnVlJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNjcm9sbF90b3A9J2ZhbHNlJztcblx0XHRcdH1cblxuXHRcdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKFxuXHRcdFx0XHQvXFxidG9waW8tc2Nyb2xsdG9wLS1bYS16XSpcXGIvLFxuXHRcdFx0XHQndG9waW8tc2Nyb2xsdG9wLS0nICsgc2Nyb2xsX3RvcFxuXHRcdFx0KTtcblxuXHRcdFx0aWYobmV3X3Njcm9sbF9wb3NpdGlvbj5zY3JvbGxfcG9zaXRpb24pIHtcblx0XHRcdFx0c2Nyb2xsX2RpcmVjdGlvbiA9ICdkb3duJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNjcm9sbF9kaXJlY3Rpb24gPSAndXAnO1xuXHRcdFx0fVxuXG5cdFx0XHRzY3JvbGxfcG9zaXRpb24gPSBuZXdfc2Nyb2xsX3Bvc2l0aW9uO1xuXHRcdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKFxuXHRcdFx0XHQvXFxidG9waW8tc2Nyb2xsZGlyLS1bYS16XStcXGIvLFxuXHRcdFx0XHQndG9wLWlvLS1zY3JvbGxkaXItLScgKyBzY3JvbGxfZGlyZWN0aW9uXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dmFyIG15TW9kdWxlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR9O1xuXG5cdFx0cmV0dXJuIG15TW9kdWxlO1xuXHR9XG4pOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==