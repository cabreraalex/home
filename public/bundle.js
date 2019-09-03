
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
    			t0 = text(" \n     cabreraalex.com");
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
    			add_location(i0, file, 3, 4, 66);
    			add_location(h30, file, 2, 2, 57);
    			attr(a0, "href", "https://cabreraalex.com");
    			add_location(a0, file, 1, 2, 20);
    			attr(i1, "class", "fas fa-envelope");
    			add_location(i1, file, 9, 6, 185);
    			add_location(h31, file, 8, 4, 174);
    			attr(a1, "href", "mailto:cabrera@cmu.edu");
    			add_location(a1, file, 7, 2, 136);
    			attr(i2, "class", "fab fa-twitter social-icon");
    			add_location(i2, file, 15, 6, 326);
    			add_location(h32, file, 14, 4, 315);
    			attr(a2, "href", "https://twitter.com/a_a_cabrera");
    			add_location(a2, file, 13, 2, 268);
    			attr(i3, "class", "fab fa-github");
    			add_location(i3, file, 21, 6, 474);
    			add_location(h33, file, 20, 4, 463);
    			attr(a3, "href", "https://github.com/cabreraalex");
    			add_location(a3, file, 19, 2, 417);
    			attr(i4, "class", "fas fa-graduation-cap");
    			add_location(i4, file, 27, 6, 633);
    			add_location(h34, file, 26, 4, 622);
    			attr(a4, "href", "https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en");
    			add_location(a4, file, 25, 2, 546);
    			attr(div, "id", "social");
    			add_location(div, file, 0, 0, 0);
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
    			add_location(link, file$1, 2, 0, 55);
    			attr(img, "width", "170px");
    			attr(img, "src", "images/profile.jpg");
    			attr(img, "alt", "profile picture");
    			add_location(img, file$1, 11, 16, 364);
    			attr(a0, "href", "/");
    			add_location(a0, file$1, 11, 4, 352);
    			attr(span0, "class", "name");
    			add_location(span0, file$1, 14, 6, 481);
    			attr(span1, "class", "name");
    			add_location(span1, file$1, 15, 6, 523);
    			attr(h1, "id", "name");
    			add_location(h1, file$1, 12, 4, 441);
    			attr(button0, "class", "cv");
    			add_location(button0, file$1, 19, 6, 609);
    			attr(a1, "href", "/#/cv");
    			add_location(a1, file$1, 18, 4, 586);
    			attr(button1, "class", "cv");
    			add_location(button1, file$1, 22, 6, 684);
    			attr(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 21, 4, 659);
    			attr(div0, "id", "padded-sidebar");
    			add_location(div0, file$1, 10, 2, 322);
    			attr(div1, "id", "sidebar");
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$1, 9, 0, 270);
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

    /* src/Home.svelte generated by Svelte v3.9.1 */

    const file$5 = "src/Home.svelte";

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

    // (48:8) {#each {length: 3} as _, i}
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
    			add_location(p0, file$5, 49, 12, 1314);
    			attr(p1, "class", "item pure-u-1 pure-u-md-3-4");
    			add_location(p1, file$5, 50, 12, 1384);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$5, 48, 10, 1271);
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

    // (86:18) {#if pub.pdf}
    function create_if_block_4(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        PDF");
    			attr(i, "class", "fas fa-file-pdf");
    			add_location(i, file$5, 88, 24, 2697);
    			add_location(button, file$5, 87, 22, 2664);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$5, 86, 20, 2623);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (94:18) {#if pub.workshop}
    function create_if_block_3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Workshop");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 96, 24, 2972);
    			add_location(button, file$5, 95, 22, 2939);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$5, 94, 20, 2893);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (102:18) {#if pub.video}
    function create_if_block_2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Video");
    			attr(i, "class", "fab fa-youtube");
    			add_location(i, file$5, 104, 24, 3243);
    			add_location(button, file$5, 103, 22, 3210);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$5, 102, 20, 3167);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (110:18) {#if pub.demo}
    function create_if_block_1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Demo");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 112, 24, 3511);
    			add_location(button, file$5, 111, 22, 3478);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$5, 110, 20, 3436);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (118:18) {#if pub.code}
    function create_if_block(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Code");
    			attr(i, "class", "fab fa-github");
    			add_location(i, file$5, 120, 24, 3776);
    			add_location(button, file$5, 119, 22, 3743);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$5, 118, 20, 3701);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (62:8) {#each pubs as pub}
    function create_each_block$1(ctx) {
    	var div5, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div4, div3, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                        .map(func)
                        .join(', ') + "", t5, div2, t6, t7, t8, t9, t10, a2, button, i, t11, a2_href_value, t12;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_4(ctx);

    	var if_block1 = (ctx.pub.workshop) && create_if_block_3(ctx);

    	var if_block2 = (ctx.pub.video) && create_if_block_2(ctx);

    	var if_block3 = (ctx.pub.demo) && create_if_block_1(ctx);

    	var if_block4 = (ctx.pub.code) && create_if_block(ctx);

    	return {
    		c: function create() {
    			div5 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			h6 = element("h6");
    			t1 = text(t1_value);
    			t2 = space();
    			div4 = element("div");
    			div3 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			h5 = element("h5");
    			t5 = space();
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			if (if_block3) if_block3.c();
    			t9 = space();
    			if (if_block4) if_block4.c();
    			t10 = space();
    			a2 = element("a");
    			button = element("button");
    			i = element("i");
    			t11 = text("\n                      Website");
    			t12 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$5, 66, 18, 1893);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$5, 65, 16, 1844);
    			attr(h6, "class", "venue");
    			add_location(h6, file$5, 71, 16, 2054);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$5, 64, 14, 1808);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$5, 63, 12, 1757);
    			add_location(h4, file$5, 77, 18, 2298);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$5, 76, 16, 2229);
    			add_location(h5, file$5, 79, 16, 2356);
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$5, 127, 22, 4014);
    			add_location(button, file$5, 126, 20, 3983);
    			attr(a2, "href", a2_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a2, file$5, 125, 18, 3932);
    			attr(div2, "class", "buttons");
    			add_location(div2, file$5, 84, 16, 2549);
    			attr(div3, "class", "padded");
    			add_location(div3, file$5, 75, 14, 2192);
    			attr(div4, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div4, file$5, 74, 12, 2141);
    			attr(div5, "class", "pure-g pub");
    			add_location(div5, file$5, 62, 10, 1720);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div1);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t0);
    			append(div0, h6);
    			append(h6, t1);
    			append(div5, t2);
    			append(div5, div4);
    			append(div4, div3);
    			append(div3, a1);
    			append(a1, h4);
    			append(h4, t3);
    			append(div3, t4);
    			append(div3, h5);
    			h5.innerHTML = raw_value;
    			append(div3, t5);
    			append(div3, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append(div2, t6);
    			if (if_block1) if_block1.m(div2, null);
    			append(div2, t7);
    			if (if_block2) if_block2.m(div2, null);
    			append(div2, t8);
    			if (if_block3) if_block3.m(div2, null);
    			append(div2, t9);
    			if (if_block4) if_block4.m(div2, null);
    			append(div2, t10);
    			append(div2, a2);
    			append(a2, button);
    			append(button, i);
    			append(button, t11);
    			append(div5, t12);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div2, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.pub.workshop) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div2, t7);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.pub.video) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(div2, t8);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (ctx.pub.demo) {
    				if (if_block3) {
    					if_block3.p(changed, ctx);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(div2, t9);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (ctx.pub.code) {
    				if (if_block4) {
    					if_block4.p(changed, ctx);
    				} else {
    					if_block4 = create_if_block(ctx);
    					if_block4.c();
    					if_block4.m(div2, t10);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div5);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};
    }

    function create_fragment$6(ctx) {
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
    			add_location(span, file$5, 38, 30, 1013);
    			add_location(h20, file$5, 37, 8, 978);
    			attr(div0, "id", "intro");
    			add_location(div0, file$5, 36, 6, 953);
    			attr(a0, "class", "right-all");
    			attr(a0, "href", "#/news");
    			add_location(a0, file$5, 45, 10, 1163);
    			add_location(h21, file$5, 43, 8, 1133);
    			attr(div1, "id", "news");
    			attr(div1, "class", "sect");
    			add_location(div1, file$5, 42, 6, 1096);
    			attr(a1, "class", "right-all");
    			attr(a1, "href", "#/pubs");
    			add_location(a1, file$5, 59, 10, 1612);
    			add_location(h22, file$5, 57, 8, 1565);
    			attr(div2, "id", "pubs");
    			attr(div2, "class", "sect");
    			add_location(div2, file$5, 56, 6, 1528);
    			attr(div3, "id", "padded-content");
    			add_location(div3, file$5, 35, 4, 921);
    			attr(div4, "id", "content");
    			attr(div4, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div4, file$5, 34, 2, 867);
    			attr(div5, "class", "pure-g");
    			attr(div5, "id", "main-container");
    			add_location(div5, file$5, 32, 0, 810);
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
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			transition_in(intro.$$.fragment, local);

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);
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

    function instance$1($$self) {
    	

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
    		init(this, options, instance$1, create_fragment$6, safe_not_equal, []);
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.9.1 */

    const file$6 = "src/Pubs.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (36:18) {#if pub.pdf}
    function create_if_block_4$1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        PDF");
    			attr(i, "class", "fas fa-file-pdf");
    			add_location(i, file$6, 38, 24, 1341);
    			add_location(button, file$6, 37, 22, 1308);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$6, 36, 20, 1267);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (44:18) {#if pub.code}
    function create_if_block_3$1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Code");
    			attr(i, "class", "fab fa-github");
    			add_location(i, file$6, 46, 24, 1608);
    			add_location(button, file$6, 45, 22, 1575);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$6, 44, 20, 1533);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (52:18) {#if pub.workshop}
    function create_if_block_2$1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Workshop");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$6, 54, 24, 1882);
    			add_location(button, file$6, 53, 22, 1849);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$6, 52, 20, 1803);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (60:18) {#if pub.video}
    function create_if_block_1$1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Video");
    			attr(i, "class", "fab fa-youtube");
    			add_location(i, file$6, 62, 24, 2153);
    			add_location(button, file$6, 61, 22, 2120);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$6, 60, 20, 2077);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (68:18) {#if pub.demo}
    function create_if_block$1(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                        Demo");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$6, 70, 24, 2421);
    			add_location(button, file$6, 69, 22, 2388);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$6, 68, 20, 2346);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (12:8) {#each pubs as pub}
    function create_each_block$2(ctx) {
    	var div5, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div4, div3, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                        .map(func$1)
                        .join(', ') + "", t5, div2, t6, t7, t8, t9, t10, a2, button, i, t11, a2_href_value, t12;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_4$1(ctx);

    	var if_block1 = (ctx.pub.code) && create_if_block_3$1(ctx);

    	var if_block2 = (ctx.pub.workshop) && create_if_block_2$1(ctx);

    	var if_block3 = (ctx.pub.video) && create_if_block_1$1(ctx);

    	var if_block4 = (ctx.pub.demo) && create_if_block$1(ctx);

    	return {
    		c: function create() {
    			div5 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			h6 = element("h6");
    			t1 = text(t1_value);
    			t2 = space();
    			div4 = element("div");
    			div3 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			h5 = element("h5");
    			t5 = space();
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			if (if_block3) if_block3.c();
    			t9 = space();
    			if (if_block4) if_block4.c();
    			t10 = space();
    			a2 = element("a");
    			button = element("button");
    			i = element("i");
    			t11 = text("\n                      Website");
    			t12 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$6, 16, 18, 537);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 15, 16, 488);
    			attr(h6, "class", "venue");
    			add_location(h6, file$6, 21, 16, 698);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$6, 14, 14, 452);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$6, 13, 12, 401);
    			add_location(h4, file$6, 27, 18, 942);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$6, 26, 16, 873);
    			add_location(h5, file$6, 29, 16, 1000);
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$6, 77, 22, 2658);
    			add_location(button, file$6, 76, 20, 2627);
    			attr(a2, "href", a2_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a2, file$6, 75, 18, 2576);
    			attr(div2, "class", "buttons");
    			add_location(div2, file$6, 34, 16, 1193);
    			attr(div3, "class", "padded");
    			add_location(div3, file$6, 25, 14, 836);
    			attr(div4, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div4, file$6, 24, 12, 785);
    			attr(div5, "class", "pure-g pub");
    			add_location(div5, file$6, 12, 10, 364);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div1);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t0);
    			append(div0, h6);
    			append(h6, t1);
    			append(div5, t2);
    			append(div5, div4);
    			append(div4, div3);
    			append(div3, a1);
    			append(a1, h4);
    			append(h4, t3);
    			append(div3, t4);
    			append(div3, h5);
    			h5.innerHTML = raw_value;
    			append(div3, t5);
    			append(div3, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append(div2, t6);
    			if (if_block1) if_block1.m(div2, null);
    			append(div2, t7);
    			if (if_block2) if_block2.m(div2, null);
    			append(div2, t8);
    			if (if_block3) if_block3.m(div2, null);
    			append(div2, t9);
    			if (if_block4) if_block4.m(div2, null);
    			append(div2, t10);
    			append(div2, a2);
    			append(a2, button);
    			append(button, i);
    			append(button, t11);
    			append(div5, t12);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_4$1(ctx);
    					if_block0.c();
    					if_block0.m(div2, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.pub.code) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_3$1(ctx);
    					if_block1.c();
    					if_block1.m(div2, t7);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.pub.workshop) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block_2$1(ctx);
    					if_block2.c();
    					if_block2.m(div2, t8);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (ctx.pub.video) {
    				if (if_block3) {
    					if_block3.p(changed, ctx);
    				} else {
    					if_block3 = create_if_block_1$1(ctx);
    					if_block3.c();
    					if_block3.m(div2, t9);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (ctx.pub.demo) {
    				if (if_block4) {
    					if_block4.p(changed, ctx);
    				} else {
    					if_block4 = create_if_block$1(ctx);
    					if_block4.c();
    					if_block4.m(div2, t10);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div5);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	var div2, t0, div1, div0, h1, t2, t3, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var each_value = pubs;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
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
    			h1.textContent = "Publications";
    			t2 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			footer.$$.fragment.c();
    			add_location(h1, file$6, 10, 6, 304);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$6, 9, 4, 272);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$6, 8, 2, 218);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$6, 6, 0, 161);
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
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
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

    function func$1(p) {
    	return "<a href='" + p.website + "'>" + p.name + '</a>';
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$7, safe_not_equal, []);
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.9.1 */

    const file$7 = "src/Paper.svelte";

    // (114:4) {#if pub.pdf}
    function create_if_block_4$2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n          PDF");
    			attr(i, "class", "fas fa-file-pdf");
    			add_location(i, file$7, 116, 10, 1973);
    			add_location(button, file$7, 115, 8, 1954);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$7, 114, 6, 1927);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (122:4) {#if pub.code}
    function create_if_block_3$2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n          Code");
    			attr(i, "class", "fab fa-github");
    			add_location(i, file$7, 124, 10, 2128);
    			add_location(button, file$7, 123, 8, 2109);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$7, 122, 6, 2081);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (130:4) {#if pub.workshop}
    function create_if_block_2$2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n          Workshop");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$7, 132, 10, 2290);
    			add_location(button, file$7, 131, 8, 2271);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$7, 130, 6, 2239);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (138:4) {#if pub.video}
    function create_if_block_1$2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n          Video");
    			attr(i, "class", "fab fa-youtube");
    			add_location(i, file$7, 140, 10, 2449);
    			add_location(button, file$7, 139, 8, 2430);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$7, 138, 6, 2401);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (146:4) {#if pub.demo}
    function create_if_block$2(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n          Demo");
    			attr(i, "class", "fas fa-globe");
    			add_location(i, file$7, 148, 10, 2605);
    			add_location(button, file$7, 147, 8, 2586);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$7, 146, 6, 2558);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	var link, t0, div2, a0, h40, i0, t1, span0, t3, span1, t5, h1, t6_value = ctx.pub.title + "", t6, t7, h3, raw0_value = ctx.pub.authors
          .map(func$2)
          .join(', ') + "", t8, h20, t10, p, t11_value = ctx.pub.abstract + "", t11, t12, h21, t14, a1, h41, t15_value = ctx.pub.title + "", t15, a1_href_value, t16, h50, raw1_value = ctx.pub.authors
          .map(func_1)
          .join(', ') + "", t17, h51, i1, t18_value = ctx.pub.venuelong + "", t18, t19, t20_value = ctx.pub.location + "", t20, t21, t22_value = ctx.pub.year + "", t22, t23, div0, t24, t25, t26, t27, t28, a2, button, i2, t29, a2_href_value, t30, h22, t32, div1, code, t33_value = ctx.pub.bibtex + "", t33, t34, current;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_4$2(ctx);

    	var if_block1 = (ctx.pub.code) && create_if_block_3$2(ctx);

    	var if_block2 = (ctx.pub.workshop) && create_if_block_2$2(ctx);

    	var if_block3 = (ctx.pub.video) && create_if_block_1$2(ctx);

    	var if_block4 = (ctx.pub.demo) && create_if_block$2(ctx);

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			div2 = element("div");
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
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t24 = space();
    			if (if_block1) if_block1.c();
    			t25 = space();
    			if (if_block2) if_block2.c();
    			t26 = space();
    			if (if_block3) if_block3.c();
    			t27 = space();
    			if (if_block4) if_block4.c();
    			t28 = space();
    			a2 = element("a");
    			button = element("button");
    			i2 = element("i");
    			t29 = text("\n        Website");
    			t30 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t32 = space();
    			div1 = element("div");
    			code = element("code");
    			t33 = text(t33_value);
    			t34 = space();
    			footer.$$.fragment.c();
    			attr(link, "rel", "stylesheet");
    			attr(link, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link, "crossorigin", "anonymous");
    			add_location(link, file$7, 71, 0, 921);
    			attr(i0, "class", "fas fa-home svelte-1r57gco");
    			attr(i0, "id", "home");
    			add_location(i0, file$7, 80, 6, 1189);
    			attr(span0, "class", "name");
    			add_location(span0, file$7, 82, 6, 1250);
    			attr(span1, "class", "name");
    			add_location(span1, file$7, 84, 6, 1299);
    			attr(h40, "id", "home-link");
    			attr(h40, "class", "svelte-1r57gco");
    			add_location(h40, file$7, 79, 4, 1163);
    			attr(a0, "href", "/");
    			add_location(a0, file$7, 78, 2, 1146);
    			add_location(h1, file$7, 87, 2, 1352);
    			attr(h3, "class", "svelte-1r57gco");
    			add_location(h3, file$7, 88, 2, 1375);
    			attr(h20, "class", "sec-title svelte-1r57gco");
    			add_location(h20, file$7, 94, 2, 1499);
    			attr(p, "class", "svelte-1r57gco");
    			add_location(p, file$7, 95, 2, 1537);
    			attr(h21, "class", "sec-title svelte-1r57gco");
    			add_location(h21, file$7, 97, 2, 1562);
    			attr(h41, "class", "svelte-1r57gco");
    			add_location(h41, file$7, 99, 4, 1655);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$7, 98, 2, 1600);
    			attr(h50, "class", "svelte-1r57gco");
    			add_location(h50, file$7, 102, 2, 1686);
    			add_location(i1, file$7, 109, 4, 1819);
    			attr(h51, "class", "svelte-1r57gco");
    			add_location(h51, file$7, 108, 2, 1810);
    			attr(i2, "class", "fas fa-globe");
    			add_location(i2, file$7, 155, 8, 2744);
    			add_location(button, file$7, 154, 6, 2727);
    			attr(a2, "href", a2_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a2, file$7, 153, 4, 2690);
    			attr(div0, "class", "buttons svelte-1r57gco");
    			add_location(div0, file$7, 112, 2, 1881);
    			attr(h22, "class", "sec-title svelte-1r57gco");
    			add_location(h22, file$7, 160, 2, 2823);
    			attr(code, "class", "bibtex");
    			add_location(code, file$7, 162, 4, 2882);
    			attr(div1, "class", "code svelte-1r57gco");
    			add_location(div1, file$7, 161, 2, 2859);
    			attr(div2, "id", "body");
    			attr(div2, "class", "svelte-1r57gco");
    			add_location(div2, file$7, 77, 0, 1128);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, link, anchor);
    			insert(target, t0, anchor);
    			insert(target, div2, anchor);
    			append(div2, a0);
    			append(a0, h40);
    			append(h40, i0);
    			append(h40, t1);
    			append(h40, span0);
    			append(h40, t3);
    			append(h40, span1);
    			append(div2, t5);
    			append(div2, h1);
    			append(h1, t6);
    			append(div2, t7);
    			append(div2, h3);
    			h3.innerHTML = raw0_value;
    			append(div2, t8);
    			append(div2, h20);
    			append(div2, t10);
    			append(div2, p);
    			append(p, t11);
    			append(div2, t12);
    			append(div2, h21);
    			append(div2, t14);
    			append(div2, a1);
    			append(a1, h41);
    			append(h41, t15);
    			append(div2, t16);
    			append(div2, h50);
    			h50.innerHTML = raw1_value;
    			append(div2, t17);
    			append(div2, h51);
    			append(h51, i1);
    			append(i1, t18);
    			append(i1, t19);
    			append(i1, t20);
    			append(i1, t21);
    			append(i1, t22);
    			append(div2, t23);
    			append(div2, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append(div0, t24);
    			if (if_block1) if_block1.m(div0, null);
    			append(div0, t25);
    			if (if_block2) if_block2.m(div0, null);
    			append(div0, t26);
    			if (if_block3) if_block3.m(div0, null);
    			append(div0, t27);
    			if (if_block4) if_block4.m(div0, null);
    			append(div0, t28);
    			append(div0, a2);
    			append(a2, button);
    			append(button, i2);
    			append(button, t29);
    			append(div2, t30);
    			append(div2, h22);
    			append(div2, t32);
    			append(div2, div1);
    			append(div1, code);
    			append(code, t33);
    			append(div2, t34);
    			mount_component(footer, div2, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_4$2(ctx);
    					if_block0.c();
    					if_block0.m(div0, t24);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.pub.code) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_3$2(ctx);
    					if_block1.c();
    					if_block1.m(div0, t25);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.pub.workshop) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block_2$2(ctx);
    					if_block2.c();
    					if_block2.m(div0, t26);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (ctx.pub.video) {
    				if (if_block3) {
    					if_block3.p(changed, ctx);
    				} else {
    					if_block3 = create_if_block_1$2(ctx);
    					if_block3.c();
    					if_block3.m(div0, t27);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (ctx.pub.demo) {
    				if (if_block4) {
    					if_block4.p(changed, ctx);
    				} else {
    					if_block4 = create_if_block$2(ctx);
    					if_block4.c();
    					if_block4.m(div0, t28);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(link);
    				detach(t0);
    				detach(div2);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();

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

    function instance$2($$self, $$props, $$invalidate) {
    	
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
    		init(this, options, instance$2, create_fragment$8, safe_not_equal, ["params"]);
    	}

    	get params() {
    		throw new Error("<Paper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Paper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Cv.svelte generated by Svelte v3.9.1 */

    const file$8 = "src/Cv.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (462:14) {#if pub.pdf}
    function create_if_block_4$3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                    PDF");
    			attr(i, "class", "fas fa-file-pdf svelte-sy8qq4");
    			add_location(i, file$8, 464, 20, 11618);
    			add_location(button, file$8, 463, 18, 11589);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$8, 462, 16, 11552);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (470:14) {#if pub.code}
    function create_if_block_3$3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                    Code");
    			attr(i, "class", "fab fa-github svelte-sy8qq4");
    			add_location(i, file$8, 472, 20, 11853);
    			add_location(button, file$8, 471, 18, 11824);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$8, 470, 16, 11786);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (478:14) {#if pub.workshop}
    function create_if_block_2$3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                    Workshop");
    			attr(i, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i, file$8, 480, 20, 12095);
    			add_location(button, file$8, 479, 18, 12066);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$8, 478, 16, 12024);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (486:14) {#if pub.video}
    function create_if_block_1$3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                    Video");
    			attr(i, "class", "fab fa-youtube svelte-sy8qq4");
    			add_location(i, file$8, 488, 20, 12334);
    			add_location(button, file$8, 487, 18, 12305);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$8, 486, 16, 12266);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (494:14) {#if pub.demo}
    function create_if_block$3(ctx) {
    	var a, button, i, t, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = text("\n                    Demo");
    			attr(i, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i, file$8, 496, 20, 12570);
    			add_location(button, file$8, 495, 18, 12541);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$8, 494, 16, 12503);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}
    		}
    	};
    }

    // (443:6) {#each pubs as pub}
    function create_each_block$3(ctx) {
    	var tr0, th0, t0_value = ctx.pub.year + "", t0, t1, th1, a0, h5, t2_value = ctx.pub.title + "", t2, a0_href_value, t3, h6, raw_value = ctx.pub.authors
                    .map(func$3)
                    .join(', ') + "", t4, p, i0, t5_value = ctx.pub.venuelong + "", t5, t6, t7_value = ctx.pub.location + "", t7, t8, t9_value = ctx.pub.year + "", t9, t10, t11, div, t12, t13, t14, t15, t16, a1, button, i1, t17, a1_href_value, t18, tr1;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_4$3(ctx);

    	var if_block1 = (ctx.pub.code) && create_if_block_3$3(ctx);

    	var if_block2 = (ctx.pub.workshop) && create_if_block_2$3(ctx);

    	var if_block3 = (ctx.pub.video) && create_if_block_1$3(ctx);

    	var if_block4 = (ctx.pub.demo) && create_if_block$3(ctx);

    	return {
    		c: function create() {
    			tr0 = element("tr");
    			th0 = element("th");
    			t0 = text(t0_value);
    			t1 = space();
    			th1 = element("th");
    			a0 = element("a");
    			h5 = element("h5");
    			t2 = text(t2_value);
    			t3 = space();
    			h6 = element("h6");
    			t4 = space();
    			p = element("p");
    			i0 = element("i");
    			t5 = text(t5_value);
    			t6 = text(". ");
    			t7 = text(t7_value);
    			t8 = text(", ");
    			t9 = text(t9_value);
    			t10 = text(".");
    			t11 = space();
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t12 = space();
    			if (if_block1) if_block1.c();
    			t13 = space();
    			if (if_block2) if_block2.c();
    			t14 = space();
    			if (if_block3) if_block3.c();
    			t15 = space();
    			if (if_block4) if_block4.c();
    			t16 = space();
    			a1 = element("a");
    			button = element("button");
    			i1 = element("i");
    			t17 = text("\n                  Website");
    			t18 = space();
    			tr1 = element("tr");
    			attr(th0, "class", "date svelte-sy8qq4");
    			add_location(th0, file$8, 444, 10, 11023);
    			attr(h5, "class", "svelte-sy8qq4");
    			add_location(h5, file$8, 447, 14, 11148);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			attr(a0, "class", "paper-title");
    			add_location(a0, file$8, 446, 12, 11083);
    			attr(h6, "class", "svelte-sy8qq4");
    			add_location(h6, file$8, 450, 12, 11199);
    			add_location(i0, file$8, 457, 14, 11404);
    			attr(p, "class", "desc svelte-sy8qq4");
    			add_location(p, file$8, 456, 12, 11373);
    			attr(i1, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i1, file$8, 503, 18, 12779);
    			add_location(button, file$8, 502, 16, 12752);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a1, file$8, 501, 14, 12705);
    			attr(div, "class", "buttons");
    			add_location(div, file$8, 460, 12, 11486);
    			attr(th1, "class", "svelte-sy8qq4");
    			add_location(th1, file$8, 445, 10, 11066);
    			attr(tr0, "class", "item svelte-sy8qq4");
    			add_location(tr0, file$8, 443, 8, 10995);
    			attr(tr1, "class", "buffer svelte-sy8qq4");
    			add_location(tr1, file$8, 510, 8, 12934);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr0, anchor);
    			append(tr0, th0);
    			append(th0, t0);
    			append(tr0, t1);
    			append(tr0, th1);
    			append(th1, a0);
    			append(a0, h5);
    			append(h5, t2);
    			append(th1, t3);
    			append(th1, h6);
    			h6.innerHTML = raw_value;
    			append(th1, t4);
    			append(th1, p);
    			append(p, i0);
    			append(i0, t5);
    			append(i0, t6);
    			append(i0, t7);
    			append(i0, t8);
    			append(i0, t9);
    			append(i0, t10);
    			append(th1, t11);
    			append(th1, div);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t12);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t13);
    			if (if_block2) if_block2.m(div, null);
    			append(div, t14);
    			if (if_block3) if_block3.m(div, null);
    			append(div, t15);
    			if (if_block4) if_block4.m(div, null);
    			append(div, t16);
    			append(div, a1);
    			append(a1, button);
    			append(button, i1);
    			append(button, t17);
    			insert(target, t18, anchor);
    			insert(target, tr1, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_4$3(ctx);
    					if_block0.c();
    					if_block0.m(div, t12);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (ctx.pub.code) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block_3$3(ctx);
    					if_block1.c();
    					if_block1.m(div, t13);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (ctx.pub.workshop) {
    				if (if_block2) {
    					if_block2.p(changed, ctx);
    				} else {
    					if_block2 = create_if_block_2$3(ctx);
    					if_block2.c();
    					if_block2.m(div, t14);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (ctx.pub.video) {
    				if (if_block3) {
    					if_block3.p(changed, ctx);
    				} else {
    					if_block3 = create_if_block_1$3(ctx);
    					if_block3.c();
    					if_block3.m(div, t15);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (ctx.pub.demo) {
    				if (if_block4) {
    					if_block4.p(changed, ctx);
    				} else {
    					if_block4 = create_if_block$3(ctx);
    					if_block4.c();
    					if_block4.m(div, t16);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(tr0);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();

    			if (detaching) {
    				detach(t18);
    				detach(tr1);
    			}
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	var link0, t0, link1, t1, div18, main, header, h3, t2, span0, t4, span1, t6, t7, t8, table, tr0, th0, t9, th1, h40, t11, tr1, th2, t12, br0, t13, t14, th3, h50, t16, h60, t18, tr2, th4, t19, br1, t20, t21, th5, h51, t23, h61, span2, t25, span3, t27, t28, p0, t30, tr3, th6, t32, th7, h62, t34, p1, t36, tr4, th8, t37, th9, h41, t39, tr5, th10, t41, th11, h52, t43, p2, t45, div0, a0, button0, i0, t46, t47, tr6, t48, tr7, th12, t50, th13, h53, t52, p3, t54, div1, a1, button1, i1, t55, t56, tr8, t57, tr9, th14, t58, br2, t59, t60, th15, h54, t62, h63, t64, p4, t66, div2, a2, button2, i2, t67, t68, tr10, t69, tr11, th16, t71, th17, h55, t73, h64, t75, p5, t77, div3, a3, button3, i3, t78, t79, tr12, th18, t80, th19, h42, t82, tr13, th20, t83, br3, t84, t85, th21, h56, t87, h65, t89, p6, t91, div4, a4, button4, i4, t92, t93, button5, t95, button6, t97, button7, t99, button8, t101, tr14, t102, tr15, th22, t103, br4, t104, t105, th23, h57, t107, h66, t109, p7, t111, div5, button9, t113, button10, t115, button11, t117, button12, t119, tr16, t120, tr17, th24, t121, br5, t122, t123, th25, h58, t125, h67, t127, p8, t129, div6, button13, t131, button14, t133, button15, t135, tr18, th26, t136, th27, h43, t138, tr19, th28, t139, br6, t140, t141, th29, h59, t143, h68, t145, p9, t147, div7, a5, button16, i5, t148, t149, tr20, t150, tr21, th30, t151, br7, t152, t153, th31, h510, t155, h69, t157, p10, t159, div8, a6, button17, t161, a7, button18, i6, t162, t163, a8, button19, i7, t164, t165, button20, t167, tr22, th32, t168, th33, h44, t170, t171, tr23, th34, t172, th35, h45, t174, tr24, th36, t176, th37, h511, t178, h610, t180, p11, t182, div9, a9, button21, i8, t183, t184, tr25, t185, tr26, th38, t187, th39, h512, t189, p12, t191, div10, a10, button22, i9, t192, t193, a11, button23, i10, t194, t195, tr27, t196, tr28, th40, t198, th41, h513, t200, p13, t202, div11, a12, button24, i11, t203, t204, a13, button25, i12, t205, t206, tr29, th42, t207, th43, h46, t209, tr30, th44, t211, th45, h514, t213, h611, t215, p14, t217, tr31, t218, tr32, th46, t220, th47, h515, t222, h612, t224, p15, t226, tr33, th48, t227, th49, h47, t229, tr34, th50, t230, th51, h516, t232, tr35, th52, t234, th53, h517, t236, tr36, th54, t238, th55, h518, t240, tr37, th56, t241, th57, h48, t243, tr38, th58, t244, br8, t245, t246, th59, h519, t248, h613, t250, p16, t252, div12, a14, button26, i13, t253, t254, tr39, t255, tr40, th60, t257, th61, h520, t259, p17, t261, div13, a15, button27, i14, t262, t263, tr41, t264, tr42, th62, t265, br9, t266, t267, th63, h521, t269, h614, t271, p18, t273, div14, a16, button28, i15, t274, t275, tr43, th64, t276, th65, h49, t278, tr44, th66, t280, th67, a17, h522, t282, tr45, th68, t284, th69, a18, h523, t286, tr46, th70, t288, th71, h524, t290, tr47, th72, t292, th73, a19, h525, t294, tr48, th74, t296, th75, a20, h526, t298, tr49, th76, t300, th77, h527, t302, tr50, th78, t303, th79, h410, t305, tr51, th80, t306, th81, h528, t308, div15, button29, t310, button30, t312, button31, t314, tr52, t315, tr53, th82, t316, th83, h529, t318, div16, button32, t320, button33, t322, button34, t324, button35, t326, button36, t328, button37, t330, tr54, t331, tr55, th84, t332, th85, h530, t334, div17, button38, t336, button39, t338, button40, t340, button41, t342, button42, t344, button43, t346, button44, t348, button45, t350, tr56, t351, tr57, th86, t352, th87, p19, current;

    	var intro = new Intro({ $$inline: true });

    	var social = new Social({ $$inline: true });

    	var each_value = pubs;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

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
    			th4 = element("th");
    			t19 = text("August 2015\n          ");
    			br1 = element("br");
    			t20 = text("\n          - May 2019");
    			t21 = space();
    			th5 = element("th");
    			h51 = element("h5");
    			h51.textContent = "B.S. in Computer Science";
    			t23 = space();
    			h61 = element("h6");
    			span2 = element("span");
    			span2.textContent = "Georgia";
    			t25 = text("\n            Institute of\n            ");
    			span3 = element("span");
    			span3.textContent = "Tech";
    			t27 = text("\n            nology - Atlanta, GA");
    			t28 = space();
    			p0 = element("p");
    			p0.textContent = "Concentration in intelligence and modeling/simulation. Minor in\n            economics. Overall GPA: 3.97/4.0";
    			t30 = space();
    			tr3 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Fall 2017";
    			t32 = space();
    			th7 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t34 = space();
    			p1 = element("p");
    			p1.textContent = "Exchange program with a focus on economics and political science.";
    			t36 = space();
    			tr4 = element("tr");
    			th8 = element("th");
    			t37 = space();
    			th9 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Awards";
    			t39 = space();
    			tr5 = element("tr");
    			th10 = element("th");
    			th10.textContent = "May 2019";
    			t41 = space();
    			th11 = element("th");
    			h52 = element("h5");
    			h52.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t43 = space();
    			p2 = element("p");
    			p2.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t45 = space();
    			div0 = element("div");
    			a0 = element("a");
    			button0 = element("button");
    			i0 = element("i");
    			t46 = text("\n                Website");
    			t47 = space();
    			tr6 = element("tr");
    			t48 = space();
    			tr7 = element("tr");
    			th12 = element("th");
    			th12.textContent = "May 2019";
    			t50 = space();
    			th13 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Love Family Foundation Scholarship";
    			t52 = space();
    			p3 = element("p");
    			p3.textContent = "Award for the undergraduate with the most outstanding scholastic\n            record in the graduating class. Co-awarded the $10,000 scholarship.";
    			t54 = space();
    			div1 = element("div");
    			a1 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t55 = text("\n                Announcement");
    			t56 = space();
    			tr8 = element("tr");
    			t57 = space();
    			tr9 = element("tr");
    			th14 = element("th");
    			t58 = text("August 2015\n          ");
    			br2 = element("br");
    			t59 = text("\n          - May 2019");
    			t60 = space();
    			th15 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Stamps President's Scholar";
    			t62 = space();
    			h63 = element("h6");
    			h63.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t64 = space();
    			p4 = element("p");
    			p4.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 students (27,270 applicants).";
    			t66 = space();
    			div2 = element("div");
    			a2 = element("a");
    			button2 = element("button");
    			i2 = element("i");
    			t67 = text("\n                Website");
    			t68 = space();
    			tr10 = element("tr");
    			t69 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			th16.textContent = "February 3, 2018";
    			t71 = space();
    			th17 = element("th");
    			h55 = element("h5");
    			h55.textContent = "The Data Open Datathon";
    			t73 = space();
    			h64 = element("h6");
    			h64.textContent = "Correlation One and Citadel Securities";
    			t75 = space();
    			p5 = element("p");
    			p5.textContent = "Placed third and won $2,500 for creating a supervised learning\n            system that predicts dangerous road areas.";
    			t77 = space();
    			div3 = element("div");
    			a3 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t78 = text("\n                Press Release");
    			t79 = space();
    			tr12 = element("tr");
    			th18 = element("th");
    			t80 = space();
    			th19 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Industry Experience";
    			t82 = space();
    			tr13 = element("tr");
    			th20 = element("th");
    			t83 = text("May 2018\n          ");
    			br3 = element("br");
    			t84 = text("\n          - August 2018");
    			t85 = space();
    			th21 = element("th");
    			h56 = element("h5");
    			h56.textContent = "Google";
    			t87 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t89 = space();
    			p6 = element("p");
    			p6.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t91 = space();
    			div4 = element("div");
    			a4 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t92 = text("\n                WSJ Article");
    			t93 = space();
    			button5 = element("button");
    			button5.textContent = "Android Auto";
    			t95 = space();
    			button6 = element("button");
    			button6.textContent = "Java";
    			t97 = space();
    			button7 = element("button");
    			button7.textContent = "C++";
    			t99 = space();
    			button8 = element("button");
    			button8.textContent = "Protocol Buffers";
    			t101 = space();
    			tr14 = element("tr");
    			t102 = space();
    			tr15 = element("tr");
    			th22 = element("th");
    			t103 = text("May 2017\n          ");
    			br4 = element("br");
    			t104 = text("\n          - August 2017");
    			t105 = space();
    			th23 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Google";
    			t107 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t109 = space();
    			p7 = element("p");
    			p7.textContent = "Designed and implemented an anomaly detection and trend analysis\n            system for Google's primary data processing pipelines.";
    			t111 = space();
    			div5 = element("div");
    			button9 = element("button");
    			button9.textContent = "Apache Beam/Cloud DataFlow";
    			t113 = space();
    			button10 = element("button");
    			button10.textContent = "Java";
    			t115 = space();
    			button11 = element("button");
    			button11.textContent = "C++";
    			t117 = space();
    			button12 = element("button");
    			button12.textContent = "SQL";
    			t119 = space();
    			tr16 = element("tr");
    			t120 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			t121 = text("May 2016\n          ");
    			br5 = element("br");
    			t122 = text("\n          - August 2016");
    			t123 = space();
    			th25 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Google";
    			t125 = space();
    			h67 = element("h6");
    			h67.textContent = "Engineering Practicum Intern";
    			t127 = space();
    			p8 = element("p");
    			p8.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t129 = space();
    			div6 = element("div");
    			button13 = element("button");
    			button13.textContent = "Go";
    			t131 = space();
    			button14 = element("button");
    			button14.textContent = "BigQuery";
    			t133 = space();
    			button15 = element("button");
    			button15.textContent = "JavaScript";
    			t135 = space();
    			tr18 = element("tr");
    			th26 = element("th");
    			t136 = space();
    			th27 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Research Experience";
    			t138 = space();
    			tr19 = element("tr");
    			th28 = element("th");
    			t139 = text("January 2018\n          ");
    			br6 = element("br");
    			t140 = text("\n          - Present");
    			t141 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Polo Club of Data Science";
    			t143 = space();
    			h68 = element("h6");
    			h68.textContent = "Undergraduate Researcher";
    			t145 = space();
    			p9 = element("p");
    			p9.textContent = "Applying human computer interaction and visualization techniques to\n            help people understand and design more equitable machine learning\n            models.";
    			t147 = space();
    			div7 = element("div");
    			a5 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t148 = text("\n                Polo Club");
    			t149 = space();
    			tr20 = element("tr");
    			t150 = space();
    			tr21 = element("tr");
    			th30 = element("th");
    			t151 = text("September 2015\n          ");
    			br7 = element("br");
    			t152 = text("\n          - May 2017");
    			t153 = space();
    			th31 = element("th");
    			h510 = element("h5");
    			h510.textContent = "PROX-1 Satellite";
    			t155 = space();
    			h69 = element("h6");
    			h69.textContent = "Flight Software Lead and Researcher";
    			t157 = space();
    			p10 = element("p");
    			p10.textContent = "Led a team of engineers in developing and deploying the software for\n            a fully undergraduate-led satellite mission.";
    			t159 = space();
    			div8 = element("div");
    			a6 = element("a");
    			button17 = element("button");
    			button17.textContent = "In space!";
    			t161 = space();
    			a7 = element("a");
    			button18 = element("button");
    			i6 = element("i");
    			t162 = text("\n                Website");
    			t163 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i7 = element("i");
    			t164 = text("\n                Press release");
    			t165 = space();
    			button20 = element("button");
    			button20.textContent = "C";
    			t167 = space();
    			tr22 = element("tr");
    			th32 = element("th");
    			t168 = space();
    			th33 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Publications";
    			t170 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t171 = space();
    			tr23 = element("tr");
    			th34 = element("th");
    			t172 = space();
    			th35 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Projects";
    			t174 = space();
    			tr24 = element("tr");
    			th36 = element("th");
    			th36.textContent = "Fall 2018";
    			t176 = space();
    			th37 = element("th");
    			h511 = element("h5");
    			h511.textContent = "ICLR'19 Reproducibility Challenge";
    			t178 = space();
    			h610 = element("h6");
    			h610.textContent = "Generative Adversarial Models For Learning Private And Fair\n            Representations";
    			t180 = space();
    			p11 = element("p");
    			p11.textContent = "Implemented the architecture and reproduced results for an ICLR'19\n            submission using GANs to decorrelate sensitive data.";
    			t182 = space();
    			div9 = element("div");
    			a9 = element("a");
    			button21 = element("button");
    			i8 = element("i");
    			t183 = text("\n                GitHub");
    			t184 = space();
    			tr25 = element("tr");
    			t185 = space();
    			tr26 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Spring 2018";
    			t187 = space();
    			th39 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Georgia Tech Bus System Analysis";
    			t189 = space();
    			p12 = element("p");
    			p12.textContent = "System that combines Google Maps and graph algorithms to include\n            Georgia Tech bus routes in navigation.";
    			t191 = space();
    			div10 = element("div");
    			a10 = element("a");
    			button22 = element("button");
    			i9 = element("i");
    			t192 = text("\n                Poster");
    			t193 = space();
    			a11 = element("a");
    			button23 = element("button");
    			i10 = element("i");
    			t194 = text("\n                Class");
    			t195 = space();
    			tr27 = element("tr");
    			t196 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Spring 2014";
    			t198 = space();
    			th41 = element("th");
    			h513 = element("h5");
    			h513.textContent = "CTF Resources";
    			t200 = space();
    			p13 = element("p");
    			p13.textContent = "Introductory guide and resources for capture the flag (CTF)\n            competitions with over 800 stars on GitHub.";
    			t202 = space();
    			div11 = element("div");
    			a12 = element("a");
    			button24 = element("button");
    			i11 = element("i");
    			t203 = text("\n                Website");
    			t204 = space();
    			a13 = element("a");
    			button25 = element("button");
    			i12 = element("i");
    			t205 = text("\n                GitHub");
    			t206 = space();
    			tr29 = element("tr");
    			th42 = element("th");
    			t207 = space();
    			th43 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t209 = space();
    			tr30 = element("tr");
    			th44 = element("th");
    			th44.textContent = "Fall 2016, Spring 2017, Spring 2018";
    			t211 = space();
    			th45 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Undergraduate Teaching Assistant";
    			t213 = space();
    			h611 = element("h6");
    			h611.textContent = "CS1332 - Data Structures and Algorithms";
    			t215 = space();
    			p14 = element("p");
    			p14.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t217 = space();
    			tr31 = element("tr");
    			t218 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			th46.textContent = "Fall 2016";
    			t220 = space();
    			th47 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Team Leader";
    			t222 = space();
    			h612 = element("h6");
    			h612.textContent = "GT 1000 - First-Year Seminar";
    			t224 = space();
    			p15 = element("p");
    			p15.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t226 = space();
    			tr33 = element("tr");
    			th48 = element("th");
    			t227 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t229 = space();
    			tr34 = element("tr");
    			th50 = element("th");
    			t230 = space();
    			th51 = element("th");
    			h516 = element("h5");
    			h516.textContent = "Student Volunteer";
    			t232 = space();
    			tr35 = element("tr");
    			th52 = element("th");
    			th52.textContent = "October 2019";
    			t234 = space();
    			th53 = element("th");
    			h517 = element("h5");
    			h517.textContent = "IEEE Visualization Conference (VIS) 2019";
    			t236 = space();
    			tr36 = element("tr");
    			th54 = element("th");
    			th54.textContent = "January 2019";
    			t238 = space();
    			th55 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Fairness, Accountability, and Transparency (FAT*) 2019";
    			t240 = space();
    			tr37 = element("tr");
    			th56 = element("th");
    			t241 = space();
    			th57 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Campus Involvement";
    			t243 = space();
    			tr38 = element("tr");
    			th58 = element("th");
    			t244 = text("September 2015\n          ");
    			br8 = element("br");
    			t245 = text("\n          - April 2017");
    			t246 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "Stamps Scholars National Convention 2017";
    			t248 = space();
    			h613 = element("h6");
    			h613.textContent = "Vice-chair of large events";
    			t250 = space();
    			p16 = element("p");
    			p16.textContent = "Directed a 13 person committee in organizing hotels, meals, and\n            presentations for over 700 students.";
    			t252 = space();
    			div12 = element("div");
    			a14 = element("a");
    			button26 = element("button");
    			i13 = element("i");
    			t253 = text("\n                Website");
    			t254 = space();
    			tr39 = element("tr");
    			t255 = space();
    			tr40 = element("tr");
    			th60 = element("th");
    			th60.textContent = "Spring 2016";
    			t257 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "Tour Guide";
    			t259 = space();
    			p17 = element("p");
    			p17.textContent = "Led a tour of campus for visiting families every week.";
    			t261 = space();
    			div13 = element("div");
    			a15 = element("a");
    			button27 = element("button");
    			i14 = element("i");
    			t262 = text("\n                Website");
    			t263 = space();
    			tr41 = element("tr");
    			t264 = space();
    			tr42 = element("tr");
    			th62 = element("th");
    			t265 = text("September 2015\n          ");
    			br9 = element("br");
    			t266 = text("\n          - May 2016");
    			t267 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "Georgia Tech Student Foundation";
    			t269 = space();
    			h614 = element("h6");
    			h614.textContent = "Investments committee and Freshman Leadership Initiative";
    			t271 = space();
    			p18 = element("p");
    			p18.textContent = "Conducted market research to help manage a $1.2 million endowment\n            and organized fundraising events.";
    			t273 = space();
    			div14 = element("div");
    			a16 = element("a");
    			button28 = element("button");
    			i15 = element("i");
    			t274 = text("\n                Website");
    			t275 = space();
    			tr43 = element("tr");
    			th64 = element("th");
    			t276 = space();
    			th65 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Selected Classes";
    			t278 = space();
    			tr44 = element("tr");
    			th66 = element("th");
    			th66.textContent = "Fall 2018";
    			t280 = space();
    			th67 = element("th");
    			a17 = element("a");
    			h522 = element("h5");
    			h522.textContent = "CS 4803/7643 - Deep Learning";
    			t282 = space();
    			tr45 = element("tr");
    			th68 = element("th");
    			th68.textContent = "Spring 2018";
    			t284 = space();
    			th69 = element("th");
    			a18 = element("a");
    			h523 = element("h5");
    			h523.textContent = "CX 4242/CSE 6242 - Data and Visual Analytics";
    			t286 = space();
    			tr46 = element("tr");
    			th70 = element("th");
    			th70.textContent = "Fall 2017";
    			t288 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			h524.textContent = "BECO 1750A - Money and Banking";
    			t290 = space();
    			tr47 = element("tr");
    			th72 = element("th");
    			th72.textContent = "Spring 2017";
    			t292 = space();
    			th73 = element("th");
    			a19 = element("a");
    			h525 = element("h5");
    			h525.textContent = "CS 4641/7641 - Machine Learning";
    			t294 = space();
    			tr48 = element("tr");
    			th74 = element("th");
    			th74.textContent = "Spring 2017";
    			t296 = space();
    			th75 = element("th");
    			a20 = element("a");
    			h526 = element("h5");
    			h526.textContent = "CX 4230 - Computer Simulation";
    			t298 = space();
    			tr49 = element("tr");
    			th76 = element("th");
    			th76.textContent = "Spring 2017";
    			t300 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			h527.textContent = "CS 3511 - Honors Algorithms";
    			t302 = space();
    			tr50 = element("tr");
    			th78 = element("th");
    			t303 = space();
    			th79 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Skills";
    			t305 = space();
    			tr51 = element("tr");
    			th80 = element("th");
    			t306 = space();
    			th81 = element("th");
    			h528 = element("h5");
    			h528.textContent = "Languages";
    			t308 = space();
    			div15 = element("div");
    			button29 = element("button");
    			button29.textContent = "English - Native";
    			t310 = space();
    			button30 = element("button");
    			button30.textContent = "Spanish - Native";
    			t312 = space();
    			button31 = element("button");
    			button31.textContent = "French - Conversational (B1)";
    			t314 = space();
    			tr52 = element("tr");
    			t315 = space();
    			tr53 = element("tr");
    			th82 = element("th");
    			t316 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "Programming Languages";
    			t318 = space();
    			div16 = element("div");
    			button32 = element("button");
    			button32.textContent = "Java";
    			t320 = space();
    			button33 = element("button");
    			button33.textContent = "Javascript";
    			t322 = space();
    			button34 = element("button");
    			button34.textContent = "Python";
    			t324 = space();
    			button35 = element("button");
    			button35.textContent = "C/C++";
    			t326 = space();
    			button36 = element("button");
    			button36.textContent = "SQL";
    			t328 = space();
    			button37 = element("button");
    			button37.textContent = "Go";
    			t330 = space();
    			tr54 = element("tr");
    			t331 = space();
    			tr55 = element("tr");
    			th84 = element("th");
    			t332 = space();
    			th85 = element("th");
    			h530 = element("h5");
    			h530.textContent = "Technologies";
    			t334 = space();
    			div17 = element("div");
    			button38 = element("button");
    			button38.textContent = "Machine Learning";
    			t336 = space();
    			button39 = element("button");
    			button39.textContent = "Full Stack Development";
    			t338 = space();
    			button40 = element("button");
    			button40.textContent = "React";
    			t340 = space();
    			button41 = element("button");
    			button41.textContent = "Svelte";
    			t342 = space();
    			button42 = element("button");
    			button42.textContent = "Vega";
    			t344 = space();
    			button43 = element("button");
    			button43.textContent = "D3";
    			t346 = space();
    			button44 = element("button");
    			button44.textContent = "PyTorch";
    			t348 = space();
    			button45 = element("button");
    			button45.textContent = "Cloud Dataflow/MapReduce";
    			t350 = space();
    			tr56 = element("tr");
    			t351 = space();
    			tr57 = element("tr");
    			th86 = element("th");
    			t352 = space();
    			th87 = element("th");
    			p19 = element("p");
    			p19.textContent = "Last updated September 3, 2019.";
    			attr(link0, "href", "https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:900,400");
    			attr(link0, "rel", "stylesheet");
    			add_location(link0, file$8, 125, 0, 1734);
    			attr(link1, "rel", "stylesheet");
    			attr(link1, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link1, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link1, "crossorigin", "anonymous");
    			add_location(link1, file$8, 128, 0, 1840);
    			attr(span0, "class", "red svelte-sy8qq4");
    			add_location(span0, file$8, 139, 8, 2143);
    			attr(span1, "class", "red svelte-sy8qq4");
    			add_location(span1, file$8, 141, 8, 2195);
    			attr(h3, "id", "name");
    			attr(h3, "class", "svelte-sy8qq4");
    			add_location(h3, file$8, 137, 6, 2106);
    			attr(header, "id", "head");
    			attr(header, "class", "svelte-sy8qq4");
    			add_location(header, file$8, 136, 4, 2081);
    			attr(th0, "class", "date svelte-sy8qq4");
    			add_location(th0, file$8, 151, 8, 2345);
    			attr(h40, "class", "header svelte-sy8qq4");
    			add_location(h40, file$8, 153, 10, 2388);
    			attr(th1, "class", "svelte-sy8qq4");
    			add_location(th1, file$8, 152, 8, 2373);
    			add_location(tr0, file$8, 150, 6, 2332);
    			add_location(br0, file$8, 159, 10, 2530);
    			attr(th2, "class", "date svelte-sy8qq4");
    			add_location(th2, file$8, 157, 8, 2480);
    			attr(h50, "class", "svelte-sy8qq4");
    			add_location(h50, file$8, 163, 10, 2594);
    			attr(h60, "class", "svelte-sy8qq4");
    			add_location(h60, file$8, 164, 10, 2653);
    			attr(th3, "class", "svelte-sy8qq4");
    			add_location(th3, file$8, 162, 8, 2579);
    			attr(tr1, "class", "item svelte-sy8qq4");
    			add_location(tr1, file$8, 156, 6, 2454);
    			add_location(br1, file$8, 170, 10, 2814);
    			attr(th4, "class", "date svelte-sy8qq4");
    			add_location(th4, file$8, 168, 8, 2764);
    			attr(h51, "class", "svelte-sy8qq4");
    			add_location(h51, file$8, 174, 10, 2879);
    			attr(span2, "class", "gold svelte-sy8qq4");
    			add_location(span2, file$8, 176, 12, 2940);
    			attr(span3, "class", "gold svelte-sy8qq4");
    			add_location(span3, file$8, 178, 12, 3011);
    			attr(h61, "class", "svelte-sy8qq4");
    			add_location(h61, file$8, 175, 10, 2923);
    			attr(p0, "class", "desc svelte-sy8qq4");
    			add_location(p0, file$8, 181, 10, 3101);
    			attr(th5, "class", "svelte-sy8qq4");
    			add_location(th5, file$8, 173, 8, 2864);
    			attr(tr2, "class", "item svelte-sy8qq4");
    			add_location(tr2, file$8, 167, 6, 2738);
    			attr(th6, "class", "date svelte-sy8qq4");
    			add_location(th6, file$8, 188, 8, 3312);
    			attr(h62, "class", "svelte-sy8qq4");
    			add_location(h62, file$8, 190, 10, 3367);
    			attr(p1, "class", "desc svelte-sy8qq4");
    			add_location(p1, file$8, 191, 10, 3414);
    			attr(th7, "class", "svelte-sy8qq4");
    			add_location(th7, file$8, 189, 8, 3352);
    			attr(tr3, "class", "item svelte-sy8qq4");
    			add_location(tr3, file$8, 187, 6, 3286);
    			attr(th8, "class", "date svelte-sy8qq4");
    			add_location(th8, file$8, 198, 8, 3591);
    			attr(h41, "class", "header svelte-sy8qq4");
    			add_location(h41, file$8, 200, 10, 3634);
    			attr(th9, "class", "svelte-sy8qq4");
    			add_location(th9, file$8, 199, 8, 3619);
    			add_location(tr4, file$8, 197, 6, 3578);
    			attr(th10, "class", "date svelte-sy8qq4");
    			add_location(th10, file$8, 204, 8, 3723);
    			attr(h52, "class", "svelte-sy8qq4");
    			add_location(h52, file$8, 206, 10, 3777);
    			attr(p2, "class", "desc svelte-sy8qq4");
    			add_location(p2, file$8, 209, 10, 3888);
    			attr(i0, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i0, file$8, 216, 16, 4165);
    			add_location(button0, file$8, 215, 14, 4140);
    			attr(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$8, 214, 12, 4090);
    			attr(div0, "class", "tags svelte-sy8qq4");
    			add_location(div0, file$8, 213, 10, 4059);
    			attr(th11, "class", "svelte-sy8qq4");
    			add_location(th11, file$8, 205, 8, 3762);
    			attr(tr5, "class", "item svelte-sy8qq4");
    			add_location(tr5, file$8, 203, 6, 3697);
    			attr(tr6, "class", "buffer svelte-sy8qq4");
    			add_location(tr6, file$8, 223, 6, 4306);
    			attr(th12, "class", "date svelte-sy8qq4");
    			add_location(th12, file$8, 225, 8, 4360);
    			attr(h53, "class", "svelte-sy8qq4");
    			add_location(h53, file$8, 227, 10, 4414);
    			attr(p3, "class", "desc svelte-sy8qq4");
    			add_location(p3, file$8, 228, 10, 4468);
    			attr(i1, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i1, file$8, 236, 16, 4880);
    			add_location(button1, file$8, 235, 14, 4855);
    			attr(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$8, 233, 12, 4698);
    			attr(div1, "class", "tags svelte-sy8qq4");
    			add_location(div1, file$8, 232, 10, 4667);
    			attr(th13, "class", "svelte-sy8qq4");
    			add_location(th13, file$8, 226, 8, 4399);
    			attr(tr7, "class", "item svelte-sy8qq4");
    			add_location(tr7, file$8, 224, 6, 4334);
    			attr(tr8, "class", "buffer svelte-sy8qq4");
    			add_location(tr8, file$8, 243, 6, 5026);
    			add_location(br2, file$8, 247, 10, 5130);
    			attr(th14, "class", "date svelte-sy8qq4");
    			add_location(th14, file$8, 245, 8, 5080);
    			attr(h54, "class", "svelte-sy8qq4");
    			add_location(h54, file$8, 251, 10, 5195);
    			attr(h63, "class", "svelte-sy8qq4");
    			add_location(h63, file$8, 252, 10, 5241);
    			attr(p4, "class", "desc svelte-sy8qq4");
    			add_location(p4, file$8, 253, 10, 5317);
    			attr(i2, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i2, file$8, 260, 16, 5599);
    			add_location(button2, file$8, 259, 14, 5574);
    			attr(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$8, 258, 12, 5520);
    			attr(div2, "class", "tags svelte-sy8qq4");
    			add_location(div2, file$8, 257, 10, 5489);
    			attr(th15, "class", "svelte-sy8qq4");
    			add_location(th15, file$8, 250, 8, 5180);
    			attr(tr9, "class", "item svelte-sy8qq4");
    			add_location(tr9, file$8, 244, 6, 5054);
    			attr(tr10, "class", "buffer svelte-sy8qq4");
    			add_location(tr10, file$8, 267, 6, 5740);
    			attr(th16, "class", "date svelte-sy8qq4");
    			add_location(th16, file$8, 269, 8, 5794);
    			attr(h55, "class", "svelte-sy8qq4");
    			add_location(h55, file$8, 271, 10, 5856);
    			attr(h64, "class", "svelte-sy8qq4");
    			add_location(h64, file$8, 272, 10, 5898);
    			attr(p5, "class", "desc svelte-sy8qq4");
    			add_location(p5, file$8, 273, 10, 5956);
    			attr(i3, "class", "far fa-newspaper svelte-sy8qq4");
    			add_location(i3, file$8, 281, 16, 6327);
    			add_location(button3, file$8, 280, 14, 6302);
    			attr(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$8, 278, 12, 6159);
    			attr(div3, "class", "tags svelte-sy8qq4");
    			add_location(div3, file$8, 277, 10, 6128);
    			attr(th17, "class", "svelte-sy8qq4");
    			add_location(th17, file$8, 270, 8, 5841);
    			attr(tr11, "class", "item svelte-sy8qq4");
    			add_location(tr11, file$8, 268, 6, 5768);
    			attr(th18, "class", "date svelte-sy8qq4");
    			add_location(th18, file$8, 290, 8, 6515);
    			attr(h42, "class", "header svelte-sy8qq4");
    			add_location(h42, file$8, 292, 10, 6558);
    			attr(th19, "class", "svelte-sy8qq4");
    			add_location(th19, file$8, 291, 8, 6543);
    			add_location(tr12, file$8, 289, 6, 6502);
    			add_location(br3, file$8, 298, 10, 6707);
    			attr(th20, "class", "date svelte-sy8qq4");
    			add_location(th20, file$8, 296, 8, 6660);
    			attr(h56, "class", "svelte-sy8qq4");
    			add_location(h56, file$8, 302, 10, 6775);
    			attr(h65, "class", "svelte-sy8qq4");
    			add_location(h65, file$8, 303, 10, 6801);
    			attr(p6, "class", "desc svelte-sy8qq4");
    			add_location(p6, file$8, 304, 10, 6848);
    			attr(i4, "class", "far fa-newspaper svelte-sy8qq4");
    			add_location(i4, file$8, 314, 16, 7274);
    			add_location(button4, file$8, 313, 14, 7249);
    			attr(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$8, 310, 12, 7111);
    			add_location(button5, file$8, 318, 12, 7386);
    			add_location(button6, file$8, 319, 12, 7428);
    			add_location(button7, file$8, 320, 12, 7462);
    			add_location(button8, file$8, 321, 12, 7495);
    			attr(div4, "class", "tags svelte-sy8qq4");
    			add_location(div4, file$8, 309, 10, 7080);
    			attr(th21, "class", "svelte-sy8qq4");
    			add_location(th21, file$8, 301, 8, 6760);
    			attr(tr13, "class", "item svelte-sy8qq4");
    			add_location(tr13, file$8, 295, 6, 6634);
    			attr(tr14, "class", "buffer svelte-sy8qq4");
    			add_location(tr14, file$8, 325, 6, 7578);
    			add_location(br4, file$8, 329, 10, 7679);
    			attr(th22, "class", "date svelte-sy8qq4");
    			add_location(th22, file$8, 327, 8, 7632);
    			attr(h57, "class", "svelte-sy8qq4");
    			add_location(h57, file$8, 333, 10, 7747);
    			attr(h66, "class", "svelte-sy8qq4");
    			add_location(h66, file$8, 334, 10, 7773);
    			attr(p7, "class", "desc svelte-sy8qq4");
    			add_location(p7, file$8, 335, 10, 7820);
    			add_location(button9, file$8, 340, 12, 8037);
    			add_location(button10, file$8, 341, 12, 8093);
    			add_location(button11, file$8, 342, 12, 8127);
    			add_location(button12, file$8, 343, 12, 8160);
    			attr(div5, "class", "tags svelte-sy8qq4");
    			add_location(div5, file$8, 339, 10, 8006);
    			attr(th23, "class", "svelte-sy8qq4");
    			add_location(th23, file$8, 332, 8, 7732);
    			attr(tr15, "class", "item svelte-sy8qq4");
    			add_location(tr15, file$8, 326, 6, 7606);
    			attr(tr16, "class", "buffer svelte-sy8qq4");
    			add_location(tr16, file$8, 347, 6, 8230);
    			add_location(br5, file$8, 351, 10, 8331);
    			attr(th24, "class", "date svelte-sy8qq4");
    			add_location(th24, file$8, 349, 8, 8284);
    			attr(h58, "class", "svelte-sy8qq4");
    			add_location(h58, file$8, 355, 10, 8399);
    			attr(h67, "class", "svelte-sy8qq4");
    			add_location(h67, file$8, 356, 10, 8425);
    			attr(p8, "class", "desc svelte-sy8qq4");
    			add_location(p8, file$8, 357, 10, 8473);
    			add_location(button13, file$8, 362, 12, 8658);
    			add_location(button14, file$8, 363, 12, 8690);
    			add_location(button15, file$8, 364, 12, 8728);
    			attr(div6, "class", "tags svelte-sy8qq4");
    			add_location(div6, file$8, 361, 10, 8627);
    			attr(th25, "class", "svelte-sy8qq4");
    			add_location(th25, file$8, 354, 8, 8384);
    			attr(tr17, "class", "item svelte-sy8qq4");
    			add_location(tr17, file$8, 348, 6, 8258);
    			attr(th26, "class", "date svelte-sy8qq4");
    			add_location(th26, file$8, 370, 8, 8842);
    			attr(h43, "class", "header svelte-sy8qq4");
    			add_location(h43, file$8, 372, 10, 8885);
    			attr(th27, "class", "svelte-sy8qq4");
    			add_location(th27, file$8, 371, 8, 8870);
    			add_location(tr18, file$8, 369, 6, 8829);
    			add_location(br6, file$8, 378, 10, 9038);
    			attr(th28, "class", "date svelte-sy8qq4");
    			add_location(th28, file$8, 376, 8, 8987);
    			attr(h59, "class", "svelte-sy8qq4");
    			add_location(h59, file$8, 382, 10, 9102);
    			attr(h68, "class", "svelte-sy8qq4");
    			add_location(h68, file$8, 383, 10, 9147);
    			attr(p9, "class", "desc svelte-sy8qq4");
    			add_location(p9, file$8, 384, 10, 9191);
    			attr(i5, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i5, file$8, 392, 16, 9520);
    			add_location(button16, file$8, 391, 14, 9495);
    			attr(a5, "href", "https://poloclub.github.io/");
    			add_location(a5, file$8, 390, 12, 9442);
    			attr(div7, "class", "tags svelte-sy8qq4");
    			add_location(div7, file$8, 389, 10, 9411);
    			attr(th29, "class", "svelte-sy8qq4");
    			add_location(th29, file$8, 381, 8, 9087);
    			attr(tr19, "class", "item svelte-sy8qq4");
    			add_location(tr19, file$8, 375, 6, 8961);
    			attr(tr20, "class", "buffer svelte-sy8qq4");
    			add_location(tr20, file$8, 399, 6, 9663);
    			add_location(br7, file$8, 403, 10, 9770);
    			attr(th30, "class", "date svelte-sy8qq4");
    			add_location(th30, file$8, 401, 8, 9717);
    			attr(h510, "class", "svelte-sy8qq4");
    			add_location(h510, file$8, 407, 10, 9835);
    			attr(h69, "class", "svelte-sy8qq4");
    			add_location(h69, file$8, 408, 10, 9871);
    			attr(p10, "class", "desc svelte-sy8qq4");
    			add_location(p10, file$8, 409, 10, 9926);
    			add_location(button17, file$8, 416, 14, 10266);
    			attr(a6, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a6, file$8, 414, 12, 10137);
    			attr(i6, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i6, file$8, 420, 16, 10398);
    			add_location(button18, file$8, 419, 14, 10373);
    			attr(a7, "href", "http://prox-1.gatech.edu/");
    			add_location(a7, file$8, 418, 12, 10322);
    			attr(i7, "class", "far fa-newspaper svelte-sy8qq4");
    			add_location(i7, file$8, 427, 16, 10632);
    			add_location(button19, file$8, 426, 14, 10607);
    			attr(a8, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a8, file$8, 424, 12, 10502);
    			add_location(button20, file$8, 431, 12, 10746);
    			attr(div8, "class", "tags svelte-sy8qq4");
    			add_location(div8, file$8, 413, 10, 10106);
    			attr(th31, "class", "svelte-sy8qq4");
    			add_location(th31, file$8, 406, 8, 9820);
    			attr(tr21, "class", "item svelte-sy8qq4");
    			add_location(tr21, file$8, 400, 6, 9691);
    			attr(th32, "class", "date svelte-sy8qq4");
    			add_location(th32, file$8, 437, 8, 10855);
    			attr(h44, "class", "header svelte-sy8qq4");
    			add_location(h44, file$8, 439, 10, 10898);
    			attr(th33, "class", "svelte-sy8qq4");
    			add_location(th33, file$8, 438, 8, 10883);
    			add_location(tr22, file$8, 436, 6, 10842);
    			attr(th34, "class", "date svelte-sy8qq4");
    			add_location(th34, file$8, 514, 8, 13013);
    			attr(h45, "class", "header svelte-sy8qq4");
    			add_location(h45, file$8, 516, 10, 13056);
    			attr(th35, "class", "svelte-sy8qq4");
    			add_location(th35, file$8, 515, 8, 13041);
    			add_location(tr23, file$8, 513, 6, 13000);
    			attr(th36, "class", "date svelte-sy8qq4");
    			add_location(th36, file$8, 520, 8, 13147);
    			attr(h511, "class", "svelte-sy8qq4");
    			add_location(h511, file$8, 522, 10, 13202);
    			attr(h610, "class", "svelte-sy8qq4");
    			add_location(h610, file$8, 523, 10, 13255);
    			attr(p11, "class", "desc svelte-sy8qq4");
    			add_location(p11, file$8, 527, 10, 13386);
    			attr(i8, "class", "fab fa-github svelte-sy8qq4");
    			add_location(i8, file$8, 534, 16, 13701);
    			add_location(button21, file$8, 533, 14, 13676);
    			attr(a9, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a9, file$8, 532, 12, 13603);
    			attr(div9, "class", "tags svelte-sy8qq4");
    			add_location(div9, file$8, 531, 10, 13572);
    			attr(th37, "class", "svelte-sy8qq4");
    			add_location(th37, file$8, 521, 8, 13187);
    			attr(tr24, "class", "item svelte-sy8qq4");
    			add_location(tr24, file$8, 519, 6, 13121);
    			attr(tr25, "class", "buffer svelte-sy8qq4");
    			add_location(tr25, file$8, 541, 6, 13842);
    			attr(th38, "class", "date svelte-sy8qq4");
    			add_location(th38, file$8, 543, 8, 13896);
    			attr(h512, "class", "svelte-sy8qq4");
    			add_location(h512, file$8, 545, 10, 13953);
    			attr(p12, "class", "desc svelte-sy8qq4");
    			add_location(p12, file$8, 546, 10, 14005);
    			attr(i9, "class", "fas fa-file-pdf svelte-sy8qq4");
    			add_location(i9, file$8, 553, 16, 14278);
    			add_location(button22, file$8, 552, 14, 14253);
    			attr(a10, "href", "./gt_bus_analysis.pdf");
    			add_location(a10, file$8, 551, 12, 14206);
    			attr(i10, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i10, file$8, 559, 16, 14481);
    			add_location(button23, file$8, 558, 14, 14456);
    			attr(a11, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a11, file$8, 557, 12, 14384);
    			attr(div10, "class", "tags svelte-sy8qq4");
    			add_location(div10, file$8, 550, 10, 14175);
    			attr(th39, "class", "svelte-sy8qq4");
    			add_location(th39, file$8, 544, 8, 13938);
    			attr(tr26, "class", "item svelte-sy8qq4");
    			add_location(tr26, file$8, 542, 6, 13870);
    			attr(tr27, "class", "buffer svelte-sy8qq4");
    			add_location(tr27, file$8, 566, 6, 14620);
    			attr(th40, "class", "date svelte-sy8qq4");
    			add_location(th40, file$8, 568, 8, 14674);
    			attr(h513, "class", "svelte-sy8qq4");
    			add_location(h513, file$8, 570, 10, 14731);
    			attr(p13, "class", "desc svelte-sy8qq4");
    			add_location(p13, file$8, 571, 10, 14764);
    			attr(i11, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i11, file$8, 578, 16, 15048);
    			add_location(button24, file$8, 577, 14, 15023);
    			attr(a12, "href", "http://ctfs.github.io/resources/");
    			add_location(a12, file$8, 576, 12, 14965);
    			attr(i12, "class", "fab fa-github svelte-sy8qq4");
    			add_location(i12, file$8, 584, 16, 15236);
    			add_location(button25, file$8, 583, 14, 15211);
    			attr(a13, "href", "https://github.com/ctfs/resources");
    			add_location(a13, file$8, 582, 12, 15152);
    			attr(div11, "class", "tags svelte-sy8qq4");
    			add_location(div11, file$8, 575, 10, 14934);
    			attr(th41, "class", "svelte-sy8qq4");
    			add_location(th41, file$8, 569, 8, 14716);
    			attr(tr28, "class", "item svelte-sy8qq4");
    			add_location(tr28, file$8, 567, 6, 14648);
    			attr(th42, "class", "date svelte-sy8qq4");
    			add_location(th42, file$8, 593, 8, 15414);
    			attr(h46, "class", "header svelte-sy8qq4");
    			add_location(h46, file$8, 595, 10, 15457);
    			attr(th43, "class", "svelte-sy8qq4");
    			add_location(th43, file$8, 594, 8, 15442);
    			add_location(tr29, file$8, 592, 6, 15401);
    			attr(th44, "class", "date svelte-sy8qq4");
    			add_location(th44, file$8, 599, 8, 15548);
    			attr(h514, "class", "svelte-sy8qq4");
    			add_location(h514, file$8, 601, 10, 15629);
    			attr(h611, "class", "svelte-sy8qq4");
    			add_location(h611, file$8, 602, 10, 15681);
    			attr(p14, "class", "desc svelte-sy8qq4");
    			add_location(p14, file$8, 603, 10, 15740);
    			attr(th45, "class", "svelte-sy8qq4");
    			add_location(th45, file$8, 600, 8, 15614);
    			attr(tr30, "class", "item svelte-sy8qq4");
    			add_location(tr30, file$8, 598, 6, 15522);
    			attr(tr31, "class", "buffer svelte-sy8qq4");
    			add_location(tr31, file$8, 609, 6, 15925);
    			attr(th46, "class", "date svelte-sy8qq4");
    			add_location(th46, file$8, 611, 8, 15979);
    			attr(h515, "class", "svelte-sy8qq4");
    			add_location(h515, file$8, 613, 10, 16034);
    			attr(h612, "class", "svelte-sy8qq4");
    			add_location(h612, file$8, 614, 10, 16065);
    			attr(p15, "class", "desc svelte-sy8qq4");
    			add_location(p15, file$8, 615, 10, 16113);
    			attr(th47, "class", "svelte-sy8qq4");
    			add_location(th47, file$8, 612, 8, 16019);
    			attr(tr32, "class", "item svelte-sy8qq4");
    			add_location(tr32, file$8, 610, 6, 15953);
    			attr(th48, "class", "date svelte-sy8qq4");
    			add_location(th48, file$8, 623, 8, 16330);
    			attr(h47, "class", "header svelte-sy8qq4");
    			add_location(h47, file$8, 625, 10, 16373);
    			attr(th49, "class", "svelte-sy8qq4");
    			add_location(th49, file$8, 624, 8, 16358);
    			add_location(tr33, file$8, 622, 6, 16317);
    			attr(th50, "class", "date svelte-sy8qq4");
    			add_location(th50, file$8, 629, 8, 16463);
    			attr(h516, "class", "svelte-sy8qq4");
    			add_location(h516, file$8, 631, 10, 16506);
    			attr(th51, "class", "svelte-sy8qq4");
    			add_location(th51, file$8, 630, 8, 16491);
    			attr(tr34, "class", "item svelte-sy8qq4");
    			add_location(tr34, file$8, 628, 6, 16437);
    			attr(th52, "class", "date svelte-sy8qq4");
    			add_location(th52, file$8, 635, 8, 16578);
    			attr(h517, "class", "course svelte-sy8qq4");
    			add_location(h517, file$8, 637, 10, 16636);
    			attr(th53, "class", "svelte-sy8qq4");
    			add_location(th53, file$8, 636, 8, 16621);
    			add_location(tr35, file$8, 634, 6, 16565);
    			attr(th54, "class", "date svelte-sy8qq4");
    			add_location(th54, file$8, 641, 8, 16746);
    			attr(h518, "class", "course svelte-sy8qq4");
    			add_location(h518, file$8, 643, 10, 16804);
    			attr(th55, "class", "svelte-sy8qq4");
    			add_location(th55, file$8, 642, 8, 16789);
    			add_location(tr36, file$8, 640, 6, 16733);
    			attr(th56, "class", "date svelte-sy8qq4");
    			add_location(th56, file$8, 650, 8, 16986);
    			attr(h48, "class", "header svelte-sy8qq4");
    			add_location(h48, file$8, 652, 10, 17029);
    			attr(th57, "class", "svelte-sy8qq4");
    			add_location(th57, file$8, 651, 8, 17014);
    			add_location(tr37, file$8, 649, 6, 16973);
    			add_location(br8, file$8, 658, 10, 17183);
    			attr(th58, "class", "date svelte-sy8qq4");
    			add_location(th58, file$8, 656, 8, 17130);
    			attr(h519, "class", "svelte-sy8qq4");
    			add_location(h519, file$8, 662, 10, 17250);
    			attr(h613, "class", "svelte-sy8qq4");
    			add_location(h613, file$8, 663, 10, 17310);
    			attr(p16, "class", "desc svelte-sy8qq4");
    			add_location(p16, file$8, 664, 10, 17356);
    			attr(i13, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i13, file$8, 671, 16, 17638);
    			add_location(button26, file$8, 670, 14, 17613);
    			attr(a14, "href", "http://ssnc.stampsfoundation.org/");
    			add_location(a14, file$8, 669, 12, 17554);
    			attr(div12, "class", "tags svelte-sy8qq4");
    			add_location(div12, file$8, 668, 10, 17523);
    			attr(th59, "class", "svelte-sy8qq4");
    			add_location(th59, file$8, 661, 8, 17235);
    			attr(tr38, "class", "item svelte-sy8qq4");
    			add_location(tr38, file$8, 655, 6, 17104);
    			attr(tr39, "class", "buffer svelte-sy8qq4");
    			add_location(tr39, file$8, 678, 6, 17779);
    			attr(th60, "class", "date svelte-sy8qq4");
    			add_location(th60, file$8, 680, 8, 17833);
    			attr(h520, "class", "svelte-sy8qq4");
    			add_location(h520, file$8, 682, 10, 17890);
    			attr(p17, "class", "desc svelte-sy8qq4");
    			add_location(p17, file$8, 683, 10, 17920);
    			attr(i14, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i14, file$8, 689, 16, 18146);
    			add_location(button27, file$8, 688, 14, 18121);
    			attr(a15, "href", "http://admission.gatech.edu/gttours");
    			add_location(a15, file$8, 687, 12, 18060);
    			attr(div13, "class", "tags svelte-sy8qq4");
    			add_location(div13, file$8, 686, 10, 18029);
    			attr(th61, "class", "svelte-sy8qq4");
    			add_location(th61, file$8, 681, 8, 17875);
    			attr(tr40, "class", "item svelte-sy8qq4");
    			add_location(tr40, file$8, 679, 6, 17807);
    			attr(tr41, "class", "buffer svelte-sy8qq4");
    			add_location(tr41, file$8, 696, 6, 18287);
    			add_location(br9, file$8, 700, 10, 18394);
    			attr(th62, "class", "date svelte-sy8qq4");
    			add_location(th62, file$8, 698, 8, 18341);
    			attr(h521, "class", "svelte-sy8qq4");
    			add_location(h521, file$8, 704, 10, 18459);
    			attr(h614, "class", "svelte-sy8qq4");
    			add_location(h614, file$8, 705, 10, 18510);
    			attr(p18, "class", "desc svelte-sy8qq4");
    			add_location(p18, file$8, 706, 10, 18586);
    			attr(i15, "class", "fas fa-globe svelte-sy8qq4");
    			add_location(i15, file$8, 714, 16, 18917);
    			add_location(button28, file$8, 713, 14, 18892);
    			attr(a16, "href", "http://www.gtsf.gatech.edu/s/1481/alumni/17/home.aspx?sid=1481&gid=42");
    			add_location(a16, file$8, 711, 12, 18783);
    			attr(div14, "class", "tags svelte-sy8qq4");
    			add_location(div14, file$8, 710, 10, 18752);
    			attr(th63, "class", "svelte-sy8qq4");
    			add_location(th63, file$8, 703, 8, 18444);
    			attr(tr42, "class", "item svelte-sy8qq4");
    			add_location(tr42, file$8, 697, 6, 18315);
    			attr(th64, "class", "date svelte-sy8qq4");
    			add_location(th64, file$8, 723, 8, 19101);
    			attr(h49, "class", "header svelte-sy8qq4");
    			add_location(h49, file$8, 725, 10, 19144);
    			attr(th65, "class", "svelte-sy8qq4");
    			add_location(th65, file$8, 724, 8, 19129);
    			add_location(tr43, file$8, 722, 6, 19088);
    			attr(th66, "class", "date svelte-sy8qq4");
    			add_location(th66, file$8, 729, 8, 19243);
    			attr(h522, "class", "course svelte-sy8qq4");
    			add_location(h522, file$8, 732, 12, 19375);
    			attr(a17, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a17, file$8, 731, 10, 19298);
    			attr(th67, "class", "svelte-sy8qq4");
    			add_location(th67, file$8, 730, 8, 19283);
    			attr(tr44, "class", "item svelte-sy8qq4");
    			add_location(tr44, file$8, 728, 6, 19217);
    			attr(th68, "class", "date svelte-sy8qq4");
    			add_location(th68, file$8, 737, 8, 19501);
    			attr(h523, "class", "course svelte-sy8qq4");
    			add_location(h523, file$8, 740, 12, 19627);
    			attr(a18, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a18, file$8, 739, 10, 19558);
    			attr(th69, "class", "svelte-sy8qq4");
    			add_location(th69, file$8, 738, 8, 19543);
    			attr(tr45, "class", "item svelte-sy8qq4");
    			add_location(tr45, file$8, 736, 6, 19475);
    			attr(th70, "class", "date svelte-sy8qq4");
    			add_location(th70, file$8, 745, 8, 19769);
    			attr(h524, "class", "course svelte-sy8qq4");
    			add_location(h524, file$8, 747, 10, 19824);
    			attr(th71, "class", "svelte-sy8qq4");
    			add_location(th71, file$8, 746, 8, 19809);
    			attr(tr46, "class", "item svelte-sy8qq4");
    			add_location(tr46, file$8, 744, 6, 19743);
    			attr(th72, "class", "date svelte-sy8qq4");
    			add_location(th72, file$8, 751, 8, 19937);
    			attr(h525, "class", "course svelte-sy8qq4");
    			add_location(h525, file$8, 754, 12, 20071);
    			attr(a19, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a19, file$8, 753, 10, 19994);
    			attr(th73, "class", "svelte-sy8qq4");
    			add_location(th73, file$8, 752, 8, 19979);
    			attr(tr47, "class", "item svelte-sy8qq4");
    			add_location(tr47, file$8, 750, 6, 19911);
    			attr(th74, "class", "date svelte-sy8qq4");
    			add_location(th74, file$8, 759, 8, 20200);
    			attr(h526, "class", "course svelte-sy8qq4");
    			add_location(h526, file$8, 762, 12, 20311);
    			attr(a20, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a20, file$8, 761, 10, 20257);
    			attr(th75, "class", "svelte-sy8qq4");
    			add_location(th75, file$8, 760, 8, 20242);
    			attr(tr48, "class", "item svelte-sy8qq4");
    			add_location(tr48, file$8, 758, 6, 20174);
    			attr(th76, "class", "date svelte-sy8qq4");
    			add_location(th76, file$8, 767, 8, 20438);
    			attr(h527, "class", "course svelte-sy8qq4");
    			add_location(h527, file$8, 769, 10, 20495);
    			attr(th77, "class", "svelte-sy8qq4");
    			add_location(th77, file$8, 768, 8, 20480);
    			attr(tr49, "class", "item svelte-sy8qq4");
    			add_location(tr49, file$8, 766, 6, 20412);
    			attr(th78, "class", "date svelte-sy8qq4");
    			add_location(th78, file$8, 774, 8, 20614);
    			attr(h410, "class", "header svelte-sy8qq4");
    			add_location(h410, file$8, 776, 10, 20657);
    			attr(th79, "class", "svelte-sy8qq4");
    			add_location(th79, file$8, 775, 8, 20642);
    			add_location(tr50, file$8, 773, 6, 20601);
    			attr(th80, "class", "date svelte-sy8qq4");
    			add_location(th80, file$8, 780, 8, 20746);
    			attr(h528, "class", "svelte-sy8qq4");
    			add_location(h528, file$8, 782, 10, 20789);
    			add_location(button29, file$8, 784, 12, 20849);
    			add_location(button30, file$8, 785, 12, 20895);
    			add_location(button31, file$8, 786, 12, 20941);
    			attr(div15, "class", "tags svelte-sy8qq4");
    			add_location(div15, file$8, 783, 10, 20818);
    			attr(th81, "class", "svelte-sy8qq4");
    			add_location(th81, file$8, 781, 8, 20774);
    			attr(tr51, "class", "item svelte-sy8qq4");
    			add_location(tr51, file$8, 779, 6, 20720);
    			attr(tr52, "class", "buffer svelte-sy8qq4");
    			add_location(tr52, file$8, 790, 6, 21036);
    			attr(th82, "class", "date svelte-sy8qq4");
    			add_location(th82, file$8, 792, 8, 21090);
    			attr(h529, "class", "svelte-sy8qq4");
    			add_location(h529, file$8, 794, 10, 21133);
    			add_location(button32, file$8, 796, 12, 21205);
    			add_location(button33, file$8, 797, 12, 21239);
    			add_location(button34, file$8, 798, 12, 21279);
    			add_location(button35, file$8, 799, 12, 21315);
    			add_location(button36, file$8, 800, 12, 21350);
    			add_location(button37, file$8, 801, 12, 21383);
    			attr(div16, "class", "tags svelte-sy8qq4");
    			add_location(div16, file$8, 795, 10, 21174);
    			attr(th83, "class", "svelte-sy8qq4");
    			add_location(th83, file$8, 793, 8, 21118);
    			attr(tr53, "class", "item svelte-sy8qq4");
    			add_location(tr53, file$8, 791, 6, 21064);
    			attr(tr54, "class", "buffer svelte-sy8qq4");
    			add_location(tr54, file$8, 805, 6, 21452);
    			attr(th84, "class", "date svelte-sy8qq4");
    			add_location(th84, file$8, 807, 8, 21506);
    			attr(h530, "class", "svelte-sy8qq4");
    			add_location(h530, file$8, 809, 10, 21549);
    			add_location(button38, file$8, 811, 12, 21612);
    			add_location(button39, file$8, 812, 12, 21658);
    			add_location(button40, file$8, 813, 12, 21710);
    			add_location(button41, file$8, 814, 12, 21745);
    			add_location(button42, file$8, 815, 12, 21781);
    			add_location(button43, file$8, 816, 12, 21815);
    			add_location(button44, file$8, 817, 12, 21847);
    			add_location(button45, file$8, 818, 12, 21884);
    			attr(div17, "class", "tags svelte-sy8qq4");
    			add_location(div17, file$8, 810, 10, 21581);
    			attr(th85, "class", "svelte-sy8qq4");
    			add_location(th85, file$8, 808, 8, 21534);
    			attr(tr55, "class", "item svelte-sy8qq4");
    			add_location(tr55, file$8, 806, 6, 21480);
    			attr(tr56, "class", "buffer svelte-sy8qq4");
    			add_location(tr56, file$8, 822, 6, 21975);
    			attr(th86, "class", "date svelte-sy8qq4");
    			add_location(th86, file$8, 824, 8, 22029);
    			attr(p19, "class", "desc svelte-sy8qq4");
    			add_location(p19, file$8, 826, 10, 22072);
    			attr(th87, "class", "svelte-sy8qq4");
    			add_location(th87, file$8, 825, 8, 22057);
    			attr(tr57, "class", "item svelte-sy8qq4");
    			add_location(tr57, file$8, 823, 6, 22003);
    			attr(table, "class", "svelte-sy8qq4");
    			add_location(table, file$8, 148, 4, 2293);
    			attr(main, "class", "svelte-sy8qq4");
    			add_location(main, file$8, 135, 2, 2070);
    			attr(div18, "id", "container");
    			add_location(div18, file$8, 134, 0, 2047);
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
    			append(tr2, th4);
    			append(th4, t19);
    			append(th4, br1);
    			append(th4, t20);
    			append(tr2, t21);
    			append(tr2, th5);
    			append(th5, h51);
    			append(th5, t23);
    			append(th5, h61);
    			append(h61, span2);
    			append(h61, t25);
    			append(h61, span3);
    			append(h61, t27);
    			append(th5, t28);
    			append(th5, p0);
    			append(table, t30);
    			append(table, tr3);
    			append(tr3, th6);
    			append(tr3, t32);
    			append(tr3, th7);
    			append(th7, h62);
    			append(th7, t34);
    			append(th7, p1);
    			append(table, t36);
    			append(table, tr4);
    			append(tr4, th8);
    			append(tr4, t37);
    			append(tr4, th9);
    			append(th9, h41);
    			append(table, t39);
    			append(table, tr5);
    			append(tr5, th10);
    			append(tr5, t41);
    			append(tr5, th11);
    			append(th11, h52);
    			append(th11, t43);
    			append(th11, p2);
    			append(th11, t45);
    			append(th11, div0);
    			append(div0, a0);
    			append(a0, button0);
    			append(button0, i0);
    			append(button0, t46);
    			append(table, t47);
    			append(table, tr6);
    			append(table, t48);
    			append(table, tr7);
    			append(tr7, th12);
    			append(tr7, t50);
    			append(tr7, th13);
    			append(th13, h53);
    			append(th13, t52);
    			append(th13, p3);
    			append(th13, t54);
    			append(th13, div1);
    			append(div1, a1);
    			append(a1, button1);
    			append(button1, i1);
    			append(button1, t55);
    			append(table, t56);
    			append(table, tr8);
    			append(table, t57);
    			append(table, tr9);
    			append(tr9, th14);
    			append(th14, t58);
    			append(th14, br2);
    			append(th14, t59);
    			append(tr9, t60);
    			append(tr9, th15);
    			append(th15, h54);
    			append(th15, t62);
    			append(th15, h63);
    			append(th15, t64);
    			append(th15, p4);
    			append(th15, t66);
    			append(th15, div2);
    			append(div2, a2);
    			append(a2, button2);
    			append(button2, i2);
    			append(button2, t67);
    			append(table, t68);
    			append(table, tr10);
    			append(table, t69);
    			append(table, tr11);
    			append(tr11, th16);
    			append(tr11, t71);
    			append(tr11, th17);
    			append(th17, h55);
    			append(th17, t73);
    			append(th17, h64);
    			append(th17, t75);
    			append(th17, p5);
    			append(th17, t77);
    			append(th17, div3);
    			append(div3, a3);
    			append(a3, button3);
    			append(button3, i3);
    			append(button3, t78);
    			append(table, t79);
    			append(table, tr12);
    			append(tr12, th18);
    			append(tr12, t80);
    			append(tr12, th19);
    			append(th19, h42);
    			append(table, t82);
    			append(table, tr13);
    			append(tr13, th20);
    			append(th20, t83);
    			append(th20, br3);
    			append(th20, t84);
    			append(tr13, t85);
    			append(tr13, th21);
    			append(th21, h56);
    			append(th21, t87);
    			append(th21, h65);
    			append(th21, t89);
    			append(th21, p6);
    			append(th21, t91);
    			append(th21, div4);
    			append(div4, a4);
    			append(a4, button4);
    			append(button4, i4);
    			append(button4, t92);
    			append(div4, t93);
    			append(div4, button5);
    			append(div4, t95);
    			append(div4, button6);
    			append(div4, t97);
    			append(div4, button7);
    			append(div4, t99);
    			append(div4, button8);
    			append(table, t101);
    			append(table, tr14);
    			append(table, t102);
    			append(table, tr15);
    			append(tr15, th22);
    			append(th22, t103);
    			append(th22, br4);
    			append(th22, t104);
    			append(tr15, t105);
    			append(tr15, th23);
    			append(th23, h57);
    			append(th23, t107);
    			append(th23, h66);
    			append(th23, t109);
    			append(th23, p7);
    			append(th23, t111);
    			append(th23, div5);
    			append(div5, button9);
    			append(div5, t113);
    			append(div5, button10);
    			append(div5, t115);
    			append(div5, button11);
    			append(div5, t117);
    			append(div5, button12);
    			append(table, t119);
    			append(table, tr16);
    			append(table, t120);
    			append(table, tr17);
    			append(tr17, th24);
    			append(th24, t121);
    			append(th24, br5);
    			append(th24, t122);
    			append(tr17, t123);
    			append(tr17, th25);
    			append(th25, h58);
    			append(th25, t125);
    			append(th25, h67);
    			append(th25, t127);
    			append(th25, p8);
    			append(th25, t129);
    			append(th25, div6);
    			append(div6, button13);
    			append(div6, t131);
    			append(div6, button14);
    			append(div6, t133);
    			append(div6, button15);
    			append(table, t135);
    			append(table, tr18);
    			append(tr18, th26);
    			append(tr18, t136);
    			append(tr18, th27);
    			append(th27, h43);
    			append(table, t138);
    			append(table, tr19);
    			append(tr19, th28);
    			append(th28, t139);
    			append(th28, br6);
    			append(th28, t140);
    			append(tr19, t141);
    			append(tr19, th29);
    			append(th29, h59);
    			append(th29, t143);
    			append(th29, h68);
    			append(th29, t145);
    			append(th29, p9);
    			append(th29, t147);
    			append(th29, div7);
    			append(div7, a5);
    			append(a5, button16);
    			append(button16, i5);
    			append(button16, t148);
    			append(table, t149);
    			append(table, tr20);
    			append(table, t150);
    			append(table, tr21);
    			append(tr21, th30);
    			append(th30, t151);
    			append(th30, br7);
    			append(th30, t152);
    			append(tr21, t153);
    			append(tr21, th31);
    			append(th31, h510);
    			append(th31, t155);
    			append(th31, h69);
    			append(th31, t157);
    			append(th31, p10);
    			append(th31, t159);
    			append(th31, div8);
    			append(div8, a6);
    			append(a6, button17);
    			append(div8, t161);
    			append(div8, a7);
    			append(a7, button18);
    			append(button18, i6);
    			append(button18, t162);
    			append(div8, t163);
    			append(div8, a8);
    			append(a8, button19);
    			append(button19, i7);
    			append(button19, t164);
    			append(div8, t165);
    			append(div8, button20);
    			append(table, t167);
    			append(table, tr22);
    			append(tr22, th32);
    			append(tr22, t168);
    			append(tr22, th33);
    			append(th33, h44);
    			append(table, t170);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append(table, t171);
    			append(table, tr23);
    			append(tr23, th34);
    			append(tr23, t172);
    			append(tr23, th35);
    			append(th35, h45);
    			append(table, t174);
    			append(table, tr24);
    			append(tr24, th36);
    			append(tr24, t176);
    			append(tr24, th37);
    			append(th37, h511);
    			append(th37, t178);
    			append(th37, h610);
    			append(th37, t180);
    			append(th37, p11);
    			append(th37, t182);
    			append(th37, div9);
    			append(div9, a9);
    			append(a9, button21);
    			append(button21, i8);
    			append(button21, t183);
    			append(table, t184);
    			append(table, tr25);
    			append(table, t185);
    			append(table, tr26);
    			append(tr26, th38);
    			append(tr26, t187);
    			append(tr26, th39);
    			append(th39, h512);
    			append(th39, t189);
    			append(th39, p12);
    			append(th39, t191);
    			append(th39, div10);
    			append(div10, a10);
    			append(a10, button22);
    			append(button22, i9);
    			append(button22, t192);
    			append(div10, t193);
    			append(div10, a11);
    			append(a11, button23);
    			append(button23, i10);
    			append(button23, t194);
    			append(table, t195);
    			append(table, tr27);
    			append(table, t196);
    			append(table, tr28);
    			append(tr28, th40);
    			append(tr28, t198);
    			append(tr28, th41);
    			append(th41, h513);
    			append(th41, t200);
    			append(th41, p13);
    			append(th41, t202);
    			append(th41, div11);
    			append(div11, a12);
    			append(a12, button24);
    			append(button24, i11);
    			append(button24, t203);
    			append(div11, t204);
    			append(div11, a13);
    			append(a13, button25);
    			append(button25, i12);
    			append(button25, t205);
    			append(table, t206);
    			append(table, tr29);
    			append(tr29, th42);
    			append(tr29, t207);
    			append(tr29, th43);
    			append(th43, h46);
    			append(table, t209);
    			append(table, tr30);
    			append(tr30, th44);
    			append(tr30, t211);
    			append(tr30, th45);
    			append(th45, h514);
    			append(th45, t213);
    			append(th45, h611);
    			append(th45, t215);
    			append(th45, p14);
    			append(table, t217);
    			append(table, tr31);
    			append(table, t218);
    			append(table, tr32);
    			append(tr32, th46);
    			append(tr32, t220);
    			append(tr32, th47);
    			append(th47, h515);
    			append(th47, t222);
    			append(th47, h612);
    			append(th47, t224);
    			append(th47, p15);
    			append(table, t226);
    			append(table, tr33);
    			append(tr33, th48);
    			append(tr33, t227);
    			append(tr33, th49);
    			append(th49, h47);
    			append(table, t229);
    			append(table, tr34);
    			append(tr34, th50);
    			append(tr34, t230);
    			append(tr34, th51);
    			append(th51, h516);
    			append(table, t232);
    			append(table, tr35);
    			append(tr35, th52);
    			append(tr35, t234);
    			append(tr35, th53);
    			append(th53, h517);
    			append(table, t236);
    			append(table, tr36);
    			append(tr36, th54);
    			append(tr36, t238);
    			append(tr36, th55);
    			append(th55, h518);
    			append(table, t240);
    			append(table, tr37);
    			append(tr37, th56);
    			append(tr37, t241);
    			append(tr37, th57);
    			append(th57, h48);
    			append(table, t243);
    			append(table, tr38);
    			append(tr38, th58);
    			append(th58, t244);
    			append(th58, br8);
    			append(th58, t245);
    			append(tr38, t246);
    			append(tr38, th59);
    			append(th59, h519);
    			append(th59, t248);
    			append(th59, h613);
    			append(th59, t250);
    			append(th59, p16);
    			append(th59, t252);
    			append(th59, div12);
    			append(div12, a14);
    			append(a14, button26);
    			append(button26, i13);
    			append(button26, t253);
    			append(table, t254);
    			append(table, tr39);
    			append(table, t255);
    			append(table, tr40);
    			append(tr40, th60);
    			append(tr40, t257);
    			append(tr40, th61);
    			append(th61, h520);
    			append(th61, t259);
    			append(th61, p17);
    			append(th61, t261);
    			append(th61, div13);
    			append(div13, a15);
    			append(a15, button27);
    			append(button27, i14);
    			append(button27, t262);
    			append(table, t263);
    			append(table, tr41);
    			append(table, t264);
    			append(table, tr42);
    			append(tr42, th62);
    			append(th62, t265);
    			append(th62, br9);
    			append(th62, t266);
    			append(tr42, t267);
    			append(tr42, th63);
    			append(th63, h521);
    			append(th63, t269);
    			append(th63, h614);
    			append(th63, t271);
    			append(th63, p18);
    			append(th63, t273);
    			append(th63, div14);
    			append(div14, a16);
    			append(a16, button28);
    			append(button28, i15);
    			append(button28, t274);
    			append(table, t275);
    			append(table, tr43);
    			append(tr43, th64);
    			append(tr43, t276);
    			append(tr43, th65);
    			append(th65, h49);
    			append(table, t278);
    			append(table, tr44);
    			append(tr44, th66);
    			append(tr44, t280);
    			append(tr44, th67);
    			append(th67, a17);
    			append(a17, h522);
    			append(table, t282);
    			append(table, tr45);
    			append(tr45, th68);
    			append(tr45, t284);
    			append(tr45, th69);
    			append(th69, a18);
    			append(a18, h523);
    			append(table, t286);
    			append(table, tr46);
    			append(tr46, th70);
    			append(tr46, t288);
    			append(tr46, th71);
    			append(th71, h524);
    			append(table, t290);
    			append(table, tr47);
    			append(tr47, th72);
    			append(tr47, t292);
    			append(tr47, th73);
    			append(th73, a19);
    			append(a19, h525);
    			append(table, t294);
    			append(table, tr48);
    			append(tr48, th74);
    			append(tr48, t296);
    			append(tr48, th75);
    			append(th75, a20);
    			append(a20, h526);
    			append(table, t298);
    			append(table, tr49);
    			append(tr49, th76);
    			append(tr49, t300);
    			append(tr49, th77);
    			append(th77, h527);
    			append(table, t302);
    			append(table, tr50);
    			append(tr50, th78);
    			append(tr50, t303);
    			append(tr50, th79);
    			append(th79, h410);
    			append(table, t305);
    			append(table, tr51);
    			append(tr51, th80);
    			append(tr51, t306);
    			append(tr51, th81);
    			append(th81, h528);
    			append(th81, t308);
    			append(th81, div15);
    			append(div15, button29);
    			append(div15, t310);
    			append(div15, button30);
    			append(div15, t312);
    			append(div15, button31);
    			append(table, t314);
    			append(table, tr52);
    			append(table, t315);
    			append(table, tr53);
    			append(tr53, th82);
    			append(tr53, t316);
    			append(tr53, th83);
    			append(th83, h529);
    			append(th83, t318);
    			append(th83, div16);
    			append(div16, button32);
    			append(div16, t320);
    			append(div16, button33);
    			append(div16, t322);
    			append(div16, button34);
    			append(div16, t324);
    			append(div16, button35);
    			append(div16, t326);
    			append(div16, button36);
    			append(div16, t328);
    			append(div16, button37);
    			append(table, t330);
    			append(table, tr54);
    			append(table, t331);
    			append(table, tr55);
    			append(tr55, th84);
    			append(tr55, t332);
    			append(tr55, th85);
    			append(th85, h530);
    			append(th85, t334);
    			append(th85, div17);
    			append(div17, button38);
    			append(div17, t336);
    			append(div17, button39);
    			append(div17, t338);
    			append(div17, button40);
    			append(div17, t340);
    			append(div17, button41);
    			append(div17, t342);
    			append(div17, button42);
    			append(div17, t344);
    			append(div17, button43);
    			append(div17, t346);
    			append(div17, button44);
    			append(div17, t348);
    			append(div17, button45);
    			append(table, t350);
    			append(table, tr56);
    			append(table, t351);
    			append(table, tr57);
    			append(tr57, th86);
    			append(tr57, t352);
    			append(tr57, th87);
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
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, t171);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			transition_in(social.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			transition_out(social.$$.fragment, local);
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
    		init(this, options, null, create_fragment$9, safe_not_equal, []);
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

    function create_fragment$a(ctx) {
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

    function instance$3($$self) {
    	

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
    		init(this, options, instance$3, create_fragment$a, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
