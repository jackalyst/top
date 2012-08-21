// Testing out stylesheet detection.
window.onload = function() {
	var stylesheets = document.styleSheets;

	// IE uses 'rules'.

	console.log("There are "+stylesheets[0].cssRules.length+ " declarations in the first stylesheet.");



}