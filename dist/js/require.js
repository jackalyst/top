/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.15 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.15',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite an existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i == 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);

                //Custom require that does not do map translation, since
                //ID is "absolute", already mapped/resolved.
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // If nested plugin references, then do not try to
                        // normalize, as it will not normalize correctly. This
                        // places a restriction on resourceIds, and the longer
                        // term solution is not to normalize until plugins are
                        // loaded and all normalizations to allow for async
                        // loading of a loader plugin. But for now, fixes the
                        // common uses. Details in #1131
                        normalizedName = name.indexOf('!') === -1 ?
                                         normalize(name, parentName, applyMap) :
                                         name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWlyZS5qcyIsIm5hbWVzIjpbXSwibWFwcGluZ3MiOiIiLCJzb3VyY2VzIjpbInJlcXVpcmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqIHZpbTogZXQ6dHM9NDpzdz00OnN0cz00XG4gKiBAbGljZW5zZSBSZXF1aXJlSlMgMi4xLjE1IENvcHlyaWdodCAoYykgMjAxMC0yMDE0LCBUaGUgRG9qbyBGb3VuZGF0aW9uIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBBdmFpbGFibGUgdmlhIHRoZSBNSVQgb3IgbmV3IEJTRCBsaWNlbnNlLlxuICogc2VlOiBodHRwOi8vZ2l0aHViLmNvbS9qcmJ1cmtlL3JlcXVpcmVqcyBmb3IgZGV0YWlsc1xuICovXG4vL05vdCB1c2luZyBzdHJpY3Q6IHVuZXZlbiBzdHJpY3Qgc3VwcG9ydCBpbiBicm93c2VycywgIzM5MiwgYW5kIGNhdXNlc1xuLy9wcm9ibGVtcyB3aXRoIHJlcXVpcmVqcy5leGVjKCkvdHJhbnNwaWxlciBwbHVnaW5zIHRoYXQgbWF5IG5vdCBiZSBzdHJpY3QuXG4vKmpzbGludCByZWdleHA6IHRydWUsIG5vbWVuOiB0cnVlLCBzbG9wcHk6IHRydWUgKi9cbi8qZ2xvYmFsIHdpbmRvdywgbmF2aWdhdG9yLCBkb2N1bWVudCwgaW1wb3J0U2NyaXB0cywgc2V0VGltZW91dCwgb3BlcmEgKi9cblxudmFyIHJlcXVpcmVqcywgcmVxdWlyZSwgZGVmaW5lO1xuKGZ1bmN0aW9uIChnbG9iYWwpIHtcbiAgICB2YXIgcmVxLCBzLCBoZWFkLCBiYXNlRWxlbWVudCwgZGF0YU1haW4sIHNyYyxcbiAgICAgICAgaW50ZXJhY3RpdmVTY3JpcHQsIGN1cnJlbnRseUFkZGluZ1NjcmlwdCwgbWFpblNjcmlwdCwgc3ViUGF0aCxcbiAgICAgICAgdmVyc2lvbiA9ICcyLjEuMTUnLFxuICAgICAgICBjb21tZW50UmVnRXhwID0gLyhcXC9cXCooW1xcc1xcU10qPylcXCpcXC98KFteOl18XilcXC9cXC8oLiopJCkvbWcsXG4gICAgICAgIGNqc1JlcXVpcmVSZWdFeHAgPSAvW14uXVxccypyZXF1aXJlXFxzKlxcKFxccypbXCInXShbXidcIlxcc10rKVtcIiddXFxzKlxcKS9nLFxuICAgICAgICBqc1N1ZmZpeFJlZ0V4cCA9IC9cXC5qcyQvLFxuICAgICAgICBjdXJyRGlyUmVnRXhwID0gL15cXC5cXC8vLFxuICAgICAgICBvcCA9IE9iamVjdC5wcm90b3R5cGUsXG4gICAgICAgIG9zdHJpbmcgPSBvcC50b1N0cmluZyxcbiAgICAgICAgaGFzT3duID0gb3AuaGFzT3duUHJvcGVydHksXG4gICAgICAgIGFwID0gQXJyYXkucHJvdG90eXBlLFxuICAgICAgICBhcHNwID0gYXAuc3BsaWNlLFxuICAgICAgICBpc0Jyb3dzZXIgPSAhISh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZG9jdW1lbnQpLFxuICAgICAgICBpc1dlYldvcmtlciA9ICFpc0Jyb3dzZXIgJiYgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnLFxuICAgICAgICAvL1BTMyBpbmRpY2F0ZXMgbG9hZGVkIGFuZCBjb21wbGV0ZSwgYnV0IG5lZWQgdG8gd2FpdCBmb3IgY29tcGxldGVcbiAgICAgICAgLy9zcGVjaWZpY2FsbHkuIFNlcXVlbmNlIGlzICdsb2FkaW5nJywgJ2xvYWRlZCcsIGV4ZWN1dGlvbixcbiAgICAgICAgLy8gdGhlbiAnY29tcGxldGUnLiBUaGUgVUEgY2hlY2sgaXMgdW5mb3J0dW5hdGUsIGJ1dCBub3Qgc3VyZSBob3dcbiAgICAgICAgLy90byBmZWF0dXJlIHRlc3Qgdy9vIGNhdXNpbmcgcGVyZiBpc3N1ZXMuXG4gICAgICAgIHJlYWR5UmVnRXhwID0gaXNCcm93c2VyICYmIG5hdmlnYXRvci5wbGF0Zm9ybSA9PT0gJ1BMQVlTVEFUSU9OIDMnID9cbiAgICAgICAgICAgICAgICAgICAgICAvXmNvbXBsZXRlJC8gOiAvXihjb21wbGV0ZXxsb2FkZWQpJC8sXG4gICAgICAgIGRlZkNvbnRleHROYW1lID0gJ18nLFxuICAgICAgICAvL09oIHRoZSB0cmFnZWR5LCBkZXRlY3Rpbmcgb3BlcmEuIFNlZSB0aGUgdXNhZ2Ugb2YgaXNPcGVyYSBmb3IgcmVhc29uLlxuICAgICAgICBpc09wZXJhID0gdHlwZW9mIG9wZXJhICE9PSAndW5kZWZpbmVkJyAmJiBvcGVyYS50b1N0cmluZygpID09PSAnW29iamVjdCBPcGVyYV0nLFxuICAgICAgICBjb250ZXh0cyA9IHt9LFxuICAgICAgICBjZmcgPSB7fSxcbiAgICAgICAgZ2xvYmFsRGVmUXVldWUgPSBbXSxcbiAgICAgICAgdXNlSW50ZXJhY3RpdmUgPSBmYWxzZTtcblxuICAgIGZ1bmN0aW9uIGlzRnVuY3Rpb24oaXQpIHtcbiAgICAgICAgcmV0dXJuIG9zdHJpbmcuY2FsbChpdCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNBcnJheShpdCkge1xuICAgICAgICByZXR1cm4gb3N0cmluZy5jYWxsKGl0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gZm9yIGl0ZXJhdGluZyBvdmVyIGFuIGFycmF5LiBJZiB0aGUgZnVuYyByZXR1cm5zXG4gICAgICogYSB0cnVlIHZhbHVlLCBpdCB3aWxsIGJyZWFrIG91dCBvZiB0aGUgbG9vcC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlYWNoKGFyeSwgZnVuYykge1xuICAgICAgICBpZiAoYXJ5KSB7XG4gICAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcnkubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJ5W2ldICYmIGZ1bmMoYXJ5W2ldLCBpLCBhcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlbHBlciBmdW5jdGlvbiBmb3IgaXRlcmF0aW5nIG92ZXIgYW4gYXJyYXkgYmFja3dhcmRzLiBJZiB0aGUgZnVuY1xuICAgICAqIHJldHVybnMgYSB0cnVlIHZhbHVlLCBpdCB3aWxsIGJyZWFrIG91dCBvZiB0aGUgbG9vcC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlYWNoUmV2ZXJzZShhcnksIGZ1bmMpIHtcbiAgICAgICAgaWYgKGFyeSkge1xuICAgICAgICAgICAgdmFyIGk7XG4gICAgICAgICAgICBmb3IgKGkgPSBhcnkubGVuZ3RoIC0gMTsgaSA+IC0xOyBpIC09IDEpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJ5W2ldICYmIGZ1bmMoYXJ5W2ldLCBpLCBhcnkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhc1Byb3Aob2JqLCBwcm9wKSB7XG4gICAgICAgIHJldHVybiBoYXNPd24uY2FsbChvYmosIHByb3ApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE93bihvYmosIHByb3ApIHtcbiAgICAgICAgcmV0dXJuIGhhc1Byb3Aob2JqLCBwcm9wKSAmJiBvYmpbcHJvcF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3ljbGVzIG92ZXIgcHJvcGVydGllcyBpbiBhbiBvYmplY3QgYW5kIGNhbGxzIGEgZnVuY3Rpb24gZm9yIGVhY2hcbiAgICAgKiBwcm9wZXJ0eSB2YWx1ZS4gSWYgdGhlIGZ1bmN0aW9uIHJldHVybnMgYSB0cnV0aHkgdmFsdWUsIHRoZW4gdGhlXG4gICAgICogaXRlcmF0aW9uIGlzIHN0b3BwZWQuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZWFjaFByb3Aob2JqLCBmdW5jKSB7XG4gICAgICAgIHZhciBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAoaGFzUHJvcChvYmosIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZ1bmMob2JqW3Byb3BdLCBwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaW1wbGUgZnVuY3Rpb24gdG8gbWl4IGluIHByb3BlcnRpZXMgZnJvbSBzb3VyY2UgaW50byB0YXJnZXQsXG4gICAgICogYnV0IG9ubHkgaWYgdGFyZ2V0IGRvZXMgbm90IGFscmVhZHkgaGF2ZSBhIHByb3BlcnR5IG9mIHRoZSBzYW1lIG5hbWUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gbWl4aW4odGFyZ2V0LCBzb3VyY2UsIGZvcmNlLCBkZWVwU3RyaW5nTWl4aW4pIHtcbiAgICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgZWFjaFByb3Aoc291cmNlLCBmdW5jdGlvbiAodmFsdWUsIHByb3ApIHtcbiAgICAgICAgICAgICAgICBpZiAoZm9yY2UgfHwgIWhhc1Byb3AodGFyZ2V0LCBwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGVlcFN0cmluZ01peGluICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICFpc0FycmF5KHZhbHVlKSAmJiAhaXNGdW5jdGlvbih2YWx1ZSkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICEodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0W3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtaXhpbih0YXJnZXRbcHJvcF0sIHZhbHVlLCBmb3JjZSwgZGVlcFN0cmluZ01peGluKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICAvL1NpbWlsYXIgdG8gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQsIGJ1dCB0aGUgJ3RoaXMnIG9iamVjdCBpcyBzcGVjaWZpZWRcbiAgICAvL2ZpcnN0LCBzaW5jZSBpdCBpcyBlYXNpZXIgdG8gcmVhZC9maWd1cmUgb3V0IHdoYXQgJ3RoaXMnIHdpbGwgYmUuXG4gICAgZnVuY3Rpb24gYmluZChvYmosIGZuKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcmlwdHMoKSB7XG4gICAgICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVmYXVsdE9uRXJyb3IoZXJyKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9XG5cbiAgICAvL0FsbG93IGdldHRpbmcgYSBnbG9iYWwgdGhhdCBpcyBleHByZXNzZWQgaW5cbiAgICAvL2RvdCBub3RhdGlvbiwgbGlrZSAnYS5iLmMnLlxuICAgIGZ1bmN0aW9uIGdldEdsb2JhbCh2YWx1ZSkge1xuICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGcgPSBnbG9iYWw7XG4gICAgICAgIGVhY2godmFsdWUuc3BsaXQoJy4nKSwgZnVuY3Rpb24gKHBhcnQpIHtcbiAgICAgICAgICAgIGcgPSBnW3BhcnRdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0cyBhbiBlcnJvciB3aXRoIGEgcG9pbnRlciB0byBhbiBVUkwgd2l0aCBtb3JlIGluZm9ybWF0aW9uLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBpZCB0aGUgZXJyb3IgSUQgdGhhdCBtYXBzIHRvIGFuIElEIG9uIGEgd2ViIHBhZ2UuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgaHVtYW4gcmVhZGFibGUgZXJyb3IuXG4gICAgICogQHBhcmFtIHtFcnJvcn0gW2Vycl0gdGhlIG9yaWdpbmFsIGVycm9yLCBpZiB0aGVyZSBpcyBvbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RXJyb3J9XG4gICAgICovXG4gICAgZnVuY3Rpb24gbWFrZUVycm9yKGlkLCBtc2csIGVyciwgcmVxdWlyZU1vZHVsZXMpIHtcbiAgICAgICAgdmFyIGUgPSBuZXcgRXJyb3IobXNnICsgJ1xcbmh0dHA6Ly9yZXF1aXJlanMub3JnL2RvY3MvZXJyb3JzLmh0bWwjJyArIGlkKTtcbiAgICAgICAgZS5yZXF1aXJlVHlwZSA9IGlkO1xuICAgICAgICBlLnJlcXVpcmVNb2R1bGVzID0gcmVxdWlyZU1vZHVsZXM7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGUub3JpZ2luYWxFcnJvciA9IGVycjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGRlZmluZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgLy9JZiBhIGRlZmluZSBpcyBhbHJlYWR5IGluIHBsYXkgdmlhIGFub3RoZXIgQU1EIGxvYWRlcixcbiAgICAgICAgLy9kbyBub3Qgb3ZlcndyaXRlLlxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiByZXF1aXJlanMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmIChpc0Z1bmN0aW9uKHJlcXVpcmVqcykpIHtcbiAgICAgICAgICAgIC8vRG8gbm90IG92ZXJ3cml0ZSBhbiBleGlzdGluZyByZXF1aXJlanMgaW5zdGFuY2UuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY2ZnID0gcmVxdWlyZWpzO1xuICAgICAgICByZXF1aXJlanMgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy9BbGxvdyBmb3IgYSByZXF1aXJlIGNvbmZpZyBvYmplY3RcbiAgICBpZiAodHlwZW9mIHJlcXVpcmUgIT09ICd1bmRlZmluZWQnICYmICFpc0Z1bmN0aW9uKHJlcXVpcmUpKSB7XG4gICAgICAgIC8vYXNzdW1lIGl0IGlzIGEgY29uZmlnIG9iamVjdC5cbiAgICAgICAgY2ZnID0gcmVxdWlyZTtcbiAgICAgICAgcmVxdWlyZSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXdDb250ZXh0KGNvbnRleHROYW1lKSB7XG4gICAgICAgIHZhciBpbkNoZWNrTG9hZGVkLCBNb2R1bGUsIGNvbnRleHQsIGhhbmRsZXJzLFxuICAgICAgICAgICAgY2hlY2tMb2FkZWRUaW1lb3V0SWQsXG4gICAgICAgICAgICBjb25maWcgPSB7XG4gICAgICAgICAgICAgICAgLy9EZWZhdWx0cy4gRG8gbm90IHNldCBhIGRlZmF1bHQgZm9yIG1hcFxuICAgICAgICAgICAgICAgIC8vY29uZmlnIHRvIHNwZWVkIHVwIG5vcm1hbGl6ZSgpLCB3aGljaFxuICAgICAgICAgICAgICAgIC8vd2lsbCBydW4gZmFzdGVyIGlmIHRoZXJlIGlzIG5vIGRlZmF1bHQuXG4gICAgICAgICAgICAgICAgd2FpdFNlY29uZHM6IDcsXG4gICAgICAgICAgICAgICAgYmFzZVVybDogJy4vJyxcbiAgICAgICAgICAgICAgICBwYXRoczoge30sXG4gICAgICAgICAgICAgICAgYnVuZGxlczoge30sXG4gICAgICAgICAgICAgICAgcGtnczoge30sXG4gICAgICAgICAgICAgICAgc2hpbToge30sXG4gICAgICAgICAgICAgICAgY29uZmlnOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlZ2lzdHJ5ID0ge30sXG4gICAgICAgICAgICAvL3JlZ2lzdHJ5IG9mIGp1c3QgZW5hYmxlZCBtb2R1bGVzLCB0byBzcGVlZFxuICAgICAgICAgICAgLy9jeWNsZSBicmVha2luZyBjb2RlIHdoZW4gbG90cyBvZiBtb2R1bGVzXG4gICAgICAgICAgICAvL2FyZSByZWdpc3RlcmVkLCBidXQgbm90IGFjdGl2YXRlZC5cbiAgICAgICAgICAgIGVuYWJsZWRSZWdpc3RyeSA9IHt9LFxuICAgICAgICAgICAgdW5kZWZFdmVudHMgPSB7fSxcbiAgICAgICAgICAgIGRlZlF1ZXVlID0gW10sXG4gICAgICAgICAgICBkZWZpbmVkID0ge30sXG4gICAgICAgICAgICB1cmxGZXRjaGVkID0ge30sXG4gICAgICAgICAgICBidW5kbGVzTWFwID0ge30sXG4gICAgICAgICAgICByZXF1aXJlQ291bnRlciA9IDEsXG4gICAgICAgICAgICB1bm5vcm1hbGl6ZWRDb3VudGVyID0gMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJpbXMgdGhlIC4gYW5kIC4uIGZyb20gYW4gYXJyYXkgb2YgcGF0aCBzZWdtZW50cy5cbiAgICAgICAgICogSXQgd2lsbCBrZWVwIGEgbGVhZGluZyBwYXRoIHNlZ21lbnQgaWYgYSAuLiB3aWxsIGJlY29tZVxuICAgICAgICAgKiB0aGUgZmlyc3QgcGF0aCBzZWdtZW50LCB0byBoZWxwIHdpdGggbW9kdWxlIG5hbWUgbG9va3VwcyxcbiAgICAgICAgICogd2hpY2ggYWN0IGxpa2UgcGF0aHMsIGJ1dCBjYW4gYmUgcmVtYXBwZWQuIEJ1dCB0aGUgZW5kIHJlc3VsdCxcbiAgICAgICAgICogYWxsIHBhdGhzIHRoYXQgdXNlIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGxvb2sgbm9ybWFsaXplZC5cbiAgICAgICAgICogTk9URTogdGhpcyBtZXRob2QgTU9ESUZJRVMgdGhlIGlucHV0IGFycmF5LlxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnkgdGhlIGFycmF5IG9mIHBhdGggc2VnbWVudHMuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiB0cmltRG90cyhhcnkpIHtcbiAgICAgICAgICAgIHZhciBpLCBwYXJ0O1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHBhcnQgPSBhcnlbaV07XG4gICAgICAgICAgICAgICAgaWYgKHBhcnQgPT09ICcuJykge1xuICAgICAgICAgICAgICAgICAgICBhcnkuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICBpIC09IDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwYXJ0ID09PSAnLi4nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIGF0IHRoZSBzdGFydCwgb3IgcHJldmlvdXMgdmFsdWUgaXMgc3RpbGwgLi4sXG4gICAgICAgICAgICAgICAgICAgIC8vIGtlZXAgdGhlbSBzbyB0aGF0IHdoZW4gY29udmVydGVkIHRvIGEgcGF0aCBpdCBtYXlcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RpbGwgd29yayB3aGVuIGNvbnZlcnRlZCB0byBhIHBhdGgsIGV2ZW4gdGhvdWdoXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIGFuIElEIGl0IGlzIGxlc3MgdGhhbiBpZGVhbC4gSW4gbGFyZ2VyIHBvaW50XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbGVhc2VzLCBtYXkgYmUgYmV0dGVyIHRvIGp1c3Qga2ljayBvdXQgYW4gZXJyb3IuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpID09PSAwIHx8IChpID09IDEgJiYgYXJ5WzJdID09PSAnLi4nKSB8fCBhcnlbaSAtIDFdID09PSAnLi4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJ5LnNwbGljZShpIC0gMSwgMik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpIC09IDI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogR2l2ZW4gYSByZWxhdGl2ZSBtb2R1bGUgbmFtZSwgbGlrZSAuL3NvbWV0aGluZywgbm9ybWFsaXplIGl0IHRvXG4gICAgICAgICAqIGEgcmVhbCBuYW1lIHRoYXQgY2FuIGJlIG1hcHBlZCB0byBhIHBhdGguXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSByZWxhdGl2ZSBuYW1lXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBiYXNlTmFtZSBhIHJlYWwgbmFtZSB0aGF0IHRoZSBuYW1lIGFyZyBpcyByZWxhdGl2ZVxuICAgICAgICAgKiB0by5cbiAgICAgICAgICogQHBhcmFtIHtCb29sZWFufSBhcHBseU1hcCBhcHBseSB0aGUgbWFwIGNvbmZpZyB0byB0aGUgdmFsdWUuIFNob3VsZFxuICAgICAgICAgKiBvbmx5IGJlIGRvbmUgaWYgdGhpcyBub3JtYWxpemF0aW9uIGlzIGZvciBhIGRlcGVuZGVuY3kgSUQuXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IG5vcm1hbGl6ZWQgbmFtZVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gbm9ybWFsaXplKG5hbWUsIGJhc2VOYW1lLCBhcHBseU1hcCkge1xuICAgICAgICAgICAgdmFyIHBrZ01haW4sIG1hcFZhbHVlLCBuYW1lUGFydHMsIGksIGosIG5hbWVTZWdtZW50LCBsYXN0SW5kZXgsXG4gICAgICAgICAgICAgICAgZm91bmRNYXAsIGZvdW5kSSwgZm91bmRTdGFyTWFwLCBzdGFySSwgbm9ybWFsaXplZEJhc2VQYXJ0cyxcbiAgICAgICAgICAgICAgICBiYXNlUGFydHMgPSAoYmFzZU5hbWUgJiYgYmFzZU5hbWUuc3BsaXQoJy8nKSksXG4gICAgICAgICAgICAgICAgbWFwID0gY29uZmlnLm1hcCxcbiAgICAgICAgICAgICAgICBzdGFyTWFwID0gbWFwICYmIG1hcFsnKiddO1xuXG4gICAgICAgICAgICAvL0FkanVzdCBhbnkgcmVsYXRpdmUgcGF0aHMuXG4gICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgIG5hbWUgPSBuYW1lLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgbGFzdEluZGV4ID0gbmFtZS5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgd2FudGluZyBub2RlIElEIGNvbXBhdGliaWxpdHksIHN0cmlwIC5qcyBmcm9tIGVuZFxuICAgICAgICAgICAgICAgIC8vIG9mIElEcy4gSGF2ZSB0byBkbyB0aGlzIGhlcmUsIGFuZCBub3QgaW4gbmFtZVRvVXJsXG4gICAgICAgICAgICAgICAgLy8gYmVjYXVzZSBub2RlIGFsbG93cyBlaXRoZXIgLmpzIG9yIG5vbiAuanMgdG8gbWFwXG4gICAgICAgICAgICAgICAgLy8gdG8gc2FtZSBmaWxlLlxuICAgICAgICAgICAgICAgIGlmIChjb25maWcubm9kZUlkQ29tcGF0ICYmIGpzU3VmZml4UmVnRXhwLnRlc3QobmFtZVtsYXN0SW5kZXhdKSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lW2xhc3RJbmRleF0gPSBuYW1lW2xhc3RJbmRleF0ucmVwbGFjZShqc1N1ZmZpeFJlZ0V4cCwgJycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFN0YXJ0cyB3aXRoIGEgJy4nIHNvIG5lZWQgdGhlIGJhc2VOYW1lXG4gICAgICAgICAgICAgICAgaWYgKG5hbWVbMF0uY2hhckF0KDApID09PSAnLicgJiYgYmFzZVBhcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vQ29udmVydCBiYXNlTmFtZSB0byBhcnJheSwgYW5kIGxvcCBvZmYgdGhlIGxhc3QgcGFydCxcbiAgICAgICAgICAgICAgICAgICAgLy9zbyB0aGF0IC4gbWF0Y2hlcyB0aGF0ICdkaXJlY3RvcnknIGFuZCBub3QgbmFtZSBvZiB0aGUgYmFzZU5hbWUnc1xuICAgICAgICAgICAgICAgICAgICAvL21vZHVsZS4gRm9yIGluc3RhbmNlLCBiYXNlTmFtZSBvZiAnb25lL3R3by90aHJlZScsIG1hcHMgdG9cbiAgICAgICAgICAgICAgICAgICAgLy8nb25lL3R3by90aHJlZS5qcycsIGJ1dCB3ZSB3YW50IHRoZSBkaXJlY3RvcnksICdvbmUvdHdvJyBmb3JcbiAgICAgICAgICAgICAgICAgICAgLy90aGlzIG5vcm1hbGl6YXRpb24uXG4gICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRCYXNlUGFydHMgPSBiYXNlUGFydHMuc2xpY2UoMCwgYmFzZVBhcnRzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgICAgICBuYW1lID0gbm9ybWFsaXplZEJhc2VQYXJ0cy5jb25jYXQobmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJpbURvdHMobmFtZSk7XG4gICAgICAgICAgICAgICAgbmFtZSA9IG5hbWUuam9pbignLycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0FwcGx5IG1hcCBjb25maWcgaWYgYXZhaWxhYmxlLlxuICAgICAgICAgICAgaWYgKGFwcGx5TWFwICYmIG1hcCAmJiAoYmFzZVBhcnRzIHx8IHN0YXJNYXApKSB7XG4gICAgICAgICAgICAgICAgbmFtZVBhcnRzID0gbmFtZS5zcGxpdCgnLycpO1xuXG4gICAgICAgICAgICAgICAgb3V0ZXJMb29wOiBmb3IgKGkgPSBuYW1lUGFydHMubGVuZ3RoOyBpID4gMDsgaSAtPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWVTZWdtZW50ID0gbmFtZVBhcnRzLnNsaWNlKDAsIGkpLmpvaW4oJy8nKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYmFzZVBhcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL0ZpbmQgdGhlIGxvbmdlc3QgYmFzZU5hbWUgc2VnbWVudCBtYXRjaCBpbiB0aGUgY29uZmlnLlxuICAgICAgICAgICAgICAgICAgICAgICAgLy9TbywgZG8gam9pbnMgb24gdGhlIGJpZ2dlc3QgdG8gc21hbGxlc3QgbGVuZ3RocyBvZiBiYXNlUGFydHMuXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGogPSBiYXNlUGFydHMubGVuZ3RoOyBqID4gMDsgaiAtPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwVmFsdWUgPSBnZXRPd24obWFwLCBiYXNlUGFydHMuc2xpY2UoMCwgaikuam9pbignLycpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vYmFzZU5hbWUgc2VnbWVudCBoYXMgY29uZmlnLCBmaW5kIGlmIGl0IGhhcyBvbmUgZm9yXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy90aGlzIG5hbWUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hcFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcFZhbHVlID0gZ2V0T3duKG1hcFZhbHVlLCBuYW1lU2VnbWVudCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXBWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9NYXRjaCwgdXBkYXRlIG5hbWUgdG8gdGhlIG5ldyB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kTWFwID0gbWFwVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3VuZEkgPSBpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWsgb3V0ZXJMb29wO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy9DaGVjayBmb3IgYSBzdGFyIG1hcCBtYXRjaCwgYnV0IGp1c3QgaG9sZCBvbiB0byBpdCxcbiAgICAgICAgICAgICAgICAgICAgLy9pZiB0aGVyZSBpcyBhIHNob3J0ZXIgc2VnbWVudCBtYXRjaCBsYXRlciBpbiBhIG1hdGNoaW5nXG4gICAgICAgICAgICAgICAgICAgIC8vY29uZmlnLCB0aGVuIGZhdm9yIG92ZXIgdGhpcyBzdGFyIG1hcC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmb3VuZFN0YXJNYXAgJiYgc3Rhck1hcCAmJiBnZXRPd24oc3Rhck1hcCwgbmFtZVNlZ21lbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3VuZFN0YXJNYXAgPSBnZXRPd24oc3Rhck1hcCwgbmFtZVNlZ21lbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhckkgPSBpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFmb3VuZE1hcCAmJiBmb3VuZFN0YXJNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgZm91bmRNYXAgPSBmb3VuZFN0YXJNYXA7XG4gICAgICAgICAgICAgICAgICAgIGZvdW5kSSA9IHN0YXJJO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChmb3VuZE1hcCkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lUGFydHMuc3BsaWNlKDAsIGZvdW5kSSwgZm91bmRNYXApO1xuICAgICAgICAgICAgICAgICAgICBuYW1lID0gbmFtZVBhcnRzLmpvaW4oJy8nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBuYW1lIHBvaW50cyB0byBhIHBhY2thZ2UncyBuYW1lLCB1c2VcbiAgICAgICAgICAgIC8vIHRoZSBwYWNrYWdlIG1haW4gaW5zdGVhZC5cbiAgICAgICAgICAgIHBrZ01haW4gPSBnZXRPd24oY29uZmlnLnBrZ3MsIG5hbWUpO1xuXG4gICAgICAgICAgICByZXR1cm4gcGtnTWFpbiA/IHBrZ01haW4gOiBuYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmVtb3ZlU2NyaXB0KG5hbWUpIHtcbiAgICAgICAgICAgIGlmIChpc0Jyb3dzZXIpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHNjcmlwdHMoKSwgZnVuY3Rpb24gKHNjcmlwdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjcmlwdE5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLXJlcXVpcmVtb2R1bGUnKSA9PT0gbmFtZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdE5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLXJlcXVpcmVjb250ZXh0JykgPT09IGNvbnRleHQuY29udGV4dE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdE5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHROb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBoYXNQYXRoRmFsbGJhY2soaWQpIHtcbiAgICAgICAgICAgIHZhciBwYXRoQ29uZmlnID0gZ2V0T3duKGNvbmZpZy5wYXRocywgaWQpO1xuICAgICAgICAgICAgaWYgKHBhdGhDb25maWcgJiYgaXNBcnJheShwYXRoQ29uZmlnKSAmJiBwYXRoQ29uZmlnLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAvL1BvcCBvZmYgdGhlIGZpcnN0IGFycmF5IHZhbHVlLCBzaW5jZSBpdCBmYWlsZWQsIGFuZFxuICAgICAgICAgICAgICAgIC8vcmV0cnlcbiAgICAgICAgICAgICAgICBwYXRoQ29uZmlnLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5yZXF1aXJlLnVuZGVmKGlkKTtcblxuICAgICAgICAgICAgICAgIC8vQ3VzdG9tIHJlcXVpcmUgdGhhdCBkb2VzIG5vdCBkbyBtYXAgdHJhbnNsYXRpb24sIHNpbmNlXG4gICAgICAgICAgICAgICAgLy9JRCBpcyBcImFic29sdXRlXCIsIGFscmVhZHkgbWFwcGVkL3Jlc29sdmVkLlxuICAgICAgICAgICAgICAgIGNvbnRleHQubWFrZVJlcXVpcmUobnVsbCwge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWFwOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkoW2lkXSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vVHVybnMgYSBwbHVnaW4hcmVzb3VyY2UgdG8gW3BsdWdpbiwgcmVzb3VyY2VdXG4gICAgICAgIC8vd2l0aCB0aGUgcGx1Z2luIGJlaW5nIHVuZGVmaW5lZCBpZiB0aGUgbmFtZVxuICAgICAgICAvL2RpZCBub3QgaGF2ZSBhIHBsdWdpbiBwcmVmaXguXG4gICAgICAgIGZ1bmN0aW9uIHNwbGl0UHJlZml4KG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBwcmVmaXgsXG4gICAgICAgICAgICAgICAgaW5kZXggPSBuYW1lID8gbmFtZS5pbmRleE9mKCchJykgOiAtMTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgcHJlZml4ID0gbmFtZS5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZyhpbmRleCArIDEsIG5hbWUubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbcHJlZml4LCBuYW1lXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbW9kdWxlIG1hcHBpbmcgdGhhdCBpbmNsdWRlcyBwbHVnaW4gcHJlZml4LCBtb2R1bGVcbiAgICAgICAgICogbmFtZSwgYW5kIHBhdGguIElmIHBhcmVudE1vZHVsZU1hcCBpcyBwcm92aWRlZCBpdCB3aWxsXG4gICAgICAgICAqIGFsc28gbm9ybWFsaXplIHRoZSBuYW1lIHZpYSByZXF1aXJlLm5vcm1hbGl6ZSgpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSBtb2R1bGUgbmFtZVxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gW3BhcmVudE1vZHVsZU1hcF0gcGFyZW50IG1vZHVsZSBtYXBcbiAgICAgICAgICogZm9yIHRoZSBtb2R1bGUgbmFtZSwgdXNlZCB0byByZXNvbHZlIHJlbGF0aXZlIG5hbWVzLlxuICAgICAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlzTm9ybWFsaXplZDogaXMgdGhlIElEIGFscmVhZHkgbm9ybWFsaXplZC5cbiAgICAgICAgICogVGhpcyBpcyB0cnVlIGlmIHRoaXMgY2FsbCBpcyBkb25lIGZvciBhIGRlZmluZSgpIG1vZHVsZSBJRC5cbiAgICAgICAgICogQHBhcmFtIHtCb29sZWFufSBhcHBseU1hcDogYXBwbHkgdGhlIG1hcCBjb25maWcgdG8gdGhlIElELlxuICAgICAgICAgKiBTaG91bGQgb25seSBiZSB0cnVlIGlmIHRoaXMgbWFwIGlzIGZvciBhIGRlcGVuZGVuY3kuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBtYWtlTW9kdWxlTWFwKG5hbWUsIHBhcmVudE1vZHVsZU1hcCwgaXNOb3JtYWxpemVkLCBhcHBseU1hcCkge1xuICAgICAgICAgICAgdmFyIHVybCwgcGx1Z2luTW9kdWxlLCBzdWZmaXgsIG5hbWVQYXJ0cyxcbiAgICAgICAgICAgICAgICBwcmVmaXggPSBudWxsLFxuICAgICAgICAgICAgICAgIHBhcmVudE5hbWUgPSBwYXJlbnRNb2R1bGVNYXAgPyBwYXJlbnRNb2R1bGVNYXAubmFtZSA6IG51bGwsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxOYW1lID0gbmFtZSxcbiAgICAgICAgICAgICAgICBpc0RlZmluZSA9IHRydWUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplZE5hbWUgPSAnJztcblxuICAgICAgICAgICAgLy9JZiBubyBuYW1lLCB0aGVuIGl0IG1lYW5zIGl0IGlzIGEgcmVxdWlyZSBjYWxsLCBnZW5lcmF0ZSBhblxuICAgICAgICAgICAgLy9pbnRlcm5hbCBuYW1lLlxuICAgICAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgICAgICAgaXNEZWZpbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBuYW1lID0gJ19AcicgKyAocmVxdWlyZUNvdW50ZXIgKz0gMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5hbWVQYXJ0cyA9IHNwbGl0UHJlZml4KG5hbWUpO1xuICAgICAgICAgICAgcHJlZml4ID0gbmFtZVBhcnRzWzBdO1xuICAgICAgICAgICAgbmFtZSA9IG5hbWVQYXJ0c1sxXTtcblxuICAgICAgICAgICAgaWYgKHByZWZpeCkge1xuICAgICAgICAgICAgICAgIHByZWZpeCA9IG5vcm1hbGl6ZShwcmVmaXgsIHBhcmVudE5hbWUsIGFwcGx5TWFwKTtcbiAgICAgICAgICAgICAgICBwbHVnaW5Nb2R1bGUgPSBnZXRPd24oZGVmaW5lZCwgcHJlZml4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9BY2NvdW50IGZvciByZWxhdGl2ZSBwYXRocyBpZiB0aGVyZSBpcyBhIGJhc2UgbmFtZS5cbiAgICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKHByZWZpeCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocGx1Z2luTW9kdWxlICYmIHBsdWdpbk1vZHVsZS5ub3JtYWxpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vUGx1Z2luIGlzIGxvYWRlZCwgdXNlIGl0cyBub3JtYWxpemUgbWV0aG9kLlxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplZE5hbWUgPSBwbHVnaW5Nb2R1bGUubm9ybWFsaXplKG5hbWUsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZShuYW1lLCBwYXJlbnROYW1lLCBhcHBseU1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIG5lc3RlZCBwbHVnaW4gcmVmZXJlbmNlcywgdGhlbiBkbyBub3QgdHJ5IHRvXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBub3JtYWxpemUsIGFzIGl0IHdpbGwgbm90IG5vcm1hbGl6ZSBjb3JyZWN0bHkuIFRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBsYWNlcyBhIHJlc3RyaWN0aW9uIG9uIHJlc291cmNlSWRzLCBhbmQgdGhlIGxvbmdlclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVybSBzb2x1dGlvbiBpcyBub3QgdG8gbm9ybWFsaXplIHVudGlsIHBsdWdpbnMgYXJlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsb2FkZWQgYW5kIGFsbCBub3JtYWxpemF0aW9ucyB0byBhbGxvdyBmb3IgYXN5bmNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvYWRpbmcgb2YgYSBsb2FkZXIgcGx1Z2luLiBCdXQgZm9yIG5vdywgZml4ZXMgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb21tb24gdXNlcy4gRGV0YWlscyBpbiAjMTEzMVxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplZE5hbWUgPSBuYW1lLmluZGV4T2YoJyEnKSA9PT0gLTEgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemUobmFtZSwgcGFyZW50TmFtZSwgYXBwbHlNYXApIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vQSByZWd1bGFyIG1vZHVsZS5cbiAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemUobmFtZSwgcGFyZW50TmFtZSwgYXBwbHlNYXApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vTm9ybWFsaXplZCBuYW1lIG1heSBiZSBhIHBsdWdpbiBJRCBkdWUgdG8gbWFwIGNvbmZpZ1xuICAgICAgICAgICAgICAgICAgICAvL2FwcGxpY2F0aW9uIGluIG5vcm1hbGl6ZS4gVGhlIG1hcCBjb25maWcgdmFsdWVzIG11c3RcbiAgICAgICAgICAgICAgICAgICAgLy9hbHJlYWR5IGJlIG5vcm1hbGl6ZWQsIHNvIGRvIG5vdCBuZWVkIHRvIHJlZG8gdGhhdCBwYXJ0LlxuICAgICAgICAgICAgICAgICAgICBuYW1lUGFydHMgPSBzcGxpdFByZWZpeChub3JtYWxpemVkTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIHByZWZpeCA9IG5hbWVQYXJ0c1swXTtcbiAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplZE5hbWUgPSBuYW1lUGFydHNbMV07XG4gICAgICAgICAgICAgICAgICAgIGlzTm9ybWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgdXJsID0gY29udGV4dC5uYW1lVG9Vcmwobm9ybWFsaXplZE5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiB0aGUgaWQgaXMgYSBwbHVnaW4gaWQgdGhhdCBjYW5ub3QgYmUgZGV0ZXJtaW5lZCBpZiBpdCBuZWVkc1xuICAgICAgICAgICAgLy9ub3JtYWxpemF0aW9uLCBzdGFtcCBpdCB3aXRoIGEgdW5pcXVlIElEIHNvIHR3byBtYXRjaGluZyByZWxhdGl2ZVxuICAgICAgICAgICAgLy9pZHMgdGhhdCBtYXkgY29uZmxpY3QgY2FuIGJlIHNlcGFyYXRlLlxuICAgICAgICAgICAgc3VmZml4ID0gcHJlZml4ICYmICFwbHVnaW5Nb2R1bGUgJiYgIWlzTm9ybWFsaXplZCA/XG4gICAgICAgICAgICAgICAgICAgICAnX3Vubm9ybWFsaXplZCcgKyAodW5ub3JtYWxpemVkQ291bnRlciArPSAxKSA6XG4gICAgICAgICAgICAgICAgICAgICAnJztcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBwcmVmaXg6IHByZWZpeCxcbiAgICAgICAgICAgICAgICBuYW1lOiBub3JtYWxpemVkTmFtZSxcbiAgICAgICAgICAgICAgICBwYXJlbnRNYXA6IHBhcmVudE1vZHVsZU1hcCxcbiAgICAgICAgICAgICAgICB1bm5vcm1hbGl6ZWQ6ICEhc3VmZml4LFxuICAgICAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsTmFtZTogb3JpZ2luYWxOYW1lLFxuICAgICAgICAgICAgICAgIGlzRGVmaW5lOiBpc0RlZmluZSxcbiAgICAgICAgICAgICAgICBpZDogKHByZWZpeCA/XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmaXggKyAnIScgKyBub3JtYWxpemVkTmFtZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVkTmFtZSkgKyBzdWZmaXhcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRNb2R1bGUoZGVwTWFwKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBkZXBNYXAuaWQsXG4gICAgICAgICAgICAgICAgbW9kID0gZ2V0T3duKHJlZ2lzdHJ5LCBpZCk7XG5cbiAgICAgICAgICAgIGlmICghbW9kKSB7XG4gICAgICAgICAgICAgICAgbW9kID0gcmVnaXN0cnlbaWRdID0gbmV3IGNvbnRleHQuTW9kdWxlKGRlcE1hcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2Q7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvbihkZXBNYXAsIG5hbWUsIGZuKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBkZXBNYXAuaWQsXG4gICAgICAgICAgICAgICAgbW9kID0gZ2V0T3duKHJlZ2lzdHJ5LCBpZCk7XG5cbiAgICAgICAgICAgIGlmIChoYXNQcm9wKGRlZmluZWQsIGlkKSAmJlxuICAgICAgICAgICAgICAgICAgICAoIW1vZCB8fCBtb2QuZGVmaW5lRW1pdENvbXBsZXRlKSkge1xuICAgICAgICAgICAgICAgIGlmIChuYW1lID09PSAnZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgZm4oZGVmaW5lZFtpZF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbW9kID0gZ2V0TW9kdWxlKGRlcE1hcCk7XG4gICAgICAgICAgICAgICAgaWYgKG1vZC5lcnJvciAmJiBuYW1lID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICAgICAgICAgIGZuKG1vZC5lcnJvcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kLm9uKG5hbWUsIGZuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvbkVycm9yKGVyciwgZXJyYmFjaykge1xuICAgICAgICAgICAgdmFyIGlkcyA9IGVyci5yZXF1aXJlTW9kdWxlcyxcbiAgICAgICAgICAgICAgICBub3RpZmllZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoZXJyYmFjaykge1xuICAgICAgICAgICAgICAgIGVycmJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWFjaChpZHMsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kID0gZ2V0T3duKHJlZ2lzdHJ5LCBpZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vU2V0IGVycm9yIG9uIG1vZHVsZSwgc28gaXQgc2tpcHMgdGltZW91dCBjaGVja3MuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2QuZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kLmV2ZW50cy5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2QuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIW5vdGlmaWVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcS5vbkVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEludGVybmFsIG1ldGhvZCB0byB0cmFuc2ZlciBnbG9iYWxRdWV1ZSBpdGVtcyB0byB0aGlzIGNvbnRleHQnc1xuICAgICAgICAgKiBkZWZRdWV1ZS5cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIHRha2VHbG9iYWxRdWV1ZSgpIHtcbiAgICAgICAgICAgIC8vUHVzaCBhbGwgdGhlIGdsb2JhbERlZlF1ZXVlIGl0ZW1zIGludG8gdGhlIGNvbnRleHQncyBkZWZRdWV1ZVxuICAgICAgICAgICAgaWYgKGdsb2JhbERlZlF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vQXJyYXkgc3BsaWNlIGluIHRoZSB2YWx1ZXMgc2luY2UgdGhlIGNvbnRleHQgY29kZSBoYXMgYVxuICAgICAgICAgICAgICAgIC8vbG9jYWwgdmFyIHJlZiB0byBkZWZRdWV1ZSwgc28gY2Fubm90IGp1c3QgcmVhc3NpZ24gdGhlIG9uZVxuICAgICAgICAgICAgICAgIC8vb24gY29udGV4dC5cbiAgICAgICAgICAgICAgICBhcHNwLmFwcGx5KGRlZlF1ZXVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgW2RlZlF1ZXVlLmxlbmd0aCwgMF0uY29uY2F0KGdsb2JhbERlZlF1ZXVlKSk7XG4gICAgICAgICAgICAgICAgZ2xvYmFsRGVmUXVldWUgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGhhbmRsZXJzID0ge1xuICAgICAgICAgICAgJ3JlcXVpcmUnOiBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1vZC5yZXF1aXJlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtb2QucmVxdWlyZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKG1vZC5yZXF1aXJlID0gY29udGV4dC5tYWtlUmVxdWlyZShtb2QubWFwKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdleHBvcnRzJzogZnVuY3Rpb24gKG1vZCkge1xuICAgICAgICAgICAgICAgIG1vZC51c2luZ0V4cG9ydHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChtb2QubWFwLmlzRGVmaW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2QuZXhwb3J0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChkZWZpbmVkW21vZC5tYXAuaWRdID0gbW9kLmV4cG9ydHMpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChtb2QuZXhwb3J0cyA9IGRlZmluZWRbbW9kLm1hcC5pZF0gPSB7fSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ21vZHVsZSc6IGZ1bmN0aW9uIChtb2QpIHtcbiAgICAgICAgICAgICAgICBpZiAobW9kLm1vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kLm1vZHVsZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKG1vZC5tb2R1bGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogbW9kLm1hcC5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVyaTogbW9kLm1hcC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gIGdldE93bihjb25maWcuY29uZmlnLCBtb2QubWFwLmlkKSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBleHBvcnRzOiBtb2QuZXhwb3J0cyB8fCAobW9kLmV4cG9ydHMgPSB7fSlcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNsZWFuUmVnaXN0cnkoaWQpIHtcbiAgICAgICAgICAgIC8vQ2xlYW4gdXAgbWFjaGluZXJ5IHVzZWQgZm9yIHdhaXRpbmcgbW9kdWxlcy5cbiAgICAgICAgICAgIGRlbGV0ZSByZWdpc3RyeVtpZF07XG4gICAgICAgICAgICBkZWxldGUgZW5hYmxlZFJlZ2lzdHJ5W2lkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGJyZWFrQ3ljbGUobW9kLCB0cmFjZWQsIHByb2Nlc3NlZCkge1xuICAgICAgICAgICAgdmFyIGlkID0gbW9kLm1hcC5pZDtcblxuICAgICAgICAgICAgaWYgKG1vZC5lcnJvcikge1xuICAgICAgICAgICAgICAgIG1vZC5lbWl0KCdlcnJvcicsIG1vZC5lcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyYWNlZFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGVhY2gobW9kLmRlcE1hcHMsIGZ1bmN0aW9uIChkZXBNYXAsIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlcElkID0gZGVwTWFwLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVwID0gZ2V0T3duKHJlZ2lzdHJ5LCBkZXBJZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9Pbmx5IGZvcmNlIHRoaW5ncyB0aGF0IGhhdmUgbm90IGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgICAgICAvL2JlaW5nIGRlZmluZWQsIHNvIHN0aWxsIGluIHRoZSByZWdpc3RyeSxcbiAgICAgICAgICAgICAgICAgICAgLy9hbmQgb25seSBpZiBpdCBoYXMgbm90IGJlZW4gbWF0Y2hlZCB1cFxuICAgICAgICAgICAgICAgICAgICAvL2luIHRoZSBtb2R1bGUgYWxyZWFkeS5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlcCAmJiAhbW9kLmRlcE1hdGNoZWRbaV0gJiYgIXByb2Nlc3NlZFtkZXBJZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXRPd24odHJhY2VkLCBkZXBJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2QuZGVmaW5lRGVwKGksIGRlZmluZWRbZGVwSWRdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2QuY2hlY2soKTsgLy9wYXNzIGZhbHNlP1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVha0N5Y2xlKGRlcCwgdHJhY2VkLCBwcm9jZXNzZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc2VkW2lkXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjaGVja0xvYWRlZCgpIHtcbiAgICAgICAgICAgIHZhciBlcnIsIHVzaW5nUGF0aEZhbGxiYWNrLFxuICAgICAgICAgICAgICAgIHdhaXRJbnRlcnZhbCA9IGNvbmZpZy53YWl0U2Vjb25kcyAqIDEwMDAsXG4gICAgICAgICAgICAgICAgLy9JdCBpcyBwb3NzaWJsZSB0byBkaXNhYmxlIHRoZSB3YWl0IGludGVydmFsIGJ5IHVzaW5nIHdhaXRTZWNvbmRzIG9mIDAuXG4gICAgICAgICAgICAgICAgZXhwaXJlZCA9IHdhaXRJbnRlcnZhbCAmJiAoY29udGV4dC5zdGFydFRpbWUgKyB3YWl0SW50ZXJ2YWwpIDwgbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgICAgICAgICAgbm9Mb2FkcyA9IFtdLFxuICAgICAgICAgICAgICAgIHJlcUNhbGxzID0gW10sXG4gICAgICAgICAgICAgICAgc3RpbGxMb2FkaW5nID0gZmFsc2UsXG4gICAgICAgICAgICAgICAgbmVlZEN5Y2xlQ2hlY2sgPSB0cnVlO1xuXG4gICAgICAgICAgICAvL0RvIG5vdCBib3RoZXIgaWYgdGhpcyBjYWxsIHdhcyBhIHJlc3VsdCBvZiBhIGN5Y2xlIGJyZWFrLlxuICAgICAgICAgICAgaWYgKGluQ2hlY2tMb2FkZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGluQ2hlY2tMb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvL0ZpZ3VyZSBvdXQgdGhlIHN0YXRlIG9mIGFsbCB0aGUgbW9kdWxlcy5cbiAgICAgICAgICAgIGVhY2hQcm9wKGVuYWJsZWRSZWdpc3RyeSwgZnVuY3Rpb24gKG1vZCkge1xuICAgICAgICAgICAgICAgIHZhciBtYXAgPSBtb2QubWFwLFxuICAgICAgICAgICAgICAgICAgICBtb2RJZCA9IG1hcC5pZDtcblxuICAgICAgICAgICAgICAgIC8vU2tpcCB0aGluZ3MgdGhhdCBhcmUgbm90IGVuYWJsZWQgb3IgaW4gZXJyb3Igc3RhdGUuXG4gICAgICAgICAgICAgICAgaWYgKCFtb2QuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFtYXAuaXNEZWZpbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxQ2FsbHMucHVzaChtb2QpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghbW9kLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vSWYgdGhlIG1vZHVsZSBzaG91bGQgYmUgZXhlY3V0ZWQsIGFuZCBpdCBoYXMgbm90XG4gICAgICAgICAgICAgICAgICAgIC8vYmVlbiBpbml0ZWQgYW5kIHRpbWUgaXMgdXAsIHJlbWVtYmVyIGl0LlxuICAgICAgICAgICAgICAgICAgICBpZiAoIW1vZC5pbml0ZWQgJiYgZXhwaXJlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc1BhdGhGYWxsYmFjayhtb2RJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2luZ1BhdGhGYWxsYmFjayA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RpbGxMb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9Mb2Fkcy5wdXNoKG1vZElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVTY3JpcHQobW9kSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFtb2QuaW5pdGVkICYmIG1vZC5mZXRjaGVkICYmIG1hcC5pc0RlZmluZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RpbGxMb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWFwLnByZWZpeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vTm8gcmVhc29uIHRvIGtlZXAgbG9va2luZyBmb3IgdW5maW5pc2hlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9hZGluZy4gSWYgdGhlIG9ubHkgc3RpbGxMb2FkaW5nIGlzIGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3BsdWdpbiByZXNvdXJjZSB0aG91Z2gsIGtlZXAgZ29pbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9iZWNhdXNlIGl0IG1heSBiZSB0aGF0IGEgcGx1Z2luIHJlc291cmNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9pcyB3YWl0aW5nIG9uIGEgbm9uLXBsdWdpbiBjeWNsZS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKG5lZWRDeWNsZUNoZWNrID0gZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChleHBpcmVkICYmIG5vTG9hZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy9JZiB3YWl0IHRpbWUgZXhwaXJlZCwgdGhyb3cgZXJyb3Igb2YgdW5sb2FkZWQgbW9kdWxlcy5cbiAgICAgICAgICAgICAgICBlcnIgPSBtYWtlRXJyb3IoJ3RpbWVvdXQnLCAnTG9hZCB0aW1lb3V0IGZvciBtb2R1bGVzOiAnICsgbm9Mb2FkcywgbnVsbCwgbm9Mb2Fkcyk7XG4gICAgICAgICAgICAgICAgZXJyLmNvbnRleHROYW1lID0gY29udGV4dC5jb250ZXh0TmFtZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25FcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL05vdCBleHBpcmVkLCBjaGVjayBmb3IgYSBjeWNsZS5cbiAgICAgICAgICAgIGlmIChuZWVkQ3ljbGVDaGVjaykge1xuICAgICAgICAgICAgICAgIGVhY2gocmVxQ2FsbHMsIGZ1bmN0aW9uIChtb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtDeWNsZShtb2QsIHt9LCB7fSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgc3RpbGwgd2FpdGluZyBvbiBsb2FkcywgYW5kIHRoZSB3YWl0aW5nIGxvYWQgaXMgc29tZXRoaW5nXG4gICAgICAgICAgICAvL290aGVyIHRoYW4gYSBwbHVnaW4gcmVzb3VyY2UsIG9yIHRoZXJlIGFyZSBzdGlsbCBvdXRzdGFuZGluZ1xuICAgICAgICAgICAgLy9zY3JpcHRzLCB0aGVuIGp1c3QgdHJ5IGJhY2sgbGF0ZXIuXG4gICAgICAgICAgICBpZiAoKCFleHBpcmVkIHx8IHVzaW5nUGF0aEZhbGxiYWNrKSAmJiBzdGlsbExvYWRpbmcpIHtcbiAgICAgICAgICAgICAgICAvL1NvbWV0aGluZyBpcyBzdGlsbCB3YWl0aW5nIHRvIGxvYWQuIFdhaXQgZm9yIGl0LCBidXQgb25seVxuICAgICAgICAgICAgICAgIC8vaWYgYSB0aW1lb3V0IGlzIG5vdCBhbHJlYWR5IGluIGVmZmVjdC5cbiAgICAgICAgICAgICAgICBpZiAoKGlzQnJvd3NlciB8fCBpc1dlYldvcmtlcikgJiYgIWNoZWNrTG9hZGVkVGltZW91dElkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrTG9hZGVkVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGVja0xvYWRlZFRpbWVvdXRJZCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGVja0xvYWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICB9LCA1MCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbkNoZWNrTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBNb2R1bGUgPSBmdW5jdGlvbiAobWFwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50cyA9IGdldE93bih1bmRlZkV2ZW50cywgbWFwLmlkKSB8fCB7fTtcbiAgICAgICAgICAgIHRoaXMubWFwID0gbWFwO1xuICAgICAgICAgICAgdGhpcy5zaGltID0gZ2V0T3duKGNvbmZpZy5zaGltLCBtYXAuaWQpO1xuICAgICAgICAgICAgdGhpcy5kZXBFeHBvcnRzID0gW107XG4gICAgICAgICAgICB0aGlzLmRlcE1hcHMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuZGVwTWF0Y2hlZCA9IFtdO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW5NYXBzID0ge307XG4gICAgICAgICAgICB0aGlzLmRlcENvdW50ID0gMDtcblxuICAgICAgICAgICAgLyogdGhpcy5leHBvcnRzIHRoaXMuZmFjdG9yeVxuICAgICAgICAgICAgICAgdGhpcy5kZXBNYXBzID0gW10sXG4gICAgICAgICAgICAgICB0aGlzLmVuYWJsZWQsIHRoaXMuZmV0Y2hlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgfTtcblxuICAgICAgICBNb2R1bGUucHJvdG90eXBlID0ge1xuICAgICAgICAgICAgaW5pdDogZnVuY3Rpb24gKGRlcE1hcHMsIGZhY3RvcnksIGVycmJhY2ssIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAgICAgICAgIC8vRG8gbm90IGRvIG1vcmUgaW5pdHMgaWYgYWxyZWFkeSBkb25lLiBDYW4gaGFwcGVuIGlmIHRoZXJlXG4gICAgICAgICAgICAgICAgLy9hcmUgbXVsdGlwbGUgZGVmaW5lIGNhbGxzIGZvciB0aGUgc2FtZSBtb2R1bGUuIFRoYXQgaXMgbm90XG4gICAgICAgICAgICAgICAgLy9hIG5vcm1hbCwgY29tbW9uIGNhc2UsIGJ1dCBpdCBpcyBhbHNvIG5vdCB1bmV4cGVjdGVkLlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmluaXRlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5mYWN0b3J5ID0gZmFjdG9yeTtcblxuICAgICAgICAgICAgICAgIGlmIChlcnJiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vUmVnaXN0ZXIgZm9yIGVycm9ycyBvbiB0aGlzIG1vZHVsZS5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbignZXJyb3InLCBlcnJiYWNrKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXZlbnRzLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vSWYgbm8gZXJyYmFjayBhbHJlYWR5LCBidXQgdGhlcmUgYXJlIGVycm9yIGxpc3RlbmVyc1xuICAgICAgICAgICAgICAgICAgICAvL29uIHRoaXMgbW9kdWxlLCBzZXQgdXAgYW4gZXJyYmFjayB0byBwYXNzIHRvIHRoZSBkZXBzLlxuICAgICAgICAgICAgICAgICAgICBlcnJiYWNrID0gYmluZCh0aGlzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9EbyBhIGNvcHkgb2YgdGhlIGRlcGVuZGVuY3kgYXJyYXksIHNvIHRoYXRcbiAgICAgICAgICAgICAgICAvL3NvdXJjZSBpbnB1dHMgYXJlIG5vdCBtb2RpZmllZC4gRm9yIGV4YW1wbGVcbiAgICAgICAgICAgICAgICAvL1wic2hpbVwiIGRlcHMgYXJlIHBhc3NlZCBpbiBoZXJlIGRpcmVjdGx5LCBhbmRcbiAgICAgICAgICAgICAgICAvL2RvaW5nIGEgZGlyZWN0IG1vZGlmaWNhdGlvbiBvZiB0aGUgZGVwTWFwcyBhcnJheVxuICAgICAgICAgICAgICAgIC8vd291bGQgYWZmZWN0IHRoYXQgY29uZmlnLlxuICAgICAgICAgICAgICAgIHRoaXMuZGVwTWFwcyA9IGRlcE1hcHMgJiYgZGVwTWFwcy5zbGljZSgwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXJyYmFjayA9IGVycmJhY2s7XG5cbiAgICAgICAgICAgICAgICAvL0luZGljYXRlIHRoaXMgbW9kdWxlIGhhcyBiZSBpbml0aWFsaXplZFxuICAgICAgICAgICAgICAgIHRoaXMuaW5pdGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRoaXMuaWdub3JlID0gb3B0aW9ucy5pZ25vcmU7XG5cbiAgICAgICAgICAgICAgICAvL0NvdWxkIGhhdmUgb3B0aW9uIHRvIGluaXQgdGhpcyBtb2R1bGUgaW4gZW5hYmxlZCBtb2RlLFxuICAgICAgICAgICAgICAgIC8vb3IgY291bGQgaGF2ZSBiZWVuIHByZXZpb3VzbHkgbWFya2VkIGFzIGVuYWJsZWQuIEhvd2V2ZXIsXG4gICAgICAgICAgICAgICAgLy90aGUgZGVwZW5kZW5jaWVzIGFyZSBub3Qga25vd24gdW50aWwgaW5pdCBpcyBjYWxsZWQuIFNvXG4gICAgICAgICAgICAgICAgLy9pZiBlbmFibGVkIHByZXZpb3VzbHksIG5vdyB0cmlnZ2VyIGRlcGVuZGVuY2llcyBhcyBlbmFibGVkLlxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmVuYWJsZWQgfHwgdGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vRW5hYmxlIHRoaXMgbW9kdWxlIGFuZCBkZXBlbmRlbmNpZXMuXG4gICAgICAgICAgICAgICAgICAgIC8vV2lsbCBjYWxsIHRoaXMuY2hlY2soKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmVuYWJsZSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2hlY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBkZWZpbmVEZXA6IGZ1bmN0aW9uIChpLCBkZXBFeHBvcnRzKSB7XG4gICAgICAgICAgICAgICAgLy9CZWNhdXNlIG9mIGN5Y2xlcywgZGVmaW5lZCBjYWxsYmFjayBmb3IgYSBnaXZlblxuICAgICAgICAgICAgICAgIC8vZXhwb3J0IGNhbiBiZSBjYWxsZWQgbW9yZSB0aGFuIG9uY2UuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlcE1hdGNoZWRbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXBNYXRjaGVkW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXBDb3VudCAtPSAxO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcEV4cG9ydHNbaV0gPSBkZXBFeHBvcnRzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGZldGNoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZmV0Y2hlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZmV0Y2hlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBjb250ZXh0LnN0YXJ0VGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gdGhpcy5tYXA7XG5cbiAgICAgICAgICAgICAgICAvL0lmIHRoZSBtYW5hZ2VyIGlzIGZvciBhIHBsdWdpbiBtYW5hZ2VkIHJlc291cmNlLFxuICAgICAgICAgICAgICAgIC8vYXNrIHRoZSBwbHVnaW4gdG8gbG9hZCBpdCBub3cuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2hpbSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm1ha2VSZXF1aXJlKHRoaXMubWFwLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVCdWlsZENhbGxiYWNrOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pKHRoaXMuc2hpbS5kZXBzIHx8IFtdLCBiaW5kKHRoaXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXAucHJlZml4ID8gdGhpcy5jYWxsUGx1Z2luKCkgOiB0aGlzLmxvYWQoKTtcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vUmVndWxhciBkZXBlbmRlbmN5LlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWFwLnByZWZpeCA/IHRoaXMuY2FsbFBsdWdpbigpIDogdGhpcy5sb2FkKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbG9hZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciB1cmwgPSB0aGlzLm1hcC51cmw7XG5cbiAgICAgICAgICAgICAgICAvL1JlZ3VsYXIgZGVwZW5kZW5jeS5cbiAgICAgICAgICAgICAgICBpZiAoIXVybEZldGNoZWRbdXJsXSkge1xuICAgICAgICAgICAgICAgICAgICB1cmxGZXRjaGVkW3VybF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxvYWQodGhpcy5tYXAuaWQsIHVybCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBDaGVja3MgaWYgdGhlIG1vZHVsZSBpcyByZWFkeSB0byBkZWZpbmUgaXRzZWxmLCBhbmQgaWYgc28sXG4gICAgICAgICAgICAgKiBkZWZpbmUgaXQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNoZWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgdGhpcy5lbmFibGluZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGVyciwgY2pzTW9kdWxlLFxuICAgICAgICAgICAgICAgICAgICBpZCA9IHRoaXMubWFwLmlkLFxuICAgICAgICAgICAgICAgICAgICBkZXBFeHBvcnRzID0gdGhpcy5kZXBFeHBvcnRzLFxuICAgICAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5leHBvcnRzLFxuICAgICAgICAgICAgICAgICAgICBmYWN0b3J5ID0gdGhpcy5mYWN0b3J5O1xuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmluaXRlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZldGNoKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB0aGlzLmVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmRlZmluaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vVGhlIGZhY3RvcnkgY291bGQgdHJpZ2dlciBhbm90aGVyIHJlcXVpcmUgY2FsbFxuICAgICAgICAgICAgICAgICAgICAvL3RoYXQgd291bGQgcmVzdWx0IGluIGNoZWNraW5nIHRoaXMgbW9kdWxlIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vZGVmaW5lIGl0c2VsZiBhZ2Fpbi4gSWYgYWxyZWFkeSBpbiB0aGUgcHJvY2Vzc1xuICAgICAgICAgICAgICAgICAgICAvL29mIGRvaW5nIHRoYXQsIHNraXAgdGhpcyB3b3JrLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmluaW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXBDb3VudCA8IDEgJiYgIXRoaXMuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oZmFjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL0lmIHRoZXJlIGlzIGFuIGVycm9yIGxpc3RlbmVyLCBmYXZvciBwYXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy90byB0aGF0IGluc3RlYWQgb2YgdGhyb3dpbmcgYW4gZXJyb3IuIEhvd2V2ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9vbmx5IGRvIGl0IGZvciBkZWZpbmUoKSdkICBtb2R1bGVzLiByZXF1aXJlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9lcnJiYWNrcyBzaG91bGQgbm90IGJlIGNhbGxlZCBmb3IgZmFpbHVyZXMgaW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3RoZWlyIGNhbGxiYWNrcyAoIzY5OSkuIEhvd2V2ZXIgaWYgYSBnbG9iYWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL29uRXJyb3IgaXMgc2V0LCB1c2UgdGhhdC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKHRoaXMuZXZlbnRzLmVycm9yICYmIHRoaXMubWFwLmlzRGVmaW5lKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXEub25FcnJvciAhPT0gZGVmYXVsdE9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cG9ydHMgPSBjb250ZXh0LmV4ZWNDYihpZCwgZmFjdG9yeSwgZGVwRXhwb3J0cywgZXhwb3J0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVyciA9IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBvcnRzID0gY29udGV4dC5leGVjQ2IoaWQsIGZhY3RvcnksIGRlcEV4cG9ydHMsIGV4cG9ydHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhdm9yIHJldHVybiB2YWx1ZSBvdmVyIGV4cG9ydHMuIElmIG5vZGUvY2pzIGluIHBsYXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlbiB3aWxsIG5vdCBoYXZlIGEgcmV0dXJuIHZhbHVlIGFueXdheS4gRmF2b3JcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBtb2R1bGUuZXhwb3J0cyBhc3NpZ25tZW50IG92ZXIgZXhwb3J0cyBvYmplY3QuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubWFwLmlzRGVmaW5lICYmIGV4cG9ydHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjanNNb2R1bGUgPSB0aGlzLm1vZHVsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNqc01vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0cyA9IGNqc01vZHVsZS5leHBvcnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMudXNpbmdFeHBvcnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2V4cG9ydHMgYWxyZWFkeSBzZXQgdGhlIGRlZmluZWQgdmFsdWUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBvcnRzID0gdGhpcy5leHBvcnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIucmVxdWlyZU1hcCA9IHRoaXMubWFwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIucmVxdWlyZU1vZHVsZXMgPSB0aGlzLm1hcC5pc0RlZmluZSA/IFt0aGlzLm1hcC5pZF0gOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnIucmVxdWlyZVR5cGUgPSB0aGlzLm1hcC5pc0RlZmluZSA/ICdkZWZpbmUnIDogJ3JlcXVpcmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb25FcnJvcigodGhpcy5lcnJvciA9IGVycikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL0p1c3QgYSBsaXRlcmFsIHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0cyA9IGZhY3Rvcnk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwb3J0cyA9IGV4cG9ydHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1hcC5pc0RlZmluZSAmJiAhdGhpcy5pZ25vcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZpbmVkW2lkXSA9IGV4cG9ydHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVxLm9uUmVzb3VyY2VMb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcS5vblJlc291cmNlTG9hZChjb250ZXh0LCB0aGlzLm1hcCwgdGhpcy5kZXBNYXBzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQ2xlYW4gdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuUmVnaXN0cnkoaWQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmluZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy9GaW5pc2hlZCB0aGUgZGVmaW5lIHN0YWdlLiBBbGxvdyBjYWxsaW5nIGNoZWNrIGFnYWluXG4gICAgICAgICAgICAgICAgICAgIC8vdG8gYWxsb3cgZGVmaW5lIG5vdGlmaWNhdGlvbnMgYmVsb3cgaW4gdGhlIGNhc2Ugb2YgYVxuICAgICAgICAgICAgICAgICAgICAvL2N5Y2xlLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmluaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZGVmaW5lZCAmJiAhdGhpcy5kZWZpbmVFbWl0dGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmluZUVtaXR0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KCdkZWZpbmVkJywgdGhpcy5leHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmaW5lRW1pdENvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbFBsdWdpbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBtYXAgPSB0aGlzLm1hcCxcbiAgICAgICAgICAgICAgICAgICAgaWQgPSBtYXAuaWQsXG4gICAgICAgICAgICAgICAgICAgIC8vTWFwIGFscmVhZHkgbm9ybWFsaXplZCB0aGUgcHJlZml4LlxuICAgICAgICAgICAgICAgICAgICBwbHVnaW5NYXAgPSBtYWtlTW9kdWxlTWFwKG1hcC5wcmVmaXgpO1xuXG4gICAgICAgICAgICAgICAgLy9NYXJrIHRoaXMgYXMgYSBkZXBlbmRlbmN5IGZvciB0aGlzIHBsdWdpbiwgc28gaXRcbiAgICAgICAgICAgICAgICAvL2NhbiBiZSB0cmFjZWQgZm9yIGN5Y2xlcy5cbiAgICAgICAgICAgICAgICB0aGlzLmRlcE1hcHMucHVzaChwbHVnaW5NYXApO1xuXG4gICAgICAgICAgICAgICAgb24ocGx1Z2luTWFwLCAnZGVmaW5lZCcsIGJpbmQodGhpcywgZnVuY3Rpb24gKHBsdWdpbikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbG9hZCwgbm9ybWFsaXplZE1hcCwgbm9ybWFsaXplZE1vZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1bmRsZUlkID0gZ2V0T3duKGJ1bmRsZXNNYXAsIHRoaXMubWFwLmlkKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSB0aGlzLm1hcC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50TmFtZSA9IHRoaXMubWFwLnBhcmVudE1hcCA/IHRoaXMubWFwLnBhcmVudE1hcC5uYW1lIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsUmVxdWlyZSA9IGNvbnRleHQubWFrZVJlcXVpcmUobWFwLnBhcmVudE1hcCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZUJ1aWxkQ2FsbGJhY2s6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vSWYgY3VycmVudCBtYXAgaXMgbm90IG5vcm1hbGl6ZWQsIHdhaXQgZm9yIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgLy9ub3JtYWxpemVkIG5hbWUgdG8gbG9hZCBpbnN0ZWFkIG9mIGNvbnRpbnVpbmcuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1hcC51bm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vTm9ybWFsaXplIHRoZSBJRCBpZiB0aGUgcGx1Z2luIGFsbG93cyBpdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwbHVnaW4ubm9ybWFsaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IHBsdWdpbi5ub3JtYWxpemUobmFtZSwgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vcm1hbGl6ZShuYW1lLCBwYXJlbnROYW1lLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9wcmVmaXggYW5kIG5hbWUgc2hvdWxkIGFscmVhZHkgYmUgbm9ybWFsaXplZCwgbm8gbmVlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9mb3IgYXBwbHlpbmcgbWFwIGNvbmZpZyBhZ2FpbiBlaXRoZXIuXG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVkTWFwID0gbWFrZU1vZHVsZU1hcChtYXAucHJlZml4ICsgJyEnICsgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLnBhcmVudE1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbihub3JtYWxpemVkTWFwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkZWZpbmVkJywgYmluZCh0aGlzLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0KFtdLCBmdW5jdGlvbiAoKSB7IHJldHVybiB2YWx1ZTsgfSwgbnVsbCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlnbm9yZTogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRNb2QgPSBnZXRPd24ocmVnaXN0cnksIG5vcm1hbGl6ZWRNYXAuaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWRNb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL01hcmsgdGhpcyBhcyBhIGRlcGVuZGVuY3kgZm9yIHRoaXMgcGx1Z2luLCBzbyBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY2FuIGJlIHRyYWNlZCBmb3IgY3ljbGVzLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVwTWFwcy5wdXNoKG5vcm1hbGl6ZWRNYXApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRzLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRNb2Qub24oJ2Vycm9yJywgYmluZCh0aGlzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVkTW9kLmVuYWJsZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvL0lmIGEgcGF0aHMgY29uZmlnLCB0aGVuIGp1c3QgbG9hZCB0aGF0IGZpbGUgaW5zdGVhZCB0b1xuICAgICAgICAgICAgICAgICAgICAvL3Jlc29sdmUgdGhlIHBsdWdpbiwgYXMgaXQgaXMgYnVpbHQgaW50byB0aGF0IHBhdGhzIGxheWVyLlxuICAgICAgICAgICAgICAgICAgICBpZiAoYnVuZGxlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLnVybCA9IGNvbnRleHQubmFtZVRvVXJsKGJ1bmRsZUlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbG9hZCA9IGJpbmQodGhpcywgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmluaXQoW10sIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9LCBudWxsLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGxvYWQuZXJyb3IgPSBiaW5kKHRoaXMsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW5pdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnIucmVxdWlyZU1vZHVsZXMgPSBbaWRdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1JlbW92ZSB0ZW1wIHVubm9ybWFsaXplZCBtb2R1bGVzIGZvciB0aGlzIG1vZHVsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vc2luY2UgdGhleSB3aWxsIG5ldmVyIGJlIHJlc29sdmVkIG90aGVyd2lzZSBub3cuXG4gICAgICAgICAgICAgICAgICAgICAgICBlYWNoUHJvcChyZWdpc3RyeSwgZnVuY3Rpb24gKG1vZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2QubWFwLmlkLmluZGV4T2YoaWQgKyAnX3Vubm9ybWFsaXplZCcpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuUmVnaXN0cnkobW9kLm1hcC5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9BbGxvdyBwbHVnaW5zIHRvIGxvYWQgb3RoZXIgY29kZSB3aXRob3V0IGhhdmluZyB0byBrbm93IHRoZVxuICAgICAgICAgICAgICAgICAgICAvL2NvbnRleHQgb3IgaG93IHRvICdjb21wbGV0ZScgdGhlIGxvYWQuXG4gICAgICAgICAgICAgICAgICAgIGxvYWQuZnJvbVRleHQgPSBiaW5kKHRoaXMsIGZ1bmN0aW9uICh0ZXh0LCB0ZXh0QWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvKmpzbGludCBldmlsOiB0cnVlICovXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kdWxlTmFtZSA9IG1hcC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZU1hcCA9IG1ha2VNb2R1bGVNYXAobW9kdWxlTmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFzSW50ZXJhY3RpdmUgPSB1c2VJbnRlcmFjdGl2ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9BcyBvZiAyLjEuMCwgc3VwcG9ydCBqdXN0IHBhc3NpbmcgdGhlIHRleHQsIHRvIHJlaW5mb3JjZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy9mcm9tVGV4dCBvbmx5IGJlaW5nIGNhbGxlZCBvbmNlIHBlciByZXNvdXJjZS4gU3RpbGxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vc3VwcG9ydCBvbGQgc3R5bGUgb2YgcGFzc2luZyBtb2R1bGVOYW1lIGJ1dCBkaXNjYXJkXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoYXQgbW9kdWxlTmFtZSBpbiBmYXZvciBvZiB0aGUgaW50ZXJuYWwgcmVmLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRleHRBbHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0ID0gdGV4dEFsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9UdXJuIG9mZiBpbnRlcmFjdGl2ZSBzY3JpcHQgbWF0Y2hpbmcgZm9yIElFIGZvciBhbnkgZGVmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NhbGxzIGluIHRoZSB0ZXh0LCB0aGVuIHR1cm4gaXQgYmFjayBvbiBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc0ludGVyYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlSW50ZXJhY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9QcmltZSB0aGUgc3lzdGVtIGJ5IGNyZWF0aW5nIGEgbW9kdWxlIGluc3RhbmNlIGZvclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9pdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGdldE1vZHVsZShtb2R1bGVNYXApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1RyYW5zZmVyIGFueSBjb25maWcgdG8gdGhpcyBvdGhlciBtb2R1bGUuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzUHJvcChjb25maWcuY29uZmlnLCBpZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25maWcuY29uZmlnW21vZHVsZU5hbWVdID0gY29uZmlnLmNvbmZpZ1tpZF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxLmV4ZWModGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9uRXJyb3IobWFrZUVycm9yKCdmcm9tdGV4dGV2YWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zyb21UZXh0IGV2YWwgZm9yICcgKyBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgZmFpbGVkOiAnICsgZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbaWRdKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNJbnRlcmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZUludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9NYXJrIHRoaXMgYXMgYSBkZXBlbmRlbmN5IGZvciB0aGUgcGx1Z2luXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3Jlc291cmNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcE1hcHMucHVzaChtb2R1bGVNYXApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1N1cHBvcnQgYW5vbnltb3VzIG1vZHVsZXMuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmNvbXBsZXRlTG9hZChtb2R1bGVOYW1lKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9CaW5kIHRoZSB2YWx1ZSBvZiB0aGF0IG1vZHVsZSB0byB0aGUgdmFsdWUgZm9yIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVzb3VyY2UgSUQuXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbFJlcXVpcmUoW21vZHVsZU5hbWVdLCBsb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9Vc2UgcGFyZW50TmFtZSBoZXJlIHNpbmNlIHRoZSBwbHVnaW4ncyBuYW1lIGlzIG5vdCByZWxpYWJsZSxcbiAgICAgICAgICAgICAgICAgICAgLy9jb3VsZCBiZSBzb21lIHdlaXJkIHN0cmluZyB3aXRoIG5vIHBhdGggdGhhdCBhY3R1YWxseSB3YW50cyB0b1xuICAgICAgICAgICAgICAgICAgICAvL3JlZmVyZW5jZSB0aGUgcGFyZW50TmFtZSdzIHBhdGguXG4gICAgICAgICAgICAgICAgICAgIHBsdWdpbi5sb2FkKG1hcC5uYW1lLCBsb2NhbFJlcXVpcmUsIGxvYWQsIGNvbmZpZyk7XG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgY29udGV4dC5lbmFibGUocGx1Z2luTWFwLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbk1hcHNbcGx1Z2luTWFwLmlkXSA9IHBsdWdpbk1hcDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGVuYWJsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGVuYWJsZWRSZWdpc3RyeVt0aGlzLm1hcC5pZF0gPSB0aGlzO1xuICAgICAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvL1NldCBmbGFnIG1lbnRpb25pbmcgdGhhdCB0aGUgbW9kdWxlIGlzIGVuYWJsaW5nLFxuICAgICAgICAgICAgICAgIC8vc28gdGhhdCBpbW1lZGlhdGUgY2FsbHMgdG8gdGhlIGRlZmluZWQgY2FsbGJhY2tzXG4gICAgICAgICAgICAgICAgLy9mb3IgZGVwZW5kZW5jaWVzIGRvIG5vdCB0cmlnZ2VyIGluYWR2ZXJ0ZW50IGxvYWRcbiAgICAgICAgICAgICAgICAvL3dpdGggdGhlIGRlcENvdW50IHN0aWxsIGJlaW5nIHplcm8uXG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGluZyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvL0VuYWJsZSBlYWNoIGRlcGVuZGVuY3lcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMuZGVwTWFwcywgYmluZCh0aGlzLCBmdW5jdGlvbiAoZGVwTWFwLCBpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZCwgbW9kLCBoYW5kbGVyO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZGVwTWFwID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9EZXBlbmRlbmN5IG5lZWRzIHRvIGJlIGNvbnZlcnRlZCB0byBhIGRlcE1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9hbmQgd2lyZWQgdXAgdG8gdGhpcyBtb2R1bGUuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXBNYXAgPSBtYWtlTW9kdWxlTWFwKGRlcE1hcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHRoaXMubWFwLmlzRGVmaW5lID8gdGhpcy5tYXAgOiB0aGlzLm1hcC5wYXJlbnRNYXApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIXRoaXMuc2tpcE1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcE1hcHNbaV0gPSBkZXBNYXA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXIgPSBnZXRPd24oaGFuZGxlcnMsIGRlcE1hcC5pZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXBFeHBvcnRzW2ldID0gaGFuZGxlcih0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVwQ291bnQgKz0gMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgb24oZGVwTWFwLCAnZGVmaW5lZCcsIGJpbmQodGhpcywgZnVuY3Rpb24gKGRlcEV4cG9ydHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmluZURlcChpLCBkZXBFeHBvcnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNoZWNrKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmVycmJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbihkZXBNYXAsICdlcnJvcicsIGJpbmQodGhpcywgdGhpcy5lcnJiYWNrKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZCA9IGRlcE1hcC5pZDtcbiAgICAgICAgICAgICAgICAgICAgbW9kID0gcmVnaXN0cnlbaWRdO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vU2tpcCBzcGVjaWFsIG1vZHVsZXMgbGlrZSAncmVxdWlyZScsICdleHBvcnRzJywgJ21vZHVsZSdcbiAgICAgICAgICAgICAgICAgICAgLy9BbHNvLCBkb24ndCBjYWxsIGVuYWJsZSBpZiBpdCBpcyBhbHJlYWR5IGVuYWJsZWQsXG4gICAgICAgICAgICAgICAgICAgIC8vaW1wb3J0YW50IGluIGNpcmN1bGFyIGRlcGVuZGVuY3kgY2FzZXMuXG4gICAgICAgICAgICAgICAgICAgIGlmICghaGFzUHJvcChoYW5kbGVycywgaWQpICYmIG1vZCAmJiAhbW9kLmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZW5hYmxlKGRlcE1hcCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAvL0VuYWJsZSBlYWNoIHBsdWdpbiB0aGF0IGlzIHVzZWQgaW5cbiAgICAgICAgICAgICAgICAvL2EgZGVwZW5kZW5jeVxuICAgICAgICAgICAgICAgIGVhY2hQcm9wKHRoaXMucGx1Z2luTWFwcywgYmluZCh0aGlzLCBmdW5jdGlvbiAocGx1Z2luTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2QgPSBnZXRPd24ocmVnaXN0cnksIHBsdWdpbk1hcC5pZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2QgJiYgIW1vZC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmVuYWJsZShwbHVnaW5NYXAsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5lbmFibGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVjaygpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb246IGZ1bmN0aW9uIChuYW1lLCBjYikge1xuICAgICAgICAgICAgICAgIHZhciBjYnMgPSB0aGlzLmV2ZW50c1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIWNicykge1xuICAgICAgICAgICAgICAgICAgICBjYnMgPSB0aGlzLmV2ZW50c1tuYW1lXSA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYnMucHVzaChjYik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBlbWl0OiBmdW5jdGlvbiAobmFtZSwgZXZ0KSB7XG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLmV2ZW50c1tuYW1lXSwgZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNiKGV2dCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKG5hbWUgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9Ob3cgdGhhdCB0aGUgZXJyb3IgaGFuZGxlciB3YXMgdHJpZ2dlcmVkLCByZW1vdmVcbiAgICAgICAgICAgICAgICAgICAgLy90aGUgbGlzdGVuZXJzLCBzaW5jZSB0aGlzIGJyb2tlbiBNb2R1bGUgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICAgICAgLy9jYW4gc3RheSBhcm91bmQgZm9yIGEgd2hpbGUgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNhbGxHZXRNb2R1bGUoYXJncykge1xuICAgICAgICAgICAgLy9Ta2lwIG1vZHVsZXMgYWxyZWFkeSBkZWZpbmVkLlxuICAgICAgICAgICAgaWYgKCFoYXNQcm9wKGRlZmluZWQsIGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICAgICAgZ2V0TW9kdWxlKG1ha2VNb2R1bGVNYXAoYXJnc1swXSwgbnVsbCwgdHJ1ZSkpLmluaXQoYXJnc1sxXSwgYXJnc1syXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByZW1vdmVMaXN0ZW5lcihub2RlLCBmdW5jLCBuYW1lLCBpZU5hbWUpIHtcbiAgICAgICAgICAgIC8vRmF2b3IgZGV0YWNoRXZlbnQgYmVjYXVzZSBvZiBJRTlcbiAgICAgICAgICAgIC8vaXNzdWUsIHNlZSBhdHRhY2hFdmVudC9hZGRFdmVudExpc3RlbmVyIGNvbW1lbnQgZWxzZXdoZXJlXG4gICAgICAgICAgICAvL2luIHRoaXMgZmlsZS5cbiAgICAgICAgICAgIGlmIChub2RlLmRldGFjaEV2ZW50ICYmICFpc09wZXJhKSB7XG4gICAgICAgICAgICAgICAgLy9Qcm9iYWJseSBJRS4gSWYgbm90IGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IsIHdoaWNoIHdpbGwgYmVcbiAgICAgICAgICAgICAgICAvL3VzZWZ1bCB0byBrbm93LlxuICAgICAgICAgICAgICAgIGlmIChpZU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5kZXRhY2hFdmVudChpZU5hbWUsIGZ1bmMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKG5hbWUsIGZ1bmMsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiBhbiBldmVudCBmcm9tIGEgc2NyaXB0IG5vZGUsIGdldCB0aGUgcmVxdWlyZWpzIGluZm8gZnJvbSBpdCxcbiAgICAgICAgICogYW5kIHRoZW4gcmVtb3ZlcyB0aGUgZXZlbnQgbGlzdGVuZXJzIG9uIHRoZSBub2RlLlxuICAgICAgICAgKiBAcGFyYW0ge0V2ZW50fSBldnRcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGdldFNjcmlwdERhdGEoZXZ0KSB7XG4gICAgICAgICAgICAvL1VzaW5nIGN1cnJlbnRUYXJnZXQgaW5zdGVhZCBvZiB0YXJnZXQgZm9yIEZpcmVmb3ggMi4wJ3Mgc2FrZS4gTm90XG4gICAgICAgICAgICAvL2FsbCBvbGQgYnJvd3NlcnMgd2lsbCBiZSBzdXBwb3J0ZWQsIGJ1dCB0aGlzIG9uZSB3YXMgZWFzeSBlbm91Z2hcbiAgICAgICAgICAgIC8vdG8gc3VwcG9ydCBhbmQgc3RpbGwgbWFrZXMgc2Vuc2UuXG4gICAgICAgICAgICB2YXIgbm9kZSA9IGV2dC5jdXJyZW50VGFyZ2V0IHx8IGV2dC5zcmNFbGVtZW50O1xuXG4gICAgICAgICAgICAvL1JlbW92ZSB0aGUgbGlzdGVuZXJzIG9uY2UgaGVyZS5cbiAgICAgICAgICAgIHJlbW92ZUxpc3RlbmVyKG5vZGUsIGNvbnRleHQub25TY3JpcHRMb2FkLCAnbG9hZCcsICdvbnJlYWR5c3RhdGVjaGFuZ2UnKTtcbiAgICAgICAgICAgIHJlbW92ZUxpc3RlbmVyKG5vZGUsIGNvbnRleHQub25TY3JpcHRFcnJvciwgJ2Vycm9yJyk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbm9kZTogbm9kZSxcbiAgICAgICAgICAgICAgICBpZDogbm9kZSAmJiBub2RlLmdldEF0dHJpYnV0ZSgnZGF0YS1yZXF1aXJlbW9kdWxlJylcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBpbnRha2VEZWZpbmVzKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3M7XG5cbiAgICAgICAgICAgIC8vQW55IGRlZmluZWQgbW9kdWxlcyBpbiB0aGUgZ2xvYmFsIHF1ZXVlLCBpbnRha2UgdGhlbSBub3cuXG4gICAgICAgICAgICB0YWtlR2xvYmFsUXVldWUoKTtcblxuICAgICAgICAgICAgLy9NYWtlIHN1cmUgYW55IHJlbWFpbmluZyBkZWZRdWV1ZSBpdGVtcyBnZXQgcHJvcGVybHkgcHJvY2Vzc2VkLlxuICAgICAgICAgICAgd2hpbGUgKGRlZlF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGFyZ3MgPSBkZWZRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIGlmIChhcmdzWzBdID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvbkVycm9yKG1ha2VFcnJvcignbWlzbWF0Y2gnLCAnTWlzbWF0Y2hlZCBhbm9ueW1vdXMgZGVmaW5lKCkgbW9kdWxlOiAnICsgYXJnc1thcmdzLmxlbmd0aCAtIDFdKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9hcmdzIGFyZSBpZCwgZGVwcywgZmFjdG9yeS4gU2hvdWxkIGJlIG5vcm1hbGl6ZWQgYnkgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vZGVmaW5lKCkgZnVuY3Rpb24uXG4gICAgICAgICAgICAgICAgICAgIGNhbGxHZXRNb2R1bGUoYXJncyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29udGV4dCA9IHtcbiAgICAgICAgICAgIGNvbmZpZzogY29uZmlnLFxuICAgICAgICAgICAgY29udGV4dE5hbWU6IGNvbnRleHROYW1lLFxuICAgICAgICAgICAgcmVnaXN0cnk6IHJlZ2lzdHJ5LFxuICAgICAgICAgICAgZGVmaW5lZDogZGVmaW5lZCxcbiAgICAgICAgICAgIHVybEZldGNoZWQ6IHVybEZldGNoZWQsXG4gICAgICAgICAgICBkZWZRdWV1ZTogZGVmUXVldWUsXG4gICAgICAgICAgICBNb2R1bGU6IE1vZHVsZSxcbiAgICAgICAgICAgIG1ha2VNb2R1bGVNYXA6IG1ha2VNb2R1bGVNYXAsXG4gICAgICAgICAgICBuZXh0VGljazogcmVxLm5leHRUaWNrLFxuICAgICAgICAgICAgb25FcnJvcjogb25FcnJvcixcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBTZXQgYSBjb25maWd1cmF0aW9uIGZvciB0aGUgY29udGV4dC5cbiAgICAgICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjZmcgY29uZmlnIG9iamVjdCB0byBpbnRlZ3JhdGUuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbmZpZ3VyZTogZnVuY3Rpb24gKGNmZykge1xuICAgICAgICAgICAgICAgIC8vTWFrZSBzdXJlIHRoZSBiYXNlVXJsIGVuZHMgaW4gYSBzbGFzaC5cbiAgICAgICAgICAgICAgICBpZiAoY2ZnLmJhc2VVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNmZy5iYXNlVXJsLmNoYXJBdChjZmcuYmFzZVVybC5sZW5ndGggLSAxKSAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZmcuYmFzZVVybCArPSAnLyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL1NhdmUgb2ZmIHRoZSBwYXRocyBzaW5jZSB0aGV5IHJlcXVpcmUgc3BlY2lhbCBwcm9jZXNzaW5nLFxuICAgICAgICAgICAgICAgIC8vdGhleSBhcmUgYWRkaXRpdmUuXG4gICAgICAgICAgICAgICAgdmFyIHNoaW0gPSBjb25maWcuc2hpbSxcbiAgICAgICAgICAgICAgICAgICAgb2JqcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZzogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcDogdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZWFjaFByb3AoY2ZnLCBmdW5jdGlvbiAodmFsdWUsIHByb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9ianNbcHJvcF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY29uZmlnW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnW3Byb3BdID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBtaXhpbihjb25maWdbcHJvcF0sIHZhbHVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ1twcm9wXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvL1JldmVyc2UgbWFwIHRoZSBidW5kbGVzXG4gICAgICAgICAgICAgICAgaWYgKGNmZy5idW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGVhY2hQcm9wKGNmZy5idW5kbGVzLCBmdW5jdGlvbiAodmFsdWUsIHByb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVhY2godmFsdWUsIGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHYgIT09IHByb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc01hcFt2XSA9IHByb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vTWVyZ2Ugc2hpbVxuICAgICAgICAgICAgICAgIGlmIChjZmcuc2hpbSkge1xuICAgICAgICAgICAgICAgICAgICBlYWNoUHJvcChjZmcuc2hpbSwgZnVuY3Rpb24gKHZhbHVlLCBpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9Ob3JtYWxpemUgdGhlIHN0cnVjdHVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlcHM6IHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgodmFsdWUuZXhwb3J0cyB8fCB2YWx1ZS5pbml0KSAmJiAhdmFsdWUuZXhwb3J0c0ZuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUuZXhwb3J0c0ZuID0gY29udGV4dC5tYWtlU2hpbUV4cG9ydHModmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2hpbVtpZF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5zaGltID0gc2hpbTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL0FkanVzdCBwYWNrYWdlcyBpZiBuZWNlc3NhcnkuXG4gICAgICAgICAgICAgICAgaWYgKGNmZy5wYWNrYWdlcykge1xuICAgICAgICAgICAgICAgICAgICBlYWNoKGNmZy5wYWNrYWdlcywgZnVuY3Rpb24gKHBrZ09iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2F0aW9uLCBuYW1lO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwa2dPYmogPSB0eXBlb2YgcGtnT2JqID09PSAnc3RyaW5nJyA/IHsgbmFtZTogcGtnT2JqIH0gOiBwa2dPYmo7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSBwa2dPYmoubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uID0gcGtnT2JqLmxvY2F0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLnBhdGhzW25hbWVdID0gcGtnT2JqLmxvY2F0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1NhdmUgcG9pbnRlciB0byBtYWluIG1vZHVsZSBJRCBmb3IgcGtnIG5hbWUuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1JlbW92ZSBsZWFkaW5nIGRvdCBpbiBtYWluLCBzbyBtYWluIHBhdGhzIGFyZSBub3JtYWxpemVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9hbmQgcmVtb3ZlIGFueSB0cmFpbGluZyAuanMsIHNpbmNlIGRpZmZlcmVudCBwYWNrYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2VudnMgaGF2ZSBkaWZmZXJlbnQgY29udmVudGlvbnM6IHNvbWUgdXNlIGEgbW9kdWxlIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3NvbWUgdXNlIGEgZmlsZSBuYW1lLlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLnBrZ3NbbmFtZV0gPSBwa2dPYmoubmFtZSArICcvJyArIChwa2dPYmoubWFpbiB8fCAnbWFpbicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoY3VyckRpclJlZ0V4cCwgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoanNTdWZmaXhSZWdFeHAsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9JZiB0aGVyZSBhcmUgYW55IFwid2FpdGluZyB0byBleGVjdXRlXCIgbW9kdWxlcyBpbiB0aGUgcmVnaXN0cnksXG4gICAgICAgICAgICAgICAgLy91cGRhdGUgdGhlIG1hcHMgZm9yIHRoZW0sIHNpbmNlIHRoZWlyIGluZm8sIGxpa2UgVVJMcyB0byBsb2FkLFxuICAgICAgICAgICAgICAgIC8vbWF5IGhhdmUgY2hhbmdlZC5cbiAgICAgICAgICAgICAgICBlYWNoUHJvcChyZWdpc3RyeSwgZnVuY3Rpb24gKG1vZCwgaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9JZiBtb2R1bGUgYWxyZWFkeSBoYXMgaW5pdCBjYWxsZWQsIHNpbmNlIGl0IGlzIHRvb1xuICAgICAgICAgICAgICAgICAgICAvL2xhdGUgdG8gbW9kaWZ5IHRoZW0sIGFuZCBpZ25vcmUgdW5ub3JtYWxpemVkIG9uZXNcbiAgICAgICAgICAgICAgICAgICAgLy9zaW5jZSB0aGV5IGFyZSB0cmFuc2llbnQuXG4gICAgICAgICAgICAgICAgICAgIGlmICghbW9kLmluaXRlZCAmJiAhbW9kLm1hcC51bm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZC5tYXAgPSBtYWtlTW9kdWxlTWFwKGlkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy9JZiBhIGRlcHMgYXJyYXkgb3IgYSBjb25maWcgY2FsbGJhY2sgaXMgc3BlY2lmaWVkLCB0aGVuIGNhbGxcbiAgICAgICAgICAgICAgICAvL3JlcXVpcmUgd2l0aCB0aG9zZSBhcmdzLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIHJlcXVpcmUgaXMgZGVmaW5lZCBhcyBhXG4gICAgICAgICAgICAgICAgLy9jb25maWcgb2JqZWN0IGJlZm9yZSByZXF1aXJlLmpzIGlzIGxvYWRlZC5cbiAgICAgICAgICAgICAgICBpZiAoY2ZnLmRlcHMgfHwgY2ZnLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQucmVxdWlyZShjZmcuZGVwcyB8fCBbXSwgY2ZnLmNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtYWtlU2hpbUV4cG9ydHM6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGZuKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmV0O1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUuaW5pdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0ID0gdmFsdWUuaW5pdC5hcHBseShnbG9iYWwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJldCB8fCAodmFsdWUuZXhwb3J0cyAmJiBnZXRHbG9iYWwodmFsdWUuZXhwb3J0cykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZm47XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtYWtlUmVxdWlyZTogZnVuY3Rpb24gKHJlbE1hcCwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gbG9jYWxSZXF1aXJlKGRlcHMsIGNhbGxiYWNrLCBlcnJiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpZCwgbWFwLCByZXF1aXJlTW9kO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmVuYWJsZUJ1aWxkQ2FsbGJhY2sgJiYgY2FsbGJhY2sgJiYgaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLl9fcmVxdWlyZUpzQnVpbGQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBkZXBzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9JbnZhbGlkIGNhbGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb25FcnJvcihtYWtlRXJyb3IoJ3JlcXVpcmVhcmdzJywgJ0ludmFsaWQgcmVxdWlyZSBjYWxsJyksIGVycmJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0lmIHJlcXVpcmV8ZXhwb3J0c3xtb2R1bGUgYXJlIHJlcXVlc3RlZCwgZ2V0IHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy92YWx1ZSBmb3IgdGhlbSBmcm9tIHRoZSBzcGVjaWFsIGhhbmRsZXJzLiBDYXZlYXQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoaXMgb25seSB3b3JrcyB3aGlsZSBtb2R1bGUgaXMgYmVpbmcgZGVmaW5lZC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxNYXAgJiYgaGFzUHJvcChoYW5kbGVycywgZGVwcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlcnNbZGVwc10ocmVnaXN0cnlbcmVsTWFwLmlkXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vU3luY2hyb25vdXMgYWNjZXNzIHRvIG9uZSBtb2R1bGUuIElmIHJlcXVpcmUuZ2V0IGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2F2YWlsYWJsZSAoYXMgaW4gdGhlIE5vZGUgYWRhcHRlciksIHByZWZlciB0aGF0LlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcS5nZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVxLmdldChjb250ZXh0LCBkZXBzLCByZWxNYXAsIGxvY2FsUmVxdWlyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vTm9ybWFsaXplIG1vZHVsZSBuYW1lLCBpZiBpdCBjb250YWlucyAuIG9yIC4uXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXAgPSBtYWtlTW9kdWxlTWFwKGRlcHMsIHJlbE1hcCwgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgPSBtYXAuaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaGFzUHJvcChkZWZpbmVkLCBpZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb25FcnJvcihtYWtlRXJyb3IoJ25vdGxvYWRlZCcsICdNb2R1bGUgbmFtZSBcIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgaGFzIG5vdCBiZWVuIGxvYWRlZCB5ZXQgZm9yIGNvbnRleHQ6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHROYW1lICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAocmVsTWFwID8gJycgOiAnLiBVc2UgcmVxdWlyZShbXSknKSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlZmluZWRbaWRdO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy9HcmFiIGRlZmluZXMgd2FpdGluZyBpbiB0aGUgZ2xvYmFsIHF1ZXVlLlxuICAgICAgICAgICAgICAgICAgICBpbnRha2VEZWZpbmVzKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9NYXJrIGFsbCB0aGUgZGVwZW5kZW5jaWVzIGFzIG5lZWRpbmcgdG8gYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vU29tZSBkZWZpbmVzIGNvdWxkIGhhdmUgYmVlbiBhZGRlZCBzaW5jZSB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vcmVxdWlyZSBjYWxsLCBjb2xsZWN0IHRoZW0uXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnRha2VEZWZpbmVzKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVNb2QgPSBnZXRNb2R1bGUobWFrZU1vZHVsZU1hcChudWxsLCByZWxNYXApKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9TdG9yZSBpZiBtYXAgY29uZmlnIHNob3VsZCBiZSBhcHBsaWVkIHRvIHRoaXMgcmVxdWlyZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jYWxsIGZvciBkZXBlbmRlbmNpZXMuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlTW9kLnNraXBNYXAgPSBvcHRpb25zLnNraXBNYXA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVNb2QuaW5pdChkZXBzLCBjYWxsYmFjaywgZXJyYmFjaywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGVja0xvYWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbG9jYWxSZXF1aXJlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1peGluKGxvY2FsUmVxdWlyZSwge1xuICAgICAgICAgICAgICAgICAgICBpc0Jyb3dzZXI6IGlzQnJvd3NlcixcblxuICAgICAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgICAgICogQ29udmVydHMgYSBtb2R1bGUgbmFtZSArIC5leHRlbnNpb24gaW50byBhbiBVUkwgcGF0aC5cbiAgICAgICAgICAgICAgICAgICAgICogKlJlcXVpcmVzKiB0aGUgdXNlIG9mIGEgbW9kdWxlIG5hbWUuIEl0IGRvZXMgbm90IHN1cHBvcnQgdXNpbmdcbiAgICAgICAgICAgICAgICAgICAgICogcGxhaW4gVVJMcyBsaWtlIG5hbWVUb1VybC5cbiAgICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgIHRvVXJsOiBmdW5jdGlvbiAobW9kdWxlTmFtZVBsdXNFeHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBtb2R1bGVOYW1lUGx1c0V4dC5sYXN0SW5kZXhPZignLicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlZ21lbnQgPSBtb2R1bGVOYW1lUGx1c0V4dC5zcGxpdCgnLycpWzBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUmVsYXRpdmUgPSBzZWdtZW50ID09PSAnLicgfHwgc2VnbWVudCA9PT0gJy4uJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9IYXZlIGEgZmlsZSBleHRlbnNpb24gYWxpYXMsIGFuZCBpdCBpcyBub3QgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2RvdHMgZnJvbSBhIHJlbGF0aXZlIHBhdGguXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xICYmICghaXNSZWxhdGl2ZSB8fCBpbmRleCA+IDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0ID0gbW9kdWxlTmFtZVBsdXNFeHQuc3Vic3RyaW5nKGluZGV4LCBtb2R1bGVOYW1lUGx1c0V4dC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZHVsZU5hbWVQbHVzRXh0ID0gbW9kdWxlTmFtZVBsdXNFeHQuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQubmFtZVRvVXJsKG5vcm1hbGl6ZShtb2R1bGVOYW1lUGx1c0V4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbE1hcCAmJiByZWxNYXAuaWQsIHRydWUpLCBleHQsICB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICBkZWZpbmVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoYXNQcm9wKGRlZmluZWQsIG1ha2VNb2R1bGVNYXAoaWQsIHJlbE1hcCwgZmFsc2UsIHRydWUpLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICBzcGVjaWZpZWQ6IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgPSBtYWtlTW9kdWxlTWFwKGlkLCByZWxNYXAsIGZhbHNlLCB0cnVlKS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoYXNQcm9wKGRlZmluZWQsIGlkKSB8fCBoYXNQcm9wKHJlZ2lzdHJ5LCBpZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vT25seSBhbGxvdyB1bmRlZiBvbiB0b3AgbGV2ZWwgcmVxdWlyZSBjYWxsc1xuICAgICAgICAgICAgICAgIGlmICghcmVsTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsUmVxdWlyZS51bmRlZiA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9CaW5kIGFueSB3YWl0aW5nIGRlZmluZSgpIGNhbGxzIHRvIHRoaXMgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vZml4IGZvciAjNDA4XG4gICAgICAgICAgICAgICAgICAgICAgICB0YWtlR2xvYmFsUXVldWUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1hcCA9IG1ha2VNb2R1bGVNYXAoaWQsIHJlbE1hcCwgdHJ1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kID0gZ2V0T3duKHJlZ2lzdHJ5LCBpZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVNjcmlwdChpZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBkZWZpbmVkW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB1cmxGZXRjaGVkW21hcC51cmxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHVuZGVmRXZlbnRzW2lkXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy9DbGVhbiBxdWV1ZWQgZGVmaW5lcyB0b28uIEdvIGJhY2t3YXJkc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9pbiBhcnJheSBzbyB0aGF0IHRoZSBzcGxpY2VzIGRvIG5vdFxuICAgICAgICAgICAgICAgICAgICAgICAgLy9tZXNzIHVwIHRoZSBpdGVyYXRpb24uXG4gICAgICAgICAgICAgICAgICAgICAgICBlYWNoUmV2ZXJzZShkZWZRdWV1ZSwgZnVuY3Rpb24oYXJncywgaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGFyZ3NbMF0gPT09IGlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZlF1ZXVlLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vSG9sZCBvbiB0byBsaXN0ZW5lcnMgaW4gY2FzZSB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL21vZHVsZSB3aWxsIGJlIGF0dGVtcHRlZCB0byBiZSByZWxvYWRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vdXNpbmcgYSBkaWZmZXJlbnQgY29uZmlnLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtb2QuZXZlbnRzLmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5kZWZFdmVudHNbaWRdID0gbW9kLmV2ZW50cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGVhblJlZ2lzdHJ5KGlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbG9jYWxSZXF1aXJlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBDYWxsZWQgdG8gZW5hYmxlIGEgbW9kdWxlIGlmIGl0IGlzIHN0aWxsIGluIHRoZSByZWdpc3RyeVxuICAgICAgICAgICAgICogYXdhaXRpbmcgZW5hYmxlbWVudC4gQSBzZWNvbmQgYXJnLCBwYXJlbnQsIHRoZSBwYXJlbnQgbW9kdWxlLFxuICAgICAgICAgICAgICogaXMgcGFzc2VkIGluIGZvciBjb250ZXh0LCB3aGVuIHRoaXMgbWV0aG9kIGlzIG92ZXJyaWRkZW4gYnlcbiAgICAgICAgICAgICAqIHRoZSBvcHRpbWl6ZXIuIE5vdCBzaG93biBoZXJlIHRvIGtlZXAgY29kZSBjb21wYWN0LlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBlbmFibGU6IGZ1bmN0aW9uIChkZXBNYXApIHtcbiAgICAgICAgICAgICAgICB2YXIgbW9kID0gZ2V0T3duKHJlZ2lzdHJ5LCBkZXBNYXAuaWQpO1xuICAgICAgICAgICAgICAgIGlmIChtb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0TW9kdWxlKGRlcE1hcCkuZW5hYmxlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBJbnRlcm5hbCBtZXRob2QgdXNlZCBieSBlbnZpcm9ubWVudCBhZGFwdGVycyB0byBjb21wbGV0ZSBhIGxvYWQgZXZlbnQuXG4gICAgICAgICAgICAgKiBBIGxvYWQgZXZlbnQgY291bGQgYmUgYSBzY3JpcHQgbG9hZCBvciBqdXN0IGEgbG9hZCBwYXNzIGZyb20gYSBzeW5jaHJvbm91c1xuICAgICAgICAgICAgICogbG9hZCBjYWxsLlxuICAgICAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG1vZHVsZU5hbWUgdGhlIG5hbWUgb2YgdGhlIG1vZHVsZSB0byBwb3RlbnRpYWxseSBjb21wbGV0ZS5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgY29tcGxldGVMb2FkOiBmdW5jdGlvbiAobW9kdWxlTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBmb3VuZCwgYXJncywgbW9kLFxuICAgICAgICAgICAgICAgICAgICBzaGltID0gZ2V0T3duKGNvbmZpZy5zaGltLCBtb2R1bGVOYW1lKSB8fCB7fSxcbiAgICAgICAgICAgICAgICAgICAgc2hFeHBvcnRzID0gc2hpbS5leHBvcnRzO1xuXG4gICAgICAgICAgICAgICAgdGFrZUdsb2JhbFF1ZXVlKCk7XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAoZGVmUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MgPSBkZWZRdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJnc1swXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJnc1swXSA9IG1vZHVsZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL0lmIGFscmVhZHkgZm91bmQgYW4gYW5vbnltb3VzIG1vZHVsZSBhbmQgYm91bmQgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vdG8gdGhpcyBuYW1lLCB0aGVuIHRoaXMgaXMgc29tZSBvdGhlciBhbm9uIG1vZHVsZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy93YWl0aW5nIGZvciBpdHMgY29tcGxldGVMb2FkIHRvIGZpcmUuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhcmdzWzBdID09PSBtb2R1bGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL0ZvdW5kIG1hdGNoaW5nIGRlZmluZSBjYWxsIGZvciB0aGlzIHNjcmlwdCFcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNhbGxHZXRNb2R1bGUoYXJncyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9EbyB0aGlzIGFmdGVyIHRoZSBjeWNsZSBvZiBjYWxsR2V0TW9kdWxlIGluIGNhc2UgdGhlIHJlc3VsdFxuICAgICAgICAgICAgICAgIC8vb2YgdGhvc2UgY2FsbHMvaW5pdCBjYWxscyBjaGFuZ2VzIHRoZSByZWdpc3RyeS5cbiAgICAgICAgICAgICAgICBtb2QgPSBnZXRPd24ocmVnaXN0cnksIG1vZHVsZU5hbWUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFmb3VuZCAmJiAhaGFzUHJvcChkZWZpbmVkLCBtb2R1bGVOYW1lKSAmJiBtb2QgJiYgIW1vZC5pbml0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5lbmZvcmNlRGVmaW5lICYmICghc2hFeHBvcnRzIHx8ICFnZXRHbG9iYWwoc2hFeHBvcnRzKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNQYXRoRmFsbGJhY2sobW9kdWxlTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvbkVycm9yKG1ha2VFcnJvcignbm9kZWZpbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ05vIGRlZmluZSBjYWxsIGZvciAnICsgbW9kdWxlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbbW9kdWxlTmFtZV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vQSBzY3JpcHQgdGhhdCBkb2VzIG5vdCBjYWxsIGRlZmluZSgpLCBzbyBqdXN0IHNpbXVsYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoZSBjYWxsIGZvciBpdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxHZXRNb2R1bGUoW21vZHVsZU5hbWUsIChzaGltLmRlcHMgfHwgW10pLCBzaGltLmV4cG9ydHNGbl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2hlY2tMb2FkZWQoKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQ29udmVydHMgYSBtb2R1bGUgbmFtZSB0byBhIGZpbGUgcGF0aC4gU3VwcG9ydHMgY2FzZXMgd2hlcmVcbiAgICAgICAgICAgICAqIG1vZHVsZU5hbWUgbWF5IGFjdHVhbGx5IGJlIGp1c3QgYW4gVVJMLlxuICAgICAgICAgICAgICogTm90ZSB0aGF0IGl0ICoqZG9lcyBub3QqKiBjYWxsIG5vcm1hbGl6ZSBvbiB0aGUgbW9kdWxlTmFtZSxcbiAgICAgICAgICAgICAqIGl0IGlzIGFzc3VtZWQgdG8gaGF2ZSBhbHJlYWR5IGJlZW4gbm9ybWFsaXplZC4gVGhpcyBpcyBhblxuICAgICAgICAgICAgICogaW50ZXJuYWwgQVBJLCBub3QgYSBwdWJsaWMgb25lLiBVc2UgdG9VcmwgZm9yIHRoZSBwdWJsaWMgQVBJLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBuYW1lVG9Vcmw6IGZ1bmN0aW9uIChtb2R1bGVOYW1lLCBleHQsIHNraXBFeHQpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGF0aHMsIHN5bXMsIGksIHBhcmVudE1vZHVsZSwgdXJsLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRQYXRoLCBidW5kbGVJZCxcbiAgICAgICAgICAgICAgICAgICAgcGtnTWFpbiA9IGdldE93bihjb25maWcucGtncywgbW9kdWxlTmFtZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAocGtnTWFpbikge1xuICAgICAgICAgICAgICAgICAgICBtb2R1bGVOYW1lID0gcGtnTWFpbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBidW5kbGVJZCA9IGdldE93bihidW5kbGVzTWFwLCBtb2R1bGVOYW1lKTtcblxuICAgICAgICAgICAgICAgIGlmIChidW5kbGVJZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dC5uYW1lVG9VcmwoYnVuZGxlSWQsIGV4dCwgc2tpcEV4dCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9JZiBhIGNvbG9uIGlzIGluIHRoZSBVUkwsIGl0IGluZGljYXRlcyBhIHByb3RvY29sIGlzIHVzZWQgYW5kIGl0IGlzIGp1c3RcbiAgICAgICAgICAgICAgICAvL2FuIFVSTCB0byBhIGZpbGUsIG9yIGlmIGl0IHN0YXJ0cyB3aXRoIGEgc2xhc2gsIGNvbnRhaW5zIGEgcXVlcnkgYXJnIChpLmUuID8pXG4gICAgICAgICAgICAgICAgLy9vciBlbmRzIHdpdGggLmpzLCB0aGVuIGFzc3VtZSB0aGUgdXNlciBtZWFudCB0byB1c2UgYW4gdXJsIGFuZCBub3QgYSBtb2R1bGUgaWQuXG4gICAgICAgICAgICAgICAgLy9UaGUgc2xhc2ggaXMgaW1wb3J0YW50IGZvciBwcm90b2NvbC1sZXNzIFVSTHMgYXMgd2VsbCBhcyBmdWxsIHBhdGhzLlxuICAgICAgICAgICAgICAgIGlmIChyZXEuanNFeHRSZWdFeHAudGVzdChtb2R1bGVOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAvL0p1c3QgYSBwbGFpbiBwYXRoLCBub3QgbW9kdWxlIG5hbWUgbG9va3VwLCBzbyBqdXN0IHJldHVybiBpdC5cbiAgICAgICAgICAgICAgICAgICAgLy9BZGQgZXh0ZW5zaW9uIGlmIGl0IGlzIGluY2x1ZGVkLiBUaGlzIGlzIGEgYml0IHdvbmt5LCBvbmx5IG5vbi0uanMgdGhpbmdzIHBhc3NcbiAgICAgICAgICAgICAgICAgICAgLy9hbiBleHRlbnNpb24sIHRoaXMgbWV0aG9kIHByb2JhYmx5IG5lZWRzIHRvIGJlIHJld29ya2VkLlxuICAgICAgICAgICAgICAgICAgICB1cmwgPSBtb2R1bGVOYW1lICsgKGV4dCB8fCAnJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9BIG1vZHVsZSB0aGF0IG5lZWRzIHRvIGJlIGNvbnZlcnRlZCB0byBhIHBhdGguXG4gICAgICAgICAgICAgICAgICAgIHBhdGhzID0gY29uZmlnLnBhdGhzO1xuXG4gICAgICAgICAgICAgICAgICAgIHN5bXMgPSBtb2R1bGVOYW1lLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIC8vRm9yIGVhY2ggbW9kdWxlIG5hbWUgc2VnbWVudCwgc2VlIGlmIHRoZXJlIGlzIGEgcGF0aFxuICAgICAgICAgICAgICAgICAgICAvL3JlZ2lzdGVyZWQgZm9yIGl0LiBTdGFydCB3aXRoIG1vc3Qgc3BlY2lmaWMgbmFtZVxuICAgICAgICAgICAgICAgICAgICAvL2FuZCB3b3JrIHVwIGZyb20gaXQuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IHN5bXMubGVuZ3RoOyBpID4gMDsgaSAtPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRNb2R1bGUgPSBzeW1zLnNsaWNlKDAsIGkpLmpvaW4oJy8nKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50UGF0aCA9IGdldE93bihwYXRocywgcGFyZW50TW9kdWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9JZiBhbiBhcnJheSwgaXQgbWVhbnMgdGhlcmUgYXJlIGEgZmV3IGNob2ljZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9DaG9vc2UgdGhlIG9uZSB0aGF0IGlzIGRlc2lyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShwYXJlbnRQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRQYXRoID0gcGFyZW50UGF0aFswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ltcy5zcGxpY2UoMCwgaSwgcGFyZW50UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvL0pvaW4gdGhlIHBhdGggcGFydHMgdG9nZXRoZXIsIHRoZW4gZmlndXJlIG91dCBpZiBiYXNlVXJsIGlzIG5lZWRlZC5cbiAgICAgICAgICAgICAgICAgICAgdXJsID0gc3ltcy5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIHVybCArPSAoZXh0IHx8ICgvXmRhdGFcXDp8XFw/Ly50ZXN0KHVybCkgfHwgc2tpcEV4dCA/ICcnIDogJy5qcycpKTtcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gKHVybC5jaGFyQXQoMCkgPT09ICcvJyB8fCB1cmwubWF0Y2goL15bXFx3XFwrXFwuXFwtXSs6LykgPyAnJyA6IGNvbmZpZy5iYXNlVXJsKSArIHVybDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY29uZmlnLnVybEFyZ3MgPyB1cmwgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgodXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnPycgOiAnJicpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLnVybEFyZ3MpIDogdXJsO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLy9EZWxlZ2F0ZXMgdG8gcmVxLmxvYWQuIEJyb2tlbiBvdXQgYXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiB0b1xuICAgICAgICAgICAgLy9hbGxvdyBvdmVycmlkaW5nIGluIHRoZSBvcHRpbWl6ZXIuXG4gICAgICAgICAgICBsb2FkOiBmdW5jdGlvbiAoaWQsIHVybCkge1xuICAgICAgICAgICAgICAgIHJlcS5sb2FkKGNvbnRleHQsIGlkLCB1cmwpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBFeGVjdXRlcyBhIG1vZHVsZSBjYWxsYmFjayBmdW5jdGlvbi4gQnJva2VuIG91dCBhcyBhIHNlcGFyYXRlIGZ1bmN0aW9uXG4gICAgICAgICAgICAgKiBzb2xlbHkgdG8gYWxsb3cgdGhlIGJ1aWxkIHN5c3RlbSB0byBzZXF1ZW5jZSB0aGUgZmlsZXMgaW4gdGhlIGJ1aWx0XG4gICAgICAgICAgICAgKiBsYXllciBpbiB0aGUgcmlnaHQgc2VxdWVuY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZXhlY0NiOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2ssIGFyZ3MsIGV4cG9ydHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2suYXBwbHkoZXhwb3J0cywgYXJncyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIGNhbGxiYWNrIGZvciBzY3JpcHQgbG9hZHMsIHVzZWQgdG8gY2hlY2sgc3RhdHVzIG9mIGxvYWRpbmcuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHBhcmFtIHtFdmVudH0gZXZ0IHRoZSBldmVudCBmcm9tIHRoZSBicm93c2VyIGZvciB0aGUgc2NyaXB0XG4gICAgICAgICAgICAgKiB0aGF0IHdhcyBsb2FkZWQuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIG9uU2NyaXB0TG9hZDogZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgICAgIC8vVXNpbmcgY3VycmVudFRhcmdldCBpbnN0ZWFkIG9mIHRhcmdldCBmb3IgRmlyZWZveCAyLjAncyBzYWtlLiBOb3RcbiAgICAgICAgICAgICAgICAvL2FsbCBvbGQgYnJvd3NlcnMgd2lsbCBiZSBzdXBwb3J0ZWQsIGJ1dCB0aGlzIG9uZSB3YXMgZWFzeSBlbm91Z2hcbiAgICAgICAgICAgICAgICAvL3RvIHN1cHBvcnQgYW5kIHN0aWxsIG1ha2VzIHNlbnNlLlxuICAgICAgICAgICAgICAgIGlmIChldnQudHlwZSA9PT0gJ2xvYWQnIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAocmVhZHlSZWdFeHAudGVzdCgoZXZ0LmN1cnJlbnRUYXJnZXQgfHwgZXZ0LnNyY0VsZW1lbnQpLnJlYWR5U3RhdGUpKSkge1xuICAgICAgICAgICAgICAgICAgICAvL1Jlc2V0IGludGVyYWN0aXZlIHNjcmlwdCBzbyBhIHNjcmlwdCBub2RlIGlzIG5vdCBoZWxkIG9udG8gZm9yXG4gICAgICAgICAgICAgICAgICAgIC8vdG8gbG9uZy5cbiAgICAgICAgICAgICAgICAgICAgaW50ZXJhY3RpdmVTY3JpcHQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vUHVsbCBvdXQgdGhlIG5hbWUgb2YgdGhlIG1vZHVsZSBhbmQgdGhlIGNvbnRleHQuXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gZ2V0U2NyaXB0RGF0YShldnQpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmNvbXBsZXRlTG9hZChkYXRhLmlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIENhbGxiYWNrIGZvciBzY3JpcHQgZXJyb3JzLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBvblNjcmlwdEVycm9yOiBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBnZXRTY3JpcHREYXRhKGV2dCk7XG4gICAgICAgICAgICAgICAgaWYgKCFoYXNQYXRoRmFsbGJhY2soZGF0YS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9uRXJyb3IobWFrZUVycm9yKCdzY3JpcHRlcnJvcicsICdTY3JpcHQgZXJyb3IgZm9yOiAnICsgZGF0YS5pZCwgZXZ0LCBbZGF0YS5pZF0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29udGV4dC5yZXF1aXJlID0gY29udGV4dC5tYWtlUmVxdWlyZSgpO1xuICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYWluIGVudHJ5IHBvaW50LlxuICAgICAqXG4gICAgICogSWYgdGhlIG9ubHkgYXJndW1lbnQgdG8gcmVxdWlyZSBpcyBhIHN0cmluZywgdGhlbiB0aGUgbW9kdWxlIHRoYXRcbiAgICAgKiBpcyByZXByZXNlbnRlZCBieSB0aGF0IHN0cmluZyBpcyBmZXRjaGVkIGZvciB0aGUgYXBwcm9wcmlhdGUgY29udGV4dC5cbiAgICAgKlxuICAgICAqIElmIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBhbiBhcnJheSwgdGhlbiBpdCB3aWxsIGJlIHRyZWF0ZWQgYXMgYW4gYXJyYXlcbiAgICAgKiBvZiBkZXBlbmRlbmN5IHN0cmluZyBuYW1lcyB0byBmZXRjaC4gQW4gb3B0aW9uYWwgZnVuY3Rpb24gY2FsbGJhY2sgY2FuXG4gICAgICogYmUgc3BlY2lmaWVkIHRvIGV4ZWN1dGUgd2hlbiBhbGwgb2YgdGhvc2UgZGVwZW5kZW5jaWVzIGFyZSBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBNYWtlIGEgbG9jYWwgcmVxIHZhcmlhYmxlIHRvIGhlbHAgQ2FqYSBjb21wbGlhbmNlIChpdCBhc3N1bWVzIHRoaW5nc1xuICAgICAqIG9uIGEgcmVxdWlyZSB0aGF0IGFyZSBub3Qgc3RhbmRhcmRpemVkKSwgYW5kIHRvIGdpdmUgYSBzaG9ydFxuICAgICAqIG5hbWUgZm9yIG1pbmlmaWNhdGlvbi9sb2NhbCBzY29wZSB1c2UuXG4gICAgICovXG4gICAgcmVxID0gcmVxdWlyZWpzID0gZnVuY3Rpb24gKGRlcHMsIGNhbGxiYWNrLCBlcnJiYWNrLCBvcHRpb25hbCkge1xuXG4gICAgICAgIC8vRmluZCB0aGUgcmlnaHQgY29udGV4dCwgdXNlIGRlZmF1bHRcbiAgICAgICAgdmFyIGNvbnRleHQsIGNvbmZpZyxcbiAgICAgICAgICAgIGNvbnRleHROYW1lID0gZGVmQ29udGV4dE5hbWU7XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIGhhdmUgY29uZmlnIG9iamVjdCBpbiB0aGUgY2FsbC5cbiAgICAgICAgaWYgKCFpc0FycmF5KGRlcHMpICYmIHR5cGVvZiBkZXBzICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gZGVwcyBpcyBhIGNvbmZpZyBvYmplY3RcbiAgICAgICAgICAgIGNvbmZpZyA9IGRlcHM7XG4gICAgICAgICAgICBpZiAoaXNBcnJheShjYWxsYmFjaykpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGp1c3QgYXJncyBpZiB0aGVyZSBhcmUgZGVwZW5kZW5jaWVzXG4gICAgICAgICAgICAgICAgZGVwcyA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gZXJyYmFjaztcbiAgICAgICAgICAgICAgICBlcnJiYWNrID0gb3B0aW9uYWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlcHMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcgJiYgY29uZmlnLmNvbnRleHQpIHtcbiAgICAgICAgICAgIGNvbnRleHROYW1lID0gY29uZmlnLmNvbnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb250ZXh0ID0gZ2V0T3duKGNvbnRleHRzLCBjb250ZXh0TmFtZSk7XG4gICAgICAgIGlmICghY29udGV4dCkge1xuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHRzW2NvbnRleHROYW1lXSA9IHJlcS5zLm5ld0NvbnRleHQoY29udGV4dE5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmZpZykge1xuICAgICAgICAgICAgY29udGV4dC5jb25maWd1cmUoY29uZmlnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb250ZXh0LnJlcXVpcmUoZGVwcywgY2FsbGJhY2ssIGVycmJhY2spO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTdXBwb3J0IHJlcXVpcmUuY29uZmlnKCkgdG8gbWFrZSBpdCBlYXNpZXIgdG8gY29vcGVyYXRlIHdpdGggb3RoZXJcbiAgICAgKiBBTUQgbG9hZGVycyBvbiBnbG9iYWxseSBhZ3JlZWQgbmFtZXMuXG4gICAgICovXG4gICAgcmVxLmNvbmZpZyA9IGZ1bmN0aW9uIChjb25maWcpIHtcbiAgICAgICAgcmV0dXJuIHJlcShjb25maWcpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIHNvbWV0aGluZyBhZnRlciB0aGUgY3VycmVudCB0aWNrXG4gICAgICogb2YgdGhlIGV2ZW50IGxvb3AuIE92ZXJyaWRlIGZvciBvdGhlciBlbnZzXG4gICAgICogdGhhdCBoYXZlIGEgYmV0dGVyIHNvbHV0aW9uIHRoYW4gc2V0VGltZW91dC5cbiAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm4gZnVuY3Rpb24gdG8gZXhlY3V0ZSBsYXRlci5cbiAgICAgKi9cbiAgICByZXEubmV4dFRpY2sgPSB0eXBlb2Ygc2V0VGltZW91dCAhPT0gJ3VuZGVmaW5lZCcgPyBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgNCk7XG4gICAgfSA6IGZ1bmN0aW9uIChmbikgeyBmbigpOyB9O1xuXG4gICAgLyoqXG4gICAgICogRXhwb3J0IHJlcXVpcmUgYXMgYSBnbG9iYWwsIGJ1dCBvbmx5IGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QuXG4gICAgICovXG4gICAgaWYgKCFyZXF1aXJlKSB7XG4gICAgICAgIHJlcXVpcmUgPSByZXE7XG4gICAgfVxuXG4gICAgcmVxLnZlcnNpb24gPSB2ZXJzaW9uO1xuXG4gICAgLy9Vc2VkIHRvIGZpbHRlciBvdXQgZGVwZW5kZW5jaWVzIHRoYXQgYXJlIGFscmVhZHkgcGF0aHMuXG4gICAgcmVxLmpzRXh0UmVnRXhwID0gL15cXC98OnxcXD98XFwuanMkLztcbiAgICByZXEuaXNCcm93c2VyID0gaXNCcm93c2VyO1xuICAgIHMgPSByZXEucyA9IHtcbiAgICAgICAgY29udGV4dHM6IGNvbnRleHRzLFxuICAgICAgICBuZXdDb250ZXh0OiBuZXdDb250ZXh0XG4gICAgfTtcblxuICAgIC8vQ3JlYXRlIGRlZmF1bHQgY29udGV4dC5cbiAgICByZXEoe30pO1xuXG4gICAgLy9FeHBvcnRzIHNvbWUgY29udGV4dC1zZW5zaXRpdmUgbWV0aG9kcyBvbiBnbG9iYWwgcmVxdWlyZS5cbiAgICBlYWNoKFtcbiAgICAgICAgJ3RvVXJsJyxcbiAgICAgICAgJ3VuZGVmJyxcbiAgICAgICAgJ2RlZmluZWQnLFxuICAgICAgICAnc3BlY2lmaWVkJ1xuICAgIF0sIGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgIC8vUmVmZXJlbmNlIGZyb20gY29udGV4dHMgaW5zdGVhZCBvZiBlYXJseSBiaW5kaW5nIHRvIGRlZmF1bHQgY29udGV4dCxcbiAgICAgICAgLy9zbyB0aGF0IGR1cmluZyBidWlsZHMsIHRoZSBsYXRlc3QgaW5zdGFuY2Ugb2YgdGhlIGRlZmF1bHQgY29udGV4dFxuICAgICAgICAvL3dpdGggaXRzIGNvbmZpZyBnZXRzIHVzZWQuXG4gICAgICAgIHJlcVtwcm9wXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjdHggPSBjb250ZXh0c1tkZWZDb250ZXh0TmFtZV07XG4gICAgICAgICAgICByZXR1cm4gY3R4LnJlcXVpcmVbcHJvcF0uYXBwbHkoY3R4LCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgaWYgKGlzQnJvd3Nlcikge1xuICAgICAgICBoZWFkID0gcy5oZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcbiAgICAgICAgLy9JZiBCQVNFIHRhZyBpcyBpbiBwbGF5LCB1c2luZyBhcHBlbmRDaGlsZCBpcyBhIHByb2JsZW0gZm9yIElFNi5cbiAgICAgICAgLy9XaGVuIHRoYXQgYnJvd3NlciBkaWVzLCB0aGlzIGNhbiBiZSByZW1vdmVkLiBEZXRhaWxzIGluIHRoaXMgalF1ZXJ5IGJ1ZzpcbiAgICAgICAgLy9odHRwOi8vZGV2LmpxdWVyeS5jb20vdGlja2V0LzI3MDlcbiAgICAgICAgYmFzZUVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdO1xuICAgICAgICBpZiAoYmFzZUVsZW1lbnQpIHtcbiAgICAgICAgICAgIGhlYWQgPSBzLmhlYWQgPSBiYXNlRWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW55IGVycm9ycyB0aGF0IHJlcXVpcmUgZXhwbGljaXRseSBnZW5lcmF0ZXMgd2lsbCBiZSBwYXNzZWQgdG8gdGhpc1xuICAgICAqIGZ1bmN0aW9uLiBJbnRlcmNlcHQvb3ZlcnJpZGUgaXQgaWYgeW91IHdhbnQgY3VzdG9tIGVycm9yIGhhbmRsaW5nLlxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVyciB0aGUgZXJyb3Igb2JqZWN0LlxuICAgICAqL1xuICAgIHJlcS5vbkVycm9yID0gZGVmYXVsdE9uRXJyb3I7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBub2RlIGZvciB0aGUgbG9hZCBjb21tYW5kLiBPbmx5IHVzZWQgaW4gYnJvd3NlciBlbnZzLlxuICAgICAqL1xuICAgIHJlcS5jcmVhdGVOb2RlID0gZnVuY3Rpb24gKGNvbmZpZywgbW9kdWxlTmFtZSwgdXJsKSB7XG4gICAgICAgIHZhciBub2RlID0gY29uZmlnLnhodG1sID9cbiAgICAgICAgICAgICAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnLCAnaHRtbDpzY3JpcHQnKSA6XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgIG5vZGUudHlwZSA9IGNvbmZpZy5zY3JpcHRUeXBlIHx8ICd0ZXh0L2phdmFzY3JpcHQnO1xuICAgICAgICBub2RlLmNoYXJzZXQgPSAndXRmLTgnO1xuICAgICAgICBub2RlLmFzeW5jID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERvZXMgdGhlIHJlcXVlc3QgdG8gbG9hZCBhIG1vZHVsZSBmb3IgdGhlIGJyb3dzZXIgY2FzZS5cbiAgICAgKiBNYWtlIHRoaXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiB0byBhbGxvdyBvdGhlciBlbnZpcm9ubWVudHNcbiAgICAgKiB0byBvdmVycmlkZSBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IHRoZSByZXF1aXJlIGNvbnRleHQgdG8gZmluZCBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbW9kdWxlTmFtZSB0aGUgbmFtZSBvZiB0aGUgbW9kdWxlLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB1cmwgdGhlIFVSTCB0byB0aGUgbW9kdWxlLlxuICAgICAqL1xuICAgIHJlcS5sb2FkID0gZnVuY3Rpb24gKGNvbnRleHQsIG1vZHVsZU5hbWUsIHVybCkge1xuICAgICAgICB2YXIgY29uZmlnID0gKGNvbnRleHQgJiYgY29udGV4dC5jb25maWcpIHx8IHt9LFxuICAgICAgICAgICAgbm9kZTtcbiAgICAgICAgaWYgKGlzQnJvd3Nlcikge1xuICAgICAgICAgICAgLy9JbiB0aGUgYnJvd3NlciBzbyB1c2UgYSBzY3JpcHQgdGFnXG4gICAgICAgICAgICBub2RlID0gcmVxLmNyZWF0ZU5vZGUoY29uZmlnLCBtb2R1bGVOYW1lLCB1cmwpO1xuXG4gICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZSgnZGF0YS1yZXF1aXJlY29udGV4dCcsIGNvbnRleHQuY29udGV4dE5hbWUpO1xuICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtcmVxdWlyZW1vZHVsZScsIG1vZHVsZU5hbWUpO1xuXG4gICAgICAgICAgICAvL1NldCB1cCBsb2FkIGxpc3RlbmVyLiBUZXN0IGF0dGFjaEV2ZW50IGZpcnN0IGJlY2F1c2UgSUU5IGhhc1xuICAgICAgICAgICAgLy9hIHN1YnRsZSBpc3N1ZSBpbiBpdHMgYWRkRXZlbnRMaXN0ZW5lciBhbmQgc2NyaXB0IG9ubG9hZCBmaXJpbmdzXG4gICAgICAgICAgICAvL3RoYXQgZG8gbm90IG1hdGNoIHRoZSBiZWhhdmlvciBvZiBhbGwgb3RoZXIgYnJvd3NlcnMgd2l0aFxuICAgICAgICAgICAgLy9hZGRFdmVudExpc3RlbmVyIHN1cHBvcnQsIHdoaWNoIGZpcmUgdGhlIG9ubG9hZCBldmVudCBmb3IgYVxuICAgICAgICAgICAgLy9zY3JpcHQgcmlnaHQgYWZ0ZXIgdGhlIHNjcmlwdCBleGVjdXRpb24uIFNlZTpcbiAgICAgICAgICAgIC8vaHR0cHM6Ly9jb25uZWN0Lm1pY3Jvc29mdC5jb20vSUUvZmVlZGJhY2svZGV0YWlscy82NDgwNTcvc2NyaXB0LW9ubG9hZC1ldmVudC1pcy1ub3QtZmlyZWQtaW1tZWRpYXRlbHktYWZ0ZXItc2NyaXB0LWV4ZWN1dGlvblxuICAgICAgICAgICAgLy9VTkZPUlRVTkFURUxZIE9wZXJhIGltcGxlbWVudHMgYXR0YWNoRXZlbnQgYnV0IGRvZXMgbm90IGZvbGxvdyB0aGUgc2NyaXB0XG4gICAgICAgICAgICAvL3NjcmlwdCBleGVjdXRpb24gbW9kZS5cbiAgICAgICAgICAgIGlmIChub2RlLmF0dGFjaEV2ZW50ICYmXG4gICAgICAgICAgICAgICAgICAgIC8vQ2hlY2sgaWYgbm9kZS5hdHRhY2hFdmVudCBpcyBhcnRpZmljaWFsbHkgYWRkZWQgYnkgY3VzdG9tIHNjcmlwdCBvclxuICAgICAgICAgICAgICAgICAgICAvL25hdGl2ZWx5IHN1cHBvcnRlZCBieSBicm93c2VyXG4gICAgICAgICAgICAgICAgICAgIC8vcmVhZCBodHRwczovL2dpdGh1Yi5jb20vanJidXJrZS9yZXF1aXJlanMvaXNzdWVzLzE4N1xuICAgICAgICAgICAgICAgICAgICAvL2lmIHdlIGNhbiBOT1QgZmluZCBbbmF0aXZlIGNvZGVdIHRoZW4gaXQgbXVzdCBOT1QgbmF0aXZlbHkgc3VwcG9ydGVkLlxuICAgICAgICAgICAgICAgICAgICAvL2luIElFOCwgbm9kZS5hdHRhY2hFdmVudCBkb2VzIG5vdCBoYXZlIHRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgLy9Ob3RlIHRoZSB0ZXN0IGZvciBcIltuYXRpdmUgY29kZVwiIHdpdGggbm8gY2xvc2luZyBicmFjZSwgc2VlOlxuICAgICAgICAgICAgICAgICAgICAvL2h0dHBzOi8vZ2l0aHViLmNvbS9qcmJ1cmtlL3JlcXVpcmVqcy9pc3N1ZXMvMjczXG4gICAgICAgICAgICAgICAgICAgICEobm9kZS5hdHRhY2hFdmVudC50b1N0cmluZyAmJiBub2RlLmF0dGFjaEV2ZW50LnRvU3RyaW5nKCkuaW5kZXhPZignW25hdGl2ZSBjb2RlJykgPCAwKSAmJlxuICAgICAgICAgICAgICAgICAgICAhaXNPcGVyYSkge1xuICAgICAgICAgICAgICAgIC8vUHJvYmFibHkgSUUuIElFIChhdCBsZWFzdCA2LTgpIGRvIG5vdCBmaXJlXG4gICAgICAgICAgICAgICAgLy9zY3JpcHQgb25sb2FkIHJpZ2h0IGFmdGVyIGV4ZWN1dGluZyB0aGUgc2NyaXB0LCBzb1xuICAgICAgICAgICAgICAgIC8vd2UgY2Fubm90IHRpZSB0aGUgYW5vbnltb3VzIGRlZmluZSBjYWxsIHRvIGEgbmFtZS5cbiAgICAgICAgICAgICAgICAvL0hvd2V2ZXIsIElFIHJlcG9ydHMgdGhlIHNjcmlwdCBhcyBiZWluZyBpbiAnaW50ZXJhY3RpdmUnXG4gICAgICAgICAgICAgICAgLy9yZWFkeVN0YXRlIGF0IHRoZSB0aW1lIG9mIHRoZSBkZWZpbmUgY2FsbC5cbiAgICAgICAgICAgICAgICB1c2VJbnRlcmFjdGl2ZSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBub2RlLmF0dGFjaEV2ZW50KCdvbnJlYWR5c3RhdGVjaGFuZ2UnLCBjb250ZXh0Lm9uU2NyaXB0TG9hZCk7XG4gICAgICAgICAgICAgICAgLy9JdCB3b3VsZCBiZSBncmVhdCB0byBhZGQgYW4gZXJyb3IgaGFuZGxlciBoZXJlIHRvIGNhdGNoXG4gICAgICAgICAgICAgICAgLy80MDRzIGluIElFOSsuIEhvd2V2ZXIsIG9ucmVhZHlzdGF0ZWNoYW5nZSB3aWxsIGZpcmUgYmVmb3JlXG4gICAgICAgICAgICAgICAgLy90aGUgZXJyb3IgaGFuZGxlciwgc28gdGhhdCBkb2VzIG5vdCBoZWxwLiBJZiBhZGRFdmVudExpc3RlbmVyXG4gICAgICAgICAgICAgICAgLy9pcyB1c2VkLCB0aGVuIElFIHdpbGwgZmlyZSBlcnJvciBiZWZvcmUgbG9hZCwgYnV0IHdlIGNhbm5vdFxuICAgICAgICAgICAgICAgIC8vdXNlIHRoYXQgcGF0aHdheSBnaXZlbiB0aGUgY29ubmVjdC5taWNyb3NvZnQuY29tIGlzc3VlXG4gICAgICAgICAgICAgICAgLy9tZW50aW9uZWQgYWJvdmUgYWJvdXQgbm90IGRvaW5nIHRoZSAnc2NyaXB0IGV4ZWN1dGUsXG4gICAgICAgICAgICAgICAgLy90aGVuIGZpcmUgdGhlIHNjcmlwdCBsb2FkIGV2ZW50IGxpc3RlbmVyIGJlZm9yZSBleGVjdXRlXG4gICAgICAgICAgICAgICAgLy9uZXh0IHNjcmlwdCcgdGhhdCBvdGhlciBicm93c2VycyBkby5cbiAgICAgICAgICAgICAgICAvL0Jlc3QgaG9wZTogSUUxMCBmaXhlcyB0aGUgaXNzdWVzLFxuICAgICAgICAgICAgICAgIC8vYW5kIHRoZW4gZGVzdHJveXMgYWxsIGluc3RhbGxzIG9mIElFIDYtOS5cbiAgICAgICAgICAgICAgICAvL25vZGUuYXR0YWNoRXZlbnQoJ29uZXJyb3InLCBjb250ZXh0Lm9uU2NyaXB0RXJyb3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBjb250ZXh0Lm9uU2NyaXB0TG9hZCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBjb250ZXh0Lm9uU2NyaXB0RXJyb3IsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUuc3JjID0gdXJsO1xuXG4gICAgICAgICAgICAvL0ZvciBzb21lIGNhY2hlIGNhc2VzIGluIElFIDYtOCwgdGhlIHNjcmlwdCBleGVjdXRlcyBiZWZvcmUgdGhlIGVuZFxuICAgICAgICAgICAgLy9vZiB0aGUgYXBwZW5kQ2hpbGQgZXhlY3V0aW9uLCBzbyB0byB0aWUgYW4gYW5vbnltb3VzIGRlZmluZVxuICAgICAgICAgICAgLy9jYWxsIHRvIHRoZSBtb2R1bGUgbmFtZSAod2hpY2ggaXMgc3RvcmVkIG9uIHRoZSBub2RlKSwgaG9sZCBvblxuICAgICAgICAgICAgLy90byBhIHJlZmVyZW5jZSB0byB0aGlzIG5vZGUsIGJ1dCBjbGVhciBhZnRlciB0aGUgRE9NIGluc2VydGlvbi5cbiAgICAgICAgICAgIGN1cnJlbnRseUFkZGluZ1NjcmlwdCA9IG5vZGU7XG4gICAgICAgICAgICBpZiAoYmFzZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBoZWFkLmluc2VydEJlZm9yZShub2RlLCBiYXNlRWxlbWVudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGhlYWQuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50bHlBZGRpbmdTY3JpcHQgPSBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1dlYldvcmtlcikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvL0luIGEgd2ViIHdvcmtlciwgdXNlIGltcG9ydFNjcmlwdHMuIFRoaXMgaXMgbm90IGEgdmVyeVxuICAgICAgICAgICAgICAgIC8vZWZmaWNpZW50IHVzZSBvZiBpbXBvcnRTY3JpcHRzLCBpbXBvcnRTY3JpcHRzIHdpbGwgYmxvY2sgdW50aWxcbiAgICAgICAgICAgICAgICAvL2l0cyBzY3JpcHQgaXMgZG93bmxvYWRlZCBhbmQgZXZhbHVhdGVkLiBIb3dldmVyLCBpZiB3ZWIgd29ya2Vyc1xuICAgICAgICAgICAgICAgIC8vYXJlIGluIHBsYXksIHRoZSBleHBlY3RhdGlvbiB0aGF0IGEgYnVpbGQgaGFzIGJlZW4gZG9uZSBzbyB0aGF0XG4gICAgICAgICAgICAgICAgLy9vbmx5IG9uZSBzY3JpcHQgbmVlZHMgdG8gYmUgbG9hZGVkIGFueXdheS4gVGhpcyBtYXkgbmVlZCB0byBiZVxuICAgICAgICAgICAgICAgIC8vcmVldmFsdWF0ZWQgaWYgb3RoZXIgdXNlIGNhc2VzIGJlY29tZSBjb21tb24uXG4gICAgICAgICAgICAgICAgaW1wb3J0U2NyaXB0cyh1cmwpO1xuXG4gICAgICAgICAgICAgICAgLy9BY2NvdW50IGZvciBhbm9ueW1vdXMgbW9kdWxlc1xuICAgICAgICAgICAgICAgIGNvbnRleHQuY29tcGxldGVMb2FkKG1vZHVsZU5hbWUpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQub25FcnJvcihtYWtlRXJyb3IoJ2ltcG9ydHNjcmlwdHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnaW1wb3J0U2NyaXB0cyBmYWlsZWQgZm9yICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kdWxlTmFtZSArICcgYXQgJyArIHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW21vZHVsZU5hbWVdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZ2V0SW50ZXJhY3RpdmVTY3JpcHQoKSB7XG4gICAgICAgIGlmIChpbnRlcmFjdGl2ZVNjcmlwdCAmJiBpbnRlcmFjdGl2ZVNjcmlwdC5yZWFkeVN0YXRlID09PSAnaW50ZXJhY3RpdmUnKSB7XG4gICAgICAgICAgICByZXR1cm4gaW50ZXJhY3RpdmVTY3JpcHQ7XG4gICAgICAgIH1cblxuICAgICAgICBlYWNoUmV2ZXJzZShzY3JpcHRzKCksIGZ1bmN0aW9uIChzY3JpcHQpIHtcbiAgICAgICAgICAgIGlmIChzY3JpcHQucmVhZHlTdGF0ZSA9PT0gJ2ludGVyYWN0aXZlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiAoaW50ZXJhY3RpdmVTY3JpcHQgPSBzY3JpcHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGludGVyYWN0aXZlU2NyaXB0O1xuICAgIH1cblxuICAgIC8vTG9vayBmb3IgYSBkYXRhLW1haW4gc2NyaXB0IGF0dHJpYnV0ZSwgd2hpY2ggY291bGQgYWxzbyBhZGp1c3QgdGhlIGJhc2VVcmwuXG4gICAgaWYgKGlzQnJvd3NlciAmJiAhY2ZnLnNraXBEYXRhTWFpbikge1xuICAgICAgICAvL0ZpZ3VyZSBvdXQgYmFzZVVybC4gR2V0IGl0IGZyb20gdGhlIHNjcmlwdCB0YWcgd2l0aCByZXF1aXJlLmpzIGluIGl0LlxuICAgICAgICBlYWNoUmV2ZXJzZShzY3JpcHRzKCksIGZ1bmN0aW9uIChzY3JpcHQpIHtcbiAgICAgICAgICAgIC8vU2V0IHRoZSAnaGVhZCcgd2hlcmUgd2UgY2FuIGFwcGVuZCBjaGlsZHJlbiBieVxuICAgICAgICAgICAgLy91c2luZyB0aGUgc2NyaXB0J3MgcGFyZW50LlxuICAgICAgICAgICAgaWYgKCFoZWFkKSB7XG4gICAgICAgICAgICAgICAgaGVhZCA9IHNjcmlwdC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0xvb2sgZm9yIGEgZGF0YS1tYWluIGF0dHJpYnV0ZSB0byBzZXQgbWFpbiBzY3JpcHQgZm9yIHRoZSBwYWdlXG4gICAgICAgICAgICAvL3RvIGxvYWQuIElmIGl0IGlzIHRoZXJlLCB0aGUgcGF0aCB0byBkYXRhIG1haW4gYmVjb21lcyB0aGVcbiAgICAgICAgICAgIC8vYmFzZVVybCwgaWYgaXQgaXMgbm90IGFscmVhZHkgc2V0LlxuICAgICAgICAgICAgZGF0YU1haW4gPSBzY3JpcHQuZ2V0QXR0cmlidXRlKCdkYXRhLW1haW4nKTtcbiAgICAgICAgICAgIGlmIChkYXRhTWFpbikge1xuICAgICAgICAgICAgICAgIC8vUHJlc2VydmUgZGF0YU1haW4gaW4gY2FzZSBpdCBpcyBhIHBhdGggKGkuZS4gY29udGFpbnMgJz8nKVxuICAgICAgICAgICAgICAgIG1haW5TY3JpcHQgPSBkYXRhTWFpbjtcblxuICAgICAgICAgICAgICAgIC8vU2V0IGZpbmFsIGJhc2VVcmwgaWYgdGhlcmUgaXMgbm90IGFscmVhZHkgYW4gZXhwbGljaXQgb25lLlxuICAgICAgICAgICAgICAgIGlmICghY2ZnLmJhc2VVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9QdWxsIG9mZiB0aGUgZGlyZWN0b3J5IG9mIGRhdGEtbWFpbiBmb3IgdXNlIGFzIHRoZVxuICAgICAgICAgICAgICAgICAgICAvL2Jhc2VVcmwuXG4gICAgICAgICAgICAgICAgICAgIHNyYyA9IG1haW5TY3JpcHQuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgbWFpblNjcmlwdCA9IHNyYy5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgc3ViUGF0aCA9IHNyYy5sZW5ndGggPyBzcmMuam9pbignLycpICArICcvJyA6ICcuLyc7XG5cbiAgICAgICAgICAgICAgICAgICAgY2ZnLmJhc2VVcmwgPSBzdWJQYXRoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vU3RyaXAgb2ZmIGFueSB0cmFpbGluZyAuanMgc2luY2UgbWFpblNjcmlwdCBpcyBub3dcbiAgICAgICAgICAgICAgICAvL2xpa2UgYSBtb2R1bGUgbmFtZS5cbiAgICAgICAgICAgICAgICBtYWluU2NyaXB0ID0gbWFpblNjcmlwdC5yZXBsYWNlKGpzU3VmZml4UmVnRXhwLCAnJyk7XG5cbiAgICAgICAgICAgICAgICAgLy9JZiBtYWluU2NyaXB0IGlzIHN0aWxsIGEgcGF0aCwgZmFsbCBiYWNrIHRvIGRhdGFNYWluXG4gICAgICAgICAgICAgICAgaWYgKHJlcS5qc0V4dFJlZ0V4cC50ZXN0KG1haW5TY3JpcHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1haW5TY3JpcHQgPSBkYXRhTWFpbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL1B1dCB0aGUgZGF0YS1tYWluIHNjcmlwdCBpbiB0aGUgZmlsZXMgdG8gbG9hZC5cbiAgICAgICAgICAgICAgICBjZmcuZGVwcyA9IGNmZy5kZXBzID8gY2ZnLmRlcHMuY29uY2F0KG1haW5TY3JpcHQpIDogW21haW5TY3JpcHRdO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiB0aGF0IGhhbmRsZXMgZGVmaW5pdGlvbnMgb2YgbW9kdWxlcy4gRGlmZmVycyBmcm9tXG4gICAgICogcmVxdWlyZSgpIGluIHRoYXQgYSBzdHJpbmcgZm9yIHRoZSBtb2R1bGUgc2hvdWxkIGJlIHRoZSBmaXJzdCBhcmd1bWVudCxcbiAgICAgKiBhbmQgdGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGUgYWZ0ZXIgZGVwZW5kZW5jaWVzIGFyZSBsb2FkZWQgc2hvdWxkXG4gICAgICogcmV0dXJuIGEgdmFsdWUgdG8gZGVmaW5lIHRoZSBtb2R1bGUgY29ycmVzcG9uZGluZyB0byB0aGUgZmlyc3QgYXJndW1lbnQnc1xuICAgICAqIG5hbWUuXG4gICAgICovXG4gICAgZGVmaW5lID0gZnVuY3Rpb24gKG5hbWUsIGRlcHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBub2RlLCBjb250ZXh0O1xuXG4gICAgICAgIC8vQWxsb3cgZm9yIGFub255bW91cyBtb2R1bGVzXG4gICAgICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vQWRqdXN0IGFyZ3MgYXBwcm9wcmlhdGVseVxuICAgICAgICAgICAgY2FsbGJhY2sgPSBkZXBzO1xuICAgICAgICAgICAgZGVwcyA9IG5hbWU7XG4gICAgICAgICAgICBuYW1lID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vVGhpcyBtb2R1bGUgbWF5IG5vdCBoYXZlIGRlcGVuZGVuY2llc1xuICAgICAgICBpZiAoIWlzQXJyYXkoZGVwcykpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZGVwcztcbiAgICAgICAgICAgIGRlcHMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9JZiBubyBuYW1lLCBhbmQgY2FsbGJhY2sgaXMgYSBmdW5jdGlvbiwgdGhlbiBmaWd1cmUgb3V0IGlmIGl0IGFcbiAgICAgICAgLy9Db21tb25KUyB0aGluZyB3aXRoIGRlcGVuZGVuY2llcy5cbiAgICAgICAgaWYgKCFkZXBzICYmIGlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XG4gICAgICAgICAgICBkZXBzID0gW107XG4gICAgICAgICAgICAvL1JlbW92ZSBjb21tZW50cyBmcm9tIHRoZSBjYWxsYmFjayBzdHJpbmcsXG4gICAgICAgICAgICAvL2xvb2sgZm9yIHJlcXVpcmUgY2FsbHMsIGFuZCBwdWxsIHRoZW0gaW50byB0aGUgZGVwZW5kZW5jaWVzLFxuICAgICAgICAgICAgLy9idXQgb25seSBpZiB0aGVyZSBhcmUgZnVuY3Rpb24gYXJncy5cbiAgICAgICAgICAgIGlmIChjYWxsYmFjay5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAudG9TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShjb21tZW50UmVnRXhwLCAnJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoY2pzUmVxdWlyZVJlZ0V4cCwgZnVuY3Rpb24gKG1hdGNoLCBkZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlcHMucHVzaChkZXApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vTWF5IGJlIGEgQ29tbW9uSlMgdGhpbmcgZXZlbiB3aXRob3V0IHJlcXVpcmUgY2FsbHMsIGJ1dCBzdGlsbFxuICAgICAgICAgICAgICAgIC8vY291bGQgdXNlIGV4cG9ydHMsIGFuZCBtb2R1bGUuIEF2b2lkIGRvaW5nIGV4cG9ydHMgYW5kIG1vZHVsZVxuICAgICAgICAgICAgICAgIC8vd29yayB0aG91Z2ggaWYgaXQganVzdCBuZWVkcyByZXF1aXJlLlxuICAgICAgICAgICAgICAgIC8vUkVRVUlSRVMgdGhlIGZ1bmN0aW9uIHRvIGV4cGVjdCB0aGUgQ29tbW9uSlMgdmFyaWFibGVzIGluIHRoZVxuICAgICAgICAgICAgICAgIC8vb3JkZXIgbGlzdGVkIGJlbG93LlxuICAgICAgICAgICAgICAgIGRlcHMgPSAoY2FsbGJhY2subGVuZ3RoID09PSAxID8gWydyZXF1aXJlJ10gOiBbJ3JlcXVpcmUnLCAnZXhwb3J0cycsICdtb2R1bGUnXSkuY29uY2F0KGRlcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9JZiBpbiBJRSA2LTggYW5kIGhpdCBhbiBhbm9ueW1vdXMgZGVmaW5lKCkgY2FsbCwgZG8gdGhlIGludGVyYWN0aXZlXG4gICAgICAgIC8vd29yay5cbiAgICAgICAgaWYgKHVzZUludGVyYWN0aXZlKSB7XG4gICAgICAgICAgICBub2RlID0gY3VycmVudGx5QWRkaW5nU2NyaXB0IHx8IGdldEludGVyYWN0aXZlU2NyaXB0KCk7XG4gICAgICAgICAgICBpZiAobm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBuYW1lID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtcmVxdWlyZW1vZHVsZScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250ZXh0ID0gY29udGV4dHNbbm9kZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtcmVxdWlyZWNvbnRleHQnKV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL0Fsd2F5cyBzYXZlIG9mZiBldmFsdWF0aW5nIHRoZSBkZWYgY2FsbCB1bnRpbCB0aGUgc2NyaXB0IG9ubG9hZCBoYW5kbGVyLlxuICAgICAgICAvL1RoaXMgYWxsb3dzIG11bHRpcGxlIG1vZHVsZXMgdG8gYmUgaW4gYSBmaWxlIHdpdGhvdXQgcHJlbWF0dXJlbHlcbiAgICAgICAgLy90cmFjaW5nIGRlcGVuZGVuY2llcywgYW5kIGFsbG93cyBmb3IgYW5vbnltb3VzIG1vZHVsZSBzdXBwb3J0LFxuICAgICAgICAvL3doZXJlIHRoZSBtb2R1bGUgbmFtZSBpcyBub3Qga25vd24gdW50aWwgdGhlIHNjcmlwdCBvbmxvYWQgZXZlbnRcbiAgICAgICAgLy9vY2N1cnMuIElmIG5vIGNvbnRleHQsIHVzZSB0aGUgZ2xvYmFsIHF1ZXVlLCBhbmQgZ2V0IGl0IHByb2Nlc3NlZFxuICAgICAgICAvL2luIHRoZSBvbnNjcmlwdCBsb2FkIGNhbGxiYWNrLlxuICAgICAgICAoY29udGV4dCA/IGNvbnRleHQuZGVmUXVldWUgOiBnbG9iYWxEZWZRdWV1ZSkucHVzaChbbmFtZSwgZGVwcywgY2FsbGJhY2tdKTtcbiAgICB9O1xuXG4gICAgZGVmaW5lLmFtZCA9IHtcbiAgICAgICAgalF1ZXJ5OiB0cnVlXG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgdGhlIHRleHQuIE5vcm1hbGx5IGp1c3QgdXNlcyBldmFsLCBidXQgY2FuIGJlIG1vZGlmaWVkXG4gICAgICogdG8gdXNlIGEgYmV0dGVyLCBlbnZpcm9ubWVudC1zcGVjaWZpYyBjYWxsLiBPbmx5IHVzZWQgZm9yIHRyYW5zcGlsaW5nXG4gICAgICogbG9hZGVyIHBsdWdpbnMsIG5vdCBmb3IgcGxhaW4gSlMgbW9kdWxlcy5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dCB0aGUgdGV4dCB0byBleGVjdXRlL2V2YWx1YXRlLlxuICAgICAqL1xuICAgIHJlcS5leGVjID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgLypqc2xpbnQgZXZpbDogdHJ1ZSAqL1xuICAgICAgICByZXR1cm4gZXZhbCh0ZXh0KTtcbiAgICB9O1xuXG4gICAgLy9TZXQgdXAgd2l0aCBjb25maWcgaW5mby5cbiAgICByZXEoY2ZnKTtcbn0odGhpcykpOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==