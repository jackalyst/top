Top (unstable)
=======

Intends to be a complete opinionated [NIH](http://en.wikipedia.org/wiki/Not_invented_here) HTML5 [High Performance](http://developers.google.com/speed/pagespeed/insights/?url=top.kamris.com) front-end for developing todays websites compatible right down to IE8 using best of breed plugins. It achieves this through only requiring things that are in use and does so by analyzing the page upon document load. The upside is that this means content loads *fast*, but the ***downside*** is that it's prone to the [Flash of Unstyled Content](http://en.wikipedia.org/wiki/Flash_of_unstyled_content)

## Browser Support

The whole point of the first version of Top is to provide a modern framework that works *decently* in older browsers and mobile devices alike. Generally this means that IE8 is going to have fairly good support while it renders fine in IE7 and IE6.

## Features

- Brower Support
    - IE6 & IE7 grid support
    - IE8 Scripting
- CSS
    - OOCSS 
        - Creating re-usable components
    - 12 column grid
    - Typography
    - Forms
    - Div Ratio
- topfn (class+data attribute scripting)
    - topfn-sticky
- CMS Frameworks
    - Wordpress Template
    - Drupal 7 Template

## Usage

Usage tends to be very verbose on the HTML side of things, but this is to help provide flexibility for different projects while maintaining backwards compatibility.

    <div class="wrapper">
        <div class="wrapper-body"><!-- Generally used as the full span of section -->
            <div class="row">
                <span><div>
                    
                </div></span>
            </div>
        </div>
    </div>
    
### Some starting CSS

    .row {
        max-width:800px;
    }

## topfn - A functional start

There's quite a few things that we want to do

## Todo

- Fix