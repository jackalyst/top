# Qi: Javascript icing for CSS.

For some things people seem to delve into javascript just to do something that could (or dare I say /should/) be done in CSS.

Wouldn't it be nice to `.class:click` something instead of attaching an event? Or to select a parent element?

# How it works

Qi works by parsing the CSS file(s) with builtin javascript functions and executing changes through the library.

# To use:

1. Include the file.

`<script src="http://qi.kamris.ca/latest.js" />`

2. Adjust your CSS:

`.class:hover, .class:click { background-color:blue; }`