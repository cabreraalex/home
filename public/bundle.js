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
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    	var div1, div0, a0, img, t0, h1, span0, t2, br0, t3, span1, t5, span2, t7, br1, t8, span3, t10, t11, a1, button0, t13, a2, button1, current;

    	var social = new Social({ $$inline: true });

    	return {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			h1 = element("h1");
    			span0 = element("span");
    			span0.textContent = "Ángel ";
    			t2 = space();
    			br0 = element("br");
    			t3 = space();
    			span1 = element("span");
    			span1.textContent = "Alex";
    			t5 = space();
    			span2 = element("span");
    			span2.textContent = "ander";
    			t7 = space();
    			br1 = element("br");
    			t8 = space();
    			span3 = element("span");
    			span3.textContent = "Cabrera";
    			t10 = space();
    			social.$$.fragment.c();
    			t11 = space();
    			a1 = element("a");
    			button0 = element("button");
    			button0.textContent = "CV (web)";
    			t13 = space();
    			a2 = element("a");
    			button1 = element("button");
    			button1.textContent = "CV (pdf)";
    			attr(img, "width", "170px");
    			attr(img, "src", "images/profile.jpg");
    			attr(img, "alt", "profile picture");
    			add_location(img, file$1, 22, 6, 331);
    			attr(a0, "href", "/");
    			add_location(a0, file$1, 21, 4, 312);
    			attr(span0, "class", "color svelte-zh09u5");
    			add_location(span0, file$1, 25, 6, 434);
    			add_location(br0, file$1, 26, 6, 479);
    			attr(span1, "class", "color red svelte-zh09u5");
    			add_location(span1, file$1, 27, 6, 492);
    			attr(span2, "class", "color svelte-zh09u5");
    			add_location(span2, file$1, 28, 6, 534);
    			add_location(br1, file$1, 29, 6, 573);
    			attr(span3, "class", "color red svelte-zh09u5");
    			add_location(span3, file$1, 30, 6, 586);
    			attr(h1, "id", "name");
    			attr(h1, "class", "svelte-zh09u5");
    			add_location(h1, file$1, 24, 4, 413);
    			attr(button0, "class", "cv");
    			add_location(button0, file$1, 34, 6, 677);
    			attr(a1, "href", "/#/cv");
    			add_location(a1, file$1, 33, 4, 654);
    			attr(button1, "class", "cv");
    			add_location(button1, file$1, 37, 6, 752);
    			attr(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 36, 4, 727);
    			attr(div0, "id", "padded-sidebar");
    			attr(div0, "class", "svelte-zh09u5");
    			add_location(div0, file$1, 20, 2, 282);
    			attr(div1, "id", "sidebar");
    			attr(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$1, 19, 0, 230);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, a0);
    			append(a0, img);
    			append(div0, t0);
    			append(div0, h1);
    			append(h1, span0);
    			append(h1, t2);
    			append(h1, br0);
    			append(h1, t3);
    			append(h1, span1);
    			append(h1, t5);
    			append(h1, span2);
    			append(h1, t7);
    			append(h1, br1);
    			append(h1, t8);
    			append(h1, span3);
    			append(div0, t10);
    			mount_component(social, div0, null);
    			append(div0, t11);
    			append(div0, a1);
    			append(a1, button0);
    			append(div0, t13);
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

    // (15:6) {#each news as n}
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
    			attr(p0, "class", "pure-u-1 pure-u-md-1-5 date");
    			add_location(p0, file$3, 16, 10, 468);
    			attr(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$3, 17, 10, 530);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$3, 15, 8, 427);
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
    			add_location(h1, file$3, 13, 6, 381);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$3, 12, 4, 349);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$3, 11, 2, 295);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$3, 9, 0, 238);
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

    function instance$1($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	return {};
    }

    class News extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$4, safe_not_equal, []);
    	}
    }

    var pubs = [
      {
        title:
          "FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning",
        desc:
          "FairVis is a visual analytics system that enables data scientists to find potential biases in their machine learning models. It allows users to split their data into subgroups of different features to see how vulnerable groups are performing for various fairness metrics. Additionally, it suggests groups that may be underperforming and can find similar groups.",
        id: "fairvis",
        teaser: "fairvis.png",
        venue: "IEEE VIS'19",
        venuelong: "IEEE Transactions on Visualization and Computer Graphics",
        year: "2019",
        month: "October",
        location: "Vancouver, Canada",
        authors: [
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com"
          },
          {
            name: "Will Epperson",
            website: "http://willepperson.com"
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com"
          },
          {
            name: "Minsuk Kahng",
            website: "https://minsuk.com"
          },
          {
            name: "Jamie Morgenstern",
            website: "http://jamiemorgenstern.com"
          },
          {
            name: "Duen Horng (Polo) Chau",
            website: "https://poloclub.github.io/polochau/"
          }
        ],
        bibtex:
          "@article{cabrera2019fairvis, title={FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, author={Cabrera, {'A}ngel Alexander and Epperson, Will and Hohman, Fred and Kahng, Minsuk and Morgenstern, Jamie and Chau, Duen Horng}, journal={IEEE Conference on Visual Analytics Science and Technology (VAST)}, year={2019}, publisher={IEEE}}",
        abstract:
          "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
        demo: "https://poloclub.github.io/FairVis/",
        code: "https://github.com/poloclub/FairVis",
        blog:
          "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
        pdf: "https://arxiv.org/abs/1904.05419"
      },
      {
        title:
          "Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation",
        desc:
          "We introduce a method for automatically generating subgroups of instances that a model may be biased against. The instances are first clustered and then described by their dominating features. By ranking and sorting the groups by their performance metrics (F1, accuracy, etc. ) users can spot groups that are underperforming.",
        id: "subgroup-gen",
        teaser: "iclr.png",
        venue: "Workshop, ICLR'19",
        venuelong: "Debugging Machine Learning Models Workshop at ICLR (Debug ML)",
        year: "2019",
        month: "May",
        location: "New Orleans, Louisiana, USA",
        authors: [
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com"
          },
          {
            name: "Minsuk Kahng",
            website: "https://minsuk.com"
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com"
          },
          {
            name: "Jamie Morgenstern",
            website: "http://jamiemorgenstern.com"
          },
          {
            name: "Duen Horng (Polo) Chau",
            website: "https://poloclub.github.io/polochau/"
          }
        ],
        bibtex:
          "@article{cabrera2019discovery, title={Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation}, author={Cabrera, {'A}ngel Alexander and Kahng, Minsuk and Hohman, Fred and Morgenstern, Jamie and Chau, Duen Horng}, journal={Debugging Machine Learning Models Workshop (Debug ML) at ICLR}, year={2019}}",
        abstract:
          "As machine learning is applied to data about people, it is crucial to understand how learned models treat different demographic groups. Many factors, including what training data and class of models are used, can encode biased behavior into learned outcomes. These biases are often small when considering a single feature (e.g., sex or race) in isolation, but appear more blatantly at the intersection of multiple features. We present our ongoing work of designing automatic techniques and interactive tools to help users discover subgroups of data instances on which a model underperforms. Using a bottom-up clustering technique for subgroup generation, users can quickly find areas of a dataset in which their models are encoding bias. Our work presents some of the first user-focused, interactive methods for discovering bias in machine learning models.",
        pdf:
          "https://debug-ml-iclr2019.github.io/cameraready/DebugML-19_paper_3.pdf",
        workshop: "https://debug-ml-iclr2019.github.io/"
      },
      {
        title: "Interactive Classification for Deep Learning Interpretation",
        desc:
          "We developed an interactive system that allows users to modify images to explore the weaknesses and strenghts of image classification models. Users can 'inpaint' or remove parts of an image and see how it impacts their classification.",
        id: "interactive-classification",
        teaser: "interactive.png",
        venue: "Demo, CVPR'18",
        venuelong: "Demo at IEEE Computer Vision and Pattern Recognition (CVPR)",
        year: "2018",
        month: "June",
        location: "Salt Lake City, Utah, USA",
        authors: [
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com"
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com"
          },
          {
            name: "Jason Lin",
            website: "http://jlin.xyz"
          },
          {
            name: "Duen Horng (Polo) Chau",
            website: "https://poloclub.github.io/polochau/"
          }
        ],
        bibtex:
          "@article{cabrera2018interactive, title={Interactive Classification for Deep Learning Interpretation}, author={Cabrera, {'A}ngel Alexander and Hohman, Fred and Lin, Jason and Chau, Duen Horng}, journal={Demo, IEEE Conference on Computer Vision and Pattern Recognition (CVPR)}, year={2018}, organization={IEEE}}",
        abstract:
          "We present an interactive system enabling users to manipulate images to explore the robustness and sensitivity of deep learning image classifiers. Using modern web technologies to run in-browser inference, users can remove image features using inpainting algorithms to obtain new classifications in real time. This system allows users to compare and contrast what image regions humans and machine learning models use for classification.",
        website: "http://fredhohman.com/papers/interactive-classification",
        pdf: "https://arxiv.org/abs/1806.05660",
        video: "https://www.youtube.com/watch?v=llub5GcOF6w",
        demo: "https://cabreraalex.github.io/interactive-classification",
        code: "https://github.com/poloclub/interactive-classification"
      }
    ];

    /* src/components/Intro.svelte generated by Svelte v3.9.1 */

    const file$4 = "src/components/Intro.svelte";

    function create_fragment$5(ctx) {
    	var p0, t0, a0, t2, a1, t4, p1, t5, b0, t7, b1, t9, b2, t11, a2, t13, p2, t14, a3, t16, a4, t18, a5, t20, a6, t22, b3, span0, t24, span1, t26, span2, t28, span3, t30, span4, t32, span5, t34;

    	return {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("I am a first year PhD student in the\n  ");
    			a0 = element("a");
    			a0.textContent = "Human Computer Interaction Institute (HCII)";
    			t2 = text("\n  at\n  ");
    			a1 = element("a");
    			a1.textContent = "Carnegie Mellon University.";
    			t4 = space();
    			p1 = element("p");
    			t5 = text("My research focus is broadly\n  ");
    			b0 = element("b");
    			b0.textContent = "human-centered AI,";
    			t7 = text("\n  specifically in applying techniques from\n  ");
    			b1 = element("b");
    			b1.textContent = "HCI";
    			t9 = text("\n  and\n  ");
    			b2 = element("b");
    			b2.textContent = "visualization";
    			t11 = text("\n  to help people better understand and develop machine learning models. I am\n  supported by a\n  ");
    			a2 = element("a");
    			a2.textContent = "NSF Graduate Research Fellowship.";
    			t13 = space();
    			p2 = element("p");
    			t14 = text("Before CMU, I graduated with a B.S. in Computer Science from\n  ");
    			a3 = element("a");
    			a3.textContent = "Georgia Tech,";
    			t16 = text("\n  where I was a member of the\n  ");
    			a4 = element("a");
    			a4.textContent = "Polo Club of Data Science";
    			t18 = text("\n  and worked with\n  ");
    			a5 = element("a");
    			a5.textContent = "Polo Chau";
    			t20 = text("\n  and\n  ");
    			a6 = element("a");
    			a6.textContent = "Jamie Morgenstern.";
    			t22 = text("\n  I also spent a few summers as a software engineering intern at\n  ");
    			b3 = element("b");
    			span0 = element("span");
    			span0.textContent = "G";
    			t24 = space();
    			span1 = element("span");
    			span1.textContent = "o";
    			t26 = space();
    			span2 = element("span");
    			span2.textContent = "o";
    			t28 = space();
    			span3 = element("span");
    			span3.textContent = "g";
    			t30 = space();
    			span4 = element("span");
    			span4.textContent = "l";
    			t32 = space();
    			span5 = element("span");
    			span5.textContent = "e";
    			t34 = text("\n  working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 14, 2, 171);
    			attr(a1, "href", "https://www.cmu.edu/");
    			add_location(a1, file$4, 18, 2, 266);
    			attr(p0, "class", "svelte-1oy6zad");
    			add_location(p0, file$4, 12, 0, 126);
    			add_location(b0, file$4, 23, 2, 372);
    			add_location(b1, file$4, 25, 2, 443);
    			add_location(b2, file$4, 27, 2, 462);
    			attr(a2, "href", "https://www.nsfgrfp.org/");
    			add_location(a2, file$4, 30, 2, 579);
    			attr(p1, "class", "svelte-1oy6zad");
    			add_location(p1, file$4, 21, 0, 335);
    			attr(a3, "href", "https://www.gatech.edu/");
    			add_location(a3, file$4, 35, 2, 727);
    			attr(a4, "href", "https://poloclub.github.io/");
    			add_location(a4, file$4, 37, 2, 811);
    			attr(a5, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a5, file$4, 39, 2, 899);
    			attr(a6, "href", "http://jamiemorgenstern.com/");
    			add_location(a6, file$4, 41, 2, 965);
    			attr(span0, "class", "letter g svelte-1oy6zad");
    			add_location(span0, file$4, 44, 4, 1117);
    			attr(span1, "class", "letter o1 svelte-1oy6zad");
    			add_location(span1, file$4, 45, 4, 1153);
    			attr(span2, "class", "letter o2 svelte-1oy6zad");
    			add_location(span2, file$4, 46, 4, 1190);
    			attr(span3, "class", "letter g svelte-1oy6zad");
    			add_location(span3, file$4, 47, 4, 1227);
    			attr(span4, "class", "letter l svelte-1oy6zad");
    			add_location(span4, file$4, 48, 4, 1263);
    			attr(span5, "class", "letter e svelte-1oy6zad");
    			add_location(span5, file$4, 49, 4, 1299);
    			attr(b3, "class", "google svelte-1oy6zad");
    			add_location(b3, file$4, 43, 2, 1094);
    			attr(p2, "class", "svelte-1oy6zad");
    			add_location(p2, file$4, 33, 0, 658);
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
    			insert(target, t4, anchor);
    			insert(target, p1, anchor);
    			append(p1, t5);
    			append(p1, b0);
    			append(p1, t7);
    			append(p1, b1);
    			append(p1, t9);
    			append(p1, b2);
    			append(p1, t11);
    			append(p1, a2);
    			insert(target, t13, anchor);
    			insert(target, p2, anchor);
    			append(p2, t14);
    			append(p2, a3);
    			append(p2, t16);
    			append(p2, a4);
    			append(p2, t18);
    			append(p2, a5);
    			append(p2, t20);
    			append(p2, a6);
    			append(p2, t22);
    			append(p2, b3);
    			append(b3, span0);
    			append(b3, t24);
    			append(b3, span1);
    			append(b3, t26);
    			append(b3, span2);
    			append(b3, t28);
    			append(b3, span3);
    			append(b3, t30);
    			append(b3, span4);
    			append(b3, t32);
    			append(b3, span5);
    			append(p2, t34);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p0);
    				detach(t4);
    				detach(p1);
    				detach(t13);
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

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$6, safe_not_equal, ["pub"]);

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

    // (30:8) {#each { length: 3 } as _, i}
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
    			attr(p0, "class", "pure-u-1 pure-u-md-1-5 date");
    			add_location(p0, file$6, 31, 12, 932);
    			attr(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 32, 12, 1002);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$6, 30, 10, 889);
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

    // (44:8) {#each pubs as pub}
    function create_each_block$1(ctx) {
    	var div4, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                        .map(func)
                        .join(', ') + "", t5, p, t6_value = ctx.pub.desc + "", t6, t7, t8, current;

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
    			p = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			links.$$.fragment.c();
    			t8 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$6, 48, 18, 1521);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 47, 16, 1472);
    			attr(h6, "class", "venue");
    			add_location(h6, file$6, 53, 16, 1682);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$6, 46, 14, 1436);
    			attr(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3");
    			add_location(div1, file$6, 45, 12, 1375);
    			add_location(h4, file$6, 59, 18, 1926);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$6, 58, 16, 1857);
    			attr(h5, "class", "authors");
    			add_location(h5, file$6, 61, 16, 1984);
    			attr(p, "class", "desc");
    			add_location(p, file$6, 66, 16, 2193);
    			attr(div2, "class", "padded");
    			add_location(div2, file$6, 57, 14, 1820);
    			attr(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 56, 12, 1769);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 44, 10, 1338);
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
    			append(div2, p);
    			append(p, t6);
    			append(div3, t7);
    			mount_component(links, div3, null);
    			append(div4, t8);
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
    	var div5, t0, div4, div3, div0, h20, t1, span, t3, t4, div1, h21, t5, a0, t7, t8, div2, h22, t9, a1, t11, t12, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var intro = new Intro({ $$inline: true });

    	var each_value_1 = { length: 3 };

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
    			t1 = text("Hi! You can call me\n          ");
    			span = element("span");
    			span.textContent = "Alex";
    			t3 = space();
    			intro.$$.fragment.c();
    			t4 = space();
    			div1 = element("div");
    			h21 = element("h2");
    			t5 = text("News\n          ");
    			a0 = element("a");
    			a0.textContent = "all news";
    			t7 = space();

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t8 = space();
    			div2 = element("div");
    			h22 = element("h2");
    			t9 = text("Selected Publications\n          ");
    			a1 = element("a");
    			a1.textContent = "all publications";
    			t11 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t12 = space();
    			footer.$$.fragment.c();
    			attr(span, "class", "name");
    			add_location(span, file$6, 20, 10, 630);
    			add_location(h20, file$6, 18, 8, 585);
    			attr(div0, "id", "intro");
    			add_location(div0, file$6, 17, 6, 560);
    			attr(a0, "class", "right-all");
    			attr(a0, "href", "#/news");
    			add_location(a0, file$6, 27, 10, 779);
    			add_location(h21, file$6, 25, 8, 749);
    			attr(div1, "id", "news");
    			attr(div1, "class", "sect");
    			add_location(div1, file$6, 24, 6, 712);
    			attr(a1, "class", "right-all");
    			attr(a1, "href", "#/pubs");
    			add_location(a1, file$6, 41, 10, 1230);
    			add_location(h22, file$6, 39, 8, 1183);
    			attr(div2, "id", "pubs");
    			attr(div2, "class", "sect");
    			add_location(div2, file$6, 38, 6, 1146);
    			attr(div3, "id", "padded-content");
    			add_location(div3, file$6, 16, 4, 528);
    			attr(div4, "id", "content");
    			attr(div4, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div4, file$6, 15, 2, 474);
    			attr(div5, "class", "pure-g");
    			attr(div5, "id", "main-container");
    			add_location(div5, file$6, 13, 0, 417);
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
    			append(div0, t3);
    			mount_component(intro, div0, null);
    			append(div3, t4);
    			append(div3, div1);
    			append(div1, h21);
    			append(h21, t5);
    			append(h21, a0);
    			append(div1, t7);

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append(div3, t8);
    			append(div3, div2);
    			append(div2, h22);
    			append(h22, t9);
    			append(h22, a1);
    			append(div2, t11);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append(div4, t12);
    			mount_component(footer, div4, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value_1 = { length: 3 };

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

    function instance$3($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	return {};
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$7, safe_not_equal, []);
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.9.1 */

    const file$7 = "src/Pubs.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (16:6) {#each pubs as pub}
    function create_each_block$2(ctx) {
    	var div4, div1, div0, a0, img, img_src_value, a0_href_value, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, a1_href_value, t4, h5, raw_value = ctx.pub.authors
                      .map(func$1)
                      .join(', ') + "", t5, p, t6_value = ctx.pub.desc + "", t6, t7, t8, current;

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
    			p = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			links.$$.fragment.c();
    			t8 = space();
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "thumb");
    			attr(img, "alt", "teaser");
    			add_location(img, file$7, 20, 16, 661);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$7, 19, 14, 614);
    			attr(h6, "class", "venue");
    			add_location(h6, file$7, 22, 14, 758);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$7, 18, 12, 580);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$7, 17, 10, 521);
    			add_location(h4, file$7, 28, 16, 990);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$7, 27, 14, 923);
    			attr(h5, "class", "authors");
    			add_location(h5, file$7, 30, 14, 1044);
    			attr(p, "class", "desc");
    			add_location(p, file$7, 35, 14, 1243);
    			attr(div2, "class", "padded");
    			add_location(div2, file$7, 26, 12, 888);
    			attr(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$7, 25, 10, 839);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$7, 16, 8, 486);
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
    			append(div2, p);
    			append(p, t6);
    			append(div3, t7);
    			mount_component(links, div3, null);
    			append(div4, t8);
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
    			add_location(h1, file$7, 14, 6, 430);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$7, 13, 4, 398);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$7, 12, 2, 344);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$7, 10, 0, 287);
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

    function instance$4($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	return {};
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$8, safe_not_equal, []);
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.9.1 */

    const file$8 = "src/Paper.svelte";

    function create_fragment$9(ctx) {
    	var div5, a0, h40, i0, t0, span0, t2, span1, t4, span2, t6, span3, t8, h1, t9_value = ctx.pub.title + "", t9, t10, div0, h3, raw0_value = ctx.pub.authors
            .map(func$2)
            .join(', ') + "", t11, div3, div1, img, img_src_value, t12, div2, p0, t13_value = ctx.pub.desc + "", t13, t14, h20, t16, p1, t17_value = ctx.pub.abstract + "", t17, t18, h21, t20, a1, h41, t21_value = ctx.pub.title + "", t21, a1_href_value, t22, h50, raw1_value = ctx.pub.authors
          .map(func_1)
          .join(', ') + "", t23, h51, i1, t24_value = ctx.pub.venuelong + "", t24, t25, t26_value = ctx.pub.location + "", t26, t27, t28_value = ctx.pub.year + "", t28, t29, t30, h22, t32, div4, code, t33_value = ctx.pub.bibtex + "", t33, t34, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			div5 = element("div");
    			a0 = element("a");
    			h40 = element("h4");
    			i0 = element("i");
    			t0 = space();
    			span0 = element("span");
    			span0.textContent = "Ángel ";
    			t2 = space();
    			span1 = element("span");
    			span1.textContent = "Alex";
    			t4 = space();
    			span2 = element("span");
    			span2.textContent = "ander ";
    			t6 = space();
    			span3 = element("span");
    			span3.textContent = "Cabrera";
    			t8 = space();
    			h1 = element("h1");
    			t9 = text(t9_value);
    			t10 = space();
    			div0 = element("div");
    			h3 = element("h3");
    			t11 = space();
    			div3 = element("div");
    			div1 = element("div");
    			img = element("img");
    			t12 = space();
    			div2 = element("div");
    			p0 = element("p");
    			t13 = text(t13_value);
    			t14 = space();
    			h20 = element("h2");
    			h20.textContent = "Abstract";
    			t16 = space();
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			h21 = element("h2");
    			h21.textContent = "Citation";
    			t20 = space();
    			a1 = element("a");
    			h41 = element("h4");
    			t21 = text(t21_value);
    			t22 = space();
    			h50 = element("h5");
    			t23 = space();
    			h51 = element("h5");
    			i1 = element("i");
    			t24 = text(t24_value);
    			t25 = text(". ");
    			t26 = text(t26_value);
    			t27 = text(", ");
    			t28 = text(t28_value);
    			t29 = space();
    			links.$$.fragment.c();
    			t30 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t32 = space();
    			div4 = element("div");
    			code = element("code");
    			t33 = text(t33_value);
    			t34 = space();
    			footer.$$.fragment.c();
    			attr(i0, "class", "fas fa-home svelte-vur8sy");
    			attr(i0, "id", "home");
    			add_location(i0, file$8, 104, 6, 1601);
    			attr(span0, "class", "color svelte-vur8sy");
    			add_location(span0, file$8, 105, 6, 1643);
    			attr(span1, "class", "color red svelte-vur8sy");
    			add_location(span1, file$8, 106, 6, 1688);
    			attr(span2, "class", "color svelte-vur8sy");
    			add_location(span2, file$8, 107, 6, 1730);
    			attr(span3, "class", "color red svelte-vur8sy");
    			add_location(span3, file$8, 108, 6, 1775);
    			attr(h40, "id", "home-link");
    			attr(h40, "class", "svelte-vur8sy");
    			add_location(h40, file$8, 103, 4, 1575);
    			attr(a0, "href", "/");
    			add_location(a0, file$8, 102, 2, 1558);
    			attr(h1, "class", "svelte-vur8sy");
    			add_location(h1, file$8, 111, 2, 1833);
    			attr(h3, "class", "svelte-vur8sy");
    			add_location(h3, file$8, 113, 4, 1876);
    			attr(div0, "id", "info");
    			attr(div0, "class", "svelte-vur8sy");
    			add_location(div0, file$8, 112, 2, 1856);
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "teaser svelte-vur8sy");
    			attr(img, "alt", "teaser");
    			add_location(img, file$8, 121, 6, 2089);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 120, 4, 2046);
    			attr(p0, "class", "desc svelte-vur8sy");
    			add_location(p0, file$8, 124, 6, 2212);
    			attr(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 123, 4, 2169);
    			attr(div3, "class", "flex pure-g svelte-vur8sy");
    			add_location(div3, file$8, 119, 2, 2016);
    			attr(h20, "class", "sec-title svelte-vur8sy");
    			add_location(h20, file$8, 128, 2, 2266);
    			attr(p1, "class", "svelte-vur8sy");
    			add_location(p1, file$8, 129, 2, 2304);
    			attr(h21, "class", "sec-title svelte-vur8sy");
    			add_location(h21, file$8, 131, 2, 2329);
    			attr(h41, "class", "svelte-vur8sy");
    			add_location(h41, file$8, 133, 4, 2422);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$8, 132, 2, 2367);
    			attr(h50, "class", "svelte-vur8sy");
    			add_location(h50, file$8, 136, 2, 2453);
    			add_location(i1, file$8, 143, 4, 2586);
    			attr(h51, "class", "svelte-vur8sy");
    			add_location(h51, file$8, 142, 2, 2577);
    			attr(h22, "class", "sec-title svelte-vur8sy");
    			add_location(h22, file$8, 147, 2, 2666);
    			attr(code, "class", "bibtex");
    			add_location(code, file$8, 149, 4, 2725);
    			attr(div4, "class", "code svelte-vur8sy");
    			add_location(div4, file$8, 148, 2, 2702);
    			attr(div5, "id", "body");
    			attr(div5, "class", "svelte-vur8sy");
    			add_location(div5, file$8, 101, 0, 1540);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, a0);
    			append(a0, h40);
    			append(h40, i0);
    			append(h40, t0);
    			append(h40, span0);
    			append(h40, t2);
    			append(h40, span1);
    			append(h40, t4);
    			append(h40, span2);
    			append(h40, t6);
    			append(h40, span3);
    			append(div5, t8);
    			append(div5, h1);
    			append(h1, t9);
    			append(div5, t10);
    			append(div5, div0);
    			append(div0, h3);
    			h3.innerHTML = raw0_value;
    			append(div5, t11);
    			append(div5, div3);
    			append(div3, div1);
    			append(div1, img);
    			append(div3, t12);
    			append(div3, div2);
    			append(div2, p0);
    			append(p0, t13);
    			append(div5, t14);
    			append(div5, h20);
    			append(div5, t16);
    			append(div5, p1);
    			append(p1, t17);
    			append(div5, t18);
    			append(div5, h21);
    			append(div5, t20);
    			append(div5, a1);
    			append(a1, h41);
    			append(h41, t21);
    			append(div5, t22);
    			append(div5, h50);
    			h50.innerHTML = raw1_value;
    			append(div5, t23);
    			append(div5, h51);
    			append(h51, i1);
    			append(i1, t24);
    			append(i1, t25);
    			append(i1, t26);
    			append(i1, t27);
    			append(i1, t28);
    			append(div5, t29);
    			mount_component(links, div5, null);
    			append(div5, t30);
    			append(div5, h22);
    			append(div5, t32);
    			append(div5, div4);
    			append(div4, code);
    			append(code, t33);
    			append(div5, t34);
    			mount_component(footer, div5, null);
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
    				detach(div5);
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

    function instance$5($$self, $$props, $$invalidate) {
    	
      let { params = {} } = $$props;

      let pub = pubs.find(e => e.id === params.id);
      onMount(() => window.scrollTo(0, 0));

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
    		init(this, options, instance$5, create_fragment$9, safe_not_equal, ["params"]);
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
    	var tr0, th0, t0_value = ctx.pub.month + "", t0, t1, t2_value = ctx.pub.year + "", t2, t3, th1, a, h5, t4_value = ctx.pub.title + "", t4, a_href_value, t5, h6, raw_value = ctx.pub.authors
                    .map(func$3)
                    .join(', ') + "", t6, p, i, t7_value = ctx.pub.venuelong + "", t7, t8, t9_value = ctx.pub.location + "", t9, t10, t11_value = ctx.pub.year + "", t11, t12, t13, t14, tr1, current;

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
    			t2 = text(t2_value);
    			t3 = space();
    			th1 = element("th");
    			a = element("a");
    			h5 = element("h5");
    			t4 = text(t4_value);
    			t5 = space();
    			h6 = element("h6");
    			t6 = space();
    			p = element("p");
    			i = element("i");
    			t7 = text(t7_value);
    			t8 = text(". ");
    			t9 = text(t9_value);
    			t10 = text(", ");
    			t11 = text(t11_value);
    			t12 = text(".");
    			t13 = space();
    			links.$$.fragment.c();
    			t14 = space();
    			tr1 = element("tr");
    			attr(th0, "class", "date svelte-y2s0f9");
    			add_location(th0, file$9, 445, 10, 10874);
    			attr(h5, "class", "svelte-y2s0f9");
    			add_location(h5, file$9, 448, 14, 11011);
    			attr(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			attr(a, "class", "paper-title");
    			add_location(a, file$9, 447, 12, 10946);
    			attr(h6, "class", "svelte-y2s0f9");
    			add_location(h6, file$9, 451, 12, 11062);
    			add_location(i, file$9, 458, 14, 11267);
    			attr(p, "class", "desc svelte-y2s0f9");
    			add_location(p, file$9, 457, 12, 11236);
    			attr(th1, "class", "svelte-y2s0f9");
    			add_location(th1, file$9, 446, 10, 10929);
    			attr(tr0, "class", "item svelte-y2s0f9");
    			add_location(tr0, file$9, 444, 8, 10846);
    			attr(tr1, "class", "buffer svelte-y2s0f9");
    			add_location(tr1, file$9, 464, 8, 11403);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr0, anchor);
    			append(tr0, th0);
    			append(th0, t0);
    			append(th0, t1);
    			append(th0, t2);
    			append(tr0, t3);
    			append(tr0, th1);
    			append(th1, a);
    			append(a, h5);
    			append(h5, t4);
    			append(th1, t5);
    			append(th1, h6);
    			h6.innerHTML = raw_value;
    			append(th1, t6);
    			append(th1, p);
    			append(p, i);
    			append(i, t7);
    			append(i, t8);
    			append(i, t9);
    			append(i, t10);
    			append(i, t11);
    			append(i, t12);
    			append(th1, t13);
    			mount_component(links, th1, null);
    			insert(target, t14, anchor);
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
    				detach(t14);
    				detach(tr1);
    			}
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	var div18, main, header, h3, span0, t1, span1, t3, span2, t5, span3, t7, t8, t9, table, tr0, th0, t10, th1, h40, t12, tr1, th2, t13, br0, t14, t15, th3, h50, t17, h60, t19, tr2, t20, tr3, th4, t21, br1, t22, t23, th5, h51, t25, h61, t27, p0, t29, tr4, th6, t31, th7, h62, t33, p1, t35, tr5, th8, t36, th9, h41, t38, tr6, th10, t40, th11, h52, t42, p2, t44, div0, a0, button0, i0, t45, t46, tr7, t47, tr8, th12, t49, th13, h53, t51, p3, t53, div1, a1, button1, i1, t54, t55, tr9, t56, tr10, th14, t57, br2, t58, t59, th15, h54, t61, h63, t63, p4, t65, div2, a2, button2, i2, t66, t67, tr11, t68, tr12, th16, t70, th17, h55, t72, h64, t74, p5, t76, div3, a3, button3, i3, t77, t78, tr13, th18, t79, th19, h42, t81, tr14, th20, t82, br3, t83, t84, th21, h56, t86, h65, t88, p6, t90, div4, a4, button4, i4, t91, t92, button5, t94, button6, t96, button7, t98, button8, t100, tr15, t101, tr16, th22, t102, br4, t103, t104, th23, h57, t106, h66, t108, p7, t110, div5, button9, t112, button10, t114, button11, t116, button12, t118, tr17, t119, tr18, th24, t120, br5, t121, t122, th25, h58, t124, h67, t126, p8, t128, div6, button13, t130, button14, t132, button15, t134, tr19, th26, t135, th27, h43, t137, tr20, th28, t138, br6, t139, t140, th29, h59, t142, h68, t144, p9, t146, div7, a5, button16, i5, t147, t148, tr21, t149, tr22, th30, t150, br7, t151, t152, th31, h510, t154, h69, t156, p10, t158, div8, a6, button17, i6, t159, t160, a7, button18, i7, t161, t162, a8, button19, i8, t163, t164, tr23, th32, t165, th33, h44, t167, t168, tr24, th34, t169, th35, h45, t171, tr25, th36, t173, th37, h511, t175, h610, t177, p11, t179, div9, a9, button20, i9, t180, t181, tr26, t182, tr27, th38, t184, th39, h512, t186, p12, t188, div10, a10, button21, i10, t189, t190, a11, button22, i11, t191, t192, tr28, t193, tr29, th40, t195, th41, h513, t197, p13, t199, div11, a12, button23, i12, t200, t201, a13, button24, i13, t202, t203, tr30, th42, t204, th43, h46, t206, tr31, th44, t208, th45, h514, t210, h611, t212, p14, t214, tr32, t215, tr33, th46, t217, th47, h515, t219, h612, t221, p15, t223, tr34, th48, t224, th49, h47, t226, tr35, th50, t227, th51, h516, t229, tr36, th52, t231, th53, h517, t233, tr37, th54, t235, th55, h518, t237, tr38, th56, t238, th57, h48, t240, tr39, th58, t241, br8, t242, t243, th59, h519, t245, h613, t247, p16, t249, div12, a14, button25, i14, t250, t251, tr40, t252, tr41, th60, t254, th61, h520, t256, p17, t258, div13, a15, button26, i15, t259, t260, tr42, t261, tr43, th62, t262, br9, t263, t264, th63, h521, t266, h614, t268, p18, t270, div14, a16, button27, i16, t271, t272, tr44, th64, t273, th65, h49, t275, tr45, th66, t277, th67, a17, h522, t279, tr46, th68, t281, th69, a18, h523, t283, tr47, th70, t285, th71, h524, t287, tr48, th72, t289, th73, a19, h525, t291, tr49, th74, t293, th75, a20, h526, t295, tr50, th76, t297, th77, h527, t299, tr51, th78, t300, th79, h410, t302, tr52, th80, t303, th81, h528, t305, div15, button28, t307, button29, t309, button30, t311, tr53, t312, tr54, th82, t313, th83, h529, t315, div16, button31, t317, button32, t319, button33, t321, button34, t323, button35, t325, button36, t327, tr55, t328, tr56, th84, t329, th85, h530, t331, div17, button37, t333, button38, t335, button39, t337, button40, t339, button41, t341, button42, t343, button43, t345, button44, t347, tr57, t348, tr58, th86, t349, th87, p19, current;

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
    			div18 = element("div");
    			main = element("main");
    			header = element("header");
    			h3 = element("h3");
    			span0 = element("span");
    			span0.textContent = "Ángel ";
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "Alex";
    			t3 = space();
    			span2 = element("span");
    			span2.textContent = "ander ";
    			t5 = space();
    			span3 = element("span");
    			span3.textContent = "Cabrera";
    			t7 = space();
    			intro.$$.fragment.c();
    			t8 = space();
    			social.$$.fragment.c();
    			t9 = space();
    			table = element("table");
    			tr0 = element("tr");
    			th0 = element("th");
    			t10 = space();
    			th1 = element("th");
    			h40 = element("h4");
    			h40.textContent = "Education";
    			t12 = space();
    			tr1 = element("tr");
    			th2 = element("th");
    			t13 = text("August 2019\n          ");
    			br0 = element("br");
    			t14 = text("\n          - Present");
    			t15 = space();
    			th3 = element("th");
    			h50 = element("h5");
    			h50.textContent = "PhD in Human-Computer Interaction (HCI)";
    			t17 = space();
    			h60 = element("h6");
    			h60.textContent = "Carnegie Mellon University - Pittsburgh, PA";
    			t19 = space();
    			tr2 = element("tr");
    			t20 = space();
    			tr3 = element("tr");
    			th4 = element("th");
    			t21 = text("August 2015\n          ");
    			br1 = element("br");
    			t22 = text("\n          - May 2019");
    			t23 = space();
    			th5 = element("th");
    			h51 = element("h5");
    			h51.textContent = "B.S. in Computer Science";
    			t25 = space();
    			h61 = element("h6");
    			h61.textContent = "Georgia Institute of Technology - Atlanta, GA";
    			t27 = space();
    			p0 = element("p");
    			p0.textContent = "Concentration in intelligence and modeling/simulation. Minor in\n            economics.";
    			t29 = space();
    			tr4 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Fall 2017";
    			t31 = space();
    			th7 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t33 = space();
    			p1 = element("p");
    			p1.textContent = "Exchange program with a focus on economics and political science.";
    			t35 = space();
    			tr5 = element("tr");
    			th8 = element("th");
    			t36 = space();
    			th9 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Awards";
    			t38 = space();
    			tr6 = element("tr");
    			th10 = element("th");
    			th10.textContent = "May 2019";
    			t40 = space();
    			th11 = element("th");
    			h52 = element("h5");
    			h52.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t42 = space();
    			p2 = element("p");
    			p2.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t44 = space();
    			div0 = element("div");
    			a0 = element("a");
    			button0 = element("button");
    			i0 = element("i");
    			t45 = text("\n                Website");
    			t46 = space();
    			tr7 = element("tr");
    			t47 = space();
    			tr8 = element("tr");
    			th12 = element("th");
    			th12.textContent = "May 2019";
    			t49 = space();
    			th13 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Love Family Foundation Scholarship";
    			t51 = space();
    			p3 = element("p");
    			p3.textContent = "Award for the undergraduate with the most outstanding scholastic\n            record in the graduating class. Co-awarded the $10,000 scholarship.";
    			t53 = space();
    			div1 = element("div");
    			a1 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t54 = text("\n                Announcement");
    			t55 = space();
    			tr9 = element("tr");
    			t56 = space();
    			tr10 = element("tr");
    			th14 = element("th");
    			t57 = text("August 2015\n          ");
    			br2 = element("br");
    			t58 = text("\n          - May 2019");
    			t59 = space();
    			th15 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Stamps President's Scholar";
    			t61 = space();
    			h63 = element("h6");
    			h63.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t63 = space();
    			p4 = element("p");
    			p4.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 students (27,270 applicants).";
    			t65 = space();
    			div2 = element("div");
    			a2 = element("a");
    			button2 = element("button");
    			i2 = element("i");
    			t66 = text("\n                Website");
    			t67 = space();
    			tr11 = element("tr");
    			t68 = space();
    			tr12 = element("tr");
    			th16 = element("th");
    			th16.textContent = "February 3, 2018";
    			t70 = space();
    			th17 = element("th");
    			h55 = element("h5");
    			h55.textContent = "The Data Open Datathon";
    			t72 = space();
    			h64 = element("h6");
    			h64.textContent = "Correlation One and Citadel Securities";
    			t74 = space();
    			p5 = element("p");
    			p5.textContent = "Placed third and won $2,500 for creating a supervised learning\n            system that predicts dangerous road areas.";
    			t76 = space();
    			div3 = element("div");
    			a3 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t77 = text("\n                Press Release");
    			t78 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			t79 = space();
    			th19 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Industry Experience";
    			t81 = space();
    			tr14 = element("tr");
    			th20 = element("th");
    			t82 = text("May 2018\n          ");
    			br3 = element("br");
    			t83 = text("\n          - August 2018");
    			t84 = space();
    			th21 = element("th");
    			h56 = element("h5");
    			h56.textContent = "Google";
    			t86 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t88 = space();
    			p6 = element("p");
    			p6.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t90 = space();
    			div4 = element("div");
    			a4 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t91 = text("\n                WSJ Article");
    			t92 = space();
    			button5 = element("button");
    			button5.textContent = "Android Auto";
    			t94 = space();
    			button6 = element("button");
    			button6.textContent = "Java";
    			t96 = space();
    			button7 = element("button");
    			button7.textContent = "C++";
    			t98 = space();
    			button8 = element("button");
    			button8.textContent = "Protocol Buffers";
    			t100 = space();
    			tr15 = element("tr");
    			t101 = space();
    			tr16 = element("tr");
    			th22 = element("th");
    			t102 = text("May 2017\n          ");
    			br4 = element("br");
    			t103 = text("\n          - August 2017");
    			t104 = space();
    			th23 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Google";
    			t106 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t108 = space();
    			p7 = element("p");
    			p7.textContent = "Designed and implemented an anomaly detection and trend analysis\n            system for Google's primary data processing pipelines.";
    			t110 = space();
    			div5 = element("div");
    			button9 = element("button");
    			button9.textContent = "Apache Beam/Cloud DataFlow";
    			t112 = space();
    			button10 = element("button");
    			button10.textContent = "Java";
    			t114 = space();
    			button11 = element("button");
    			button11.textContent = "C++";
    			t116 = space();
    			button12 = element("button");
    			button12.textContent = "SQL";
    			t118 = space();
    			tr17 = element("tr");
    			t119 = space();
    			tr18 = element("tr");
    			th24 = element("th");
    			t120 = text("May 2016\n          ");
    			br5 = element("br");
    			t121 = text("\n          - August 2016");
    			t122 = space();
    			th25 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Google";
    			t124 = space();
    			h67 = element("h6");
    			h67.textContent = "Engineering Practicum Intern";
    			t126 = space();
    			p8 = element("p");
    			p8.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t128 = space();
    			div6 = element("div");
    			button13 = element("button");
    			button13.textContent = "Go";
    			t130 = space();
    			button14 = element("button");
    			button14.textContent = "BigQuery";
    			t132 = space();
    			button15 = element("button");
    			button15.textContent = "JavaScript";
    			t134 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t135 = space();
    			th27 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Research Experience";
    			t137 = space();
    			tr20 = element("tr");
    			th28 = element("th");
    			t138 = text("January 2018\n          ");
    			br6 = element("br");
    			t139 = text("\n          - Present");
    			t140 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Polo Club of Data Science";
    			t142 = space();
    			h68 = element("h6");
    			h68.textContent = "Undergraduate Researcher";
    			t144 = space();
    			p9 = element("p");
    			p9.textContent = "Applying human computer interaction and visualization techniques to\n            help people understand and design more equitable machine learning\n            models.";
    			t146 = space();
    			div7 = element("div");
    			a5 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t147 = text("\n                Polo Club");
    			t148 = space();
    			tr21 = element("tr");
    			t149 = space();
    			tr22 = element("tr");
    			th30 = element("th");
    			t150 = text("September 2015\n          ");
    			br7 = element("br");
    			t151 = text("\n          - May 2017");
    			t152 = space();
    			th31 = element("th");
    			h510 = element("h5");
    			h510.textContent = "PROX-1 Satellite";
    			t154 = space();
    			h69 = element("h6");
    			h69.textContent = "Flight Software Lead and Researcher";
    			t156 = space();
    			p10 = element("p");
    			p10.textContent = "Led a team of engineers in developing and deploying the software for\n            a fully undergraduate-led satellite mission.";
    			t158 = space();
    			div8 = element("div");
    			a6 = element("a");
    			button17 = element("button");
    			i6 = element("i");
    			t159 = text("\n                In space!");
    			t160 = space();
    			a7 = element("a");
    			button18 = element("button");
    			i7 = element("i");
    			t161 = text("\n                Website");
    			t162 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i8 = element("i");
    			t163 = text("\n                Press release");
    			t164 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t165 = space();
    			th33 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Publications";
    			t167 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t168 = space();
    			tr24 = element("tr");
    			th34 = element("th");
    			t169 = space();
    			th35 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Projects";
    			t171 = space();
    			tr25 = element("tr");
    			th36 = element("th");
    			th36.textContent = "Fall 2018";
    			t173 = space();
    			th37 = element("th");
    			h511 = element("h5");
    			h511.textContent = "ICLR'19 Reproducibility Challenge";
    			t175 = space();
    			h610 = element("h6");
    			h610.textContent = "Generative Adversarial Models For Learning Private And Fair\n            Representations";
    			t177 = space();
    			p11 = element("p");
    			p11.textContent = "Implemented the architecture and reproduced results for an ICLR'19\n            submission using GANs to decorrelate sensitive data.";
    			t179 = space();
    			div9 = element("div");
    			a9 = element("a");
    			button20 = element("button");
    			i9 = element("i");
    			t180 = text("\n                GitHub");
    			t181 = space();
    			tr26 = element("tr");
    			t182 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Spring 2018";
    			t184 = space();
    			th39 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Georgia Tech Bus System Analysis";
    			t186 = space();
    			p12 = element("p");
    			p12.textContent = "System that combines Google Maps and graph algorithms to include\n            Georgia Tech bus routes in navigation.";
    			t188 = space();
    			div10 = element("div");
    			a10 = element("a");
    			button21 = element("button");
    			i10 = element("i");
    			t189 = text("\n                Poster");
    			t190 = space();
    			a11 = element("a");
    			button22 = element("button");
    			i11 = element("i");
    			t191 = text("\n                Class");
    			t192 = space();
    			tr28 = element("tr");
    			t193 = space();
    			tr29 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Spring 2014";
    			t195 = space();
    			th41 = element("th");
    			h513 = element("h5");
    			h513.textContent = "CTF Resources";
    			t197 = space();
    			p13 = element("p");
    			p13.textContent = "Introductory guide and resources for capture the flag (CTF)\n            competitions with over 800 stars on GitHub.";
    			t199 = space();
    			div11 = element("div");
    			a12 = element("a");
    			button23 = element("button");
    			i12 = element("i");
    			t200 = text("\n                Website");
    			t201 = space();
    			a13 = element("a");
    			button24 = element("button");
    			i13 = element("i");
    			t202 = text("\n                GitHub");
    			t203 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			t204 = space();
    			th43 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t206 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			th44.textContent = "Fall 2016, Spring 2017, Spring 2018";
    			t208 = space();
    			th45 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Undergraduate Teaching Assistant";
    			t210 = space();
    			h611 = element("h6");
    			h611.textContent = "CS1332 - Data Structures and Algorithms";
    			t212 = space();
    			p14 = element("p");
    			p14.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t214 = space();
    			tr32 = element("tr");
    			t215 = space();
    			tr33 = element("tr");
    			th46 = element("th");
    			th46.textContent = "Fall 2016";
    			t217 = space();
    			th47 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Team Leader";
    			t219 = space();
    			h612 = element("h6");
    			h612.textContent = "GT 1000 - First-Year Seminar";
    			t221 = space();
    			p15 = element("p");
    			p15.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t223 = space();
    			tr34 = element("tr");
    			th48 = element("th");
    			t224 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t226 = space();
    			tr35 = element("tr");
    			th50 = element("th");
    			t227 = space();
    			th51 = element("th");
    			h516 = element("h5");
    			h516.textContent = "Student Volunteer";
    			t229 = space();
    			tr36 = element("tr");
    			th52 = element("th");
    			th52.textContent = "October 2019";
    			t231 = space();
    			th53 = element("th");
    			h517 = element("h5");
    			h517.textContent = "IEEE Visualization Conference (VIS) 2019";
    			t233 = space();
    			tr37 = element("tr");
    			th54 = element("th");
    			th54.textContent = "January 2019";
    			t235 = space();
    			th55 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Fairness, Accountability, and Transparency (FAT*) 2019";
    			t237 = space();
    			tr38 = element("tr");
    			th56 = element("th");
    			t238 = space();
    			th57 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Campus Involvement";
    			t240 = space();
    			tr39 = element("tr");
    			th58 = element("th");
    			t241 = text("September 2015\n          ");
    			br8 = element("br");
    			t242 = text("\n          - April 2017");
    			t243 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "Stamps Scholars National Convention 2017";
    			t245 = space();
    			h613 = element("h6");
    			h613.textContent = "Vice-chair of large events";
    			t247 = space();
    			p16 = element("p");
    			p16.textContent = "Directed a 13 person committee in organizing hotels, meals, and\n            presentations for over 700 students.";
    			t249 = space();
    			div12 = element("div");
    			a14 = element("a");
    			button25 = element("button");
    			i14 = element("i");
    			t250 = text("\n                Website");
    			t251 = space();
    			tr40 = element("tr");
    			t252 = space();
    			tr41 = element("tr");
    			th60 = element("th");
    			th60.textContent = "Spring 2016";
    			t254 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "Tour Guide";
    			t256 = space();
    			p17 = element("p");
    			p17.textContent = "Led a tour of campus for visiting families every week.";
    			t258 = space();
    			div13 = element("div");
    			a15 = element("a");
    			button26 = element("button");
    			i15 = element("i");
    			t259 = text("\n                Website");
    			t260 = space();
    			tr42 = element("tr");
    			t261 = space();
    			tr43 = element("tr");
    			th62 = element("th");
    			t262 = text("September 2015\n          ");
    			br9 = element("br");
    			t263 = text("\n          - May 2016");
    			t264 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "Georgia Tech Student Foundation";
    			t266 = space();
    			h614 = element("h6");
    			h614.textContent = "Investments committee and Freshman Leadership Initiative";
    			t268 = space();
    			p18 = element("p");
    			p18.textContent = "Conducted market research to help manage a $1.2 million endowment\n            and organized fundraising events.";
    			t270 = space();
    			div14 = element("div");
    			a16 = element("a");
    			button27 = element("button");
    			i16 = element("i");
    			t271 = text("\n                Website");
    			t272 = space();
    			tr44 = element("tr");
    			th64 = element("th");
    			t273 = space();
    			th65 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Selected Classes";
    			t275 = space();
    			tr45 = element("tr");
    			th66 = element("th");
    			th66.textContent = "Fall 2018";
    			t277 = space();
    			th67 = element("th");
    			a17 = element("a");
    			h522 = element("h5");
    			h522.textContent = "CS 4803/7643 - Deep Learning";
    			t279 = space();
    			tr46 = element("tr");
    			th68 = element("th");
    			th68.textContent = "Spring 2018";
    			t281 = space();
    			th69 = element("th");
    			a18 = element("a");
    			h523 = element("h5");
    			h523.textContent = "CX 4242/CSE 6242 - Data and Visual Analytics";
    			t283 = space();
    			tr47 = element("tr");
    			th70 = element("th");
    			th70.textContent = "Fall 2017";
    			t285 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			h524.textContent = "BECO 1750A - Money and Banking";
    			t287 = space();
    			tr48 = element("tr");
    			th72 = element("th");
    			th72.textContent = "Spring 2017";
    			t289 = space();
    			th73 = element("th");
    			a19 = element("a");
    			h525 = element("h5");
    			h525.textContent = "CS 4641/7641 - Machine Learning";
    			t291 = space();
    			tr49 = element("tr");
    			th74 = element("th");
    			th74.textContent = "Spring 2017";
    			t293 = space();
    			th75 = element("th");
    			a20 = element("a");
    			h526 = element("h5");
    			h526.textContent = "CX 4230 - Computer Simulation";
    			t295 = space();
    			tr50 = element("tr");
    			th76 = element("th");
    			th76.textContent = "Spring 2017";
    			t297 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			h527.textContent = "CS 3511 - Honors Algorithms";
    			t299 = space();
    			tr51 = element("tr");
    			th78 = element("th");
    			t300 = space();
    			th79 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Skills";
    			t302 = space();
    			tr52 = element("tr");
    			th80 = element("th");
    			t303 = space();
    			th81 = element("th");
    			h528 = element("h5");
    			h528.textContent = "Languages";
    			t305 = space();
    			div15 = element("div");
    			button28 = element("button");
    			button28.textContent = "English - Native";
    			t307 = space();
    			button29 = element("button");
    			button29.textContent = "Spanish - Native";
    			t309 = space();
    			button30 = element("button");
    			button30.textContent = "French - Conversational (B1)";
    			t311 = space();
    			tr53 = element("tr");
    			t312 = space();
    			tr54 = element("tr");
    			th82 = element("th");
    			t313 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "Programming Languages";
    			t315 = space();
    			div16 = element("div");
    			button31 = element("button");
    			button31.textContent = "Java";
    			t317 = space();
    			button32 = element("button");
    			button32.textContent = "Javascript";
    			t319 = space();
    			button33 = element("button");
    			button33.textContent = "Python";
    			t321 = space();
    			button34 = element("button");
    			button34.textContent = "C/C++";
    			t323 = space();
    			button35 = element("button");
    			button35.textContent = "SQL";
    			t325 = space();
    			button36 = element("button");
    			button36.textContent = "Go";
    			t327 = space();
    			tr55 = element("tr");
    			t328 = space();
    			tr56 = element("tr");
    			th84 = element("th");
    			t329 = space();
    			th85 = element("th");
    			h530 = element("h5");
    			h530.textContent = "Technologies";
    			t331 = space();
    			div17 = element("div");
    			button37 = element("button");
    			button37.textContent = "Machine Learning";
    			t333 = space();
    			button38 = element("button");
    			button38.textContent = "Full Stack Development";
    			t335 = space();
    			button39 = element("button");
    			button39.textContent = "React";
    			t337 = space();
    			button40 = element("button");
    			button40.textContent = "Svelte";
    			t339 = space();
    			button41 = element("button");
    			button41.textContent = "Vega";
    			t341 = space();
    			button42 = element("button");
    			button42.textContent = "D3";
    			t343 = space();
    			button43 = element("button");
    			button43.textContent = "PyTorch";
    			t345 = space();
    			button44 = element("button");
    			button44.textContent = "Cloud Dataflow/MapReduce";
    			t347 = space();
    			tr57 = element("tr");
    			t348 = space();
    			tr58 = element("tr");
    			th86 = element("th");
    			t349 = space();
    			th87 = element("th");
    			p19 = element("p");
    			p19.textContent = "Last updated September 21, 2019.";
    			attr(span0, "class", "color svelte-y2s0f9");
    			add_location(span0, file$9, 141, 8, 1964);
    			attr(span1, "class", "color red svelte-y2s0f9");
    			add_location(span1, file$9, 142, 8, 2011);
    			attr(span2, "class", "color svelte-y2s0f9");
    			add_location(span2, file$9, 143, 8, 2055);
    			attr(span3, "class", "color red svelte-y2s0f9");
    			add_location(span3, file$9, 144, 8, 2102);
    			attr(h3, "id", "name");
    			attr(h3, "class", "svelte-y2s0f9");
    			add_location(h3, file$9, 140, 6, 1941);
    			attr(header, "id", "head");
    			attr(header, "class", "svelte-y2s0f9");
    			add_location(header, file$9, 139, 4, 1916);
    			attr(th0, "class", "date svelte-y2s0f9");
    			add_location(th0, file$9, 154, 8, 2258);
    			attr(h40, "class", "header svelte-y2s0f9");
    			add_location(h40, file$9, 156, 10, 2301);
    			attr(th1, "class", "svelte-y2s0f9");
    			add_location(th1, file$9, 155, 8, 2286);
    			add_location(tr0, file$9, 153, 6, 2245);
    			add_location(br0, file$9, 162, 10, 2443);
    			attr(th2, "class", "date svelte-y2s0f9");
    			add_location(th2, file$9, 160, 8, 2393);
    			attr(h50, "class", "svelte-y2s0f9");
    			add_location(h50, file$9, 166, 10, 2507);
    			attr(h60, "class", "svelte-y2s0f9");
    			add_location(h60, file$9, 167, 10, 2566);
    			attr(th3, "class", "svelte-y2s0f9");
    			add_location(th3, file$9, 165, 8, 2492);
    			attr(tr1, "class", "item svelte-y2s0f9");
    			add_location(tr1, file$9, 159, 6, 2367);
    			attr(tr2, "class", "buffer svelte-y2s0f9");
    			add_location(tr2, file$9, 170, 6, 2651);
    			add_location(br1, file$9, 174, 10, 2755);
    			attr(th4, "class", "date svelte-y2s0f9");
    			add_location(th4, file$9, 172, 8, 2705);
    			attr(h51, "class", "svelte-y2s0f9");
    			add_location(h51, file$9, 178, 10, 2820);
    			attr(h61, "class", "svelte-y2s0f9");
    			add_location(h61, file$9, 179, 10, 2864);
    			attr(p0, "class", "desc svelte-y2s0f9");
    			add_location(p0, file$9, 180, 10, 2929);
    			attr(th5, "class", "svelte-y2s0f9");
    			add_location(th5, file$9, 177, 8, 2805);
    			attr(tr3, "class", "item svelte-y2s0f9");
    			add_location(tr3, file$9, 171, 6, 2679);
    			attr(th6, "class", "date svelte-y2s0f9");
    			add_location(th6, file$9, 187, 8, 3118);
    			attr(h62, "class", "svelte-y2s0f9");
    			add_location(h62, file$9, 189, 10, 3173);
    			attr(p1, "class", "desc svelte-y2s0f9");
    			add_location(p1, file$9, 190, 10, 3220);
    			attr(th7, "class", "svelte-y2s0f9");
    			add_location(th7, file$9, 188, 8, 3158);
    			attr(tr4, "class", "item svelte-y2s0f9");
    			add_location(tr4, file$9, 186, 6, 3092);
    			attr(th8, "class", "date svelte-y2s0f9");
    			add_location(th8, file$9, 197, 8, 3397);
    			attr(h41, "class", "header svelte-y2s0f9");
    			add_location(h41, file$9, 199, 10, 3440);
    			attr(th9, "class", "svelte-y2s0f9");
    			add_location(th9, file$9, 198, 8, 3425);
    			add_location(tr5, file$9, 196, 6, 3384);
    			attr(th10, "class", "date svelte-y2s0f9");
    			add_location(th10, file$9, 203, 8, 3529);
    			attr(h52, "class", "svelte-y2s0f9");
    			add_location(h52, file$9, 205, 10, 3583);
    			attr(p2, "class", "desc svelte-y2s0f9");
    			add_location(p2, file$9, 208, 10, 3694);
    			attr(i0, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i0, file$9, 215, 16, 3971);
    			add_location(button0, file$9, 214, 14, 3946);
    			attr(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 213, 12, 3896);
    			attr(div0, "class", "tags svelte-y2s0f9");
    			add_location(div0, file$9, 212, 10, 3865);
    			attr(th11, "class", "svelte-y2s0f9");
    			add_location(th11, file$9, 204, 8, 3568);
    			attr(tr6, "class", "item svelte-y2s0f9");
    			add_location(tr6, file$9, 202, 6, 3503);
    			attr(tr7, "class", "buffer svelte-y2s0f9");
    			add_location(tr7, file$9, 222, 6, 4112);
    			attr(th12, "class", "date svelte-y2s0f9");
    			add_location(th12, file$9, 224, 8, 4166);
    			attr(h53, "class", "svelte-y2s0f9");
    			add_location(h53, file$9, 226, 10, 4220);
    			attr(p3, "class", "desc svelte-y2s0f9");
    			add_location(p3, file$9, 227, 10, 4274);
    			attr(i1, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i1, file$9, 235, 16, 4686);
    			add_location(button1, file$9, 234, 14, 4661);
    			attr(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 232, 12, 4504);
    			attr(div1, "class", "tags svelte-y2s0f9");
    			add_location(div1, file$9, 231, 10, 4473);
    			attr(th13, "class", "svelte-y2s0f9");
    			add_location(th13, file$9, 225, 8, 4205);
    			attr(tr8, "class", "item svelte-y2s0f9");
    			add_location(tr8, file$9, 223, 6, 4140);
    			attr(tr9, "class", "buffer svelte-y2s0f9");
    			add_location(tr9, file$9, 242, 6, 4832);
    			add_location(br2, file$9, 246, 10, 4936);
    			attr(th14, "class", "date svelte-y2s0f9");
    			add_location(th14, file$9, 244, 8, 4886);
    			attr(h54, "class", "svelte-y2s0f9");
    			add_location(h54, file$9, 250, 10, 5001);
    			attr(h63, "class", "svelte-y2s0f9");
    			add_location(h63, file$9, 251, 10, 5047);
    			attr(p4, "class", "desc svelte-y2s0f9");
    			add_location(p4, file$9, 252, 10, 5123);
    			attr(i2, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i2, file$9, 259, 16, 5405);
    			add_location(button2, file$9, 258, 14, 5380);
    			attr(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 257, 12, 5326);
    			attr(div2, "class", "tags svelte-y2s0f9");
    			add_location(div2, file$9, 256, 10, 5295);
    			attr(th15, "class", "svelte-y2s0f9");
    			add_location(th15, file$9, 249, 8, 4986);
    			attr(tr10, "class", "item svelte-y2s0f9");
    			add_location(tr10, file$9, 243, 6, 4860);
    			attr(tr11, "class", "buffer svelte-y2s0f9");
    			add_location(tr11, file$9, 266, 6, 5546);
    			attr(th16, "class", "date svelte-y2s0f9");
    			add_location(th16, file$9, 268, 8, 5600);
    			attr(h55, "class", "svelte-y2s0f9");
    			add_location(h55, file$9, 270, 10, 5662);
    			attr(h64, "class", "svelte-y2s0f9");
    			add_location(h64, file$9, 271, 10, 5704);
    			attr(p5, "class", "desc svelte-y2s0f9");
    			add_location(p5, file$9, 272, 10, 5762);
    			attr(i3, "class", "far fa-newspaper svelte-y2s0f9");
    			add_location(i3, file$9, 280, 16, 6133);
    			add_location(button3, file$9, 279, 14, 6108);
    			attr(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 277, 12, 5965);
    			attr(div3, "class", "tags svelte-y2s0f9");
    			add_location(div3, file$9, 276, 10, 5934);
    			attr(th17, "class", "svelte-y2s0f9");
    			add_location(th17, file$9, 269, 8, 5647);
    			attr(tr12, "class", "item svelte-y2s0f9");
    			add_location(tr12, file$9, 267, 6, 5574);
    			attr(th18, "class", "date svelte-y2s0f9");
    			add_location(th18, file$9, 289, 8, 6321);
    			attr(h42, "class", "header svelte-y2s0f9");
    			add_location(h42, file$9, 291, 10, 6364);
    			attr(th19, "class", "svelte-y2s0f9");
    			add_location(th19, file$9, 290, 8, 6349);
    			add_location(tr13, file$9, 288, 6, 6308);
    			add_location(br3, file$9, 297, 10, 6513);
    			attr(th20, "class", "date svelte-y2s0f9");
    			add_location(th20, file$9, 295, 8, 6466);
    			attr(h56, "class", "svelte-y2s0f9");
    			add_location(h56, file$9, 301, 10, 6581);
    			attr(h65, "class", "svelte-y2s0f9");
    			add_location(h65, file$9, 302, 10, 6607);
    			attr(p6, "class", "desc svelte-y2s0f9");
    			add_location(p6, file$9, 303, 10, 6654);
    			attr(i4, "class", "far fa-newspaper svelte-y2s0f9");
    			add_location(i4, file$9, 313, 16, 7080);
    			add_location(button4, file$9, 312, 14, 7055);
    			attr(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$9, 309, 12, 6917);
    			add_location(button5, file$9, 317, 12, 7192);
    			add_location(button6, file$9, 318, 12, 7234);
    			add_location(button7, file$9, 319, 12, 7268);
    			add_location(button8, file$9, 320, 12, 7301);
    			attr(div4, "class", "tags svelte-y2s0f9");
    			add_location(div4, file$9, 308, 10, 6886);
    			attr(th21, "class", "svelte-y2s0f9");
    			add_location(th21, file$9, 300, 8, 6566);
    			attr(tr14, "class", "item svelte-y2s0f9");
    			add_location(tr14, file$9, 294, 6, 6440);
    			attr(tr15, "class", "buffer svelte-y2s0f9");
    			add_location(tr15, file$9, 324, 6, 7384);
    			add_location(br4, file$9, 328, 10, 7485);
    			attr(th22, "class", "date svelte-y2s0f9");
    			add_location(th22, file$9, 326, 8, 7438);
    			attr(h57, "class", "svelte-y2s0f9");
    			add_location(h57, file$9, 332, 10, 7553);
    			attr(h66, "class", "svelte-y2s0f9");
    			add_location(h66, file$9, 333, 10, 7579);
    			attr(p7, "class", "desc svelte-y2s0f9");
    			add_location(p7, file$9, 334, 10, 7626);
    			add_location(button9, file$9, 339, 12, 7843);
    			add_location(button10, file$9, 340, 12, 7899);
    			add_location(button11, file$9, 341, 12, 7933);
    			add_location(button12, file$9, 342, 12, 7966);
    			attr(div5, "class", "tags svelte-y2s0f9");
    			add_location(div5, file$9, 338, 10, 7812);
    			attr(th23, "class", "svelte-y2s0f9");
    			add_location(th23, file$9, 331, 8, 7538);
    			attr(tr16, "class", "item svelte-y2s0f9");
    			add_location(tr16, file$9, 325, 6, 7412);
    			attr(tr17, "class", "buffer svelte-y2s0f9");
    			add_location(tr17, file$9, 346, 6, 8036);
    			add_location(br5, file$9, 350, 10, 8137);
    			attr(th24, "class", "date svelte-y2s0f9");
    			add_location(th24, file$9, 348, 8, 8090);
    			attr(h58, "class", "svelte-y2s0f9");
    			add_location(h58, file$9, 354, 10, 8205);
    			attr(h67, "class", "svelte-y2s0f9");
    			add_location(h67, file$9, 355, 10, 8231);
    			attr(p8, "class", "desc svelte-y2s0f9");
    			add_location(p8, file$9, 356, 10, 8279);
    			add_location(button13, file$9, 361, 12, 8464);
    			add_location(button14, file$9, 362, 12, 8496);
    			add_location(button15, file$9, 363, 12, 8534);
    			attr(div6, "class", "tags svelte-y2s0f9");
    			add_location(div6, file$9, 360, 10, 8433);
    			attr(th25, "class", "svelte-y2s0f9");
    			add_location(th25, file$9, 353, 8, 8190);
    			attr(tr18, "class", "item svelte-y2s0f9");
    			add_location(tr18, file$9, 347, 6, 8064);
    			attr(th26, "class", "date svelte-y2s0f9");
    			add_location(th26, file$9, 369, 8, 8648);
    			attr(h43, "class", "header svelte-y2s0f9");
    			add_location(h43, file$9, 371, 10, 8691);
    			attr(th27, "class", "svelte-y2s0f9");
    			add_location(th27, file$9, 370, 8, 8676);
    			add_location(tr19, file$9, 368, 6, 8635);
    			add_location(br6, file$9, 377, 10, 8844);
    			attr(th28, "class", "date svelte-y2s0f9");
    			add_location(th28, file$9, 375, 8, 8793);
    			attr(h59, "class", "svelte-y2s0f9");
    			add_location(h59, file$9, 381, 10, 8908);
    			attr(h68, "class", "svelte-y2s0f9");
    			add_location(h68, file$9, 382, 10, 8953);
    			attr(p9, "class", "desc svelte-y2s0f9");
    			add_location(p9, file$9, 383, 10, 8997);
    			attr(i5, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i5, file$9, 391, 16, 9326);
    			add_location(button16, file$9, 390, 14, 9301);
    			attr(a5, "href", "https://poloclub.github.io/");
    			add_location(a5, file$9, 389, 12, 9248);
    			attr(div7, "class", "tags svelte-y2s0f9");
    			add_location(div7, file$9, 388, 10, 9217);
    			attr(th29, "class", "svelte-y2s0f9");
    			add_location(th29, file$9, 380, 8, 8893);
    			attr(tr20, "class", "item svelte-y2s0f9");
    			add_location(tr20, file$9, 374, 6, 8767);
    			attr(tr21, "class", "buffer svelte-y2s0f9");
    			add_location(tr21, file$9, 398, 6, 9469);
    			add_location(br7, file$9, 402, 10, 9576);
    			attr(th30, "class", "date svelte-y2s0f9");
    			add_location(th30, file$9, 400, 8, 9523);
    			attr(h510, "class", "svelte-y2s0f9");
    			add_location(h510, file$9, 406, 10, 9641);
    			attr(h69, "class", "svelte-y2s0f9");
    			add_location(h69, file$9, 407, 10, 9677);
    			attr(p10, "class", "desc svelte-y2s0f9");
    			add_location(p10, file$9, 408, 10, 9732);
    			attr(i6, "class", "fas fa-rocket svelte-y2s0f9");
    			add_location(i6, file$9, 416, 16, 10097);
    			add_location(button17, file$9, 415, 14, 10072);
    			attr(a6, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a6, file$9, 413, 12, 9943);
    			attr(i7, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i7, file$9, 422, 16, 10280);
    			add_location(button18, file$9, 421, 14, 10255);
    			attr(a7, "href", "http://prox-1.gatech.edu/");
    			add_location(a7, file$9, 420, 12, 10204);
    			attr(i8, "class", "far fa-newspaper svelte-y2s0f9");
    			add_location(i8, file$9, 429, 16, 10514);
    			add_location(button19, file$9, 428, 14, 10489);
    			attr(a8, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a8, file$9, 426, 12, 10384);
    			attr(div8, "class", "tags svelte-y2s0f9");
    			add_location(div8, file$9, 412, 10, 9912);
    			attr(th31, "class", "svelte-y2s0f9");
    			add_location(th31, file$9, 405, 8, 9626);
    			attr(tr22, "class", "item svelte-y2s0f9");
    			add_location(tr22, file$9, 399, 6, 9497);
    			attr(th32, "class", "date svelte-y2s0f9");
    			add_location(th32, file$9, 438, 8, 10706);
    			attr(h44, "class", "header svelte-y2s0f9");
    			add_location(h44, file$9, 440, 10, 10749);
    			attr(th33, "class", "svelte-y2s0f9");
    			add_location(th33, file$9, 439, 8, 10734);
    			add_location(tr23, file$9, 437, 6, 10693);
    			attr(th34, "class", "date svelte-y2s0f9");
    			add_location(th34, file$9, 468, 8, 11482);
    			attr(h45, "class", "header svelte-y2s0f9");
    			add_location(h45, file$9, 470, 10, 11525);
    			attr(th35, "class", "svelte-y2s0f9");
    			add_location(th35, file$9, 469, 8, 11510);
    			add_location(tr24, file$9, 467, 6, 11469);
    			attr(th36, "class", "date svelte-y2s0f9");
    			add_location(th36, file$9, 474, 8, 11616);
    			attr(h511, "class", "svelte-y2s0f9");
    			add_location(h511, file$9, 476, 10, 11671);
    			attr(h610, "class", "svelte-y2s0f9");
    			add_location(h610, file$9, 477, 10, 11724);
    			attr(p11, "class", "desc svelte-y2s0f9");
    			add_location(p11, file$9, 481, 10, 11855);
    			attr(i9, "class", "fab fa-github svelte-y2s0f9");
    			add_location(i9, file$9, 488, 16, 12170);
    			add_location(button20, file$9, 487, 14, 12145);
    			attr(a9, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a9, file$9, 486, 12, 12072);
    			attr(div9, "class", "tags svelte-y2s0f9");
    			add_location(div9, file$9, 485, 10, 12041);
    			attr(th37, "class", "svelte-y2s0f9");
    			add_location(th37, file$9, 475, 8, 11656);
    			attr(tr25, "class", "item svelte-y2s0f9");
    			add_location(tr25, file$9, 473, 6, 11590);
    			attr(tr26, "class", "buffer svelte-y2s0f9");
    			add_location(tr26, file$9, 495, 6, 12311);
    			attr(th38, "class", "date svelte-y2s0f9");
    			add_location(th38, file$9, 497, 8, 12365);
    			attr(h512, "class", "svelte-y2s0f9");
    			add_location(h512, file$9, 499, 10, 12422);
    			attr(p12, "class", "desc svelte-y2s0f9");
    			add_location(p12, file$9, 500, 10, 12474);
    			attr(i10, "class", "fas fa-file-pdf svelte-y2s0f9");
    			add_location(i10, file$9, 507, 16, 12747);
    			add_location(button21, file$9, 506, 14, 12722);
    			attr(a10, "href", "./gt_bus_analysis.pdf");
    			add_location(a10, file$9, 505, 12, 12675);
    			attr(i11, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i11, file$9, 513, 16, 12950);
    			add_location(button22, file$9, 512, 14, 12925);
    			attr(a11, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a11, file$9, 511, 12, 12853);
    			attr(div10, "class", "tags svelte-y2s0f9");
    			add_location(div10, file$9, 504, 10, 12644);
    			attr(th39, "class", "svelte-y2s0f9");
    			add_location(th39, file$9, 498, 8, 12407);
    			attr(tr27, "class", "item svelte-y2s0f9");
    			add_location(tr27, file$9, 496, 6, 12339);
    			attr(tr28, "class", "buffer svelte-y2s0f9");
    			add_location(tr28, file$9, 520, 6, 13089);
    			attr(th40, "class", "date svelte-y2s0f9");
    			add_location(th40, file$9, 522, 8, 13143);
    			attr(h513, "class", "svelte-y2s0f9");
    			add_location(h513, file$9, 524, 10, 13200);
    			attr(p13, "class", "desc svelte-y2s0f9");
    			add_location(p13, file$9, 525, 10, 13233);
    			attr(i12, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i12, file$9, 532, 16, 13517);
    			add_location(button23, file$9, 531, 14, 13492);
    			attr(a12, "href", "http://ctfs.github.io/resources/");
    			add_location(a12, file$9, 530, 12, 13434);
    			attr(i13, "class", "fab fa-github svelte-y2s0f9");
    			add_location(i13, file$9, 538, 16, 13705);
    			add_location(button24, file$9, 537, 14, 13680);
    			attr(a13, "href", "https://github.com/ctfs/resources");
    			add_location(a13, file$9, 536, 12, 13621);
    			attr(div11, "class", "tags svelte-y2s0f9");
    			add_location(div11, file$9, 529, 10, 13403);
    			attr(th41, "class", "svelte-y2s0f9");
    			add_location(th41, file$9, 523, 8, 13185);
    			attr(tr29, "class", "item svelte-y2s0f9");
    			add_location(tr29, file$9, 521, 6, 13117);
    			attr(th42, "class", "date svelte-y2s0f9");
    			add_location(th42, file$9, 547, 8, 13883);
    			attr(h46, "class", "header svelte-y2s0f9");
    			add_location(h46, file$9, 549, 10, 13926);
    			attr(th43, "class", "svelte-y2s0f9");
    			add_location(th43, file$9, 548, 8, 13911);
    			add_location(tr30, file$9, 546, 6, 13870);
    			attr(th44, "class", "date svelte-y2s0f9");
    			add_location(th44, file$9, 553, 8, 14017);
    			attr(h514, "class", "svelte-y2s0f9");
    			add_location(h514, file$9, 555, 10, 14098);
    			attr(h611, "class", "svelte-y2s0f9");
    			add_location(h611, file$9, 556, 10, 14150);
    			attr(p14, "class", "desc svelte-y2s0f9");
    			add_location(p14, file$9, 557, 10, 14209);
    			attr(th45, "class", "svelte-y2s0f9");
    			add_location(th45, file$9, 554, 8, 14083);
    			attr(tr31, "class", "item svelte-y2s0f9");
    			add_location(tr31, file$9, 552, 6, 13991);
    			attr(tr32, "class", "buffer svelte-y2s0f9");
    			add_location(tr32, file$9, 563, 6, 14394);
    			attr(th46, "class", "date svelte-y2s0f9");
    			add_location(th46, file$9, 565, 8, 14448);
    			attr(h515, "class", "svelte-y2s0f9");
    			add_location(h515, file$9, 567, 10, 14503);
    			attr(h612, "class", "svelte-y2s0f9");
    			add_location(h612, file$9, 568, 10, 14534);
    			attr(p15, "class", "desc svelte-y2s0f9");
    			add_location(p15, file$9, 569, 10, 14582);
    			attr(th47, "class", "svelte-y2s0f9");
    			add_location(th47, file$9, 566, 8, 14488);
    			attr(tr33, "class", "item svelte-y2s0f9");
    			add_location(tr33, file$9, 564, 6, 14422);
    			attr(th48, "class", "date svelte-y2s0f9");
    			add_location(th48, file$9, 577, 8, 14799);
    			attr(h47, "class", "header svelte-y2s0f9");
    			add_location(h47, file$9, 579, 10, 14842);
    			attr(th49, "class", "svelte-y2s0f9");
    			add_location(th49, file$9, 578, 8, 14827);
    			add_location(tr34, file$9, 576, 6, 14786);
    			attr(th50, "class", "date svelte-y2s0f9");
    			add_location(th50, file$9, 583, 8, 14932);
    			attr(h516, "class", "svelte-y2s0f9");
    			add_location(h516, file$9, 585, 10, 14975);
    			attr(th51, "class", "svelte-y2s0f9");
    			add_location(th51, file$9, 584, 8, 14960);
    			attr(tr35, "class", "item svelte-y2s0f9");
    			add_location(tr35, file$9, 582, 6, 14906);
    			attr(th52, "class", "date svelte-y2s0f9");
    			add_location(th52, file$9, 589, 8, 15047);
    			attr(h517, "class", "single svelte-y2s0f9");
    			add_location(h517, file$9, 591, 10, 15105);
    			attr(th53, "class", "svelte-y2s0f9");
    			add_location(th53, file$9, 590, 8, 15090);
    			add_location(tr36, file$9, 588, 6, 15034);
    			attr(th54, "class", "date svelte-y2s0f9");
    			add_location(th54, file$9, 595, 8, 15215);
    			attr(h518, "class", "single svelte-y2s0f9");
    			add_location(h518, file$9, 597, 10, 15273);
    			attr(th55, "class", "svelte-y2s0f9");
    			add_location(th55, file$9, 596, 8, 15258);
    			add_location(tr37, file$9, 594, 6, 15202);
    			attr(th56, "class", "date svelte-y2s0f9");
    			add_location(th56, file$9, 604, 8, 15455);
    			attr(h48, "class", "header svelte-y2s0f9");
    			add_location(h48, file$9, 606, 10, 15498);
    			attr(th57, "class", "svelte-y2s0f9");
    			add_location(th57, file$9, 605, 8, 15483);
    			add_location(tr38, file$9, 603, 6, 15442);
    			add_location(br8, file$9, 612, 10, 15652);
    			attr(th58, "class", "date svelte-y2s0f9");
    			add_location(th58, file$9, 610, 8, 15599);
    			attr(h519, "class", "svelte-y2s0f9");
    			add_location(h519, file$9, 616, 10, 15719);
    			attr(h613, "class", "svelte-y2s0f9");
    			add_location(h613, file$9, 617, 10, 15779);
    			attr(p16, "class", "desc svelte-y2s0f9");
    			add_location(p16, file$9, 618, 10, 15825);
    			attr(i14, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i14, file$9, 625, 16, 16107);
    			add_location(button25, file$9, 624, 14, 16082);
    			attr(a14, "href", "http://ssnc.stampsfoundation.org/");
    			add_location(a14, file$9, 623, 12, 16023);
    			attr(div12, "class", "tags svelte-y2s0f9");
    			add_location(div12, file$9, 622, 10, 15992);
    			attr(th59, "class", "svelte-y2s0f9");
    			add_location(th59, file$9, 615, 8, 15704);
    			attr(tr39, "class", "item svelte-y2s0f9");
    			add_location(tr39, file$9, 609, 6, 15573);
    			attr(tr40, "class", "buffer svelte-y2s0f9");
    			add_location(tr40, file$9, 632, 6, 16248);
    			attr(th60, "class", "date svelte-y2s0f9");
    			add_location(th60, file$9, 634, 8, 16302);
    			attr(h520, "class", "svelte-y2s0f9");
    			add_location(h520, file$9, 636, 10, 16359);
    			attr(p17, "class", "desc svelte-y2s0f9");
    			add_location(p17, file$9, 637, 10, 16389);
    			attr(i15, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i15, file$9, 643, 16, 16615);
    			add_location(button26, file$9, 642, 14, 16590);
    			attr(a15, "href", "http://admission.gatech.edu/gttours");
    			add_location(a15, file$9, 641, 12, 16529);
    			attr(div13, "class", "tags svelte-y2s0f9");
    			add_location(div13, file$9, 640, 10, 16498);
    			attr(th61, "class", "svelte-y2s0f9");
    			add_location(th61, file$9, 635, 8, 16344);
    			attr(tr41, "class", "item svelte-y2s0f9");
    			add_location(tr41, file$9, 633, 6, 16276);
    			attr(tr42, "class", "buffer svelte-y2s0f9");
    			add_location(tr42, file$9, 650, 6, 16756);
    			add_location(br9, file$9, 654, 10, 16863);
    			attr(th62, "class", "date svelte-y2s0f9");
    			add_location(th62, file$9, 652, 8, 16810);
    			attr(h521, "class", "svelte-y2s0f9");
    			add_location(h521, file$9, 658, 10, 16928);
    			attr(h614, "class", "svelte-y2s0f9");
    			add_location(h614, file$9, 659, 10, 16979);
    			attr(p18, "class", "desc svelte-y2s0f9");
    			add_location(p18, file$9, 660, 10, 17055);
    			attr(i16, "class", "fas fa-globe svelte-y2s0f9");
    			add_location(i16, file$9, 668, 16, 17386);
    			add_location(button27, file$9, 667, 14, 17361);
    			attr(a16, "href", "http://www.gtsf.gatech.edu/s/1481/alumni/17/home.aspx?sid=1481&gid=42");
    			add_location(a16, file$9, 665, 12, 17252);
    			attr(div14, "class", "tags svelte-y2s0f9");
    			add_location(div14, file$9, 664, 10, 17221);
    			attr(th63, "class", "svelte-y2s0f9");
    			add_location(th63, file$9, 657, 8, 16913);
    			attr(tr43, "class", "item svelte-y2s0f9");
    			add_location(tr43, file$9, 651, 6, 16784);
    			attr(th64, "class", "date svelte-y2s0f9");
    			add_location(th64, file$9, 677, 8, 17570);
    			attr(h49, "class", "header svelte-y2s0f9");
    			add_location(h49, file$9, 679, 10, 17613);
    			attr(th65, "class", "svelte-y2s0f9");
    			add_location(th65, file$9, 678, 8, 17598);
    			add_location(tr44, file$9, 676, 6, 17557);
    			attr(th66, "class", "date svelte-y2s0f9");
    			add_location(th66, file$9, 683, 8, 17712);
    			attr(h522, "class", "single svelte-y2s0f9");
    			add_location(h522, file$9, 686, 12, 17844);
    			attr(a17, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a17, file$9, 685, 10, 17767);
    			attr(th67, "class", "svelte-y2s0f9");
    			add_location(th67, file$9, 684, 8, 17752);
    			attr(tr45, "class", "item svelte-y2s0f9");
    			add_location(tr45, file$9, 682, 6, 17686);
    			attr(th68, "class", "date svelte-y2s0f9");
    			add_location(th68, file$9, 691, 8, 17970);
    			attr(h523, "class", "single svelte-y2s0f9");
    			add_location(h523, file$9, 694, 12, 18096);
    			attr(a18, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a18, file$9, 693, 10, 18027);
    			attr(th69, "class", "svelte-y2s0f9");
    			add_location(th69, file$9, 692, 8, 18012);
    			attr(tr46, "class", "item svelte-y2s0f9");
    			add_location(tr46, file$9, 690, 6, 17944);
    			attr(th70, "class", "date svelte-y2s0f9");
    			add_location(th70, file$9, 699, 8, 18238);
    			attr(h524, "class", "single svelte-y2s0f9");
    			add_location(h524, file$9, 701, 10, 18293);
    			attr(th71, "class", "svelte-y2s0f9");
    			add_location(th71, file$9, 700, 8, 18278);
    			attr(tr47, "class", "item svelte-y2s0f9");
    			add_location(tr47, file$9, 698, 6, 18212);
    			attr(th72, "class", "date svelte-y2s0f9");
    			add_location(th72, file$9, 705, 8, 18406);
    			attr(h525, "class", "single svelte-y2s0f9");
    			add_location(h525, file$9, 708, 12, 18540);
    			attr(a19, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a19, file$9, 707, 10, 18463);
    			attr(th73, "class", "svelte-y2s0f9");
    			add_location(th73, file$9, 706, 8, 18448);
    			attr(tr48, "class", "item svelte-y2s0f9");
    			add_location(tr48, file$9, 704, 6, 18380);
    			attr(th74, "class", "date svelte-y2s0f9");
    			add_location(th74, file$9, 713, 8, 18669);
    			attr(h526, "class", "single svelte-y2s0f9");
    			add_location(h526, file$9, 716, 12, 18780);
    			attr(a20, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a20, file$9, 715, 10, 18726);
    			attr(th75, "class", "svelte-y2s0f9");
    			add_location(th75, file$9, 714, 8, 18711);
    			attr(tr49, "class", "item svelte-y2s0f9");
    			add_location(tr49, file$9, 712, 6, 18643);
    			attr(th76, "class", "date svelte-y2s0f9");
    			add_location(th76, file$9, 721, 8, 18907);
    			attr(h527, "class", "single svelte-y2s0f9");
    			add_location(h527, file$9, 723, 10, 18964);
    			attr(th77, "class", "svelte-y2s0f9");
    			add_location(th77, file$9, 722, 8, 18949);
    			attr(tr50, "class", "item svelte-y2s0f9");
    			add_location(tr50, file$9, 720, 6, 18881);
    			attr(th78, "class", "date svelte-y2s0f9");
    			add_location(th78, file$9, 728, 8, 19083);
    			attr(h410, "class", "header svelte-y2s0f9");
    			add_location(h410, file$9, 730, 10, 19126);
    			attr(th79, "class", "svelte-y2s0f9");
    			add_location(th79, file$9, 729, 8, 19111);
    			add_location(tr51, file$9, 727, 6, 19070);
    			attr(th80, "class", "date svelte-y2s0f9");
    			add_location(th80, file$9, 734, 8, 19215);
    			attr(h528, "class", "svelte-y2s0f9");
    			add_location(h528, file$9, 736, 10, 19258);
    			add_location(button28, file$9, 738, 12, 19318);
    			add_location(button29, file$9, 739, 12, 19364);
    			add_location(button30, file$9, 740, 12, 19410);
    			attr(div15, "class", "tags svelte-y2s0f9");
    			add_location(div15, file$9, 737, 10, 19287);
    			attr(th81, "class", "svelte-y2s0f9");
    			add_location(th81, file$9, 735, 8, 19243);
    			attr(tr52, "class", "item svelte-y2s0f9");
    			add_location(tr52, file$9, 733, 6, 19189);
    			attr(tr53, "class", "buffer svelte-y2s0f9");
    			add_location(tr53, file$9, 744, 6, 19505);
    			attr(th82, "class", "date svelte-y2s0f9");
    			add_location(th82, file$9, 746, 8, 19559);
    			attr(h529, "class", "svelte-y2s0f9");
    			add_location(h529, file$9, 748, 10, 19602);
    			add_location(button31, file$9, 750, 12, 19674);
    			add_location(button32, file$9, 751, 12, 19708);
    			add_location(button33, file$9, 752, 12, 19748);
    			add_location(button34, file$9, 753, 12, 19784);
    			add_location(button35, file$9, 754, 12, 19819);
    			add_location(button36, file$9, 755, 12, 19852);
    			attr(div16, "class", "tags svelte-y2s0f9");
    			add_location(div16, file$9, 749, 10, 19643);
    			attr(th83, "class", "svelte-y2s0f9");
    			add_location(th83, file$9, 747, 8, 19587);
    			attr(tr54, "class", "item svelte-y2s0f9");
    			add_location(tr54, file$9, 745, 6, 19533);
    			attr(tr55, "class", "buffer svelte-y2s0f9");
    			add_location(tr55, file$9, 759, 6, 19921);
    			attr(th84, "class", "date svelte-y2s0f9");
    			add_location(th84, file$9, 761, 8, 19975);
    			attr(h530, "class", "svelte-y2s0f9");
    			add_location(h530, file$9, 763, 10, 20018);
    			add_location(button37, file$9, 765, 12, 20081);
    			add_location(button38, file$9, 766, 12, 20127);
    			add_location(button39, file$9, 767, 12, 20179);
    			add_location(button40, file$9, 768, 12, 20214);
    			add_location(button41, file$9, 769, 12, 20250);
    			add_location(button42, file$9, 770, 12, 20284);
    			add_location(button43, file$9, 771, 12, 20316);
    			add_location(button44, file$9, 772, 12, 20353);
    			attr(div17, "class", "tags svelte-y2s0f9");
    			add_location(div17, file$9, 764, 10, 20050);
    			attr(th85, "class", "svelte-y2s0f9");
    			add_location(th85, file$9, 762, 8, 20003);
    			attr(tr56, "class", "item svelte-y2s0f9");
    			add_location(tr56, file$9, 760, 6, 19949);
    			attr(tr57, "class", "buffer svelte-y2s0f9");
    			add_location(tr57, file$9, 776, 6, 20444);
    			attr(th86, "class", "date svelte-y2s0f9");
    			add_location(th86, file$9, 778, 8, 20498);
    			attr(p19, "class", "desc svelte-y2s0f9");
    			add_location(p19, file$9, 780, 10, 20541);
    			attr(th87, "class", "svelte-y2s0f9");
    			add_location(th87, file$9, 779, 8, 20526);
    			attr(tr58, "class", "item svelte-y2s0f9");
    			add_location(tr58, file$9, 777, 6, 20472);
    			attr(table, "class", "svelte-y2s0f9");
    			add_location(table, file$9, 151, 4, 2206);
    			attr(main, "class", "svelte-y2s0f9");
    			add_location(main, file$9, 138, 2, 1905);
    			attr(div18, "id", "container");
    			attr(div18, "class", "svelte-y2s0f9");
    			add_location(div18, file$9, 137, 0, 1882);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div18, anchor);
    			append(div18, main);
    			append(main, header);
    			append(header, h3);
    			append(h3, span0);
    			append(h3, t1);
    			append(h3, span1);
    			append(h3, t3);
    			append(h3, span2);
    			append(h3, t5);
    			append(h3, span3);
    			append(header, t7);
    			mount_component(intro, header, null);
    			append(header, t8);
    			mount_component(social, header, null);
    			append(main, t9);
    			append(main, table);
    			append(table, tr0);
    			append(tr0, th0);
    			append(tr0, t10);
    			append(tr0, th1);
    			append(th1, h40);
    			append(table, t12);
    			append(table, tr1);
    			append(tr1, th2);
    			append(th2, t13);
    			append(th2, br0);
    			append(th2, t14);
    			append(tr1, t15);
    			append(tr1, th3);
    			append(th3, h50);
    			append(th3, t17);
    			append(th3, h60);
    			append(table, t19);
    			append(table, tr2);
    			append(table, t20);
    			append(table, tr3);
    			append(tr3, th4);
    			append(th4, t21);
    			append(th4, br1);
    			append(th4, t22);
    			append(tr3, t23);
    			append(tr3, th5);
    			append(th5, h51);
    			append(th5, t25);
    			append(th5, h61);
    			append(th5, t27);
    			append(th5, p0);
    			append(table, t29);
    			append(table, tr4);
    			append(tr4, th6);
    			append(tr4, t31);
    			append(tr4, th7);
    			append(th7, h62);
    			append(th7, t33);
    			append(th7, p1);
    			append(table, t35);
    			append(table, tr5);
    			append(tr5, th8);
    			append(tr5, t36);
    			append(tr5, th9);
    			append(th9, h41);
    			append(table, t38);
    			append(table, tr6);
    			append(tr6, th10);
    			append(tr6, t40);
    			append(tr6, th11);
    			append(th11, h52);
    			append(th11, t42);
    			append(th11, p2);
    			append(th11, t44);
    			append(th11, div0);
    			append(div0, a0);
    			append(a0, button0);
    			append(button0, i0);
    			append(button0, t45);
    			append(table, t46);
    			append(table, tr7);
    			append(table, t47);
    			append(table, tr8);
    			append(tr8, th12);
    			append(tr8, t49);
    			append(tr8, th13);
    			append(th13, h53);
    			append(th13, t51);
    			append(th13, p3);
    			append(th13, t53);
    			append(th13, div1);
    			append(div1, a1);
    			append(a1, button1);
    			append(button1, i1);
    			append(button1, t54);
    			append(table, t55);
    			append(table, tr9);
    			append(table, t56);
    			append(table, tr10);
    			append(tr10, th14);
    			append(th14, t57);
    			append(th14, br2);
    			append(th14, t58);
    			append(tr10, t59);
    			append(tr10, th15);
    			append(th15, h54);
    			append(th15, t61);
    			append(th15, h63);
    			append(th15, t63);
    			append(th15, p4);
    			append(th15, t65);
    			append(th15, div2);
    			append(div2, a2);
    			append(a2, button2);
    			append(button2, i2);
    			append(button2, t66);
    			append(table, t67);
    			append(table, tr11);
    			append(table, t68);
    			append(table, tr12);
    			append(tr12, th16);
    			append(tr12, t70);
    			append(tr12, th17);
    			append(th17, h55);
    			append(th17, t72);
    			append(th17, h64);
    			append(th17, t74);
    			append(th17, p5);
    			append(th17, t76);
    			append(th17, div3);
    			append(div3, a3);
    			append(a3, button3);
    			append(button3, i3);
    			append(button3, t77);
    			append(table, t78);
    			append(table, tr13);
    			append(tr13, th18);
    			append(tr13, t79);
    			append(tr13, th19);
    			append(th19, h42);
    			append(table, t81);
    			append(table, tr14);
    			append(tr14, th20);
    			append(th20, t82);
    			append(th20, br3);
    			append(th20, t83);
    			append(tr14, t84);
    			append(tr14, th21);
    			append(th21, h56);
    			append(th21, t86);
    			append(th21, h65);
    			append(th21, t88);
    			append(th21, p6);
    			append(th21, t90);
    			append(th21, div4);
    			append(div4, a4);
    			append(a4, button4);
    			append(button4, i4);
    			append(button4, t91);
    			append(div4, t92);
    			append(div4, button5);
    			append(div4, t94);
    			append(div4, button6);
    			append(div4, t96);
    			append(div4, button7);
    			append(div4, t98);
    			append(div4, button8);
    			append(table, t100);
    			append(table, tr15);
    			append(table, t101);
    			append(table, tr16);
    			append(tr16, th22);
    			append(th22, t102);
    			append(th22, br4);
    			append(th22, t103);
    			append(tr16, t104);
    			append(tr16, th23);
    			append(th23, h57);
    			append(th23, t106);
    			append(th23, h66);
    			append(th23, t108);
    			append(th23, p7);
    			append(th23, t110);
    			append(th23, div5);
    			append(div5, button9);
    			append(div5, t112);
    			append(div5, button10);
    			append(div5, t114);
    			append(div5, button11);
    			append(div5, t116);
    			append(div5, button12);
    			append(table, t118);
    			append(table, tr17);
    			append(table, t119);
    			append(table, tr18);
    			append(tr18, th24);
    			append(th24, t120);
    			append(th24, br5);
    			append(th24, t121);
    			append(tr18, t122);
    			append(tr18, th25);
    			append(th25, h58);
    			append(th25, t124);
    			append(th25, h67);
    			append(th25, t126);
    			append(th25, p8);
    			append(th25, t128);
    			append(th25, div6);
    			append(div6, button13);
    			append(div6, t130);
    			append(div6, button14);
    			append(div6, t132);
    			append(div6, button15);
    			append(table, t134);
    			append(table, tr19);
    			append(tr19, th26);
    			append(tr19, t135);
    			append(tr19, th27);
    			append(th27, h43);
    			append(table, t137);
    			append(table, tr20);
    			append(tr20, th28);
    			append(th28, t138);
    			append(th28, br6);
    			append(th28, t139);
    			append(tr20, t140);
    			append(tr20, th29);
    			append(th29, h59);
    			append(th29, t142);
    			append(th29, h68);
    			append(th29, t144);
    			append(th29, p9);
    			append(th29, t146);
    			append(th29, div7);
    			append(div7, a5);
    			append(a5, button16);
    			append(button16, i5);
    			append(button16, t147);
    			append(table, t148);
    			append(table, tr21);
    			append(table, t149);
    			append(table, tr22);
    			append(tr22, th30);
    			append(th30, t150);
    			append(th30, br7);
    			append(th30, t151);
    			append(tr22, t152);
    			append(tr22, th31);
    			append(th31, h510);
    			append(th31, t154);
    			append(th31, h69);
    			append(th31, t156);
    			append(th31, p10);
    			append(th31, t158);
    			append(th31, div8);
    			append(div8, a6);
    			append(a6, button17);
    			append(button17, i6);
    			append(button17, t159);
    			append(div8, t160);
    			append(div8, a7);
    			append(a7, button18);
    			append(button18, i7);
    			append(button18, t161);
    			append(div8, t162);
    			append(div8, a8);
    			append(a8, button19);
    			append(button19, i8);
    			append(button19, t163);
    			append(table, t164);
    			append(table, tr23);
    			append(tr23, th32);
    			append(tr23, t165);
    			append(tr23, th33);
    			append(th33, h44);
    			append(table, t167);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append(table, t168);
    			append(table, tr24);
    			append(tr24, th34);
    			append(tr24, t169);
    			append(tr24, th35);
    			append(th35, h45);
    			append(table, t171);
    			append(table, tr25);
    			append(tr25, th36);
    			append(tr25, t173);
    			append(tr25, th37);
    			append(th37, h511);
    			append(th37, t175);
    			append(th37, h610);
    			append(th37, t177);
    			append(th37, p11);
    			append(th37, t179);
    			append(th37, div9);
    			append(div9, a9);
    			append(a9, button20);
    			append(button20, i9);
    			append(button20, t180);
    			append(table, t181);
    			append(table, tr26);
    			append(table, t182);
    			append(table, tr27);
    			append(tr27, th38);
    			append(tr27, t184);
    			append(tr27, th39);
    			append(th39, h512);
    			append(th39, t186);
    			append(th39, p12);
    			append(th39, t188);
    			append(th39, div10);
    			append(div10, a10);
    			append(a10, button21);
    			append(button21, i10);
    			append(button21, t189);
    			append(div10, t190);
    			append(div10, a11);
    			append(a11, button22);
    			append(button22, i11);
    			append(button22, t191);
    			append(table, t192);
    			append(table, tr28);
    			append(table, t193);
    			append(table, tr29);
    			append(tr29, th40);
    			append(tr29, t195);
    			append(tr29, th41);
    			append(th41, h513);
    			append(th41, t197);
    			append(th41, p13);
    			append(th41, t199);
    			append(th41, div11);
    			append(div11, a12);
    			append(a12, button23);
    			append(button23, i12);
    			append(button23, t200);
    			append(div11, t201);
    			append(div11, a13);
    			append(a13, button24);
    			append(button24, i13);
    			append(button24, t202);
    			append(table, t203);
    			append(table, tr30);
    			append(tr30, th42);
    			append(tr30, t204);
    			append(tr30, th43);
    			append(th43, h46);
    			append(table, t206);
    			append(table, tr31);
    			append(tr31, th44);
    			append(tr31, t208);
    			append(tr31, th45);
    			append(th45, h514);
    			append(th45, t210);
    			append(th45, h611);
    			append(th45, t212);
    			append(th45, p14);
    			append(table, t214);
    			append(table, tr32);
    			append(table, t215);
    			append(table, tr33);
    			append(tr33, th46);
    			append(tr33, t217);
    			append(tr33, th47);
    			append(th47, h515);
    			append(th47, t219);
    			append(th47, h612);
    			append(th47, t221);
    			append(th47, p15);
    			append(table, t223);
    			append(table, tr34);
    			append(tr34, th48);
    			append(tr34, t224);
    			append(tr34, th49);
    			append(th49, h47);
    			append(table, t226);
    			append(table, tr35);
    			append(tr35, th50);
    			append(tr35, t227);
    			append(tr35, th51);
    			append(th51, h516);
    			append(table, t229);
    			append(table, tr36);
    			append(tr36, th52);
    			append(tr36, t231);
    			append(tr36, th53);
    			append(th53, h517);
    			append(table, t233);
    			append(table, tr37);
    			append(tr37, th54);
    			append(tr37, t235);
    			append(tr37, th55);
    			append(th55, h518);
    			append(table, t237);
    			append(table, tr38);
    			append(tr38, th56);
    			append(tr38, t238);
    			append(tr38, th57);
    			append(th57, h48);
    			append(table, t240);
    			append(table, tr39);
    			append(tr39, th58);
    			append(th58, t241);
    			append(th58, br8);
    			append(th58, t242);
    			append(tr39, t243);
    			append(tr39, th59);
    			append(th59, h519);
    			append(th59, t245);
    			append(th59, h613);
    			append(th59, t247);
    			append(th59, p16);
    			append(th59, t249);
    			append(th59, div12);
    			append(div12, a14);
    			append(a14, button25);
    			append(button25, i14);
    			append(button25, t250);
    			append(table, t251);
    			append(table, tr40);
    			append(table, t252);
    			append(table, tr41);
    			append(tr41, th60);
    			append(tr41, t254);
    			append(tr41, th61);
    			append(th61, h520);
    			append(th61, t256);
    			append(th61, p17);
    			append(th61, t258);
    			append(th61, div13);
    			append(div13, a15);
    			append(a15, button26);
    			append(button26, i15);
    			append(button26, t259);
    			append(table, t260);
    			append(table, tr42);
    			append(table, t261);
    			append(table, tr43);
    			append(tr43, th62);
    			append(th62, t262);
    			append(th62, br9);
    			append(th62, t263);
    			append(tr43, t264);
    			append(tr43, th63);
    			append(th63, h521);
    			append(th63, t266);
    			append(th63, h614);
    			append(th63, t268);
    			append(th63, p18);
    			append(th63, t270);
    			append(th63, div14);
    			append(div14, a16);
    			append(a16, button27);
    			append(button27, i16);
    			append(button27, t271);
    			append(table, t272);
    			append(table, tr44);
    			append(tr44, th64);
    			append(tr44, t273);
    			append(tr44, th65);
    			append(th65, h49);
    			append(table, t275);
    			append(table, tr45);
    			append(tr45, th66);
    			append(tr45, t277);
    			append(tr45, th67);
    			append(th67, a17);
    			append(a17, h522);
    			append(table, t279);
    			append(table, tr46);
    			append(tr46, th68);
    			append(tr46, t281);
    			append(tr46, th69);
    			append(th69, a18);
    			append(a18, h523);
    			append(table, t283);
    			append(table, tr47);
    			append(tr47, th70);
    			append(tr47, t285);
    			append(tr47, th71);
    			append(th71, h524);
    			append(table, t287);
    			append(table, tr48);
    			append(tr48, th72);
    			append(tr48, t289);
    			append(tr48, th73);
    			append(th73, a19);
    			append(a19, h525);
    			append(table, t291);
    			append(table, tr49);
    			append(tr49, th74);
    			append(tr49, t293);
    			append(tr49, th75);
    			append(th75, a20);
    			append(a20, h526);
    			append(table, t295);
    			append(table, tr50);
    			append(tr50, th76);
    			append(tr50, t297);
    			append(tr50, th77);
    			append(th77, h527);
    			append(table, t299);
    			append(table, tr51);
    			append(tr51, th78);
    			append(tr51, t300);
    			append(tr51, th79);
    			append(th79, h410);
    			append(table, t302);
    			append(table, tr52);
    			append(tr52, th80);
    			append(tr52, t303);
    			append(tr52, th81);
    			append(th81, h528);
    			append(th81, t305);
    			append(th81, div15);
    			append(div15, button28);
    			append(div15, t307);
    			append(div15, button29);
    			append(div15, t309);
    			append(div15, button30);
    			append(table, t311);
    			append(table, tr53);
    			append(table, t312);
    			append(table, tr54);
    			append(tr54, th82);
    			append(tr54, t313);
    			append(tr54, th83);
    			append(th83, h529);
    			append(th83, t315);
    			append(th83, div16);
    			append(div16, button31);
    			append(div16, t317);
    			append(div16, button32);
    			append(div16, t319);
    			append(div16, button33);
    			append(div16, t321);
    			append(div16, button34);
    			append(div16, t323);
    			append(div16, button35);
    			append(div16, t325);
    			append(div16, button36);
    			append(table, t327);
    			append(table, tr55);
    			append(table, t328);
    			append(table, tr56);
    			append(tr56, th84);
    			append(tr56, t329);
    			append(tr56, th85);
    			append(th85, h530);
    			append(th85, t331);
    			append(th85, div17);
    			append(div17, button37);
    			append(div17, t333);
    			append(div17, button38);
    			append(div17, t335);
    			append(div17, button39);
    			append(div17, t337);
    			append(div17, button40);
    			append(div17, t339);
    			append(div17, button41);
    			append(div17, t341);
    			append(div17, button42);
    			append(div17, t343);
    			append(div17, button43);
    			append(div17, t345);
    			append(div17, button44);
    			append(table, t347);
    			append(table, tr57);
    			append(table, t348);
    			append(table, tr58);
    			append(tr58, th86);
    			append(tr58, t349);
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
    						each_blocks[i].m(table, t168);
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

    function instance$6($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	return {};
    }

    class Cv extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$a, safe_not_equal, []);
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
    const { document: document_1 } = globals;

    const file$a = "src/App.svelte";

    function create_fragment$b(ctx) {
    	var meta, link0, link1, link2, link3, t, current;

    	var router = new Router({
    		props: { routes: routes },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			meta = element("meta");
    			link0 = element("link");
    			link1 = element("link");
    			link2 = element("link");
    			link3 = element("link");
    			t = space();
    			router.$$.fragment.c();
    			document_1.title = "Alex Cabrera";
    			attr(meta, "name", "viewport");
    			attr(meta, "content", "width=device-width, initial-scale=1");
    			add_location(meta, file$a, 32, 2, 777);
    			attr(link0, "rel", "stylesheet");
    			attr(link0, "href", "https://unpkg.com/purecss@1.0.1/build/pure-min.css");
    			attr(link0, "integrity", "sha384-oAOxQR6DkCoMliIh8yFnu25d7Eq/PHS21PClpwjOTeU2jRSq11vu66rf90/cZr47");
    			attr(link0, "crossorigin", "anonymous");
    			add_location(link0, file$a, 33, 2, 850);
    			attr(link1, "rel", "stylesheet");
    			attr(link1, "href", "https://unpkg.com/purecss@1.0.1/build/grids-responsive-min.css");
    			add_location(link1, file$a, 38, 2, 1060);
    			attr(link2, "rel", "stylesheet");
    			attr(link2, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr(link2, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr(link2, "crossorigin", "anonymous");
    			add_location(link2, file$a, 42, 2, 1167);
    			attr(link3, "href", "https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:900,400");
    			attr(link3, "rel", "stylesheet");
    			add_location(link3, file$a, 47, 2, 1383);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			append(document_1.head, meta);
    			append(document_1.head, link0);
    			append(document_1.head, link1);
    			append(document_1.head, link2);
    			append(document_1.head, link3);
    			insert(target, t, anchor);
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
    			detach(meta);
    			detach(link0);
    			detach(link1);
    			detach(link2);
    			detach(link3);

    			if (detaching) {
    				detach(t);
    			}

    			destroy_component(router, detaching);
    		}
    	};
    }

    function instance$7($$self) {
    	

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
    		init(this, options, instance$7, create_fragment$b, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
