<!--[if (IE 6)|(IE 7)]>
<!--
The documentation source

Triggers IE 6/7 Quirks for box-sizing:border-box by having content
before the doctype: http://www.quirksmode.org/css/quirksmode.html
-->
<![endif]-->
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>top: A high performance css/js front-end</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		/* Include .css */
		<?php include('top.bleeding.min.css'); ?>

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
</head>
<body>
	<div class="c body">
		<div class="c3">
			<div class="head">top</div>
		</div>
		<div class="c9 body">
			<h1>top (unstable)</h1>
			<p>A high performance (seldom-request-blocking) front-end guide for websites aimed towards screen devices and printers.</p>
			<p>The aim is to setup a complete framework to work from that already separates what needs to be loaded immediately to what can be loaded later.</p>
			<ul>
				<li>Carousels</li>
				<li>etc</li>
			</ul>
		</div>
	</div>
</body>
</html>