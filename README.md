# Qi: What?

Qi extends CSS through JS by adding things like `:click` that would otherwise be reserved to messing around in JS or loading a library.

# How it works

Qi works by parsing CSS files specified and looks for attributes that Qi understands. It then takes that and, using the magic of altering class names and attaching events, creates CSS level changes.

# To use:

To use Qi is simple.

1. Include the file.

`<script src="//qi.kamris.ca/latest.js">`

2. Adjust your CSS:

`.class:hover, .class:click { background-color:blue; }`