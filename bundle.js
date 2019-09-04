
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, callback) {
        const unsub = store.subscribe(callback);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    /**
     * Derived value store by synchronizing one or more readable stores and
     * applying an aggregation function over its input values.
     * @param {Stores} stores input stores
     * @param {function(Stores=, function(*)=):*}fn function callback that aggregates the values
     * @param {*=}initial_value when used asynchronously
     */
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => store.subscribe((value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function regexparam (str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.9.1 */
    const { Error: Error_1, Object: Object_1 } = globals;

    function create_fragment(ctx) {
    	var switch_instance_anchor, current;

    	var switch_value = ctx.component;

    	function switch_props(ctx) {
    		return {
    			props: { params: ctx.componentParams },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props(ctx));
    	}

    	return {
    		c: function create() {
    			if (switch_instance) switch_instance.$$.fragment.c();
    			switch_instance_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var switch_instance_changes = {};
    			if (changed.componentParams) switch_instance_changes.params = ctx.componentParams;

    			if (switch_value !== (switch_value = ctx.component)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;
    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});
    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));

    					switch_instance.$$.fragment.c();
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}

    			else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(switch_instance_anchor);
    			}

    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    const hashPosition = window.location.href.indexOf('#/');
    let location = (hashPosition > -1) ? window.location.href.substr(hashPosition + 1) : '/';

    // Check if there's a querystring
    const qsPosition = location.indexOf('?');
    let querystring = '';
    if (qsPosition > -1) {
        querystring = location.substr(qsPosition + 1);
        location = location.substr(0, qsPosition);
    }

    return {location, querystring}
    }

    /**
     * Readable store that returns the current full location (incl. querystring)
     */
    const loc = readable(
    getLocation(),
    // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
        const update = () => {
            set(getLocation());
        };
        window.addEventListener('hashchange', update, false);

        return function stop() {
            window.removeEventListener('hashchange', update, false);
        }
    }
    );

    /**
     * Readable store that returns the current location
     */
    const location = derived(
    loc,
    ($loc) => $loc.location
    );

    /**
     * Readable store that returns the current querystring
     */
    const querystring = derived(
    loc,
    ($loc) => $loc.querystring
    );

    function instance($$self, $$props, $$invalidate) {
    	let $loc;

    	validate_store(loc, 'loc');
    	component_subscribe($$self, loc, $$value => { $loc = $$value; $$invalidate('$loc', $loc); });

    	/**
     * Dictionary of all routes, in the format `'/path': component`.
     *
     * For example:
     * ````js
     * import HomeRoute from './routes/HomeRoute.svelte'
     * import BooksRoute from './routes/BooksRoute.svelte'
     * import NotFoundRoute from './routes/NotFoundRoute.svelte'
     * routes = {
     *     '/': HomeRoute,
     *     '/books': BooksRoute,
     *     '*': NotFoundRoute
     * }
     * ````
     */
    let { routes = {} } = $$props;

    /**
     * Container for a route: path, component
     */
    class RouteItem {
        /**
         * Initializes the object and creates a regular expression from the path, using regexparam.
         *
         * @param {string} path - Path to the route (must start with '/' or '*')
         * @param {SvelteComponent} component - Svelte component for the route
         */
        constructor(path, component) {
            // Path must be a regular or expression, or a string starting with '/' or '*'
            if (!path || 
                (typeof path == 'string' && (path.length < 1 || (path.charAt(0) != '/' && path.charAt(0) != '*'))) ||
                (typeof path == 'object' && !(path instanceof RegExp))
            ) {
                throw Error('Invalid value for "path" argument')
            }

            const {pattern, keys} = regexparam(path);

            this.path = path;
            this.component = component;

            this._pattern = pattern;
            this._keys = keys;
        }

        /**
         * Checks if `path` matches the current route.
         * If there's a match, will return the list of parameters from the URL (if any).
         * In case of no match, the method will return `null`.
         *
         * @param {string} path - Path to test
         * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
         */
        match(path) {
            const matches = this._pattern.exec(path);
            if (matches === null) {
                return null
            }

            // If the input was a regular expression, this._keys would be false, so return matches as is
            if (this._keys === false) {
                return matches
            }

            const out = {};
            let i = 0;
            while (i < this._keys.length) {
                out[this._keys[i]] = matches[++i] || null;
            }
            return out
        }
    }

    // We need an iterable: if it's not a Map, use Object.entries
    const routesIterable = (routes instanceof Map) ? routes : Object.entries(routes);

    // Set up all routes
    const routesList = [];
    for (const [path, route] of routesIterable) {
        routesList.push(new RouteItem(path, route));
    }

    // Props for the component to render
    let component = null;
    let componentParams = {};

    	const writable_props = ['routes'];
    	Object_1.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('routes' in $$props) $$invalidate('routes', routes = $$props.routes);
    	};

    	$$self.$$.update = ($$dirty = { component: 1, $loc: 1 }) => {
    		if ($$dirty.component || $$dirty.$loc) { {
                // Find a route matching the location
                $$invalidate('component', component = null);
                let i = 0;
                while (!component && i < routesList.length) {
                    const match = routesList[i].match($loc.location);
                    if (match) {
                        $$invalidate('component', component = routesList[i].component);
                        $$invalidate('componentParams', componentParams = match);
                    }
                    i++;
                }
            } }
    	};

    	return { routes, component, componentParams };
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["routes"]);
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Social.svelte generated by Svelte v3.9.1 */

    const file = "src/components/Social.svelte";

    function create_fragment$1(ctx) {
    	var div, a0, h30, i0, t0, t1, a1, h31, i1, t2, t3, a2, h32, i2, t4, t5, a3, h33, i3, t6, t7, a4, h34, i4, t8;

    	return {
    		c: function create() {
    			div = element("div");
    			a0 = element("a");
    			h30 = element("h3");
    			i0 = element("i");
    			t0 = text("\n       cabreraalex.com");
    			t1 = space();
    			a1 = element("a");
    			h31 = element("h3");
    			i1 = element("i");
    			t2 = text("\n        cabrera@cmu.edu");
    			t3 = space();
    			a2 = element("a");
    			h32 = element("h3");
    			i2 = element("i");
    			t4 = text("\n        @a_a_cabrera");
    			t5 = space();
    			a3 = element("a");
    			h33 = element("h3");
    			i3 = element("i");
    			t6 = text("\n        GitHub");
    			t7 = space();
    			a4 = element("a");
    			h34 = element("h3");
    			i4 = element("i");
    			t8 = text("\n       Google Scholar");
    			attr(i0, "class", "fas fa-home");
    			add_location(i0, file, 9, 6, 123);
    			attr(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file, 8, 4, 112);
    			attr(a0, "href", "https://cabreraalex.com");
    			add_location(a0, file, 7, 2, 73);
    			attr(i1, "class", "fas fa-envelope");
    			add_location(i1, file, 15, 6, 245);
    			attr(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file, 14, 4, 234);
    			attr(a1, "href", "mailto:cabrera@cmu.edu");
    			add_location(a1, file, 13, 2, 196);
    			attr(i2, "class", "fab fa-twitter social-icon");
    			add_location(i2, file, 21, 6, 386);
    			attr(h32, "class", "svelte-1t8evy3");
    			add_location(h32, file, 20, 4, 375);
    			attr(a2, "href", "https://twitter.com/a_a_cabrera");
    			add_location(a2, file, 19, 2, 328);
    			attr(i3, "class", "fab fa-github");
    			add_location(i3, file, 27, 6, 534);
    			attr(h33, "class", "svelte-1t8evy3");
    			add_location(h33, file, 26, 4, 523);
    			attr(a3, "href", "https://github.com/cabreraalex");
    			add_location(a3, file, 25, 2, 477);
    			attr(i4, "class", "fas fa-graduation-cap");
    			add_location(i4, file, 33, 6, 693);
    			attr(h34, "class", "svelte-1t8evy3");
    			add_location(h34, file, 32, 4, 682);
    			attr(a4, "href", "https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en");
    			add_location(a4, file, 31, 2, 606);
    			attr(div, "id", "social");
    			add_location(div, file, 6, 0, 53);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, a0);
    			append(a0, h30);
    			append(h30, i0);
    			append(h30, t0);
    			append(div, t1);
    			append(div, a1);
    			append(a1, h31);
    			append(h31, i1);
    			append(h31, t2);
    			append(div, t3);
    			append(div, a2);
    			append(a2, h32);
    			append(h32, i2);
    			append(h32, t4);
    			append(div, t5);
    			append(div, a3);
    			append(a3, h33);
    			append(h33, i3);
    			append(h33, t6);
    			append(div, t7);
    			append(div, a4);
    			append(a4, h34);
    			append(h34, i4);
    			append(h34, t8);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class Social extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.9.1 */

    const file$1 = "src/components/Sidebar.svelte";

    function create_fragment$2(ctx) {
    	var link, t0, div1, div0, a0, img, t1, h1, t2, span0, t4, span1, t6, t7, a1, button0, t9, a2, button1, current;

    	var social = new Social({ $$inline: true });

    	return {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t1 = space();
    			h1 = element("h1");
    			t2 = text("Ángel\n      ");
    			span0 = element("span");
    			span0.textContent = "Alex";
    			t4 = text("ander\n      ");
    			span1 = element("span");
    			span1.textContent = "Cabrera";
    			t6 = space();
    			social.$$.fragment.c();
    			t7 = space();
    			a1 = element("a");
    			button0 = element("button");
    			button0.textContent = "CV (web)";
    			t9 = space();
    			a2 = element("a");
    			button1 = element("button");
    			button1.textContent = "CV (pdf)";
    			attr(link, "rel", "stylesheet");
    			attr(link, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link, "crossorigin", "anonymous");
    			add_location(link, file$1, 4, 0, 60);
    			attr(img, "width", "170px");
    			attr(img, "src", "images/profile.jpg");
    			attr(img, "alt", "profile picture");
    			add_location(img, file$1, 13, 6, 368);
    			attr(a0, "href", "/");
    			add_location(a0, file$1, 12, 4, 349);
    			attr(span0, "class", "name");
    			add_location(span0, file$1, 17, 6, 490);
    			attr(span1, "class", "name");
    			add_location(span1, file$1, 18, 6, 532);
    			attr(h1, "id", "name");
    			add_location(h1, file$1, 15, 4, 450);
    			attr(button0, "class", "cv");
    			add_location(button0, file$1, 22, 6, 618);
    			attr(a1, "href", "/#/cv");
    			add_location(a1, file$1, 21, 4, 595);
    			attr(button1, "class", "cv");
    			add_location(button1, file$1, 25, 6, 693);
    			attr(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 24, 4, 668);
    			attr(div0, "id", "padded-sidebar");
    			add_location(div0, file$1, 11, 2, 319);
    			attr(div1, "id", "sidebar");
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$1, 10, 0, 267);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, link, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t1);
    			append(div0, h1);
    			append(h1, t2);
    			append(h1, span0);
    			append(h1, t4);
    			append(h1, span1);
    			append(div0, t6);
    			mount_component(social, div0, null);
    			append(div0, t7);
    			append(div0, a1);
    			append(a1, button0);
    			append(div0, t9);
    			append(div0, a2);
    			append(a2, button1);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			transition_in(social.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(social.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(link);
    				detach(t0);
    				detach(div1);
    			}

    			destroy_component(social);
    		}
    	};
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.9.1 */

    const file$2 = "src/components/Footer.svelte";

    function create_fragment$3(ctx) {
    	var div, p, t0, a0, t2, a1;

    	return {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text("© 2019 Ángel Alexander Cabrera - Developed with\n    ");
    			a0 = element("a");
    			a0.textContent = "Svelte";
    			t2 = text("\n    and\n    ");
    			a1 = element("a");
    			a1.textContent = "Pure CSS";
    			attr(a0, "href", "https://svelte.dev");
    			add_location(a0, file$2, 10, 4, 186);
    			attr(a1, "href", "https://purecss.io");
    			add_location(a1, file$2, 12, 4, 238);
    			attr(p, "id", "copyright");
    			add_location(p, file$2, 8, 2, 104);
    			attr(div, "class", "footer svelte-wg51xb");
    			add_location(div, file$2, 7, 0, 81);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p);
    			append(p, t0);
    			append(p, a0);
    			append(p, t2);
    			append(p, a1);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, []);
    	}
    }

    var news = [
            {
                "date": "July 23, 2019",
                "news": "We will be presenting FairVis as a conference paper at VIS'19!"
            },
            {
                "date": "May 6, 2019",
                "news": "Our work on discovering intersectional bias was accepted to the <a href='https://debug-ml-iclr2019.github.io/'>Debugging Machine Learning Models workshop</a> at ICLR'19 in New Orleans."
            },
            {
                "date": "April 10, 2019",
                "news": "Named a <a href='https://www.nsfgrfp.org/'>NSF Graduate Research Fellow.</a>"
            },
            {
                "date": "April 3, 2019",
                "news": "Excited to be starting my PhD in Human-Computer Interaction at Carnegie Mellon in Fall 2019!"
            }
        ];

    /* src/News.svelte generated by Svelte v3.9.1 */

    const file$3 = "src/News.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.n = list[i];
    	return child_ctx;
    }

    // (12:6) {#each news as n}
    function create_each_block(ctx) {
    	var div, p0, t0_value = ctx.n.date + "", t0, t1, p1, raw_value = ctx.n.news + "", t2;

    	return {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			attr(p0, "class", "pure-u-1 pure-u-md-1-4 date");
    			add_location(p0, file$3, 13, 10, 391);
    			attr(p1, "class", "item pure-u-1 pure-u-md-3-4");
    			add_location(p1, file$3, 14, 10, 453);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$3, 12, 8, 350);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(div, t1);
    			append(div, p1);
    			p1.innerHTML = raw_value;
    			append(div, t2);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var div2, t0, div1, div0, h1, t2, t3, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var each_value = news;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			div2 = element("div");
    			sidebar.$$.fragment.c();
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "News";
    			t2 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			footer.$$.fragment.c();
    			add_location(h1, file$3, 10, 6, 304);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$3, 9, 4, 272);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$3, 8, 2, 218);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$3, 6, 0, 161);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div2, anchor);
    			mount_component(sidebar, div2, null);
    			append(div2, t0);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, h1);
    			append(div0, t2);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append(div1, t3);
    			mount_component(footer, div1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value = news;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div2);
    			}

    			destroy_component(sidebar);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    }

    class News extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$4, safe_not_equal, []);
    	}
    }

    var pubs = [
        {
            "title": "FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning",
            "id": "fairvis",
            "teaser": "fairvis.png",
            "venue": "IEEE VIS'19",
            "venuelong": "IEEE Transactions on Visualization and Computer Graphics",
            "year": "2019",
            "location": "Vancouver, Canada",
            "authors": [
                {
                    "name": "Ángel Alexander Cabrera",
                    "website": "https://cabreraalex.com"
                },
                {
                    "name": "Will Epperson",
                    "website": "http://willepperson.com"
                },
                {
                    "name": "Fred Hohman",
                    "website": "https://fredhohman.com"
                },
                {
                    "name": "Minsuk Kahng",
                    "website": "https://minsuk.com"
                },
                {
                    "name": "Jamie Morgenstern",
                    "website": "http://jamiemorgenstern.com"
                },
                {
                    "name": "Duen Horng (Polo) Chau",
                    "website": "https://poloclub.github.io/polochau/"
                },

            ],
            "bibtex": "@article{cabrera2019fairvis, title={FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, author={Cabrera, {\'A}ngel Alexander and Epperson, Will and Hohman, Fred and Kahng, Minsuk and Morgenstern, Jamie and Chau, Duen Horng}, journal={IEEE Conference on Visual Analytics Science and Technology (VAST)}, year={2019}, publisher={IEEE}}",
            "abstract": "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
            "demo": "https://poloclub.github.io/FairVis/",
            "code": "https://github.com/poloclub/FairVis",
            "blog": "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
            "pdf": "https://arxiv.org/abs/1904.05419",
        },
        {
            "title": "Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation",
            "id": "subgroup-gen",
            "teaser": "iclr.png",
            "venue": "Workshop, ICLR'19",
            "venuelong": "Debugging Machine Learning Models Workshop at ICLR (Debug ML)",
            "year": "2019",
            "location": "New Orleans, Louisiana, USA",
            "authors": [
                {
                    "name": "Ángel Alexander Cabrera",
                    "website": "https://cabreraalex.com"
                },
                {
                    "name": "Minsuk Kahng",
                    "website": "https://minsuk.com"
                },
                {
                    "name": "Fred Hohman",
                    "website": "https://fredhohman.com"
                },
                {
                    "name": "Jamie Morgenstern",
                    "website": "http://jamiemorgenstern.com"
                },
                {
                    "name": "Duen Horng (Polo) Chau",
                    "website": "https://poloclub.github.io/polochau/"
                },

            ],
            "bibtex": "@article{cabrera2019discovery, title={Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation}, author={Cabrera, {\'A}ngel Alexander and Kahng, Minsuk and Hohman, Fred and Morgenstern, Jamie and Chau, Duen Horng}, journal={Debugging Machine Learning Models Workshop (Debug ML) at ICLR}, year={2019}}",
            "abstract": "As machine learning is applied to data about people, it is crucial to understand how learned models treat different demographic groups. Many factors, including what training data and class of models are used, can encode biased behavior into learned outcomes. These biases are often small when considering a single feature (e.g., sex or race) in isolation, but appear more blatantly at the intersection of multiple features. We present our ongoing work of designing automatic techniques and interactive tools to help users discover subgroups of data instances on which a model underperforms. Using a bottom-up clustering technique for subgroup generation, users can quickly find areas of a dataset in which their models are encoding bias. Our work presents some of the first user-focused, interactive methods for discovering bias in machine learning models.",
            "pdf": "https://debug-ml-iclr2019.github.io/cameraready/DebugML-19_paper_3.pdf",
            "workshop": "https://debug-ml-iclr2019.github.io/"
        },
        {
            "title": "Interactive Classification for Deep Learning Interpretation",
            "id": "interactive-classification",
            "teaser": "interactive.png",
            "venue": "Demo, CVPR'18",
            "venuelong": "Demo at IEEE Computer Vision and Pattern Recognition (CVPR)",
            "year": "2018",
            "location": "Salt Lake City, Utah, USA",
            "authors": [
                {
                    "name": "Ángel Alexander Cabrera",
                    "website": "https://cabreraalex.com"
                },
                {
                    "name": "Fred Hohman",
                    "website": "https://fredhohman.com"
                },
                {
                    "name": "Jason Lin",
                    "website": "http://jlin.xyz",
                },
                {
                    "name": "Duen Horng (Polo) Chau",
                    "website": "https://poloclub.github.io/polochau/"
                },

            ],
            "bibtex": "@article{cabrera2018interactive, title={Interactive Classification for Deep Learning Interpretation}, author={Cabrera, {\'A}ngel Alexander and Hohman, Fred and Lin, Jason and Chau, Duen Horng}, journal={Demo, IEEE Conference on Computer Vision and Pattern Recognition (CVPR)}, year={2018}, organization={IEEE}}",
            "abstract": "We present an interactive system enabling users to manipulate images to explore the robustness and sensitivity of deep learning image classifiers. Using modern web technologies to run in-browser inference, users can remove image features using inpainting algorithms to obtain new classifications in real time. This system allows users to compare and contrast what image regions humans and machine learning models use for classification.",
            "website": "http://fredhohman.com/papers/interactive-classification",
            "pdf": "https://arxiv.org/abs/1806.05660",
            "video": "https://www.youtube.com/watch?v=llub5GcOF6w",
            "demo": "https://cabreraalex.github.io/interactive-classification",
            "code": "https://github.com/poloclub/interactive-classification"
        }
    ];

    /* src/components/Intro.svelte generated by Svelte v3.9.1 */

    const file$4 = "src/components/Intro.svelte";

    function create_fragment$5(ctx) {
    	var p0, t0, a0, t2, a1, t4, t5, p1, t6, b0, t8, b1, t10, b2, t12, a2, t14, t15, p2, t16, a3, t18, a4, t20, a5, t22, a6, t24, b3, span0, span1, span2, span3, span4, span5, t31;

    	return {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("I am a first year PhD student in the\n  ");
    			a0 = element("a");
    			a0.textContent = "Human Computer Interaction Institute (HCII)";
    			t2 = text("\n  at\n  ");
    			a1 = element("a");
    			a1.textContent = "Carnegie Mellon University";
    			t4 = text(".");
    			t5 = space();
    			p1 = element("p");
    			t6 = text("My research focus is broadly\n  ");
    			b0 = element("b");
    			b0.textContent = "human-centered AI";
    			t8 = text(", \n  specifically in applying techniques from\n  ");
    			b1 = element("b");
    			b1.textContent = "HCI";
    			t10 = text("\n  and\n  ");
    			b2 = element("b");
    			b2.textContent = "visualization";
    			t12 = text("\n  to help people better understand and develop machine learning models.\n  I am supported by a\n  ");
    			a2 = element("a");
    			a2.textContent = "NSF Graduate Research Fellowship";
    			t14 = text(".");
    			t15 = space();
    			p2 = element("p");
    			t16 = text("Before CMU, I graduated with a B.S. in Computer Science from\n  ");
    			a3 = element("a");
    			a3.textContent = "Georgia Tech";
    			t18 = text(", \n  where I was a member of the\n  ");
    			a4 = element("a");
    			a4.textContent = "Polo Club of Data Science";
    			t20 = text("\n  and worked with\n  ");
    			a5 = element("a");
    			a5.textContent = "Polo Chau";
    			t22 = text("\n  and\n  ");
    			a6 = element("a");
    			a6.textContent = "Jamie Morgenstern";
    			t24 = text(". \n  I also spent a few summers as a software engineering intern at\n  ");
    			b3 = element("b");
    			span0 = element("span");
    			span0.textContent = "G";
    			span1 = element("span");
    			span1.textContent = "o";
    			span2 = element("span");
    			span2.textContent = "o";
    			span3 = element("span");
    			span3.textContent = "g";
    			span4 = element("span");
    			span4.textContent = "l";
    			span5 = element("span");
    			span5.textContent = "e";
    			t31 = text("\n  working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 2, 2, 45);
    			attr(a1, "href", "https://www.cmu.edu/");
    			add_location(a1, file$4, 6, 2, 140);
    			add_location(p0, file$4, 0, 0, 0);
    			add_location(b0, file$4, 11, 2, 246);
    			add_location(b1, file$4, 13, 2, 318);
    			add_location(b2, file$4, 15, 2, 337);
    			attr(a2, "href", "https://www.nsfgrfp.org/");
    			add_location(a2, file$4, 18, 2, 454);
    			add_location(p1, file$4, 9, 0, 209);
    			attr(a3, "href", "https://www.gatech.edu/");
    			add_location(a3, file$4, 24, 2, 607);
    			attr(a4, "href", "https://poloclub.github.io/");
    			add_location(a4, file$4, 26, 2, 692);
    			attr(a5, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a5, file$4, 28, 2, 780);
    			attr(a6, "href", "http://jamiemorgenstern.com/");
    			add_location(a6, file$4, 30, 2, 846);
    			attr(span0, "class", "g");
    			add_location(span0, file$4, 33, 4, 984);
    			attr(span1, "class", "o1");
    			add_location(span1, file$4, 33, 28, 1008);
    			attr(span2, "class", "o2");
    			add_location(span2, file$4, 33, 53, 1033);
    			attr(span3, "class", "g");
    			add_location(span3, file$4, 33, 78, 1058);
    			attr(span4, "class", "l");
    			add_location(span4, file$4, 33, 102, 1082);
    			attr(span5, "class", "e");
    			add_location(span5, file$4, 33, 126, 1106);
    			add_location(b3, file$4, 32, 2, 976);
    			add_location(p2, file$4, 22, 0, 538);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, p0, anchor);
    			append(p0, t0);
    			append(p0, a0);
    			append(p0, t2);
    			append(p0, a1);
    			append(p0, t4);
    			insert(target, t5, anchor);
    			insert(target, p1, anchor);
    			append(p1, t6);
    			append(p1, b0);
    			append(p1, t8);
    			append(p1, b1);
    			append(p1, t10);
    			append(p1, b2);
    			append(p1, t12);
    			append(p1, a2);
    			append(p1, t14);
    			insert(target, t15, anchor);
    			insert(target, p2, anchor);
    			append(p2, t16);
    			append(p2, a3);
    			append(p2, t18);
    			append(p2, a4);
    			append(p2, t20);
    			append(p2, a5);
    			append(p2, t22);
    			append(p2, a6);
    			append(p2, t24);
    			append(p2, b3);
    			append(b3, span0);
    			append(b3, span1);
    			append(b3, span2);
    			append(b3, span3);
    			append(b3, span4);
    			append(b3, span5);
    			append(p2, t31);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p0);
    				detach(t5);
    				detach(p1);
    				detach(t15);
    				detach(p2);
    			}
    		}
    	};
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$5, safe_not_equal, []);
    	}
    }

    /* src/components/Links.svelte generated by Svelte v3.9.1 */

    const file$5 = "src/components/Links.svelte";

    // (6:2) {#if pub.pdf}
    function create_if_block_5(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        PDF");
    			attr(i, "class", "fas fa-file-pdf");
    			add_location(i, file$5, 8, 8, 124);
    			add_location(button, file$5, 7, 6, 107);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$5, 6, 4, 82);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.pdf)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (14:2) {#if pub.blog}
    function create_if_block_4(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        Blog");
    			attr(i, "class", "fab fa-medium");
    			add_location(i, file$5, 16, 8, 263);
    			add_location(button, file$5, 15, 6, 246);
    			attr(a, "href", a_href_value = ctx.pub.blog);
    			add_location(a, file$5, 14, 4, 220);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.blog)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (22:2) {#if pub.workshop}
    function create_if_block_3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        Workshop");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 24, 8, 409);
    			add_location(button, file$5, 23, 6, 392);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$5, 22, 4, 362);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.workshop)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (30:2) {#if pub.video}
    function create_if_block_2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        Video");
    			attr(i, "class", "fab fa-youtube");
    			add_location(i, file$5, 32, 8, 552);
    			add_location(button, file$5, 31, 6, 535);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$5, 30, 4, 508);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.video)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (38:2) {#if pub.demo}
    function create_if_block_1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        Demo");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 40, 8, 692);
    			add_location(button, file$5, 39, 6, 675);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$5, 38, 4, 649);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.demo)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (46:2) {#if pub.code}
    function create_if_block(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n        Code");
    			attr(i, "class", "fab fa-github");
    			add_location(i, file$5, 48, 8, 829);
    			add_location(button, file$5, 47, 6, 812);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$5, 46, 4, 786);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.code)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	var div, t0, t1, t2, t3, t4, t5, a, button, i, t6, a_href_value;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_5(ctx);

    	var if_block1 = (ctx.pub.blog) && create_if_block_4(ctx);

    	var if_block2 = (ctx.pub.workshop) && create_if_block_3(ctx);

    	var if_block3 = (ctx.pub.video) && create_if_block_2(ctx);

    	var if_block4 = (ctx.pub.demo) && create_if_block_1(ctx);

    	var if_block5 = (ctx.pub.code) && create_if_block(ctx);

    	return {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			t4 = space();
    			if (if_block5) if_block5.c();
    			t5 = space();
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t6 = text("\n      Website");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 55, 6, 955);
    			add_location(button, file$5, 54, 4, 940);
    			attr(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a, file$5, 53, 2, 905);
    			attr(div, "class", "buttons");
    			add_location(div, file$5, 4, 0, 40);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t1);
    			if (if_block2) if_block2.m(div, null);
    			append(div, t2);
    			if (if_block3) if_block3.m(div, null);
    			append(div, t3);
    			if (if_block4) if_block4.m(div, null);
    			append(div, t4);
    			if (if_block5) if_block5.m(div, null);
    			append(div, t5);
    			append(div, a);
    			append(a, button);
    			append(button, i);
    			append(button, t6);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.pub.blog) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_4(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.pub.workshop) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block_3(ctx);
    					if_block2.c();
    					if_block2.m(div, t2);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (ctx.pub.video) {
    				if (if_block3) {
    					if_block3.p(changed, ctx);
    				} else {
    					if_block3 = create_if_block_2(ctx);
    					if_block3.c();
    					if_block3.m(div, t3);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (ctx.pub.demo) {
    				if (if_block4) {
    					if_block4.p(changed, ctx);
    				} else {
    					if_block4 = create_if_block_1(ctx);
    					if_block4.c();
    					if_block4.m(div, t4);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (ctx.pub.code) {
    				if (if_block5) {
    					if_block5.p(changed, ctx);
    				} else {
    					if_block5 = create_if_block(ctx);
    					if_block5.c();
    					if_block5.m(div, t5);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if ((changed.pub) && a_href_value !== (a_href_value = '#/paper/' + ctx.pub.id)) {
    				attr(a, "href", a_href_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { pub } = $$props;

    	const writable_props = ['pub'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Links> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('pub' in $$props) $$invalidate('pub', pub = $$props.pub);
    	};

    	return { pub };
    }

    class Links extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$6, safe_not_equal, ["pub"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.pub === undefined && !('pub' in props)) {
    			console.warn("<Links> was created without expected prop 'pub'");
    		}
    	}

    	get pub() {
    		throw new Error("<Links>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pub(value) {
    		throw new Error("<Links>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Home.svelte generated by Svelte v3.9.1 */

    const file$6 = "src/Home.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx._ = list[i];
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (49:8) {#each {length: 3} as _, i}
    function create_each_block_1(ctx) {
    	var div, p0, t0_value = news[ctx.i].date + "", t0, t1, p1, raw_value = news[ctx.i].news + "", t2;

    	return {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			attr(p0, "class", "pure-u-1 pure-u-md-1-4 date");
    			add_location(p0, file$6, 50, 12, 1363);
    			attr(p1, "class", "item pure-u-1 pure-u-md-3-4");
    			add_location(p1, file$6, 51, 12, 1433);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$6, 49, 10, 1320);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(div, t1);
    			append(div, p1);
    			p1.innerHTML = raw_value;
    			append(div, t2);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    // (63:8) {#each pubs as pub}
    function create_each_block$1(ctx) {
    	var div4, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                        .map(func)
                        .join(', ') + "", t5, t6, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			h6 = element("h6");
    			t1 = text(t1_value);
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			h5 = element("h5");
    			t5 = space();
    			links.$$.fragment.c();
    			t6 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$6, 67, 18, 1942);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 66, 16, 1893);
    			attr(h6, "class", "venue");
    			add_location(h6, file$6, 72, 16, 2103);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$6, 65, 14, 1857);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$6, 64, 12, 1806);
    			add_location(h4, file$6, 78, 18, 2347);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$6, 77, 16, 2278);
    			add_location(h5, file$6, 80, 16, 2405);
    			attr(div2, "class", "padded");
    			add_location(div2, file$6, 76, 14, 2241);
    			attr(div3, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div3, file$6, 75, 12, 2190);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 63, 10, 1769);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div4, anchor);
    			append(div4, div1);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t0);
    			append(div0, h6);
    			append(h6, t1);
    			append(div4, t2);
    			append(div4, div3);
    			append(div3, div2);
    			append(div2, a1);
    			append(a1, h4);
    			append(h4, t3);
    			append(div2, t4);
    			append(div2, h5);
    			h5.innerHTML = raw_value;
    			append(div3, t5);
    			mount_component(links, div3, null);
    			append(div4, t6);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var links_changes = {};
    			if (changed.pubs) links_changes.pub = ctx.pub;
    			links.$set(links_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div4);
    			}

    			destroy_component(links);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	var div5, t0, div4, div3, div0, h20, t1, span, t3, t4, t5, div1, h21, t6, a0, t8, t9, div2, h22, t10, a1, t12, t13, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var intro = new Intro({ $$inline: true });

    	var each_value_1 = {length: 3};

    	var each_blocks_1 = [];

    	for (var i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	var each_value = pubs;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			div5 = element("div");
    			sidebar.$$.fragment.c();
    			t0 = space();
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			t1 = text("Hi! You can call me ");
    			span = element("span");
    			span.textContent = "Alex";
    			t3 = text(".");
    			t4 = space();
    			intro.$$.fragment.c();
    			t5 = space();
    			div1 = element("div");
    			h21 = element("h2");
    			t6 = text("News\n          ");
    			a0 = element("a");
    			a0.textContent = "all news";
    			t8 = space();

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t9 = space();
    			div2 = element("div");
    			h22 = element("h2");
    			t10 = text("Selected Publications\n          ");
    			a1 = element("a");
    			a1.textContent = "all publications";
    			t12 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			footer.$$.fragment.c();
    			attr(span, "class", "name");
    			add_location(span, file$6, 39, 30, 1062);
    			add_location(h20, file$6, 38, 8, 1027);
    			attr(div0, "id", "intro");
    			add_location(div0, file$6, 37, 6, 1002);
    			attr(a0, "class", "right-all");
    			attr(a0, "href", "#/news");
    			add_location(a0, file$6, 46, 10, 1212);
    			add_location(h21, file$6, 44, 8, 1182);
    			attr(div1, "id", "news");
    			attr(div1, "class", "sect");
    			add_location(div1, file$6, 43, 6, 1145);
    			attr(a1, "class", "right-all");
    			attr(a1, "href", "#/pubs");
    			add_location(a1, file$6, 60, 10, 1661);
    			add_location(h22, file$6, 58, 8, 1614);
    			attr(div2, "id", "pubs");
    			attr(div2, "class", "sect");
    			add_location(div2, file$6, 57, 6, 1577);
    			attr(div3, "id", "padded-content");
    			add_location(div3, file$6, 36, 4, 970);
    			attr(div4, "id", "content");
    			attr(div4, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div4, file$6, 35, 2, 916);
    			attr(div5, "class", "pure-g");
    			attr(div5, "id", "main-container");
    			add_location(div5, file$6, 33, 0, 859);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			mount_component(sidebar, div5, null);
    			append(div5, t0);
    			append(div5, div4);
    			append(div4, div3);
    			append(div3, div0);
    			append(div0, h20);
    			append(h20, t1);
    			append(h20, span);
    			append(h20, t3);
    			append(div0, t4);
    			mount_component(intro, div0, null);
    			append(div3, t5);
    			append(div3, div1);
    			append(div1, h21);
    			append(h21, t6);
    			append(h21, a0);
    			append(div1, t8);

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append(div3, t9);
    			append(div3, div2);
    			append(div2, h22);
    			append(h22, t10);
    			append(h22, a1);
    			append(div2, t12);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append(div4, t13);
    			mount_component(footer, div4, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value_1 = {length: 3};

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}
    				each_blocks_1.length = each_value_1.length;
    			}

    			if (changed.pubs) {
    				each_value = pubs;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) out(i);
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			transition_in(intro.$$.fragment, local);

    			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div5);
    			}

    			destroy_component(sidebar);

    			destroy_component(intro);

    			destroy_each(each_blocks_1, detaching);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    }

    function func(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    function instance$2($$self) {
    	

      (function(i, s, o, g, r, a, m) {
        i["GoogleAnalyticsObject"] = r;
        (i[r] =
          i[r] ||
          function() {
            (i[r].q = i[r].q || []).push(arguments);
          }),
          (i[r].l = 1 * new Date());
        (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a, m);
      })(
        window,
        document,
        "script",
        "//www.google-analytics.com/analytics.js",
        "ga"
      );

      ga("create", "UA-50459890-1", "auto");
      ga("send", "pageview");

    	return {};
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$7, safe_not_equal, []);
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.9.1 */

    const file$7 = "src/Pubs.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (13:8) {#each pubs as pub}
    function create_each_block$2(ctx) {
    	var div4, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                        .map(func$1)
                        .join(', ') + "", t5, t6, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			div4 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			h6 = element("h6");
    			t1 = text(t1_value);
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			h5 = element("h5");
    			t5 = space();
    			links.$$.fragment.c();
    			t6 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$7, 17, 18, 586);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$7, 16, 16, 537);
    			attr(h6, "class", "venue");
    			add_location(h6, file$7, 22, 16, 747);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$7, 15, 14, 501);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$7, 14, 12, 450);
    			add_location(h4, file$7, 28, 18, 991);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$7, 27, 16, 922);
    			add_location(h5, file$7, 30, 16, 1049);
    			attr(div2, "class", "padded");
    			add_location(div2, file$7, 26, 14, 885);
    			attr(div3, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div3, file$7, 25, 12, 834);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$7, 13, 10, 413);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div4, anchor);
    			append(div4, div1);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t0);
    			append(div0, h6);
    			append(h6, t1);
    			append(div4, t2);
    			append(div4, div3);
    			append(div3, div2);
    			append(div2, a1);
    			append(a1, h4);
    			append(h4, t3);
    			append(div2, t4);
    			append(div2, h5);
    			h5.innerHTML = raw_value;
    			append(div2, t5);
    			mount_component(links, div2, null);
    			append(div4, t6);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var links_changes = {};
    			if (changed.pubs) links_changes.pub = ctx.pub;
    			links.$set(links_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div4);
    			}

    			destroy_component(links);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	var div2, t0, div1, div0, h1, t2, t3, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var each_value = pubs;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			div2 = element("div");
    			sidebar.$$.fragment.c();
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Publications";
    			t2 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			footer.$$.fragment.c();
    			add_location(h1, file$7, 11, 6, 353);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$7, 10, 4, 321);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$7, 9, 2, 267);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$7, 7, 0, 210);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div2, anchor);
    			mount_component(sidebar, div2, null);
    			append(div2, t0);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, h1);
    			append(div0, t2);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append(div1, t3);
    			mount_component(footer, div1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.pubs) {
    				each_value = pubs;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) out(i);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div2);
    			}

    			destroy_component(sidebar);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    }

    function func$1(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$8, safe_not_equal, []);
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.9.1 */

    const file$8 = "src/Paper.svelte";

    function create_fragment$9(ctx) {
    	var link, t0, div1, a0, h40, i0, t1, span0, t3, span1, t5, h1, t6_value = ctx.pub.title + "", t6, t7, h3, raw0_value = ctx.pub.authors
          .map(func$2)
          .join(', ') + "", t8, h20, t10, p, t11_value = ctx.pub.abstract + "", t11, t12, h21, t14, a1, h41, t15_value = ctx.pub.title + "", t15, a1_href_value, t16, h50, raw1_value = ctx.pub.authors
          .map(func_1)
          .join(', ') + "", t17, h51, i1, t18_value = ctx.pub.venuelong + "", t18, t19, t20_value = ctx.pub.location + "", t20, t21, t22_value = ctx.pub.year + "", t22, t23, t24, h22, t26, div0, code, t27_value = ctx.pub.bibtex + "", t27, t28, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			div1 = element("div");
    			a0 = element("a");
    			h40 = element("h4");
    			i0 = element("i");
    			t1 = text("\n      Ángel\n      ");
    			span0 = element("span");
    			span0.textContent = "Alex";
    			t3 = text("\n      ander\n      ");
    			span1 = element("span");
    			span1.textContent = "Cabrera";
    			t5 = space();
    			h1 = element("h1");
    			t6 = text(t6_value);
    			t7 = space();
    			h3 = element("h3");
    			t8 = space();
    			h20 = element("h2");
    			h20.textContent = "Abstract";
    			t10 = space();
    			p = element("p");
    			t11 = text(t11_value);
    			t12 = space();
    			h21 = element("h2");
    			h21.textContent = "Citation";
    			t14 = space();
    			a1 = element("a");
    			h41 = element("h4");
    			t15 = text(t15_value);
    			t16 = space();
    			h50 = element("h5");
    			t17 = space();
    			h51 = element("h5");
    			i1 = element("i");
    			t18 = text(t18_value);
    			t19 = text(". ");
    			t20 = text(t20_value);
    			t21 = text(", ");
    			t22 = text(t22_value);
    			t23 = space();
    			links.$$.fragment.c();
    			t24 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t26 = space();
    			div0 = element("div");
    			code = element("code");
    			t27 = text(t27_value);
    			t28 = space();
    			footer.$$.fragment.c();
    			attr(link, "rel", "stylesheet");
    			attr(link, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link, "crossorigin", "anonymous");
    			add_location(link, file$8, 55, 0, 801);
    			attr(i0, "class", "fas fa-home svelte-g8ba2f");
    			attr(i0, "id", "home");
    			add_location(i0, file$8, 64, 6, 1069);
    			attr(span0, "class", "name");
    			add_location(span0, file$8, 66, 6, 1130);
    			attr(span1, "class", "name");
    			add_location(span1, file$8, 68, 6, 1179);
    			attr(h40, "id", "home-link");
    			attr(h40, "class", "svelte-g8ba2f");
    			add_location(h40, file$8, 63, 4, 1043);
    			attr(a0, "href", "/");
    			add_location(a0, file$8, 62, 2, 1026);
    			add_location(h1, file$8, 71, 2, 1232);
    			attr(h3, "class", "svelte-g8ba2f");
    			add_location(h3, file$8, 72, 2, 1255);
    			attr(h20, "class", "sec-title svelte-g8ba2f");
    			add_location(h20, file$8, 78, 2, 1379);
    			attr(p, "class", "svelte-g8ba2f");
    			add_location(p, file$8, 79, 2, 1417);
    			attr(h21, "class", "sec-title svelte-g8ba2f");
    			add_location(h21, file$8, 81, 2, 1442);
    			attr(h41, "class", "svelte-g8ba2f");
    			add_location(h41, file$8, 83, 4, 1535);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$8, 82, 2, 1480);
    			attr(h50, "class", "svelte-g8ba2f");
    			add_location(h50, file$8, 86, 2, 1566);
    			add_location(i1, file$8, 93, 4, 1699);
    			attr(h51, "class", "svelte-g8ba2f");
    			add_location(h51, file$8, 92, 2, 1690);
    			attr(h22, "class", "sec-title svelte-g8ba2f");
    			add_location(h22, file$8, 97, 2, 1779);
    			attr(code, "class", "bibtex");
    			add_location(code, file$8, 99, 4, 1838);
    			attr(div0, "class", "code svelte-g8ba2f");
    			add_location(div0, file$8, 98, 2, 1815);
    			attr(div1, "id", "body");
    			attr(div1, "class", "svelte-g8ba2f");
    			add_location(div1, file$8, 61, 0, 1008);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, link, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			append(div1, a0);
    			append(a0, h40);
    			append(h40, i0);
    			append(h40, t1);
    			append(h40, span0);
    			append(h40, t3);
    			append(h40, span1);
    			append(div1, t5);
    			append(div1, h1);
    			append(h1, t6);
    			append(div1, t7);
    			append(div1, h3);
    			h3.innerHTML = raw0_value;
    			append(div1, t8);
    			append(div1, h20);
    			append(div1, t10);
    			append(div1, p);
    			append(p, t11);
    			append(div1, t12);
    			append(div1, h21);
    			append(div1, t14);
    			append(div1, a1);
    			append(a1, h41);
    			append(h41, t15);
    			append(div1, t16);
    			append(div1, h50);
    			h50.innerHTML = raw1_value;
    			append(div1, t17);
    			append(div1, h51);
    			append(h51, i1);
    			append(i1, t18);
    			append(i1, t19);
    			append(i1, t20);
    			append(i1, t21);
    			append(i1, t22);
    			append(div1, t23);
    			mount_component(links, div1, null);
    			append(div1, t24);
    			append(div1, h22);
    			append(div1, t26);
    			append(div1, div0);
    			append(div0, code);
    			append(code, t27);
    			append(div1, t28);
    			mount_component(footer, div1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var links_changes = {};
    			if (changed.pub) links_changes.pub = ctx.pub;
    			links.$set(links_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(link);
    				detach(t0);
    				detach(div1);
    			}

    			destroy_component(links);

    			destroy_component(footer);
    		}
    	};
    }

    function func$2(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    function func_1(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    function instance$3($$self, $$props, $$invalidate) {
    	
      let { params = {} } = $$props;

      let pub = pubs.find(e => e.id === params.id);

    	const writable_props = ['params'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Paper> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('params' in $$props) $$invalidate('params', params = $$props.params);
    	};

    	return { params, pub };
    }

    class Paper extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$9, safe_not_equal, ["params"]);
    	}

    	get params() {
    		throw new Error("<Paper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Paper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Cv.svelte generated by Svelte v3.9.1 */

    const file$9 = "src/Cv.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (444:6) {#each pubs as pub}
    function create_each_block$3(ctx) {
    	var tr0, th0, t0_value = ctx.pub.year + "", t0, t1, th1, a, h5, t2_value = ctx.pub.title + "", t2, a_href_value, t3, h6, raw_value = ctx.pub.authors
                    .map(func$3)
                    .join(', ') + "", t4, p, i, t5_value = ctx.pub.venuelong + "", t5, t6, t7_value = ctx.pub.location + "", t7, t8, t9_value = ctx.pub.year + "", t9, t10, t11, t12, tr1, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			tr0 = element("tr");
    			th0 = element("th");
    			t0 = text(t0_value);
    			t1 = space();
    			th1 = element("th");
    			a = element("a");
    			h5 = element("h5");
    			t2 = text(t2_value);
    			t3 = space();
    			h6 = element("h6");
    			t4 = space();
    			p = element("p");
    			i = element("i");
    			t5 = text(t5_value);
    			t6 = text(". ");
    			t7 = text(t7_value);
    			t8 = text(", ");
    			t9 = text(t9_value);
    			t10 = text(".");
    			t11 = space();
    			links.$$.fragment.c();
    			t12 = space();
    			tr1 = element("tr");
    			attr(th0, "class", "date svelte-fvqcu8");
    			add_location(th0, file$9, 445, 10, 11086);
    			attr(h5, "class", "svelte-fvqcu8");
    			add_location(h5, file$9, 448, 14, 11211);
    			attr(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			attr(a, "class", "paper-title");
    			add_location(a, file$9, 447, 12, 11146);
    			attr(h6, "class", "svelte-fvqcu8");
    			add_location(h6, file$9, 451, 12, 11262);
    			add_location(i, file$9, 458, 14, 11467);
    			attr(p, "class", "desc svelte-fvqcu8");
    			add_location(p, file$9, 457, 12, 11436);
    			attr(th1, "class", "svelte-fvqcu8");
    			add_location(th1, file$9, 446, 10, 11129);
    			attr(tr0, "class", "item svelte-fvqcu8");
    			add_location(tr0, file$9, 444, 8, 11058);
    			attr(tr1, "class", "buffer svelte-fvqcu8");
    			add_location(tr1, file$9, 464, 8, 11607);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr0, anchor);
    			append(tr0, th0);
    			append(th0, t0);
    			append(tr0, t1);
    			append(tr0, th1);
    			append(th1, a);
    			append(a, h5);
    			append(h5, t2);
    			append(th1, t3);
    			append(th1, h6);
    			h6.innerHTML = raw_value;
    			append(th1, t4);
    			append(th1, p);
    			append(p, i);
    			append(i, t5);
    			append(i, t6);
    			append(i, t7);
    			append(i, t8);
    			append(i, t9);
    			append(i, t10);
    			append(th1, t11);
    			mount_component(links, th1, null);
    			insert(target, t12, anchor);
    			insert(target, tr1, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var links_changes = {};
    			if (changed.pubs) links_changes.pub = ctx.pub;
    			links.$set(links_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(tr0);
    			}

    			destroy_component(links);

    			if (detaching) {
    				detach(t12);
    				detach(tr1);
    			}
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	var link0, t0, link1, t1, div18, main, header, h3, t2, span0, t4, span1, t6, t7, t8, table, tr0, th0, t9, th1, h40, t11, tr1, th2, t12, br0, t13, t14, th3, h50, t16, h60, t18, tr2, t19, tr3, th4, t20, br1, t21, t22, th5, h51, t24, h61, span2, t26, span3, t28, t29, p0, t31, tr4, th6, t33, th7, h62, t35, p1, t37, tr5, th8, t38, th9, h41, t40, tr6, th10, t42, th11, h52, t44, p2, t46, div0, a0, button0, i0, t47, t48, tr7, t49, tr8, th12, t51, th13, h53, t53, p3, t55, div1, a1, button1, i1, t56, t57, tr9, t58, tr10, th14, t59, br2, t60, t61, th15, h54, t63, h63, t65, p4, t67, div2, a2, button2, i2, t68, t69, tr11, t70, tr12, th16, t72, th17, h55, t74, h64, t76, p5, t78, div3, a3, button3, i3, t79, t80, tr13, th18, t81, th19, h42, t83, tr14, th20, t84, br3, t85, t86, th21, h56, t88, h65, t90, p6, t92, div4, a4, button4, i4, t93, t94, button5, t96, button6, t98, button7, t100, button8, t102, tr15, t103, tr16, th22, t104, br4, t105, t106, th23, h57, t108, h66, t110, p7, t112, div5, button9, t114, button10, t116, button11, t118, button12, t120, tr17, t121, tr18, th24, t122, br5, t123, t124, th25, h58, t126, h67, t128, p8, t130, div6, button13, t132, button14, t134, button15, t136, tr19, th26, t137, th27, h43, t139, tr20, th28, t140, br6, t141, t142, th29, h59, t144, h68, t146, p9, t148, div7, a5, button16, i5, t149, t150, tr21, t151, tr22, th30, t152, br7, t153, t154, th31, h510, t156, h69, t158, p10, t160, div8, a6, button17, t162, a7, button18, i6, t163, t164, a8, button19, i7, t165, t166, button20, t168, tr23, th32, t169, th33, h44, t171, t172, tr24, th34, t173, th35, h45, t175, tr25, th36, t177, th37, h511, t179, h610, t181, p11, t183, div9, a9, button21, i8, t184, t185, tr26, t186, tr27, th38, t188, th39, h512, t190, p12, t192, div10, a10, button22, i9, t193, t194, a11, button23, i10, t195, t196, tr28, t197, tr29, th40, t199, th41, h513, t201, p13, t203, div11, a12, button24, i11, t204, t205, a13, button25, i12, t206, t207, tr30, th42, t208, th43, h46, t210, tr31, th44, t212, th45, h514, t214, h611, t216, p14, t218, tr32, t219, tr33, th46, t221, th47, h515, t223, h612, t225, p15, t227, tr34, th48, t228, th49, h47, t230, tr35, th50, t231, th51, h516, t233, tr36, th52, t235, th53, h517, t237, tr37, th54, t239, th55, h518, t241, tr38, th56, t242, th57, h48, t244, tr39, th58, t245, br8, t246, t247, th59, h519, t249, h613, t251, p16, t253, div12, a14, button26, i13, t254, t255, tr40, t256, tr41, th60, t258, th61, h520, t260, p17, t262, div13, a15, button27, i14, t263, t264, tr42, t265, tr43, th62, t266, br9, t267, t268, th63, h521, t270, h614, t272, p18, t274, div14, a16, button28, i15, t275, t276, tr44, th64, t277, th65, h49, t279, tr45, th66, t281, th67, a17, h522, t283, tr46, th68, t285, th69, a18, h523, t287, tr47, th70, t289, th71, h524, t291, tr48, th72, t293, th73, a19, h525, t295, tr49, th74, t297, th75, a20, h526, t299, tr50, th76, t301, th77, h527, t303, tr51, th78, t304, th79, h410, t306, tr52, th80, t307, th81, h528, t309, div15, button29, t311, button30, t313, button31, t315, tr53, t316, tr54, th82, t317, th83, h529, t319, div16, button32, t321, button33, t323, button34, t325, button35, t327, button36, t329, button37, t331, tr55, t332, tr56, th84, t333, th85, h530, t335, div17, button38, t337, button39, t339, button40, t341, button41, t343, button42, t345, button43, t347, button44, t349, button45, t351, tr57, t352, tr58, th86, t353, th87, p19, current;

    	var intro = new Intro({ $$inline: true });

    	var social = new Social({ $$inline: true });

    	var each_value = pubs;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c: function create() {
    			link0 = element("link");
    			t0 = space();
    			link1 = element("link");
    			t1 = space();
    			div18 = element("div");
    			main = element("main");
    			header = element("header");
    			h3 = element("h3");
    			t2 = text("Ángel\n        ");
    			span0 = element("span");
    			span0.textContent = "Alex";
    			t4 = text("\n        ander\n        ");
    			span1 = element("span");
    			span1.textContent = "Cabrera";
    			t6 = space();
    			intro.$$.fragment.c();
    			t7 = space();
    			social.$$.fragment.c();
    			t8 = space();
    			table = element("table");
    			tr0 = element("tr");
    			th0 = element("th");
    			t9 = space();
    			th1 = element("th");
    			h40 = element("h4");
    			h40.textContent = "Education";
    			t11 = space();
    			tr1 = element("tr");
    			th2 = element("th");
    			t12 = text("August 2019\n          ");
    			br0 = element("br");
    			t13 = text("\n          - Present");
    			t14 = space();
    			th3 = element("th");
    			h50 = element("h5");
    			h50.textContent = "PhD in Human-Computer Interaction (HCI)";
    			t16 = space();
    			h60 = element("h6");
    			h60.textContent = "Carnegie Mellon University - Pittsburgh, PA";
    			t18 = space();
    			tr2 = element("tr");
    			t19 = space();
    			tr3 = element("tr");
    			th4 = element("th");
    			t20 = text("August 2015\n          ");
    			br1 = element("br");
    			t21 = text("\n          - May 2019");
    			t22 = space();
    			th5 = element("th");
    			h51 = element("h5");
    			h51.textContent = "B.S. in Computer Science";
    			t24 = space();
    			h61 = element("h6");
    			span2 = element("span");
    			span2.textContent = "Georgia";
    			t26 = text("\n            Institute of\n            ");
    			span3 = element("span");
    			span3.textContent = "Tech";
    			t28 = text("nology - Atlanta, GA");
    			t29 = space();
    			p0 = element("p");
    			p0.textContent = "Concentration in intelligence and modeling/simulation. Minor in\n            economics. Overall GPA: 3.97/4.0";
    			t31 = space();
    			tr4 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Fall 2017";
    			t33 = space();
    			th7 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t35 = space();
    			p1 = element("p");
    			p1.textContent = "Exchange program with a focus on economics and political science.";
    			t37 = space();
    			tr5 = element("tr");
    			th8 = element("th");
    			t38 = space();
    			th9 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Awards";
    			t40 = space();
    			tr6 = element("tr");
    			th10 = element("th");
    			th10.textContent = "May 2019";
    			t42 = space();
    			th11 = element("th");
    			h52 = element("h5");
    			h52.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t44 = space();
    			p2 = element("p");
    			p2.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t46 = space();
    			div0 = element("div");
    			a0 = element("a");
    			button0 = element("button");
    			i0 = element("i");
    			t47 = text("\n                Website");
    			t48 = space();
    			tr7 = element("tr");
    			t49 = space();
    			tr8 = element("tr");
    			th12 = element("th");
    			th12.textContent = "May 2019";
    			t51 = space();
    			th13 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Love Family Foundation Scholarship";
    			t53 = space();
    			p3 = element("p");
    			p3.textContent = "Award for the undergraduate with the most outstanding scholastic\n            record in the graduating class. Co-awarded the $10,000 scholarship.";
    			t55 = space();
    			div1 = element("div");
    			a1 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t56 = text("\n                Announcement");
    			t57 = space();
    			tr9 = element("tr");
    			t58 = space();
    			tr10 = element("tr");
    			th14 = element("th");
    			t59 = text("August 2015\n          ");
    			br2 = element("br");
    			t60 = text("\n          - May 2019");
    			t61 = space();
    			th15 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Stamps President's Scholar";
    			t63 = space();
    			h63 = element("h6");
    			h63.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t65 = space();
    			p4 = element("p");
    			p4.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 students (27,270 applicants).";
    			t67 = space();
    			div2 = element("div");
    			a2 = element("a");
    			button2 = element("button");
    			i2 = element("i");
    			t68 = text("\n                Website");
    			t69 = space();
    			tr11 = element("tr");
    			t70 = space();
    			tr12 = element("tr");
    			th16 = element("th");
    			th16.textContent = "February 3, 2018";
    			t72 = space();
    			th17 = element("th");
    			h55 = element("h5");
    			h55.textContent = "The Data Open Datathon";
    			t74 = space();
    			h64 = element("h6");
    			h64.textContent = "Correlation One and Citadel Securities";
    			t76 = space();
    			p5 = element("p");
    			p5.textContent = "Placed third and won $2,500 for creating a supervised learning\n            system that predicts dangerous road areas.";
    			t78 = space();
    			div3 = element("div");
    			a3 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t79 = text("\n                Press Release");
    			t80 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			t81 = space();
    			th19 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Industry Experience";
    			t83 = space();
    			tr14 = element("tr");
    			th20 = element("th");
    			t84 = text("May 2018\n          ");
    			br3 = element("br");
    			t85 = text("\n          - August 2018");
    			t86 = space();
    			th21 = element("th");
    			h56 = element("h5");
    			h56.textContent = "Google";
    			t88 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t90 = space();
    			p6 = element("p");
    			p6.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t92 = space();
    			div4 = element("div");
    			a4 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t93 = text("\n                WSJ Article");
    			t94 = space();
    			button5 = element("button");
    			button5.textContent = "Android Auto";
    			t96 = space();
    			button6 = element("button");
    			button6.textContent = "Java";
    			t98 = space();
    			button7 = element("button");
    			button7.textContent = "C++";
    			t100 = space();
    			button8 = element("button");
    			button8.textContent = "Protocol Buffers";
    			t102 = space();
    			tr15 = element("tr");
    			t103 = space();
    			tr16 = element("tr");
    			th22 = element("th");
    			t104 = text("May 2017\n          ");
    			br4 = element("br");
    			t105 = text("\n          - August 2017");
    			t106 = space();
    			th23 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Google";
    			t108 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t110 = space();
    			p7 = element("p");
    			p7.textContent = "Designed and implemented an anomaly detection and trend analysis\n            system for Google's primary data processing pipelines.";
    			t112 = space();
    			div5 = element("div");
    			button9 = element("button");
    			button9.textContent = "Apache Beam/Cloud DataFlow";
    			t114 = space();
    			button10 = element("button");
    			button10.textContent = "Java";
    			t116 = space();
    			button11 = element("button");
    			button11.textContent = "C++";
    			t118 = space();
    			button12 = element("button");
    			button12.textContent = "SQL";
    			t120 = space();
    			tr17 = element("tr");
    			t121 = space();
    			tr18 = element("tr");
    			th24 = element("th");
    			t122 = text("May 2016\n          ");
    			br5 = element("br");
    			t123 = text("\n          - August 2016");
    			t124 = space();
    			th25 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Google";
    			t126 = space();
    			h67 = element("h6");
    			h67.textContent = "Engineering Practicum Intern";
    			t128 = space();
    			p8 = element("p");
    			p8.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t130 = space();
    			div6 = element("div");
    			button13 = element("button");
    			button13.textContent = "Go";
    			t132 = space();
    			button14 = element("button");
    			button14.textContent = "BigQuery";
    			t134 = space();
    			button15 = element("button");
    			button15.textContent = "JavaScript";
    			t136 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t137 = space();
    			th27 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Research Experience";
    			t139 = space();
    			tr20 = element("tr");
    			th28 = element("th");
    			t140 = text("January 2018\n          ");
    			br6 = element("br");
    			t141 = text("\n          - Present");
    			t142 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Polo Club of Data Science";
    			t144 = space();
    			h68 = element("h6");
    			h68.textContent = "Undergraduate Researcher";
    			t146 = space();
    			p9 = element("p");
    			p9.textContent = "Applying human computer interaction and visualization techniques to\n            help people understand and design more equitable machine learning\n            models.";
    			t148 = space();
    			div7 = element("div");
    			a5 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t149 = text("\n                Polo Club");
    			t150 = space();
    			tr21 = element("tr");
    			t151 = space();
    			tr22 = element("tr");
    			th30 = element("th");
    			t152 = text("September 2015\n          ");
    			br7 = element("br");
    			t153 = text("\n          - May 2017");
    			t154 = space();
    			th31 = element("th");
    			h510 = element("h5");
    			h510.textContent = "PROX-1 Satellite";
    			t156 = space();
    			h69 = element("h6");
    			h69.textContent = "Flight Software Lead and Researcher";
    			t158 = space();
    			p10 = element("p");
    			p10.textContent = "Led a team of engineers in developing and deploying the software for\n            a fully undergraduate-led satellite mission.";
    			t160 = space();
    			div8 = element("div");
    			a6 = element("a");
    			button17 = element("button");
    			button17.textContent = "In space!";
    			t162 = space();
    			a7 = element("a");
    			button18 = element("button");
    			i6 = element("i");
    			t163 = text("\n                Website");
    			t164 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i7 = element("i");
    			t165 = text("\n                Press release");
    			t166 = space();
    			button20 = element("button");
    			button20.textContent = "C";
    			t168 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t169 = space();
    			th33 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Publications";
    			t171 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t172 = space();
    			tr24 = element("tr");
    			th34 = element("th");
    			t173 = space();
    			th35 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Projects";
    			t175 = space();
    			tr25 = element("tr");
    			th36 = element("th");
    			th36.textContent = "Fall 2018";
    			t177 = space();
    			th37 = element("th");
    			h511 = element("h5");
    			h511.textContent = "ICLR'19 Reproducibility Challenge";
    			t179 = space();
    			h610 = element("h6");
    			h610.textContent = "Generative Adversarial Models For Learning Private And Fair\n            Representations";
    			t181 = space();
    			p11 = element("p");
    			p11.textContent = "Implemented the architecture and reproduced results for an ICLR'19\n            submission using GANs to decorrelate sensitive data.";
    			t183 = space();
    			div9 = element("div");
    			a9 = element("a");
    			button21 = element("button");
    			i8 = element("i");
    			t184 = text("\n                GitHub");
    			t185 = space();
    			tr26 = element("tr");
    			t186 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Spring 2018";
    			t188 = space();
    			th39 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Georgia Tech Bus System Analysis";
    			t190 = space();
    			p12 = element("p");
    			p12.textContent = "System that combines Google Maps and graph algorithms to include\n            Georgia Tech bus routes in navigation.";
    			t192 = space();
    			div10 = element("div");
    			a10 = element("a");
    			button22 = element("button");
    			i9 = element("i");
    			t193 = text("\n                Poster");
    			t194 = space();
    			a11 = element("a");
    			button23 = element("button");
    			i10 = element("i");
    			t195 = text("\n                Class");
    			t196 = space();
    			tr28 = element("tr");
    			t197 = space();
    			tr29 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Spring 2014";
    			t199 = space();
    			th41 = element("th");
    			h513 = element("h5");
    			h513.textContent = "CTF Resources";
    			t201 = space();
    			p13 = element("p");
    			p13.textContent = "Introductory guide and resources for capture the flag (CTF)\n            competitions with over 800 stars on GitHub.";
    			t203 = space();
    			div11 = element("div");
    			a12 = element("a");
    			button24 = element("button");
    			i11 = element("i");
    			t204 = text("\n                Website");
    			t205 = space();
    			a13 = element("a");
    			button25 = element("button");
    			i12 = element("i");
    			t206 = text("\n                GitHub");
    			t207 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			t208 = space();
    			th43 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t210 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			th44.textContent = "Fall 2016, Spring 2017, Spring 2018";
    			t212 = space();
    			th45 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Undergraduate Teaching Assistant";
    			t214 = space();
    			h611 = element("h6");
    			h611.textContent = "CS1332 - Data Structures and Algorithms";
    			t216 = space();
    			p14 = element("p");
    			p14.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t218 = space();
    			tr32 = element("tr");
    			t219 = space();
    			tr33 = element("tr");
    			th46 = element("th");
    			th46.textContent = "Fall 2016";
    			t221 = space();
    			th47 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Team Leader";
    			t223 = space();
    			h612 = element("h6");
    			h612.textContent = "GT 1000 - First-Year Seminar";
    			t225 = space();
    			p15 = element("p");
    			p15.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t227 = space();
    			tr34 = element("tr");
    			th48 = element("th");
    			t228 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t230 = space();
    			tr35 = element("tr");
    			th50 = element("th");
    			t231 = space();
    			th51 = element("th");
    			h516 = element("h5");
    			h516.textContent = "Student Volunteer";
    			t233 = space();
    			tr36 = element("tr");
    			th52 = element("th");
    			th52.textContent = "October 2019";
    			t235 = space();
    			th53 = element("th");
    			h517 = element("h5");
    			h517.textContent = "IEEE Visualization Conference (VIS) 2019";
    			t237 = space();
    			tr37 = element("tr");
    			th54 = element("th");
    			th54.textContent = "January 2019";
    			t239 = space();
    			th55 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Fairness, Accountability, and Transparency (FAT*) 2019";
    			t241 = space();
    			tr38 = element("tr");
    			th56 = element("th");
    			t242 = space();
    			th57 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Campus Involvement";
    			t244 = space();
    			tr39 = element("tr");
    			th58 = element("th");
    			t245 = text("September 2015\n          ");
    			br8 = element("br");
    			t246 = text("\n          - April 2017");
    			t247 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "Stamps Scholars National Convention 2017";
    			t249 = space();
    			h613 = element("h6");
    			h613.textContent = "Vice-chair of large events";
    			t251 = space();
    			p16 = element("p");
    			p16.textContent = "Directed a 13 person committee in organizing hotels, meals, and\n            presentations for over 700 students.";
    			t253 = space();
    			div12 = element("div");
    			a14 = element("a");
    			button26 = element("button");
    			i13 = element("i");
    			t254 = text("\n                Website");
    			t255 = space();
    			tr40 = element("tr");
    			t256 = space();
    			tr41 = element("tr");
    			th60 = element("th");
    			th60.textContent = "Spring 2016";
    			t258 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "Tour Guide";
    			t260 = space();
    			p17 = element("p");
    			p17.textContent = "Led a tour of campus for visiting families every week.";
    			t262 = space();
    			div13 = element("div");
    			a15 = element("a");
    			button27 = element("button");
    			i14 = element("i");
    			t263 = text("\n                Website");
    			t264 = space();
    			tr42 = element("tr");
    			t265 = space();
    			tr43 = element("tr");
    			th62 = element("th");
    			t266 = text("September 2015\n          ");
    			br9 = element("br");
    			t267 = text("\n          - May 2016");
    			t268 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "Georgia Tech Student Foundation";
    			t270 = space();
    			h614 = element("h6");
    			h614.textContent = "Investments committee and Freshman Leadership Initiative";
    			t272 = space();
    			p18 = element("p");
    			p18.textContent = "Conducted market research to help manage a $1.2 million endowment\n            and organized fundraising events.";
    			t274 = space();
    			div14 = element("div");
    			a16 = element("a");
    			button28 = element("button");
    			i15 = element("i");
    			t275 = text("\n                Website");
    			t276 = space();
    			tr44 = element("tr");
    			th64 = element("th");
    			t277 = space();
    			th65 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Selected Classes";
    			t279 = space();
    			tr45 = element("tr");
    			th66 = element("th");
    			th66.textContent = "Fall 2018";
    			t281 = space();
    			th67 = element("th");
    			a17 = element("a");
    			h522 = element("h5");
    			h522.textContent = "CS 4803/7643 - Deep Learning";
    			t283 = space();
    			tr46 = element("tr");
    			th68 = element("th");
    			th68.textContent = "Spring 2018";
    			t285 = space();
    			th69 = element("th");
    			a18 = element("a");
    			h523 = element("h5");
    			h523.textContent = "CX 4242/CSE 6242 - Data and Visual Analytics";
    			t287 = space();
    			tr47 = element("tr");
    			th70 = element("th");
    			th70.textContent = "Fall 2017";
    			t289 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			h524.textContent = "BECO 1750A - Money and Banking";
    			t291 = space();
    			tr48 = element("tr");
    			th72 = element("th");
    			th72.textContent = "Spring 2017";
    			t293 = space();
    			th73 = element("th");
    			a19 = element("a");
    			h525 = element("h5");
    			h525.textContent = "CS 4641/7641 - Machine Learning";
    			t295 = space();
    			tr49 = element("tr");
    			th74 = element("th");
    			th74.textContent = "Spring 2017";
    			t297 = space();
    			th75 = element("th");
    			a20 = element("a");
    			h526 = element("h5");
    			h526.textContent = "CX 4230 - Computer Simulation";
    			t299 = space();
    			tr50 = element("tr");
    			th76 = element("th");
    			th76.textContent = "Spring 2017";
    			t301 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			h527.textContent = "CS 3511 - Honors Algorithms";
    			t303 = space();
    			tr51 = element("tr");
    			th78 = element("th");
    			t304 = space();
    			th79 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Skills";
    			t306 = space();
    			tr52 = element("tr");
    			th80 = element("th");
    			t307 = space();
    			th81 = element("th");
    			h528 = element("h5");
    			h528.textContent = "Languages";
    			t309 = space();
    			div15 = element("div");
    			button29 = element("button");
    			button29.textContent = "English - Native";
    			t311 = space();
    			button30 = element("button");
    			button30.textContent = "Spanish - Native";
    			t313 = space();
    			button31 = element("button");
    			button31.textContent = "French - Conversational (B1)";
    			t315 = space();
    			tr53 = element("tr");
    			t316 = space();
    			tr54 = element("tr");
    			th82 = element("th");
    			t317 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "Programming Languages";
    			t319 = space();
    			div16 = element("div");
    			button32 = element("button");
    			button32.textContent = "Java";
    			t321 = space();
    			button33 = element("button");
    			button33.textContent = "Javascript";
    			t323 = space();
    			button34 = element("button");
    			button34.textContent = "Python";
    			t325 = space();
    			button35 = element("button");
    			button35.textContent = "C/C++";
    			t327 = space();
    			button36 = element("button");
    			button36.textContent = "SQL";
    			t329 = space();
    			button37 = element("button");
    			button37.textContent = "Go";
    			t331 = space();
    			tr55 = element("tr");
    			t332 = space();
    			tr56 = element("tr");
    			th84 = element("th");
    			t333 = space();
    			th85 = element("th");
    			h530 = element("h5");
    			h530.textContent = "Technologies";
    			t335 = space();
    			div17 = element("div");
    			button38 = element("button");
    			button38.textContent = "Machine Learning";
    			t337 = space();
    			button39 = element("button");
    			button39.textContent = "Full Stack Development";
    			t339 = space();
    			button40 = element("button");
    			button40.textContent = "React";
    			t341 = space();
    			button41 = element("button");
    			button41.textContent = "Svelte";
    			t343 = space();
    			button42 = element("button");
    			button42.textContent = "Vega";
    			t345 = space();
    			button43 = element("button");
    			button43.textContent = "D3";
    			t347 = space();
    			button44 = element("button");
    			button44.textContent = "PyTorch";
    			t349 = space();
    			button45 = element("button");
    			button45.textContent = "Cloud Dataflow/MapReduce";
    			t351 = space();
    			tr57 = element("tr");
    			t352 = space();
    			tr58 = element("tr");
    			th86 = element("th");
    			t353 = space();
    			th87 = element("th");
    			p19 = element("p");
    			p19.textContent = "Last updated September 3, 2019.";
    			attr(link0, "href", "https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:900,400");
    			attr(link0, "rel", "stylesheet");
    			add_location(link0, file$9, 126, 0, 1782);
    			attr(link1, "rel", "stylesheet");
    			attr(link1, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link1, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link1, "crossorigin", "anonymous");
    			add_location(link1, file$9, 129, 0, 1888);
    			attr(span0, "class", "red svelte-fvqcu8");
    			add_location(span0, file$9, 140, 8, 2191);
    			attr(span1, "class", "red svelte-fvqcu8");
    			add_location(span1, file$9, 142, 8, 2243);
    			attr(h3, "id", "name");
    			attr(h3, "class", "svelte-fvqcu8");
    			add_location(h3, file$9, 138, 6, 2154);
    			attr(header, "id", "head");
    			attr(header, "class", "svelte-fvqcu8");
    			add_location(header, file$9, 137, 4, 2129);
    			attr(th0, "class", "date svelte-fvqcu8");
    			add_location(th0, file$9, 152, 8, 2393);
    			attr(h40, "class", "header svelte-fvqcu8");
    			add_location(h40, file$9, 154, 10, 2436);
    			attr(th1, "class", "svelte-fvqcu8");
    			add_location(th1, file$9, 153, 8, 2421);
    			add_location(tr0, file$9, 151, 6, 2380);
    			add_location(br0, file$9, 160, 10, 2578);
    			attr(th2, "class", "date svelte-fvqcu8");
    			add_location(th2, file$9, 158, 8, 2528);
    			attr(h50, "class", "svelte-fvqcu8");
    			add_location(h50, file$9, 164, 10, 2642);
    			attr(h60, "class", "svelte-fvqcu8");
    			add_location(h60, file$9, 165, 10, 2701);
    			attr(th3, "class", "svelte-fvqcu8");
    			add_location(th3, file$9, 163, 8, 2627);
    			attr(tr1, "class", "item svelte-fvqcu8");
    			add_location(tr1, file$9, 157, 6, 2502);
    			attr(tr2, "class", "buffer svelte-fvqcu8");
    			add_location(tr2, file$9, 168, 6, 2786);
    			add_location(br1, file$9, 172, 10, 2890);
    			attr(th4, "class", "date svelte-fvqcu8");
    			add_location(th4, file$9, 170, 8, 2840);
    			attr(h51, "class", "svelte-fvqcu8");
    			add_location(h51, file$9, 176, 10, 2955);
    			attr(span2, "class", "gold svelte-fvqcu8");
    			add_location(span2, file$9, 178, 12, 3016);
    			attr(span3, "class", "gold svelte-fvqcu8");
    			add_location(span3, file$9, 180, 12, 3087);
    			attr(h61, "class", "svelte-fvqcu8");
    			add_location(h61, file$9, 177, 10, 2999);
    			attr(p0, "class", "desc svelte-fvqcu8");
    			add_location(p0, file$9, 182, 10, 3164);
    			attr(th5, "class", "svelte-fvqcu8");
    			add_location(th5, file$9, 175, 8, 2940);
    			attr(tr3, "class", "item svelte-fvqcu8");
    			add_location(tr3, file$9, 169, 6, 2814);
    			attr(th6, "class", "date svelte-fvqcu8");
    			add_location(th6, file$9, 189, 8, 3375);
    			attr(h62, "class", "svelte-fvqcu8");
    			add_location(h62, file$9, 191, 10, 3430);
    			attr(p1, "class", "desc svelte-fvqcu8");
    			add_location(p1, file$9, 192, 10, 3477);
    			attr(th7, "class", "svelte-fvqcu8");
    			add_location(th7, file$9, 190, 8, 3415);
    			attr(tr4, "class", "item svelte-fvqcu8");
    			add_location(tr4, file$9, 188, 6, 3349);
    			attr(th8, "class", "date svelte-fvqcu8");
    			add_location(th8, file$9, 199, 8, 3654);
    			attr(h41, "class", "header svelte-fvqcu8");
    			add_location(h41, file$9, 201, 10, 3697);
    			attr(th9, "class", "svelte-fvqcu8");
    			add_location(th9, file$9, 200, 8, 3682);
    			add_location(tr5, file$9, 198, 6, 3641);
    			attr(th10, "class", "date svelte-fvqcu8");
    			add_location(th10, file$9, 205, 8, 3786);
    			attr(h52, "class", "svelte-fvqcu8");
    			add_location(h52, file$9, 207, 10, 3840);
    			attr(p2, "class", "desc svelte-fvqcu8");
    			add_location(p2, file$9, 210, 10, 3951);
    			attr(i0, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i0, file$9, 217, 16, 4228);
    			add_location(button0, file$9, 216, 14, 4203);
    			attr(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 215, 12, 4153);
    			attr(div0, "class", "tags svelte-fvqcu8");
    			add_location(div0, file$9, 214, 10, 4122);
    			attr(th11, "class", "svelte-fvqcu8");
    			add_location(th11, file$9, 206, 8, 3825);
    			attr(tr6, "class", "item svelte-fvqcu8");
    			add_location(tr6, file$9, 204, 6, 3760);
    			attr(tr7, "class", "buffer svelte-fvqcu8");
    			add_location(tr7, file$9, 224, 6, 4369);
    			attr(th12, "class", "date svelte-fvqcu8");
    			add_location(th12, file$9, 226, 8, 4423);
    			attr(h53, "class", "svelte-fvqcu8");
    			add_location(h53, file$9, 228, 10, 4477);
    			attr(p3, "class", "desc svelte-fvqcu8");
    			add_location(p3, file$9, 229, 10, 4531);
    			attr(i1, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i1, file$9, 237, 16, 4943);
    			add_location(button1, file$9, 236, 14, 4918);
    			attr(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 234, 12, 4761);
    			attr(div1, "class", "tags svelte-fvqcu8");
    			add_location(div1, file$9, 233, 10, 4730);
    			attr(th13, "class", "svelte-fvqcu8");
    			add_location(th13, file$9, 227, 8, 4462);
    			attr(tr8, "class", "item svelte-fvqcu8");
    			add_location(tr8, file$9, 225, 6, 4397);
    			attr(tr9, "class", "buffer svelte-fvqcu8");
    			add_location(tr9, file$9, 244, 6, 5089);
    			add_location(br2, file$9, 248, 10, 5193);
    			attr(th14, "class", "date svelte-fvqcu8");
    			add_location(th14, file$9, 246, 8, 5143);
    			attr(h54, "class", "svelte-fvqcu8");
    			add_location(h54, file$9, 252, 10, 5258);
    			attr(h63, "class", "svelte-fvqcu8");
    			add_location(h63, file$9, 253, 10, 5304);
    			attr(p4, "class", "desc svelte-fvqcu8");
    			add_location(p4, file$9, 254, 10, 5380);
    			attr(i2, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i2, file$9, 261, 16, 5662);
    			add_location(button2, file$9, 260, 14, 5637);
    			attr(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 259, 12, 5583);
    			attr(div2, "class", "tags svelte-fvqcu8");
    			add_location(div2, file$9, 258, 10, 5552);
    			attr(th15, "class", "svelte-fvqcu8");
    			add_location(th15, file$9, 251, 8, 5243);
    			attr(tr10, "class", "item svelte-fvqcu8");
    			add_location(tr10, file$9, 245, 6, 5117);
    			attr(tr11, "class", "buffer svelte-fvqcu8");
    			add_location(tr11, file$9, 268, 6, 5803);
    			attr(th16, "class", "date svelte-fvqcu8");
    			add_location(th16, file$9, 270, 8, 5857);
    			attr(h55, "class", "svelte-fvqcu8");
    			add_location(h55, file$9, 272, 10, 5919);
    			attr(h64, "class", "svelte-fvqcu8");
    			add_location(h64, file$9, 273, 10, 5961);
    			attr(p5, "class", "desc svelte-fvqcu8");
    			add_location(p5, file$9, 274, 10, 6019);
    			attr(i3, "class", "far fa-newspaper svelte-fvqcu8");
    			add_location(i3, file$9, 282, 16, 6390);
    			add_location(button3, file$9, 281, 14, 6365);
    			attr(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 279, 12, 6222);
    			attr(div3, "class", "tags svelte-fvqcu8");
    			add_location(div3, file$9, 278, 10, 6191);
    			attr(th17, "class", "svelte-fvqcu8");
    			add_location(th17, file$9, 271, 8, 5904);
    			attr(tr12, "class", "item svelte-fvqcu8");
    			add_location(tr12, file$9, 269, 6, 5831);
    			attr(th18, "class", "date svelte-fvqcu8");
    			add_location(th18, file$9, 291, 8, 6578);
    			attr(h42, "class", "header svelte-fvqcu8");
    			add_location(h42, file$9, 293, 10, 6621);
    			attr(th19, "class", "svelte-fvqcu8");
    			add_location(th19, file$9, 292, 8, 6606);
    			add_location(tr13, file$9, 290, 6, 6565);
    			add_location(br3, file$9, 299, 10, 6770);
    			attr(th20, "class", "date svelte-fvqcu8");
    			add_location(th20, file$9, 297, 8, 6723);
    			attr(h56, "class", "svelte-fvqcu8");
    			add_location(h56, file$9, 303, 10, 6838);
    			attr(h65, "class", "svelte-fvqcu8");
    			add_location(h65, file$9, 304, 10, 6864);
    			attr(p6, "class", "desc svelte-fvqcu8");
    			add_location(p6, file$9, 305, 10, 6911);
    			attr(i4, "class", "far fa-newspaper svelte-fvqcu8");
    			add_location(i4, file$9, 315, 16, 7337);
    			add_location(button4, file$9, 314, 14, 7312);
    			attr(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$9, 311, 12, 7174);
    			add_location(button5, file$9, 319, 12, 7449);
    			add_location(button6, file$9, 320, 12, 7491);
    			add_location(button7, file$9, 321, 12, 7525);
    			add_location(button8, file$9, 322, 12, 7558);
    			attr(div4, "class", "tags svelte-fvqcu8");
    			add_location(div4, file$9, 310, 10, 7143);
    			attr(th21, "class", "svelte-fvqcu8");
    			add_location(th21, file$9, 302, 8, 6823);
    			attr(tr14, "class", "item svelte-fvqcu8");
    			add_location(tr14, file$9, 296, 6, 6697);
    			attr(tr15, "class", "buffer svelte-fvqcu8");
    			add_location(tr15, file$9, 326, 6, 7641);
    			add_location(br4, file$9, 330, 10, 7742);
    			attr(th22, "class", "date svelte-fvqcu8");
    			add_location(th22, file$9, 328, 8, 7695);
    			attr(h57, "class", "svelte-fvqcu8");
    			add_location(h57, file$9, 334, 10, 7810);
    			attr(h66, "class", "svelte-fvqcu8");
    			add_location(h66, file$9, 335, 10, 7836);
    			attr(p7, "class", "desc svelte-fvqcu8");
    			add_location(p7, file$9, 336, 10, 7883);
    			add_location(button9, file$9, 341, 12, 8100);
    			add_location(button10, file$9, 342, 12, 8156);
    			add_location(button11, file$9, 343, 12, 8190);
    			add_location(button12, file$9, 344, 12, 8223);
    			attr(div5, "class", "tags svelte-fvqcu8");
    			add_location(div5, file$9, 340, 10, 8069);
    			attr(th23, "class", "svelte-fvqcu8");
    			add_location(th23, file$9, 333, 8, 7795);
    			attr(tr16, "class", "item svelte-fvqcu8");
    			add_location(tr16, file$9, 327, 6, 7669);
    			attr(tr17, "class", "buffer svelte-fvqcu8");
    			add_location(tr17, file$9, 348, 6, 8293);
    			add_location(br5, file$9, 352, 10, 8394);
    			attr(th24, "class", "date svelte-fvqcu8");
    			add_location(th24, file$9, 350, 8, 8347);
    			attr(h58, "class", "svelte-fvqcu8");
    			add_location(h58, file$9, 356, 10, 8462);
    			attr(h67, "class", "svelte-fvqcu8");
    			add_location(h67, file$9, 357, 10, 8488);
    			attr(p8, "class", "desc svelte-fvqcu8");
    			add_location(p8, file$9, 358, 10, 8536);
    			add_location(button13, file$9, 363, 12, 8721);
    			add_location(button14, file$9, 364, 12, 8753);
    			add_location(button15, file$9, 365, 12, 8791);
    			attr(div6, "class", "tags svelte-fvqcu8");
    			add_location(div6, file$9, 362, 10, 8690);
    			attr(th25, "class", "svelte-fvqcu8");
    			add_location(th25, file$9, 355, 8, 8447);
    			attr(tr18, "class", "item svelte-fvqcu8");
    			add_location(tr18, file$9, 349, 6, 8321);
    			attr(th26, "class", "date svelte-fvqcu8");
    			add_location(th26, file$9, 371, 8, 8905);
    			attr(h43, "class", "header svelte-fvqcu8");
    			add_location(h43, file$9, 373, 10, 8948);
    			attr(th27, "class", "svelte-fvqcu8");
    			add_location(th27, file$9, 372, 8, 8933);
    			add_location(tr19, file$9, 370, 6, 8892);
    			add_location(br6, file$9, 379, 10, 9101);
    			attr(th28, "class", "date svelte-fvqcu8");
    			add_location(th28, file$9, 377, 8, 9050);
    			attr(h59, "class", "svelte-fvqcu8");
    			add_location(h59, file$9, 383, 10, 9165);
    			attr(h68, "class", "svelte-fvqcu8");
    			add_location(h68, file$9, 384, 10, 9210);
    			attr(p9, "class", "desc svelte-fvqcu8");
    			add_location(p9, file$9, 385, 10, 9254);
    			attr(i5, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i5, file$9, 393, 16, 9583);
    			add_location(button16, file$9, 392, 14, 9558);
    			attr(a5, "href", "https://poloclub.github.io/");
    			add_location(a5, file$9, 391, 12, 9505);
    			attr(div7, "class", "tags svelte-fvqcu8");
    			add_location(div7, file$9, 390, 10, 9474);
    			attr(th29, "class", "svelte-fvqcu8");
    			add_location(th29, file$9, 382, 8, 9150);
    			attr(tr20, "class", "item svelte-fvqcu8");
    			add_location(tr20, file$9, 376, 6, 9024);
    			attr(tr21, "class", "buffer svelte-fvqcu8");
    			add_location(tr21, file$9, 400, 6, 9726);
    			add_location(br7, file$9, 404, 10, 9833);
    			attr(th30, "class", "date svelte-fvqcu8");
    			add_location(th30, file$9, 402, 8, 9780);
    			attr(h510, "class", "svelte-fvqcu8");
    			add_location(h510, file$9, 408, 10, 9898);
    			attr(h69, "class", "svelte-fvqcu8");
    			add_location(h69, file$9, 409, 10, 9934);
    			attr(p10, "class", "desc svelte-fvqcu8");
    			add_location(p10, file$9, 410, 10, 9989);
    			add_location(button17, file$9, 417, 14, 10329);
    			attr(a6, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a6, file$9, 415, 12, 10200);
    			attr(i6, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i6, file$9, 421, 16, 10461);
    			add_location(button18, file$9, 420, 14, 10436);
    			attr(a7, "href", "http://prox-1.gatech.edu/");
    			add_location(a7, file$9, 419, 12, 10385);
    			attr(i7, "class", "far fa-newspaper svelte-fvqcu8");
    			add_location(i7, file$9, 428, 16, 10695);
    			add_location(button19, file$9, 427, 14, 10670);
    			attr(a8, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a8, file$9, 425, 12, 10565);
    			add_location(button20, file$9, 432, 12, 10809);
    			attr(div8, "class", "tags svelte-fvqcu8");
    			add_location(div8, file$9, 414, 10, 10169);
    			attr(th31, "class", "svelte-fvqcu8");
    			add_location(th31, file$9, 407, 8, 9883);
    			attr(tr22, "class", "item svelte-fvqcu8");
    			add_location(tr22, file$9, 401, 6, 9754);
    			attr(th32, "class", "date svelte-fvqcu8");
    			add_location(th32, file$9, 438, 8, 10918);
    			attr(h44, "class", "header svelte-fvqcu8");
    			add_location(h44, file$9, 440, 10, 10961);
    			attr(th33, "class", "svelte-fvqcu8");
    			add_location(th33, file$9, 439, 8, 10946);
    			add_location(tr23, file$9, 437, 6, 10905);
    			attr(th34, "class", "date svelte-fvqcu8");
    			add_location(th34, file$9, 468, 8, 11686);
    			attr(h45, "class", "header svelte-fvqcu8");
    			add_location(h45, file$9, 470, 10, 11729);
    			attr(th35, "class", "svelte-fvqcu8");
    			add_location(th35, file$9, 469, 8, 11714);
    			add_location(tr24, file$9, 467, 6, 11673);
    			attr(th36, "class", "date svelte-fvqcu8");
    			add_location(th36, file$9, 474, 8, 11820);
    			attr(h511, "class", "svelte-fvqcu8");
    			add_location(h511, file$9, 476, 10, 11875);
    			attr(h610, "class", "svelte-fvqcu8");
    			add_location(h610, file$9, 477, 10, 11928);
    			attr(p11, "class", "desc svelte-fvqcu8");
    			add_location(p11, file$9, 481, 10, 12059);
    			attr(i8, "class", "fab fa-github svelte-fvqcu8");
    			add_location(i8, file$9, 488, 16, 12374);
    			add_location(button21, file$9, 487, 14, 12349);
    			attr(a9, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a9, file$9, 486, 12, 12276);
    			attr(div9, "class", "tags svelte-fvqcu8");
    			add_location(div9, file$9, 485, 10, 12245);
    			attr(th37, "class", "svelte-fvqcu8");
    			add_location(th37, file$9, 475, 8, 11860);
    			attr(tr25, "class", "item svelte-fvqcu8");
    			add_location(tr25, file$9, 473, 6, 11794);
    			attr(tr26, "class", "buffer svelte-fvqcu8");
    			add_location(tr26, file$9, 495, 6, 12515);
    			attr(th38, "class", "date svelte-fvqcu8");
    			add_location(th38, file$9, 497, 8, 12569);
    			attr(h512, "class", "svelte-fvqcu8");
    			add_location(h512, file$9, 499, 10, 12626);
    			attr(p12, "class", "desc svelte-fvqcu8");
    			add_location(p12, file$9, 500, 10, 12678);
    			attr(i9, "class", "fas fa-file-pdf svelte-fvqcu8");
    			add_location(i9, file$9, 507, 16, 12951);
    			add_location(button22, file$9, 506, 14, 12926);
    			attr(a10, "href", "./gt_bus_analysis.pdf");
    			add_location(a10, file$9, 505, 12, 12879);
    			attr(i10, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i10, file$9, 513, 16, 13154);
    			add_location(button23, file$9, 512, 14, 13129);
    			attr(a11, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a11, file$9, 511, 12, 13057);
    			attr(div10, "class", "tags svelte-fvqcu8");
    			add_location(div10, file$9, 504, 10, 12848);
    			attr(th39, "class", "svelte-fvqcu8");
    			add_location(th39, file$9, 498, 8, 12611);
    			attr(tr27, "class", "item svelte-fvqcu8");
    			add_location(tr27, file$9, 496, 6, 12543);
    			attr(tr28, "class", "buffer svelte-fvqcu8");
    			add_location(tr28, file$9, 520, 6, 13293);
    			attr(th40, "class", "date svelte-fvqcu8");
    			add_location(th40, file$9, 522, 8, 13347);
    			attr(h513, "class", "svelte-fvqcu8");
    			add_location(h513, file$9, 524, 10, 13404);
    			attr(p13, "class", "desc svelte-fvqcu8");
    			add_location(p13, file$9, 525, 10, 13437);
    			attr(i11, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i11, file$9, 532, 16, 13721);
    			add_location(button24, file$9, 531, 14, 13696);
    			attr(a12, "href", "http://ctfs.github.io/resources/");
    			add_location(a12, file$9, 530, 12, 13638);
    			attr(i12, "class", "fab fa-github svelte-fvqcu8");
    			add_location(i12, file$9, 538, 16, 13909);
    			add_location(button25, file$9, 537, 14, 13884);
    			attr(a13, "href", "https://github.com/ctfs/resources");
    			add_location(a13, file$9, 536, 12, 13825);
    			attr(div11, "class", "tags svelte-fvqcu8");
    			add_location(div11, file$9, 529, 10, 13607);
    			attr(th41, "class", "svelte-fvqcu8");
    			add_location(th41, file$9, 523, 8, 13389);
    			attr(tr29, "class", "item svelte-fvqcu8");
    			add_location(tr29, file$9, 521, 6, 13321);
    			attr(th42, "class", "date svelte-fvqcu8");
    			add_location(th42, file$9, 547, 8, 14087);
    			attr(h46, "class", "header svelte-fvqcu8");
    			add_location(h46, file$9, 549, 10, 14130);
    			attr(th43, "class", "svelte-fvqcu8");
    			add_location(th43, file$9, 548, 8, 14115);
    			add_location(tr30, file$9, 546, 6, 14074);
    			attr(th44, "class", "date svelte-fvqcu8");
    			add_location(th44, file$9, 553, 8, 14221);
    			attr(h514, "class", "svelte-fvqcu8");
    			add_location(h514, file$9, 555, 10, 14302);
    			attr(h611, "class", "svelte-fvqcu8");
    			add_location(h611, file$9, 556, 10, 14354);
    			attr(p14, "class", "desc svelte-fvqcu8");
    			add_location(p14, file$9, 557, 10, 14413);
    			attr(th45, "class", "svelte-fvqcu8");
    			add_location(th45, file$9, 554, 8, 14287);
    			attr(tr31, "class", "item svelte-fvqcu8");
    			add_location(tr31, file$9, 552, 6, 14195);
    			attr(tr32, "class", "buffer svelte-fvqcu8");
    			add_location(tr32, file$9, 563, 6, 14598);
    			attr(th46, "class", "date svelte-fvqcu8");
    			add_location(th46, file$9, 565, 8, 14652);
    			attr(h515, "class", "svelte-fvqcu8");
    			add_location(h515, file$9, 567, 10, 14707);
    			attr(h612, "class", "svelte-fvqcu8");
    			add_location(h612, file$9, 568, 10, 14738);
    			attr(p15, "class", "desc svelte-fvqcu8");
    			add_location(p15, file$9, 569, 10, 14786);
    			attr(th47, "class", "svelte-fvqcu8");
    			add_location(th47, file$9, 566, 8, 14692);
    			attr(tr33, "class", "item svelte-fvqcu8");
    			add_location(tr33, file$9, 564, 6, 14626);
    			attr(th48, "class", "date svelte-fvqcu8");
    			add_location(th48, file$9, 577, 8, 15003);
    			attr(h47, "class", "header svelte-fvqcu8");
    			add_location(h47, file$9, 579, 10, 15046);
    			attr(th49, "class", "svelte-fvqcu8");
    			add_location(th49, file$9, 578, 8, 15031);
    			add_location(tr34, file$9, 576, 6, 14990);
    			attr(th50, "class", "date svelte-fvqcu8");
    			add_location(th50, file$9, 583, 8, 15136);
    			attr(h516, "class", "svelte-fvqcu8");
    			add_location(h516, file$9, 585, 10, 15179);
    			attr(th51, "class", "svelte-fvqcu8");
    			add_location(th51, file$9, 584, 8, 15164);
    			attr(tr35, "class", "item svelte-fvqcu8");
    			add_location(tr35, file$9, 582, 6, 15110);
    			attr(th52, "class", "date svelte-fvqcu8");
    			add_location(th52, file$9, 589, 8, 15251);
    			attr(h517, "class", "single svelte-fvqcu8");
    			add_location(h517, file$9, 591, 10, 15309);
    			attr(th53, "class", "svelte-fvqcu8");
    			add_location(th53, file$9, 590, 8, 15294);
    			add_location(tr36, file$9, 588, 6, 15238);
    			attr(th54, "class", "date svelte-fvqcu8");
    			add_location(th54, file$9, 595, 8, 15419);
    			attr(h518, "class", "single svelte-fvqcu8");
    			add_location(h518, file$9, 597, 10, 15477);
    			attr(th55, "class", "svelte-fvqcu8");
    			add_location(th55, file$9, 596, 8, 15462);
    			add_location(tr37, file$9, 594, 6, 15406);
    			attr(th56, "class", "date svelte-fvqcu8");
    			add_location(th56, file$9, 604, 8, 15659);
    			attr(h48, "class", "header svelte-fvqcu8");
    			add_location(h48, file$9, 606, 10, 15702);
    			attr(th57, "class", "svelte-fvqcu8");
    			add_location(th57, file$9, 605, 8, 15687);
    			add_location(tr38, file$9, 603, 6, 15646);
    			add_location(br8, file$9, 612, 10, 15856);
    			attr(th58, "class", "date svelte-fvqcu8");
    			add_location(th58, file$9, 610, 8, 15803);
    			attr(h519, "class", "svelte-fvqcu8");
    			add_location(h519, file$9, 616, 10, 15923);
    			attr(h613, "class", "svelte-fvqcu8");
    			add_location(h613, file$9, 617, 10, 15983);
    			attr(p16, "class", "desc svelte-fvqcu8");
    			add_location(p16, file$9, 618, 10, 16029);
    			attr(i13, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i13, file$9, 625, 16, 16311);
    			add_location(button26, file$9, 624, 14, 16286);
    			attr(a14, "href", "http://ssnc.stampsfoundation.org/");
    			add_location(a14, file$9, 623, 12, 16227);
    			attr(div12, "class", "tags svelte-fvqcu8");
    			add_location(div12, file$9, 622, 10, 16196);
    			attr(th59, "class", "svelte-fvqcu8");
    			add_location(th59, file$9, 615, 8, 15908);
    			attr(tr39, "class", "item svelte-fvqcu8");
    			add_location(tr39, file$9, 609, 6, 15777);
    			attr(tr40, "class", "buffer svelte-fvqcu8");
    			add_location(tr40, file$9, 632, 6, 16452);
    			attr(th60, "class", "date svelte-fvqcu8");
    			add_location(th60, file$9, 634, 8, 16506);
    			attr(h520, "class", "svelte-fvqcu8");
    			add_location(h520, file$9, 636, 10, 16563);
    			attr(p17, "class", "desc svelte-fvqcu8");
    			add_location(p17, file$9, 637, 10, 16593);
    			attr(i14, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i14, file$9, 643, 16, 16819);
    			add_location(button27, file$9, 642, 14, 16794);
    			attr(a15, "href", "http://admission.gatech.edu/gttours");
    			add_location(a15, file$9, 641, 12, 16733);
    			attr(div13, "class", "tags svelte-fvqcu8");
    			add_location(div13, file$9, 640, 10, 16702);
    			attr(th61, "class", "svelte-fvqcu8");
    			add_location(th61, file$9, 635, 8, 16548);
    			attr(tr41, "class", "item svelte-fvqcu8");
    			add_location(tr41, file$9, 633, 6, 16480);
    			attr(tr42, "class", "buffer svelte-fvqcu8");
    			add_location(tr42, file$9, 650, 6, 16960);
    			add_location(br9, file$9, 654, 10, 17067);
    			attr(th62, "class", "date svelte-fvqcu8");
    			add_location(th62, file$9, 652, 8, 17014);
    			attr(h521, "class", "svelte-fvqcu8");
    			add_location(h521, file$9, 658, 10, 17132);
    			attr(h614, "class", "svelte-fvqcu8");
    			add_location(h614, file$9, 659, 10, 17183);
    			attr(p18, "class", "desc svelte-fvqcu8");
    			add_location(p18, file$9, 660, 10, 17259);
    			attr(i15, "class", "fas fa-globe svelte-fvqcu8");
    			add_location(i15, file$9, 668, 16, 17590);
    			add_location(button28, file$9, 667, 14, 17565);
    			attr(a16, "href", "http://www.gtsf.gatech.edu/s/1481/alumni/17/home.aspx?sid=1481&gid=42");
    			add_location(a16, file$9, 665, 12, 17456);
    			attr(div14, "class", "tags svelte-fvqcu8");
    			add_location(div14, file$9, 664, 10, 17425);
    			attr(th63, "class", "svelte-fvqcu8");
    			add_location(th63, file$9, 657, 8, 17117);
    			attr(tr43, "class", "item svelte-fvqcu8");
    			add_location(tr43, file$9, 651, 6, 16988);
    			attr(th64, "class", "date svelte-fvqcu8");
    			add_location(th64, file$9, 677, 8, 17774);
    			attr(h49, "class", "header svelte-fvqcu8");
    			add_location(h49, file$9, 679, 10, 17817);
    			attr(th65, "class", "svelte-fvqcu8");
    			add_location(th65, file$9, 678, 8, 17802);
    			add_location(tr44, file$9, 676, 6, 17761);
    			attr(th66, "class", "date svelte-fvqcu8");
    			add_location(th66, file$9, 683, 8, 17916);
    			attr(h522, "class", "single svelte-fvqcu8");
    			add_location(h522, file$9, 686, 12, 18048);
    			attr(a17, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a17, file$9, 685, 10, 17971);
    			attr(th67, "class", "svelte-fvqcu8");
    			add_location(th67, file$9, 684, 8, 17956);
    			attr(tr45, "class", "item svelte-fvqcu8");
    			add_location(tr45, file$9, 682, 6, 17890);
    			attr(th68, "class", "date svelte-fvqcu8");
    			add_location(th68, file$9, 691, 8, 18174);
    			attr(h523, "class", "single svelte-fvqcu8");
    			add_location(h523, file$9, 694, 12, 18300);
    			attr(a18, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a18, file$9, 693, 10, 18231);
    			attr(th69, "class", "svelte-fvqcu8");
    			add_location(th69, file$9, 692, 8, 18216);
    			attr(tr46, "class", "item svelte-fvqcu8");
    			add_location(tr46, file$9, 690, 6, 18148);
    			attr(th70, "class", "date svelte-fvqcu8");
    			add_location(th70, file$9, 699, 8, 18442);
    			attr(h524, "class", "single svelte-fvqcu8");
    			add_location(h524, file$9, 701, 10, 18497);
    			attr(th71, "class", "svelte-fvqcu8");
    			add_location(th71, file$9, 700, 8, 18482);
    			attr(tr47, "class", "item svelte-fvqcu8");
    			add_location(tr47, file$9, 698, 6, 18416);
    			attr(th72, "class", "date svelte-fvqcu8");
    			add_location(th72, file$9, 705, 8, 18610);
    			attr(h525, "class", "single svelte-fvqcu8");
    			add_location(h525, file$9, 708, 12, 18744);
    			attr(a19, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a19, file$9, 707, 10, 18667);
    			attr(th73, "class", "svelte-fvqcu8");
    			add_location(th73, file$9, 706, 8, 18652);
    			attr(tr48, "class", "item svelte-fvqcu8");
    			add_location(tr48, file$9, 704, 6, 18584);
    			attr(th74, "class", "date svelte-fvqcu8");
    			add_location(th74, file$9, 713, 8, 18873);
    			attr(h526, "class", "single svelte-fvqcu8");
    			add_location(h526, file$9, 716, 12, 18984);
    			attr(a20, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a20, file$9, 715, 10, 18930);
    			attr(th75, "class", "svelte-fvqcu8");
    			add_location(th75, file$9, 714, 8, 18915);
    			attr(tr49, "class", "item svelte-fvqcu8");
    			add_location(tr49, file$9, 712, 6, 18847);
    			attr(th76, "class", "date svelte-fvqcu8");
    			add_location(th76, file$9, 721, 8, 19111);
    			attr(h527, "class", "single svelte-fvqcu8");
    			add_location(h527, file$9, 723, 10, 19168);
    			attr(th77, "class", "svelte-fvqcu8");
    			add_location(th77, file$9, 722, 8, 19153);
    			attr(tr50, "class", "item svelte-fvqcu8");
    			add_location(tr50, file$9, 720, 6, 19085);
    			attr(th78, "class", "date svelte-fvqcu8");
    			add_location(th78, file$9, 728, 8, 19287);
    			attr(h410, "class", "header svelte-fvqcu8");
    			add_location(h410, file$9, 730, 10, 19330);
    			attr(th79, "class", "svelte-fvqcu8");
    			add_location(th79, file$9, 729, 8, 19315);
    			add_location(tr51, file$9, 727, 6, 19274);
    			attr(th80, "class", "date svelte-fvqcu8");
    			add_location(th80, file$9, 734, 8, 19419);
    			attr(h528, "class", "svelte-fvqcu8");
    			add_location(h528, file$9, 736, 10, 19462);
    			add_location(button29, file$9, 738, 12, 19522);
    			add_location(button30, file$9, 739, 12, 19568);
    			add_location(button31, file$9, 740, 12, 19614);
    			attr(div15, "class", "tags svelte-fvqcu8");
    			add_location(div15, file$9, 737, 10, 19491);
    			attr(th81, "class", "svelte-fvqcu8");
    			add_location(th81, file$9, 735, 8, 19447);
    			attr(tr52, "class", "item svelte-fvqcu8");
    			add_location(tr52, file$9, 733, 6, 19393);
    			attr(tr53, "class", "buffer svelte-fvqcu8");
    			add_location(tr53, file$9, 744, 6, 19709);
    			attr(th82, "class", "date svelte-fvqcu8");
    			add_location(th82, file$9, 746, 8, 19763);
    			attr(h529, "class", "svelte-fvqcu8");
    			add_location(h529, file$9, 748, 10, 19806);
    			add_location(button32, file$9, 750, 12, 19878);
    			add_location(button33, file$9, 751, 12, 19912);
    			add_location(button34, file$9, 752, 12, 19952);
    			add_location(button35, file$9, 753, 12, 19988);
    			add_location(button36, file$9, 754, 12, 20023);
    			add_location(button37, file$9, 755, 12, 20056);
    			attr(div16, "class", "tags svelte-fvqcu8");
    			add_location(div16, file$9, 749, 10, 19847);
    			attr(th83, "class", "svelte-fvqcu8");
    			add_location(th83, file$9, 747, 8, 19791);
    			attr(tr54, "class", "item svelte-fvqcu8");
    			add_location(tr54, file$9, 745, 6, 19737);
    			attr(tr55, "class", "buffer svelte-fvqcu8");
    			add_location(tr55, file$9, 759, 6, 20125);
    			attr(th84, "class", "date svelte-fvqcu8");
    			add_location(th84, file$9, 761, 8, 20179);
    			attr(h530, "class", "svelte-fvqcu8");
    			add_location(h530, file$9, 763, 10, 20222);
    			add_location(button38, file$9, 765, 12, 20285);
    			add_location(button39, file$9, 766, 12, 20331);
    			add_location(button40, file$9, 767, 12, 20383);
    			add_location(button41, file$9, 768, 12, 20418);
    			add_location(button42, file$9, 769, 12, 20454);
    			add_location(button43, file$9, 770, 12, 20488);
    			add_location(button44, file$9, 771, 12, 20520);
    			add_location(button45, file$9, 772, 12, 20557);
    			attr(div17, "class", "tags svelte-fvqcu8");
    			add_location(div17, file$9, 764, 10, 20254);
    			attr(th85, "class", "svelte-fvqcu8");
    			add_location(th85, file$9, 762, 8, 20207);
    			attr(tr56, "class", "item svelte-fvqcu8");
    			add_location(tr56, file$9, 760, 6, 20153);
    			attr(tr57, "class", "buffer svelte-fvqcu8");
    			add_location(tr57, file$9, 776, 6, 20648);
    			attr(th86, "class", "date svelte-fvqcu8");
    			add_location(th86, file$9, 778, 8, 20702);
    			attr(p19, "class", "desc svelte-fvqcu8");
    			add_location(p19, file$9, 780, 10, 20745);
    			attr(th87, "class", "svelte-fvqcu8");
    			add_location(th87, file$9, 779, 8, 20730);
    			attr(tr58, "class", "item svelte-fvqcu8");
    			add_location(tr58, file$9, 777, 6, 20676);
    			attr(table, "class", "svelte-fvqcu8");
    			add_location(table, file$9, 149, 4, 2341);
    			attr(main, "class", "svelte-fvqcu8");
    			add_location(main, file$9, 136, 2, 2118);
    			attr(div18, "id", "container");
    			add_location(div18, file$9, 135, 0, 2095);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, link0, anchor);
    			insert(target, t0, anchor);
    			insert(target, link1, anchor);
    			insert(target, t1, anchor);
    			insert(target, div18, anchor);
    			append(div18, main);
    			append(main, header);
    			append(header, h3);
    			append(h3, t2);
    			append(h3, span0);
    			append(h3, t4);
    			append(h3, span1);
    			append(header, t6);
    			mount_component(intro, header, null);
    			append(header, t7);
    			mount_component(social, header, null);
    			append(main, t8);
    			append(main, table);
    			append(table, tr0);
    			append(tr0, th0);
    			append(tr0, t9);
    			append(tr0, th1);
    			append(th1, h40);
    			append(table, t11);
    			append(table, tr1);
    			append(tr1, th2);
    			append(th2, t12);
    			append(th2, br0);
    			append(th2, t13);
    			append(tr1, t14);
    			append(tr1, th3);
    			append(th3, h50);
    			append(th3, t16);
    			append(th3, h60);
    			append(table, t18);
    			append(table, tr2);
    			append(table, t19);
    			append(table, tr3);
    			append(tr3, th4);
    			append(th4, t20);
    			append(th4, br1);
    			append(th4, t21);
    			append(tr3, t22);
    			append(tr3, th5);
    			append(th5, h51);
    			append(th5, t24);
    			append(th5, h61);
    			append(h61, span2);
    			append(h61, t26);
    			append(h61, span3);
    			append(h61, t28);
    			append(th5, t29);
    			append(th5, p0);
    			append(table, t31);
    			append(table, tr4);
    			append(tr4, th6);
    			append(tr4, t33);
    			append(tr4, th7);
    			append(th7, h62);
    			append(th7, t35);
    			append(th7, p1);
    			append(table, t37);
    			append(table, tr5);
    			append(tr5, th8);
    			append(tr5, t38);
    			append(tr5, th9);
    			append(th9, h41);
    			append(table, t40);
    			append(table, tr6);
    			append(tr6, th10);
    			append(tr6, t42);
    			append(tr6, th11);
    			append(th11, h52);
    			append(th11, t44);
    			append(th11, p2);
    			append(th11, t46);
    			append(th11, div0);
    			append(div0, a0);
    			append(a0, button0);
    			append(button0, i0);
    			append(button0, t47);
    			append(table, t48);
    			append(table, tr7);
    			append(table, t49);
    			append(table, tr8);
    			append(tr8, th12);
    			append(tr8, t51);
    			append(tr8, th13);
    			append(th13, h53);
    			append(th13, t53);
    			append(th13, p3);
    			append(th13, t55);
    			append(th13, div1);
    			append(div1, a1);
    			append(a1, button1);
    			append(button1, i1);
    			append(button1, t56);
    			append(table, t57);
    			append(table, tr9);
    			append(table, t58);
    			append(table, tr10);
    			append(tr10, th14);
    			append(th14, t59);
    			append(th14, br2);
    			append(th14, t60);
    			append(tr10, t61);
    			append(tr10, th15);
    			append(th15, h54);
    			append(th15, t63);
    			append(th15, h63);
    			append(th15, t65);
    			append(th15, p4);
    			append(th15, t67);
    			append(th15, div2);
    			append(div2, a2);
    			append(a2, button2);
    			append(button2, i2);
    			append(button2, t68);
    			append(table, t69);
    			append(table, tr11);
    			append(table, t70);
    			append(table, tr12);
    			append(tr12, th16);
    			append(tr12, t72);
    			append(tr12, th17);
    			append(th17, h55);
    			append(th17, t74);
    			append(th17, h64);
    			append(th17, t76);
    			append(th17, p5);
    			append(th17, t78);
    			append(th17, div3);
    			append(div3, a3);
    			append(a3, button3);
    			append(button3, i3);
    			append(button3, t79);
    			append(table, t80);
    			append(table, tr13);
    			append(tr13, th18);
    			append(tr13, t81);
    			append(tr13, th19);
    			append(th19, h42);
    			append(table, t83);
    			append(table, tr14);
    			append(tr14, th20);
    			append(th20, t84);
    			append(th20, br3);
    			append(th20, t85);
    			append(tr14, t86);
    			append(tr14, th21);
    			append(th21, h56);
    			append(th21, t88);
    			append(th21, h65);
    			append(th21, t90);
    			append(th21, p6);
    			append(th21, t92);
    			append(th21, div4);
    			append(div4, a4);
    			append(a4, button4);
    			append(button4, i4);
    			append(button4, t93);
    			append(div4, t94);
    			append(div4, button5);
    			append(div4, t96);
    			append(div4, button6);
    			append(div4, t98);
    			append(div4, button7);
    			append(div4, t100);
    			append(div4, button8);
    			append(table, t102);
    			append(table, tr15);
    			append(table, t103);
    			append(table, tr16);
    			append(tr16, th22);
    			append(th22, t104);
    			append(th22, br4);
    			append(th22, t105);
    			append(tr16, t106);
    			append(tr16, th23);
    			append(th23, h57);
    			append(th23, t108);
    			append(th23, h66);
    			append(th23, t110);
    			append(th23, p7);
    			append(th23, t112);
    			append(th23, div5);
    			append(div5, button9);
    			append(div5, t114);
    			append(div5, button10);
    			append(div5, t116);
    			append(div5, button11);
    			append(div5, t118);
    			append(div5, button12);
    			append(table, t120);
    			append(table, tr17);
    			append(table, t121);
    			append(table, tr18);
    			append(tr18, th24);
    			append(th24, t122);
    			append(th24, br5);
    			append(th24, t123);
    			append(tr18, t124);
    			append(tr18, th25);
    			append(th25, h58);
    			append(th25, t126);
    			append(th25, h67);
    			append(th25, t128);
    			append(th25, p8);
    			append(th25, t130);
    			append(th25, div6);
    			append(div6, button13);
    			append(div6, t132);
    			append(div6, button14);
    			append(div6, t134);
    			append(div6, button15);
    			append(table, t136);
    			append(table, tr19);
    			append(tr19, th26);
    			append(tr19, t137);
    			append(tr19, th27);
    			append(th27, h43);
    			append(table, t139);
    			append(table, tr20);
    			append(tr20, th28);
    			append(th28, t140);
    			append(th28, br6);
    			append(th28, t141);
    			append(tr20, t142);
    			append(tr20, th29);
    			append(th29, h59);
    			append(th29, t144);
    			append(th29, h68);
    			append(th29, t146);
    			append(th29, p9);
    			append(th29, t148);
    			append(th29, div7);
    			append(div7, a5);
    			append(a5, button16);
    			append(button16, i5);
    			append(button16, t149);
    			append(table, t150);
    			append(table, tr21);
    			append(table, t151);
    			append(table, tr22);
    			append(tr22, th30);
    			append(th30, t152);
    			append(th30, br7);
    			append(th30, t153);
    			append(tr22, t154);
    			append(tr22, th31);
    			append(th31, h510);
    			append(th31, t156);
    			append(th31, h69);
    			append(th31, t158);
    			append(th31, p10);
    			append(th31, t160);
    			append(th31, div8);
    			append(div8, a6);
    			append(a6, button17);
    			append(div8, t162);
    			append(div8, a7);
    			append(a7, button18);
    			append(button18, i6);
    			append(button18, t163);
    			append(div8, t164);
    			append(div8, a8);
    			append(a8, button19);
    			append(button19, i7);
    			append(button19, t165);
    			append(div8, t166);
    			append(div8, button20);
    			append(table, t168);
    			append(table, tr23);
    			append(tr23, th32);
    			append(tr23, t169);
    			append(tr23, th33);
    			append(th33, h44);
    			append(table, t171);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append(table, t172);
    			append(table, tr24);
    			append(tr24, th34);
    			append(tr24, t173);
    			append(tr24, th35);
    			append(th35, h45);
    			append(table, t175);
    			append(table, tr25);
    			append(tr25, th36);
    			append(tr25, t177);
    			append(tr25, th37);
    			append(th37, h511);
    			append(th37, t179);
    			append(th37, h610);
    			append(th37, t181);
    			append(th37, p11);
    			append(th37, t183);
    			append(th37, div9);
    			append(div9, a9);
    			append(a9, button21);
    			append(button21, i8);
    			append(button21, t184);
    			append(table, t185);
    			append(table, tr26);
    			append(table, t186);
    			append(table, tr27);
    			append(tr27, th38);
    			append(tr27, t188);
    			append(tr27, th39);
    			append(th39, h512);
    			append(th39, t190);
    			append(th39, p12);
    			append(th39, t192);
    			append(th39, div10);
    			append(div10, a10);
    			append(a10, button22);
    			append(button22, i9);
    			append(button22, t193);
    			append(div10, t194);
    			append(div10, a11);
    			append(a11, button23);
    			append(button23, i10);
    			append(button23, t195);
    			append(table, t196);
    			append(table, tr28);
    			append(table, t197);
    			append(table, tr29);
    			append(tr29, th40);
    			append(tr29, t199);
    			append(tr29, th41);
    			append(th41, h513);
    			append(th41, t201);
    			append(th41, p13);
    			append(th41, t203);
    			append(th41, div11);
    			append(div11, a12);
    			append(a12, button24);
    			append(button24, i11);
    			append(button24, t204);
    			append(div11, t205);
    			append(div11, a13);
    			append(a13, button25);
    			append(button25, i12);
    			append(button25, t206);
    			append(table, t207);
    			append(table, tr30);
    			append(tr30, th42);
    			append(tr30, t208);
    			append(tr30, th43);
    			append(th43, h46);
    			append(table, t210);
    			append(table, tr31);
    			append(tr31, th44);
    			append(tr31, t212);
    			append(tr31, th45);
    			append(th45, h514);
    			append(th45, t214);
    			append(th45, h611);
    			append(th45, t216);
    			append(th45, p14);
    			append(table, t218);
    			append(table, tr32);
    			append(table, t219);
    			append(table, tr33);
    			append(tr33, th46);
    			append(tr33, t221);
    			append(tr33, th47);
    			append(th47, h515);
    			append(th47, t223);
    			append(th47, h612);
    			append(th47, t225);
    			append(th47, p15);
    			append(table, t227);
    			append(table, tr34);
    			append(tr34, th48);
    			append(tr34, t228);
    			append(tr34, th49);
    			append(th49, h47);
    			append(table, t230);
    			append(table, tr35);
    			append(tr35, th50);
    			append(tr35, t231);
    			append(tr35, th51);
    			append(th51, h516);
    			append(table, t233);
    			append(table, tr36);
    			append(tr36, th52);
    			append(tr36, t235);
    			append(tr36, th53);
    			append(th53, h517);
    			append(table, t237);
    			append(table, tr37);
    			append(tr37, th54);
    			append(tr37, t239);
    			append(tr37, th55);
    			append(th55, h518);
    			append(table, t241);
    			append(table, tr38);
    			append(tr38, th56);
    			append(tr38, t242);
    			append(tr38, th57);
    			append(th57, h48);
    			append(table, t244);
    			append(table, tr39);
    			append(tr39, th58);
    			append(th58, t245);
    			append(th58, br8);
    			append(th58, t246);
    			append(tr39, t247);
    			append(tr39, th59);
    			append(th59, h519);
    			append(th59, t249);
    			append(th59, h613);
    			append(th59, t251);
    			append(th59, p16);
    			append(th59, t253);
    			append(th59, div12);
    			append(div12, a14);
    			append(a14, button26);
    			append(button26, i13);
    			append(button26, t254);
    			append(table, t255);
    			append(table, tr40);
    			append(table, t256);
    			append(table, tr41);
    			append(tr41, th60);
    			append(tr41, t258);
    			append(tr41, th61);
    			append(th61, h520);
    			append(th61, t260);
    			append(th61, p17);
    			append(th61, t262);
    			append(th61, div13);
    			append(div13, a15);
    			append(a15, button27);
    			append(button27, i14);
    			append(button27, t263);
    			append(table, t264);
    			append(table, tr42);
    			append(table, t265);
    			append(table, tr43);
    			append(tr43, th62);
    			append(th62, t266);
    			append(th62, br9);
    			append(th62, t267);
    			append(tr43, t268);
    			append(tr43, th63);
    			append(th63, h521);
    			append(th63, t270);
    			append(th63, h614);
    			append(th63, t272);
    			append(th63, p18);
    			append(th63, t274);
    			append(th63, div14);
    			append(div14, a16);
    			append(a16, button28);
    			append(button28, i15);
    			append(button28, t275);
    			append(table, t276);
    			append(table, tr44);
    			append(tr44, th64);
    			append(tr44, t277);
    			append(tr44, th65);
    			append(th65, h49);
    			append(table, t279);
    			append(table, tr45);
    			append(tr45, th66);
    			append(tr45, t281);
    			append(tr45, th67);
    			append(th67, a17);
    			append(a17, h522);
    			append(table, t283);
    			append(table, tr46);
    			append(tr46, th68);
    			append(tr46, t285);
    			append(tr46, th69);
    			append(th69, a18);
    			append(a18, h523);
    			append(table, t287);
    			append(table, tr47);
    			append(tr47, th70);
    			append(tr47, t289);
    			append(tr47, th71);
    			append(th71, h524);
    			append(table, t291);
    			append(table, tr48);
    			append(tr48, th72);
    			append(tr48, t293);
    			append(tr48, th73);
    			append(th73, a19);
    			append(a19, h525);
    			append(table, t295);
    			append(table, tr49);
    			append(tr49, th74);
    			append(tr49, t297);
    			append(tr49, th75);
    			append(th75, a20);
    			append(a20, h526);
    			append(table, t299);
    			append(table, tr50);
    			append(tr50, th76);
    			append(tr50, t301);
    			append(tr50, th77);
    			append(th77, h527);
    			append(table, t303);
    			append(table, tr51);
    			append(tr51, th78);
    			append(tr51, t304);
    			append(tr51, th79);
    			append(th79, h410);
    			append(table, t306);
    			append(table, tr52);
    			append(tr52, th80);
    			append(tr52, t307);
    			append(tr52, th81);
    			append(th81, h528);
    			append(th81, t309);
    			append(th81, div15);
    			append(div15, button29);
    			append(div15, t311);
    			append(div15, button30);
    			append(div15, t313);
    			append(div15, button31);
    			append(table, t315);
    			append(table, tr53);
    			append(table, t316);
    			append(table, tr54);
    			append(tr54, th82);
    			append(tr54, t317);
    			append(tr54, th83);
    			append(th83, h529);
    			append(th83, t319);
    			append(th83, div16);
    			append(div16, button32);
    			append(div16, t321);
    			append(div16, button33);
    			append(div16, t323);
    			append(div16, button34);
    			append(div16, t325);
    			append(div16, button35);
    			append(div16, t327);
    			append(div16, button36);
    			append(div16, t329);
    			append(div16, button37);
    			append(table, t331);
    			append(table, tr55);
    			append(table, t332);
    			append(table, tr56);
    			append(tr56, th84);
    			append(tr56, t333);
    			append(tr56, th85);
    			append(th85, h530);
    			append(th85, t335);
    			append(th85, div17);
    			append(div17, button38);
    			append(div17, t337);
    			append(div17, button39);
    			append(div17, t339);
    			append(div17, button40);
    			append(div17, t341);
    			append(div17, button41);
    			append(div17, t343);
    			append(div17, button42);
    			append(div17, t345);
    			append(div17, button43);
    			append(div17, t347);
    			append(div17, button44);
    			append(div17, t349);
    			append(div17, button45);
    			append(table, t351);
    			append(table, tr57);
    			append(table, t352);
    			append(table, tr58);
    			append(tr58, th86);
    			append(tr58, t353);
    			append(tr58, th87);
    			append(th87, p19);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.pubs) {
    				each_value = pubs;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(table, t172);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) out(i);
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			transition_in(social.$$.fragment, local);

    			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			transition_out(social.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(link0);
    				detach(t0);
    				detach(link1);
    				detach(t1);
    				detach(div18);
    			}

    			destroy_component(intro);

    			destroy_component(social);

    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function func$3(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    class Cv extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$a, safe_not_equal, []);
    	}
    }

    var routes = {
        '/': Home,
        '/news': News,
        '/pubs': Pubs,
        '/cv': Cv,
        '/paper/:id': Paper,
    };

    /* src/App.svelte generated by Svelte v3.9.1 */

    function create_fragment$b(ctx) {
    	var current;

    	var router = new Router({
    		props: { routes: routes },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			router.$$.fragment.c();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var router_changes = {};
    			if (changed.routes) router_changes.routes = routes;
    			router.$set(router_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};
    }

    function instance$4($$self) {
    	

      document.title = "Alex Cabrera";

      (function(i, s, o, g, r, a, m) {
        i["GoogleAnalyticsObject"] = r;
        (i[r] =
          i[r] ||
          function() {
            (i[r].q = i[r].q || []).push(arguments);
          }),
          (i[r].l = 1 * new Date());
        (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a, m);
      })(
        window,
        document,
        "script",
        "//www.google-analytics.com/analytics.js",
        "ga"
      );

      ga("create", "UA-50459890-1", "auto");
      ga("send", "pageview");

    	return {};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$b, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
