<!--[if (IE 6)|(IE 7)]>
<!--
Source page and blueprint.

'top' is forward thinking but backwards compatible, meaning that
the basic layout structure of the site will display nicely
right down to IE 6, but that's it. Beautiful things happen at
IE 9.

The first thing is that we've triggered box-sizing:border-box
throughout the entirety of the site. In order to keep it compatible (IE)
content has to be added before the doctype. You can read more
about what that means http://www.quirksmode.org/css/quirksmode.html
-->
<![endif]-->
<!DOCTYPE html>
<!--[if lt IE 7 ]><html class="ie6" lang="en"><![endif]-->
<!--[if IE 7 ]><html class="ie7" lang="en"><![endif]-->
<!--[if IE 8 ]><html class="ie8" lang="en"><![endif]-->
<!--[if (gte IE 9)|!(IE)]><!--><html class="no-js" lang="en"><!--<![endif]-->
<head>
	<meta charset="utf-8">
	<title>top: A high performance css/js front-end</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		/* Include .css */
		<?php include('top.bleeding.min.css'); ?>

		/* Body type might be added to top later */
		body {
			font-family: sans-serif;
		}

		/* Establish layout */
		.c {
			margin: 0 auto;
			max-width: 600px;
			_width: 600px;
		}
		.c .head {
			text-align: center;
			font-size: 100px;
			line-height: 100px;
		}
		.c .body {
			padding-top:100px;
		}
		.c div {
			padding-right: 5px;
			padding-left:5px;
		}

		/* Anything that's above frame */
	</style>
	<!--[if lt IE 9]>
    <script src="components/html5shiv/html5shiv.js"></script>
	<![endif]-->
</head>
<body>
	<div class="c body">
		<div class="c3">
			<div class="head">top</div>
		</div>
		<div class="c9 body">
			<h1>top</h1>
			<p>An HTML5 ready to go high performance (non-blocking) front-end guide for websites aimed towards recent screen devices yet capable of legacy support.</p>
			<p>The aim is to setup a complete framework to work from that already separates what needs to be loaded immediately to what can be loaded later.</p>
			<ul>
				<li>Carousels</li>
				<li>etc</li>
			</ul>
		</div>
	</div>
</body>
</html>
<!--[if (!IE)|(gte IE 9)]><!-->
<link rel="stylesheet" href="">
<!-- <![endif] -->