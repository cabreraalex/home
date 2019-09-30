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

    // (22:6) {#each news as n}
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
    			add_location(p0, file$3, 23, 10, 527);
    			attr(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$3, 24, 10, 589);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$3, 22, 8, 486);
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
    	var div2, t0, div1, div0, h1, t2, hr, t3, t4, current;

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
    			hr = element("hr");
    			t3 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			footer.$$.fragment.c();
    			attr(h1, "class", "svelte-y6vncv");
    			add_location(h1, file$3, 19, 6, 427);
    			add_location(hr, file$3, 20, 6, 447);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$3, 18, 4, 395);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$3, 17, 2, 341);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$3, 15, 0, 284);
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
    			append(div0, hr);
    			append(div0, t3);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append(div1, t4);
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
    	var p0, t0, a0, t2, a1, t4, a2, t6, a3, t8, p1, t9, b0, t11, b1, t13, b2, t15, a4, t17, p2, t18, a5, t20, a6, t22, a7, t24, a8, t26, b3, span0, t28, span1, t30, span2, t32, span3, t34, span4, t36, span5, t38;

    	return {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("I am a first year PhD student in the\n  ");
    			a0 = element("a");
    			a0.textContent = "Human Computer Interaction Institute (HCII)";
    			t2 = text("\n  at\n  ");
    			a1 = element("a");
    			a1.textContent = "Carnegie Mellon University,";
    			t4 = text("\n  advised by\n  ");
    			a2 = element("a");
    			a2.textContent = "Adam Perer";
    			t6 = text("\n  and\n  ");
    			a3 = element("a");
    			a3.textContent = "Jason Hong.";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("My research focus is broadly\n  ");
    			b0 = element("b");
    			b0.textContent = "human-centered AI,";
    			t11 = text("\n  specifically in applying techniques from\n  ");
    			b1 = element("b");
    			b1.textContent = "HCI";
    			t13 = text("\n  and\n  ");
    			b2 = element("b");
    			b2.textContent = "visualization";
    			t15 = text("\n  to help people better understand and develop machine learning models. I am\n  supported by a\n  ");
    			a4 = element("a");
    			a4.textContent = "NSF Graduate Research Fellowship.";
    			t17 = space();
    			p2 = element("p");
    			t18 = text("Before CMU, I graduated with a B.S. in Computer Science from\n  ");
    			a5 = element("a");
    			a5.textContent = "Georgia Tech,";
    			t20 = text("\n  where I was a member of the\n  ");
    			a6 = element("a");
    			a6.textContent = "Polo Club of Data Science";
    			t22 = text("\n  and worked with\n  ");
    			a7 = element("a");
    			a7.textContent = "Polo Chau";
    			t24 = text("\n  and\n  ");
    			a8 = element("a");
    			a8.textContent = "Jamie Morgenstern.";
    			t26 = text("\n  I also spent a few summers as a software engineering intern at\n  ");
    			b3 = element("b");
    			span0 = element("span");
    			span0.textContent = "G";
    			t28 = space();
    			span1 = element("span");
    			span1.textContent = "o";
    			t30 = space();
    			span2 = element("span");
    			span2.textContent = "o";
    			t32 = space();
    			span3 = element("span");
    			span3.textContent = "g";
    			t34 = space();
    			span4 = element("span");
    			span4.textContent = "l";
    			t36 = space();
    			span5 = element("span");
    			span5.textContent = "e";
    			t38 = text("\n  working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 15, 2, 193);
    			attr(a1, "href", "https://www.cmu.edu/");
    			add_location(a1, file$4, 19, 2, 288);
    			attr(a2, "href", "http://perer.org");
    			add_location(a2, file$4, 21, 2, 366);
    			attr(a3, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a3, file$4, 23, 2, 416);
    			attr(p0, "class", "svelte-1i8r28u");
    			add_location(p0, file$4, 13, 0, 148);
    			add_location(b0, file$4, 28, 2, 516);
    			add_location(b1, file$4, 30, 2, 587);
    			add_location(b2, file$4, 32, 2, 606);
    			attr(a4, "href", "https://www.nsfgrfp.org/");
    			add_location(a4, file$4, 35, 2, 723);
    			attr(p1, "class", "svelte-1i8r28u");
    			add_location(p1, file$4, 26, 0, 479);
    			attr(a5, "href", "https://www.gatech.edu/");
    			add_location(a5, file$4, 40, 2, 871);
    			attr(a6, "href", "https://poloclub.github.io/");
    			add_location(a6, file$4, 42, 2, 955);
    			attr(a7, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a7, file$4, 44, 2, 1043);
    			attr(a8, "href", "http://jamiemorgenstern.com/");
    			add_location(a8, file$4, 46, 2, 1109);
    			attr(span0, "class", "letter g svelte-1i8r28u");
    			add_location(span0, file$4, 49, 4, 1261);
    			attr(span1, "class", "letter o1 svelte-1i8r28u");
    			add_location(span1, file$4, 50, 4, 1297);
    			attr(span2, "class", "letter o2 svelte-1i8r28u");
    			add_location(span2, file$4, 51, 4, 1334);
    			attr(span3, "class", "letter g svelte-1i8r28u");
    			add_location(span3, file$4, 52, 4, 1371);
    			attr(span4, "class", "letter l svelte-1i8r28u");
    			add_location(span4, file$4, 53, 4, 1407);
    			attr(span5, "class", "letter e svelte-1i8r28u");
    			add_location(span5, file$4, 54, 4, 1443);
    			attr(b3, "class", "google svelte-1i8r28u");
    			add_location(b3, file$4, 48, 2, 1238);
    			attr(p2, "class", "svelte-1i8r28u");
    			add_location(p2, file$4, 38, 0, 802);
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
    			append(p0, a2);
    			append(p0, t6);
    			append(p0, a3);
    			insert(target, t8, anchor);
    			insert(target, p1, anchor);
    			append(p1, t9);
    			append(p1, b0);
    			append(p1, t11);
    			append(p1, b1);
    			append(p1, t13);
    			append(p1, b2);
    			append(p1, t15);
    			append(p1, a4);
    			insert(target, t17, anchor);
    			insert(target, p2, anchor);
    			append(p2, t18);
    			append(p2, a5);
    			append(p2, t20);
    			append(p2, a6);
    			append(p2, t22);
    			append(p2, a7);
    			append(p2, t24);
    			append(p2, a8);
    			append(p2, t26);
    			append(p2, b3);
    			append(b3, span0);
    			append(b3, t28);
    			append(b3, span1);
    			append(b3, t30);
    			append(b3, span2);
    			append(b3, t32);
    			append(b3, span3);
    			append(b3, t34);
    			append(b3, span4);
    			append(b3, t36);
    			append(b3, span5);
    			append(p2, t38);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p0);
    				detach(t8);
    				detach(p1);
    				detach(t17);
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

    // (27:2) {#if pub.pdf}
    function create_if_block_5(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "PDF";
    			attr(i, "class", "fas fa-file-pdf svelte-1ryagh7");
    			add_location(i, file$5, 29, 8, 448);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 30, 8, 486);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 28, 6, 411);
    			attr(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$5, 27, 4, 386);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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

    // (35:2) {#if pub.blog}
    function create_if_block_4(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Blog";
    			attr(i, "class", "fab fa-medium svelte-1ryagh7");
    			add_location(i, file$5, 37, 8, 614);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 38, 8, 650);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 36, 6, 577);
    			attr(a, "href", a_href_value = ctx.pub.blog);
    			add_location(a, file$5, 35, 4, 551);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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

    // (43:2) {#if pub.workshop}
    function create_if_block_3(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Workshop";
    			attr(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 45, 8, 787);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 46, 8, 822);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 44, 6, 750);
    			attr(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$5, 43, 4, 720);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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

    // (51:2) {#if pub.video}
    function create_if_block_2(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Video";
    			attr(i, "class", "fab fa-youtube svelte-1ryagh7");
    			add_location(i, file$5, 53, 8, 957);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 54, 8, 994);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 52, 6, 920);
    			attr(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$5, 51, 4, 893);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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

    // (59:2) {#if pub.demo}
    function create_if_block_1(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Demo";
    			attr(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 61, 8, 1124);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 62, 8, 1159);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 60, 6, 1087);
    			attr(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$5, 59, 4, 1061);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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

    // (67:2) {#if pub.code}
    function create_if_block(ctx) {
    	var a, button, i, t, p, a_href_value;

    	return {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Code";
    			attr(i, "class", "fab fa-github svelte-1ryagh7");
    			add_location(i, file$5, 69, 8, 1288);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 70, 8, 1324);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 68, 6, 1251);
    			attr(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$5, 67, 4, 1225);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			append(a, button);
    			append(button, i);
    			append(button, t);
    			append(button, p);
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
    	var div, t0, t1, t2, t3, t4, t5, a, button, i, t6, p, a_href_value;

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
    			t6 = space();
    			p = element("p");
    			p.textContent = "Website";
    			attr(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 76, 6, 1441);
    			attr(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 77, 6, 1474);
    			attr(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 75, 4, 1406);
    			attr(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a, file$5, 74, 2, 1371);
    			attr(div, "class", "buttons");
    			add_location(div, file$5, 25, 0, 344);
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
    			append(button, p);
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

    // (41:8) {#each { length: 3 } as _, i}
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
    			add_location(p0, file$6, 42, 12, 1113);
    			attr(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 43, 12, 1183);
    			attr(div, "class", "news-item pure-g");
    			add_location(div, file$6, 41, 10, 1070);
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

    // (56:8) {#each pubs as pub}
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
    			add_location(img, file$6, 60, 18, 1758);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 59, 16, 1709);
    			attr(h6, "class", "venue");
    			add_location(h6, file$6, 65, 16, 1919);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$6, 58, 14, 1673);
    			attr(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3");
    			add_location(div1, file$6, 57, 12, 1612);
    			add_location(h4, file$6, 71, 18, 2163);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$6, 70, 16, 2094);
    			attr(h5, "class", "authors");
    			add_location(h5, file$6, 73, 16, 2221);
    			attr(p, "class", "desc");
    			add_location(p, file$6, 78, 16, 2430);
    			attr(div2, "class", "padded");
    			add_location(div2, file$6, 69, 14, 2057);
    			attr(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 68, 12, 2006);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 56, 10, 1575);
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
    	var div7, t0, div6, div5, div0, h20, t1, span, t3, t4, div2, div1, h21, t6, a0, t8, hr0, t9, t10, div4, div3, h22, t12, a1, t14, hr1, t15, t16, current;

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
    			div7 = element("div");
    			sidebar.$$.fragment.c();
    			t0 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			t1 = text("Hi! You can call me\n          ");
    			span = element("span");
    			span.textContent = "Alex";
    			t3 = space();
    			intro.$$.fragment.c();
    			t4 = space();
    			div2 = element("div");
    			div1 = element("div");
    			h21 = element("h2");
    			h21.textContent = "News";
    			t6 = space();
    			a0 = element("a");
    			a0.textContent = "all news";
    			t8 = space();
    			hr0 = element("hr");
    			t9 = space();

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t10 = space();
    			div4 = element("div");
    			div3 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Selected Publications";
    			t12 = space();
    			a1 = element("a");
    			a1.textContent = "all publications";
    			t14 = space();
    			hr1 = element("hr");
    			t15 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			footer.$$.fragment.c();
    			attr(span, "class", "name");
    			add_location(span, file$6, 30, 10, 755);
    			add_location(h20, file$6, 28, 8, 710);
    			attr(div0, "id", "intro");
    			add_location(div0, file$6, 27, 6, 685);
    			attr(h21, "class", "header svelte-w4flg6");
    			add_location(h21, file$6, 36, 10, 905);
    			attr(a0, "class", "right-all");
    			attr(a0, "href", "#/news");
    			add_location(a0, file$6, 37, 10, 944);
    			attr(div1, "class", "inline svelte-w4flg6");
    			add_location(div1, file$6, 35, 8, 874);
    			add_location(hr0, file$6, 39, 8, 1015);
    			attr(div2, "id", "news");
    			attr(div2, "class", "sect");
    			add_location(div2, file$6, 34, 6, 837);
    			attr(h22, "class", "header svelte-w4flg6");
    			add_location(h22, file$6, 51, 10, 1395);
    			attr(a1, "class", "right-all");
    			attr(a1, "href", "#/pubs");
    			add_location(a1, file$6, 52, 10, 1451);
    			attr(div3, "class", "inline svelte-w4flg6");
    			add_location(div3, file$6, 50, 8, 1364);
    			add_location(hr1, file$6, 54, 8, 1530);
    			attr(div4, "id", "pubs");
    			attr(div4, "class", "sect");
    			add_location(div4, file$6, 49, 6, 1327);
    			attr(div5, "id", "padded-content");
    			add_location(div5, file$6, 26, 4, 653);
    			attr(div6, "id", "content");
    			attr(div6, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div6, file$6, 25, 2, 599);
    			attr(div7, "class", "pure-g");
    			attr(div7, "id", "main-container");
    			add_location(div7, file$6, 23, 0, 542);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div7, anchor);
    			mount_component(sidebar, div7, null);
    			append(div7, t0);
    			append(div7, div6);
    			append(div6, div5);
    			append(div5, div0);
    			append(div0, h20);
    			append(h20, t1);
    			append(h20, span);
    			append(div0, t3);
    			mount_component(intro, div0, null);
    			append(div5, t4);
    			append(div5, div2);
    			append(div2, div1);
    			append(div1, h21);
    			append(div1, t6);
    			append(div1, a0);
    			append(div2, t8);
    			append(div2, hr0);
    			append(div2, t9);

    			for (var i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			append(div5, t10);
    			append(div5, div4);
    			append(div4, div3);
    			append(div3, h22);
    			append(div3, t12);
    			append(div3, a1);
    			append(div4, t14);
    			append(div4, hr1);
    			append(div4, t15);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			append(div6, t16);
    			mount_component(footer, div6, null);
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
    						each_blocks_1[i].m(div2, null);
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
    						each_blocks[i].m(div4, null);
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
    				detach(div7);
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

    // (23:6) {#each pubs as pub}
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
    			add_location(img, file$7, 27, 16, 720);
    			attr(a0, "href", a0_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a0, file$7, 26, 14, 673);
    			attr(h6, "class", "venue");
    			add_location(h6, file$7, 29, 14, 817);
    			attr(div0, "class", "thumb");
    			add_location(div0, file$7, 25, 12, 639);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$7, 24, 10, 580);
    			add_location(h4, file$7, 35, 16, 1049);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$7, 34, 14, 982);
    			attr(h5, "class", "authors");
    			add_location(h5, file$7, 37, 14, 1103);
    			attr(p, "class", "desc");
    			add_location(p, file$7, 42, 14, 1302);
    			attr(div2, "class", "padded");
    			add_location(div2, file$7, 33, 12, 947);
    			attr(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$7, 32, 10, 898);
    			attr(div4, "class", "pure-g pub");
    			add_location(div4, file$7, 23, 8, 545);
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
    	var div2, t0, div1, div0, h1, t2, hr, t3, t4, current;

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
    			hr = element("hr");
    			t3 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			footer.$$.fragment.c();
    			attr(h1, "class", "svelte-y6vncv");
    			add_location(h1, file$7, 20, 6, 476);
    			add_location(hr, file$7, 21, 6, 504);
    			attr(div0, "id", "padded-content");
    			add_location(div0, file$7, 19, 4, 444);
    			attr(div1, "id", "content");
    			attr(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$7, 18, 2, 390);
    			attr(div2, "class", "pure-g");
    			attr(div2, "id", "main-container");
    			add_location(div2, file$7, 16, 0, 333);
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
    			append(div0, hr);
    			append(div0, t3);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append(div1, t4);
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
    	var div5, a0, i0, t0, h40, span0, t2, span1, t4, span2, t6, span3, t8, hr, t9, h1, t10_value = ctx.pub.title + "", t10, t11, div0, h3, raw0_value = ctx.pub.authors
            .map(func$2)
            .join(', ') + "", t12, div3, div1, img, img_src_value, t13, div2, p0, t14_value = ctx.pub.desc + "", t14, t15, h20, t17, p1, t18_value = ctx.pub.abstract + "", t18, t19, h21, t21, a1, h41, t22_value = ctx.pub.title + "", t22, a1_href_value, t23, h50, raw1_value = ctx.pub.authors
          .map(func_1)
          .join(', ') + "", t24, h51, i1, t25_value = ctx.pub.venuelong + "", t25, t26, t27_value = ctx.pub.location + "", t27, t28, t29_value = ctx.pub.year + "", t29, t30, t31, h22, t33, div4, code, t34_value = ctx.pub.bibtex + "", t34, t35, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	var footer = new Footer({ $$inline: true });

    	return {
    		c: function create() {
    			div5 = element("div");
    			a0 = element("a");
    			i0 = element("i");
    			t0 = space();
    			h40 = element("h4");
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
    			hr = element("hr");
    			t9 = space();
    			h1 = element("h1");
    			t10 = text(t10_value);
    			t11 = space();
    			div0 = element("div");
    			h3 = element("h3");
    			t12 = space();
    			div3 = element("div");
    			div1 = element("div");
    			img = element("img");
    			t13 = space();
    			div2 = element("div");
    			p0 = element("p");
    			t14 = text(t14_value);
    			t15 = space();
    			h20 = element("h2");
    			h20.textContent = "Abstract";
    			t17 = space();
    			p1 = element("p");
    			t18 = text(t18_value);
    			t19 = space();
    			h21 = element("h2");
    			h21.textContent = "Citation";
    			t21 = space();
    			a1 = element("a");
    			h41 = element("h4");
    			t22 = text(t22_value);
    			t23 = space();
    			h50 = element("h5");
    			t24 = space();
    			h51 = element("h5");
    			i1 = element("i");
    			t25 = text(t25_value);
    			t26 = text(". ");
    			t27 = text(t27_value);
    			t28 = text(", ");
    			t29 = text(t29_value);
    			t30 = space();
    			links.$$.fragment.c();
    			t31 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t33 = space();
    			div4 = element("div");
    			code = element("code");
    			t34 = text(t34_value);
    			t35 = space();
    			footer.$$.fragment.c();
    			attr(i0, "class", "fas fa-home svelte-1dy5qpy");
    			attr(i0, "id", "home");
    			add_location(i0, file$8, 108, 4, 1672);
    			attr(span0, "class", "color svelte-1dy5qpy");
    			add_location(span0, file$8, 110, 6, 1738);
    			attr(span1, "class", "color red svelte-1dy5qpy");
    			add_location(span1, file$8, 111, 6, 1783);
    			attr(span2, "class", "color svelte-1dy5qpy");
    			add_location(span2, file$8, 112, 6, 1825);
    			attr(span3, "class", "color red svelte-1dy5qpy");
    			add_location(span3, file$8, 113, 6, 1870);
    			attr(h40, "id", "home-link");
    			attr(h40, "class", "svelte-1dy5qpy");
    			add_location(h40, file$8, 109, 4, 1712);
    			attr(a0, "href", "/");
    			attr(a0, "class", "home svelte-1dy5qpy");
    			add_location(a0, file$8, 107, 2, 1642);
    			add_location(hr, file$8, 116, 2, 1928);
    			attr(h1, "class", "svelte-1dy5qpy");
    			add_location(h1, file$8, 117, 2, 1937);
    			attr(h3, "class", "svelte-1dy5qpy");
    			add_location(h3, file$8, 119, 4, 1980);
    			attr(div0, "id", "info");
    			attr(div0, "class", "svelte-1dy5qpy");
    			add_location(div0, file$8, 118, 2, 1960);
    			attr(img, "src", img_src_value = 'images/' + ctx.pub.teaser);
    			attr(img, "class", "teaser svelte-1dy5qpy");
    			attr(img, "alt", "teaser");
    			add_location(img, file$8, 127, 6, 2193);
    			attr(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 126, 4, 2150);
    			attr(p0, "class", "desc svelte-1dy5qpy");
    			add_location(p0, file$8, 130, 6, 2316);
    			attr(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 129, 4, 2273);
    			attr(div3, "class", "flex pure-g svelte-1dy5qpy");
    			add_location(div3, file$8, 125, 2, 2120);
    			attr(h20, "class", "sec-title svelte-1dy5qpy");
    			add_location(h20, file$8, 134, 2, 2370);
    			attr(p1, "class", "svelte-1dy5qpy");
    			add_location(p1, file$8, 135, 2, 2408);
    			attr(h21, "class", "sec-title svelte-1dy5qpy");
    			add_location(h21, file$8, 137, 2, 2433);
    			attr(h41, "class", "svelte-1dy5qpy");
    			add_location(h41, file$8, 139, 4, 2526);
    			attr(a1, "href", a1_href_value = '#/paper/' + ctx.pub.id);
    			attr(a1, "class", "paper-title");
    			add_location(a1, file$8, 138, 2, 2471);
    			attr(h50, "class", "svelte-1dy5qpy");
    			add_location(h50, file$8, 142, 2, 2557);
    			add_location(i1, file$8, 149, 4, 2690);
    			attr(h51, "class", "svelte-1dy5qpy");
    			add_location(h51, file$8, 148, 2, 2681);
    			attr(h22, "class", "sec-title svelte-1dy5qpy");
    			add_location(h22, file$8, 153, 2, 2770);
    			attr(code, "class", "bibtex");
    			add_location(code, file$8, 155, 4, 2829);
    			attr(div4, "class", "code svelte-1dy5qpy");
    			add_location(div4, file$8, 154, 2, 2806);
    			attr(div5, "id", "body");
    			attr(div5, "class", "svelte-1dy5qpy");
    			add_location(div5, file$8, 106, 0, 1624);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, a0);
    			append(a0, i0);
    			append(a0, t0);
    			append(a0, h40);
    			append(h40, span0);
    			append(h40, t2);
    			append(h40, span1);
    			append(h40, t4);
    			append(h40, span2);
    			append(h40, t6);
    			append(h40, span3);
    			append(div5, t8);
    			append(div5, hr);
    			append(div5, t9);
    			append(div5, h1);
    			append(h1, t10);
    			append(div5, t11);
    			append(div5, div0);
    			append(div0, h3);
    			h3.innerHTML = raw0_value;
    			append(div5, t12);
    			append(div5, div3);
    			append(div3, div1);
    			append(div1, img);
    			append(div3, t13);
    			append(div3, div2);
    			append(div2, p0);
    			append(p0, t14);
    			append(div5, t15);
    			append(div5, h20);
    			append(div5, t17);
    			append(div5, p1);
    			append(p1, t18);
    			append(div5, t19);
    			append(div5, h21);
    			append(div5, t21);
    			append(div5, a1);
    			append(a1, h41);
    			append(h41, t22);
    			append(div5, t23);
    			append(div5, h50);
    			h50.innerHTML = raw1_value;
    			append(div5, t24);
    			append(div5, h51);
    			append(h51, i1);
    			append(i1, t25);
    			append(i1, t26);
    			append(i1, t27);
    			append(i1, t28);
    			append(i1, t29);
    			append(div5, t30);
    			mount_component(links, div5, null);
    			append(div5, t31);
    			append(div5, h22);
    			append(div5, t33);
    			append(div5, div4);
    			append(div4, code);
    			append(code, t34);
    			append(div5, t35);
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

    // (432:6) {#each pubs as pub}
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
    			attr(th0, "class", "date svelte-zt4v9q");
    			add_location(th0, file$9, 433, 10, 10787);
    			attr(h5, "class", "svelte-zt4v9q");
    			add_location(h5, file$9, 436, 14, 10924);
    			attr(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			attr(a, "class", "paper-title");
    			add_location(a, file$9, 435, 12, 10859);
    			attr(h6, "class", "svelte-zt4v9q");
    			add_location(h6, file$9, 439, 12, 10975);
    			add_location(i, file$9, 446, 14, 11180);
    			attr(p, "class", "desc svelte-zt4v9q");
    			add_location(p, file$9, 445, 12, 11149);
    			attr(th1, "class", "svelte-zt4v9q");
    			add_location(th1, file$9, 434, 10, 10842);
    			attr(tr0, "class", "item svelte-zt4v9q");
    			add_location(tr0, file$9, 432, 8, 10759);
    			attr(tr1, "class", "buffer svelte-zt4v9q");
    			add_location(tr1, file$9, 452, 8, 11316);
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
    	var div18, main, table, tr0, th0, t0, th1, h3, span0, t2, span1, t4, span2, t6, span3, t8, t9, t10, tr1, th2, t11, th3, h40, t13, tr2, th4, t14, br0, t15, t16, th5, h50, t18, h60, t20, tr3, t21, tr4, th6, t22, br1, t23, t24, th7, h51, t26, h61, t28, p0, t30, tr5, th8, t32, th9, h62, t34, p1, t36, tr6, th10, t37, th11, h41, t39, tr7, th12, t41, th13, h52, t43, p2, t45, div0, a0, button0, i0, t46, t47, tr8, t48, tr9, th14, t50, th15, h53, t52, p3, t54, div1, a1, button1, i1, t55, t56, tr10, t57, tr11, th16, t58, br2, t59, t60, th17, h54, t62, h63, t64, p4, t66, div2, a2, button2, i2, t67, t68, tr12, t69, tr13, th18, t71, th19, h55, t73, h64, t75, p5, t77, div3, a3, button3, i3, t78, t79, tr14, th20, t80, th21, h42, t82, tr15, th22, t83, br3, t84, t85, th23, h56, t87, h65, t89, p6, t91, div4, a4, button4, i4, t92, t93, button5, t95, button6, t97, button7, t99, button8, t101, tr16, t102, tr17, th24, t103, br4, t104, t105, th25, h57, t107, h66, t109, p7, t111, div5, button9, t113, button10, t115, button11, t117, button12, t119, tr18, t120, tr19, th26, t121, br5, t122, t123, th27, h58, t125, h67, t127, p8, t129, div6, button13, t131, button14, t133, button15, t135, tr20, th28, t136, th29, h43, t138, tr21, th30, t139, br6, t140, t141, th31, h59, t143, h68, t145, p9, t147, div7, a5, button16, i5, t148, t149, tr22, t150, tr23, th32, t151, br7, t152, t153, th33, h510, t155, h69, t157, p10, t159, div8, a6, button17, i6, t160, t161, a7, button18, i7, t162, t163, a8, button19, i8, t164, t165, tr24, th34, t166, th35, h44, t168, t169, tr25, th36, t170, th37, h45, t172, tr26, th38, t174, th39, h511, t176, h610, t178, p11, t180, div9, a9, button20, i9, t181, t182, tr27, t183, tr28, th40, t185, th41, h512, t187, p12, t189, div10, a10, button21, i10, t190, t191, a11, button22, i11, t192, t193, tr29, t194, tr30, th42, t196, th43, h513, t198, p13, t200, div11, a12, button23, i12, t201, t202, a13, button24, i13, t203, t204, tr31, th44, t205, th45, h46, t207, tr32, th46, t209, th47, h514, t211, h611, t213, p14, t215, tr33, t216, tr34, th48, t218, th49, h515, t220, h612, t222, p15, t224, tr35, th50, t225, th51, h47, t227, tr36, th52, t228, th53, h516, t230, tr37, th54, t232, th55, h517, t234, tr38, th56, t236, th57, h518, t238, br8, t239, tr39, th58, t240, th59, h519, t242, tr40, th60, t244, th61, h520, t246, tr41, th62, t247, th63, h48, t249, tr42, th64, t250, br9, t251, t252, th65, h521, t254, h613, t256, p16, t258, div12, a14, button25, i14, t259, t260, tr43, t261, tr44, th66, t263, th67, h522, t265, p17, t267, div13, a15, button26, i15, t268, t269, tr45, t270, tr46, th68, t271, br10, t272, t273, th69, h523, t275, h614, t277, p18, t279, div14, a16, button27, i16, t280, t281, tr47, th70, t282, th71, h49, t284, tr48, th72, t286, th73, a17, h524, t288, tr49, th74, t290, th75, a18, h525, t292, tr50, th76, t294, th77, h526, t296, tr51, th78, t298, th79, a19, h527, t300, tr52, th80, t302, th81, a20, h528, t304, tr53, th82, t306, th83, h529, t308, tr54, th84, t309, th85, h410, t311, tr55, th86, t312, th87, h530, t314, div15, button28, t316, button29, t318, button30, t320, tr56, t321, tr57, th88, t322, th89, h531, t324, div16, button31, t326, button32, t328, button33, t330, button34, t332, button35, t334, button36, t336, tr58, t337, tr59, th90, t338, th91, h532, t340, div17, button37, t342, button38, t344, button39, t346, button40, t348, button41, t350, button42, t352, button43, t354, button44, t356, tr60, t357, tr61, th92, t358, th93, p19, current;

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
    			table = element("table");
    			tr0 = element("tr");
    			th0 = element("th");
    			t0 = space();
    			th1 = element("th");
    			h3 = element("h3");
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
    			intro.$$.fragment.c();
    			t9 = space();
    			social.$$.fragment.c();
    			t10 = space();
    			tr1 = element("tr");
    			th2 = element("th");
    			t11 = space();
    			th3 = element("th");
    			h40 = element("h4");
    			h40.textContent = "Education";
    			t13 = space();
    			tr2 = element("tr");
    			th4 = element("th");
    			t14 = text("August 2019\n          ");
    			br0 = element("br");
    			t15 = text("\n          - Present");
    			t16 = space();
    			th5 = element("th");
    			h50 = element("h5");
    			h50.textContent = "PhD in Human-Computer Interaction (HCI)";
    			t18 = space();
    			h60 = element("h6");
    			h60.textContent = "Carnegie Mellon University - Pittsburgh, PA";
    			t20 = space();
    			tr3 = element("tr");
    			t21 = space();
    			tr4 = element("tr");
    			th6 = element("th");
    			t22 = text("August 2015\n          ");
    			br1 = element("br");
    			t23 = text("\n          - May 2019");
    			t24 = space();
    			th7 = element("th");
    			h51 = element("h5");
    			h51.textContent = "B.S. in Computer Science";
    			t26 = space();
    			h61 = element("h6");
    			h61.textContent = "Georgia Institute of Technology - Atlanta, GA";
    			t28 = space();
    			p0 = element("p");
    			p0.textContent = "Concentration in intelligence and modeling/simulation. Minor in\n            economics.";
    			t30 = space();
    			tr5 = element("tr");
    			th8 = element("th");
    			th8.textContent = "Fall 2017";
    			t32 = space();
    			th9 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t34 = space();
    			p1 = element("p");
    			p1.textContent = "Exchange program with a focus on economics and political science.";
    			t36 = space();
    			tr6 = element("tr");
    			th10 = element("th");
    			t37 = space();
    			th11 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Awards";
    			t39 = space();
    			tr7 = element("tr");
    			th12 = element("th");
    			th12.textContent = "May 2019";
    			t41 = space();
    			th13 = element("th");
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
    			tr8 = element("tr");
    			t48 = space();
    			tr9 = element("tr");
    			th14 = element("th");
    			th14.textContent = "May 2019";
    			t50 = space();
    			th15 = element("th");
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
    			tr10 = element("tr");
    			t57 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			t58 = text("August 2015\n          ");
    			br2 = element("br");
    			t59 = text("\n          - May 2019");
    			t60 = space();
    			th17 = element("th");
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
    			tr12 = element("tr");
    			t69 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			th18.textContent = "February 3, 2018";
    			t71 = space();
    			th19 = element("th");
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
    			tr14 = element("tr");
    			th20 = element("th");
    			t80 = space();
    			th21 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Industry Experience";
    			t82 = space();
    			tr15 = element("tr");
    			th22 = element("th");
    			t83 = text("May 2018\n          ");
    			br3 = element("br");
    			t84 = text("\n          - August 2018");
    			t85 = space();
    			th23 = element("th");
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
    			tr16 = element("tr");
    			t102 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			t103 = text("May 2017\n          ");
    			br4 = element("br");
    			t104 = text("\n          - August 2017");
    			t105 = space();
    			th25 = element("th");
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
    			tr18 = element("tr");
    			t120 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t121 = text("May 2016\n          ");
    			br5 = element("br");
    			t122 = text("\n          - August 2016");
    			t123 = space();
    			th27 = element("th");
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
    			tr20 = element("tr");
    			th28 = element("th");
    			t136 = space();
    			th29 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Research Experience";
    			t138 = space();
    			tr21 = element("tr");
    			th30 = element("th");
    			t139 = text("January 2018\n          ");
    			br6 = element("br");
    			t140 = text("\n          - Present");
    			t141 = space();
    			th31 = element("th");
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
    			tr22 = element("tr");
    			t150 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t151 = text("September 2015\n          ");
    			br7 = element("br");
    			t152 = text("\n          - May 2017");
    			t153 = space();
    			th33 = element("th");
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
    			i6 = element("i");
    			t160 = text("\n                In space!");
    			t161 = space();
    			a7 = element("a");
    			button18 = element("button");
    			i7 = element("i");
    			t162 = text("\n                Website");
    			t163 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i8 = element("i");
    			t164 = text("\n                Press release");
    			t165 = space();
    			tr24 = element("tr");
    			th34 = element("th");
    			t166 = space();
    			th35 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Publications";
    			t168 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t169 = space();
    			tr25 = element("tr");
    			th36 = element("th");
    			t170 = space();
    			th37 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Projects";
    			t172 = space();
    			tr26 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Fall 2018";
    			t174 = space();
    			th39 = element("th");
    			h511 = element("h5");
    			h511.textContent = "ICLR'19 Reproducibility Challenge";
    			t176 = space();
    			h610 = element("h6");
    			h610.textContent = "Generative Adversarial Models For Learning Private And Fair\n            Representations";
    			t178 = space();
    			p11 = element("p");
    			p11.textContent = "Implemented the architecture and reproduced results for an ICLR'19\n            submission using GANs to decorrelate sensitive data.";
    			t180 = space();
    			div9 = element("div");
    			a9 = element("a");
    			button20 = element("button");
    			i9 = element("i");
    			t181 = text("\n                GitHub");
    			t182 = space();
    			tr27 = element("tr");
    			t183 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Spring 2018";
    			t185 = space();
    			th41 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Georgia Tech Bus System Analysis";
    			t187 = space();
    			p12 = element("p");
    			p12.textContent = "System that combines Google Maps and graph algorithms to include\n            Georgia Tech bus routes in navigation.";
    			t189 = space();
    			div10 = element("div");
    			a10 = element("a");
    			button21 = element("button");
    			i10 = element("i");
    			t190 = text("\n                Poster");
    			t191 = space();
    			a11 = element("a");
    			button22 = element("button");
    			i11 = element("i");
    			t192 = text("\n                Class");
    			t193 = space();
    			tr29 = element("tr");
    			t194 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			th42.textContent = "Spring 2014";
    			t196 = space();
    			th43 = element("th");
    			h513 = element("h5");
    			h513.textContent = "CTF Resources";
    			t198 = space();
    			p13 = element("p");
    			p13.textContent = "Introductory guide and resources for capture the flag (CTF)\n            competitions with over 800 stars on GitHub.";
    			t200 = space();
    			div11 = element("div");
    			a12 = element("a");
    			button23 = element("button");
    			i12 = element("i");
    			t201 = text("\n                Website");
    			t202 = space();
    			a13 = element("a");
    			button24 = element("button");
    			i13 = element("i");
    			t203 = text("\n                GitHub");
    			t204 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			t205 = space();
    			th45 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t207 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			th46.textContent = "Fall 2016, Spring 2017, Spring 2018";
    			t209 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Undergraduate Teaching Assistant";
    			t211 = space();
    			h611 = element("h6");
    			h611.textContent = "CS1332 - Data Structures and Algorithms";
    			t213 = space();
    			p14 = element("p");
    			p14.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t215 = space();
    			tr33 = element("tr");
    			t216 = space();
    			tr34 = element("tr");
    			th48 = element("th");
    			th48.textContent = "Fall 2016";
    			t218 = space();
    			th49 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Team Leader";
    			t220 = space();
    			h612 = element("h6");
    			h612.textContent = "GT 1000 - First-Year Seminar";
    			t222 = space();
    			p15 = element("p");
    			p15.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t224 = space();
    			tr35 = element("tr");
    			th50 = element("th");
    			t225 = space();
    			th51 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t227 = space();
    			tr36 = element("tr");
    			th52 = element("th");
    			t228 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "Student Volunteer";
    			t230 = space();
    			tr37 = element("tr");
    			th54 = element("th");
    			th54.textContent = "October 2019";
    			t232 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "IEEE Visualization Conference (VIS)";
    			t234 = space();
    			tr38 = element("tr");
    			th56 = element("th");
    			th56.textContent = "January 2019";
    			t236 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Fairness, Accountability, and Transparency (FAT*)";
    			t238 = space();
    			br8 = element("br");
    			t239 = space();
    			tr39 = element("tr");
    			th58 = element("th");
    			t240 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "Reviewer";
    			t242 = space();
    			tr40 = element("tr");
    			th60 = element("th");
    			th60.textContent = "2019";
    			t244 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t246 = space();
    			tr41 = element("tr");
    			th62 = element("th");
    			t247 = space();
    			th63 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Campus Involvement";
    			t249 = space();
    			tr42 = element("tr");
    			th64 = element("th");
    			t250 = text("September 2015\n          ");
    			br9 = element("br");
    			t251 = text("\n          - April 2017");
    			t252 = space();
    			th65 = element("th");
    			h521 = element("h5");
    			h521.textContent = "Stamps Scholars National Convention 2017";
    			t254 = space();
    			h613 = element("h6");
    			h613.textContent = "Vice-chair of large events";
    			t256 = space();
    			p16 = element("p");
    			p16.textContent = "Directed a 13 person committee in organizing hotels, meals, and\n            presentations for over 700 students.";
    			t258 = space();
    			div12 = element("div");
    			a14 = element("a");
    			button25 = element("button");
    			i14 = element("i");
    			t259 = text("\n                Website");
    			t260 = space();
    			tr43 = element("tr");
    			t261 = space();
    			tr44 = element("tr");
    			th66 = element("th");
    			th66.textContent = "Spring 2016";
    			t263 = space();
    			th67 = element("th");
    			h522 = element("h5");
    			h522.textContent = "Tour Guide";
    			t265 = space();
    			p17 = element("p");
    			p17.textContent = "Led a tour of campus for visiting families every week.";
    			t267 = space();
    			div13 = element("div");
    			a15 = element("a");
    			button26 = element("button");
    			i15 = element("i");
    			t268 = text("\n                Website");
    			t269 = space();
    			tr45 = element("tr");
    			t270 = space();
    			tr46 = element("tr");
    			th68 = element("th");
    			t271 = text("September 2015\n          ");
    			br10 = element("br");
    			t272 = text("\n          - May 2016");
    			t273 = space();
    			th69 = element("th");
    			h523 = element("h5");
    			h523.textContent = "Georgia Tech Student Foundation";
    			t275 = space();
    			h614 = element("h6");
    			h614.textContent = "Investments committee and Freshman Leadership Initiative";
    			t277 = space();
    			p18 = element("p");
    			p18.textContent = "Conducted market research to help manage a $1.2 million endowment\n            and organized fundraising events.";
    			t279 = space();
    			div14 = element("div");
    			a16 = element("a");
    			button27 = element("button");
    			i16 = element("i");
    			t280 = text("\n                Website");
    			t281 = space();
    			tr47 = element("tr");
    			th70 = element("th");
    			t282 = space();
    			th71 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Selected Classes";
    			t284 = space();
    			tr48 = element("tr");
    			th72 = element("th");
    			th72.textContent = "Fall 2018";
    			t286 = space();
    			th73 = element("th");
    			a17 = element("a");
    			h524 = element("h5");
    			h524.textContent = "CS 4803/7643 - Deep Learning";
    			t288 = space();
    			tr49 = element("tr");
    			th74 = element("th");
    			th74.textContent = "Spring 2018";
    			t290 = space();
    			th75 = element("th");
    			a18 = element("a");
    			h525 = element("h5");
    			h525.textContent = "CX 4242/CSE 6242 - Data and Visual Analytics";
    			t292 = space();
    			tr50 = element("tr");
    			th76 = element("th");
    			th76.textContent = "Fall 2017";
    			t294 = space();
    			th77 = element("th");
    			h526 = element("h5");
    			h526.textContent = "BECO 1750A - Money and Banking";
    			t296 = space();
    			tr51 = element("tr");
    			th78 = element("th");
    			th78.textContent = "Spring 2017";
    			t298 = space();
    			th79 = element("th");
    			a19 = element("a");
    			h527 = element("h5");
    			h527.textContent = "CS 4641/7641 - Machine Learning";
    			t300 = space();
    			tr52 = element("tr");
    			th80 = element("th");
    			th80.textContent = "Spring 2017";
    			t302 = space();
    			th81 = element("th");
    			a20 = element("a");
    			h528 = element("h5");
    			h528.textContent = "CX 4230 - Computer Simulation";
    			t304 = space();
    			tr53 = element("tr");
    			th82 = element("th");
    			th82.textContent = "Spring 2017";
    			t306 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "CS 3511 - Honors Algorithms";
    			t308 = space();
    			tr54 = element("tr");
    			th84 = element("th");
    			t309 = space();
    			th85 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Skills";
    			t311 = space();
    			tr55 = element("tr");
    			th86 = element("th");
    			t312 = space();
    			th87 = element("th");
    			h530 = element("h5");
    			h530.textContent = "Languages";
    			t314 = space();
    			div15 = element("div");
    			button28 = element("button");
    			button28.textContent = "English - Native";
    			t316 = space();
    			button29 = element("button");
    			button29.textContent = "Spanish - Native";
    			t318 = space();
    			button30 = element("button");
    			button30.textContent = "French - Conversational (B1)";
    			t320 = space();
    			tr56 = element("tr");
    			t321 = space();
    			tr57 = element("tr");
    			th88 = element("th");
    			t322 = space();
    			th89 = element("th");
    			h531 = element("h5");
    			h531.textContent = "Programming Languages";
    			t324 = space();
    			div16 = element("div");
    			button31 = element("button");
    			button31.textContent = "Java";
    			t326 = space();
    			button32 = element("button");
    			button32.textContent = "Javascript";
    			t328 = space();
    			button33 = element("button");
    			button33.textContent = "Python";
    			t330 = space();
    			button34 = element("button");
    			button34.textContent = "C/C++";
    			t332 = space();
    			button35 = element("button");
    			button35.textContent = "SQL";
    			t334 = space();
    			button36 = element("button");
    			button36.textContent = "Go";
    			t336 = space();
    			tr58 = element("tr");
    			t337 = space();
    			tr59 = element("tr");
    			th90 = element("th");
    			t338 = space();
    			th91 = element("th");
    			h532 = element("h5");
    			h532.textContent = "Technologies";
    			t340 = space();
    			div17 = element("div");
    			button37 = element("button");
    			button37.textContent = "Machine Learning";
    			t342 = space();
    			button38 = element("button");
    			button38.textContent = "Full Stack Development";
    			t344 = space();
    			button39 = element("button");
    			button39.textContent = "React";
    			t346 = space();
    			button40 = element("button");
    			button40.textContent = "Svelte";
    			t348 = space();
    			button41 = element("button");
    			button41.textContent = "Vega";
    			t350 = space();
    			button42 = element("button");
    			button42.textContent = "D3";
    			t352 = space();
    			button43 = element("button");
    			button43.textContent = "PyTorch";
    			t354 = space();
    			button44 = element("button");
    			button44.textContent = "Cloud Dataflow/MapReduce";
    			t356 = space();
    			tr60 = element("tr");
    			t357 = space();
    			tr61 = element("tr");
    			th92 = element("th");
    			t358 = space();
    			th93 = element("th");
    			p19 = element("p");
    			p19.textContent = "Last updated September 21, 2019.";
    			attr(th0, "class", "date svelte-zt4v9q");
    			add_location(th0, file$9, 126, 8, 1769);
    			attr(span0, "class", "color svelte-zt4v9q");
    			add_location(span0, file$9, 129, 12, 1853);
    			attr(span1, "class", "color red svelte-zt4v9q");
    			add_location(span1, file$9, 130, 12, 1904);
    			attr(span2, "class", "color svelte-zt4v9q");
    			add_location(span2, file$9, 131, 12, 1952);
    			attr(span3, "class", "color red svelte-zt4v9q");
    			add_location(span3, file$9, 132, 12, 2003);
    			attr(h3, "id", "name");
    			attr(h3, "class", "svelte-zt4v9q");
    			add_location(h3, file$9, 128, 10, 1826);
    			attr(th1, "class", "intro svelte-zt4v9q");
    			add_location(th1, file$9, 127, 8, 1797);
    			add_location(tr0, file$9, 125, 6, 1756);
    			attr(th2, "class", "date svelte-zt4v9q");
    			add_location(th2, file$9, 142, 8, 2171);
    			attr(h40, "class", "header svelte-zt4v9q");
    			add_location(h40, file$9, 144, 10, 2214);
    			attr(th3, "class", "svelte-zt4v9q");
    			add_location(th3, file$9, 143, 8, 2199);
    			add_location(tr1, file$9, 141, 6, 2158);
    			add_location(br0, file$9, 150, 10, 2356);
    			attr(th4, "class", "date svelte-zt4v9q");
    			add_location(th4, file$9, 148, 8, 2306);
    			attr(h50, "class", "svelte-zt4v9q");
    			add_location(h50, file$9, 154, 10, 2420);
    			attr(h60, "class", "svelte-zt4v9q");
    			add_location(h60, file$9, 155, 10, 2479);
    			attr(th5, "class", "svelte-zt4v9q");
    			add_location(th5, file$9, 153, 8, 2405);
    			attr(tr2, "class", "item svelte-zt4v9q");
    			add_location(tr2, file$9, 147, 6, 2280);
    			attr(tr3, "class", "buffer svelte-zt4v9q");
    			add_location(tr3, file$9, 158, 6, 2564);
    			add_location(br1, file$9, 162, 10, 2668);
    			attr(th6, "class", "date svelte-zt4v9q");
    			add_location(th6, file$9, 160, 8, 2618);
    			attr(h51, "class", "svelte-zt4v9q");
    			add_location(h51, file$9, 166, 10, 2733);
    			attr(h61, "class", "svelte-zt4v9q");
    			add_location(h61, file$9, 167, 10, 2777);
    			attr(p0, "class", "desc svelte-zt4v9q");
    			add_location(p0, file$9, 168, 10, 2842);
    			attr(th7, "class", "svelte-zt4v9q");
    			add_location(th7, file$9, 165, 8, 2718);
    			attr(tr4, "class", "item svelte-zt4v9q");
    			add_location(tr4, file$9, 159, 6, 2592);
    			attr(th8, "class", "date svelte-zt4v9q");
    			add_location(th8, file$9, 175, 8, 3031);
    			attr(h62, "class", "svelte-zt4v9q");
    			add_location(h62, file$9, 177, 10, 3086);
    			attr(p1, "class", "desc svelte-zt4v9q");
    			add_location(p1, file$9, 178, 10, 3133);
    			attr(th9, "class", "svelte-zt4v9q");
    			add_location(th9, file$9, 176, 8, 3071);
    			attr(tr5, "class", "item svelte-zt4v9q");
    			add_location(tr5, file$9, 174, 6, 3005);
    			attr(th10, "class", "date svelte-zt4v9q");
    			add_location(th10, file$9, 185, 8, 3310);
    			attr(h41, "class", "header svelte-zt4v9q");
    			add_location(h41, file$9, 187, 10, 3353);
    			attr(th11, "class", "svelte-zt4v9q");
    			add_location(th11, file$9, 186, 8, 3338);
    			add_location(tr6, file$9, 184, 6, 3297);
    			attr(th12, "class", "date svelte-zt4v9q");
    			add_location(th12, file$9, 191, 8, 3442);
    			attr(h52, "class", "svelte-zt4v9q");
    			add_location(h52, file$9, 193, 10, 3496);
    			attr(p2, "class", "desc svelte-zt4v9q");
    			add_location(p2, file$9, 196, 10, 3607);
    			attr(i0, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i0, file$9, 203, 16, 3884);
    			add_location(button0, file$9, 202, 14, 3859);
    			attr(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 201, 12, 3809);
    			attr(div0, "class", "tags svelte-zt4v9q");
    			add_location(div0, file$9, 200, 10, 3778);
    			attr(th13, "class", "svelte-zt4v9q");
    			add_location(th13, file$9, 192, 8, 3481);
    			attr(tr7, "class", "item svelte-zt4v9q");
    			add_location(tr7, file$9, 190, 6, 3416);
    			attr(tr8, "class", "buffer svelte-zt4v9q");
    			add_location(tr8, file$9, 210, 6, 4025);
    			attr(th14, "class", "date svelte-zt4v9q");
    			add_location(th14, file$9, 212, 8, 4079);
    			attr(h53, "class", "svelte-zt4v9q");
    			add_location(h53, file$9, 214, 10, 4133);
    			attr(p3, "class", "desc svelte-zt4v9q");
    			add_location(p3, file$9, 215, 10, 4187);
    			attr(i1, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i1, file$9, 223, 16, 4599);
    			add_location(button1, file$9, 222, 14, 4574);
    			attr(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 220, 12, 4417);
    			attr(div1, "class", "tags svelte-zt4v9q");
    			add_location(div1, file$9, 219, 10, 4386);
    			attr(th15, "class", "svelte-zt4v9q");
    			add_location(th15, file$9, 213, 8, 4118);
    			attr(tr9, "class", "item svelte-zt4v9q");
    			add_location(tr9, file$9, 211, 6, 4053);
    			attr(tr10, "class", "buffer svelte-zt4v9q");
    			add_location(tr10, file$9, 230, 6, 4745);
    			add_location(br2, file$9, 234, 10, 4849);
    			attr(th16, "class", "date svelte-zt4v9q");
    			add_location(th16, file$9, 232, 8, 4799);
    			attr(h54, "class", "svelte-zt4v9q");
    			add_location(h54, file$9, 238, 10, 4914);
    			attr(h63, "class", "svelte-zt4v9q");
    			add_location(h63, file$9, 239, 10, 4960);
    			attr(p4, "class", "desc svelte-zt4v9q");
    			add_location(p4, file$9, 240, 10, 5036);
    			attr(i2, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i2, file$9, 247, 16, 5318);
    			add_location(button2, file$9, 246, 14, 5293);
    			attr(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 245, 12, 5239);
    			attr(div2, "class", "tags svelte-zt4v9q");
    			add_location(div2, file$9, 244, 10, 5208);
    			attr(th17, "class", "svelte-zt4v9q");
    			add_location(th17, file$9, 237, 8, 4899);
    			attr(tr11, "class", "item svelte-zt4v9q");
    			add_location(tr11, file$9, 231, 6, 4773);
    			attr(tr12, "class", "buffer svelte-zt4v9q");
    			add_location(tr12, file$9, 254, 6, 5459);
    			attr(th18, "class", "date svelte-zt4v9q");
    			add_location(th18, file$9, 256, 8, 5513);
    			attr(h55, "class", "svelte-zt4v9q");
    			add_location(h55, file$9, 258, 10, 5575);
    			attr(h64, "class", "svelte-zt4v9q");
    			add_location(h64, file$9, 259, 10, 5617);
    			attr(p5, "class", "desc svelte-zt4v9q");
    			add_location(p5, file$9, 260, 10, 5675);
    			attr(i3, "class", "far fa-newspaper svelte-zt4v9q");
    			add_location(i3, file$9, 268, 16, 6046);
    			add_location(button3, file$9, 267, 14, 6021);
    			attr(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 265, 12, 5878);
    			attr(div3, "class", "tags svelte-zt4v9q");
    			add_location(div3, file$9, 264, 10, 5847);
    			attr(th19, "class", "svelte-zt4v9q");
    			add_location(th19, file$9, 257, 8, 5560);
    			attr(tr13, "class", "item svelte-zt4v9q");
    			add_location(tr13, file$9, 255, 6, 5487);
    			attr(th20, "class", "date svelte-zt4v9q");
    			add_location(th20, file$9, 277, 8, 6234);
    			attr(h42, "class", "header svelte-zt4v9q");
    			add_location(h42, file$9, 279, 10, 6277);
    			attr(th21, "class", "svelte-zt4v9q");
    			add_location(th21, file$9, 278, 8, 6262);
    			add_location(tr14, file$9, 276, 6, 6221);
    			add_location(br3, file$9, 285, 10, 6426);
    			attr(th22, "class", "date svelte-zt4v9q");
    			add_location(th22, file$9, 283, 8, 6379);
    			attr(h56, "class", "svelte-zt4v9q");
    			add_location(h56, file$9, 289, 10, 6494);
    			attr(h65, "class", "svelte-zt4v9q");
    			add_location(h65, file$9, 290, 10, 6520);
    			attr(p6, "class", "desc svelte-zt4v9q");
    			add_location(p6, file$9, 291, 10, 6567);
    			attr(i4, "class", "far fa-newspaper svelte-zt4v9q");
    			add_location(i4, file$9, 301, 16, 6993);
    			add_location(button4, file$9, 300, 14, 6968);
    			attr(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$9, 297, 12, 6830);
    			add_location(button5, file$9, 305, 12, 7105);
    			add_location(button6, file$9, 306, 12, 7147);
    			add_location(button7, file$9, 307, 12, 7181);
    			add_location(button8, file$9, 308, 12, 7214);
    			attr(div4, "class", "tags svelte-zt4v9q");
    			add_location(div4, file$9, 296, 10, 6799);
    			attr(th23, "class", "svelte-zt4v9q");
    			add_location(th23, file$9, 288, 8, 6479);
    			attr(tr15, "class", "item svelte-zt4v9q");
    			add_location(tr15, file$9, 282, 6, 6353);
    			attr(tr16, "class", "buffer svelte-zt4v9q");
    			add_location(tr16, file$9, 312, 6, 7297);
    			add_location(br4, file$9, 316, 10, 7398);
    			attr(th24, "class", "date svelte-zt4v9q");
    			add_location(th24, file$9, 314, 8, 7351);
    			attr(h57, "class", "svelte-zt4v9q");
    			add_location(h57, file$9, 320, 10, 7466);
    			attr(h66, "class", "svelte-zt4v9q");
    			add_location(h66, file$9, 321, 10, 7492);
    			attr(p7, "class", "desc svelte-zt4v9q");
    			add_location(p7, file$9, 322, 10, 7539);
    			add_location(button9, file$9, 327, 12, 7756);
    			add_location(button10, file$9, 328, 12, 7812);
    			add_location(button11, file$9, 329, 12, 7846);
    			add_location(button12, file$9, 330, 12, 7879);
    			attr(div5, "class", "tags svelte-zt4v9q");
    			add_location(div5, file$9, 326, 10, 7725);
    			attr(th25, "class", "svelte-zt4v9q");
    			add_location(th25, file$9, 319, 8, 7451);
    			attr(tr17, "class", "item svelte-zt4v9q");
    			add_location(tr17, file$9, 313, 6, 7325);
    			attr(tr18, "class", "buffer svelte-zt4v9q");
    			add_location(tr18, file$9, 334, 6, 7949);
    			add_location(br5, file$9, 338, 10, 8050);
    			attr(th26, "class", "date svelte-zt4v9q");
    			add_location(th26, file$9, 336, 8, 8003);
    			attr(h58, "class", "svelte-zt4v9q");
    			add_location(h58, file$9, 342, 10, 8118);
    			attr(h67, "class", "svelte-zt4v9q");
    			add_location(h67, file$9, 343, 10, 8144);
    			attr(p8, "class", "desc svelte-zt4v9q");
    			add_location(p8, file$9, 344, 10, 8192);
    			add_location(button13, file$9, 349, 12, 8377);
    			add_location(button14, file$9, 350, 12, 8409);
    			add_location(button15, file$9, 351, 12, 8447);
    			attr(div6, "class", "tags svelte-zt4v9q");
    			add_location(div6, file$9, 348, 10, 8346);
    			attr(th27, "class", "svelte-zt4v9q");
    			add_location(th27, file$9, 341, 8, 8103);
    			attr(tr19, "class", "item svelte-zt4v9q");
    			add_location(tr19, file$9, 335, 6, 7977);
    			attr(th28, "class", "date svelte-zt4v9q");
    			add_location(th28, file$9, 357, 8, 8561);
    			attr(h43, "class", "header svelte-zt4v9q");
    			add_location(h43, file$9, 359, 10, 8604);
    			attr(th29, "class", "svelte-zt4v9q");
    			add_location(th29, file$9, 358, 8, 8589);
    			add_location(tr20, file$9, 356, 6, 8548);
    			add_location(br6, file$9, 365, 10, 8757);
    			attr(th30, "class", "date svelte-zt4v9q");
    			add_location(th30, file$9, 363, 8, 8706);
    			attr(h59, "class", "svelte-zt4v9q");
    			add_location(h59, file$9, 369, 10, 8821);
    			attr(h68, "class", "svelte-zt4v9q");
    			add_location(h68, file$9, 370, 10, 8866);
    			attr(p9, "class", "desc svelte-zt4v9q");
    			add_location(p9, file$9, 371, 10, 8910);
    			attr(i5, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i5, file$9, 379, 16, 9239);
    			add_location(button16, file$9, 378, 14, 9214);
    			attr(a5, "href", "https://poloclub.github.io/");
    			add_location(a5, file$9, 377, 12, 9161);
    			attr(div7, "class", "tags svelte-zt4v9q");
    			add_location(div7, file$9, 376, 10, 9130);
    			attr(th31, "class", "svelte-zt4v9q");
    			add_location(th31, file$9, 368, 8, 8806);
    			attr(tr21, "class", "item svelte-zt4v9q");
    			add_location(tr21, file$9, 362, 6, 8680);
    			attr(tr22, "class", "buffer svelte-zt4v9q");
    			add_location(tr22, file$9, 386, 6, 9382);
    			add_location(br7, file$9, 390, 10, 9489);
    			attr(th32, "class", "date svelte-zt4v9q");
    			add_location(th32, file$9, 388, 8, 9436);
    			attr(h510, "class", "svelte-zt4v9q");
    			add_location(h510, file$9, 394, 10, 9554);
    			attr(h69, "class", "svelte-zt4v9q");
    			add_location(h69, file$9, 395, 10, 9590);
    			attr(p10, "class", "desc svelte-zt4v9q");
    			add_location(p10, file$9, 396, 10, 9645);
    			attr(i6, "class", "fas fa-rocket svelte-zt4v9q");
    			add_location(i6, file$9, 404, 16, 10010);
    			add_location(button17, file$9, 403, 14, 9985);
    			attr(a6, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a6, file$9, 401, 12, 9856);
    			attr(i7, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i7, file$9, 410, 16, 10193);
    			add_location(button18, file$9, 409, 14, 10168);
    			attr(a7, "href", "http://prox-1.gatech.edu/");
    			add_location(a7, file$9, 408, 12, 10117);
    			attr(i8, "class", "far fa-newspaper svelte-zt4v9q");
    			add_location(i8, file$9, 417, 16, 10427);
    			add_location(button19, file$9, 416, 14, 10402);
    			attr(a8, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a8, file$9, 414, 12, 10297);
    			attr(div8, "class", "tags svelte-zt4v9q");
    			add_location(div8, file$9, 400, 10, 9825);
    			attr(th33, "class", "svelte-zt4v9q");
    			add_location(th33, file$9, 393, 8, 9539);
    			attr(tr23, "class", "item svelte-zt4v9q");
    			add_location(tr23, file$9, 387, 6, 9410);
    			attr(th34, "class", "date svelte-zt4v9q");
    			add_location(th34, file$9, 426, 8, 10619);
    			attr(h44, "class", "header svelte-zt4v9q");
    			add_location(h44, file$9, 428, 10, 10662);
    			attr(th35, "class", "svelte-zt4v9q");
    			add_location(th35, file$9, 427, 8, 10647);
    			add_location(tr24, file$9, 425, 6, 10606);
    			attr(th36, "class", "date svelte-zt4v9q");
    			add_location(th36, file$9, 456, 8, 11395);
    			attr(h45, "class", "header svelte-zt4v9q");
    			add_location(h45, file$9, 458, 10, 11438);
    			attr(th37, "class", "svelte-zt4v9q");
    			add_location(th37, file$9, 457, 8, 11423);
    			add_location(tr25, file$9, 455, 6, 11382);
    			attr(th38, "class", "date svelte-zt4v9q");
    			add_location(th38, file$9, 462, 8, 11529);
    			attr(h511, "class", "svelte-zt4v9q");
    			add_location(h511, file$9, 464, 10, 11584);
    			attr(h610, "class", "svelte-zt4v9q");
    			add_location(h610, file$9, 465, 10, 11637);
    			attr(p11, "class", "desc svelte-zt4v9q");
    			add_location(p11, file$9, 469, 10, 11768);
    			attr(i9, "class", "fab fa-github svelte-zt4v9q");
    			add_location(i9, file$9, 476, 16, 12083);
    			add_location(button20, file$9, 475, 14, 12058);
    			attr(a9, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a9, file$9, 474, 12, 11985);
    			attr(div9, "class", "tags svelte-zt4v9q");
    			add_location(div9, file$9, 473, 10, 11954);
    			attr(th39, "class", "svelte-zt4v9q");
    			add_location(th39, file$9, 463, 8, 11569);
    			attr(tr26, "class", "item svelte-zt4v9q");
    			add_location(tr26, file$9, 461, 6, 11503);
    			attr(tr27, "class", "buffer svelte-zt4v9q");
    			add_location(tr27, file$9, 483, 6, 12224);
    			attr(th40, "class", "date svelte-zt4v9q");
    			add_location(th40, file$9, 485, 8, 12278);
    			attr(h512, "class", "svelte-zt4v9q");
    			add_location(h512, file$9, 487, 10, 12335);
    			attr(p12, "class", "desc svelte-zt4v9q");
    			add_location(p12, file$9, 488, 10, 12387);
    			attr(i10, "class", "fas fa-file-pdf svelte-zt4v9q");
    			add_location(i10, file$9, 495, 16, 12660);
    			add_location(button21, file$9, 494, 14, 12635);
    			attr(a10, "href", "./gt_bus_analysis.pdf");
    			add_location(a10, file$9, 493, 12, 12588);
    			attr(i11, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i11, file$9, 501, 16, 12863);
    			add_location(button22, file$9, 500, 14, 12838);
    			attr(a11, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a11, file$9, 499, 12, 12766);
    			attr(div10, "class", "tags svelte-zt4v9q");
    			add_location(div10, file$9, 492, 10, 12557);
    			attr(th41, "class", "svelte-zt4v9q");
    			add_location(th41, file$9, 486, 8, 12320);
    			attr(tr28, "class", "item svelte-zt4v9q");
    			add_location(tr28, file$9, 484, 6, 12252);
    			attr(tr29, "class", "buffer svelte-zt4v9q");
    			add_location(tr29, file$9, 508, 6, 13002);
    			attr(th42, "class", "date svelte-zt4v9q");
    			add_location(th42, file$9, 510, 8, 13056);
    			attr(h513, "class", "svelte-zt4v9q");
    			add_location(h513, file$9, 512, 10, 13113);
    			attr(p13, "class", "desc svelte-zt4v9q");
    			add_location(p13, file$9, 513, 10, 13146);
    			attr(i12, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i12, file$9, 520, 16, 13430);
    			add_location(button23, file$9, 519, 14, 13405);
    			attr(a12, "href", "http://ctfs.github.io/resources/");
    			add_location(a12, file$9, 518, 12, 13347);
    			attr(i13, "class", "fab fa-github svelte-zt4v9q");
    			add_location(i13, file$9, 526, 16, 13618);
    			add_location(button24, file$9, 525, 14, 13593);
    			attr(a13, "href", "https://github.com/ctfs/resources");
    			add_location(a13, file$9, 524, 12, 13534);
    			attr(div11, "class", "tags svelte-zt4v9q");
    			add_location(div11, file$9, 517, 10, 13316);
    			attr(th43, "class", "svelte-zt4v9q");
    			add_location(th43, file$9, 511, 8, 13098);
    			attr(tr30, "class", "item svelte-zt4v9q");
    			add_location(tr30, file$9, 509, 6, 13030);
    			attr(th44, "class", "date svelte-zt4v9q");
    			add_location(th44, file$9, 535, 8, 13796);
    			attr(h46, "class", "header svelte-zt4v9q");
    			add_location(h46, file$9, 537, 10, 13839);
    			attr(th45, "class", "svelte-zt4v9q");
    			add_location(th45, file$9, 536, 8, 13824);
    			add_location(tr31, file$9, 534, 6, 13783);
    			attr(th46, "class", "date svelte-zt4v9q");
    			add_location(th46, file$9, 541, 8, 13930);
    			attr(h514, "class", "svelte-zt4v9q");
    			add_location(h514, file$9, 543, 10, 14011);
    			attr(h611, "class", "svelte-zt4v9q");
    			add_location(h611, file$9, 544, 10, 14063);
    			attr(p14, "class", "desc svelte-zt4v9q");
    			add_location(p14, file$9, 545, 10, 14122);
    			attr(th47, "class", "svelte-zt4v9q");
    			add_location(th47, file$9, 542, 8, 13996);
    			attr(tr32, "class", "item svelte-zt4v9q");
    			add_location(tr32, file$9, 540, 6, 13904);
    			attr(tr33, "class", "buffer svelte-zt4v9q");
    			add_location(tr33, file$9, 551, 6, 14307);
    			attr(th48, "class", "date svelte-zt4v9q");
    			add_location(th48, file$9, 553, 8, 14361);
    			attr(h515, "class", "svelte-zt4v9q");
    			add_location(h515, file$9, 555, 10, 14416);
    			attr(h612, "class", "svelte-zt4v9q");
    			add_location(h612, file$9, 556, 10, 14447);
    			attr(p15, "class", "desc svelte-zt4v9q");
    			add_location(p15, file$9, 557, 10, 14495);
    			attr(th49, "class", "svelte-zt4v9q");
    			add_location(th49, file$9, 554, 8, 14401);
    			attr(tr34, "class", "item svelte-zt4v9q");
    			add_location(tr34, file$9, 552, 6, 14335);
    			attr(th50, "class", "date svelte-zt4v9q");
    			add_location(th50, file$9, 565, 8, 14712);
    			attr(h47, "class", "header svelte-zt4v9q");
    			add_location(h47, file$9, 567, 10, 14755);
    			attr(th51, "class", "svelte-zt4v9q");
    			add_location(th51, file$9, 566, 8, 14740);
    			add_location(tr35, file$9, 564, 6, 14699);
    			attr(th52, "class", "date svelte-zt4v9q");
    			add_location(th52, file$9, 571, 8, 14845);
    			attr(h516, "class", "svelte-zt4v9q");
    			add_location(h516, file$9, 573, 10, 14888);
    			attr(th53, "class", "svelte-zt4v9q");
    			add_location(th53, file$9, 572, 8, 14873);
    			attr(tr36, "class", "item svelte-zt4v9q");
    			add_location(tr36, file$9, 570, 6, 14819);
    			attr(th54, "class", "date svelte-zt4v9q");
    			add_location(th54, file$9, 577, 8, 14960);
    			attr(h517, "class", "single svelte-zt4v9q");
    			add_location(h517, file$9, 579, 10, 15018);
    			attr(th55, "class", "svelte-zt4v9q");
    			add_location(th55, file$9, 578, 8, 15003);
    			add_location(tr37, file$9, 576, 6, 14947);
    			attr(th56, "class", "date svelte-zt4v9q");
    			add_location(th56, file$9, 583, 8, 15123);
    			attr(h518, "class", "single svelte-zt4v9q");
    			add_location(h518, file$9, 585, 10, 15181);
    			attr(th57, "class", "svelte-zt4v9q");
    			add_location(th57, file$9, 584, 8, 15166);
    			add_location(tr38, file$9, 582, 6, 15110);
    			add_location(br8, file$9, 590, 6, 15311);
    			attr(th58, "class", "date svelte-zt4v9q");
    			add_location(th58, file$9, 592, 8, 15350);
    			attr(h519, "class", "svelte-zt4v9q");
    			add_location(h519, file$9, 594, 10, 15393);
    			attr(th59, "class", "svelte-zt4v9q");
    			add_location(th59, file$9, 593, 8, 15378);
    			attr(tr39, "class", "item svelte-zt4v9q");
    			add_location(tr39, file$9, 591, 6, 15324);
    			attr(th60, "class", "date svelte-zt4v9q");
    			add_location(th60, file$9, 598, 8, 15456);
    			attr(h520, "class", "single svelte-zt4v9q");
    			add_location(h520, file$9, 600, 10, 15506);
    			attr(th61, "class", "svelte-zt4v9q");
    			add_location(th61, file$9, 599, 8, 15491);
    			add_location(tr40, file$9, 597, 6, 15443);
    			attr(th62, "class", "date svelte-zt4v9q");
    			add_location(th62, file$9, 607, 8, 15697);
    			attr(h48, "class", "header svelte-zt4v9q");
    			add_location(h48, file$9, 609, 10, 15740);
    			attr(th63, "class", "svelte-zt4v9q");
    			add_location(th63, file$9, 608, 8, 15725);
    			add_location(tr41, file$9, 606, 6, 15684);
    			add_location(br9, file$9, 615, 10, 15894);
    			attr(th64, "class", "date svelte-zt4v9q");
    			add_location(th64, file$9, 613, 8, 15841);
    			attr(h521, "class", "svelte-zt4v9q");
    			add_location(h521, file$9, 619, 10, 15961);
    			attr(h613, "class", "svelte-zt4v9q");
    			add_location(h613, file$9, 620, 10, 16021);
    			attr(p16, "class", "desc svelte-zt4v9q");
    			add_location(p16, file$9, 621, 10, 16067);
    			attr(i14, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i14, file$9, 628, 16, 16349);
    			add_location(button25, file$9, 627, 14, 16324);
    			attr(a14, "href", "http://ssnc.stampsfoundation.org/");
    			add_location(a14, file$9, 626, 12, 16265);
    			attr(div12, "class", "tags svelte-zt4v9q");
    			add_location(div12, file$9, 625, 10, 16234);
    			attr(th65, "class", "svelte-zt4v9q");
    			add_location(th65, file$9, 618, 8, 15946);
    			attr(tr42, "class", "item svelte-zt4v9q");
    			add_location(tr42, file$9, 612, 6, 15815);
    			attr(tr43, "class", "buffer svelte-zt4v9q");
    			add_location(tr43, file$9, 635, 6, 16490);
    			attr(th66, "class", "date svelte-zt4v9q");
    			add_location(th66, file$9, 637, 8, 16544);
    			attr(h522, "class", "svelte-zt4v9q");
    			add_location(h522, file$9, 639, 10, 16601);
    			attr(p17, "class", "desc svelte-zt4v9q");
    			add_location(p17, file$9, 640, 10, 16631);
    			attr(i15, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i15, file$9, 646, 16, 16857);
    			add_location(button26, file$9, 645, 14, 16832);
    			attr(a15, "href", "http://admission.gatech.edu/gttours");
    			add_location(a15, file$9, 644, 12, 16771);
    			attr(div13, "class", "tags svelte-zt4v9q");
    			add_location(div13, file$9, 643, 10, 16740);
    			attr(th67, "class", "svelte-zt4v9q");
    			add_location(th67, file$9, 638, 8, 16586);
    			attr(tr44, "class", "item svelte-zt4v9q");
    			add_location(tr44, file$9, 636, 6, 16518);
    			attr(tr45, "class", "buffer svelte-zt4v9q");
    			add_location(tr45, file$9, 653, 6, 16998);
    			add_location(br10, file$9, 657, 10, 17105);
    			attr(th68, "class", "date svelte-zt4v9q");
    			add_location(th68, file$9, 655, 8, 17052);
    			attr(h523, "class", "svelte-zt4v9q");
    			add_location(h523, file$9, 661, 10, 17170);
    			attr(h614, "class", "svelte-zt4v9q");
    			add_location(h614, file$9, 662, 10, 17221);
    			attr(p18, "class", "desc svelte-zt4v9q");
    			add_location(p18, file$9, 663, 10, 17297);
    			attr(i16, "class", "fas fa-globe svelte-zt4v9q");
    			add_location(i16, file$9, 671, 16, 17628);
    			add_location(button27, file$9, 670, 14, 17603);
    			attr(a16, "href", "http://www.gtsf.gatech.edu/s/1481/alumni/17/home.aspx?sid=1481&gid=42");
    			add_location(a16, file$9, 668, 12, 17494);
    			attr(div14, "class", "tags svelte-zt4v9q");
    			add_location(div14, file$9, 667, 10, 17463);
    			attr(th69, "class", "svelte-zt4v9q");
    			add_location(th69, file$9, 660, 8, 17155);
    			attr(tr46, "class", "item svelte-zt4v9q");
    			add_location(tr46, file$9, 654, 6, 17026);
    			attr(th70, "class", "date svelte-zt4v9q");
    			add_location(th70, file$9, 680, 8, 17812);
    			attr(h49, "class", "header svelte-zt4v9q");
    			add_location(h49, file$9, 682, 10, 17855);
    			attr(th71, "class", "svelte-zt4v9q");
    			add_location(th71, file$9, 681, 8, 17840);
    			add_location(tr47, file$9, 679, 6, 17799);
    			attr(th72, "class", "date svelte-zt4v9q");
    			add_location(th72, file$9, 686, 8, 17954);
    			attr(h524, "class", "single svelte-zt4v9q");
    			add_location(h524, file$9, 689, 12, 18086);
    			attr(a17, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a17, file$9, 688, 10, 18009);
    			attr(th73, "class", "svelte-zt4v9q");
    			add_location(th73, file$9, 687, 8, 17994);
    			attr(tr48, "class", "item svelte-zt4v9q");
    			add_location(tr48, file$9, 685, 6, 17928);
    			attr(th74, "class", "date svelte-zt4v9q");
    			add_location(th74, file$9, 694, 8, 18212);
    			attr(h525, "class", "single svelte-zt4v9q");
    			add_location(h525, file$9, 697, 12, 18338);
    			attr(a18, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a18, file$9, 696, 10, 18269);
    			attr(th75, "class", "svelte-zt4v9q");
    			add_location(th75, file$9, 695, 8, 18254);
    			attr(tr49, "class", "item svelte-zt4v9q");
    			add_location(tr49, file$9, 693, 6, 18186);
    			attr(th76, "class", "date svelte-zt4v9q");
    			add_location(th76, file$9, 702, 8, 18480);
    			attr(h526, "class", "single svelte-zt4v9q");
    			add_location(h526, file$9, 704, 10, 18535);
    			attr(th77, "class", "svelte-zt4v9q");
    			add_location(th77, file$9, 703, 8, 18520);
    			attr(tr50, "class", "item svelte-zt4v9q");
    			add_location(tr50, file$9, 701, 6, 18454);
    			attr(th78, "class", "date svelte-zt4v9q");
    			add_location(th78, file$9, 708, 8, 18648);
    			attr(h527, "class", "single svelte-zt4v9q");
    			add_location(h527, file$9, 711, 12, 18782);
    			attr(a19, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a19, file$9, 710, 10, 18705);
    			attr(th79, "class", "svelte-zt4v9q");
    			add_location(th79, file$9, 709, 8, 18690);
    			attr(tr51, "class", "item svelte-zt4v9q");
    			add_location(tr51, file$9, 707, 6, 18622);
    			attr(th80, "class", "date svelte-zt4v9q");
    			add_location(th80, file$9, 716, 8, 18911);
    			attr(h528, "class", "single svelte-zt4v9q");
    			add_location(h528, file$9, 719, 12, 19022);
    			attr(a20, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a20, file$9, 718, 10, 18968);
    			attr(th81, "class", "svelte-zt4v9q");
    			add_location(th81, file$9, 717, 8, 18953);
    			attr(tr52, "class", "item svelte-zt4v9q");
    			add_location(tr52, file$9, 715, 6, 18885);
    			attr(th82, "class", "date svelte-zt4v9q");
    			add_location(th82, file$9, 724, 8, 19149);
    			attr(h529, "class", "single svelte-zt4v9q");
    			add_location(h529, file$9, 726, 10, 19206);
    			attr(th83, "class", "svelte-zt4v9q");
    			add_location(th83, file$9, 725, 8, 19191);
    			attr(tr53, "class", "item svelte-zt4v9q");
    			add_location(tr53, file$9, 723, 6, 19123);
    			attr(th84, "class", "date svelte-zt4v9q");
    			add_location(th84, file$9, 731, 8, 19325);
    			attr(h410, "class", "header svelte-zt4v9q");
    			add_location(h410, file$9, 733, 10, 19368);
    			attr(th85, "class", "svelte-zt4v9q");
    			add_location(th85, file$9, 732, 8, 19353);
    			add_location(tr54, file$9, 730, 6, 19312);
    			attr(th86, "class", "date svelte-zt4v9q");
    			add_location(th86, file$9, 737, 8, 19457);
    			attr(h530, "class", "svelte-zt4v9q");
    			add_location(h530, file$9, 739, 10, 19500);
    			add_location(button28, file$9, 741, 12, 19560);
    			add_location(button29, file$9, 742, 12, 19606);
    			add_location(button30, file$9, 743, 12, 19652);
    			attr(div15, "class", "tags svelte-zt4v9q");
    			add_location(div15, file$9, 740, 10, 19529);
    			attr(th87, "class", "svelte-zt4v9q");
    			add_location(th87, file$9, 738, 8, 19485);
    			attr(tr55, "class", "item svelte-zt4v9q");
    			add_location(tr55, file$9, 736, 6, 19431);
    			attr(tr56, "class", "buffer svelte-zt4v9q");
    			add_location(tr56, file$9, 747, 6, 19747);
    			attr(th88, "class", "date svelte-zt4v9q");
    			add_location(th88, file$9, 749, 8, 19801);
    			attr(h531, "class", "svelte-zt4v9q");
    			add_location(h531, file$9, 751, 10, 19844);
    			add_location(button31, file$9, 753, 12, 19916);
    			add_location(button32, file$9, 754, 12, 19950);
    			add_location(button33, file$9, 755, 12, 19990);
    			add_location(button34, file$9, 756, 12, 20026);
    			add_location(button35, file$9, 757, 12, 20061);
    			add_location(button36, file$9, 758, 12, 20094);
    			attr(div16, "class", "tags svelte-zt4v9q");
    			add_location(div16, file$9, 752, 10, 19885);
    			attr(th89, "class", "svelte-zt4v9q");
    			add_location(th89, file$9, 750, 8, 19829);
    			attr(tr57, "class", "item svelte-zt4v9q");
    			add_location(tr57, file$9, 748, 6, 19775);
    			attr(tr58, "class", "buffer svelte-zt4v9q");
    			add_location(tr58, file$9, 762, 6, 20163);
    			attr(th90, "class", "date svelte-zt4v9q");
    			add_location(th90, file$9, 764, 8, 20217);
    			attr(h532, "class", "svelte-zt4v9q");
    			add_location(h532, file$9, 766, 10, 20260);
    			add_location(button37, file$9, 768, 12, 20323);
    			add_location(button38, file$9, 769, 12, 20369);
    			add_location(button39, file$9, 770, 12, 20421);
    			add_location(button40, file$9, 771, 12, 20456);
    			add_location(button41, file$9, 772, 12, 20492);
    			add_location(button42, file$9, 773, 12, 20526);
    			add_location(button43, file$9, 774, 12, 20558);
    			add_location(button44, file$9, 775, 12, 20595);
    			attr(div17, "class", "tags svelte-zt4v9q");
    			add_location(div17, file$9, 767, 10, 20292);
    			attr(th91, "class", "svelte-zt4v9q");
    			add_location(th91, file$9, 765, 8, 20245);
    			attr(tr59, "class", "item svelte-zt4v9q");
    			add_location(tr59, file$9, 763, 6, 20191);
    			attr(tr60, "class", "buffer svelte-zt4v9q");
    			add_location(tr60, file$9, 779, 6, 20686);
    			attr(th92, "class", "date svelte-zt4v9q");
    			add_location(th92, file$9, 781, 8, 20740);
    			attr(p19, "class", "desc svelte-zt4v9q");
    			add_location(p19, file$9, 783, 10, 20783);
    			attr(th93, "class", "svelte-zt4v9q");
    			add_location(th93, file$9, 782, 8, 20768);
    			attr(tr61, "class", "item svelte-zt4v9q");
    			add_location(tr61, file$9, 780, 6, 20714);
    			attr(table, "class", "svelte-zt4v9q");
    			add_location(table, file$9, 124, 4, 1742);
    			attr(main, "class", "svelte-zt4v9q");
    			add_location(main, file$9, 123, 2, 1731);
    			attr(div18, "id", "container");
    			attr(div18, "class", "svelte-zt4v9q");
    			add_location(div18, file$9, 122, 0, 1708);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div18, anchor);
    			append(div18, main);
    			append(main, table);
    			append(table, tr0);
    			append(tr0, th0);
    			append(tr0, t0);
    			append(tr0, th1);
    			append(th1, h3);
    			append(h3, span0);
    			append(h3, t2);
    			append(h3, span1);
    			append(h3, t4);
    			append(h3, span2);
    			append(h3, t6);
    			append(h3, span3);
    			append(th1, t8);
    			mount_component(intro, th1, null);
    			append(th1, t9);
    			mount_component(social, th1, null);
    			append(table, t10);
    			append(table, tr1);
    			append(tr1, th2);
    			append(tr1, t11);
    			append(tr1, th3);
    			append(th3, h40);
    			append(table, t13);
    			append(table, tr2);
    			append(tr2, th4);
    			append(th4, t14);
    			append(th4, br0);
    			append(th4, t15);
    			append(tr2, t16);
    			append(tr2, th5);
    			append(th5, h50);
    			append(th5, t18);
    			append(th5, h60);
    			append(table, t20);
    			append(table, tr3);
    			append(table, t21);
    			append(table, tr4);
    			append(tr4, th6);
    			append(th6, t22);
    			append(th6, br1);
    			append(th6, t23);
    			append(tr4, t24);
    			append(tr4, th7);
    			append(th7, h51);
    			append(th7, t26);
    			append(th7, h61);
    			append(th7, t28);
    			append(th7, p0);
    			append(table, t30);
    			append(table, tr5);
    			append(tr5, th8);
    			append(tr5, t32);
    			append(tr5, th9);
    			append(th9, h62);
    			append(th9, t34);
    			append(th9, p1);
    			append(table, t36);
    			append(table, tr6);
    			append(tr6, th10);
    			append(tr6, t37);
    			append(tr6, th11);
    			append(th11, h41);
    			append(table, t39);
    			append(table, tr7);
    			append(tr7, th12);
    			append(tr7, t41);
    			append(tr7, th13);
    			append(th13, h52);
    			append(th13, t43);
    			append(th13, p2);
    			append(th13, t45);
    			append(th13, div0);
    			append(div0, a0);
    			append(a0, button0);
    			append(button0, i0);
    			append(button0, t46);
    			append(table, t47);
    			append(table, tr8);
    			append(table, t48);
    			append(table, tr9);
    			append(tr9, th14);
    			append(tr9, t50);
    			append(tr9, th15);
    			append(th15, h53);
    			append(th15, t52);
    			append(th15, p3);
    			append(th15, t54);
    			append(th15, div1);
    			append(div1, a1);
    			append(a1, button1);
    			append(button1, i1);
    			append(button1, t55);
    			append(table, t56);
    			append(table, tr10);
    			append(table, t57);
    			append(table, tr11);
    			append(tr11, th16);
    			append(th16, t58);
    			append(th16, br2);
    			append(th16, t59);
    			append(tr11, t60);
    			append(tr11, th17);
    			append(th17, h54);
    			append(th17, t62);
    			append(th17, h63);
    			append(th17, t64);
    			append(th17, p4);
    			append(th17, t66);
    			append(th17, div2);
    			append(div2, a2);
    			append(a2, button2);
    			append(button2, i2);
    			append(button2, t67);
    			append(table, t68);
    			append(table, tr12);
    			append(table, t69);
    			append(table, tr13);
    			append(tr13, th18);
    			append(tr13, t71);
    			append(tr13, th19);
    			append(th19, h55);
    			append(th19, t73);
    			append(th19, h64);
    			append(th19, t75);
    			append(th19, p5);
    			append(th19, t77);
    			append(th19, div3);
    			append(div3, a3);
    			append(a3, button3);
    			append(button3, i3);
    			append(button3, t78);
    			append(table, t79);
    			append(table, tr14);
    			append(tr14, th20);
    			append(tr14, t80);
    			append(tr14, th21);
    			append(th21, h42);
    			append(table, t82);
    			append(table, tr15);
    			append(tr15, th22);
    			append(th22, t83);
    			append(th22, br3);
    			append(th22, t84);
    			append(tr15, t85);
    			append(tr15, th23);
    			append(th23, h56);
    			append(th23, t87);
    			append(th23, h65);
    			append(th23, t89);
    			append(th23, p6);
    			append(th23, t91);
    			append(th23, div4);
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
    			append(table, tr16);
    			append(table, t102);
    			append(table, tr17);
    			append(tr17, th24);
    			append(th24, t103);
    			append(th24, br4);
    			append(th24, t104);
    			append(tr17, t105);
    			append(tr17, th25);
    			append(th25, h57);
    			append(th25, t107);
    			append(th25, h66);
    			append(th25, t109);
    			append(th25, p7);
    			append(th25, t111);
    			append(th25, div5);
    			append(div5, button9);
    			append(div5, t113);
    			append(div5, button10);
    			append(div5, t115);
    			append(div5, button11);
    			append(div5, t117);
    			append(div5, button12);
    			append(table, t119);
    			append(table, tr18);
    			append(table, t120);
    			append(table, tr19);
    			append(tr19, th26);
    			append(th26, t121);
    			append(th26, br5);
    			append(th26, t122);
    			append(tr19, t123);
    			append(tr19, th27);
    			append(th27, h58);
    			append(th27, t125);
    			append(th27, h67);
    			append(th27, t127);
    			append(th27, p8);
    			append(th27, t129);
    			append(th27, div6);
    			append(div6, button13);
    			append(div6, t131);
    			append(div6, button14);
    			append(div6, t133);
    			append(div6, button15);
    			append(table, t135);
    			append(table, tr20);
    			append(tr20, th28);
    			append(tr20, t136);
    			append(tr20, th29);
    			append(th29, h43);
    			append(table, t138);
    			append(table, tr21);
    			append(tr21, th30);
    			append(th30, t139);
    			append(th30, br6);
    			append(th30, t140);
    			append(tr21, t141);
    			append(tr21, th31);
    			append(th31, h59);
    			append(th31, t143);
    			append(th31, h68);
    			append(th31, t145);
    			append(th31, p9);
    			append(th31, t147);
    			append(th31, div7);
    			append(div7, a5);
    			append(a5, button16);
    			append(button16, i5);
    			append(button16, t148);
    			append(table, t149);
    			append(table, tr22);
    			append(table, t150);
    			append(table, tr23);
    			append(tr23, th32);
    			append(th32, t151);
    			append(th32, br7);
    			append(th32, t152);
    			append(tr23, t153);
    			append(tr23, th33);
    			append(th33, h510);
    			append(th33, t155);
    			append(th33, h69);
    			append(th33, t157);
    			append(th33, p10);
    			append(th33, t159);
    			append(th33, div8);
    			append(div8, a6);
    			append(a6, button17);
    			append(button17, i6);
    			append(button17, t160);
    			append(div8, t161);
    			append(div8, a7);
    			append(a7, button18);
    			append(button18, i7);
    			append(button18, t162);
    			append(div8, t163);
    			append(div8, a8);
    			append(a8, button19);
    			append(button19, i8);
    			append(button19, t164);
    			append(table, t165);
    			append(table, tr24);
    			append(tr24, th34);
    			append(tr24, t166);
    			append(tr24, th35);
    			append(th35, h44);
    			append(table, t168);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append(table, t169);
    			append(table, tr25);
    			append(tr25, th36);
    			append(tr25, t170);
    			append(tr25, th37);
    			append(th37, h45);
    			append(table, t172);
    			append(table, tr26);
    			append(tr26, th38);
    			append(tr26, t174);
    			append(tr26, th39);
    			append(th39, h511);
    			append(th39, t176);
    			append(th39, h610);
    			append(th39, t178);
    			append(th39, p11);
    			append(th39, t180);
    			append(th39, div9);
    			append(div9, a9);
    			append(a9, button20);
    			append(button20, i9);
    			append(button20, t181);
    			append(table, t182);
    			append(table, tr27);
    			append(table, t183);
    			append(table, tr28);
    			append(tr28, th40);
    			append(tr28, t185);
    			append(tr28, th41);
    			append(th41, h512);
    			append(th41, t187);
    			append(th41, p12);
    			append(th41, t189);
    			append(th41, div10);
    			append(div10, a10);
    			append(a10, button21);
    			append(button21, i10);
    			append(button21, t190);
    			append(div10, t191);
    			append(div10, a11);
    			append(a11, button22);
    			append(button22, i11);
    			append(button22, t192);
    			append(table, t193);
    			append(table, tr29);
    			append(table, t194);
    			append(table, tr30);
    			append(tr30, th42);
    			append(tr30, t196);
    			append(tr30, th43);
    			append(th43, h513);
    			append(th43, t198);
    			append(th43, p13);
    			append(th43, t200);
    			append(th43, div11);
    			append(div11, a12);
    			append(a12, button23);
    			append(button23, i12);
    			append(button23, t201);
    			append(div11, t202);
    			append(div11, a13);
    			append(a13, button24);
    			append(button24, i13);
    			append(button24, t203);
    			append(table, t204);
    			append(table, tr31);
    			append(tr31, th44);
    			append(tr31, t205);
    			append(tr31, th45);
    			append(th45, h46);
    			append(table, t207);
    			append(table, tr32);
    			append(tr32, th46);
    			append(tr32, t209);
    			append(tr32, th47);
    			append(th47, h514);
    			append(th47, t211);
    			append(th47, h611);
    			append(th47, t213);
    			append(th47, p14);
    			append(table, t215);
    			append(table, tr33);
    			append(table, t216);
    			append(table, tr34);
    			append(tr34, th48);
    			append(tr34, t218);
    			append(tr34, th49);
    			append(th49, h515);
    			append(th49, t220);
    			append(th49, h612);
    			append(th49, t222);
    			append(th49, p15);
    			append(table, t224);
    			append(table, tr35);
    			append(tr35, th50);
    			append(tr35, t225);
    			append(tr35, th51);
    			append(th51, h47);
    			append(table, t227);
    			append(table, tr36);
    			append(tr36, th52);
    			append(tr36, t228);
    			append(tr36, th53);
    			append(th53, h516);
    			append(table, t230);
    			append(table, tr37);
    			append(tr37, th54);
    			append(tr37, t232);
    			append(tr37, th55);
    			append(th55, h517);
    			append(table, t234);
    			append(table, tr38);
    			append(tr38, th56);
    			append(tr38, t236);
    			append(tr38, th57);
    			append(th57, h518);
    			append(table, t238);
    			append(table, br8);
    			append(table, t239);
    			append(table, tr39);
    			append(tr39, th58);
    			append(tr39, t240);
    			append(tr39, th59);
    			append(th59, h519);
    			append(table, t242);
    			append(table, tr40);
    			append(tr40, th60);
    			append(tr40, t244);
    			append(tr40, th61);
    			append(th61, h520);
    			append(table, t246);
    			append(table, tr41);
    			append(tr41, th62);
    			append(tr41, t247);
    			append(tr41, th63);
    			append(th63, h48);
    			append(table, t249);
    			append(table, tr42);
    			append(tr42, th64);
    			append(th64, t250);
    			append(th64, br9);
    			append(th64, t251);
    			append(tr42, t252);
    			append(tr42, th65);
    			append(th65, h521);
    			append(th65, t254);
    			append(th65, h613);
    			append(th65, t256);
    			append(th65, p16);
    			append(th65, t258);
    			append(th65, div12);
    			append(div12, a14);
    			append(a14, button25);
    			append(button25, i14);
    			append(button25, t259);
    			append(table, t260);
    			append(table, tr43);
    			append(table, t261);
    			append(table, tr44);
    			append(tr44, th66);
    			append(tr44, t263);
    			append(tr44, th67);
    			append(th67, h522);
    			append(th67, t265);
    			append(th67, p17);
    			append(th67, t267);
    			append(th67, div13);
    			append(div13, a15);
    			append(a15, button26);
    			append(button26, i15);
    			append(button26, t268);
    			append(table, t269);
    			append(table, tr45);
    			append(table, t270);
    			append(table, tr46);
    			append(tr46, th68);
    			append(th68, t271);
    			append(th68, br10);
    			append(th68, t272);
    			append(tr46, t273);
    			append(tr46, th69);
    			append(th69, h523);
    			append(th69, t275);
    			append(th69, h614);
    			append(th69, t277);
    			append(th69, p18);
    			append(th69, t279);
    			append(th69, div14);
    			append(div14, a16);
    			append(a16, button27);
    			append(button27, i16);
    			append(button27, t280);
    			append(table, t281);
    			append(table, tr47);
    			append(tr47, th70);
    			append(tr47, t282);
    			append(tr47, th71);
    			append(th71, h49);
    			append(table, t284);
    			append(table, tr48);
    			append(tr48, th72);
    			append(tr48, t286);
    			append(tr48, th73);
    			append(th73, a17);
    			append(a17, h524);
    			append(table, t288);
    			append(table, tr49);
    			append(tr49, th74);
    			append(tr49, t290);
    			append(tr49, th75);
    			append(th75, a18);
    			append(a18, h525);
    			append(table, t292);
    			append(table, tr50);
    			append(tr50, th76);
    			append(tr50, t294);
    			append(tr50, th77);
    			append(th77, h526);
    			append(table, t296);
    			append(table, tr51);
    			append(tr51, th78);
    			append(tr51, t298);
    			append(tr51, th79);
    			append(th79, a19);
    			append(a19, h527);
    			append(table, t300);
    			append(table, tr52);
    			append(tr52, th80);
    			append(tr52, t302);
    			append(tr52, th81);
    			append(th81, a20);
    			append(a20, h528);
    			append(table, t304);
    			append(table, tr53);
    			append(tr53, th82);
    			append(tr53, t306);
    			append(tr53, th83);
    			append(th83, h529);
    			append(table, t308);
    			append(table, tr54);
    			append(tr54, th84);
    			append(tr54, t309);
    			append(tr54, th85);
    			append(th85, h410);
    			append(table, t311);
    			append(table, tr55);
    			append(tr55, th86);
    			append(tr55, t312);
    			append(tr55, th87);
    			append(th87, h530);
    			append(th87, t314);
    			append(th87, div15);
    			append(div15, button28);
    			append(div15, t316);
    			append(div15, button29);
    			append(div15, t318);
    			append(div15, button30);
    			append(table, t320);
    			append(table, tr56);
    			append(table, t321);
    			append(table, tr57);
    			append(tr57, th88);
    			append(tr57, t322);
    			append(tr57, th89);
    			append(th89, h531);
    			append(th89, t324);
    			append(th89, div16);
    			append(div16, button31);
    			append(div16, t326);
    			append(div16, button32);
    			append(div16, t328);
    			append(div16, button33);
    			append(div16, t330);
    			append(div16, button34);
    			append(div16, t332);
    			append(div16, button35);
    			append(div16, t334);
    			append(div16, button36);
    			append(table, t336);
    			append(table, tr58);
    			append(table, t337);
    			append(table, tr59);
    			append(tr59, th90);
    			append(tr59, t338);
    			append(tr59, th91);
    			append(th91, h532);
    			append(th91, t340);
    			append(th91, div17);
    			append(div17, button37);
    			append(div17, t342);
    			append(div17, button38);
    			append(div17, t344);
    			append(div17, button39);
    			append(div17, t346);
    			append(div17, button40);
    			append(div17, t348);
    			append(div17, button41);
    			append(div17, t350);
    			append(div17, button42);
    			append(div17, t352);
    			append(div17, button43);
    			append(div17, t354);
    			append(div17, button44);
    			append(table, t356);
    			append(table, tr60);
    			append(table, t357);
    			append(table, tr61);
    			append(tr61, th92);
    			append(tr61, t358);
    			append(tr61, th93);
    			append(th93, p19);
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
    						each_blocks[i].m(table, t169);
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
