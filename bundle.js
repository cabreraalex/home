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
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
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
    			add_location(a0, file$2, 9, 4, 161);
    			attr_dev(a1, "href", "https://purecss.io");
    			add_location(a1, file$2, 11, 4, 213);
    			attr_dev(p, "id", "copyright");
    			add_location(p, file$2, 7, 2, 79);
    			attr_dev(div, "class", "footer svelte-qsjnhq");
    			add_location(div, file$2, 6, 0, 56);
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
        date: "April 23, 2020",
        news:
          "Our system for visualizing indicators of COVID symptoms <a href='https://covidcast.cmu.edu/'>is live!</a> ",
      },
      {
        date: "March 5, 2020",
        news:
          "Thanks to the Data Stories podcast for having Yongsu Ahn and me on their show to talk about <a href='https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/'>fairness and machine learning.</a>",
      },
      {
        date: "July 23, 2019",
        news: "We will be presenting FairVis as a conference paper at VIS'19!",
      },
      {
        date: "May 6, 2019",
        news:
          "Our work on discovering intersectional bias was accepted to the <a href='https://debug-ml-iclr2019.github.io/'>Debugging Machine Learning Models workshop</a> at ICLR'19 in New Orleans.",
      },
      {
        date: "April 10, 2019",
        news:
          "Named a <a href='https://www.nsfgrfp.org/'>NSF Graduate Research Fellow.</a>",
      },
      {
        date: "April 3, 2019",
        news:
          "Excited to be starting my PhD in Human-Computer Interaction at Carnegie Mellon in Fall 2019!",
      },
    ];

    /* src/News.svelte generated by Svelte v3.12.1 */

    const file$3 = "src/News.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.n = list[i];
    	return child_ctx;
    }

    // (23:6) {#each news as n}
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
    			add_location(p0, file$3, 24, 10, 548);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$3, 25, 10, 610);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$3, 23, 8, 507);
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
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(23:6) {#each news as n}", ctx });
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
    			attr_dev(h1, "class", "svelte-151t33z");
    			add_location(h1, file$3, 20, 6, 448);
    			add_location(hr, file$3, 21, 6, 468);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$3, 19, 4, 416);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$3, 18, 2, 362);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$3, 16, 0, 305);
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
          "@INPROCEEDINGS{8986948, author={Á. A. {Cabrera} and W. {Epperson} and F. {Hohman} and M. {Kahng} and J. {Morgenstern} and D. H. {Chau}}, booktitle={2019 IEEE Conference on Visual Analytics Science and Technology (VAST)}, title={FAIRVIS: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, year={2019}, volume={}, number={}, pages={46-56},}",
        abstract:
          "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
        demo: "https://poloclub.github.io/FairVis/",
        code: "https://github.com/poloclub/FairVis",
        blog:
          "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
        pdf: "https://arxiv.org/abs/1904.05419",
        video: "https://vimeo.com/showcase/6524122/video/368702211"
        // slides: "./FairVis.pdf"
      }
    ];

    var other = [
      {
        title: "Regularizing Black-box Models for Improved Interpretability",
        desc:
          "We introduce a new regularization method for training deep learning models that improves the stability and fidelity of post-hoc explanantion methods like LIME. Through a user study we show that the regularized model empirically improves the quality of explainations.",
        id: "expo",
        teaser: "expo.png",
        venue: "Under Review",
        venuelong: "Under Review",
        year: "2020",
        month: "",
        location: "",
        authors: [
          {
            name: "Gregory Plumb",
            website: "https://gdplumb.github.io/",
          },
          {
            name: "Maruan Al-Shedivat",
            website: "https://www.cs.cmu.edu/~mshediva/",
          },
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com",
          },
          {
            name: "Adam Perer",
            website: "http://perer.org/",
          },
          {
            name: "Eric Xing",
            website: "http://www.cs.cmu.edu/~epxing/",
          },
          {
            name: "Ameet Talwalkar",
            website: "https://www.cs.cmu.edu/~atalwalk/",
          },
        ],
        bibtex:
          "@article{plumb2019regularizing, title={Regularizing Black-box Models for Improved Interpretability}, author={Plumb, Gregory and Al-Shedivat, Maruan and Cabrera, Ángel Alexander, and Perer, Adam and Xing, Eric and Talwalkar, Ameet}, journal={arXiv preprint arXiv:1902.06787}, year={2020}}",
        abstract:
          "Most of the work on interpretable machine learning has focused on designing either inherently interpretable models, which typically trade-off accuracy for interpretability, or post-hoc explanation systems, which tend to lack guarantees about the quality of their explanations. We explore a hybridization of these approaches by directly regularizing a black-box model for interpretability at training time - a method we call ExpO. We find that post-hoc explanations of an ExpO-regularized model are consistently more stable and of higher fidelity, which we show theoretically and support empirically. Critically, we also find ExpO leads to explanations that are more actionable, significantly more useful, and more intuitive as supported by a user study.",
        pdf: "https://arxiv.org/pdf/1902.06787.pdf",
      },
      {
        title:
          '"Public(s)-in-the-Loop": Facilitating Deliberation of Algorithmic Decisions in Contentious Public Policy Domains',
        desc:
          "We introduce a framework for thinking about how to better involve human influence in algorithmic decision-making of contentious public policy issues.",
        id: "publics",
        teaser: "publics-in-loop.png",
        venue: "Workshop, CHI'20",
        venuelong: "Fair & Responsible AI Workshop at CHI",
        year: "2020",
        month: "May",
        location: "Hawaii, USA",
        authors: [
          {
            name: "Hong Shen",
            website: "https://www.andrew.cmu.edu/user//hongs/",
          },
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com",
          },
          {
            name: "Adam Perer",
            website: "http://perer.org",
          },
          {
            name: "Jason Hong",
            website: "http://www.cs.cmu.edu/~jasonh/",
          },
        ],
        bibtex:
          '@article{hong2020publics, title={"Public(s)-in-the-Loop": Facilitating Deliberation of Algorithmic Decisions in Contentious Public Policy Domains}, author={Shen, Hong and Cabrera, Ángel Alexander and Perer, Adam and Hong, Jason}, journal={Fair & Responsible AI Workshop at CHI}, year={2020}}',
        abstract:
          "This position paper offers a framework to think about how to better involve human influence in algorithmic decision-making of contentious public policy issues. Drawing from insights in communication literature, we introduce a ``public(s)-in-the-loop'' approach and enumerates three features that are central to this approach: publics as plural political entities, collective decision-making through deliberation, and the construction of publics. It explores how these features might advance our understanding of stakeholder participation in AI design in contentious public policy domains such as recidivism prediction. Finally, it sketches out part of a research agenda for the HCI community to support this work.",
        pdf:
          "https://www.andrew.cmu.edu/user/hongs/files/20_chi_workshop_publics.pdf",
        workshop: "http://fair-ai.owlstown.com/",
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
            website: "https://cabreraalex.com",
          },
          {
            name: "Minsuk Kahng",
            website: "https://minsuk.com",
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com",
          },
          {
            name: "Jamie Morgenstern",
            website: "http://jamiemorgenstern.com",
          },
          {
            name: "Duen Horng (Polo) Chau",
            website: "https://poloclub.github.io/polochau/",
          },
        ],
        bibtex:
          "@article{cabrera2019discovery, title={Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation}, author={Cabrera, Ángel Alexander and Kahng, Minsuk and Hohman, Fred and Morgenstern, Jamie and Chau, Duen Horng}, journal={Debugging Machine Learning Models Workshop (Debug ML) at ICLR}, year={2019}}",
        abstract:
          "As machine learning is applied to data about people, it is crucial to understand how learned models treat different demographic groups. Many factors, including what training data and class of models are used, can encode biased behavior into learned outcomes. These biases are often small when considering a single feature (e.g., sex or race) in isolation, but appear more blatantly at the intersection of multiple features. We present our ongoing work of designing automatic techniques and interactive tools to help users discover subgroups of data instances on which a model underperforms. Using a bottom-up clustering technique for subgroup generation, users can quickly find areas of a dataset in which their models are encoding bias. Our work presents some of the first user-focused, interactive methods for discovering bias in machine learning models.",
        pdf:
          "https://debug-ml-iclr2019.github.io/cameraready/DebugML-19_paper_3.pdf",
        workshop: "https://debug-ml-iclr2019.github.io/",
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
            website: "https://cabreraalex.com",
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com",
          },
          {
            name: "Jason Lin",
            website: "http://jlin.xyz",
          },
          {
            name: "Duen Horng (Polo) Chau",
            website: "https://poloclub.github.io/polochau/",
          },
        ],
        bibtex:
          "@article{cabrera2018interactive, title={Interactive Classification for Deep Learning Interpretation}, author={Cabrera, Ángel Alexander and Hohman, Fred and Lin, Jason and Chau, Duen Horng}, journal={Demo, IEEE Conference on Computer Vision and Pattern Recognition (CVPR)}, year={2018}, organization={IEEE}}",
        abstract:
          "We present an interactive system enabling users to manipulate images to explore the robustness and sensitivity of deep learning image classifiers. Using modern web technologies to run in-browser inference, users can remove image features using inpainting algorithms to obtain new classifications in real time. This system allows users to compare and contrast what image regions humans and machine learning models use for classification.",
        website: "http://fredhohman.com/papers/interactive-classification",
        pdf: "https://arxiv.org/abs/1806.05660",
        video: "https://www.youtube.com/watch?v=llub5GcOF6w",
        demo: "https://cabreraalex.github.io/interactive-classification",
        code: "https://github.com/poloclub/interactive-classification",
      },
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
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx._ = list[i];
    	child_ctx.i = i;
    	return child_ctx;
    }

    // (58:8) {#each { length: 3 } as _, i}
    function create_each_block_2(ctx) {
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
    			add_location(p0, file$6, 59, 12, 1394);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 60, 12, 1464);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$6, 58, 10, 1351);
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
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block_2.name, type: "each", source: "(58:8) {#each { length: 3 } as _, i}", ctx });
    	return block;
    }

    // (73:8) {#each pubs as pub}
    function create_each_block_1(ctx) {
    	var div5, div2, a0, div0, t0, div1, h6, t1_value = ctx.pub.venue + "", t1, t2, div4, div3, a1, h4, t3_value = ctx.pub.title + "", t3, t4, h5, raw_value = ctx.pub.authors
                        .map(func)
                        .join(', ') + "", t5, t6, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div2 = element("div");
    			a0 = element("a");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
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
    			links.$$.fragment.c();
    			t6 = space();
    			set_style(div0, "background-image", "url(" + ('images/' + ctx.pub.teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 76, 16, 2001);
    			attr_dev(a0, "href", '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 75, 14, 1954);
    			attr_dev(h6, "class", "venue svelte-1h5ckrj");
    			add_location(h6, file$6, 82, 16, 2201);
    			add_location(div1, file$6, 81, 14, 2179);
    			attr_dev(div2, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1h5ckrj");
    			add_location(div2, file$6, 74, 12, 1893);
    			add_location(h4, file$6, 88, 18, 2445);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 87, 16, 2376);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 90, 16, 2503);
    			attr_dev(div3, "class", "padded");
    			add_location(div3, file$6, 86, 14, 2339);
    			attr_dev(div4, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div4, file$6, 85, 12, 2288);
    			attr_dev(div5, "class", "pure-g pub");
    			add_location(div5, file$6, 73, 10, 1856);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			append_dev(div2, a0);
    			append_dev(a0, div0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, h6);
    			append_dev(h6, t1);
    			append_dev(div5, t2);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, a1);
    			append_dev(a1, h4);
    			append_dev(h4, t3);
    			append_dev(div3, t4);
    			append_dev(div3, h5);
    			h5.innerHTML = raw_value;
    			append_dev(div4, t5);
    			mount_component(links, div4, null);
    			append_dev(div5, t6);
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
    				detach_dev(div5);
    			}

    			destroy_component(links);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block_1.name, type: "each", source: "(73:8) {#each pubs as pub}", ctx });
    	return block;
    }

    // (109:8) {#each other as pub}
    function create_each_block$1(ctx) {
    	var div4, div1, a0, div0, t0, h6, t1_value = ctx.pub.venue + "", t1, t2, div3, div2, a1, h4, t3_value = ctx.pub.title + "", t3, t4, h5, raw_value = ctx.pub.authors
                        .map(func_1)
                        .join(', ') + "", t5, t6, current;

    	var links = new Links({
    		props: { pub: ctx.pub },
    		$$inline: true
    	});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div1 = element("div");
    			a0 = element("a");
    			div0 = element("div");
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
    			set_style(div0, "background-image", "url(" + ('images/' + ctx.pub.teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 112, 16, 3287);
    			attr_dev(a0, "href", '#/paper/' + ctx.pub.id);
    			add_location(a0, file$6, 111, 14, 3240);
    			attr_dev(h6, "class", "venue svelte-1h5ckrj");
    			add_location(h6, file$6, 117, 14, 3465);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1h5ckrj");
    			add_location(div1, file$6, 110, 12, 3179);
    			add_location(h4, file$6, 122, 18, 3688);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 121, 16, 3619);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 124, 16, 3746);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$6, 120, 14, 3582);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 119, 12, 3531);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 109, 10, 3142);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div1);
    			append_dev(div1, a0);
    			append_dev(a0, div0);
    			append_dev(div1, t0);
    			append_dev(div1, h6);
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
    			append_dev(div3, t5);
    			mount_component(links, div3, null);
    			append_dev(div4, t6);
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
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block$1.name, type: "each", source: "(109:8) {#each other as pub}", ctx });
    	return block;
    }

    function create_fragment$7(ctx) {
    	var div9, t0, div8, div7, div0, h20, t1, span, t3, t4, div2, div1, h21, t6, a, t8, hr0, t9, t10, div4, div3, h22, t12, hr1, t13, t14, div6, div5, h23, t16, hr2, t17, t18, current;

    	var sidebar = new Sidebar({ $$inline: true });

    	var intro = new Intro({ $$inline: true });

    	let each_value_2 = { length: 3 };

    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = pubs;

    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = other;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	var footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			sidebar.$$.fragment.c();
    			t0 = space();
    			div8 = element("div");
    			div7 = element("div");
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
    			a = element("a");
    			a.textContent = "see all";
    			t8 = space();
    			hr0 = element("hr");
    			t9 = space();

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t10 = space();
    			div4 = element("div");
    			div3 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Refereed Publications";
    			t12 = space();
    			hr1 = element("hr");
    			t13 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t14 = space();
    			div6 = element("div");
    			div5 = element("div");
    			h23 = element("h2");
    			h23.textContent = "Workshops, Demos, Posters, and Preprints";
    			t16 = space();
    			hr2 = element("hr");
    			t17 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t18 = space();
    			footer.$$.fragment.c();
    			attr_dev(span, "class", "name");
    			add_location(span, file$6, 47, 10, 1037);
    			attr_dev(h20, "id", "hello");
    			attr_dev(h20, "class", "svelte-1h5ckrj");
    			add_location(h20, file$6, 45, 8, 981);
    			attr_dev(div0, "id", "intro");
    			add_location(div0, file$6, 44, 6, 956);
    			attr_dev(h21, "class", "header svelte-1h5ckrj");
    			add_location(h21, file$6, 53, 10, 1187);
    			attr_dev(a, "class", "right-all");
    			attr_dev(a, "href", "#/news");
    			add_location(a, file$6, 54, 10, 1226);
    			attr_dev(div1, "class", "inline svelte-1h5ckrj");
    			add_location(div1, file$6, 52, 8, 1156);
    			add_location(hr0, file$6, 56, 8, 1296);
    			attr_dev(div2, "id", "news");
    			attr_dev(div2, "class", "sect");
    			add_location(div2, file$6, 51, 6, 1119);
    			attr_dev(h22, "class", "header svelte-1h5ckrj");
    			add_location(h22, file$6, 68, 10, 1676);
    			attr_dev(div3, "class", "inline svelte-1h5ckrj");
    			add_location(div3, file$6, 67, 8, 1645);
    			add_location(hr1, file$6, 71, 8, 1811);
    			attr_dev(div4, "id", "pubs");
    			attr_dev(div4, "class", "sect");
    			add_location(div4, file$6, 66, 6, 1608);
    			attr_dev(h23, "class", "header svelte-1h5ckrj");
    			add_location(h23, file$6, 104, 10, 2942);
    			attr_dev(div5, "class", "inline svelte-1h5ckrj");
    			add_location(div5, file$6, 103, 8, 2911);
    			add_location(hr2, file$6, 107, 8, 3096);
    			attr_dev(div6, "id", "pubs");
    			attr_dev(div6, "class", "sect");
    			add_location(div6, file$6, 102, 6, 2874);
    			attr_dev(div7, "id", "padded-content");
    			add_location(div7, file$6, 43, 4, 924);
    			attr_dev(div8, "id", "content");
    			attr_dev(div8, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div8, file$6, 42, 2, 870);
    			attr_dev(div9, "class", "pure-g");
    			attr_dev(div9, "id", "main-container");
    			add_location(div9, file$6, 40, 0, 813);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div9, anchor);
    			mount_component(sidebar, div9, null);
    			append_dev(div9, t0);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, div0);
    			append_dev(div0, h20);
    			append_dev(h20, t1);
    			append_dev(h20, span);
    			append_dev(div0, t3);
    			mount_component(intro, div0, null);
    			append_dev(div7, t4);
    			append_dev(div7, div2);
    			append_dev(div2, div1);
    			append_dev(div1, h21);
    			append_dev(div1, t6);
    			append_dev(div1, a);
    			append_dev(div2, t8);
    			append_dev(div2, hr0);
    			append_dev(div2, t9);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(div2, null);
    			}

    			append_dev(div7, t10);
    			append_dev(div7, div4);
    			append_dev(div4, div3);
    			append_dev(div3, h22);
    			append_dev(div4, t12);
    			append_dev(div4, hr1);
    			append_dev(div4, t13);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div4, null);
    			}

    			append_dev(div7, t14);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, h23);
    			append_dev(div6, t16);
    			append_dev(div6, hr2);
    			append_dev(div6, t17);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			append_dev(div8, t18);
    			mount_component(footer, div8, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.news) {
    				each_value_2 = { length: 3 };

    				let i;
    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(changed, child_ctx);
    					} else {
    						each_blocks_2[i] = create_each_block_2(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}
    				each_blocks_2.length = each_value_2.length;
    			}

    			if (changed.pubs) {
    				each_value_1 = pubs;

    				let i;
    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div4, null);
    					}
    				}

    				group_outros();
    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}

    			if (changed.other) {
    				each_value = other;

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
    						each_blocks[i].m(div6, null);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);

    			transition_in(intro.$$.fragment, local);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(footer.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);

    			each_blocks_1 = each_blocks_1.filter(Boolean);
    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div9);
    			}

    			destroy_component(sidebar);

    			destroy_component(intro);

    			destroy_each(each_blocks_2, detaching);

    			destroy_each(each_blocks_1, detaching);

    			destroy_each(each_blocks, detaching);

    			destroy_component(footer);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$7.name, type: "component", source: "", ctx });
    	return block;
    }

    const func = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

    const func_1 = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

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
    			add_location(img, file$7, 27, 16, 720);
    			attr_dev(a0, "href", '#/paper/' + ctx.pub.id);
    			add_location(a0, file$7, 26, 14, 673);
    			attr_dev(h6, "class", "venue");
    			add_location(h6, file$7, 29, 14, 817);
    			attr_dev(div0, "class", "thumb");
    			add_location(div0, file$7, 25, 12, 639);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$7, 24, 10, 580);
    			add_location(h4, file$7, 35, 16, 1049);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$7, 34, 14, 982);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$7, 37, 14, 1103);
    			attr_dev(p, "class", "desc");
    			add_location(p, file$7, 42, 14, 1302);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$7, 33, 12, 947);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$7, 32, 10, 898);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$7, 23, 8, 545);
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
    			attr_dev(h1, "class", "svelte-y6vncv");
    			add_location(h1, file$7, 20, 6, 476);
    			add_location(hr, file$7, 21, 6, 504);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$7, 19, 4, 444);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$7, 18, 2, 390);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$7, 16, 0, 333);
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
          .map(func_1$1)
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
    			attr_dev(i0, "class", "fas fa-home svelte-1tofbi8");
    			attr_dev(i0, "id", "home");
    			add_location(i0, file$8, 112, 4, 1767);
    			attr_dev(span0, "class", "color svelte-1tofbi8");
    			add_location(span0, file$8, 114, 6, 1833);
    			attr_dev(span1, "class", "color red svelte-1tofbi8");
    			add_location(span1, file$8, 115, 6, 1878);
    			attr_dev(span2, "class", "color svelte-1tofbi8");
    			add_location(span2, file$8, 116, 6, 1920);
    			attr_dev(span3, "class", "color red svelte-1tofbi8");
    			add_location(span3, file$8, 117, 6, 1965);
    			attr_dev(h40, "id", "home-link");
    			attr_dev(h40, "class", "svelte-1tofbi8");
    			add_location(h40, file$8, 113, 4, 1807);
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "home svelte-1tofbi8");
    			add_location(a0, file$8, 111, 2, 1737);
    			add_location(hr, file$8, 120, 2, 2023);
    			attr_dev(h1, "class", "svelte-1tofbi8");
    			add_location(h1, file$8, 121, 2, 2032);
    			attr_dev(h3, "class", "svelte-1tofbi8");
    			add_location(h3, file$8, 123, 4, 2075);
    			attr_dev(div0, "id", "info");
    			attr_dev(div0, "class", "svelte-1tofbi8");
    			add_location(div0, file$8, 122, 2, 2055);
    			attr_dev(img, "src", 'images/' + ctx.pub.teaser);
    			attr_dev(img, "class", "teaser svelte-1tofbi8");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$8, 133, 6, 2322);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 132, 4, 2279);
    			attr_dev(p0, "class", "desc svelte-1tofbi8");
    			add_location(p0, file$8, 136, 6, 2445);
    			attr_dev(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 135, 4, 2402);
    			attr_dev(div3, "class", "flex pure-g svelte-1tofbi8");
    			add_location(div3, file$8, 131, 2, 2249);
    			attr_dev(h20, "class", "sec-title svelte-1tofbi8");
    			add_location(h20, file$8, 140, 2, 2499);
    			attr_dev(p1, "class", "svelte-1tofbi8");
    			add_location(p1, file$8, 141, 2, 2537);
    			attr_dev(h21, "class", "sec-title svelte-1tofbi8");
    			add_location(h21, file$8, 143, 2, 2562);
    			attr_dev(h41, "class", "svelte-1tofbi8");
    			add_location(h41, file$8, 145, 4, 2655);
    			attr_dev(a1, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$8, 144, 2, 2600);
    			attr_dev(h50, "class", "svelte-1tofbi8");
    			add_location(h50, file$8, 148, 2, 2686);
    			add_location(i1, file$8, 155, 4, 2833);
    			attr_dev(h51, "class", "svelte-1tofbi8");
    			add_location(h51, file$8, 154, 2, 2824);
    			attr_dev(h22, "class", "sec-title svelte-1tofbi8");
    			add_location(h22, file$8, 159, 2, 2913);
    			attr_dev(code, "class", "bibtex");
    			add_location(code, file$8, 161, 4, 2972);
    			attr_dev(div4, "class", "code svelte-1tofbi8");
    			add_location(div4, file$8, 160, 2, 2949);
    			attr_dev(div5, "id", "body");
    			attr_dev(div5, "class", "svelte-1tofbi8");
    			add_location(div5, file$8, 110, 0, 1719);
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

    const func_1$1 = (p) => "<a class='press' href='" + p.website + "'>" + p.name + '</a>';

    function instance$5($$self, $$props, $$invalidate) {
    	
      let { params = {} } = $$props;

      let pub = pubs.concat(other).find(e => e.id === params.id);
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

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.pub = list[i];
    	return child_ctx;
    }

    // (451:6) {#each pubs as pub}
    function create_each_block_1$1(ctx) {
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
    			attr_dev(th0, "class", "date svelte-1y3arww");
    			add_location(th0, file$9, 452, 10, 11129);
    			attr_dev(h5, "class", "svelte-1y3arww");
    			add_location(h5, file$9, 455, 14, 11266);
    			attr_dev(a, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 454, 12, 11201);
    			attr_dev(h6, "class", "authors svelte-1y3arww");
    			add_location(h6, file$9, 458, 12, 11317);
    			add_location(i, file$9, 465, 14, 11538);
    			attr_dev(p, "class", "desc svelte-1y3arww");
    			add_location(p, file$9, 464, 12, 11507);
    			attr_dev(th1, "class", "svelte-1y3arww");
    			add_location(th1, file$9, 453, 10, 11184);
    			attr_dev(tr0, "class", "item svelte-1y3arww");
    			add_location(tr0, file$9, 451, 8, 11101);
    			attr_dev(tr1, "class", "buffer svelte-1y3arww");
    			add_location(tr1, file$9, 471, 8, 11674);
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
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block_1$1.name, type: "each", source: "(451:6) {#each pubs as pub}", ctx });
    	return block;
    }

    // (481:6) {#each other as pub}
    function create_each_block$3(ctx) {
    	var tr0, th0, t0_value = ctx.pub.month + "", t0, t1, t2_value = ctx.pub.year + "", t2, t3, th1, a, h5, t4_value = ctx.pub.title + "", t4, t5, h6, raw_value = ctx.pub.authors
                    .map(func_1$2)
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
    			attr_dev(th0, "class", "date svelte-1y3arww");
    			add_location(th0, file$9, 482, 10, 11952);
    			attr_dev(h5, "class", "svelte-1y3arww");
    			add_location(h5, file$9, 485, 14, 12089);
    			attr_dev(a, "href", '#/paper/' + ctx.pub.id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 484, 12, 12024);
    			attr_dev(h6, "class", "authors svelte-1y3arww");
    			add_location(h6, file$9, 488, 12, 12140);
    			add_location(i, file$9, 495, 14, 12361);
    			attr_dev(p, "class", "desc svelte-1y3arww");
    			add_location(p, file$9, 494, 12, 12330);
    			attr_dev(th1, "class", "svelte-1y3arww");
    			add_location(th1, file$9, 483, 10, 12007);
    			attr_dev(tr0, "class", "item svelte-1y3arww");
    			add_location(tr0, file$9, 481, 8, 11924);
    			attr_dev(tr1, "class", "buffer svelte-1y3arww");
    			add_location(tr1, file$9, 501, 8, 12497);
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
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block$3.name, type: "each", source: "(481:6) {#each other as pub}", ctx });
    	return block;
    }

    function create_fragment$a(ctx) {
    	var div17, main, table, tr0, th0, t0, th1, h3, span0, t2, span1, t4, span2, t6, span3, t8, t9, t10, tr1, th2, t11, th3, h40, t13, tr2, th4, t14, br0, t15, t16, th5, h50, t18, h60, t20, tr3, t21, tr4, th6, t22, br1, t23, t24, th7, h51, t26, h61, t28, p0, t29, br2, t30, t31, tr5, th8, t33, th9, h62, t35, p1, t37, tr6, th10, t38, th11, h41, t40, tr7, th12, t42, th13, h52, t44, p2, t46, div0, a0, button0, i0, t47, t48, tr8, t49, tr9, th14, t51, th15, h53, t53, p3, t55, div1, a1, button1, i1, t56, t57, tr10, t58, tr11, th16, t59, br3, t60, t61, th17, h54, t63, h63, t65, p4, t67, div2, a2, button2, i2, t68, t69, tr12, t70, tr13, th18, t72, th19, h55, t74, h64, t76, p5, t78, div3, a3, button3, i3, t79, t80, tr14, th20, t81, th21, h42, t83, tr15, th22, t84, br4, t85, t86, th23, h56, t88, h65, t90, p6, t92, div4, a4, button4, i4, t93, t94, button5, t96, button6, t98, button7, t100, button8, t102, tr16, t103, tr17, th24, t104, br5, t105, t106, th25, h57, t108, h66, t110, p7, t112, div5, button9, t114, button10, t116, button11, t118, button12, t120, tr18, t121, tr19, th26, t122, br6, t123, t124, th27, h58, t126, h67, t128, p8, t130, div6, button13, t132, button14, t134, button15, t136, tr20, th28, t137, th29, h43, t139, tr21, th30, t140, br7, t141, t142, th31, h59, t144, h68, t146, div7, a5, button16, i5, t147, t148, tr22, t149, tr23, th32, t150, br8, t151, t152, th33, h510, t154, h69, t156, div8, a6, button17, i6, t157, t158, tr24, t159, tr25, th34, t160, br9, t161, t162, th35, h511, t164, h610, t166, p9, t168, div9, a7, button18, i7, t169, t170, a8, button19, i8, t171, t172, a9, button20, i9, t173, t174, tr26, th36, t175, th37, h44, t177, t178, tr27, th38, t179, th39, h45, t181, t182, tr28, th40, t183, th41, h46, t185, tr29, th42, t186, br10, t187, br11, t188, t189, th43, h512, t191, h611, t193, p10, t195, tr30, t196, tr31, th44, t198, th45, h513, t200, h612, t202, p11, t204, tr32, th46, t205, th47, h47, t207, tr33, th48, t208, th49, h514, t210, tr34, th50, t212, th51, h515, t214, tr35, th52, t216, th53, h516, t218, br12, t219, tr36, th54, t220, th55, h517, t222, tr37, th56, t224, th57, h518, t226, tr38, th58, t228, th59, h519, t230, tr39, th60, t231, th61, h48, t233, tr40, th62, t235, th63, h520, a10, t237, i10, t239, tr41, th64, t241, th65, h521, a11, t243, i11, t245, tr42, th66, t247, th67, h522, a12, t249, i12, t251, tr43, th68, t253, th69, h523, a13, t255, i13, t257, tr44, th70, t259, th71, h524, a14, t261, i14, t263, tr45, th72, t265, th73, h525, a15, t267, i15, t269, tr46, th74, t271, th75, h526, a16, t273, i16, t275, tr47, th76, t276, th77, h49, t278, tr48, th78, t280, th79, h527, t282, p12, t284, div10, a17, button21, i17, t285, t286, tr49, t287, tr50, th80, t289, th81, h528, t291, h613, t293, p13, t295, div11, a18, button22, i18, t296, t297, tr51, t298, tr52, th82, t300, th83, h529, t302, p14, t304, div12, a19, button23, i19, t305, t306, a20, button24, i20, t307, t308, tr53, t309, tr54, th84, t311, th85, h530, t313, p15, t315, div13, a21, button25, i21, t316, t317, a22, button26, i22, t318, t319, tr55, th86, t320, th87, h410, t322, tr56, th88, t324, th89, a23, h531, t326, tr57, th90, t328, th91, a24, h532, t330, tr58, th92, t332, th93, a25, h533, t334, tr59, th94, t336, th95, h534, t338, tr60, th96, t340, th97, a26, h535, t342, tr61, th98, t344, th99, a27, h536, t346, tr62, th100, t348, th101, h537, t350, tr63, th102, t351, th103, h411, t353, tr64, th104, t354, th105, h538, t356, div14, button27, t358, button28, t360, button29, t362, tr65, t363, tr66, th106, t364, th107, h539, t366, div15, button30, t368, button31, t370, button32, t372, button33, t374, button34, t376, button35, t378, tr67, t379, tr68, th108, t380, th109, h540, t382, div16, button36, t384, button37, t386, button38, t388, button39, t390, button40, t392, button41, t394, button42, t396, button43, t398, button44, t400, tr69, t401, tr70, th110, t402, th111, p16, current;

    	var intro = new Intro({ $$inline: true });

    	var social = new Social({ $$inline: true });

    	let each_value_1 = pubs;

    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = other;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div17 = element("div");
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
    			h60.textContent = "Carnegie Mellon University";
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
    			h61.textContent = "Georgia Institute of Technology";
    			t28 = space();
    			p0 = element("p");
    			t29 = text("Concentration in intelligence and modeling/simulation.\n            ");
    			br2 = element("br");
    			t30 = text("\n            Minor in economics.");
    			t31 = space();
    			tr5 = element("tr");
    			th8 = element("th");
    			th8.textContent = "Fall 2017";
    			t33 = space();
    			th9 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t35 = space();
    			p1 = element("p");
    			p1.textContent = "Exchange program with a focus on economics and political science.";
    			t37 = space();
    			tr6 = element("tr");
    			th10 = element("th");
    			t38 = space();
    			th11 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Awards and Fellowships";
    			t40 = space();
    			tr7 = element("tr");
    			th12 = element("th");
    			th12.textContent = "May 2019";
    			t42 = space();
    			th13 = element("th");
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
    			tr8 = element("tr");
    			t49 = space();
    			tr9 = element("tr");
    			th14 = element("th");
    			th14.textContent = "May 2019";
    			t51 = space();
    			th15 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Love Family Foundation Scholarship";
    			t53 = space();
    			p3 = element("p");
    			p3.textContent = "Co-awarded the $10,000 scholarship for the undergraduate with the\n            most outstanding scholastic record.";
    			t55 = space();
    			div1 = element("div");
    			a1 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t56 = text("\n                Announcement");
    			t57 = space();
    			tr10 = element("tr");
    			t58 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			t59 = text("August 2015\n          ");
    			br3 = element("br");
    			t60 = text("\n          - May 2019");
    			t61 = space();
    			th17 = element("th");
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
    			tr12 = element("tr");
    			t70 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			th18.textContent = "February 3, 2018";
    			t72 = space();
    			th19 = element("th");
    			h55 = element("h5");
    			h55.textContent = "The Data Open Datathon";
    			t74 = space();
    			h64 = element("h6");
    			h64.textContent = "Correlation One and Citadel Securities";
    			t76 = space();
    			p5 = element("p");
    			p5.textContent = "Placed third and won $2,500 for creating a ML system to predict\n            dangerous road areas.";
    			t78 = space();
    			div3 = element("div");
    			a3 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t79 = text("\n                Press Release");
    			t80 = space();
    			tr14 = element("tr");
    			th20 = element("th");
    			t81 = space();
    			th21 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Industry Experience";
    			t83 = space();
    			tr15 = element("tr");
    			th22 = element("th");
    			t84 = text("May 2018\n          ");
    			br4 = element("br");
    			t85 = text("\n          - August 2018");
    			t86 = space();
    			th23 = element("th");
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
    			tr16 = element("tr");
    			t103 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			t104 = text("May 2017\n          ");
    			br5 = element("br");
    			t105 = text("\n          - August 2017");
    			t106 = space();
    			th25 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Google";
    			t108 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t110 = space();
    			p7 = element("p");
    			p7.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
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
    			tr18 = element("tr");
    			t121 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t122 = text("May 2016\n          ");
    			br6 = element("br");
    			t123 = text("\n          - August 2016");
    			t124 = space();
    			th27 = element("th");
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
    			tr20 = element("tr");
    			th28 = element("th");
    			t137 = space();
    			th29 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Research Experience";
    			t139 = space();
    			tr21 = element("tr");
    			th30 = element("th");
    			t140 = text("August 2019\n          ");
    			br7 = element("br");
    			t141 = text("\n          - Present");
    			t142 = space();
    			th31 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Carnegie Mellon Human Computer Interaction Institute (HCII)";
    			t144 = space();
    			h68 = element("h6");
    			h68.textContent = "Graduate Research Assistant";
    			t146 = space();
    			div7 = element("div");
    			a5 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t147 = text("\n                CMU Data Interaction Group");
    			t148 = space();
    			tr22 = element("tr");
    			t149 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t150 = text("January 2018\n          ");
    			br8 = element("br");
    			t151 = text("\n          - May 2019");
    			t152 = space();
    			th33 = element("th");
    			h510 = element("h5");
    			h510.textContent = "Polo Club of Data Science";
    			t154 = space();
    			h69 = element("h6");
    			h69.textContent = "Undergraduate Research Assistant";
    			t156 = space();
    			div8 = element("div");
    			a6 = element("a");
    			button17 = element("button");
    			i6 = element("i");
    			t157 = text("\n                Polo Club");
    			t158 = space();
    			tr24 = element("tr");
    			t159 = space();
    			tr25 = element("tr");
    			th34 = element("th");
    			t160 = text("September 2015\n          ");
    			br9 = element("br");
    			t161 = text("\n          - May 2017");
    			t162 = space();
    			th35 = element("th");
    			h511 = element("h5");
    			h511.textContent = "PROX-1 Satellite";
    			t164 = space();
    			h610 = element("h6");
    			h610.textContent = "Flight Software Lead and Researcher";
    			t166 = space();
    			p9 = element("p");
    			p9.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t168 = space();
    			div9 = element("div");
    			a7 = element("a");
    			button18 = element("button");
    			i7 = element("i");
    			t169 = text("\n                In space!");
    			t170 = space();
    			a8 = element("a");
    			button19 = element("button");
    			i8 = element("i");
    			t171 = text("\n                Website");
    			t172 = space();
    			a9 = element("a");
    			button20 = element("button");
    			i9 = element("i");
    			t173 = text("\n                Press release");
    			t174 = space();
    			tr26 = element("tr");
    			th36 = element("th");
    			t175 = space();
    			th37 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Refereed Publications";
    			t177 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t178 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			t179 = space();
    			th39 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Workshops, Demos, Posters, and Preprints";
    			t181 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t182 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			t183 = space();
    			th41 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t185 = space();
    			tr29 = element("tr");
    			th42 = element("th");
    			t186 = text("Fall 2016\n          ");
    			br10 = element("br");
    			t187 = text("\n          Spring 2017\n          ");
    			br11 = element("br");
    			t188 = text("\n          Spring 2018");
    			t189 = space();
    			th43 = element("th");
    			h512 = element("h5");
    			h512.textContent = "CS1332 - Data Structures and Algorithms";
    			t191 = space();
    			h611 = element("h6");
    			h611.textContent = "Undergraduate Teaching Assistant";
    			t193 = space();
    			p10 = element("p");
    			p10.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t195 = space();
    			tr30 = element("tr");
    			t196 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			th44.textContent = "Fall 2016";
    			t198 = space();
    			th45 = element("th");
    			h513 = element("h5");
    			h513.textContent = "GT 1000 - First-Year Seminar";
    			t200 = space();
    			h612 = element("h6");
    			h612.textContent = "Team Leader";
    			t202 = space();
    			p11 = element("p");
    			p11.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t204 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			t205 = space();
    			th47 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t207 = space();
    			tr33 = element("tr");
    			th48 = element("th");
    			t208 = space();
    			th49 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Student Volunteer";
    			t210 = space();
    			tr34 = element("tr");
    			th50 = element("th");
    			th50.textContent = "October 2019";
    			t212 = space();
    			th51 = element("th");
    			h515 = element("h5");
    			h515.textContent = "IEEE Visualization Conference (VIS)";
    			t214 = space();
    			tr35 = element("tr");
    			th52 = element("th");
    			th52.textContent = "January 2019";
    			t216 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t218 = space();
    			br12 = element("br");
    			t219 = space();
    			tr36 = element("tr");
    			th54 = element("th");
    			t220 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "Reviewer";
    			t222 = space();
    			tr37 = element("tr");
    			th56 = element("th");
    			th56.textContent = "2019";
    			t224 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t226 = space();
    			tr38 = element("tr");
    			th58 = element("th");
    			th58.textContent = "2019";
    			t228 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t230 = space();
    			tr39 = element("tr");
    			th60 = element("th");
    			t231 = space();
    			th61 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Press";
    			t233 = space();
    			tr40 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2020";
    			t235 = space();
    			th63 = element("th");
    			h520 = element("h5");
    			a10 = element("a");
    			a10.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t237 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "CNN";
    			t239 = space();
    			tr41 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2020";
    			t241 = space();
    			th65 = element("th");
    			h521 = element("h5");
    			a11 = element("a");
    			a11.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t243 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "Wired";
    			t245 = space();
    			tr42 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2020";
    			t247 = space();
    			th67 = element("th");
    			h522 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t249 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Carnegie Mellon";
    			t251 = space();
    			tr43 = element("tr");
    			th68 = element("th");
    			th68.textContent = "2020";
    			t253 = space();
    			th69 = element("th");
    			h523 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t255 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "Data Stories Podcast";
    			t257 = space();
    			tr44 = element("tr");
    			th70 = element("th");
    			th70.textContent = "2019";
    			t259 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t261 = text("\n            -\n            ");
    			i14 = element("i");
    			i14.textContent = "GT SCS";
    			t263 = space();
    			tr45 = element("tr");
    			th72 = element("th");
    			th72.textContent = "2019";
    			t265 = space();
    			th73 = element("th");
    			h525 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t267 = text("\n            -\n            ");
    			i15 = element("i");
    			i15.textContent = "Georgia Tech";
    			t269 = space();
    			tr46 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2018";
    			t271 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t273 = text("\n            -\n            ");
    			i16 = element("i");
    			i16.textContent = "GT SCS";
    			t275 = space();
    			tr47 = element("tr");
    			th76 = element("th");
    			t276 = space();
    			th77 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Projects";
    			t278 = space();
    			tr48 = element("tr");
    			th78 = element("th");
    			th78.textContent = "Spring 2020";
    			t280 = space();
    			th79 = element("th");
    			h527 = element("h5");
    			h527.textContent = "COVIDcast Visualization of COVID Symptoms";
    			t282 = space();
    			p12 = element("p");
    			p12.textContent = "An interactive visualization for multiple indicators of COVID\n            symptoms collected by the CMU Delphi research group.";
    			t284 = space();
    			div10 = element("div");
    			a17 = element("a");
    			button21 = element("button");
    			i17 = element("i");
    			t285 = text("\n                Website");
    			t286 = space();
    			tr49 = element("tr");
    			t287 = space();
    			tr50 = element("tr");
    			th80 = element("th");
    			th80.textContent = "Fall 2018";
    			t289 = space();
    			th81 = element("th");
    			h528 = element("h5");
    			h528.textContent = "ICLR'19 Reproducibility Challenge";
    			t291 = space();
    			h613 = element("h6");
    			h613.textContent = "Generative Adversarial Models for Learning Private and Fair\n            Representations";
    			t293 = space();
    			p13 = element("p");
    			p13.textContent = "Implemented and reproduced an ICLR'19 submission using GANs to\n            decorrelate sensitive data.";
    			t295 = space();
    			div11 = element("div");
    			a18 = element("a");
    			button22 = element("button");
    			i18 = element("i");
    			t296 = text("\n                GitHub");
    			t297 = space();
    			tr51 = element("tr");
    			t298 = space();
    			tr52 = element("tr");
    			th82 = element("th");
    			th82.textContent = "Spring 2018";
    			t300 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			h529.textContent = "Georgia Tech Bus System Analysis";
    			t302 = space();
    			p14 = element("p");
    			p14.textContent = "System that combines Google Maps and graph algorithms to enable\n            navigation for GT buses.";
    			t304 = space();
    			div12 = element("div");
    			a19 = element("a");
    			button23 = element("button");
    			i19 = element("i");
    			t305 = text("\n                Poster");
    			t306 = space();
    			a20 = element("a");
    			button24 = element("button");
    			i20 = element("i");
    			t307 = text("\n                Class");
    			t308 = space();
    			tr53 = element("tr");
    			t309 = space();
    			tr54 = element("tr");
    			th84 = element("th");
    			th84.textContent = "Spring 2014";
    			t311 = space();
    			th85 = element("th");
    			h530 = element("h5");
    			h530.textContent = "CTF Resources";
    			t313 = space();
    			p15 = element("p");
    			p15.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1,000 stars on GitHub.";
    			t315 = space();
    			div13 = element("div");
    			a21 = element("a");
    			button25 = element("button");
    			i21 = element("i");
    			t316 = text("\n                Website");
    			t317 = space();
    			a22 = element("a");
    			button26 = element("button");
    			i22 = element("i");
    			t318 = text("\n                GitHub");
    			t319 = space();
    			tr55 = element("tr");
    			th86 = element("th");
    			t320 = space();
    			th87 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Selected Classes";
    			t322 = space();
    			tr56 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Spring 2019";
    			t324 = space();
    			th89 = element("th");
    			a23 = element("a");
    			h531 = element("h5");
    			h531.textContent = "Applied Research Methods";
    			t326 = space();
    			tr57 = element("tr");
    			th90 = element("th");
    			th90.textContent = "Fall 2018";
    			t328 = space();
    			th91 = element("th");
    			a24 = element("a");
    			h532 = element("h5");
    			h532.textContent = "Deep Learning";
    			t330 = space();
    			tr58 = element("tr");
    			th92 = element("th");
    			th92.textContent = "Spring 2018";
    			t332 = space();
    			th93 = element("th");
    			a25 = element("a");
    			h533 = element("h5");
    			h533.textContent = "Data and Visual Analytics";
    			t334 = space();
    			tr59 = element("tr");
    			th94 = element("th");
    			th94.textContent = "Fall 2017";
    			t336 = space();
    			th95 = element("th");
    			h534 = element("h5");
    			h534.textContent = "Money and Banking";
    			t338 = space();
    			tr60 = element("tr");
    			th96 = element("th");
    			th96.textContent = "Spring 2017";
    			t340 = space();
    			th97 = element("th");
    			a26 = element("a");
    			h535 = element("h5");
    			h535.textContent = "Machine Learning";
    			t342 = space();
    			tr61 = element("tr");
    			th98 = element("th");
    			th98.textContent = "Spring 2017";
    			t344 = space();
    			th99 = element("th");
    			a27 = element("a");
    			h536 = element("h5");
    			h536.textContent = "Computer Simulation";
    			t346 = space();
    			tr62 = element("tr");
    			th100 = element("th");
    			th100.textContent = "Spring 2017";
    			t348 = space();
    			th101 = element("th");
    			h537 = element("h5");
    			h537.textContent = "Honors Algorithms";
    			t350 = space();
    			tr63 = element("tr");
    			th102 = element("th");
    			t351 = space();
    			th103 = element("th");
    			h411 = element("h4");
    			h411.textContent = "Skills";
    			t353 = space();
    			tr64 = element("tr");
    			th104 = element("th");
    			t354 = space();
    			th105 = element("th");
    			h538 = element("h5");
    			h538.textContent = "Languages";
    			t356 = space();
    			div14 = element("div");
    			button27 = element("button");
    			button27.textContent = "English - Native";
    			t358 = space();
    			button28 = element("button");
    			button28.textContent = "Spanish - Native";
    			t360 = space();
    			button29 = element("button");
    			button29.textContent = "French - Conversational (B1)";
    			t362 = space();
    			tr65 = element("tr");
    			t363 = space();
    			tr66 = element("tr");
    			th106 = element("th");
    			t364 = space();
    			th107 = element("th");
    			h539 = element("h5");
    			h539.textContent = "Programming Languages";
    			t366 = space();
    			div15 = element("div");
    			button30 = element("button");
    			button30.textContent = "Java";
    			t368 = space();
    			button31 = element("button");
    			button31.textContent = "Javascript";
    			t370 = space();
    			button32 = element("button");
    			button32.textContent = "Python";
    			t372 = space();
    			button33 = element("button");
    			button33.textContent = "C/C++";
    			t374 = space();
    			button34 = element("button");
    			button34.textContent = "SQL";
    			t376 = space();
    			button35 = element("button");
    			button35.textContent = "Go";
    			t378 = space();
    			tr67 = element("tr");
    			t379 = space();
    			tr68 = element("tr");
    			th108 = element("th");
    			t380 = space();
    			th109 = element("th");
    			h540 = element("h5");
    			h540.textContent = "Technologies";
    			t382 = space();
    			div16 = element("div");
    			button36 = element("button");
    			button36.textContent = "Machine Learning";
    			t384 = space();
    			button37 = element("button");
    			button37.textContent = "Full Stack Development";
    			t386 = space();
    			button38 = element("button");
    			button38.textContent = "React";
    			t388 = space();
    			button39 = element("button");
    			button39.textContent = "Svelte";
    			t390 = space();
    			button40 = element("button");
    			button40.textContent = "Vega";
    			t392 = space();
    			button41 = element("button");
    			button41.textContent = "D3";
    			t394 = space();
    			button42 = element("button");
    			button42.textContent = "PyTorch";
    			t396 = space();
    			button43 = element("button");
    			button43.textContent = "Cloud Dataflow/MapReduce";
    			t398 = space();
    			button44 = element("button");
    			button44.textContent = "Amazon Mechanical Turk";
    			t400 = space();
    			tr69 = element("tr");
    			t401 = space();
    			tr70 = element("tr");
    			th110 = element("th");
    			t402 = space();
    			th111 = element("th");
    			p16 = element("p");
    			p16.textContent = "Last updated April 23, 2020.";
    			attr_dev(th0, "class", "date svelte-1y3arww");
    			add_location(th0, file$9, 129, 8, 1843);
    			attr_dev(span0, "class", "color svelte-1y3arww");
    			add_location(span0, file$9, 132, 12, 1927);
    			attr_dev(span1, "class", "color red svelte-1y3arww");
    			add_location(span1, file$9, 133, 12, 1978);
    			attr_dev(span2, "class", "color svelte-1y3arww");
    			add_location(span2, file$9, 134, 12, 2026);
    			attr_dev(span3, "class", "color red svelte-1y3arww");
    			add_location(span3, file$9, 135, 12, 2077);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-1y3arww");
    			add_location(h3, file$9, 131, 10, 1900);
    			attr_dev(th1, "class", "intro svelte-1y3arww");
    			add_location(th1, file$9, 130, 8, 1871);
    			add_location(tr0, file$9, 128, 6, 1830);
    			attr_dev(th2, "class", "date svelte-1y3arww");
    			add_location(th2, file$9, 145, 8, 2245);
    			attr_dev(h40, "class", "header svelte-1y3arww");
    			add_location(h40, file$9, 147, 10, 2288);
    			attr_dev(th3, "class", "svelte-1y3arww");
    			add_location(th3, file$9, 146, 8, 2273);
    			add_location(tr1, file$9, 144, 6, 2232);
    			add_location(br0, file$9, 153, 10, 2430);
    			attr_dev(th4, "class", "date svelte-1y3arww");
    			add_location(th4, file$9, 151, 8, 2380);
    			attr_dev(h50, "class", "svelte-1y3arww");
    			add_location(h50, file$9, 157, 10, 2494);
    			attr_dev(h60, "class", "svelte-1y3arww");
    			add_location(h60, file$9, 158, 10, 2553);
    			attr_dev(th5, "class", "svelte-1y3arww");
    			add_location(th5, file$9, 156, 8, 2479);
    			attr_dev(tr2, "class", "item svelte-1y3arww");
    			add_location(tr2, file$9, 150, 6, 2354);
    			attr_dev(tr3, "class", "buffer svelte-1y3arww");
    			add_location(tr3, file$9, 161, 6, 2621);
    			add_location(br1, file$9, 165, 10, 2725);
    			attr_dev(th6, "class", "date svelte-1y3arww");
    			add_location(th6, file$9, 163, 8, 2675);
    			attr_dev(h51, "class", "svelte-1y3arww");
    			add_location(h51, file$9, 169, 10, 2790);
    			attr_dev(h61, "class", "svelte-1y3arww");
    			add_location(h61, file$9, 170, 10, 2834);
    			add_location(br2, file$9, 173, 12, 2981);
    			attr_dev(p0, "class", "desc svelte-1y3arww");
    			add_location(p0, file$9, 171, 10, 2885);
    			attr_dev(th7, "class", "svelte-1y3arww");
    			add_location(th7, file$9, 168, 8, 2775);
    			attr_dev(tr4, "class", "item svelte-1y3arww");
    			add_location(tr4, file$9, 162, 6, 2649);
    			attr_dev(th8, "class", "date svelte-1y3arww");
    			add_location(th8, file$9, 179, 8, 3093);
    			attr_dev(h62, "class", "svelte-1y3arww");
    			add_location(h62, file$9, 181, 10, 3148);
    			attr_dev(p1, "class", "desc svelte-1y3arww");
    			add_location(p1, file$9, 182, 10, 3195);
    			attr_dev(th9, "class", "svelte-1y3arww");
    			add_location(th9, file$9, 180, 8, 3133);
    			attr_dev(tr5, "class", "item svelte-1y3arww");
    			add_location(tr5, file$9, 178, 6, 3067);
    			attr_dev(th10, "class", "date svelte-1y3arww");
    			add_location(th10, file$9, 189, 8, 3372);
    			attr_dev(h41, "class", "header svelte-1y3arww");
    			add_location(h41, file$9, 191, 10, 3415);
    			attr_dev(th11, "class", "svelte-1y3arww");
    			add_location(th11, file$9, 190, 8, 3400);
    			add_location(tr6, file$9, 188, 6, 3359);
    			attr_dev(th12, "class", "date svelte-1y3arww");
    			add_location(th12, file$9, 195, 8, 3520);
    			attr_dev(h52, "class", "svelte-1y3arww");
    			add_location(h52, file$9, 197, 10, 3574);
    			attr_dev(p2, "class", "desc svelte-1y3arww");
    			add_location(p2, file$9, 200, 10, 3685);
    			attr_dev(i0, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i0, file$9, 207, 16, 3962);
    			add_location(button0, file$9, 206, 14, 3937);
    			attr_dev(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 205, 12, 3887);
    			attr_dev(div0, "class", "tags");
    			add_location(div0, file$9, 204, 10, 3856);
    			attr_dev(th13, "class", "svelte-1y3arww");
    			add_location(th13, file$9, 196, 8, 3559);
    			attr_dev(tr7, "class", "item svelte-1y3arww");
    			add_location(tr7, file$9, 194, 6, 3494);
    			attr_dev(tr8, "class", "buffer svelte-1y3arww");
    			add_location(tr8, file$9, 214, 6, 4103);
    			attr_dev(th14, "class", "date svelte-1y3arww");
    			add_location(th14, file$9, 216, 8, 4157);
    			attr_dev(h53, "class", "svelte-1y3arww");
    			add_location(h53, file$9, 218, 10, 4211);
    			attr_dev(p3, "class", "desc svelte-1y3arww");
    			add_location(p3, file$9, 219, 10, 4265);
    			attr_dev(i1, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i1, file$9, 227, 16, 4646);
    			add_location(button1, file$9, 226, 14, 4621);
    			attr_dev(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 224, 12, 4464);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file$9, 223, 10, 4433);
    			attr_dev(th15, "class", "svelte-1y3arww");
    			add_location(th15, file$9, 217, 8, 4196);
    			attr_dev(tr9, "class", "item svelte-1y3arww");
    			add_location(tr9, file$9, 215, 6, 4131);
    			attr_dev(tr10, "class", "buffer svelte-1y3arww");
    			add_location(tr10, file$9, 234, 6, 4792);
    			add_location(br3, file$9, 238, 10, 4896);
    			attr_dev(th16, "class", "date svelte-1y3arww");
    			add_location(th16, file$9, 236, 8, 4846);
    			attr_dev(h54, "class", "svelte-1y3arww");
    			add_location(h54, file$9, 242, 10, 4961);
    			attr_dev(h63, "class", "svelte-1y3arww");
    			add_location(h63, file$9, 243, 10, 5007);
    			attr_dev(p4, "class", "desc svelte-1y3arww");
    			add_location(p4, file$9, 244, 10, 5083);
    			attr_dev(i2, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i2, file$9, 251, 16, 5365);
    			add_location(button2, file$9, 250, 14, 5340);
    			attr_dev(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 249, 12, 5286);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file$9, 248, 10, 5255);
    			attr_dev(th17, "class", "svelte-1y3arww");
    			add_location(th17, file$9, 241, 8, 4946);
    			attr_dev(tr11, "class", "item svelte-1y3arww");
    			add_location(tr11, file$9, 235, 6, 4820);
    			attr_dev(tr12, "class", "buffer svelte-1y3arww");
    			add_location(tr12, file$9, 258, 6, 5506);
    			attr_dev(th18, "class", "date svelte-1y3arww");
    			add_location(th18, file$9, 260, 8, 5560);
    			attr_dev(h55, "class", "svelte-1y3arww");
    			add_location(h55, file$9, 262, 10, 5622);
    			attr_dev(h64, "class", "svelte-1y3arww");
    			add_location(h64, file$9, 263, 10, 5664);
    			attr_dev(p5, "class", "desc svelte-1y3arww");
    			add_location(p5, file$9, 264, 10, 5722);
    			attr_dev(i3, "class", "far fa-newspaper svelte-1y3arww");
    			add_location(i3, file$9, 272, 16, 6073);
    			add_location(button3, file$9, 271, 14, 6048);
    			attr_dev(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 269, 12, 5905);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file$9, 268, 10, 5874);
    			attr_dev(th19, "class", "svelte-1y3arww");
    			add_location(th19, file$9, 261, 8, 5607);
    			attr_dev(tr13, "class", "item svelte-1y3arww");
    			add_location(tr13, file$9, 259, 6, 5534);
    			attr_dev(th20, "class", "date svelte-1y3arww");
    			add_location(th20, file$9, 281, 8, 6261);
    			attr_dev(h42, "class", "header svelte-1y3arww");
    			add_location(h42, file$9, 283, 10, 6304);
    			attr_dev(th21, "class", "svelte-1y3arww");
    			add_location(th21, file$9, 282, 8, 6289);
    			add_location(tr14, file$9, 280, 6, 6248);
    			add_location(br4, file$9, 289, 10, 6453);
    			attr_dev(th22, "class", "date svelte-1y3arww");
    			add_location(th22, file$9, 287, 8, 6406);
    			attr_dev(h56, "class", "svelte-1y3arww");
    			add_location(h56, file$9, 293, 10, 6521);
    			attr_dev(h65, "class", "svelte-1y3arww");
    			add_location(h65, file$9, 294, 10, 6547);
    			attr_dev(p6, "class", "desc svelte-1y3arww");
    			add_location(p6, file$9, 295, 10, 6594);
    			attr_dev(i4, "class", "far fa-newspaper svelte-1y3arww");
    			add_location(i4, file$9, 305, 16, 7020);
    			add_location(button4, file$9, 304, 14, 6995);
    			attr_dev(a4, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n              ");
    			add_location(a4, file$9, 301, 12, 6857);
    			add_location(button5, file$9, 309, 12, 7132);
    			add_location(button6, file$9, 310, 12, 7174);
    			add_location(button7, file$9, 311, 12, 7208);
    			add_location(button8, file$9, 312, 12, 7241);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file$9, 300, 10, 6826);
    			attr_dev(th23, "class", "svelte-1y3arww");
    			add_location(th23, file$9, 292, 8, 6506);
    			attr_dev(tr15, "class", "item svelte-1y3arww");
    			add_location(tr15, file$9, 286, 6, 6380);
    			attr_dev(tr16, "class", "buffer svelte-1y3arww");
    			add_location(tr16, file$9, 316, 6, 7324);
    			add_location(br5, file$9, 320, 10, 7425);
    			attr_dev(th24, "class", "date svelte-1y3arww");
    			add_location(th24, file$9, 318, 8, 7378);
    			attr_dev(h57, "class", "svelte-1y3arww");
    			add_location(h57, file$9, 324, 10, 7493);
    			attr_dev(h66, "class", "svelte-1y3arww");
    			add_location(h66, file$9, 325, 10, 7519);
    			attr_dev(p7, "class", "desc svelte-1y3arww");
    			add_location(p7, file$9, 326, 10, 7566);
    			add_location(button9, file$9, 331, 12, 7758);
    			add_location(button10, file$9, 332, 12, 7814);
    			add_location(button11, file$9, 333, 12, 7848);
    			add_location(button12, file$9, 334, 12, 7881);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file$9, 330, 10, 7727);
    			attr_dev(th25, "class", "svelte-1y3arww");
    			add_location(th25, file$9, 323, 8, 7478);
    			attr_dev(tr17, "class", "item svelte-1y3arww");
    			add_location(tr17, file$9, 317, 6, 7352);
    			attr_dev(tr18, "class", "buffer svelte-1y3arww");
    			add_location(tr18, file$9, 338, 6, 7951);
    			add_location(br6, file$9, 342, 10, 8052);
    			attr_dev(th26, "class", "date svelte-1y3arww");
    			add_location(th26, file$9, 340, 8, 8005);
    			attr_dev(h58, "class", "svelte-1y3arww");
    			add_location(h58, file$9, 346, 10, 8120);
    			attr_dev(h67, "class", "svelte-1y3arww");
    			add_location(h67, file$9, 347, 10, 8146);
    			attr_dev(p8, "class", "desc svelte-1y3arww");
    			add_location(p8, file$9, 348, 10, 8194);
    			add_location(button13, file$9, 353, 12, 8379);
    			add_location(button14, file$9, 354, 12, 8411);
    			add_location(button15, file$9, 355, 12, 8449);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file$9, 352, 10, 8348);
    			attr_dev(th27, "class", "svelte-1y3arww");
    			add_location(th27, file$9, 345, 8, 8105);
    			attr_dev(tr19, "class", "item svelte-1y3arww");
    			add_location(tr19, file$9, 339, 6, 7979);
    			attr_dev(th28, "class", "date svelte-1y3arww");
    			add_location(th28, file$9, 361, 8, 8563);
    			attr_dev(h43, "class", "header svelte-1y3arww");
    			add_location(h43, file$9, 363, 10, 8606);
    			attr_dev(th29, "class", "svelte-1y3arww");
    			add_location(th29, file$9, 362, 8, 8591);
    			add_location(tr20, file$9, 360, 6, 8550);
    			add_location(br7, file$9, 369, 10, 8758);
    			attr_dev(th30, "class", "date svelte-1y3arww");
    			add_location(th30, file$9, 367, 8, 8708);
    			attr_dev(h59, "class", "svelte-1y3arww");
    			add_location(h59, file$9, 373, 10, 8822);
    			attr_dev(h68, "class", "svelte-1y3arww");
    			add_location(h68, file$9, 374, 10, 8901);
    			attr_dev(i5, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i5, file$9, 378, 16, 9050);
    			add_location(button16, file$9, 377, 14, 9025);
    			attr_dev(a5, "href", "https://dig.cmu.edu/");
    			add_location(a5, file$9, 376, 12, 8979);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file$9, 375, 10, 8948);
    			attr_dev(th31, "class", "svelte-1y3arww");
    			add_location(th31, file$9, 372, 8, 8807);
    			attr_dev(tr21, "class", "item svelte-1y3arww");
    			add_location(tr21, file$9, 366, 6, 8682);
    			attr_dev(tr22, "class", "buffer svelte-1y3arww");
    			add_location(tr22, file$9, 385, 6, 9210);
    			add_location(br8, file$9, 389, 10, 9315);
    			attr_dev(th32, "class", "date svelte-1y3arww");
    			add_location(th32, file$9, 387, 8, 9264);
    			attr_dev(h510, "class", "svelte-1y3arww");
    			add_location(h510, file$9, 393, 10, 9380);
    			attr_dev(h69, "class", "svelte-1y3arww");
    			add_location(h69, file$9, 394, 10, 9425);
    			attr_dev(i6, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i6, file$9, 398, 16, 9586);
    			add_location(button17, file$9, 397, 14, 9561);
    			attr_dev(a6, "href", "https://poloclub.github.io/");
    			add_location(a6, file$9, 396, 12, 9508);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file$9, 395, 10, 9477);
    			attr_dev(th33, "class", "svelte-1y3arww");
    			add_location(th33, file$9, 392, 8, 9365);
    			attr_dev(tr23, "class", "item svelte-1y3arww");
    			add_location(tr23, file$9, 386, 6, 9238);
    			attr_dev(tr24, "class", "buffer svelte-1y3arww");
    			add_location(tr24, file$9, 405, 6, 9729);
    			add_location(br9, file$9, 409, 10, 9836);
    			attr_dev(th34, "class", "date svelte-1y3arww");
    			add_location(th34, file$9, 407, 8, 9783);
    			attr_dev(h511, "class", "svelte-1y3arww");
    			add_location(h511, file$9, 413, 10, 9901);
    			attr_dev(h610, "class", "svelte-1y3arww");
    			add_location(h610, file$9, 414, 10, 9937);
    			attr_dev(p9, "class", "desc svelte-1y3arww");
    			add_location(p9, file$9, 415, 10, 9992);
    			attr_dev(i7, "class", "fas fa-rocket svelte-1y3arww");
    			add_location(i7, file$9, 423, 16, 10343);
    			add_location(button18, file$9, 422, 14, 10318);
    			attr_dev(a7, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a7, file$9, 420, 12, 10189);
    			attr_dev(i8, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i8, file$9, 429, 16, 10526);
    			add_location(button19, file$9, 428, 14, 10501);
    			attr_dev(a8, "href", "http://prox-1.gatech.edu/");
    			add_location(a8, file$9, 427, 12, 10450);
    			attr_dev(i9, "class", "far fa-newspaper svelte-1y3arww");
    			add_location(i9, file$9, 436, 16, 10760);
    			add_location(button20, file$9, 435, 14, 10735);
    			attr_dev(a9, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a9, file$9, 433, 12, 10630);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file$9, 419, 10, 10158);
    			attr_dev(th35, "class", "svelte-1y3arww");
    			add_location(th35, file$9, 412, 8, 9886);
    			attr_dev(tr25, "class", "item svelte-1y3arww");
    			add_location(tr25, file$9, 406, 6, 9757);
    			attr_dev(th36, "class", "date svelte-1y3arww");
    			add_location(th36, file$9, 445, 8, 10952);
    			attr_dev(h44, "class", "header svelte-1y3arww");
    			add_location(h44, file$9, 447, 10, 10995);
    			attr_dev(th37, "class", "svelte-1y3arww");
    			add_location(th37, file$9, 446, 8, 10980);
    			add_location(tr26, file$9, 444, 6, 10939);
    			attr_dev(th38, "class", "date svelte-1y3arww");
    			add_location(th38, file$9, 475, 8, 11755);
    			attr_dev(h45, "class", "header svelte-1y3arww");
    			add_location(h45, file$9, 477, 10, 11798);
    			attr_dev(th39, "class", "svelte-1y3arww");
    			add_location(th39, file$9, 476, 8, 11783);
    			add_location(tr27, file$9, 474, 6, 11742);
    			attr_dev(th40, "class", "date svelte-1y3arww");
    			add_location(th40, file$9, 505, 8, 12576);
    			attr_dev(h46, "class", "header svelte-1y3arww");
    			add_location(h46, file$9, 507, 10, 12619);
    			attr_dev(th41, "class", "svelte-1y3arww");
    			add_location(th41, file$9, 506, 8, 12604);
    			add_location(tr28, file$9, 504, 6, 12563);
    			add_location(br10, file$9, 513, 10, 12758);
    			add_location(br11, file$9, 515, 10, 12797);
    			attr_dev(th42, "class", "date svelte-1y3arww");
    			add_location(th42, file$9, 511, 8, 12710);
    			attr_dev(h512, "class", "svelte-1y3arww");
    			add_location(h512, file$9, 519, 10, 12863);
    			attr_dev(h611, "class", "svelte-1y3arww");
    			add_location(h611, file$9, 520, 10, 12922);
    			attr_dev(p10, "class", "desc svelte-1y3arww");
    			add_location(p10, file$9, 521, 10, 12974);
    			attr_dev(th43, "class", "svelte-1y3arww");
    			add_location(th43, file$9, 518, 8, 12848);
    			attr_dev(tr29, "class", "item svelte-1y3arww");
    			add_location(tr29, file$9, 510, 6, 12684);
    			attr_dev(tr30, "class", "buffer svelte-1y3arww");
    			add_location(tr30, file$9, 527, 6, 13159);
    			attr_dev(th44, "class", "date svelte-1y3arww");
    			add_location(th44, file$9, 529, 8, 13213);
    			attr_dev(h513, "class", "svelte-1y3arww");
    			add_location(h513, file$9, 531, 10, 13268);
    			attr_dev(h612, "class", "svelte-1y3arww");
    			add_location(h612, file$9, 532, 10, 13316);
    			attr_dev(p11, "class", "desc svelte-1y3arww");
    			add_location(p11, file$9, 533, 10, 13347);
    			attr_dev(th45, "class", "svelte-1y3arww");
    			add_location(th45, file$9, 530, 8, 13253);
    			attr_dev(tr31, "class", "item svelte-1y3arww");
    			add_location(tr31, file$9, 528, 6, 13187);
    			attr_dev(th46, "class", "date svelte-1y3arww");
    			add_location(th46, file$9, 541, 8, 13564);
    			attr_dev(h47, "class", "header svelte-1y3arww");
    			add_location(h47, file$9, 543, 10, 13607);
    			attr_dev(th47, "class", "svelte-1y3arww");
    			add_location(th47, file$9, 542, 8, 13592);
    			add_location(tr32, file$9, 540, 6, 13551);
    			attr_dev(th48, "class", "date svelte-1y3arww");
    			add_location(th48, file$9, 547, 8, 13697);
    			attr_dev(h514, "class", "svelte-1y3arww");
    			add_location(h514, file$9, 549, 10, 13740);
    			attr_dev(th49, "class", "svelte-1y3arww");
    			add_location(th49, file$9, 548, 8, 13725);
    			attr_dev(tr33, "class", "item svelte-1y3arww");
    			add_location(tr33, file$9, 546, 6, 13671);
    			attr_dev(th50, "class", "date svelte-1y3arww");
    			add_location(th50, file$9, 553, 8, 13812);
    			attr_dev(h515, "class", "single svelte-1y3arww");
    			add_location(h515, file$9, 555, 10, 13870);
    			attr_dev(th51, "class", "svelte-1y3arww");
    			add_location(th51, file$9, 554, 8, 13855);
    			add_location(tr34, file$9, 552, 6, 13799);
    			attr_dev(th52, "class", "date svelte-1y3arww");
    			add_location(th52, file$9, 559, 8, 13975);
    			attr_dev(h516, "class", "single svelte-1y3arww");
    			add_location(h516, file$9, 561, 10, 14033);
    			attr_dev(th53, "class", "svelte-1y3arww");
    			add_location(th53, file$9, 560, 8, 14018);
    			add_location(tr35, file$9, 558, 6, 13962);
    			add_location(br12, file$9, 566, 6, 14167);
    			attr_dev(th54, "class", "date svelte-1y3arww");
    			add_location(th54, file$9, 568, 8, 14206);
    			attr_dev(h517, "class", "svelte-1y3arww");
    			add_location(h517, file$9, 570, 10, 14249);
    			attr_dev(th55, "class", "svelte-1y3arww");
    			add_location(th55, file$9, 569, 8, 14234);
    			attr_dev(tr36, "class", "item svelte-1y3arww");
    			add_location(tr36, file$9, 567, 6, 14180);
    			attr_dev(th56, "class", "date svelte-1y3arww");
    			add_location(th56, file$9, 574, 8, 14312);
    			attr_dev(h518, "class", "single svelte-1y3arww");
    			add_location(h518, file$9, 576, 10, 14362);
    			attr_dev(th57, "class", "svelte-1y3arww");
    			add_location(th57, file$9, 575, 8, 14347);
    			add_location(tr37, file$9, 573, 6, 14299);
    			attr_dev(th58, "class", "date svelte-1y3arww");
    			add_location(th58, file$9, 582, 8, 14519);
    			attr_dev(h519, "class", "single svelte-1y3arww");
    			add_location(h519, file$9, 584, 10, 14569);
    			attr_dev(th59, "class", "svelte-1y3arww");
    			add_location(th59, file$9, 583, 8, 14554);
    			add_location(tr38, file$9, 581, 6, 14506);
    			attr_dev(th60, "class", "date svelte-1y3arww");
    			add_location(th60, file$9, 591, 8, 14742);
    			attr_dev(h48, "class", "header svelte-1y3arww");
    			add_location(h48, file$9, 593, 10, 14785);
    			attr_dev(th61, "class", "svelte-1y3arww");
    			add_location(th61, file$9, 592, 8, 14770);
    			add_location(tr39, file$9, 590, 6, 14729);
    			attr_dev(th62, "class", "date svelte-1y3arww");
    			add_location(th62, file$9, 597, 8, 14860);
    			attr_dev(a10, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			add_location(a10, file$9, 600, 12, 14948);
    			add_location(i10, file$9, 606, 12, 15253);
    			attr_dev(h520, "class", "single press svelte-1y3arww");
    			add_location(h520, file$9, 599, 10, 14910);
    			attr_dev(th63, "class", "svelte-1y3arww");
    			add_location(th63, file$9, 598, 8, 14895);
    			add_location(tr40, file$9, 596, 6, 14847);
    			attr_dev(th64, "class", "date svelte-1y3arww");
    			add_location(th64, file$9, 611, 8, 15325);
    			attr_dev(a11, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			add_location(a11, file$9, 614, 12, 15413);
    			add_location(i11, file$9, 619, 12, 15646);
    			attr_dev(h521, "class", "single press svelte-1y3arww");
    			add_location(h521, file$9, 613, 10, 15375);
    			attr_dev(th65, "class", "svelte-1y3arww");
    			add_location(th65, file$9, 612, 8, 15360);
    			add_location(tr41, file$9, 610, 6, 15312);
    			attr_dev(th66, "class", "date svelte-1y3arww");
    			add_location(th66, file$9, 624, 8, 15720);
    			attr_dev(a12, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			add_location(a12, file$9, 627, 12, 15808);
    			add_location(i12, file$9, 632, 12, 16032);
    			attr_dev(h522, "class", "single press svelte-1y3arww");
    			add_location(h522, file$9, 626, 10, 15770);
    			attr_dev(th67, "class", "svelte-1y3arww");
    			add_location(th67, file$9, 625, 8, 15755);
    			add_location(tr42, file$9, 623, 6, 15707);
    			attr_dev(th68, "class", "date svelte-1y3arww");
    			add_location(th68, file$9, 637, 8, 16116);
    			attr_dev(a13, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			add_location(a13, file$9, 640, 12, 16204);
    			add_location(i13, file$9, 645, 12, 16417);
    			attr_dev(h523, "class", "single press svelte-1y3arww");
    			add_location(h523, file$9, 639, 10, 16166);
    			attr_dev(th69, "class", "svelte-1y3arww");
    			add_location(th69, file$9, 638, 8, 16151);
    			add_location(tr43, file$9, 636, 6, 16103);
    			attr_dev(th70, "class", "date svelte-1y3arww");
    			add_location(th70, file$9, 650, 8, 16506);
    			attr_dev(a14, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a14, file$9, 653, 12, 16594);
    			add_location(i14, file$9, 658, 12, 16849);
    			attr_dev(h524, "class", "single press svelte-1y3arww");
    			add_location(h524, file$9, 652, 10, 16556);
    			attr_dev(th71, "class", "svelte-1y3arww");
    			add_location(th71, file$9, 651, 8, 16541);
    			add_location(tr44, file$9, 649, 6, 16493);
    			attr_dev(th72, "class", "date svelte-1y3arww");
    			add_location(th72, file$9, 663, 8, 16924);
    			attr_dev(a15, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a15, file$9, 666, 12, 17012);
    			add_location(i15, file$9, 671, 12, 17243);
    			attr_dev(h525, "class", "single press svelte-1y3arww");
    			add_location(h525, file$9, 665, 10, 16974);
    			attr_dev(th73, "class", "svelte-1y3arww");
    			add_location(th73, file$9, 664, 8, 16959);
    			add_location(tr45, file$9, 662, 6, 16911);
    			attr_dev(th74, "class", "date svelte-1y3arww");
    			add_location(th74, file$9, 676, 8, 17324);
    			attr_dev(a16, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a16, file$9, 679, 12, 17412);
    			add_location(i16, file$9, 685, 12, 17686);
    			attr_dev(h526, "class", "single press svelte-1y3arww");
    			add_location(h526, file$9, 678, 10, 17374);
    			attr_dev(th75, "class", "svelte-1y3arww");
    			add_location(th75, file$9, 677, 8, 17359);
    			add_location(tr46, file$9, 675, 6, 17311);
    			attr_dev(th76, "class", "date svelte-1y3arww");
    			add_location(th76, file$9, 691, 8, 17785);
    			attr_dev(h49, "class", "header svelte-1y3arww");
    			add_location(h49, file$9, 693, 10, 17828);
    			attr_dev(th77, "class", "svelte-1y3arww");
    			add_location(th77, file$9, 692, 8, 17813);
    			add_location(tr47, file$9, 690, 6, 17772);
    			attr_dev(th78, "class", "date svelte-1y3arww");
    			add_location(th78, file$9, 697, 8, 17919);
    			attr_dev(h527, "class", "svelte-1y3arww");
    			add_location(h527, file$9, 699, 10, 17976);
    			attr_dev(p12, "class", "desc svelte-1y3arww");
    			add_location(p12, file$9, 700, 10, 18037);
    			attr_dev(i17, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i17, file$9, 707, 16, 18326);
    			add_location(button21, file$9, 706, 14, 18301);
    			attr_dev(a17, "href", "https://covidcast.cmu.edu/");
    			add_location(a17, file$9, 705, 12, 18249);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file$9, 704, 10, 18218);
    			attr_dev(th79, "class", "svelte-1y3arww");
    			add_location(th79, file$9, 698, 8, 17961);
    			attr_dev(tr48, "class", "item svelte-1y3arww");
    			add_location(tr48, file$9, 696, 6, 17893);
    			attr_dev(tr49, "class", "buffer svelte-1y3arww");
    			add_location(tr49, file$9, 714, 6, 18467);
    			attr_dev(th80, "class", "date svelte-1y3arww");
    			add_location(th80, file$9, 716, 8, 18521);
    			attr_dev(h528, "class", "svelte-1y3arww");
    			add_location(h528, file$9, 718, 10, 18576);
    			attr_dev(h613, "class", "svelte-1y3arww");
    			add_location(h613, file$9, 719, 10, 18629);
    			attr_dev(p13, "class", "desc svelte-1y3arww");
    			add_location(p13, file$9, 723, 10, 18760);
    			attr_dev(i18, "class", "fab fa-github svelte-1y3arww");
    			add_location(i18, file$9, 730, 16, 19046);
    			add_location(button22, file$9, 729, 14, 19021);
    			attr_dev(a18, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a18, file$9, 728, 12, 18948);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file$9, 727, 10, 18917);
    			attr_dev(th81, "class", "svelte-1y3arww");
    			add_location(th81, file$9, 717, 8, 18561);
    			attr_dev(tr50, "class", "item svelte-1y3arww");
    			add_location(tr50, file$9, 715, 6, 18495);
    			attr_dev(tr51, "class", "buffer svelte-1y3arww");
    			add_location(tr51, file$9, 737, 6, 19187);
    			attr_dev(th82, "class", "date svelte-1y3arww");
    			add_location(th82, file$9, 739, 8, 19241);
    			attr_dev(h529, "class", "svelte-1y3arww");
    			add_location(h529, file$9, 741, 10, 19298);
    			attr_dev(p14, "class", "desc svelte-1y3arww");
    			add_location(p14, file$9, 742, 10, 19350);
    			attr_dev(i19, "class", "fas fa-file-pdf svelte-1y3arww");
    			add_location(i19, file$9, 749, 16, 19608);
    			add_location(button23, file$9, 748, 14, 19583);
    			attr_dev(a19, "href", "./gt_bus_analysis.pdf");
    			add_location(a19, file$9, 747, 12, 19536);
    			attr_dev(i20, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i20, file$9, 755, 16, 19811);
    			add_location(button24, file$9, 754, 14, 19786);
    			attr_dev(a20, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a20, file$9, 753, 12, 19714);
    			attr_dev(div12, "class", "tags");
    			add_location(div12, file$9, 746, 10, 19505);
    			attr_dev(th83, "class", "svelte-1y3arww");
    			add_location(th83, file$9, 740, 8, 19283);
    			attr_dev(tr52, "class", "item svelte-1y3arww");
    			add_location(tr52, file$9, 738, 6, 19215);
    			attr_dev(tr53, "class", "buffer svelte-1y3arww");
    			add_location(tr53, file$9, 762, 6, 19950);
    			attr_dev(th84, "class", "date svelte-1y3arww");
    			add_location(th84, file$9, 764, 8, 20004);
    			attr_dev(h530, "class", "svelte-1y3arww");
    			add_location(h530, file$9, 766, 10, 20061);
    			attr_dev(p15, "class", "desc svelte-1y3arww");
    			add_location(p15, file$9, 767, 10, 20094);
    			attr_dev(i21, "class", "fas fa-globe svelte-1y3arww");
    			add_location(i21, file$9, 774, 16, 20367);
    			add_location(button25, file$9, 773, 14, 20342);
    			attr_dev(a21, "href", "http://ctfs.github.io/resources/");
    			add_location(a21, file$9, 772, 12, 20284);
    			attr_dev(i22, "class", "fab fa-github svelte-1y3arww");
    			add_location(i22, file$9, 780, 16, 20555);
    			add_location(button26, file$9, 779, 14, 20530);
    			attr_dev(a22, "href", "https://github.com/ctfs/resources");
    			add_location(a22, file$9, 778, 12, 20471);
    			attr_dev(div13, "class", "tags");
    			add_location(div13, file$9, 771, 10, 20253);
    			attr_dev(th85, "class", "svelte-1y3arww");
    			add_location(th85, file$9, 765, 8, 20046);
    			attr_dev(tr54, "class", "item svelte-1y3arww");
    			add_location(tr54, file$9, 763, 6, 19978);
    			attr_dev(th86, "class", "date svelte-1y3arww");
    			add_location(th86, file$9, 862, 8, 22858);
    			attr_dev(h410, "class", "header svelte-1y3arww");
    			add_location(h410, file$9, 864, 10, 22901);
    			attr_dev(th87, "class", "svelte-1y3arww");
    			add_location(th87, file$9, 863, 8, 22886);
    			add_location(tr55, file$9, 861, 6, 22845);
    			attr_dev(th88, "class", "date svelte-1y3arww");
    			add_location(th88, file$9, 868, 8, 23000);
    			attr_dev(h531, "class", "single svelte-1y3arww");
    			add_location(h531, file$9, 871, 12, 23138);
    			attr_dev(a23, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a23, file$9, 870, 10, 23057);
    			attr_dev(th89, "class", "svelte-1y3arww");
    			add_location(th89, file$9, 869, 8, 23042);
    			attr_dev(tr56, "class", "item svelte-1y3arww");
    			add_location(tr56, file$9, 867, 6, 22974);
    			attr_dev(th90, "class", "date svelte-1y3arww");
    			add_location(th90, file$9, 876, 8, 23260);
    			attr_dev(h532, "class", "single svelte-1y3arww");
    			add_location(h532, file$9, 879, 12, 23392);
    			attr_dev(a24, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a24, file$9, 878, 10, 23315);
    			attr_dev(th91, "class", "svelte-1y3arww");
    			add_location(th91, file$9, 877, 8, 23300);
    			attr_dev(tr57, "class", "item svelte-1y3arww");
    			add_location(tr57, file$9, 875, 6, 23234);
    			attr_dev(th92, "class", "date svelte-1y3arww");
    			add_location(th92, file$9, 884, 8, 23503);
    			attr_dev(h533, "class", "single svelte-1y3arww");
    			add_location(h533, file$9, 887, 12, 23629);
    			attr_dev(a25, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a25, file$9, 886, 10, 23560);
    			attr_dev(th93, "class", "svelte-1y3arww");
    			add_location(th93, file$9, 885, 8, 23545);
    			attr_dev(tr58, "class", "item svelte-1y3arww");
    			add_location(tr58, file$9, 883, 6, 23477);
    			attr_dev(th94, "class", "date svelte-1y3arww");
    			add_location(th94, file$9, 892, 8, 23752);
    			attr_dev(h534, "class", "single svelte-1y3arww");
    			add_location(h534, file$9, 894, 10, 23807);
    			attr_dev(th95, "class", "svelte-1y3arww");
    			add_location(th95, file$9, 893, 8, 23792);
    			attr_dev(tr59, "class", "item svelte-1y3arww");
    			add_location(tr59, file$9, 891, 6, 23726);
    			attr_dev(th96, "class", "date svelte-1y3arww");
    			add_location(th96, file$9, 898, 8, 23907);
    			attr_dev(h535, "class", "single svelte-1y3arww");
    			add_location(h535, file$9, 901, 12, 24041);
    			attr_dev(a26, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a26, file$9, 900, 10, 23964);
    			attr_dev(th97, "class", "svelte-1y3arww");
    			add_location(th97, file$9, 899, 8, 23949);
    			attr_dev(tr60, "class", "item svelte-1y3arww");
    			add_location(tr60, file$9, 897, 6, 23881);
    			attr_dev(th98, "class", "date svelte-1y3arww");
    			add_location(th98, file$9, 906, 8, 24155);
    			attr_dev(h536, "class", "single svelte-1y3arww");
    			add_location(h536, file$9, 909, 12, 24266);
    			attr_dev(a27, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a27, file$9, 908, 10, 24212);
    			attr_dev(th99, "class", "svelte-1y3arww");
    			add_location(th99, file$9, 907, 8, 24197);
    			attr_dev(tr61, "class", "item svelte-1y3arww");
    			add_location(tr61, file$9, 905, 6, 24129);
    			attr_dev(th100, "class", "date svelte-1y3arww");
    			add_location(th100, file$9, 914, 8, 24383);
    			attr_dev(h537, "class", "single svelte-1y3arww");
    			add_location(h537, file$9, 916, 10, 24440);
    			attr_dev(th101, "class", "svelte-1y3arww");
    			add_location(th101, file$9, 915, 8, 24425);
    			attr_dev(tr62, "class", "item svelte-1y3arww");
    			add_location(tr62, file$9, 913, 6, 24357);
    			attr_dev(th102, "class", "date svelte-1y3arww");
    			add_location(th102, file$9, 921, 8, 24549);
    			attr_dev(h411, "class", "header svelte-1y3arww");
    			add_location(h411, file$9, 923, 10, 24592);
    			attr_dev(th103, "class", "svelte-1y3arww");
    			add_location(th103, file$9, 922, 8, 24577);
    			add_location(tr63, file$9, 920, 6, 24536);
    			attr_dev(th104, "class", "date svelte-1y3arww");
    			add_location(th104, file$9, 927, 8, 24681);
    			attr_dev(h538, "class", "svelte-1y3arww");
    			add_location(h538, file$9, 929, 10, 24724);
    			add_location(button27, file$9, 931, 12, 24784);
    			add_location(button28, file$9, 932, 12, 24830);
    			add_location(button29, file$9, 933, 12, 24876);
    			attr_dev(div14, "class", "tags");
    			add_location(div14, file$9, 930, 10, 24753);
    			attr_dev(th105, "class", "svelte-1y3arww");
    			add_location(th105, file$9, 928, 8, 24709);
    			attr_dev(tr64, "class", "item svelte-1y3arww");
    			add_location(tr64, file$9, 926, 6, 24655);
    			attr_dev(tr65, "class", "buffer svelte-1y3arww");
    			add_location(tr65, file$9, 937, 6, 24971);
    			attr_dev(th106, "class", "date svelte-1y3arww");
    			add_location(th106, file$9, 939, 8, 25025);
    			attr_dev(h539, "class", "svelte-1y3arww");
    			add_location(h539, file$9, 941, 10, 25068);
    			add_location(button30, file$9, 943, 12, 25140);
    			add_location(button31, file$9, 944, 12, 25174);
    			add_location(button32, file$9, 945, 12, 25214);
    			add_location(button33, file$9, 946, 12, 25250);
    			add_location(button34, file$9, 947, 12, 25285);
    			add_location(button35, file$9, 948, 12, 25318);
    			attr_dev(div15, "class", "tags");
    			add_location(div15, file$9, 942, 10, 25109);
    			attr_dev(th107, "class", "svelte-1y3arww");
    			add_location(th107, file$9, 940, 8, 25053);
    			attr_dev(tr66, "class", "item svelte-1y3arww");
    			add_location(tr66, file$9, 938, 6, 24999);
    			attr_dev(tr67, "class", "buffer svelte-1y3arww");
    			add_location(tr67, file$9, 952, 6, 25387);
    			attr_dev(th108, "class", "date svelte-1y3arww");
    			add_location(th108, file$9, 954, 8, 25441);
    			attr_dev(h540, "class", "svelte-1y3arww");
    			add_location(h540, file$9, 956, 10, 25484);
    			add_location(button36, file$9, 958, 12, 25547);
    			add_location(button37, file$9, 959, 12, 25593);
    			add_location(button38, file$9, 960, 12, 25645);
    			add_location(button39, file$9, 961, 12, 25680);
    			add_location(button40, file$9, 962, 12, 25716);
    			add_location(button41, file$9, 963, 12, 25750);
    			add_location(button42, file$9, 964, 12, 25782);
    			add_location(button43, file$9, 965, 12, 25819);
    			add_location(button44, file$9, 966, 12, 25873);
    			attr_dev(div16, "class", "tags");
    			add_location(div16, file$9, 957, 10, 25516);
    			attr_dev(th109, "class", "svelte-1y3arww");
    			add_location(th109, file$9, 955, 8, 25469);
    			attr_dev(tr68, "class", "item svelte-1y3arww");
    			add_location(tr68, file$9, 953, 6, 25415);
    			attr_dev(tr69, "class", "buffer svelte-1y3arww");
    			add_location(tr69, file$9, 970, 6, 25962);
    			attr_dev(th110, "class", "date svelte-1y3arww");
    			add_location(th110, file$9, 972, 8, 26016);
    			attr_dev(p16, "class", "desc svelte-1y3arww");
    			add_location(p16, file$9, 974, 10, 26059);
    			attr_dev(th111, "class", "svelte-1y3arww");
    			add_location(th111, file$9, 973, 8, 26044);
    			attr_dev(tr70, "class", "item svelte-1y3arww");
    			add_location(tr70, file$9, 971, 6, 25990);
    			attr_dev(table, "class", "svelte-1y3arww");
    			add_location(table, file$9, 127, 4, 1816);
    			attr_dev(main, "class", "svelte-1y3arww");
    			add_location(main, file$9, 126, 2, 1805);
    			attr_dev(div17, "id", "container");
    			attr_dev(div17, "class", "svelte-1y3arww");
    			add_location(div17, file$9, 125, 0, 1782);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div17, anchor);
    			append_dev(div17, main);
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
    			append_dev(p0, t29);
    			append_dev(p0, br2);
    			append_dev(p0, t30);
    			append_dev(table, t31);
    			append_dev(table, tr5);
    			append_dev(tr5, th8);
    			append_dev(tr5, t33);
    			append_dev(tr5, th9);
    			append_dev(th9, h62);
    			append_dev(th9, t35);
    			append_dev(th9, p1);
    			append_dev(table, t37);
    			append_dev(table, tr6);
    			append_dev(tr6, th10);
    			append_dev(tr6, t38);
    			append_dev(tr6, th11);
    			append_dev(th11, h41);
    			append_dev(table, t40);
    			append_dev(table, tr7);
    			append_dev(tr7, th12);
    			append_dev(tr7, t42);
    			append_dev(tr7, th13);
    			append_dev(th13, h52);
    			append_dev(th13, t44);
    			append_dev(th13, p2);
    			append_dev(th13, t46);
    			append_dev(th13, div0);
    			append_dev(div0, a0);
    			append_dev(a0, button0);
    			append_dev(button0, i0);
    			append_dev(button0, t47);
    			append_dev(table, t48);
    			append_dev(table, tr8);
    			append_dev(table, t49);
    			append_dev(table, tr9);
    			append_dev(tr9, th14);
    			append_dev(tr9, t51);
    			append_dev(tr9, th15);
    			append_dev(th15, h53);
    			append_dev(th15, t53);
    			append_dev(th15, p3);
    			append_dev(th15, t55);
    			append_dev(th15, div1);
    			append_dev(div1, a1);
    			append_dev(a1, button1);
    			append_dev(button1, i1);
    			append_dev(button1, t56);
    			append_dev(table, t57);
    			append_dev(table, tr10);
    			append_dev(table, t58);
    			append_dev(table, tr11);
    			append_dev(tr11, th16);
    			append_dev(th16, t59);
    			append_dev(th16, br3);
    			append_dev(th16, t60);
    			append_dev(tr11, t61);
    			append_dev(tr11, th17);
    			append_dev(th17, h54);
    			append_dev(th17, t63);
    			append_dev(th17, h63);
    			append_dev(th17, t65);
    			append_dev(th17, p4);
    			append_dev(th17, t67);
    			append_dev(th17, div2);
    			append_dev(div2, a2);
    			append_dev(a2, button2);
    			append_dev(button2, i2);
    			append_dev(button2, t68);
    			append_dev(table, t69);
    			append_dev(table, tr12);
    			append_dev(table, t70);
    			append_dev(table, tr13);
    			append_dev(tr13, th18);
    			append_dev(tr13, t72);
    			append_dev(tr13, th19);
    			append_dev(th19, h55);
    			append_dev(th19, t74);
    			append_dev(th19, h64);
    			append_dev(th19, t76);
    			append_dev(th19, p5);
    			append_dev(th19, t78);
    			append_dev(th19, div3);
    			append_dev(div3, a3);
    			append_dev(a3, button3);
    			append_dev(button3, i3);
    			append_dev(button3, t79);
    			append_dev(table, t80);
    			append_dev(table, tr14);
    			append_dev(tr14, th20);
    			append_dev(tr14, t81);
    			append_dev(tr14, th21);
    			append_dev(th21, h42);
    			append_dev(table, t83);
    			append_dev(table, tr15);
    			append_dev(tr15, th22);
    			append_dev(th22, t84);
    			append_dev(th22, br4);
    			append_dev(th22, t85);
    			append_dev(tr15, t86);
    			append_dev(tr15, th23);
    			append_dev(th23, h56);
    			append_dev(th23, t88);
    			append_dev(th23, h65);
    			append_dev(th23, t90);
    			append_dev(th23, p6);
    			append_dev(th23, t92);
    			append_dev(th23, div4);
    			append_dev(div4, a4);
    			append_dev(a4, button4);
    			append_dev(button4, i4);
    			append_dev(button4, t93);
    			append_dev(div4, t94);
    			append_dev(div4, button5);
    			append_dev(div4, t96);
    			append_dev(div4, button6);
    			append_dev(div4, t98);
    			append_dev(div4, button7);
    			append_dev(div4, t100);
    			append_dev(div4, button8);
    			append_dev(table, t102);
    			append_dev(table, tr16);
    			append_dev(table, t103);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(th24, t104);
    			append_dev(th24, br5);
    			append_dev(th24, t105);
    			append_dev(tr17, t106);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t108);
    			append_dev(th25, h66);
    			append_dev(th25, t110);
    			append_dev(th25, p7);
    			append_dev(th25, t112);
    			append_dev(th25, div5);
    			append_dev(div5, button9);
    			append_dev(div5, t114);
    			append_dev(div5, button10);
    			append_dev(div5, t116);
    			append_dev(div5, button11);
    			append_dev(div5, t118);
    			append_dev(div5, button12);
    			append_dev(table, t120);
    			append_dev(table, tr18);
    			append_dev(table, t121);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(th26, t122);
    			append_dev(th26, br6);
    			append_dev(th26, t123);
    			append_dev(tr19, t124);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t126);
    			append_dev(th27, h67);
    			append_dev(th27, t128);
    			append_dev(th27, p8);
    			append_dev(th27, t130);
    			append_dev(th27, div6);
    			append_dev(div6, button13);
    			append_dev(div6, t132);
    			append_dev(div6, button14);
    			append_dev(div6, t134);
    			append_dev(div6, button15);
    			append_dev(table, t136);
    			append_dev(table, tr20);
    			append_dev(tr20, th28);
    			append_dev(tr20, t137);
    			append_dev(tr20, th29);
    			append_dev(th29, h43);
    			append_dev(table, t139);
    			append_dev(table, tr21);
    			append_dev(tr21, th30);
    			append_dev(th30, t140);
    			append_dev(th30, br7);
    			append_dev(th30, t141);
    			append_dev(tr21, t142);
    			append_dev(tr21, th31);
    			append_dev(th31, h59);
    			append_dev(th31, t144);
    			append_dev(th31, h68);
    			append_dev(th31, t146);
    			append_dev(th31, div7);
    			append_dev(div7, a5);
    			append_dev(a5, button16);
    			append_dev(button16, i5);
    			append_dev(button16, t147);
    			append_dev(table, t148);
    			append_dev(table, tr22);
    			append_dev(table, t149);
    			append_dev(table, tr23);
    			append_dev(tr23, th32);
    			append_dev(th32, t150);
    			append_dev(th32, br8);
    			append_dev(th32, t151);
    			append_dev(tr23, t152);
    			append_dev(tr23, th33);
    			append_dev(th33, h510);
    			append_dev(th33, t154);
    			append_dev(th33, h69);
    			append_dev(th33, t156);
    			append_dev(th33, div8);
    			append_dev(div8, a6);
    			append_dev(a6, button17);
    			append_dev(button17, i6);
    			append_dev(button17, t157);
    			append_dev(table, t158);
    			append_dev(table, tr24);
    			append_dev(table, t159);
    			append_dev(table, tr25);
    			append_dev(tr25, th34);
    			append_dev(th34, t160);
    			append_dev(th34, br9);
    			append_dev(th34, t161);
    			append_dev(tr25, t162);
    			append_dev(tr25, th35);
    			append_dev(th35, h511);
    			append_dev(th35, t164);
    			append_dev(th35, h610);
    			append_dev(th35, t166);
    			append_dev(th35, p9);
    			append_dev(th35, t168);
    			append_dev(th35, div9);
    			append_dev(div9, a7);
    			append_dev(a7, button18);
    			append_dev(button18, i7);
    			append_dev(button18, t169);
    			append_dev(div9, t170);
    			append_dev(div9, a8);
    			append_dev(a8, button19);
    			append_dev(button19, i8);
    			append_dev(button19, t171);
    			append_dev(div9, t172);
    			append_dev(div9, a9);
    			append_dev(a9, button20);
    			append_dev(button20, i9);
    			append_dev(button20, t173);
    			append_dev(table, t174);
    			append_dev(table, tr26);
    			append_dev(tr26, th36);
    			append_dev(tr26, t175);
    			append_dev(tr26, th37);
    			append_dev(th37, h44);
    			append_dev(table, t177);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(table, null);
    			}

    			append_dev(table, t178);
    			append_dev(table, tr27);
    			append_dev(tr27, th38);
    			append_dev(tr27, t179);
    			append_dev(tr27, th39);
    			append_dev(th39, h45);
    			append_dev(table, t181);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t182);
    			append_dev(table, tr28);
    			append_dev(tr28, th40);
    			append_dev(tr28, t183);
    			append_dev(tr28, th41);
    			append_dev(th41, h46);
    			append_dev(table, t185);
    			append_dev(table, tr29);
    			append_dev(tr29, th42);
    			append_dev(th42, t186);
    			append_dev(th42, br10);
    			append_dev(th42, t187);
    			append_dev(th42, br11);
    			append_dev(th42, t188);
    			append_dev(tr29, t189);
    			append_dev(tr29, th43);
    			append_dev(th43, h512);
    			append_dev(th43, t191);
    			append_dev(th43, h611);
    			append_dev(th43, t193);
    			append_dev(th43, p10);
    			append_dev(table, t195);
    			append_dev(table, tr30);
    			append_dev(table, t196);
    			append_dev(table, tr31);
    			append_dev(tr31, th44);
    			append_dev(tr31, t198);
    			append_dev(tr31, th45);
    			append_dev(th45, h513);
    			append_dev(th45, t200);
    			append_dev(th45, h612);
    			append_dev(th45, t202);
    			append_dev(th45, p11);
    			append_dev(table, t204);
    			append_dev(table, tr32);
    			append_dev(tr32, th46);
    			append_dev(tr32, t205);
    			append_dev(tr32, th47);
    			append_dev(th47, h47);
    			append_dev(table, t207);
    			append_dev(table, tr33);
    			append_dev(tr33, th48);
    			append_dev(tr33, t208);
    			append_dev(tr33, th49);
    			append_dev(th49, h514);
    			append_dev(table, t210);
    			append_dev(table, tr34);
    			append_dev(tr34, th50);
    			append_dev(tr34, t212);
    			append_dev(tr34, th51);
    			append_dev(th51, h515);
    			append_dev(table, t214);
    			append_dev(table, tr35);
    			append_dev(tr35, th52);
    			append_dev(tr35, t216);
    			append_dev(tr35, th53);
    			append_dev(th53, h516);
    			append_dev(table, t218);
    			append_dev(table, br12);
    			append_dev(table, t219);
    			append_dev(table, tr36);
    			append_dev(tr36, th54);
    			append_dev(tr36, t220);
    			append_dev(tr36, th55);
    			append_dev(th55, h517);
    			append_dev(table, t222);
    			append_dev(table, tr37);
    			append_dev(tr37, th56);
    			append_dev(tr37, t224);
    			append_dev(tr37, th57);
    			append_dev(th57, h518);
    			append_dev(table, t226);
    			append_dev(table, tr38);
    			append_dev(tr38, th58);
    			append_dev(tr38, t228);
    			append_dev(tr38, th59);
    			append_dev(th59, h519);
    			append_dev(table, t230);
    			append_dev(table, tr39);
    			append_dev(tr39, th60);
    			append_dev(tr39, t231);
    			append_dev(tr39, th61);
    			append_dev(th61, h48);
    			append_dev(table, t233);
    			append_dev(table, tr40);
    			append_dev(tr40, th62);
    			append_dev(tr40, t235);
    			append_dev(tr40, th63);
    			append_dev(th63, h520);
    			append_dev(h520, a10);
    			append_dev(h520, t237);
    			append_dev(h520, i10);
    			append_dev(table, t239);
    			append_dev(table, tr41);
    			append_dev(tr41, th64);
    			append_dev(tr41, t241);
    			append_dev(tr41, th65);
    			append_dev(th65, h521);
    			append_dev(h521, a11);
    			append_dev(h521, t243);
    			append_dev(h521, i11);
    			append_dev(table, t245);
    			append_dev(table, tr42);
    			append_dev(tr42, th66);
    			append_dev(tr42, t247);
    			append_dev(tr42, th67);
    			append_dev(th67, h522);
    			append_dev(h522, a12);
    			append_dev(h522, t249);
    			append_dev(h522, i12);
    			append_dev(table, t251);
    			append_dev(table, tr43);
    			append_dev(tr43, th68);
    			append_dev(tr43, t253);
    			append_dev(tr43, th69);
    			append_dev(th69, h523);
    			append_dev(h523, a13);
    			append_dev(h523, t255);
    			append_dev(h523, i13);
    			append_dev(table, t257);
    			append_dev(table, tr44);
    			append_dev(tr44, th70);
    			append_dev(tr44, t259);
    			append_dev(tr44, th71);
    			append_dev(th71, h524);
    			append_dev(h524, a14);
    			append_dev(h524, t261);
    			append_dev(h524, i14);
    			append_dev(table, t263);
    			append_dev(table, tr45);
    			append_dev(tr45, th72);
    			append_dev(tr45, t265);
    			append_dev(tr45, th73);
    			append_dev(th73, h525);
    			append_dev(h525, a15);
    			append_dev(h525, t267);
    			append_dev(h525, i15);
    			append_dev(table, t269);
    			append_dev(table, tr46);
    			append_dev(tr46, th74);
    			append_dev(tr46, t271);
    			append_dev(tr46, th75);
    			append_dev(th75, h526);
    			append_dev(h526, a16);
    			append_dev(h526, t273);
    			append_dev(h526, i16);
    			append_dev(table, t275);
    			append_dev(table, tr47);
    			append_dev(tr47, th76);
    			append_dev(tr47, t276);
    			append_dev(tr47, th77);
    			append_dev(th77, h49);
    			append_dev(table, t278);
    			append_dev(table, tr48);
    			append_dev(tr48, th78);
    			append_dev(tr48, t280);
    			append_dev(tr48, th79);
    			append_dev(th79, h527);
    			append_dev(th79, t282);
    			append_dev(th79, p12);
    			append_dev(th79, t284);
    			append_dev(th79, div10);
    			append_dev(div10, a17);
    			append_dev(a17, button21);
    			append_dev(button21, i17);
    			append_dev(button21, t285);
    			append_dev(table, t286);
    			append_dev(table, tr49);
    			append_dev(table, t287);
    			append_dev(table, tr50);
    			append_dev(tr50, th80);
    			append_dev(tr50, t289);
    			append_dev(tr50, th81);
    			append_dev(th81, h528);
    			append_dev(th81, t291);
    			append_dev(th81, h613);
    			append_dev(th81, t293);
    			append_dev(th81, p13);
    			append_dev(th81, t295);
    			append_dev(th81, div11);
    			append_dev(div11, a18);
    			append_dev(a18, button22);
    			append_dev(button22, i18);
    			append_dev(button22, t296);
    			append_dev(table, t297);
    			append_dev(table, tr51);
    			append_dev(table, t298);
    			append_dev(table, tr52);
    			append_dev(tr52, th82);
    			append_dev(tr52, t300);
    			append_dev(tr52, th83);
    			append_dev(th83, h529);
    			append_dev(th83, t302);
    			append_dev(th83, p14);
    			append_dev(th83, t304);
    			append_dev(th83, div12);
    			append_dev(div12, a19);
    			append_dev(a19, button23);
    			append_dev(button23, i19);
    			append_dev(button23, t305);
    			append_dev(div12, t306);
    			append_dev(div12, a20);
    			append_dev(a20, button24);
    			append_dev(button24, i20);
    			append_dev(button24, t307);
    			append_dev(table, t308);
    			append_dev(table, tr53);
    			append_dev(table, t309);
    			append_dev(table, tr54);
    			append_dev(tr54, th84);
    			append_dev(tr54, t311);
    			append_dev(tr54, th85);
    			append_dev(th85, h530);
    			append_dev(th85, t313);
    			append_dev(th85, p15);
    			append_dev(th85, t315);
    			append_dev(th85, div13);
    			append_dev(div13, a21);
    			append_dev(a21, button25);
    			append_dev(button25, i21);
    			append_dev(button25, t316);
    			append_dev(div13, t317);
    			append_dev(div13, a22);
    			append_dev(a22, button26);
    			append_dev(button26, i22);
    			append_dev(button26, t318);
    			append_dev(table, t319);
    			append_dev(table, tr55);
    			append_dev(tr55, th86);
    			append_dev(tr55, t320);
    			append_dev(tr55, th87);
    			append_dev(th87, h410);
    			append_dev(table, t322);
    			append_dev(table, tr56);
    			append_dev(tr56, th88);
    			append_dev(tr56, t324);
    			append_dev(tr56, th89);
    			append_dev(th89, a23);
    			append_dev(a23, h531);
    			append_dev(table, t326);
    			append_dev(table, tr57);
    			append_dev(tr57, th90);
    			append_dev(tr57, t328);
    			append_dev(tr57, th91);
    			append_dev(th91, a24);
    			append_dev(a24, h532);
    			append_dev(table, t330);
    			append_dev(table, tr58);
    			append_dev(tr58, th92);
    			append_dev(tr58, t332);
    			append_dev(tr58, th93);
    			append_dev(th93, a25);
    			append_dev(a25, h533);
    			append_dev(table, t334);
    			append_dev(table, tr59);
    			append_dev(tr59, th94);
    			append_dev(tr59, t336);
    			append_dev(tr59, th95);
    			append_dev(th95, h534);
    			append_dev(table, t338);
    			append_dev(table, tr60);
    			append_dev(tr60, th96);
    			append_dev(tr60, t340);
    			append_dev(tr60, th97);
    			append_dev(th97, a26);
    			append_dev(a26, h535);
    			append_dev(table, t342);
    			append_dev(table, tr61);
    			append_dev(tr61, th98);
    			append_dev(tr61, t344);
    			append_dev(tr61, th99);
    			append_dev(th99, a27);
    			append_dev(a27, h536);
    			append_dev(table, t346);
    			append_dev(table, tr62);
    			append_dev(tr62, th100);
    			append_dev(tr62, t348);
    			append_dev(tr62, th101);
    			append_dev(th101, h537);
    			append_dev(table, t350);
    			append_dev(table, tr63);
    			append_dev(tr63, th102);
    			append_dev(tr63, t351);
    			append_dev(tr63, th103);
    			append_dev(th103, h411);
    			append_dev(table, t353);
    			append_dev(table, tr64);
    			append_dev(tr64, th104);
    			append_dev(tr64, t354);
    			append_dev(tr64, th105);
    			append_dev(th105, h538);
    			append_dev(th105, t356);
    			append_dev(th105, div14);
    			append_dev(div14, button27);
    			append_dev(div14, t358);
    			append_dev(div14, button28);
    			append_dev(div14, t360);
    			append_dev(div14, button29);
    			append_dev(table, t362);
    			append_dev(table, tr65);
    			append_dev(table, t363);
    			append_dev(table, tr66);
    			append_dev(tr66, th106);
    			append_dev(tr66, t364);
    			append_dev(tr66, th107);
    			append_dev(th107, h539);
    			append_dev(th107, t366);
    			append_dev(th107, div15);
    			append_dev(div15, button30);
    			append_dev(div15, t368);
    			append_dev(div15, button31);
    			append_dev(div15, t370);
    			append_dev(div15, button32);
    			append_dev(div15, t372);
    			append_dev(div15, button33);
    			append_dev(div15, t374);
    			append_dev(div15, button34);
    			append_dev(div15, t376);
    			append_dev(div15, button35);
    			append_dev(table, t378);
    			append_dev(table, tr67);
    			append_dev(table, t379);
    			append_dev(table, tr68);
    			append_dev(tr68, th108);
    			append_dev(tr68, t380);
    			append_dev(tr68, th109);
    			append_dev(th109, h540);
    			append_dev(th109, t382);
    			append_dev(th109, div16);
    			append_dev(div16, button36);
    			append_dev(div16, t384);
    			append_dev(div16, button37);
    			append_dev(div16, t386);
    			append_dev(div16, button38);
    			append_dev(div16, t388);
    			append_dev(div16, button39);
    			append_dev(div16, t390);
    			append_dev(div16, button40);
    			append_dev(div16, t392);
    			append_dev(div16, button41);
    			append_dev(div16, t394);
    			append_dev(div16, button42);
    			append_dev(div16, t396);
    			append_dev(div16, button43);
    			append_dev(div16, t398);
    			append_dev(div16, button44);
    			append_dev(table, t400);
    			append_dev(table, tr69);
    			append_dev(table, t401);
    			append_dev(table, tr70);
    			append_dev(tr70, th110);
    			append_dev(tr70, t402);
    			append_dev(tr70, th111);
    			append_dev(th111, p16);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.pubs) {
    				each_value_1 = pubs;

    				let i;
    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(changed, child_ctx);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(table, t178);
    					}
    				}

    				group_outros();
    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}

    			if (changed.other) {
    				each_value = other;

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
    						each_blocks[i].m(table, t182);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			transition_in(social.$$.fragment, local);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			transition_out(social.$$.fragment, local);

    			each_blocks_1 = each_blocks_1.filter(Boolean);
    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div17);
    			}

    			destroy_component(intro);

    			destroy_component(social);

    			destroy_each(each_blocks_1, detaching);

    			destroy_each(each_blocks, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$a.name, type: "component", source: "", ctx });
    	return block;
    }

    const func$3 = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

    const func_1$2 = (p) => "<a href='" + p.website + "'>" + p.name + '</a>';

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
      "/": Home,
      "/news": News,
      "/pubs": Pubs,
      "/cv": Cv,
      "/paper/:id": Paper
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
