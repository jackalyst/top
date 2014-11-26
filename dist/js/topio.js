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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9waW8uanMiLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJ0b3Bpby5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIHRvcGlvLm1pbi5qc1xuICpcbiAqIFJlcGxhY2luZyB0aGUgdG9wIHdpdGggaW5mb3JtYXRpb24gbXVjaCBpbiB0aGUgc2FtZSB3YXkgdGhhdCBtb2Rlcm5penIgZG9lcyBmZWF0dXJlIGRldGVjdGlvbi5cbiAqL1xuZGVmaW5lKFxuXHQndG9waW8ubWluJyxcblx0ZnVuY3Rpb24oKSB7XG5cblx0XHRcdCAgICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cdFx0dmFyIHNjcm9sbF9kaXJlY3Rpb24gPSAnZG93bic7XG5cdFx0IHZhciBzY3JvbGxfcG9zaXRpb24gPSAwO1xuXG5cdFx0Ly8gRXhwYW5kIHRoZSBkb2N1bWVudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShcblx0XHRcdC9cXGJ0b3Bpb1xcYi8sXG5cdFx0XHQndG9waW8tc2Nyb2xsdG9wLS10cnVlIHRvcGlvLXNjcm9sbGRpci0tbm9uZSB0b3Bpby1kb21jb250ZW50bG9hZGVkJ1xuXHRcdCk7XG5cblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGVsZW1lbnQuY2xhc3NOYW1lICs9ICcgdG9waW8td2luZG93bG9hZGVkJztcblx0XHR9KTtcblxuXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgZnVuY3Rpb24oZSkge1xuXHRcdFx0dmFyIHN1cHBvcnRQYWdlT2Zmc2V0ID0gd2luZG93LnBhZ2VYT2Zmc2V0ICE9PSB1bmRlZmluZWQ7XG5cdFx0XHR2YXIgaXNDU1MxQ29tcGF0ID0gKChkb2N1bWVudC5jb21wYXRNb2RlIHx8IFwiXCIpID09PSBcIkNTUzFDb21wYXRcIik7XG5cblx0XHRcdHZhciBzY3JvbGxwb3MgPSBzdXBwb3J0UGFnZU9mZnNldCA/IHdpbmRvdy5wYWdlWU9mZnNldCA6IGlzQ1NTMUNvbXBhdCA/IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgOiBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcDtcblxuXHRcdFx0dmFyIHNjcm9sbHRvcCA9IChzY3JvbGxwb3MgPCAxMDApICAgICAgICAgICA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cdFx0XHR2YXIgc2Nyb2xsZGlyID0gKHNjcm9sbHBvc19vbGQgPCBzY3JvbGxwb3MpID8gJ3VwJyAgIDogJ2Rvd24nO1xuXG5cdFx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UoXG5cdFx0XHRcdC9cXGJ0b3Bpby1zY3JvbGx0b3AtLVthLXpdKlxcYi8sXG5cdFx0XHRcdCd0b3Bpby1zY3JvbGx0b3AtLScgKyBzY3JvbGx0b3BcdFx0XHRcdFxuXHRcdFx0KTtcblxuXHRcdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKFxuXHRcdFx0XHQvXFxidG9waW8tc2Nyb2xsZGlyLS1bYS16XStcXGIvLFxuXHRcdFx0XHQndG9waW8tc2Nyb2xsZGlyLS0nICsgc2Nyb2xsZGlyXG5cdFx0XHQpO1xuXG5cdFx0XHR2YXIgc2Nyb2xscG9zX29sZCA9IHNjcm9sbHBvcztcblx0XHR9KTtcblxuXG5cdFx0LyogTW9kdWxlICovXG5cdFx0dmFyIG15TW9kdWxlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR9O1xuXG5cdFx0cmV0dXJuIG15TW9kdWxlO1xuXHR9XG4pOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==