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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
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
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
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
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
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

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
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

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.12.1 */
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

    	const block = {
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

    			insert_dev(target, switch_instance_anchor, anchor);
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
    				detach_dev(switch_instance_anchor);
    			}

    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
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
            if (!component || (typeof component != 'function' && (typeof component != 'object' || component._sveltesparouter !== true))) {
                throw Error('Invalid component object')
            }

            // Path must be a regular or expression, or a string starting with '/' or '*'
            if (!path || 
                (typeof path == 'string' && (path.length < 1 || (path.charAt(0) != '/' && path.charAt(0) != '*'))) ||
                (typeof path == 'object' && !(path instanceof RegExp))
            ) {
                throw Error('Invalid value for "path" argument')
            }

            const {pattern, keys} = regexparam(path);

            this.path = path;

            // Check if the component is wrapped and we have conditions
            if (typeof component == 'object' && component._sveltesparouter === true) {
                this.component = component.route;
                this.conditions = component.conditions || [];
            }
            else {
                this.component = component;
                this.conditions = [];
            }

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

        /**
         * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
         *
         * @param {string} location - Location path
         * @param {string} querystring - Querystring
         * @returns {bool} Returns true if all the conditions succeeded
         */
        checkConditions(location, querystring) {
            for (let i = 0; i < this.conditions.length; i++) {
                if (!this.conditions[i](location, querystring)) {
                    return false
                }
            }

            return true
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

    // Event dispatcher from Svelte
    const dispatch = createEventDispatcher();

    // Just like dispatch, but executes on the next iteration of the event loop
    const dispatchNextTick = (name, detail) => {
        // Execute this code when the current call stack is complete
        setTimeout(() => {
            dispatch(name, detail);
        }, 0);
    };

    	const writable_props = ['routes'];
    	Object_1.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('routes' in $$props) $$invalidate('routes', routes = $$props.routes);
    	};

    	$$self.$capture_state = () => {
    		return { routes, component, componentParams, $loc };
    	};

    	$$self.$inject_state = $$props => {
    		if ('routes' in $$props) $$invalidate('routes', routes = $$props.routes);
    		if ('component' in $$props) $$invalidate('component', component = $$props.component);
    		if ('componentParams' in $$props) $$invalidate('componentParams', componentParams = $$props.componentParams);
    		if ('$loc' in $$props) loc.set($loc);
    	};

    	$$self.$$.update = ($$dirty = { component: 1, $loc: 1 }) => {
    		if ($$dirty.component || $$dirty.$loc) { {
                // Find a route matching the location
                $$invalidate('component', component = null);
                let i = 0;
                while (!component && i < routesList.length) {
                    const match = routesList[i].match($loc.location);
                    if (match) {
                        const detail = {
                            component: routesList[i].component.name,
                            location: $loc.location,
                            querystring: $loc.querystring
                        };
            
                        // Check if the route can be loaded - if all conditions succeed
                        if (!routesList[i].checkConditions($loc.location, $loc.querystring)) {
                            // Trigger an event to notify the user
                            dispatchNextTick('conditionsFailed', detail);
                            break
                        }
                        $$invalidate('component', component = routesList[i].component);
                        $$invalidate('componentParams', componentParams = match);
            
                        dispatchNextTick('routeLoaded', detail);
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
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Router", options, id: create_fragment.name });
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Social.svelte generated by Svelte v3.12.1 */

    const file = "src/components/Social.svelte";

    function create_fragment$1(ctx) {
    	var div, a0, h30, i0, t0, t1, a1, h31, i1, t2, t3, a2, h32, i2, t4, t5, a3, h33, i3, t6, t7, a4, h34, i4, t8;

    	const block = {
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
    			attr_dev(i0, "class", "fas fa-home");
    			add_location(i0, file, 9, 6, 123);
    			attr_dev(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file, 8, 4, 112);
    			attr_dev(a0, "href", "https://cabreraalex.com");
    			add_location(a0, file, 7, 2, 73);
    			attr_dev(i1, "class", "fas fa-envelope");
    			add_location(i1, file, 15, 6, 245);
    			attr_dev(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file, 14, 4, 234);
    			attr_dev(a1, "href", "mailto:cabrera@cmu.edu");
    			add_location(a1, file, 13, 2, 196);
    			attr_dev(i2, "class", "fab fa-twitter social-icon");
    			add_location(i2, file, 21, 6, 386);
    			attr_dev(h32, "class", "svelte-1t8evy3");
    			add_location(h32, file, 20, 4, 375);
    			attr_dev(a2, "href", "https://twitter.com/a_a_cabrera");
    			add_location(a2, file, 19, 2, 328);
    			attr_dev(i3, "class", "fab fa-github");
    			add_location(i3, file, 27, 6, 534);
    			attr_dev(h33, "class", "svelte-1t8evy3");
    			add_location(h33, file, 26, 4, 523);
    			attr_dev(a3, "href", "https://github.com/cabreraalex");
    			add_location(a3, file, 25, 2, 477);
    			attr_dev(i4, "class", "fas fa-graduation-cap");
    			add_location(i4, file, 33, 6, 693);
    			attr_dev(h34, "class", "svelte-1t8evy3");
    			add_location(h34, file, 32, 4, 682);
    			attr_dev(a4, "href", "https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en");
    			add_location(a4, file, 31, 2, 606);
    			attr_dev(div, "id", "social");
    			add_location(div, file, 6, 0, 53);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a0);
    			append_dev(a0, h30);
    			append_dev(h30, i0);
    			append_dev(h30, t0);
    			append_dev(div, t1);
    			append_dev(div, a1);
    			append_dev(a1, h31);
    			append_dev(h31, i1);
    			append_dev(h31, t2);
    			append_dev(div, t3);
    			append_dev(div, a2);
    			append_dev(a2, h32);
    			append_dev(h32, i2);
    			append_dev(h32, t4);
    			append_dev(div, t5);
    			append_dev(div, a3);
    			append_dev(a3, h33);
    			append_dev(h33, i3);
    			append_dev(h33, t6);
    			append_dev(div, t7);
    			append_dev(div, a4);
    			append_dev(a4, h34);
    			append_dev(h34, i4);
    			append_dev(h34, t8);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    class Social extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Social", options, id: create_fragment$1.name });
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.12.1 */

    const file$1 = "src/components/Sidebar.svelte";

    function create_fragment$2(ctx) {
    	var div1, div0, a0, img, t0, h1, span0, t2, br0, t3, span1, t5, span2, t7, br1, t8, span3, t10, t11, a1, button0, t13, a2, button1, current;

    	var social = new Social({ $$inline: true });

    	const block = {
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
    			attr_dev(img, "width", "170px");
    			attr_dev(img, "src", "images/profile.jpg");
    			attr_dev(img, "alt", "profile picture");
    			add_location(img, file$1, 27, 6, 435);
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$1, 26, 4, 416);
    			attr_dev(span0, "class", "color svelte-ydo7v3");
    			add_location(span0, file$1, 30, 6, 538);
    			add_location(br0, file$1, 31, 6, 583);
    			attr_dev(span1, "class", "color red svelte-ydo7v3");
    			add_location(span1, file$1, 32, 6, 596);
    			attr_dev(span2, "class", "color svelte-ydo7v3");
    			add_location(span2, file$1, 33, 6, 638);
    			add_location(br1, file$1, 34, 6, 677);
    			attr_dev(span3, "class", "color red svelte-ydo7v3");
    			add_location(span3, file$1, 35, 6, 690);
    			attr_dev(h1, "id", "name");
    			attr_dev(h1, "class", "svelte-ydo7v3");
    			add_location(h1, file$1, 29, 4, 517);
    			attr_dev(button0, "class", "cv");
    			add_location(button0, file$1, 39, 6, 781);
    			attr_dev(a1, "href", "/#/cv");
    			add_location(a1, file$1, 38, 4, 758);
    			attr_dev(button1, "class", "cv");
    			add_location(button1, file$1, 42, 6, 856);
    			attr_dev(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 41, 4, 831);
    			attr_dev(div0, "id", "padded-sidebar");
    			attr_dev(div0, "class", "svelte-ydo7v3");
    			add_location(div0, file$1, 25, 2, 386);
    			attr_dev(div1, "id", "sidebar");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$1, 24, 0, 334);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, img);
    			append_dev(div0, t0);
    			append_dev(div0, h1);
    			append_dev(h1, span0);
    			append_dev(h1, t2);
    			append_dev(h1, br0);
    			append_dev(h1, t3);
    			append_dev(h1, span1);
    			append_dev(h1, t5);
    			append_dev(h1, span2);
    			append_dev(h1, t7);
    			append_dev(h1, br1);
    			append_dev(h1, t8);
    			append_dev(h1, span3);
    			append_dev(div0, t10);
    			mount_component(social, div0, null);
    			append_dev(div0, t11);
    			append_dev(div0, a1);
    			append_dev(a1, button0);
    			append_dev(div0, t13);
    			append_dev(div0, a2);
    			append_dev(a2, button1);
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
    				detach_dev(div1);
    			}

    			destroy_component(social);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Sidebar", options, id: create_fragment$2.name });
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.12.1 */

    const file$2 = "src/components/Footer.svelte";

    function create_fragment$3(ctx) {
    	var div, p, t0, a0, t2, a1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text("© 2019 Ángel Alexander Cabrera - Developed with\n    ");
    			a0 = element("a");
    			a0.textContent = "Svelte";
    			t2 = text("\n    and\n    ");
    			a1 = element("a");
    			a1.textContent = "Pure CSS";
    			attr_dev(a0, "href", "https://svelte.dev");
    			add_location(a0, file$2, 10, 4, 186);
    			attr_dev(a1, "href", "https://purecss.io");
    			add_location(a1, file$2, 12, 4, 238);
    			attr_dev(p, "id", "copyright");
    			add_location(p, file$2, 8, 2, 104);
    			attr_dev(div, "class", "footer svelte-wg51xb");
    			add_location(div, file$2, 7, 0, 81);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, a0);
    			append_dev(p, t2);
    			append_dev(p, a1);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$3.name, type: "component", source: "", ctx });
    	return block;
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Footer", options, id: create_fragment$3.name });
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

    /* src/News.svelte generated by Svelte v3.12.1 */

    const file$3 = "src/News.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.n = list[i];
    	return child_ctx;
    }

    // (22:6) {#each news as n}
    function create_each_block(ctx) {
    	var div, p0, t0_value = ctx.n.date + "", t0, t1, p1, raw_value = ctx.n.news + "", t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			attr_dev(p0, "class", "pure-u-1 pure-u-md-1-5 date");
    			add_location(p0, file$3, 23, 10, 527);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$3, 24, 10, 589);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$3, 22, 8, 486);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, p1);
    			p1.innerHTML = raw_value;
    			append_dev(div, t2);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(22:6) {#each news as n}", ctx });
    	return block;
    }

    function create_fragment$4(ctx) {
    	var div2, t0, div1, div0, h1, t2, hr, t3, t4, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	let each_value = news;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	var footer = new Footer({ $$inline: true });

    	const block = {
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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			footer.$$.fragment.c();
    			attr_dev(h1, "class", "svelte-y6vncv");
    			add_location(h1, file$3, 19, 6, 427);
    			add_location(hr, file$3, 20, 6, 447);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$3, 18, 4, 395);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$3, 17, 2, 341);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$3, 15, 0, 284);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(sidebar, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t2);
    			append_dev(div0, hr);
    			append_dev(div0, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t4);
    			mount_component(footer, div1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value = news;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
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
    				detach_dev(div2);
    			}

    			destroy_component(sidebar);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$4.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class News extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$4, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "News", options, id: create_fragment$4.name });
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
        venuelong:
          "IEEE Conference on Visual Analytics Science and Technology (VAST)",
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
        pdf: "https://arxiv.org/abs/1904.05419",
        video: "https://vimeo.com/showcase/6524122/video/368702211",
        slides: "./FairVis.pdf"
      },
      {
        title:
          "Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation",
        desc:
          "We introduce a method for automatically generating subgroups of instances that a model may be biased against. The instances are first clustered and then described by their dominating features. By ranking and sorting the groups by their performance metrics (F1, accuracy, etc. ) users can spot groups that are underperforming.",
        id: "subgroup-gen",
        teaser: "iclr.png",
        venue: "Workshop, ICLR'19",
        venuelong: "Debugging Machine Learning Models Workshop (Debug ML) at ICLR",
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

    /* src/components/Intro.svelte generated by Svelte v3.12.1 */

    const file$4 = "src/components/Intro.svelte";

    function create_fragment$5(ctx) {
    	var p0, t0, a0, t2, a1, t4, a2, t6, a3, t8, p1, t9, b0, t11, b1, t13, b2, t15, a4, t17, p2, t18, a5, t20, a6, t22, a7, t24, b3, span0, t26, span1, t28, span2, t30, span3, t32, span4, t34, span5, t36;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("I am a PhD student in the\n  ");
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
    			t15 = text("\n  to help people develop machine learning models that are better aligned with\n  human values. I am supported by a\n  ");
    			a4 = element("a");
    			a4.textContent = "NSF Graduate Research Fellowship.";
    			t17 = space();
    			p2 = element("p");
    			t18 = text("Before CMU, I graduated with a B.S. in Computer Science from\n  ");
    			a5 = element("a");
    			a5.textContent = "Georgia Tech,";
    			t20 = text("\n  where I worked with\n  ");
    			a6 = element("a");
    			a6.textContent = "Polo Chau";
    			t22 = text("\n  and\n  ");
    			a7 = element("a");
    			a7.textContent = "Jamie Morgenstern.";
    			t24 = text("\n  I also spent a few summers as a software engineering intern at\n  ");
    			b3 = element("b");
    			span0 = element("span");
    			span0.textContent = "G";
    			t26 = space();
    			span1 = element("span");
    			span1.textContent = "o";
    			t28 = space();
    			span2 = element("span");
    			span2.textContent = "o";
    			t30 = space();
    			span3 = element("span");
    			span3.textContent = "g";
    			t32 = space();
    			span4 = element("span");
    			span4.textContent = "l";
    			t34 = space();
    			span5 = element("span");
    			span5.textContent = "e";
    			t36 = text("\n  working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr_dev(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 14, 2, 166);
    			attr_dev(a1, "href", "https://www.cmu.edu/");
    			add_location(a1, file$4, 18, 2, 261);
    			attr_dev(a2, "href", "http://perer.org");
    			add_location(a2, file$4, 20, 2, 339);
    			attr_dev(a3, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a3, file$4, 22, 2, 389);
    			attr_dev(p0, "class", "svelte-1071h7w");
    			add_location(p0, file$4, 12, 0, 132);
    			add_location(b0, file$4, 27, 2, 489);
    			add_location(b1, file$4, 29, 2, 560);
    			add_location(b2, file$4, 31, 2, 579);
    			attr_dev(a4, "href", "https://www.nsfgrfp.org/");
    			add_location(a4, file$4, 34, 2, 716);
    			attr_dev(p1, "class", "svelte-1071h7w");
    			add_location(p1, file$4, 25, 0, 452);
    			attr_dev(a5, "href", "https://www.gatech.edu/");
    			add_location(a5, file$4, 39, 2, 864);
    			attr_dev(a6, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a6, file$4, 41, 2, 940);
    			attr_dev(a7, "href", "http://jamiemorgenstern.com/");
    			add_location(a7, file$4, 43, 2, 1006);
    			attr_dev(span0, "class", "letter g svelte-1071h7w");
    			add_location(span0, file$4, 46, 4, 1158);
    			attr_dev(span1, "class", "letter o1 svelte-1071h7w");
    			add_location(span1, file$4, 47, 4, 1194);
    			attr_dev(span2, "class", "letter o2 svelte-1071h7w");
    			add_location(span2, file$4, 48, 4, 1231);
    			attr_dev(span3, "class", "letter g svelte-1071h7w");
    			add_location(span3, file$4, 49, 4, 1268);
    			attr_dev(span4, "class", "letter l svelte-1071h7w");
    			add_location(span4, file$4, 50, 4, 1304);
    			attr_dev(span5, "class", "letter e svelte-1071h7w");
    			add_location(span5, file$4, 51, 4, 1340);
    			attr_dev(b3, "class", "google svelte-1071h7w");
    			add_location(b3, file$4, 45, 2, 1135);
    			attr_dev(p2, "class", "svelte-1071h7w");
    			add_location(p2, file$4, 37, 0, 795);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t0);
    			append_dev(p0, a0);
    			append_dev(p0, t2);
    			append_dev(p0, a1);
    			append_dev(p0, t4);
    			append_dev(p0, a2);
    			append_dev(p0, t6);
    			append_dev(p0, a3);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t9);
    			append_dev(p1, b0);
    			append_dev(p1, t11);
    			append_dev(p1, b1);
    			append_dev(p1, t13);
    			append_dev(p1, b2);
    			append_dev(p1, t15);
    			append_dev(p1, a4);
    			insert_dev(target, t17, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t18);
    			append_dev(p2, a5);
    			append_dev(p2, t20);
    			append_dev(p2, a6);
    			append_dev(p2, t22);
    			append_dev(p2, a7);
    			append_dev(p2, t24);
    			append_dev(p2, b3);
    			append_dev(b3, span0);
    			append_dev(b3, t26);
    			append_dev(b3, span1);
    			append_dev(b3, t28);
    			append_dev(b3, span2);
    			append_dev(b3, t30);
    			append_dev(b3, span3);
    			append_dev(b3, t32);
    			append_dev(b3, span4);
    			append_dev(b3, t34);
    			append_dev(b3, span5);
    			append_dev(p2, t36);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p0);
    				detach_dev(t8);
    				detach_dev(p1);
    				detach_dev(t17);
    				detach_dev(p2);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$5.name, type: "component", source: "", ctx });
    	return block;
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$5, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Intro", options, id: create_fragment$5.name });
    	}
    }

    /* src/components/Links.svelte generated by Svelte v3.12.1 */

    const file$5 = "src/components/Links.svelte";

    // (27:2) {#if pub.pdf}
    function create_if_block_6(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "PDF";
    			attr_dev(i, "class", "fas fa-file-pdf svelte-1ryagh7");
    			add_location(i, file$5, 29, 8, 448);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 30, 8, 486);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 28, 6, 411);
    			attr_dev(a, "href", a_href_value = ctx.pub.pdf);
    			add_location(a, file$5, 27, 4, 386);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.pdf)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_6.name, type: "if", source: "(27:2) {#if pub.pdf}", ctx });
    	return block;
    }

    // (35:2) {#if pub.blog}
    function create_if_block_5(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Blog";
    			attr_dev(i, "class", "fab fa-medium svelte-1ryagh7");
    			add_location(i, file$5, 37, 8, 614);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 38, 8, 650);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 36, 6, 577);
    			attr_dev(a, "href", a_href_value = ctx.pub.blog);
    			add_location(a, file$5, 35, 4, 551);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.blog)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_5.name, type: "if", source: "(35:2) {#if pub.blog}", ctx });
    	return block;
    }

    // (43:2) {#if pub.workshop}
    function create_if_block_4(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Workshop";
    			attr_dev(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 45, 8, 787);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 46, 8, 822);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 44, 6, 750);
    			attr_dev(a, "href", a_href_value = ctx.pub.workshop);
    			add_location(a, file$5, 43, 4, 720);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.workshop)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_4.name, type: "if", source: "(43:2) {#if pub.workshop}", ctx });
    	return block;
    }

    // (51:2) {#if pub.video}
    function create_if_block_3(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Video";
    			attr_dev(i, "class", "fab fa-youtube svelte-1ryagh7");
    			add_location(i, file$5, 53, 8, 957);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 54, 8, 994);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 52, 6, 920);
    			attr_dev(a, "href", a_href_value = ctx.pub.video);
    			add_location(a, file$5, 51, 4, 893);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.video)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_3.name, type: "if", source: "(51:2) {#if pub.video}", ctx });
    	return block;
    }

    // (59:2) {#if pub.demo}
    function create_if_block_2(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Demo";
    			attr_dev(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 61, 8, 1124);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 62, 8, 1159);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 60, 6, 1087);
    			attr_dev(a, "href", a_href_value = ctx.pub.demo);
    			add_location(a, file$5, 59, 4, 1061);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.demo)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_2.name, type: "if", source: "(59:2) {#if pub.demo}", ctx });
    	return block;
    }

    // (67:2) {#if pub.code}
    function create_if_block_1(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Code";
    			attr_dev(i, "class", "fab fa-github svelte-1ryagh7");
    			add_location(i, file$5, 69, 8, 1288);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 70, 8, 1324);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 68, 6, 1251);
    			attr_dev(a, "href", a_href_value = ctx.pub.code);
    			add_location(a, file$5, 67, 4, 1225);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.code)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_1.name, type: "if", source: "(67:2) {#if pub.code}", ctx });
    	return block;
    }

    // (75:2) {#if pub.slides}
    function create_if_block(ctx) {
    	var a, button, i, t, p, a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t = space();
    			p = element("p");
    			p.textContent = "Slides";
    			attr_dev(i, "class", "fas fa-file-powerpoint svelte-1ryagh7");
    			add_location(i, file$5, 77, 8, 1457);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 78, 8, 1502);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 76, 6, 1420);
    			attr_dev(a, "href", a_href_value = ctx.pub.slides);
    			add_location(a, file$5, 75, 4, 1392);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.pub) && a_href_value !== (a_href_value = ctx.pub.slides)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(a);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(75:2) {#if pub.slides}", ctx });
    	return block;
    }

    function create_fragment$6(ctx) {
    	var div, t0, t1, t2, t3, t4, t5, t6, a, button, i, t7, p, a_href_value;

    	var if_block0 = (ctx.pub.pdf) && create_if_block_6(ctx);

    	var if_block1 = (ctx.pub.blog) && create_if_block_5(ctx);

    	var if_block2 = (ctx.pub.workshop) && create_if_block_4(ctx);

    	var if_block3 = (ctx.pub.video) && create_if_block_3(ctx);

    	var if_block4 = (ctx.pub.demo) && create_if_block_2(ctx);

    	var if_block5 = (ctx.pub.code) && create_if_block_1(ctx);

    	var if_block6 = (ctx.pub.slides) && create_if_block(ctx);

    	const block = {
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
    			if (if_block6) if_block6.c();
    			t6 = space();
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t7 = space();
    			p = element("p");
    			p.textContent = "Website";
    			attr_dev(i, "class", "fas fa-globe svelte-1ryagh7");
    			add_location(i, file$5, 84, 6, 1621);
    			attr_dev(p, "class", "svelte-1ryagh7");
    			add_location(p, file$5, 85, 6, 1654);
    			attr_dev(button, "class", "button-link svelte-1ryagh7");
    			add_location(button, file$5, 83, 4, 1586);
    			attr_dev(a, "href", a_href_value = '#/paper/' + ctx.pub.id);
    			add_location(a, file$5, 82, 2, 1551);
    			attr_dev(div, "class", "buttons");
    			add_location(div, file$5, 25, 0, 344);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			if (if_block2) if_block2.m(div, null);
    			append_dev(div, t2);
    			if (if_block3) if_block3.m(div, null);
    			append_dev(div, t3);
    			if (if_block4) if_block4.m(div, null);
    			append_dev(div, t4);
    			if (if_block5) if_block5.m(div, null);
    			append_dev(div, t5);
    			if (if_block6) if_block6.m(div, null);
    			append_dev(div, t6);
    			append_dev(div, a);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t7);
    			append_dev(button, p);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.pub.pdf) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    				} else {
    					if_block0 = create_if_block_6(ctx);
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
    					if_block1 = create_if_block_5(ctx);
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
    					if_block2 = create_if_block_4(ctx);
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
    					if_block3 = create_if_block_3(ctx);
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
    					if_block4 = create_if_block_2(ctx);
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
    					if_block5 = create_if_block_1(ctx);
    					if_block5.c();
    					if_block5.m(div, t5);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (ctx.pub.slides) {
    				if (if_block6) {
    					if_block6.p(changed, ctx);
    				} else {
    					if_block6 = create_if_block(ctx);
    					if_block6.c();
    					if_block6.m(div, t6);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if ((changed.pub) && a_href_value !== (a_href_value = '#/paper/' + ctx.pub.id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$6.name, type: "component", source: "", ctx });
    	return block;
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

    	$$self.$capture_state = () => {
    		return { pub };
    	};

    	$$self.$inject_state = $$props => {
    		if ('pub' in $$props) $$invalidate('pub', pub = $$props.pub);
    	};

    	return { pub };
    }

    class Links extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$6, safe_not_equal, ["pub"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Links", options, id: create_fragment$6.name });

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

    /* src/Home.svelte generated by Svelte v3.12.1 */

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

    // (47:8) {#each { length: 3 } as _, i}
    function create_each_block_1(ctx) {
    	var div, p0, t0_value = news[ctx.i].date + "", t0, t1, p1, raw_value = news[ctx.i].news + "", t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			attr_dev(p0, "class", "pure-u-1 pure-u-md-1-5 date");
    			add_location(p0, file$6, 48, 12, 1243);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 49, 12, 1313);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$6, 47, 10, 1200);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, p1);
    			p1.innerHTML = raw_value;
    			append_dev(div, t2);
    		},

    		p: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block_1.name, type: "each", source: "(47:8) {#each { length: 3 } as _, i}", ctx });
    	return block;
    }

    // (62:8) {#each pubs as pub}
    function create_each_block$1(ctx) {
    	var div4, div1, div0, a0, img, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, t4, h5, raw_value = ctx.pub.authors
                        .map(func)
                        .join(', ') + "", t5, p, t6_value = ctx.pub.desc + "", t6, t7, t8, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	const block = {
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
    			attr_dev(img, "src", 'images/' + ctx.pub.teaser);
    			attr_dev(img, "class", "thumb");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$6, 66, 18, 1888);
    			attr_dev(a0, "href", '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 65, 16, 1839);
    			attr_dev(h6, "class", "venue");
    			add_location(h6, file$6, 71, 16, 2049);
    			attr_dev(div0, "class", "thumb");
    			add_location(div0, file$6, 64, 14, 1803);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3");
    			add_location(div1, file$6, 63, 12, 1742);
    			add_location(h4, file$6, 77, 18, 2293);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 76, 16, 2224);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 79, 16, 2351);
    			attr_dev(p, "class", "desc");
    			add_location(p, file$6, 84, 16, 2560);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$6, 75, 14, 2187);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 74, 12, 2136);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 62, 10, 1705);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, img);
    			append_dev(div0, t0);
    			append_dev(div0, h6);
    			append_dev(h6, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, a1);
    			append_dev(a1, h4);
    			append_dev(h4, t3);
    			append_dev(div2, t4);
    			append_dev(div2, h5);
    			h5.innerHTML = raw_value;
    			append_dev(div2, t5);
    			append_dev(div2, p);
    			append_dev(p, t6);
    			append_dev(div3, t7);
    			mount_component(links, div3, null);
    			append_dev(div4, t8);
    			current = true;
    		},

    		p: noop,

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
    				detach_dev(div4);
    			}

    			destroy_component(links);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block$1.name, type: "each", source: "(62:8) {#each pubs as pub}", ctx });
    	return block;
    }

    function create_fragment$7(ctx) {
    	var div7, t0, div6, div5, div0, h20, t1, span, t3, t4, div2, div1, h21, t6, a0, t8, hr0, t9, t10, div4, div3, h22, t12, a1, t14, hr1, t15, t16, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var intro = new Intro({ $$inline: true });

    	let each_value_1 = { length: 3 };

    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = pubs;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	var footer = new Footer({ $$inline: true });

    	const block = {
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

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t16 = space();
    			footer.$$.fragment.c();
    			attr_dev(span, "class", "name");
    			add_location(span, file$6, 36, 10, 885);
    			attr_dev(h20, "id", "hello");
    			attr_dev(h20, "class", "svelte-14nm4zk");
    			add_location(h20, file$6, 34, 8, 829);
    			attr_dev(div0, "id", "intro");
    			add_location(div0, file$6, 33, 6, 804);
    			attr_dev(h21, "class", "header svelte-14nm4zk");
    			add_location(h21, file$6, 42, 10, 1035);
    			attr_dev(a0, "class", "right-all");
    			attr_dev(a0, "href", "#/news");
    			add_location(a0, file$6, 43, 10, 1074);
    			attr_dev(div1, "class", "inline svelte-14nm4zk");
    			add_location(div1, file$6, 41, 8, 1004);
    			add_location(hr0, file$6, 45, 8, 1145);
    			attr_dev(div2, "id", "news");
    			attr_dev(div2, "class", "sect");
    			add_location(div2, file$6, 40, 6, 967);
    			attr_dev(h22, "class", "header svelte-14nm4zk");
    			add_location(h22, file$6, 57, 10, 1525);
    			attr_dev(a1, "class", "right-all");
    			attr_dev(a1, "href", "#/pubs");
    			add_location(a1, file$6, 58, 10, 1581);
    			attr_dev(div3, "class", "inline svelte-14nm4zk");
    			add_location(div3, file$6, 56, 8, 1494);
    			add_location(hr1, file$6, 60, 8, 1660);
    			attr_dev(div4, "id", "pubs");
    			attr_dev(div4, "class", "sect");
    			add_location(div4, file$6, 55, 6, 1457);
    			attr_dev(div5, "id", "padded-content");
    			add_location(div5, file$6, 32, 4, 772);
    			attr_dev(div6, "id", "content");
    			attr_dev(div6, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div6, file$6, 31, 2, 718);
    			attr_dev(div7, "class", "pure-g");
    			attr_dev(div7, "id", "main-container");
    			add_location(div7, file$6, 29, 0, 661);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			mount_component(sidebar, div7, null);
    			append_dev(div7, t0);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div0, h20);
    			append_dev(h20, t1);
    			append_dev(h20, span);
    			append_dev(div0, t3);
    			mount_component(intro, div0, null);
    			append_dev(div5, t4);
    			append_dev(div5, div2);
    			append_dev(div2, div1);
    			append_dev(div1, h21);
    			append_dev(div1, t6);
    			append_dev(div1, a0);
    			append_dev(div2, t8);
    			append_dev(div2, hr0);
    			append_dev(div2, t9);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			append_dev(div5, t10);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, h22);
    			append_dev(div3, t12);
    			append_dev(div3, a1);
    			append_dev(div4, t14);
    			append_dev(div4, hr1);
    			append_dev(div4, t15);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			append_dev(div6, t16);
    			mount_component(footer, div6, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value_1 = { length: 3 };

    				let i;
    				for (i = 0; i < each_value_1.length; i += 1) {
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

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
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
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			transition_in(intro.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div7);
    			}

    			destroy_component(sidebar);

    			destroy_component(intro);

    			destroy_each(each_blocks_1, detaching);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$7.name, type: "component", source: "", ctx });
    	return block;
    }

    const func = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

    function instance$3($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$7, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Home", options, id: create_fragment$7.name });
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.12.1 */

    const file$7 = "src/Pubs.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (23:6) {#each pubs as pub}
    function create_each_block$2(ctx) {
    	var div4, div1, div0, a0, img, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, t4, h5, raw_value = ctx.pub.authors
                      .map(func$1)
                      .join(', ') + "", t5, p, t6_value = ctx.pub.desc + "", t6, t7, t8, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	const block = {
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
    			attr_dev(img, "src", 'images/' + ctx.pub.teaser);
    			attr_dev(img, "class", "thumb");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$7, 27, 16, 725);
    			attr_dev(a0, "href", '#/paper/' + ctx.pub.id);
    			add_location(a0, file$7, 26, 14, 678);
    			attr_dev(h6, "class", "venue");
    			add_location(h6, file$7, 29, 14, 822);
    			attr_dev(div0, "class", "thumb");
    			add_location(div0, file$7, 25, 12, 644);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$7, 24, 10, 585);
    			add_location(h4, file$7, 35, 16, 1054);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$7, 34, 14, 987);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$7, 37, 14, 1108);
    			attr_dev(p, "class", "desc");
    			add_location(p, file$7, 42, 14, 1307);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$7, 33, 12, 952);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$7, 32, 10, 903);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$7, 23, 8, 550);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div1);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(a0, img);
    			append_dev(div0, t0);
    			append_dev(div0, h6);
    			append_dev(h6, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, a1);
    			append_dev(a1, h4);
    			append_dev(h4, t3);
    			append_dev(div2, t4);
    			append_dev(div2, h5);
    			h5.innerHTML = raw_value;
    			append_dev(div2, t5);
    			append_dev(div2, p);
    			append_dev(p, t6);
    			append_dev(div3, t7);
    			mount_component(links, div3, null);
    			append_dev(div4, t8);
    			current = true;
    		},

    		p: noop,

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
    				detach_dev(div4);
    			}

    			destroy_component(links);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block$2.name, type: "each", source: "(23:6) {#each pubs as pub}", ctx });
    	return block;
    }

    function create_fragment$8(ctx) {
    	var div2, t0, div1, div0, h1, t2, hr, t3, t4, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	let each_value = pubs;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	var footer = new Footer({ $$inline: true });

    	const block = {
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

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			footer.$$.fragment.c();
    			attr_dev(h1, "class", "svelte-yks1gl");
    			add_location(h1, file$7, 20, 6, 481);
    			add_location(hr, file$7, 21, 6, 509);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$7, 19, 4, 449);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$7, 18, 2, 395);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$7, 16, 0, 338);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(sidebar, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t2);
    			append_dev(div0, hr);
    			append_dev(div0, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t4);
    			mount_component(footer, div1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.pubs) {
    				each_value = pubs;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
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
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div2);
    			}

    			destroy_component(sidebar);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$8.name, type: "component", source: "", ctx });
    	return block;
    }

    const func$1 = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

    function instance$4($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$8, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Pubs", options, id: create_fragment$8.name });
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.12.1 */

    const file$8 = "src/Paper.svelte";

    function create_fragment$9(ctx) {
    	var div5, a0, i0, t0, h40, span0, t2, span1, t4, span2, t6, span3, t8, hr, t9, h1, t10_value = ctx.pub.title + "", t10, t11, div0, h3, raw0_value = ctx.pub.authors
            .map(
              func$2
            )
            .join(', ') + "", t12, div3, div1, img, t13, div2, p0, t14_value = ctx.pub.desc + "", t14, t15, h20, t17, p1, t18_value = ctx.pub.abstract + "", t18, t19, h21, t21, a1, h41, t22_value = ctx.pub.title + "", t22, t23, h50, raw1_value = ctx.pub.authors
          .map(func_1)
          .join(', ') + "", t24, h51, i1, t25_value = ctx.pub.venuelong + "", t25, t26, t27_value = ctx.pub.location + "", t27, t28, t29_value = ctx.pub.year + "", t29, t30, t31, h22, t33, div4, code, t34_value = ctx.pub.bibtex + "", t34, t35, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	var footer = new Footer({ $$inline: true });

    	const block = {
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
    			attr_dev(i0, "class", "fas fa-home svelte-1vc1r0n");
    			attr_dev(i0, "id", "home");
    			add_location(i0, file$8, 109, 4, 1673);
    			attr_dev(span0, "class", "color svelte-1vc1r0n");
    			add_location(span0, file$8, 111, 6, 1739);
    			attr_dev(span1, "class", "color red svelte-1vc1r0n");
    			add_location(span1, file$8, 112, 6, 1784);
    			attr_dev(span2, "class", "color svelte-1vc1r0n");
    			add_location(span2, file$8, 113, 6, 1826);
    			attr_dev(span3, "class", "color red svelte-1vc1r0n");
    			add_location(span3, file$8, 114, 6, 1871);
    			attr_dev(h40, "id", "home-link");
    			attr_dev(h40, "class", "svelte-1vc1r0n");
    			add_location(h40, file$8, 110, 4, 1713);
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "home svelte-1vc1r0n");
    			add_location(a0, file$8, 108, 2, 1643);
    			add_location(hr, file$8, 117, 2, 1929);
    			attr_dev(h1, "class", "svelte-1vc1r0n");
    			add_location(h1, file$8, 118, 2, 1938);
    			attr_dev(h3, "class", "svelte-1vc1r0n");
    			add_location(h3, file$8, 120, 4, 1981);
    			attr_dev(div0, "id", "info");
    			attr_dev(div0, "class", "svelte-1vc1r0n");
    			add_location(div0, file$8, 119, 2, 1961);
    			attr_dev(img, "src", 'images/' + ctx.pub.teaser);
    			attr_dev(img, "class", "teaser svelte-1vc1r0n");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$8, 130, 6, 2228);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 129, 4, 2185);
    			attr_dev(p0, "class", "desc svelte-1vc1r0n");
    			add_location(p0, file$8, 133, 6, 2351);
    			attr_dev(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 132, 4, 2308);
    			attr_dev(div3, "class", "flex pure-g svelte-1vc1r0n");
    			add_location(div3, file$8, 128, 2, 2155);
    			attr_dev(h20, "class", "sec-title svelte-1vc1r0n");
    			add_location(h20, file$8, 137, 2, 2405);
    			attr_dev(p1, "class", "svelte-1vc1r0n");
    			add_location(p1, file$8, 138, 2, 2443);
    			attr_dev(h21, "class", "sec-title svelte-1vc1r0n");
    			add_location(h21, file$8, 140, 2, 2468);
    			attr_dev(h41, "class", "svelte-1vc1r0n");
    			add_location(h41, file$8, 142, 4, 2561);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$8, 141, 2, 2506);
    			attr_dev(h50, "class", "svelte-1vc1r0n");
    			add_location(h50, file$8, 145, 2, 2592);
    			add_location(i1, file$8, 152, 4, 2739);
    			attr_dev(h51, "class", "svelte-1vc1r0n");
    			add_location(h51, file$8, 151, 2, 2730);
    			attr_dev(h22, "class", "sec-title svelte-1vc1r0n");
    			add_location(h22, file$8, 156, 2, 2819);
    			attr_dev(code, "class", "bibtex");
    			add_location(code, file$8, 158, 4, 2878);
    			attr_dev(div4, "class", "code svelte-1vc1r0n");
    			add_location(div4, file$8, 157, 2, 2855);
    			attr_dev(div5, "id", "body");
    			attr_dev(div5, "class", "svelte-1vc1r0n");
    			add_location(div5, file$8, 107, 0, 1625);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, a0);
    			append_dev(a0, i0);
    			append_dev(a0, t0);
    			append_dev(a0, h40);
    			append_dev(h40, span0);
    			append_dev(h40, t2);
    			append_dev(h40, span1);
    			append_dev(h40, t4);
    			append_dev(h40, span2);
    			append_dev(h40, t6);
    			append_dev(h40, span3);
    			append_dev(div5, t8);
    			append_dev(div5, hr);
    			append_dev(div5, t9);
    			append_dev(div5, h1);
    			append_dev(h1, t10);
    			append_dev(div5, t11);
    			append_dev(div5, div0);
    			append_dev(div0, h3);
    			h3.innerHTML = raw0_value;
    			append_dev(div5, t12);
    			append_dev(div5, div3);
    			append_dev(div3, div1);
    			append_dev(div1, img);
    			append_dev(div3, t13);
    			append_dev(div3, div2);
    			append_dev(div2, p0);
    			append_dev(p0, t14);
    			append_dev(div5, t15);
    			append_dev(div5, h20);
    			append_dev(div5, t17);
    			append_dev(div5, p1);
    			append_dev(p1, t18);
    			append_dev(div5, t19);
    			append_dev(div5, h21);
    			append_dev(div5, t21);
    			append_dev(div5, a1);
    			append_dev(a1, h41);
    			append_dev(h41, t22);
    			append_dev(div5, t23);
    			append_dev(div5, h50);
    			h50.innerHTML = raw1_value;
    			append_dev(div5, t24);
    			append_dev(div5, h51);
    			append_dev(h51, i1);
    			append_dev(i1, t25);
    			append_dev(i1, t26);
    			append_dev(i1, t27);
    			append_dev(i1, t28);
    			append_dev(i1, t29);
    			append_dev(div5, t30);
    			mount_component(links, div5, null);
    			append_dev(div5, t31);
    			append_dev(div5, h22);
    			append_dev(div5, t33);
    			append_dev(div5, div4);
    			append_dev(div4, code);
    			append_dev(code, t34);
    			append_dev(div5, t35);
    			mount_component(footer, div5, null);
    			current = true;
    		},

    		p: noop,

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
    				detach_dev(div5);
    			}

    			destroy_component(links);

    			destroy_component(footer);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$9.name, type: "component", source: "", ctx });
    	return block;
    }

    const func$2 = (p) => "<a class='press' href='" + p.website + "'>" + p.name + '</a>';

    const func_1 = (p) => "<a class='press' href='" + p.website + "'>" + p.name + '</a>';

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

    	$$self.$capture_state = () => {
    		return { params, pub };
    	};

    	$$self.$inject_state = $$props => {
    		if ('params' in $$props) $$invalidate('params', params = $$props.params);
    		if ('pub' in $$props) $$invalidate('pub', pub = $$props.pub);
    	};

    	return { params, pub };
    }

    class Paper extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$9, safe_not_equal, ["params"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Paper", options, id: create_fragment$9.name });
    	}

    	get params() {
    		throw new Error("<Paper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Paper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Cv.svelte generated by Svelte v3.12.1 */

    const file$9 = "src/Cv.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (451:6) {#each pubs as pub}
    function create_each_block$3(ctx) {
    	var tr0, th0, t0_value = ctx.pub.month + "", t0, t1, t2_value = ctx.pub.year + "", t2, t3, th1, a, h5, t4_value = ctx.pub.title + "", t4, t5, h6, raw_value = ctx.pub.authors
                    .map(func$3)
                    .join(', ') + "", t6, p, i, t7_value = ctx.pub.venuelong + "", t7, t8, t9_value = ctx.pub.location + "", t9, t10, t11_value = ctx.pub.year + "", t11, t12, t13, t14, tr1, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	const block = {
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
    			attr_dev(th0, "class", "date svelte-ccym40");
    			add_location(th0, file$9, 452, 10, 11134);
    			attr_dev(h5, "class", "svelte-ccym40");
    			add_location(h5, file$9, 455, 14, 11271);
    			attr_dev(a, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 454, 12, 11206);
    			attr_dev(h6, "class", "authors svelte-ccym40");
    			add_location(h6, file$9, 458, 12, 11322);
    			add_location(i, file$9, 465, 14, 11543);
    			attr_dev(p, "class", "desc svelte-ccym40");
    			add_location(p, file$9, 464, 12, 11512);
    			attr_dev(th1, "class", "svelte-ccym40");
    			add_location(th1, file$9, 453, 10, 11189);
    			attr_dev(tr0, "class", "item svelte-ccym40");
    			add_location(tr0, file$9, 451, 8, 11106);
    			attr_dev(tr1, "class", "buffer svelte-ccym40");
    			add_location(tr1, file$9, 471, 8, 11679);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, tr0, anchor);
    			append_dev(tr0, th0);
    			append_dev(th0, t0);
    			append_dev(th0, t1);
    			append_dev(th0, t2);
    			append_dev(tr0, t3);
    			append_dev(tr0, th1);
    			append_dev(th1, a);
    			append_dev(a, h5);
    			append_dev(h5, t4);
    			append_dev(th1, t5);
    			append_dev(th1, h6);
    			h6.innerHTML = raw_value;
    			append_dev(th1, t6);
    			append_dev(th1, p);
    			append_dev(p, i);
    			append_dev(i, t7);
    			append_dev(i, t8);
    			append_dev(i, t9);
    			append_dev(i, t10);
    			append_dev(i, t11);
    			append_dev(i, t12);
    			append_dev(th1, t13);
    			mount_component(links, th1, null);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, tr1, anchor);
    			current = true;
    		},

    		p: noop,

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
    				detach_dev(tr0);
    			}

    			destroy_component(links);

    			if (detaching) {
    				detach_dev(t14);
    				detach_dev(tr1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block$3.name, type: "each", source: "(451:6) {#each pubs as pub}", ctx });
    	return block;
    }

    function create_fragment$a(ctx) {
    	var div16, main, table, tr0, th0, t0, th1, h3, span0, t2, span1, t4, span2, t6, span3, t8, t9, t10, tr1, th2, t11, th3, h40, t13, tr2, th4, t14, br0, t15, t16, th5, h50, t18, h60, t20, tr3, t21, tr4, th6, t22, br1, t23, t24, th7, h51, t26, h61, t28, p0, t30, tr5, th8, t32, th9, h62, t34, p1, t36, tr6, th10, t37, th11, h41, t39, tr7, th12, t41, th13, h52, t43, p2, t45, div0, a0, button0, i0, t46, t47, tr8, t48, tr9, th14, t50, th15, h53, t52, p3, t54, div1, a1, button1, i1, t55, t56, tr10, t57, tr11, th16, t58, br2, t59, t60, th17, h54, t62, h63, t64, p4, t66, div2, a2, button2, i2, t67, t68, tr12, t69, tr13, th18, t71, th19, h55, t73, h64, t75, p5, t77, div3, a3, button3, i3, t78, t79, tr14, th20, t80, th21, h42, t82, tr15, th22, t83, br3, t84, t85, th23, h56, t87, h65, t89, p6, t91, div4, a4, button4, i4, t92, t93, button5, t95, button6, t97, button7, t99, button8, t101, tr16, t102, tr17, th24, t103, br4, t104, t105, th25, h57, t107, h66, t109, p7, t111, div5, button9, t113, button10, t115, button11, t117, button12, t119, tr18, t120, tr19, th26, t121, br5, t122, t123, th27, h58, t125, h67, t127, p8, t129, div6, button13, t131, button14, t133, button15, t135, tr20, th28, t136, th29, h43, t138, tr21, th30, t139, br6, t140, t141, th31, h59, t143, h68, t145, div7, a5, button16, i5, t146, t147, tr22, t148, tr23, th32, t149, br7, t150, t151, th33, h510, t153, h69, t155, div8, a6, button17, i6, t156, t157, tr24, t158, tr25, th34, t159, br8, t160, t161, th35, h511, t163, h610, t165, p9, t167, div9, a7, button18, i7, t168, t169, a8, button19, i8, t170, t171, a9, button20, i9, t172, t173, tr26, th36, t174, th37, h44, t176, t177, tr27, th38, t178, th39, h45, t180, tr28, th40, t182, th41, h512, t184, h611, t186, p10, t188, tr29, t189, tr30, th42, t191, th43, h513, t193, h612, t195, p11, t197, tr31, th44, t198, th45, h46, t200, tr32, th46, t201, th47, h514, t203, tr33, th48, t205, th49, h515, t207, tr34, th50, t209, th51, h516, t211, br9, t212, tr35, th52, t213, th53, h517, t215, tr36, th54, t217, th55, h518, t219, tr37, th56, t221, th57, h519, t223, tr38, th58, t224, th59, h47, t226, tr39, th60, t228, th61, h520, a10, t230, i10, t232, tr40, th62, t234, th63, h521, a11, t236, i11, t238, tr41, th64, t240, th65, h522, a12, t242, i12, t244, tr42, th66, t246, th67, h523, a13, t248, i13, t250, tr43, th68, t251, th69, h48, t253, tr44, th70, t255, th71, h524, t257, h613, t259, p12, t261, div10, a14, button21, i14, t262, t263, tr45, t264, tr46, th72, t266, th73, h525, t268, p13, t270, div11, a15, button22, i15, t271, t272, a16, button23, i16, t273, t274, tr47, t275, tr48, th74, t277, th75, h526, t279, p14, t281, div12, a17, button24, i17, t282, t283, a18, button25, i18, t284, t285, tr49, th76, t286, th77, h49, t288, tr50, th78, t290, th79, a19, h527, t292, tr51, th80, t294, th81, a20, h528, t296, tr52, th82, t298, th83, h529, t300, tr53, th84, t302, th85, a21, h530, t304, tr54, th86, t306, th87, a22, h531, t308, tr55, th88, t310, th89, h532, t312, tr56, th90, t313, th91, h410, t315, tr57, th92, t316, th93, h533, t318, div13, button26, t320, button27, t322, button28, t324, tr58, t325, tr59, th94, t326, th95, h534, t328, div14, button29, t330, button30, t332, button31, t334, button32, t336, button33, t338, button34, t340, tr60, t341, tr61, th96, t342, th97, h535, t344, div15, button35, t346, button36, t348, button37, t350, button38, t352, button39, t354, button40, t356, button41, t358, button42, t360, button43, t362, tr62, t363, tr63, th98, t364, th99, p15, current;

    	var intro = new Intro({ $$inline: true });

    	var social = new Social({ $$inline: true });

    	let each_value = pubs;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div16 = element("div");
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
    			h41.textContent = "Awards and Fellowships";
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
    			p3.textContent = "Co-awarded the $10,000 scholarship for the undergraduate with the\n            most outstanding scholastic record.";
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
    			p5.textContent = "Placed third and won $2,500 for creating a ML system to predict\n            dangerous road areas.";
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
    			p7.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
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
    			t139 = text("August 2019\n          ");
    			br6 = element("br");
    			t140 = text("\n          - Present");
    			t141 = space();
    			th31 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Carnegie Mellon Human Computer Interaction Institute (HCII)";
    			t143 = space();
    			h68 = element("h6");
    			h68.textContent = "Graduate Research Assistant";
    			t145 = space();
    			div7 = element("div");
    			a5 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t146 = text("\n                CMU Data Interaction Group");
    			t147 = space();
    			tr22 = element("tr");
    			t148 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t149 = text("January 2018\n          ");
    			br7 = element("br");
    			t150 = text("\n          - May 2019");
    			t151 = space();
    			th33 = element("th");
    			h510 = element("h5");
    			h510.textContent = "Polo Club of Data Science";
    			t153 = space();
    			h69 = element("h6");
    			h69.textContent = "Undergraduate Researcher";
    			t155 = space();
    			div8 = element("div");
    			a6 = element("a");
    			button17 = element("button");
    			i6 = element("i");
    			t156 = text("\n                Polo Club");
    			t157 = space();
    			tr24 = element("tr");
    			t158 = space();
    			tr25 = element("tr");
    			th34 = element("th");
    			t159 = text("September 2015\n          ");
    			br8 = element("br");
    			t160 = text("\n          - May 2017");
    			t161 = space();
    			th35 = element("th");
    			h511 = element("h5");
    			h511.textContent = "PROX-1 Satellite";
    			t163 = space();
    			h610 = element("h6");
    			h610.textContent = "Flight Software Lead and Researcher";
    			t165 = space();
    			p9 = element("p");
    			p9.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t167 = space();
    			div9 = element("div");
    			a7 = element("a");
    			button18 = element("button");
    			i7 = element("i");
    			t168 = text("\n                In space!");
    			t169 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i8 = element("i");
    			t170 = text("\n                Website");
    			t171 = space();
    			a9 = element("a");
    			button20 = element("button");
    			i9 = element("i");
    			t172 = text("\n                Press release");
    			t173 = space();
    			tr26 = element("tr");
    			th36 = element("th");
    			t174 = space();
    			th37 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Publications";
    			t176 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t177 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			t178 = space();
    			th39 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Teaching";
    			t180 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Fall 2016, Spring 2017, Spring 2018";
    			t182 = space();
    			th41 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Undergraduate Teaching Assistant";
    			t184 = space();
    			h611 = element("h6");
    			h611.textContent = "CS1332 - Data Structures and Algorithms";
    			t186 = space();
    			p10 = element("p");
    			p10.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t188 = space();
    			tr29 = element("tr");
    			t189 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			th42.textContent = "Fall 2016";
    			t191 = space();
    			th43 = element("th");
    			h513 = element("h5");
    			h513.textContent = "Team Leader";
    			t193 = space();
    			h612 = element("h6");
    			h612.textContent = "GT 1000 - First-Year Seminar";
    			t195 = space();
    			p11 = element("p");
    			p11.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t197 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			t198 = space();
    			th45 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Service";
    			t200 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			t201 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Student Volunteer";
    			t203 = space();
    			tr33 = element("tr");
    			th48 = element("th");
    			th48.textContent = "October 2019";
    			t205 = space();
    			th49 = element("th");
    			h515 = element("h5");
    			h515.textContent = "IEEE Visualization Conference (VIS)";
    			t207 = space();
    			tr34 = element("tr");
    			th50 = element("th");
    			th50.textContent = "January 2019";
    			t209 = space();
    			th51 = element("th");
    			h516 = element("h5");
    			h516.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t211 = space();
    			br9 = element("br");
    			t212 = space();
    			tr35 = element("tr");
    			th52 = element("th");
    			t213 = space();
    			th53 = element("th");
    			h517 = element("h5");
    			h517.textContent = "Reviewer";
    			t215 = space();
    			tr36 = element("tr");
    			th54 = element("th");
    			th54.textContent = "2019";
    			t217 = space();
    			th55 = element("th");
    			h518 = element("h5");
    			h518.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t219 = space();
    			tr37 = element("tr");
    			th56 = element("th");
    			th56.textContent = "2019";
    			t221 = space();
    			th57 = element("th");
    			h519 = element("h5");
    			h519.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t223 = space();
    			tr38 = element("tr");
    			th58 = element("th");
    			t224 = space();
    			th59 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Press";
    			t226 = space();
    			tr39 = element("tr");
    			th60 = element("th");
    			th60.textContent = "2019";
    			t228 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			a10 = element("a");
    			a10.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t230 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "Data Stories Podcast";
    			t232 = space();
    			tr40 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2019";
    			t234 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			a11 = element("a");
    			a11.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t236 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "GT SCS";
    			t238 = space();
    			tr41 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2019";
    			t240 = space();
    			th65 = element("th");
    			h522 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t242 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Georgia Tech";
    			t244 = space();
    			tr42 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2018";
    			t246 = space();
    			th67 = element("th");
    			h523 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t248 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "GT SCS";
    			t250 = space();
    			tr43 = element("tr");
    			th68 = element("th");
    			t251 = space();
    			th69 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Projects";
    			t253 = space();
    			tr44 = element("tr");
    			th70 = element("th");
    			th70.textContent = "Fall 2018";
    			t255 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			h524.textContent = "ICLR'19 Reproducibility Challenge";
    			t257 = space();
    			h613 = element("h6");
    			h613.textContent = "Generative Adversarial Models for Learning Private and Fair\n            Representations";
    			t259 = space();
    			p12 = element("p");
    			p12.textContent = "Implemented and reproduced an ICLR'19 submission using GANs to\n            decorrelate sensitive data.";
    			t261 = space();
    			div10 = element("div");
    			a14 = element("a");
    			button21 = element("button");
    			i14 = element("i");
    			t262 = text("\n                GitHub");
    			t263 = space();
    			tr45 = element("tr");
    			t264 = space();
    			tr46 = element("tr");
    			th72 = element("th");
    			th72.textContent = "Spring 2018";
    			t266 = space();
    			th73 = element("th");
    			h525 = element("h5");
    			h525.textContent = "Georgia Tech Bus System Analysis";
    			t268 = space();
    			p13 = element("p");
    			p13.textContent = "System that combines Google Maps and graph algorithms to enable\n            navigation for GT buses.";
    			t270 = space();
    			div11 = element("div");
    			a15 = element("a");
    			button22 = element("button");
    			i15 = element("i");
    			t271 = text("\n                Poster");
    			t272 = space();
    			a16 = element("a");
    			button23 = element("button");
    			i16 = element("i");
    			t273 = text("\n                Class");
    			t274 = space();
    			tr47 = element("tr");
    			t275 = space();
    			tr48 = element("tr");
    			th74 = element("th");
    			th74.textContent = "Spring 2014";
    			t277 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			h526.textContent = "CTF Resources";
    			t279 = space();
    			p14 = element("p");
    			p14.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1,000 stars on GitHub.";
    			t281 = space();
    			div12 = element("div");
    			a17 = element("a");
    			button24 = element("button");
    			i17 = element("i");
    			t282 = text("\n                Website");
    			t283 = space();
    			a18 = element("a");
    			button25 = element("button");
    			i18 = element("i");
    			t284 = text("\n                GitHub");
    			t285 = space();
    			tr49 = element("tr");
    			th76 = element("th");
    			t286 = space();
    			th77 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Selected Classes";
    			t288 = space();
    			tr50 = element("tr");
    			th78 = element("th");
    			th78.textContent = "Fall 2018";
    			t290 = space();
    			th79 = element("th");
    			a19 = element("a");
    			h527 = element("h5");
    			h527.textContent = "CS 4803/7643 - Deep Learning";
    			t292 = space();
    			tr51 = element("tr");
    			th80 = element("th");
    			th80.textContent = "Spring 2018";
    			t294 = space();
    			th81 = element("th");
    			a20 = element("a");
    			h528 = element("h5");
    			h528.textContent = "CX 4242/CSE 6242 - Data and Visual Analytics";
    			t296 = space();
    			tr52 = element("tr");
    			th82 = element("th");
    			th82.textContent = "Fall 2017";
    			t298 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "BECO 1750A - Money and Banking";
    			t300 = space();
    			tr53 = element("tr");
    			th84 = element("th");
    			th84.textContent = "Spring 2017";
    			t302 = space();
    			th85 = element("th");
    			a21 = element("a");
    			h530 = element("h5");
    			h530.textContent = "CS 4641/7641 - Machine Learning";
    			t304 = space();
    			tr54 = element("tr");
    			th86 = element("th");
    			th86.textContent = "Spring 2017";
    			t306 = space();
    			th87 = element("th");
    			a22 = element("a");
    			h531 = element("h5");
    			h531.textContent = "CX 4230 - Computer Simulation";
    			t308 = space();
    			tr55 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Spring 2017";
    			t310 = space();
    			th89 = element("th");
    			h532 = element("h5");
    			h532.textContent = "CS 3511 - Honors Algorithms";
    			t312 = space();
    			tr56 = element("tr");
    			th90 = element("th");
    			t313 = space();
    			th91 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Skills";
    			t315 = space();
    			tr57 = element("tr");
    			th92 = element("th");
    			t316 = space();
    			th93 = element("th");
    			h533 = element("h5");
    			h533.textContent = "Languages";
    			t318 = space();
    			div13 = element("div");
    			button26 = element("button");
    			button26.textContent = "English - Native";
    			t320 = space();
    			button27 = element("button");
    			button27.textContent = "Spanish - Native";
    			t322 = space();
    			button28 = element("button");
    			button28.textContent = "French - Conversational (B1)";
    			t324 = space();
    			tr58 = element("tr");
    			t325 = space();
    			tr59 = element("tr");
    			th94 = element("th");
    			t326 = space();
    			th95 = element("th");
    			h534 = element("h5");
    			h534.textContent = "Programming Languages";
    			t328 = space();
    			div14 = element("div");
    			button29 = element("button");
    			button29.textContent = "Java";
    			t330 = space();
    			button30 = element("button");
    			button30.textContent = "Javascript";
    			t332 = space();
    			button31 = element("button");
    			button31.textContent = "Python";
    			t334 = space();
    			button32 = element("button");
    			button32.textContent = "C/C++";
    			t336 = space();
    			button33 = element("button");
    			button33.textContent = "SQL";
    			t338 = space();
    			button34 = element("button");
    			button34.textContent = "Go";
    			t340 = space();
    			tr60 = element("tr");
    			t341 = space();
    			tr61 = element("tr");
    			th96 = element("th");
    			t342 = space();
    			th97 = element("th");
    			h535 = element("h5");
    			h535.textContent = "Technologies";
    			t344 = space();
    			div15 = element("div");
    			button35 = element("button");
    			button35.textContent = "Machine Learning";
    			t346 = space();
    			button36 = element("button");
    			button36.textContent = "Full Stack Development";
    			t348 = space();
    			button37 = element("button");
    			button37.textContent = "React";
    			t350 = space();
    			button38 = element("button");
    			button38.textContent = "Svelte";
    			t352 = space();
    			button39 = element("button");
    			button39.textContent = "Vega";
    			t354 = space();
    			button40 = element("button");
    			button40.textContent = "D3";
    			t356 = space();
    			button41 = element("button");
    			button41.textContent = "PyTorch";
    			t358 = space();
    			button42 = element("button");
    			button42.textContent = "Cloud Dataflow/MapReduce";
    			t360 = space();
    			button43 = element("button");
    			button43.textContent = "Amazon Mechanical Turk";
    			t362 = space();
    			tr62 = element("tr");
    			t363 = space();
    			tr63 = element("tr");
    			th98 = element("th");
    			t364 = space();
    			th99 = element("th");
    			p15 = element("p");
    			p15.textContent = "Last updated March 6, 2020.";
    			attr_dev(th0, "class", "date svelte-ccym40");
    			add_location(th0, file$9, 130, 8, 1853);
    			attr_dev(span0, "class", "color svelte-ccym40");
    			add_location(span0, file$9, 133, 12, 1937);
    			attr_dev(span1, "class", "color red svelte-ccym40");
    			add_location(span1, file$9, 134, 12, 1988);
    			attr_dev(span2, "class", "color svelte-ccym40");
    			add_location(span2, file$9, 135, 12, 2036);
    			attr_dev(span3, "class", "color red svelte-ccym40");
    			add_location(span3, file$9, 136, 12, 2087);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-ccym40");
    			add_location(h3, file$9, 132, 10, 1910);
    			attr_dev(th1, "class", "intro svelte-ccym40");
    			add_location(th1, file$9, 131, 8, 1881);
    			add_location(tr0, file$9, 129, 6, 1840);
    			attr_dev(th2, "class", "date svelte-ccym40");
    			add_location(th2, file$9, 146, 8, 2255);
    			attr_dev(h40, "class", "header svelte-ccym40");
    			add_location(h40, file$9, 148, 10, 2298);
    			attr_dev(th3, "class", "svelte-ccym40");
    			add_location(th3, file$9, 147, 8, 2283);
    			add_location(tr1, file$9, 145, 6, 2242);
    			add_location(br0, file$9, 154, 10, 2440);
    			attr_dev(th4, "class", "date svelte-ccym40");
    			add_location(th4, file$9, 152, 8, 2390);
    			attr_dev(h50, "class", "svelte-ccym40");
    			add_location(h50, file$9, 158, 10, 2504);
    			attr_dev(h60, "class", "svelte-ccym40");
    			add_location(h60, file$9, 159, 10, 2563);
    			attr_dev(th5, "class", "svelte-ccym40");
    			add_location(th5, file$9, 157, 8, 2489);
    			attr_dev(tr2, "class", "item svelte-ccym40");
    			add_location(tr2, file$9, 151, 6, 2364);
    			attr_dev(tr3, "class", "buffer svelte-ccym40");
    			add_location(tr3, file$9, 162, 6, 2648);
    			add_location(br1, file$9, 166, 10, 2752);
    			attr_dev(th6, "class", "date svelte-ccym40");
    			add_location(th6, file$9, 164, 8, 2702);
    			attr_dev(h51, "class", "svelte-ccym40");
    			add_location(h51, file$9, 170, 10, 2817);
    			attr_dev(h61, "class", "svelte-ccym40");
    			add_location(h61, file$9, 171, 10, 2861);
    			attr_dev(p0, "class", "desc svelte-ccym40");
    			add_location(p0, file$9, 172, 10, 2926);
    			attr_dev(th7, "class", "svelte-ccym40");
    			add_location(th7, file$9, 169, 8, 2802);
    			attr_dev(tr4, "class", "item svelte-ccym40");
    			add_location(tr4, file$9, 163, 6, 2676);
    			attr_dev(th8, "class", "date svelte-ccym40");
    			add_location(th8, file$9, 179, 8, 3115);
    			attr_dev(h62, "class", "svelte-ccym40");
    			add_location(h62, file$9, 181, 10, 3170);
    			attr_dev(p1, "class", "desc svelte-ccym40");
    			add_location(p1, file$9, 182, 10, 3217);
    			attr_dev(th9, "class", "svelte-ccym40");
    			add_location(th9, file$9, 180, 8, 3155);
    			attr_dev(tr5, "class", "item svelte-ccym40");
    			add_location(tr5, file$9, 178, 6, 3089);
    			attr_dev(th10, "class", "date svelte-ccym40");
    			add_location(th10, file$9, 189, 8, 3394);
    			attr_dev(h41, "class", "header svelte-ccym40");
    			add_location(h41, file$9, 191, 10, 3437);
    			attr_dev(th11, "class", "svelte-ccym40");
    			add_location(th11, file$9, 190, 8, 3422);
    			add_location(tr6, file$9, 188, 6, 3381);
    			attr_dev(th12, "class", "date svelte-ccym40");
    			add_location(th12, file$9, 195, 8, 3542);
    			attr_dev(h52, "class", "svelte-ccym40");
    			add_location(h52, file$9, 197, 10, 3596);
    			attr_dev(p2, "class", "desc svelte-ccym40");
    			add_location(p2, file$9, 200, 10, 3707);
    			attr_dev(i0, "class", "fas fa-globe svelte-ccym40");
    			add_location(i0, file$9, 207, 16, 3984);
    			add_location(button0, file$9, 206, 14, 3959);
    			attr_dev(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 205, 12, 3909);
    			attr_dev(div0, "class", "tags");
    			add_location(div0, file$9, 204, 10, 3878);
    			attr_dev(th13, "class", "svelte-ccym40");
    			add_location(th13, file$9, 196, 8, 3581);
    			attr_dev(tr7, "class", "item svelte-ccym40");
    			add_location(tr7, file$9, 194, 6, 3516);
    			attr_dev(tr8, "class", "buffer svelte-ccym40");
    			add_location(tr8, file$9, 214, 6, 4125);
    			attr_dev(th14, "class", "date svelte-ccym40");
    			add_location(th14, file$9, 216, 8, 4179);
    			attr_dev(h53, "class", "svelte-ccym40");
    			add_location(h53, file$9, 218, 10, 4233);
    			attr_dev(p3, "class", "desc svelte-ccym40");
    			add_location(p3, file$9, 219, 10, 4287);
    			attr_dev(i1, "class", "fas fa-globe svelte-ccym40");
    			add_location(i1, file$9, 227, 16, 4668);
    			add_location(button1, file$9, 226, 14, 4643);
    			attr_dev(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 224, 12, 4486);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file$9, 223, 10, 4455);
    			attr_dev(th15, "class", "svelte-ccym40");
    			add_location(th15, file$9, 217, 8, 4218);
    			attr_dev(tr9, "class", "item svelte-ccym40");
    			add_location(tr9, file$9, 215, 6, 4153);
    			attr_dev(tr10, "class", "buffer svelte-ccym40");
    			add_location(tr10, file$9, 234, 6, 4814);
    			add_location(br2, file$9, 238, 10, 4918);
    			attr_dev(th16, "class", "date svelte-ccym40");
    			add_location(th16, file$9, 236, 8, 4868);
    			attr_dev(h54, "class", "svelte-ccym40");
    			add_location(h54, file$9, 242, 10, 4983);
    			attr_dev(h63, "class", "svelte-ccym40");
    			add_location(h63, file$9, 243, 10, 5029);
    			attr_dev(p4, "class", "desc svelte-ccym40");
    			add_location(p4, file$9, 244, 10, 5105);
    			attr_dev(i2, "class", "fas fa-globe svelte-ccym40");
    			add_location(i2, file$9, 251, 16, 5387);
    			add_location(button2, file$9, 250, 14, 5362);
    			attr_dev(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 249, 12, 5308);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file$9, 248, 10, 5277);
    			attr_dev(th17, "class", "svelte-ccym40");
    			add_location(th17, file$9, 241, 8, 4968);
    			attr_dev(tr11, "class", "item svelte-ccym40");
    			add_location(tr11, file$9, 235, 6, 4842);
    			attr_dev(tr12, "class", "buffer svelte-ccym40");
    			add_location(tr12, file$9, 258, 6, 5528);
    			attr_dev(th18, "class", "date svelte-ccym40");
    			add_location(th18, file$9, 260, 8, 5582);
    			attr_dev(h55, "class", "svelte-ccym40");
    			add_location(h55, file$9, 262, 10, 5644);
    			attr_dev(h64, "class", "svelte-ccym40");
    			add_location(h64, file$9, 263, 10, 5686);
    			attr_dev(p5, "class", "desc svelte-ccym40");
    			add_location(p5, file$9, 264, 10, 5744);
    			attr_dev(i3, "class", "far fa-newspaper svelte-ccym40");
    			add_location(i3, file$9, 272, 16, 6095);
    			add_location(button3, file$9, 271, 14, 6070);
    			attr_dev(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 269, 12, 5927);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file$9, 268, 10, 5896);
    			attr_dev(th19, "class", "svelte-ccym40");
    			add_location(th19, file$9, 261, 8, 5629);
    			attr_dev(tr13, "class", "item svelte-ccym40");
    			add_location(tr13, file$9, 259, 6, 5556);
    			attr_dev(th20, "class", "date svelte-ccym40");
    			add_location(th20, file$9, 281, 8, 6283);
    			attr_dev(h42, "class", "header svelte-ccym40");
    			add_location(h42, file$9, 283, 10, 6326);
    			attr_dev(th21, "class", "svelte-ccym40");
    			add_location(th21, file$9, 282, 8, 6311);
    			add_location(tr14, file$9, 280, 6, 6270);
    			add_location(br3, file$9, 289, 10, 6475);
    			attr_dev(th22, "class", "date svelte-ccym40");
    			add_location(th22, file$9, 287, 8, 6428);
    			attr_dev(h56, "class", "svelte-ccym40");
    			add_location(h56, file$9, 293, 10, 6543);
    			attr_dev(h65, "class", "svelte-ccym40");
    			add_location(h65, file$9, 294, 10, 6569);
    			attr_dev(p6, "class", "desc svelte-ccym40");
    			add_location(p6, file$9, 295, 10, 6616);
    			attr_dev(i4, "class", "far fa-newspaper svelte-ccym40");
    			add_location(i4, file$9, 305, 16, 7042);
    			add_location(button4, file$9, 304, 14, 7017);
    			attr_dev(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$9, 301, 12, 6879);
    			add_location(button5, file$9, 309, 12, 7154);
    			add_location(button6, file$9, 310, 12, 7196);
    			add_location(button7, file$9, 311, 12, 7230);
    			add_location(button8, file$9, 312, 12, 7263);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file$9, 300, 10, 6848);
    			attr_dev(th23, "class", "svelte-ccym40");
    			add_location(th23, file$9, 292, 8, 6528);
    			attr_dev(tr15, "class", "item svelte-ccym40");
    			add_location(tr15, file$9, 286, 6, 6402);
    			attr_dev(tr16, "class", "buffer svelte-ccym40");
    			add_location(tr16, file$9, 316, 6, 7346);
    			add_location(br4, file$9, 320, 10, 7447);
    			attr_dev(th24, "class", "date svelte-ccym40");
    			add_location(th24, file$9, 318, 8, 7400);
    			attr_dev(h57, "class", "svelte-ccym40");
    			add_location(h57, file$9, 324, 10, 7515);
    			attr_dev(h66, "class", "svelte-ccym40");
    			add_location(h66, file$9, 325, 10, 7541);
    			attr_dev(p7, "class", "desc svelte-ccym40");
    			add_location(p7, file$9, 326, 10, 7588);
    			add_location(button9, file$9, 331, 12, 7780);
    			add_location(button10, file$9, 332, 12, 7836);
    			add_location(button11, file$9, 333, 12, 7870);
    			add_location(button12, file$9, 334, 12, 7903);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file$9, 330, 10, 7749);
    			attr_dev(th25, "class", "svelte-ccym40");
    			add_location(th25, file$9, 323, 8, 7500);
    			attr_dev(tr17, "class", "item svelte-ccym40");
    			add_location(tr17, file$9, 317, 6, 7374);
    			attr_dev(tr18, "class", "buffer svelte-ccym40");
    			add_location(tr18, file$9, 338, 6, 7973);
    			add_location(br5, file$9, 342, 10, 8074);
    			attr_dev(th26, "class", "date svelte-ccym40");
    			add_location(th26, file$9, 340, 8, 8027);
    			attr_dev(h58, "class", "svelte-ccym40");
    			add_location(h58, file$9, 346, 10, 8142);
    			attr_dev(h67, "class", "svelte-ccym40");
    			add_location(h67, file$9, 347, 10, 8168);
    			attr_dev(p8, "class", "desc svelte-ccym40");
    			add_location(p8, file$9, 348, 10, 8216);
    			add_location(button13, file$9, 353, 12, 8401);
    			add_location(button14, file$9, 354, 12, 8433);
    			add_location(button15, file$9, 355, 12, 8471);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file$9, 352, 10, 8370);
    			attr_dev(th27, "class", "svelte-ccym40");
    			add_location(th27, file$9, 345, 8, 8127);
    			attr_dev(tr19, "class", "item svelte-ccym40");
    			add_location(tr19, file$9, 339, 6, 8001);
    			attr_dev(th28, "class", "date svelte-ccym40");
    			add_location(th28, file$9, 361, 8, 8585);
    			attr_dev(h43, "class", "header svelte-ccym40");
    			add_location(h43, file$9, 363, 10, 8628);
    			attr_dev(th29, "class", "svelte-ccym40");
    			add_location(th29, file$9, 362, 8, 8613);
    			add_location(tr20, file$9, 360, 6, 8572);
    			add_location(br6, file$9, 369, 10, 8780);
    			attr_dev(th30, "class", "date svelte-ccym40");
    			add_location(th30, file$9, 367, 8, 8730);
    			attr_dev(h59, "class", "svelte-ccym40");
    			add_location(h59, file$9, 373, 10, 8844);
    			attr_dev(h68, "class", "svelte-ccym40");
    			add_location(h68, file$9, 374, 10, 8923);
    			attr_dev(i5, "class", "fas fa-globe svelte-ccym40");
    			add_location(i5, file$9, 378, 16, 9072);
    			add_location(button16, file$9, 377, 14, 9047);
    			attr_dev(a5, "href", "https://dig.cmu.edu/");
    			add_location(a5, file$9, 376, 12, 9001);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file$9, 375, 10, 8970);
    			attr_dev(th31, "class", "svelte-ccym40");
    			add_location(th31, file$9, 372, 8, 8829);
    			attr_dev(tr21, "class", "item svelte-ccym40");
    			add_location(tr21, file$9, 366, 6, 8704);
    			attr_dev(tr22, "class", "buffer svelte-ccym40");
    			add_location(tr22, file$9, 385, 6, 9232);
    			add_location(br7, file$9, 389, 10, 9337);
    			attr_dev(th32, "class", "date svelte-ccym40");
    			add_location(th32, file$9, 387, 8, 9286);
    			attr_dev(h510, "class", "svelte-ccym40");
    			add_location(h510, file$9, 393, 10, 9402);
    			attr_dev(h69, "class", "svelte-ccym40");
    			add_location(h69, file$9, 394, 10, 9447);
    			attr_dev(i6, "class", "fas fa-globe svelte-ccym40");
    			add_location(i6, file$9, 398, 16, 9600);
    			add_location(button17, file$9, 397, 14, 9575);
    			attr_dev(a6, "href", "https://poloclub.github.io/");
    			add_location(a6, file$9, 396, 12, 9522);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file$9, 395, 10, 9491);
    			attr_dev(th33, "class", "svelte-ccym40");
    			add_location(th33, file$9, 392, 8, 9387);
    			attr_dev(tr23, "class", "item svelte-ccym40");
    			add_location(tr23, file$9, 386, 6, 9260);
    			attr_dev(tr24, "class", "buffer svelte-ccym40");
    			add_location(tr24, file$9, 405, 6, 9743);
    			add_location(br8, file$9, 409, 10, 9850);
    			attr_dev(th34, "class", "date svelte-ccym40");
    			add_location(th34, file$9, 407, 8, 9797);
    			attr_dev(h511, "class", "svelte-ccym40");
    			add_location(h511, file$9, 413, 10, 9915);
    			attr_dev(h610, "class", "svelte-ccym40");
    			add_location(h610, file$9, 414, 10, 9951);
    			attr_dev(p9, "class", "desc svelte-ccym40");
    			add_location(p9, file$9, 415, 10, 10006);
    			attr_dev(i7, "class", "fas fa-rocket svelte-ccym40");
    			add_location(i7, file$9, 423, 16, 10357);
    			add_location(button18, file$9, 422, 14, 10332);
    			attr_dev(a7, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a7, file$9, 420, 12, 10203);
    			attr_dev(i8, "class", "fas fa-globe svelte-ccym40");
    			add_location(i8, file$9, 429, 16, 10540);
    			add_location(button19, file$9, 428, 14, 10515);
    			attr_dev(a8, "href", "http://prox-1.gatech.edu/");
    			add_location(a8, file$9, 427, 12, 10464);
    			attr_dev(i9, "class", "far fa-newspaper svelte-ccym40");
    			add_location(i9, file$9, 436, 16, 10774);
    			add_location(button20, file$9, 435, 14, 10749);
    			attr_dev(a9, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a9, file$9, 433, 12, 10644);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file$9, 419, 10, 10172);
    			attr_dev(th35, "class", "svelte-ccym40");
    			add_location(th35, file$9, 412, 8, 9900);
    			attr_dev(tr25, "class", "item svelte-ccym40");
    			add_location(tr25, file$9, 406, 6, 9771);
    			attr_dev(th36, "class", "date svelte-ccym40");
    			add_location(th36, file$9, 445, 8, 10966);
    			attr_dev(h44, "class", "header svelte-ccym40");
    			add_location(h44, file$9, 447, 10, 11009);
    			attr_dev(th37, "class", "svelte-ccym40");
    			add_location(th37, file$9, 446, 8, 10994);
    			add_location(tr26, file$9, 444, 6, 10953);
    			attr_dev(th38, "class", "date svelte-ccym40");
    			add_location(th38, file$9, 475, 8, 11758);
    			attr_dev(h45, "class", "header svelte-ccym40");
    			add_location(h45, file$9, 477, 10, 11801);
    			attr_dev(th39, "class", "svelte-ccym40");
    			add_location(th39, file$9, 476, 8, 11786);
    			add_location(tr27, file$9, 474, 6, 11745);
    			attr_dev(th40, "class", "date svelte-ccym40");
    			add_location(th40, file$9, 481, 8, 11892);
    			attr_dev(h512, "class", "svelte-ccym40");
    			add_location(h512, file$9, 483, 10, 11973);
    			attr_dev(h611, "class", "svelte-ccym40");
    			add_location(h611, file$9, 484, 10, 12025);
    			attr_dev(p10, "class", "desc svelte-ccym40");
    			add_location(p10, file$9, 485, 10, 12084);
    			attr_dev(th41, "class", "svelte-ccym40");
    			add_location(th41, file$9, 482, 8, 11958);
    			attr_dev(tr28, "class", "item svelte-ccym40");
    			add_location(tr28, file$9, 480, 6, 11866);
    			attr_dev(tr29, "class", "buffer svelte-ccym40");
    			add_location(tr29, file$9, 491, 6, 12269);
    			attr_dev(th42, "class", "date svelte-ccym40");
    			add_location(th42, file$9, 493, 8, 12323);
    			attr_dev(h513, "class", "svelte-ccym40");
    			add_location(h513, file$9, 495, 10, 12378);
    			attr_dev(h612, "class", "svelte-ccym40");
    			add_location(h612, file$9, 496, 10, 12409);
    			attr_dev(p11, "class", "desc svelte-ccym40");
    			add_location(p11, file$9, 497, 10, 12457);
    			attr_dev(th43, "class", "svelte-ccym40");
    			add_location(th43, file$9, 494, 8, 12363);
    			attr_dev(tr30, "class", "item svelte-ccym40");
    			add_location(tr30, file$9, 492, 6, 12297);
    			attr_dev(th44, "class", "date svelte-ccym40");
    			add_location(th44, file$9, 505, 8, 12674);
    			attr_dev(h46, "class", "header svelte-ccym40");
    			add_location(h46, file$9, 507, 10, 12717);
    			attr_dev(th45, "class", "svelte-ccym40");
    			add_location(th45, file$9, 506, 8, 12702);
    			add_location(tr31, file$9, 504, 6, 12661);
    			attr_dev(th46, "class", "date svelte-ccym40");
    			add_location(th46, file$9, 511, 8, 12807);
    			attr_dev(h514, "class", "svelte-ccym40");
    			add_location(h514, file$9, 513, 10, 12850);
    			attr_dev(th47, "class", "svelte-ccym40");
    			add_location(th47, file$9, 512, 8, 12835);
    			attr_dev(tr32, "class", "item svelte-ccym40");
    			add_location(tr32, file$9, 510, 6, 12781);
    			attr_dev(th48, "class", "date svelte-ccym40");
    			add_location(th48, file$9, 517, 8, 12922);
    			attr_dev(h515, "class", "single svelte-ccym40");
    			add_location(h515, file$9, 519, 10, 12980);
    			attr_dev(th49, "class", "svelte-ccym40");
    			add_location(th49, file$9, 518, 8, 12965);
    			add_location(tr33, file$9, 516, 6, 12909);
    			attr_dev(th50, "class", "date svelte-ccym40");
    			add_location(th50, file$9, 523, 8, 13085);
    			attr_dev(h516, "class", "single svelte-ccym40");
    			add_location(h516, file$9, 525, 10, 13143);
    			attr_dev(th51, "class", "svelte-ccym40");
    			add_location(th51, file$9, 524, 8, 13128);
    			add_location(tr34, file$9, 522, 6, 13072);
    			add_location(br9, file$9, 530, 6, 13277);
    			attr_dev(th52, "class", "date svelte-ccym40");
    			add_location(th52, file$9, 532, 8, 13316);
    			attr_dev(h517, "class", "svelte-ccym40");
    			add_location(h517, file$9, 534, 10, 13359);
    			attr_dev(th53, "class", "svelte-ccym40");
    			add_location(th53, file$9, 533, 8, 13344);
    			attr_dev(tr35, "class", "item svelte-ccym40");
    			add_location(tr35, file$9, 531, 6, 13290);
    			attr_dev(th54, "class", "date svelte-ccym40");
    			add_location(th54, file$9, 538, 8, 13422);
    			attr_dev(h518, "class", "single svelte-ccym40");
    			add_location(h518, file$9, 540, 10, 13472);
    			attr_dev(th55, "class", "svelte-ccym40");
    			add_location(th55, file$9, 539, 8, 13457);
    			add_location(tr36, file$9, 537, 6, 13409);
    			attr_dev(th56, "class", "date svelte-ccym40");
    			add_location(th56, file$9, 546, 8, 13629);
    			attr_dev(h519, "class", "single svelte-ccym40");
    			add_location(h519, file$9, 548, 10, 13679);
    			attr_dev(th57, "class", "svelte-ccym40");
    			add_location(th57, file$9, 547, 8, 13664);
    			add_location(tr37, file$9, 545, 6, 13616);
    			attr_dev(th58, "class", "date svelte-ccym40");
    			add_location(th58, file$9, 555, 8, 13852);
    			attr_dev(h47, "class", "header svelte-ccym40");
    			add_location(h47, file$9, 557, 10, 13895);
    			attr_dev(th59, "class", "svelte-ccym40");
    			add_location(th59, file$9, 556, 8, 13880);
    			add_location(tr38, file$9, 554, 6, 13839);
    			attr_dev(th60, "class", "date svelte-ccym40");
    			add_location(th60, file$9, 561, 8, 13970);
    			attr_dev(a10, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			add_location(a10, file$9, 564, 12, 14058);
    			add_location(i10, file$9, 569, 12, 14271);
    			attr_dev(h520, "class", "single press svelte-ccym40");
    			add_location(h520, file$9, 563, 10, 14020);
    			attr_dev(th61, "class", "svelte-ccym40");
    			add_location(th61, file$9, 562, 8, 14005);
    			add_location(tr39, file$9, 560, 6, 13957);
    			attr_dev(th62, "class", "date svelte-ccym40");
    			add_location(th62, file$9, 574, 8, 14360);
    			attr_dev(a11, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a11, file$9, 577, 12, 14448);
    			add_location(i11, file$9, 582, 12, 14703);
    			attr_dev(h521, "class", "single press svelte-ccym40");
    			add_location(h521, file$9, 576, 10, 14410);
    			attr_dev(th63, "class", "svelte-ccym40");
    			add_location(th63, file$9, 575, 8, 14395);
    			add_location(tr40, file$9, 573, 6, 14347);
    			attr_dev(th64, "class", "date svelte-ccym40");
    			add_location(th64, file$9, 587, 8, 14778);
    			attr_dev(a12, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a12, file$9, 590, 12, 14866);
    			add_location(i12, file$9, 595, 12, 15097);
    			attr_dev(h522, "class", "single press svelte-ccym40");
    			add_location(h522, file$9, 589, 10, 14828);
    			attr_dev(th65, "class", "svelte-ccym40");
    			add_location(th65, file$9, 588, 8, 14813);
    			add_location(tr41, file$9, 586, 6, 14765);
    			attr_dev(th66, "class", "date svelte-ccym40");
    			add_location(th66, file$9, 600, 8, 15178);
    			attr_dev(a13, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a13, file$9, 603, 12, 15266);
    			add_location(i13, file$9, 609, 12, 15540);
    			attr_dev(h523, "class", "single press svelte-ccym40");
    			add_location(h523, file$9, 602, 10, 15228);
    			attr_dev(th67, "class", "svelte-ccym40");
    			add_location(th67, file$9, 601, 8, 15213);
    			add_location(tr42, file$9, 599, 6, 15165);
    			attr_dev(th68, "class", "date svelte-ccym40");
    			add_location(th68, file$9, 615, 8, 15639);
    			attr_dev(h48, "class", "header svelte-ccym40");
    			add_location(h48, file$9, 617, 10, 15682);
    			attr_dev(th69, "class", "svelte-ccym40");
    			add_location(th69, file$9, 616, 8, 15667);
    			add_location(tr43, file$9, 614, 6, 15626);
    			attr_dev(th70, "class", "date svelte-ccym40");
    			add_location(th70, file$9, 621, 8, 15773);
    			attr_dev(h524, "class", "svelte-ccym40");
    			add_location(h524, file$9, 623, 10, 15828);
    			attr_dev(h613, "class", "svelte-ccym40");
    			add_location(h613, file$9, 624, 10, 15881);
    			attr_dev(p12, "class", "desc svelte-ccym40");
    			add_location(p12, file$9, 628, 10, 16012);
    			attr_dev(i14, "class", "fab fa-github svelte-ccym40");
    			add_location(i14, file$9, 635, 16, 16298);
    			add_location(button21, file$9, 634, 14, 16273);
    			attr_dev(a14, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a14, file$9, 633, 12, 16200);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file$9, 632, 10, 16169);
    			attr_dev(th71, "class", "svelte-ccym40");
    			add_location(th71, file$9, 622, 8, 15813);
    			attr_dev(tr44, "class", "item svelte-ccym40");
    			add_location(tr44, file$9, 620, 6, 15747);
    			attr_dev(tr45, "class", "buffer svelte-ccym40");
    			add_location(tr45, file$9, 642, 6, 16439);
    			attr_dev(th72, "class", "date svelte-ccym40");
    			add_location(th72, file$9, 644, 8, 16493);
    			attr_dev(h525, "class", "svelte-ccym40");
    			add_location(h525, file$9, 646, 10, 16550);
    			attr_dev(p13, "class", "desc svelte-ccym40");
    			add_location(p13, file$9, 647, 10, 16602);
    			attr_dev(i15, "class", "fas fa-file-pdf svelte-ccym40");
    			add_location(i15, file$9, 654, 16, 16860);
    			add_location(button22, file$9, 653, 14, 16835);
    			attr_dev(a15, "href", "./gt_bus_analysis.pdf");
    			add_location(a15, file$9, 652, 12, 16788);
    			attr_dev(i16, "class", "fas fa-globe svelte-ccym40");
    			add_location(i16, file$9, 660, 16, 17063);
    			add_location(button23, file$9, 659, 14, 17038);
    			attr_dev(a16, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a16, file$9, 658, 12, 16966);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file$9, 651, 10, 16757);
    			attr_dev(th73, "class", "svelte-ccym40");
    			add_location(th73, file$9, 645, 8, 16535);
    			attr_dev(tr46, "class", "item svelte-ccym40");
    			add_location(tr46, file$9, 643, 6, 16467);
    			attr_dev(tr47, "class", "buffer svelte-ccym40");
    			add_location(tr47, file$9, 667, 6, 17202);
    			attr_dev(th74, "class", "date svelte-ccym40");
    			add_location(th74, file$9, 669, 8, 17256);
    			attr_dev(h526, "class", "svelte-ccym40");
    			add_location(h526, file$9, 671, 10, 17313);
    			attr_dev(p14, "class", "desc svelte-ccym40");
    			add_location(p14, file$9, 672, 10, 17346);
    			attr_dev(i17, "class", "fas fa-globe svelte-ccym40");
    			add_location(i17, file$9, 679, 16, 17619);
    			add_location(button24, file$9, 678, 14, 17594);
    			attr_dev(a17, "href", "http://ctfs.github.io/resources/");
    			add_location(a17, file$9, 677, 12, 17536);
    			attr_dev(i18, "class", "fab fa-github svelte-ccym40");
    			add_location(i18, file$9, 685, 16, 17807);
    			add_location(button25, file$9, 684, 14, 17782);
    			attr_dev(a18, "href", "https://github.com/ctfs/resources");
    			add_location(a18, file$9, 683, 12, 17723);
    			attr_dev(div12, "class", "tags");
    			add_location(div12, file$9, 676, 10, 17505);
    			attr_dev(th75, "class", "svelte-ccym40");
    			add_location(th75, file$9, 670, 8, 17298);
    			attr_dev(tr48, "class", "item svelte-ccym40");
    			add_location(tr48, file$9, 668, 6, 17230);
    			attr_dev(th76, "class", "date svelte-ccym40");
    			add_location(th76, file$9, 767, 8, 20110);
    			attr_dev(h49, "class", "header svelte-ccym40");
    			add_location(h49, file$9, 769, 10, 20153);
    			attr_dev(th77, "class", "svelte-ccym40");
    			add_location(th77, file$9, 768, 8, 20138);
    			add_location(tr49, file$9, 766, 6, 20097);
    			attr_dev(th78, "class", "date svelte-ccym40");
    			add_location(th78, file$9, 773, 8, 20252);
    			attr_dev(h527, "class", "single svelte-ccym40");
    			add_location(h527, file$9, 776, 12, 20384);
    			attr_dev(a19, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a19, file$9, 775, 10, 20307);
    			attr_dev(th79, "class", "svelte-ccym40");
    			add_location(th79, file$9, 774, 8, 20292);
    			attr_dev(tr50, "class", "item svelte-ccym40");
    			add_location(tr50, file$9, 772, 6, 20226);
    			attr_dev(th80, "class", "date svelte-ccym40");
    			add_location(th80, file$9, 781, 8, 20510);
    			attr_dev(h528, "class", "single svelte-ccym40");
    			add_location(h528, file$9, 784, 12, 20636);
    			attr_dev(a20, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a20, file$9, 783, 10, 20567);
    			attr_dev(th81, "class", "svelte-ccym40");
    			add_location(th81, file$9, 782, 8, 20552);
    			attr_dev(tr51, "class", "item svelte-ccym40");
    			add_location(tr51, file$9, 780, 6, 20484);
    			attr_dev(th82, "class", "date svelte-ccym40");
    			add_location(th82, file$9, 789, 8, 20778);
    			attr_dev(h529, "class", "single svelte-ccym40");
    			add_location(h529, file$9, 791, 10, 20833);
    			attr_dev(th83, "class", "svelte-ccym40");
    			add_location(th83, file$9, 790, 8, 20818);
    			attr_dev(tr52, "class", "item svelte-ccym40");
    			add_location(tr52, file$9, 788, 6, 20752);
    			attr_dev(th84, "class", "date svelte-ccym40");
    			add_location(th84, file$9, 795, 8, 20946);
    			attr_dev(h530, "class", "single svelte-ccym40");
    			add_location(h530, file$9, 798, 12, 21080);
    			attr_dev(a21, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a21, file$9, 797, 10, 21003);
    			attr_dev(th85, "class", "svelte-ccym40");
    			add_location(th85, file$9, 796, 8, 20988);
    			attr_dev(tr53, "class", "item svelte-ccym40");
    			add_location(tr53, file$9, 794, 6, 20920);
    			attr_dev(th86, "class", "date svelte-ccym40");
    			add_location(th86, file$9, 803, 8, 21209);
    			attr_dev(h531, "class", "single svelte-ccym40");
    			add_location(h531, file$9, 806, 12, 21320);
    			attr_dev(a22, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a22, file$9, 805, 10, 21266);
    			attr_dev(th87, "class", "svelte-ccym40");
    			add_location(th87, file$9, 804, 8, 21251);
    			attr_dev(tr54, "class", "item svelte-ccym40");
    			add_location(tr54, file$9, 802, 6, 21183);
    			attr_dev(th88, "class", "date svelte-ccym40");
    			add_location(th88, file$9, 811, 8, 21447);
    			attr_dev(h532, "class", "single svelte-ccym40");
    			add_location(h532, file$9, 813, 10, 21504);
    			attr_dev(th89, "class", "svelte-ccym40");
    			add_location(th89, file$9, 812, 8, 21489);
    			attr_dev(tr55, "class", "item svelte-ccym40");
    			add_location(tr55, file$9, 810, 6, 21421);
    			attr_dev(th90, "class", "date svelte-ccym40");
    			add_location(th90, file$9, 818, 8, 21623);
    			attr_dev(h410, "class", "header svelte-ccym40");
    			add_location(h410, file$9, 820, 10, 21666);
    			attr_dev(th91, "class", "svelte-ccym40");
    			add_location(th91, file$9, 819, 8, 21651);
    			add_location(tr56, file$9, 817, 6, 21610);
    			attr_dev(th92, "class", "date svelte-ccym40");
    			add_location(th92, file$9, 824, 8, 21755);
    			attr_dev(h533, "class", "svelte-ccym40");
    			add_location(h533, file$9, 826, 10, 21798);
    			add_location(button26, file$9, 828, 12, 21858);
    			add_location(button27, file$9, 829, 12, 21904);
    			add_location(button28, file$9, 830, 12, 21950);
    			attr_dev(div13, "class", "tags");
    			add_location(div13, file$9, 827, 10, 21827);
    			attr_dev(th93, "class", "svelte-ccym40");
    			add_location(th93, file$9, 825, 8, 21783);
    			attr_dev(tr57, "class", "item svelte-ccym40");
    			add_location(tr57, file$9, 823, 6, 21729);
    			attr_dev(tr58, "class", "buffer svelte-ccym40");
    			add_location(tr58, file$9, 834, 6, 22045);
    			attr_dev(th94, "class", "date svelte-ccym40");
    			add_location(th94, file$9, 836, 8, 22099);
    			attr_dev(h534, "class", "svelte-ccym40");
    			add_location(h534, file$9, 838, 10, 22142);
    			add_location(button29, file$9, 840, 12, 22214);
    			add_location(button30, file$9, 841, 12, 22248);
    			add_location(button31, file$9, 842, 12, 22288);
    			add_location(button32, file$9, 843, 12, 22324);
    			add_location(button33, file$9, 844, 12, 22359);
    			add_location(button34, file$9, 845, 12, 22392);
    			attr_dev(div14, "class", "tags");
    			add_location(div14, file$9, 839, 10, 22183);
    			attr_dev(th95, "class", "svelte-ccym40");
    			add_location(th95, file$9, 837, 8, 22127);
    			attr_dev(tr59, "class", "item svelte-ccym40");
    			add_location(tr59, file$9, 835, 6, 22073);
    			attr_dev(tr60, "class", "buffer svelte-ccym40");
    			add_location(tr60, file$9, 849, 6, 22461);
    			attr_dev(th96, "class", "date svelte-ccym40");
    			add_location(th96, file$9, 851, 8, 22515);
    			attr_dev(h535, "class", "svelte-ccym40");
    			add_location(h535, file$9, 853, 10, 22558);
    			add_location(button35, file$9, 855, 12, 22621);
    			add_location(button36, file$9, 856, 12, 22667);
    			add_location(button37, file$9, 857, 12, 22719);
    			add_location(button38, file$9, 858, 12, 22754);
    			add_location(button39, file$9, 859, 12, 22790);
    			add_location(button40, file$9, 860, 12, 22824);
    			add_location(button41, file$9, 861, 12, 22856);
    			add_location(button42, file$9, 862, 12, 22893);
    			add_location(button43, file$9, 863, 12, 22947);
    			attr_dev(div15, "class", "tags");
    			add_location(div15, file$9, 854, 10, 22590);
    			attr_dev(th97, "class", "svelte-ccym40");
    			add_location(th97, file$9, 852, 8, 22543);
    			attr_dev(tr61, "class", "item svelte-ccym40");
    			add_location(tr61, file$9, 850, 6, 22489);
    			attr_dev(tr62, "class", "buffer svelte-ccym40");
    			add_location(tr62, file$9, 867, 6, 23036);
    			attr_dev(th98, "class", "date svelte-ccym40");
    			add_location(th98, file$9, 869, 8, 23090);
    			attr_dev(p15, "class", "desc svelte-ccym40");
    			add_location(p15, file$9, 871, 10, 23133);
    			attr_dev(th99, "class", "svelte-ccym40");
    			add_location(th99, file$9, 870, 8, 23118);
    			attr_dev(tr63, "class", "item svelte-ccym40");
    			add_location(tr63, file$9, 868, 6, 23064);
    			attr_dev(table, "class", "svelte-ccym40");
    			add_location(table, file$9, 128, 4, 1826);
    			attr_dev(main, "class", "svelte-ccym40");
    			add_location(main, file$9, 127, 2, 1815);
    			attr_dev(div16, "id", "container");
    			attr_dev(div16, "class", "svelte-ccym40");
    			add_location(div16, file$9, 126, 0, 1792);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div16, anchor);
    			append_dev(div16, main);
    			append_dev(main, table);
    			append_dev(table, tr0);
    			append_dev(tr0, th0);
    			append_dev(tr0, t0);
    			append_dev(tr0, th1);
    			append_dev(th1, h3);
    			append_dev(h3, span0);
    			append_dev(h3, t2);
    			append_dev(h3, span1);
    			append_dev(h3, t4);
    			append_dev(h3, span2);
    			append_dev(h3, t6);
    			append_dev(h3, span3);
    			append_dev(th1, t8);
    			mount_component(intro, th1, null);
    			append_dev(th1, t9);
    			mount_component(social, th1, null);
    			append_dev(table, t10);
    			append_dev(table, tr1);
    			append_dev(tr1, th2);
    			append_dev(tr1, t11);
    			append_dev(tr1, th3);
    			append_dev(th3, h40);
    			append_dev(table, t13);
    			append_dev(table, tr2);
    			append_dev(tr2, th4);
    			append_dev(th4, t14);
    			append_dev(th4, br0);
    			append_dev(th4, t15);
    			append_dev(tr2, t16);
    			append_dev(tr2, th5);
    			append_dev(th5, h50);
    			append_dev(th5, t18);
    			append_dev(th5, h60);
    			append_dev(table, t20);
    			append_dev(table, tr3);
    			append_dev(table, t21);
    			append_dev(table, tr4);
    			append_dev(tr4, th6);
    			append_dev(th6, t22);
    			append_dev(th6, br1);
    			append_dev(th6, t23);
    			append_dev(tr4, t24);
    			append_dev(tr4, th7);
    			append_dev(th7, h51);
    			append_dev(th7, t26);
    			append_dev(th7, h61);
    			append_dev(th7, t28);
    			append_dev(th7, p0);
    			append_dev(table, t30);
    			append_dev(table, tr5);
    			append_dev(tr5, th8);
    			append_dev(tr5, t32);
    			append_dev(tr5, th9);
    			append_dev(th9, h62);
    			append_dev(th9, t34);
    			append_dev(th9, p1);
    			append_dev(table, t36);
    			append_dev(table, tr6);
    			append_dev(tr6, th10);
    			append_dev(tr6, t37);
    			append_dev(tr6, th11);
    			append_dev(th11, h41);
    			append_dev(table, t39);
    			append_dev(table, tr7);
    			append_dev(tr7, th12);
    			append_dev(tr7, t41);
    			append_dev(tr7, th13);
    			append_dev(th13, h52);
    			append_dev(th13, t43);
    			append_dev(th13, p2);
    			append_dev(th13, t45);
    			append_dev(th13, div0);
    			append_dev(div0, a0);
    			append_dev(a0, button0);
    			append_dev(button0, i0);
    			append_dev(button0, t46);
    			append_dev(table, t47);
    			append_dev(table, tr8);
    			append_dev(table, t48);
    			append_dev(table, tr9);
    			append_dev(tr9, th14);
    			append_dev(tr9, t50);
    			append_dev(tr9, th15);
    			append_dev(th15, h53);
    			append_dev(th15, t52);
    			append_dev(th15, p3);
    			append_dev(th15, t54);
    			append_dev(th15, div1);
    			append_dev(div1, a1);
    			append_dev(a1, button1);
    			append_dev(button1, i1);
    			append_dev(button1, t55);
    			append_dev(table, t56);
    			append_dev(table, tr10);
    			append_dev(table, t57);
    			append_dev(table, tr11);
    			append_dev(tr11, th16);
    			append_dev(th16, t58);
    			append_dev(th16, br2);
    			append_dev(th16, t59);
    			append_dev(tr11, t60);
    			append_dev(tr11, th17);
    			append_dev(th17, h54);
    			append_dev(th17, t62);
    			append_dev(th17, h63);
    			append_dev(th17, t64);
    			append_dev(th17, p4);
    			append_dev(th17, t66);
    			append_dev(th17, div2);
    			append_dev(div2, a2);
    			append_dev(a2, button2);
    			append_dev(button2, i2);
    			append_dev(button2, t67);
    			append_dev(table, t68);
    			append_dev(table, tr12);
    			append_dev(table, t69);
    			append_dev(table, tr13);
    			append_dev(tr13, th18);
    			append_dev(tr13, t71);
    			append_dev(tr13, th19);
    			append_dev(th19, h55);
    			append_dev(th19, t73);
    			append_dev(th19, h64);
    			append_dev(th19, t75);
    			append_dev(th19, p5);
    			append_dev(th19, t77);
    			append_dev(th19, div3);
    			append_dev(div3, a3);
    			append_dev(a3, button3);
    			append_dev(button3, i3);
    			append_dev(button3, t78);
    			append_dev(table, t79);
    			append_dev(table, tr14);
    			append_dev(tr14, th20);
    			append_dev(tr14, t80);
    			append_dev(tr14, th21);
    			append_dev(th21, h42);
    			append_dev(table, t82);
    			append_dev(table, tr15);
    			append_dev(tr15, th22);
    			append_dev(th22, t83);
    			append_dev(th22, br3);
    			append_dev(th22, t84);
    			append_dev(tr15, t85);
    			append_dev(tr15, th23);
    			append_dev(th23, h56);
    			append_dev(th23, t87);
    			append_dev(th23, h65);
    			append_dev(th23, t89);
    			append_dev(th23, p6);
    			append_dev(th23, t91);
    			append_dev(th23, div4);
    			append_dev(div4, a4);
    			append_dev(a4, button4);
    			append_dev(button4, i4);
    			append_dev(button4, t92);
    			append_dev(div4, t93);
    			append_dev(div4, button5);
    			append_dev(div4, t95);
    			append_dev(div4, button6);
    			append_dev(div4, t97);
    			append_dev(div4, button7);
    			append_dev(div4, t99);
    			append_dev(div4, button8);
    			append_dev(table, t101);
    			append_dev(table, tr16);
    			append_dev(table, t102);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(th24, t103);
    			append_dev(th24, br4);
    			append_dev(th24, t104);
    			append_dev(tr17, t105);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t107);
    			append_dev(th25, h66);
    			append_dev(th25, t109);
    			append_dev(th25, p7);
    			append_dev(th25, t111);
    			append_dev(th25, div5);
    			append_dev(div5, button9);
    			append_dev(div5, t113);
    			append_dev(div5, button10);
    			append_dev(div5, t115);
    			append_dev(div5, button11);
    			append_dev(div5, t117);
    			append_dev(div5, button12);
    			append_dev(table, t119);
    			append_dev(table, tr18);
    			append_dev(table, t120);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(th26, t121);
    			append_dev(th26, br5);
    			append_dev(th26, t122);
    			append_dev(tr19, t123);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t125);
    			append_dev(th27, h67);
    			append_dev(th27, t127);
    			append_dev(th27, p8);
    			append_dev(th27, t129);
    			append_dev(th27, div6);
    			append_dev(div6, button13);
    			append_dev(div6, t131);
    			append_dev(div6, button14);
    			append_dev(div6, t133);
    			append_dev(div6, button15);
    			append_dev(table, t135);
    			append_dev(table, tr20);
    			append_dev(tr20, th28);
    			append_dev(tr20, t136);
    			append_dev(tr20, th29);
    			append_dev(th29, h43);
    			append_dev(table, t138);
    			append_dev(table, tr21);
    			append_dev(tr21, th30);
    			append_dev(th30, t139);
    			append_dev(th30, br6);
    			append_dev(th30, t140);
    			append_dev(tr21, t141);
    			append_dev(tr21, th31);
    			append_dev(th31, h59);
    			append_dev(th31, t143);
    			append_dev(th31, h68);
    			append_dev(th31, t145);
    			append_dev(th31, div7);
    			append_dev(div7, a5);
    			append_dev(a5, button16);
    			append_dev(button16, i5);
    			append_dev(button16, t146);
    			append_dev(table, t147);
    			append_dev(table, tr22);
    			append_dev(table, t148);
    			append_dev(table, tr23);
    			append_dev(tr23, th32);
    			append_dev(th32, t149);
    			append_dev(th32, br7);
    			append_dev(th32, t150);
    			append_dev(tr23, t151);
    			append_dev(tr23, th33);
    			append_dev(th33, h510);
    			append_dev(th33, t153);
    			append_dev(th33, h69);
    			append_dev(th33, t155);
    			append_dev(th33, div8);
    			append_dev(div8, a6);
    			append_dev(a6, button17);
    			append_dev(button17, i6);
    			append_dev(button17, t156);
    			append_dev(table, t157);
    			append_dev(table, tr24);
    			append_dev(table, t158);
    			append_dev(table, tr25);
    			append_dev(tr25, th34);
    			append_dev(th34, t159);
    			append_dev(th34, br8);
    			append_dev(th34, t160);
    			append_dev(tr25, t161);
    			append_dev(tr25, th35);
    			append_dev(th35, h511);
    			append_dev(th35, t163);
    			append_dev(th35, h610);
    			append_dev(th35, t165);
    			append_dev(th35, p9);
    			append_dev(th35, t167);
    			append_dev(th35, div9);
    			append_dev(div9, a7);
    			append_dev(a7, button18);
    			append_dev(button18, i7);
    			append_dev(button18, t168);
    			append_dev(div9, t169);
    			append_dev(div9, a8);
    			append_dev(a8, button19);
    			append_dev(button19, i8);
    			append_dev(button19, t170);
    			append_dev(div9, t171);
    			append_dev(div9, a9);
    			append_dev(a9, button20);
    			append_dev(button20, i9);
    			append_dev(button20, t172);
    			append_dev(table, t173);
    			append_dev(table, tr26);
    			append_dev(tr26, th36);
    			append_dev(tr26, t174);
    			append_dev(tr26, th37);
    			append_dev(th37, h44);
    			append_dev(table, t176);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t177);
    			append_dev(table, tr27);
    			append_dev(tr27, th38);
    			append_dev(tr27, t178);
    			append_dev(tr27, th39);
    			append_dev(th39, h45);
    			append_dev(table, t180);
    			append_dev(table, tr28);
    			append_dev(tr28, th40);
    			append_dev(tr28, t182);
    			append_dev(tr28, th41);
    			append_dev(th41, h512);
    			append_dev(th41, t184);
    			append_dev(th41, h611);
    			append_dev(th41, t186);
    			append_dev(th41, p10);
    			append_dev(table, t188);
    			append_dev(table, tr29);
    			append_dev(table, t189);
    			append_dev(table, tr30);
    			append_dev(tr30, th42);
    			append_dev(tr30, t191);
    			append_dev(tr30, th43);
    			append_dev(th43, h513);
    			append_dev(th43, t193);
    			append_dev(th43, h612);
    			append_dev(th43, t195);
    			append_dev(th43, p11);
    			append_dev(table, t197);
    			append_dev(table, tr31);
    			append_dev(tr31, th44);
    			append_dev(tr31, t198);
    			append_dev(tr31, th45);
    			append_dev(th45, h46);
    			append_dev(table, t200);
    			append_dev(table, tr32);
    			append_dev(tr32, th46);
    			append_dev(tr32, t201);
    			append_dev(tr32, th47);
    			append_dev(th47, h514);
    			append_dev(table, t203);
    			append_dev(table, tr33);
    			append_dev(tr33, th48);
    			append_dev(tr33, t205);
    			append_dev(tr33, th49);
    			append_dev(th49, h515);
    			append_dev(table, t207);
    			append_dev(table, tr34);
    			append_dev(tr34, th50);
    			append_dev(tr34, t209);
    			append_dev(tr34, th51);
    			append_dev(th51, h516);
    			append_dev(table, t211);
    			append_dev(table, br9);
    			append_dev(table, t212);
    			append_dev(table, tr35);
    			append_dev(tr35, th52);
    			append_dev(tr35, t213);
    			append_dev(tr35, th53);
    			append_dev(th53, h517);
    			append_dev(table, t215);
    			append_dev(table, tr36);
    			append_dev(tr36, th54);
    			append_dev(tr36, t217);
    			append_dev(tr36, th55);
    			append_dev(th55, h518);
    			append_dev(table, t219);
    			append_dev(table, tr37);
    			append_dev(tr37, th56);
    			append_dev(tr37, t221);
    			append_dev(tr37, th57);
    			append_dev(th57, h519);
    			append_dev(table, t223);
    			append_dev(table, tr38);
    			append_dev(tr38, th58);
    			append_dev(tr38, t224);
    			append_dev(tr38, th59);
    			append_dev(th59, h47);
    			append_dev(table, t226);
    			append_dev(table, tr39);
    			append_dev(tr39, th60);
    			append_dev(tr39, t228);
    			append_dev(tr39, th61);
    			append_dev(th61, h520);
    			append_dev(h520, a10);
    			append_dev(h520, t230);
    			append_dev(h520, i10);
    			append_dev(table, t232);
    			append_dev(table, tr40);
    			append_dev(tr40, th62);
    			append_dev(tr40, t234);
    			append_dev(tr40, th63);
    			append_dev(th63, h521);
    			append_dev(h521, a11);
    			append_dev(h521, t236);
    			append_dev(h521, i11);
    			append_dev(table, t238);
    			append_dev(table, tr41);
    			append_dev(tr41, th64);
    			append_dev(tr41, t240);
    			append_dev(tr41, th65);
    			append_dev(th65, h522);
    			append_dev(h522, a12);
    			append_dev(h522, t242);
    			append_dev(h522, i12);
    			append_dev(table, t244);
    			append_dev(table, tr42);
    			append_dev(tr42, th66);
    			append_dev(tr42, t246);
    			append_dev(tr42, th67);
    			append_dev(th67, h523);
    			append_dev(h523, a13);
    			append_dev(h523, t248);
    			append_dev(h523, i13);
    			append_dev(table, t250);
    			append_dev(table, tr43);
    			append_dev(tr43, th68);
    			append_dev(tr43, t251);
    			append_dev(tr43, th69);
    			append_dev(th69, h48);
    			append_dev(table, t253);
    			append_dev(table, tr44);
    			append_dev(tr44, th70);
    			append_dev(tr44, t255);
    			append_dev(tr44, th71);
    			append_dev(th71, h524);
    			append_dev(th71, t257);
    			append_dev(th71, h613);
    			append_dev(th71, t259);
    			append_dev(th71, p12);
    			append_dev(th71, t261);
    			append_dev(th71, div10);
    			append_dev(div10, a14);
    			append_dev(a14, button21);
    			append_dev(button21, i14);
    			append_dev(button21, t262);
    			append_dev(table, t263);
    			append_dev(table, tr45);
    			append_dev(table, t264);
    			append_dev(table, tr46);
    			append_dev(tr46, th72);
    			append_dev(tr46, t266);
    			append_dev(tr46, th73);
    			append_dev(th73, h525);
    			append_dev(th73, t268);
    			append_dev(th73, p13);
    			append_dev(th73, t270);
    			append_dev(th73, div11);
    			append_dev(div11, a15);
    			append_dev(a15, button22);
    			append_dev(button22, i15);
    			append_dev(button22, t271);
    			append_dev(div11, t272);
    			append_dev(div11, a16);
    			append_dev(a16, button23);
    			append_dev(button23, i16);
    			append_dev(button23, t273);
    			append_dev(table, t274);
    			append_dev(table, tr47);
    			append_dev(table, t275);
    			append_dev(table, tr48);
    			append_dev(tr48, th74);
    			append_dev(tr48, t277);
    			append_dev(tr48, th75);
    			append_dev(th75, h526);
    			append_dev(th75, t279);
    			append_dev(th75, p14);
    			append_dev(th75, t281);
    			append_dev(th75, div12);
    			append_dev(div12, a17);
    			append_dev(a17, button24);
    			append_dev(button24, i17);
    			append_dev(button24, t282);
    			append_dev(div12, t283);
    			append_dev(div12, a18);
    			append_dev(a18, button25);
    			append_dev(button25, i18);
    			append_dev(button25, t284);
    			append_dev(table, t285);
    			append_dev(table, tr49);
    			append_dev(tr49, th76);
    			append_dev(tr49, t286);
    			append_dev(tr49, th77);
    			append_dev(th77, h49);
    			append_dev(table, t288);
    			append_dev(table, tr50);
    			append_dev(tr50, th78);
    			append_dev(tr50, t290);
    			append_dev(tr50, th79);
    			append_dev(th79, a19);
    			append_dev(a19, h527);
    			append_dev(table, t292);
    			append_dev(table, tr51);
    			append_dev(tr51, th80);
    			append_dev(tr51, t294);
    			append_dev(tr51, th81);
    			append_dev(th81, a20);
    			append_dev(a20, h528);
    			append_dev(table, t296);
    			append_dev(table, tr52);
    			append_dev(tr52, th82);
    			append_dev(tr52, t298);
    			append_dev(tr52, th83);
    			append_dev(th83, h529);
    			append_dev(table, t300);
    			append_dev(table, tr53);
    			append_dev(tr53, th84);
    			append_dev(tr53, t302);
    			append_dev(tr53, th85);
    			append_dev(th85, a21);
    			append_dev(a21, h530);
    			append_dev(table, t304);
    			append_dev(table, tr54);
    			append_dev(tr54, th86);
    			append_dev(tr54, t306);
    			append_dev(tr54, th87);
    			append_dev(th87, a22);
    			append_dev(a22, h531);
    			append_dev(table, t308);
    			append_dev(table, tr55);
    			append_dev(tr55, th88);
    			append_dev(tr55, t310);
    			append_dev(tr55, th89);
    			append_dev(th89, h532);
    			append_dev(table, t312);
    			append_dev(table, tr56);
    			append_dev(tr56, th90);
    			append_dev(tr56, t313);
    			append_dev(tr56, th91);
    			append_dev(th91, h410);
    			append_dev(table, t315);
    			append_dev(table, tr57);
    			append_dev(tr57, th92);
    			append_dev(tr57, t316);
    			append_dev(tr57, th93);
    			append_dev(th93, h533);
    			append_dev(th93, t318);
    			append_dev(th93, div13);
    			append_dev(div13, button26);
    			append_dev(div13, t320);
    			append_dev(div13, button27);
    			append_dev(div13, t322);
    			append_dev(div13, button28);
    			append_dev(table, t324);
    			append_dev(table, tr58);
    			append_dev(table, t325);
    			append_dev(table, tr59);
    			append_dev(tr59, th94);
    			append_dev(tr59, t326);
    			append_dev(tr59, th95);
    			append_dev(th95, h534);
    			append_dev(th95, t328);
    			append_dev(th95, div14);
    			append_dev(div14, button29);
    			append_dev(div14, t330);
    			append_dev(div14, button30);
    			append_dev(div14, t332);
    			append_dev(div14, button31);
    			append_dev(div14, t334);
    			append_dev(div14, button32);
    			append_dev(div14, t336);
    			append_dev(div14, button33);
    			append_dev(div14, t338);
    			append_dev(div14, button34);
    			append_dev(table, t340);
    			append_dev(table, tr60);
    			append_dev(table, t341);
    			append_dev(table, tr61);
    			append_dev(tr61, th96);
    			append_dev(tr61, t342);
    			append_dev(tr61, th97);
    			append_dev(th97, h535);
    			append_dev(th97, t344);
    			append_dev(th97, div15);
    			append_dev(div15, button35);
    			append_dev(div15, t346);
    			append_dev(div15, button36);
    			append_dev(div15, t348);
    			append_dev(div15, button37);
    			append_dev(div15, t350);
    			append_dev(div15, button38);
    			append_dev(div15, t352);
    			append_dev(div15, button39);
    			append_dev(div15, t354);
    			append_dev(div15, button40);
    			append_dev(div15, t356);
    			append_dev(div15, button41);
    			append_dev(div15, t358);
    			append_dev(div15, button42);
    			append_dev(div15, t360);
    			append_dev(div15, button43);
    			append_dev(table, t362);
    			append_dev(table, tr62);
    			append_dev(table, t363);
    			append_dev(table, tr63);
    			append_dev(tr63, th98);
    			append_dev(tr63, t364);
    			append_dev(tr63, th99);
    			append_dev(th99, p15);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.pubs) {
    				each_value = pubs;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(table, t177);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			transition_in(social.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			transition_out(social.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div16);
    			}

    			destroy_component(intro);

    			destroy_component(social);

    			destroy_each(each_blocks, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$a.name, type: "component", source: "", ctx });
    	return block;
    }

    const func$3 = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

    function instance$6($$self) {
    	

      onMount(() => window.scrollTo(0, 0));

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class Cv extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$a, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Cv", options, id: create_fragment$a.name });
    	}
    }

    var routes = {
        '/': Home,
        '/news': News,
        '/pubs': Pubs,
        '/cv': Cv,
        '/paper/:id': Paper,
    };

    /* src/App.svelte generated by Svelte v3.12.1 */
    const { document: document_1 } = globals;

    const file$a = "src/App.svelte";

    function create_fragment$b(ctx) {
    	var meta, link0, link1, link2, link3, t, current;

    	var router = new Router({
    		props: { routes: routes },
    		$$inline: true
    	});

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			link0 = element("link");
    			link1 = element("link");
    			link2 = element("link");
    			link3 = element("link");
    			t = space();
    			router.$$.fragment.c();
    			document_1.title = "Alex Cabrera";
    			attr_dev(meta, "name", "viewport");
    			attr_dev(meta, "content", "width=device-width, initial-scale=1");
    			add_location(meta, file$a, 32, 2, 777);
    			attr_dev(link0, "rel", "stylesheet");
    			attr_dev(link0, "href", "https://unpkg.com/purecss@1.0.1/build/pure-min.css");
    			attr_dev(link0, "integrity", "sha384-oAOxQR6DkCoMliIh8yFnu25d7Eq/PHS21PClpwjOTeU2jRSq11vu66rf90/cZr47");
    			attr_dev(link0, "crossorigin", "anonymous");
    			add_location(link0, file$a, 33, 2, 850);
    			attr_dev(link1, "rel", "stylesheet");
    			attr_dev(link1, "href", "https://unpkg.com/purecss@1.0.1/build/grids-responsive-min.css");
    			add_location(link1, file$a, 38, 2, 1060);
    			attr_dev(link2, "rel", "stylesheet");
    			attr_dev(link2, "href", "https://use.fontawesome.com/releases/v5.0.12/css/all.css");
    			attr_dev(link2, "integrity", "sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9");
    			attr_dev(link2, "crossorigin", "anonymous");
    			add_location(link2, file$a, 42, 2, 1167);
    			attr_dev(link3, "href", "https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:900,400");
    			attr_dev(link3, "rel", "stylesheet");
    			add_location(link3, file$a, 47, 2, 1383);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			append_dev(document_1.head, meta);
    			append_dev(document_1.head, link0);
    			append_dev(document_1.head, link1);
    			append_dev(document_1.head, link2);
    			append_dev(document_1.head, link3);
    			insert_dev(target, t, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},

    		p: noop,

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
    			detach_dev(meta);
    			detach_dev(link0);
    			detach_dev(link1);
    			detach_dev(link2);
    			detach_dev(link3);

    			if (detaching) {
    				detach_dev(t);
    			}

    			destroy_component(router, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$b.name, type: "component", source: "", ctx });
    	return block;
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

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$b, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$b.name });
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
