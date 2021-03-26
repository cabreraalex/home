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
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
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
        else if (node.getAttribute(attribute) !== value)
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
        const component = get_current_component();
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
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
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
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
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
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
        $capture_state() { }
        $inject_state() { }
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
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
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

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.23.2 */

    const { Error: Error_1, Object: Object_1 } = globals;

    function create_fragment(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		return {
    			props: { params: /*componentParams*/ ctx[1] },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
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
    		p: function update(ctx, [dirty]) {
    			const switch_instance_changes = {};
    			if (dirty & /*componentParams*/ 2) switch_instance_changes.params = /*componentParams*/ ctx[1];

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
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
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
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
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function wrap(route, ...conditions) {
    	// Parameter route and each item of conditions must be functions
    	if (!route || typeof route != "function") {
    		throw Error("Invalid parameter route");
    	}

    	if (conditions && conditions.length) {
    		for (let i = 0; i < conditions.length; i++) {
    			if (!conditions[i] || typeof conditions[i] != "function") {
    				throw Error("Invalid parameter conditions[" + i + "]");
    			}
    		}
    	}

    	// Returns an object that contains all the functions to execute too
    	const obj = { route };

    	if (conditions && conditions.length) {
    		obj.conditions = conditions;
    	}

    	// The _sveltesparouter flag is to confirm the object was created by this router
    	Object.defineProperty(obj, "_sveltesparouter", { value: true });

    	return obj;
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
    	const hashPosition = window.location.href.indexOf("#/");

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: "/";

    	// Check if there's a querystring
    	const qsPosition = location.indexOf("?");

    	let querystring = "";

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(getLocation(), // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener("hashchange", update, false);

    	return function stop() {
    		window.removeEventListener("hashchange", update, false);
    	};
    });

    const location = derived(loc, $loc => $loc.location);
    const querystring = derived(loc, $loc => $loc.querystring);

    function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	setTimeout(
    		() => {
    			window.location.hash = (location.charAt(0) == "#" ? "" : "#") + location;
    		},
    		0
    	);
    }

    function pop() {
    	// Execute this code when the current call stack is complete
    	setTimeout(
    		() => {
    			window.history.back();
    		},
    		0
    	);
    }

    function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	setTimeout(
    		() => {
    			const dest = (location.charAt(0) == "#" ? "" : "#") + location;
    			history.replaceState(undefined, undefined, dest);

    			// The method above doesn't trigger the hashchange event, so let's do that manually
    			window.dispatchEvent(new Event("hashchange"));
    		},
    		0
    	);
    }

    function link(node) {
    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != "a") {
    		throw Error("Action \"link\" can only be used with <a> tags");
    	}

    	// Destination must start with '/'
    	const href = node.getAttribute("href");

    	if (!href || href.length < 1 || href.charAt(0) != "/") {
    		throw Error("Invalid value for \"href\" attribute");
    	}

    	// Add # to every href attribute
    	node.setAttribute("href", "#" + href);
    }

    function instance($$self, $$props, $$invalidate) {
    	let $loc,
    		$$unsubscribe_loc = noop;

    	validate_store(loc, "loc");
    	component_subscribe($$self, loc, $$value => $$invalidate(3, $loc = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_loc());
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
    			if (!component || typeof component != "function" && (typeof component != "object" || component._sveltesparouter !== true)) {
    				throw Error("Invalid component object");
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == "string" && (path.length < 1 || path.charAt(0) != "/" && path.charAt(0) != "*") || typeof path == "object" && !(path instanceof RegExp)) {
    				throw Error("Invalid value for \"path\" argument");
    			}

    			const { pattern, keys } = regexparam(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == "object" && component._sveltesparouter === true) {
    				this.component = component.route;
    				this.conditions = component.conditions || [];
    			} else {
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
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				out[this._keys[i]] = matches[++i] || null;
    			}

    			return out;
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
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// We need an iterable: if it's not a Map, use Object.entries
    	const routesIterable = routes instanceof Map ? routes : Object.entries(routes);

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
    		setTimeout(
    			() => {
    				dispatch(name, detail);
    			},
    			0
    		);
    	};

    	const writable_props = ["routes"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Router", $$slots, []);

    	$$self.$set = $$props => {
    		if ("routes" in $$props) $$invalidate(2, routes = $$props.routes);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		derived,
    		wrap,
    		getLocation,
    		loc,
    		location,
    		querystring,
    		push,
    		pop,
    		replace,
    		link,
    		createEventDispatcher,
    		regexparam,
    		routes,
    		RouteItem,
    		routesIterable,
    		routesList,
    		component,
    		componentParams,
    		dispatch,
    		dispatchNextTick,
    		$loc
    	});

    	$$self.$inject_state = $$props => {
    		if ("routes" in $$props) $$invalidate(2, routes = $$props.routes);
    		if ("component" in $$props) $$invalidate(0, component = $$props.component);
    		if ("componentParams" in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*component, $loc*/ 9) {
    			// Handle hash change events
    			// Listen to changes in the $loc store and update the page
    			 {
    				// Find a route matching the location
    				$$invalidate(0, component = null);

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
    							dispatchNextTick("conditionsFailed", detail);

    							break;
    						}

    						$$invalidate(0, component = routesList[i].component);
    						$$invalidate(1, componentParams = match);
    						dispatchNextTick("routeLoaded", detail);
    					}

    					i++;
    				}
    			}
    		}
    	};

    	return [component, componentParams, routes];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { routes: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Social.svelte generated by Svelte v3.23.2 */

    const { console: console_1 } = globals;
    const file = "src/components/Social.svelte";

    // (13:2) {#if !home}
    function create_if_block_1(ctx) {
    	let a;
    	let h3;
    	let i;
    	let t;

    	const block = {
    		c: function create() {
    			a = element("a");
    			h3 = element("h3");
    			i = element("i");
    			t = text("  cabreraalex.com");
    			attr_dev(i, "class", "fas fa-home");
    			add_location(i, file, 14, 10, 197);
    			attr_dev(h3, "class", "svelte-1t8evy3");
    			add_location(h3, file, 14, 6, 193);
    			attr_dev(a, "href", "https://cabreraalex.com");
    			add_location(a, file, 13, 4, 152);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, h3);
    			append_dev(h3, i);
    			append_dev(h3, t);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(13:2) {#if !home}",
    		ctx
    	});

    	return block;
    }

    // (21:2) {#if home}
    function create_if_block(ctx) {
    	let a0;
    	let h30;
    	let i0;
    	let t0;
    	let t1;
    	let a1;
    	let h31;
    	let i1;
    	let t2;

    	const block = {
    		c: function create() {
    			a0 = element("a");
    			h30 = element("h3");
    			i0 = element("i");
    			t0 = text("   @a_a_cabrera");
    			t1 = space();
    			a1 = element("a");
    			h31 = element("h3");
    			i1 = element("i");
    			t2 = text("   Blog");
    			attr_dev(i0, "class", "fab fa-twitter social-icon");
    			add_location(i0, file, 22, 10, 451);
    			attr_dev(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file, 22, 6, 447);
    			attr_dev(a0, "href", "https://twitter.com/a_a_cabrera");
    			add_location(a0, file, 21, 4, 398);
    			attr_dev(i1, "class", "fab fa-medium-m");
    			add_location(i1, file, 25, 10, 588);
    			attr_dev(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file, 25, 6, 584);
    			attr_dev(a1, "href", "https://cabreraalex.medium.com/");
    			add_location(a1, file, 24, 4, 535);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a0, anchor);
    			append_dev(a0, h30);
    			append_dev(h30, i0);
    			append_dev(h30, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, a1, anchor);
    			append_dev(a1, h31);
    			append_dev(h31, i1);
    			append_dev(h31, t2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(a1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(21:2) {#if home}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let t0;
    	let a0;
    	let h30;
    	let i0;
    	let t1;
    	let t2;
    	let t3;
    	let a1;
    	let h31;
    	let i1;
    	let t4;
    	let t5;
    	let a2;
    	let h32;
    	let i2;
    	let t6;
    	let if_block0 = !/*home*/ ctx[0] && create_if_block_1(ctx);
    	let if_block1 = /*home*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			a0 = element("a");
    			h30 = element("h3");
    			i0 = element("i");
    			t1 = text("   cabrera@cmu.edu");
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			a1 = element("a");
    			h31 = element("h3");
    			i1 = element("i");
    			t4 = text("   GitHub");
    			t5 = space();
    			a2 = element("a");
    			h32 = element("h3");
    			i2 = element("i");
    			t6 = text("  Google Scholar");
    			attr_dev(i0, "class", "fas fa-envelope");
    			add_location(i0, file, 18, 8, 311);
    			attr_dev(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file, 18, 4, 307);
    			attr_dev(a0, "href", "mailto:cabrera@cmu.edu");
    			add_location(a0, file, 17, 2, 269);
    			attr_dev(i1, "class", "fab fa-github");
    			add_location(i1, file, 29, 8, 709);
    			attr_dev(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file, 29, 4, 705);
    			attr_dev(a1, "href", "https://github.com/cabreraalex");
    			add_location(a1, file, 28, 2, 659);
    			attr_dev(i2, "class", "fas fa-graduation-cap");
    			add_location(i2, file, 32, 8, 850);
    			attr_dev(h32, "class", "svelte-1t8evy3");
    			add_location(h32, file, 32, 4, 846);
    			attr_dev(a2, "href", "https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en");
    			add_location(a2, file, 31, 2, 770);
    			attr_dev(div, "id", "social");
    			add_location(div, file, 11, 0, 116);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, a0);
    			append_dev(a0, h30);
    			append_dev(h30, i0);
    			append_dev(h30, t1);
    			append_dev(div, t2);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t3);
    			append_dev(div, a1);
    			append_dev(a1, h31);
    			append_dev(h31, i1);
    			append_dev(h31, t4);
    			append_dev(div, t5);
    			append_dev(div, a2);
    			append_dev(a2, h32);
    			append_dev(h32, i2);
    			append_dev(h32, t6);
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*home*/ ctx[0]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*home*/ ctx[0]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { home } = $$props;
    	const writable_props = ["home"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Social> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Social", $$slots, []);

    	$$self.$set = $$props => {
    		if ("home" in $$props) $$invalidate(0, home = $$props.home);
    	};

    	$$self.$capture_state = () => ({ home });

    	$$self.$inject_state = $$props => {
    		if ("home" in $$props) $$invalidate(0, home = $$props.home);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*home*/ 1) {
    			 console.log(home);
    		}
    	};

    	return [home];
    }

    class Social extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { home: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*home*/ ctx[0] === undefined && !("home" in props)) {
    			console_1.warn("<Social> was created without expected prop 'home'");
    		}
    	}

    	get home() {
    		throw new Error("<Social>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set home(value) {
    		throw new Error("<Social>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/components/Sidebar.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
    	let t0;
    	let h1;
    	let span0;
    	let t2;
    	let br0;
    	let t3;
    	let span1;
    	let t5;
    	let span2;
    	let t7;
    	let br1;
    	let t8;
    	let span3;
    	let t10;
    	let social;
    	let t11;
    	let a1;
    	let button0;
    	let t13;
    	let a2;
    	let button1;
    	let current;
    	social = new Social({ props: { home: true }, $$inline: true });

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
    			create_component(social.$$.fragment);
    			t11 = space();
    			a1 = element("a");
    			button0 = element("button");
    			button0.textContent = "CV (web)";
    			t13 = space();
    			a2 = element("a");
    			button1 = element("button");
    			button1.textContent = "CV (pdf)";
    			attr_dev(img, "width", "170px");
    			if (img.src !== (img_src_value = "images/profile.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profile");
    			add_location(img, file$1, 27, 6, 435);
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$1, 26, 4, 416);
    			attr_dev(span0, "class", "color svelte-ydo7v3");
    			add_location(span0, file$1, 30, 6, 530);
    			add_location(br0, file$1, 31, 6, 575);
    			attr_dev(span1, "class", "color red svelte-ydo7v3");
    			add_location(span1, file$1, 32, 6, 588);
    			attr_dev(span2, "class", "color svelte-ydo7v3");
    			add_location(span2, file$1, 33, 6, 630);
    			add_location(br1, file$1, 34, 6, 669);
    			attr_dev(span3, "class", "color red svelte-ydo7v3");
    			add_location(span3, file$1, 35, 6, 682);
    			attr_dev(h1, "id", "name");
    			attr_dev(h1, "class", "svelte-ydo7v3");
    			add_location(h1, file$1, 29, 4, 509);
    			attr_dev(button0, "class", "cv");
    			add_location(button0, file$1, 38, 21, 779);
    			attr_dev(a1, "href", "/#/cv");
    			add_location(a1, file$1, 38, 4, 762);
    			attr_dev(button1, "class", "cv");
    			add_location(button1, file$1, 39, 23, 844);
    			attr_dev(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 39, 4, 825);
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
    			if (detaching) detach_dev(div1);
    			destroy_component(social);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Sidebar", $$slots, []);
    	$$self.$capture_state = () => ({ Social });
    	return [];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.23.2 */

    const file$2 = "src/components/Footer.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let p;
    	let t0;
    	let a0;
    	let t2;
    	let a1;

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
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Footer", $$slots, []);
    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    var news = [
      {
        date: "May 18, 2020",
        news:
          "Excited to spend the summer doing a ~virtual~ internship at Microsoft Research with <a href='https://www.microsoft.com/en-us/research/people/sdrucker/'>Steven Drucker</a> at the <a href='https://www.microsoft.com/en-us/research/group/vida/'>VIDA group.</a>",
      },
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
        news: "We will be presenting FairVis as a conference paper at VIS'19.",
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

    /* src/News.svelte generated by Svelte v3.23.2 */
    const file$3 = "src/News.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (23:6) {#each news as n}
    function create_each_block(ctx) {
    	let div;
    	let p0;
    	let t0_value = /*n*/ ctx[0].date + "";
    	let t0;
    	let t1;
    	let p1;
    	let raw_value = /*n*/ ctx[0].news + "";
    	let t2;

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
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(23:6) {#each news as n}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div2;
    	let sidebar;
    	let t0;
    	let div1;
    	let div0;
    	let h1;
    	let t2;
    	let hr;
    	let t3;
    	let t4;
    	let footer;
    	let current;
    	sidebar = new Sidebar({ $$inline: true });
    	let each_value = news;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(sidebar.$$.fragment);
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
    			create_component(footer.$$.fragment);
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
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*news*/ 0) {
    				each_value = news;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
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
    			if (detaching) detach_dev(div2);
    			destroy_component(sidebar);
    			destroy_each(each_blocks, detaching);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<News> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("News", $$slots, []);
    	$$self.$capture_state = () => ({ Sidebar, Footer, news, onMount });
    	return [];
    }

    class News extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "News",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    var pubs = [
      {
        title: "Regularizing Black-box Models for Improved Interpretability",
        desc:
          "We introduce a new regularization method for training deep learning models that improves the stability and fidelity of post-hoc explanantion methods like LIME. Through a user study we show that the regularized model empirically improves the quality of explainations.",
        id: "expo",
        teaser: "expo.png",
        venue: "NeurIPS'20",
        venuelong: "Conference on Neural Information Processing Systems (NeurIPS)",
        year: "2020",
        month: "December",
        location: "Vancouver",
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
          "@article{plumb2020regularizing, title={Regularizing Black-box Models for Improved Interpretability}, author={Plumb, Gregory and Al-Shedivat, Maruan and Cabrera, Ángel Alexander, and Perer, Adam and Xing, Eric and Talwalkar, Ameet}, journal={NeurIPS}, year={2020}}",
        abstract:
          "Most of the work on interpretable machine learning has focused on designing either inherently interpretable models, which typically trade-off accuracy for interpretability, or post-hoc explanation systems, which tend to lack guarantees about the quality of their explanations. We explore a hybridization of these approaches by directly regularizing a black-box model for interpretability at training time - a method we call ExpO. We find that post-hoc explanations of an ExpO-regularized model are consistently more stable and of higher fidelity, which we show theoretically and support empirically. Critically, we also find ExpO leads to explanations that are more actionable, significantly more useful, and more intuitive as supported by a user study.",
        pdf: "https://arxiv.org/pdf/1902.06787.pdf",
      },
      {
        title:
          "Designing Alternative Representations of Confusion Matrices to Support Non-Expert Public Understanding of Algorithm Performance",
        desc:
          "We studied how non-experts use confusion matrices to understand machine learning models. We then developed and tested multiple alternative representations of model performance, finding that contextualized and direcitonal representations are the most useful modifications for improving understanding.",
        id: "confusion",
        teaser: "representations.png",
        venue: "CSCW'20",
        venuelong:
          "ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)",
        year: "2020",
        month: "October",
        location: "Virtual",
        authors: [
          {
            name: "Hong Shen",
            website: "https://www.andrew.cmu.edu/user//hongs/",
          },
          {
            name: "Haojian Jin",
            website: "http://shift-3.com/",
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
            name: "Haiyi Zhu",
            website: "https://haiyizhu.com/",
          },
          {
            name: "Jason Hong",
            website: "http://www.cs.cmu.edu/~jasonh/",
          },
        ],
        bibtex:
          "@inproceedings{Shen2020Confusion, author = {Shen, Hong and Jin, Haojian and Cabrera, Ángel Alexander and Perer, Adam and Zhu, Haiyi and Hong, Jason},title = {Designing Alternative Representations of Confusion Matrices to Support Non-Expert Public Understanding of Algorithm Performance},year = {2020},publisher = {Association for Computing Machinery},address = {New York, NY, USA},url = {https://doi.org/10.1145/3415224},doi = {10.1145/3415224},booktitle = {Proceedings of the ACM 2020 Conference on Computer Supported Cooperative Work},location = {Virtual},series = {CSCW ’20}}",
        abstract:
          "Ensuring effective public understanding of algorithmic decisions that are powered by machine learning techniques has become an urgent task with the increasing deployment of AI systems into our society. In this work, we present a concrete step toward this goal by redesigning confusion matrices for binary classification to support non-experts in understanding the performance of machine learning models. Through interviews (n=7) and a survey (n=102), we mapped out two major sets of challenges lay people have in understanding standard confusion matrices: the general terminologies and the matrix design. We further identified three sub-challenges regarding the matrix design, namely, confusion about the direction of reading the data, layered relations and quantities involved. We then conducted an online experiment with 483 participants to evaluate how effective a series of alternative representations target each of those challenges in the context of an algorithm for making recidivism predictions. We developed three levels of questions to evaluate users' objective understanding. We assessed the effectiveness of our alternatives for accuracy in answering those questions, completion time, and subjective understanding. Our results suggest that (1) only by contextualizing terminologies can we significantly improve users' understanding and (2) flow charts, which help point out the direction of reading the data, were most useful in improving objective understanding. Our findings set the stage for developing more intuitive and generally understandable representations of the performance of machine learning models.",
        pdf: "https://www.andrew.cmu.edu/user//hongs/files/CM_CSCW2020.pdf",
      },
      {
        title:
          "FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning",
        desc:
          "FairVis is a visual analytics system that enables data scientists to find potential biases in their machine learning models. It allows users to split their data into subgroups of different features to see how vulnerable groups are performing for various fairness metrics. Additionally, it suggests groups that may be underperforming and can find similar groups.",
        id: "fairvis",
        teaser: "fairvis.png",
        venue: "VIS'19",
        venuelong:
          "IEEE Conference on Visual Analytics Science and Technology (VAST)",
        year: "2019",
        month: "October",
        location: "Vancouver, Canada",
        authors: [
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com",
          },
          {
            name: "Will Epperson",
            website: "http://willepperson.com",
          },
          {
            name: "Fred Hohman",
            website: "https://fredhohman.com",
          },
          {
            name: "Minsuk Kahng",
            website: "https://minsuk.com",
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
          "@INPROCEEDINGS{8986948, author={Á. A. {Cabrera} and W. {Epperson} and F. {Hohman} and M. {Kahng} and J. {Morgenstern} and D. H. {Chau}}, booktitle={2019 IEEE Conference on Visual Analytics Science and Technology (VAST)}, title={FAIRVIS: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, year={2019}, volume={}, number={}, pages={46-56},}",
        abstract:
          "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
        demo: "https://poloclub.github.io/FairVis/",
        code: "https://github.com/poloclub/FairVis",
        blog:
          "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
        pdf: "https://arxiv.org/abs/1904.05419",
        video: "https://vimeo.com/showcase/6524122/video/368702211",
        // slides: "./FairVis.pdf"
      },
    ];

    var other = [
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

    /* src/components/Intro.svelte generated by Svelte v3.23.2 */

    const file$4 = "src/components/Intro.svelte";

    function create_fragment$5(ctx) {
    	let p0;
    	let t0;
    	let a0;
    	let t2;
    	let a1;
    	let t4;
    	let a2;
    	let t6;
    	let b0;
    	let t8;
    	let b1;
    	let t10;
    	let b2;
    	let t12;
    	let a3;
    	let t14;
    	let p1;
    	let t15;
    	let a4;
    	let t17;
    	let a5;
    	let t19;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			t0 = text("I am a PhD student in the\n  ");
    			a0 = element("a");
    			a0.textContent = "Human Computer Interaction Institute (HCII)";
    			t2 = text("\n  at Carnegie Mellon University, advised by\n  ");
    			a1 = element("a");
    			a1.textContent = "Adam Perer";
    			t4 = text("\n  and\n  ");
    			a2 = element("a");
    			a2.textContent = "Jason Hong.";
    			t6 = text("\n  My research focus is broadly\n  ");
    			b0 = element("b");
    			b0.textContent = "human-centered AI,";
    			t8 = text("\n  specifically in applying techniques from\n  ");
    			b1 = element("b");
    			b1.textContent = "HCI";
    			t10 = text("\n  and\n  ");
    			b2 = element("b");
    			b2.textContent = "visualization";
    			t12 = text("\n  to help people better understand and improve their machine learning models. I am\n  supported by a\n  ");
    			a3 = element("a");
    			a3.textContent = "NSF Graduate Research Fellowship.";
    			t14 = space();
    			p1 = element("p");
    			t15 = text("Before CMU, I graduated with a B.S. in Computer Science from Georgia Tech\n  where I worked with\n  ");
    			a4 = element("a");
    			a4.textContent = "Polo Chau";
    			t17 = text("\n  and\n  ");
    			a5 = element("a");
    			a5.textContent = "Jamie Morgenstern.";
    			t19 = text("\n  I've spent time at\n  \n  Microsoft Research and a few summers as a software engineering intern at\n  \n  Google working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr_dev(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 2, 2, 34);
    			attr_dev(a1, "href", "http://perer.org");
    			add_location(a1, file$4, 6, 2, 168);
    			attr_dev(a2, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a2, file$4, 8, 2, 218);
    			add_location(b0, file$4, 10, 2, 308);
    			add_location(b1, file$4, 12, 2, 379);
    			add_location(b2, file$4, 14, 2, 398);
    			attr_dev(a3, "href", "https://www.nsfgrfp.org/");
    			add_location(a3, file$4, 17, 2, 521);
    			attr_dev(p0, "class", "svelte-1071h7w");
    			add_location(p0, file$4, 0, 0, 0);
    			attr_dev(a4, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a4, file$4, 23, 2, 704);
    			attr_dev(a5, "href", "http://jamiemorgenstern.com/");
    			add_location(a5, file$4, 25, 2, 770);
    			attr_dev(p1, "class", "svelte-1071h7w");
    			add_location(p1, file$4, 20, 0, 600);
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
    			append_dev(p0, b0);
    			append_dev(p0, t8);
    			append_dev(p0, b1);
    			append_dev(p0, t10);
    			append_dev(p0, b2);
    			append_dev(p0, t12);
    			append_dev(p0, a3);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t15);
    			append_dev(p1, a4);
    			append_dev(p1, t17);
    			append_dev(p1, a5);
    			append_dev(p1, t19);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(p1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Intro", $$slots, []);
    	return [];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/Links.svelte generated by Svelte v3.23.2 */

    const file$5 = "src/components/Links.svelte";

    // (21:2) {#if pub.pdf}
    function create_if_block_6(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "PDF";
    			attr_dev(i, "class", "fas fa-file-pdf");
    			add_location(i, file$5, 23, 8, 359);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 24, 8, 397);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 22, 6, 322);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].pdf);
    			add_location(a, file$5, 21, 4, 297);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].pdf)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(21:2) {#if pub.pdf}",
    		ctx
    	});

    	return block;
    }

    // (29:2) {#if pub.blog}
    function create_if_block_5(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Blog";
    			attr_dev(i, "class", "fab fa-medium");
    			add_location(i, file$5, 31, 8, 525);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 32, 8, 561);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 30, 6, 488);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].blog);
    			add_location(a, file$5, 29, 4, 462);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].blog)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(29:2) {#if pub.blog}",
    		ctx
    	});

    	return block;
    }

    // (37:2) {#if pub.workshop}
    function create_if_block_4(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Workshop";
    			attr_dev(i, "class", "fas fa-globe");
    			add_location(i, file$5, 39, 8, 698);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 40, 8, 733);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 38, 6, 661);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].workshop);
    			add_location(a, file$5, 37, 4, 631);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].workshop)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(37:2) {#if pub.workshop}",
    		ctx
    	});

    	return block;
    }

    // (45:2) {#if pub.video}
    function create_if_block_3(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Video";
    			attr_dev(i, "class", "fab fa-youtube");
    			add_location(i, file$5, 47, 8, 868);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 48, 8, 905);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 46, 6, 831);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].video);
    			add_location(a, file$5, 45, 4, 804);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].video)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(45:2) {#if pub.video}",
    		ctx
    	});

    	return block;
    }

    // (53:2) {#if pub.demo}
    function create_if_block_2(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Demo";
    			attr_dev(i, "class", "fas fa-globe");
    			add_location(i, file$5, 55, 8, 1035);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 56, 8, 1070);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 54, 6, 998);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].demo);
    			add_location(a, file$5, 53, 4, 972);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].demo)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(53:2) {#if pub.demo}",
    		ctx
    	});

    	return block;
    }

    // (61:2) {#if pub.code}
    function create_if_block_1$1(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Code";
    			attr_dev(i, "class", "fab fa-github");
    			add_location(i, file$5, 63, 8, 1199);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 64, 8, 1235);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 62, 6, 1162);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].code);
    			add_location(a, file$5, 61, 4, 1136);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].code)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(61:2) {#if pub.code}",
    		ctx
    	});

    	return block;
    }

    // (69:2) {#if pub.slides}
    function create_if_block$1(ctx) {
    	let a;
    	let button;
    	let i;
    	let t0;
    	let p;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			button = element("button");
    			i = element("i");
    			t0 = space();
    			p = element("p");
    			p.textContent = "Slides";
    			attr_dev(i, "class", "fas fa-file-powerpoint");
    			add_location(i, file$5, 71, 8, 1368);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 72, 8, 1413);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 70, 6, 1331);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].slides);
    			add_location(a, file$5, 69, 4, 1303);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, button);
    			append_dev(button, i);
    			append_dev(button, t0);
    			append_dev(button, p);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = /*pub*/ ctx[0].slides)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(69:2) {#if pub.slides}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let a;
    	let button;
    	let i;
    	let t7;
    	let p;
    	let a_href_value;
    	let if_block0 = /*pub*/ ctx[0].pdf && create_if_block_6(ctx);
    	let if_block1 = /*pub*/ ctx[0].blog && create_if_block_5(ctx);
    	let if_block2 = /*pub*/ ctx[0].workshop && create_if_block_4(ctx);
    	let if_block3 = /*pub*/ ctx[0].video && create_if_block_3(ctx);
    	let if_block4 = /*pub*/ ctx[0].demo && create_if_block_2(ctx);
    	let if_block5 = /*pub*/ ctx[0].code && create_if_block_1$1(ctx);
    	let if_block6 = /*pub*/ ctx[0].slides && create_if_block$1(ctx);

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
    			attr_dev(i, "class", "fas fa-globe");
    			add_location(i, file$5, 78, 6, 1532);
    			attr_dev(p, "class", "svelte-1m22cyq");
    			add_location(p, file$5, 79, 6, 1565);
    			attr_dev(button, "class", "button-link svelte-1m22cyq");
    			add_location(button, file$5, 77, 4, 1497);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a, file$5, 76, 2, 1462);
    			attr_dev(div, "class", "buttons");
    			add_location(div, file$5, 19, 0, 255);
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
    		p: function update(ctx, [dirty]) {
    			if (/*pub*/ ctx[0].pdf) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*pub*/ ctx[0].blog) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*pub*/ ctx[0].workshop) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_4(ctx);
    					if_block2.c();
    					if_block2.m(div, t2);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*pub*/ ctx[0].video) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_3(ctx);
    					if_block3.c();
    					if_block3.m(div, t3);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*pub*/ ctx[0].demo) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_2(ctx);
    					if_block4.c();
    					if_block4.m(div, t4);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*pub*/ ctx[0].code) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);
    				} else {
    					if_block5 = create_if_block_1$1(ctx);
    					if_block5.c();
    					if_block5.m(div, t5);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*pub*/ ctx[0].slides) {
    				if (if_block6) {
    					if_block6.p(ctx, dirty);
    				} else {
    					if_block6 = create_if_block$1(ctx);
    					if_block6.c();
    					if_block6.m(div, t6);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (dirty & /*pub*/ 1 && a_href_value !== (a_href_value = "#/paper/" + /*pub*/ ctx[0].id)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { pub } = $$props;
    	const writable_props = ["pub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Links> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Links", $$slots, []);

    	$$self.$set = $$props => {
    		if ("pub" in $$props) $$invalidate(0, pub = $$props.pub);
    	};

    	$$self.$capture_state = () => ({ pub });

    	$$self.$inject_state = $$props => {
    		if ("pub" in $$props) $$invalidate(0, pub = $$props.pub);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pub];
    }

    class Links extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { pub: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Links",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*pub*/ ctx[0] === undefined && !("pub" in props)) {
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

    /* src/Home.svelte generated by Svelte v3.23.2 */
    const file$6 = "src/Home.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (57:8) {#each { length: 3 } as _, i}
    function create_each_block_2(ctx) {
    	let div;
    	let p0;
    	let t0_value = news[/*i*/ ctx[7]].date + "";
    	let t0;
    	let t1;
    	let p1;
    	let raw_value = news[/*i*/ ctx[7]].news + "";
    	let t2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			attr_dev(p0, "class", "pure-u-1 pure-u-md-1-5 date");
    			add_location(p0, file$6, 58, 12, 1408);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 59, 12, 1478);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$6, 57, 10, 1365);
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
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(57:8) {#each { length: 3 } as _, i}",
    		ctx
    	});

    	return block;
    }

    // (72:8) {#each pubs as pub}
    function create_each_block_1(ctx) {
    	let div5;
    	let div2;
    	let a0;
    	let div0;
    	let a0_href_value;
    	let t0;
    	let div1;
    	let h6;
    	let t1_value = /*pub*/ ctx[0].venue + "";
    	let t1;
    	let t2;
    	let div4;
    	let div3;
    	let a1;
    	let h4;
    	let t3_value = /*pub*/ ctx[0].title + "";
    	let t3;
    	let a1_href_value;
    	let t4;
    	let h5;
    	let raw_value = /*pub*/ ctx[0].authors.map(func).join(", ") + "";
    	let t5;
    	let links;
    	let t6;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
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
    			create_component(links.$$.fragment);
    			t6 = space();
    			set_style(div0, "background-image", "url(" + ("images/" + /*pub*/ ctx[0].teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 75, 16, 2015);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 74, 14, 1968);
    			attr_dev(h6, "class", "venue svelte-1j77j5i");
    			add_location(h6, file$6, 81, 16, 2215);
    			add_location(div1, file$6, 80, 14, 2193);
    			attr_dev(div2, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1j77j5i");
    			add_location(div2, file$6, 73, 12, 1907);
    			add_location(h4, file$6, 87, 18, 2459);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 86, 16, 2390);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 89, 16, 2517);
    			attr_dev(div3, "class", "padded");
    			add_location(div3, file$6, 85, 14, 2353);
    			attr_dev(div4, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div4, file$6, 84, 12, 2302);
    			attr_dev(div5, "class", "pure-g pub");
    			add_location(div5, file$6, 72, 10, 1870);
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
    			if (detaching) detach_dev(div5);
    			destroy_component(links);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(72:8) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (113:8) {#each other as pub}
    function create_each_block$1(ctx) {
    	let div4;
    	let div1;
    	let a0;
    	let div0;
    	let a0_href_value;
    	let t0;
    	let h6;
    	let t1_value = /*pub*/ ctx[0].venue + "";
    	let t1;
    	let t2;
    	let div3;
    	let div2;
    	let a1;
    	let h4;
    	let t3_value = /*pub*/ ctx[0].title + "";
    	let t3;
    	let a1_href_value;
    	let t4;
    	let h5;
    	let raw_value = /*pub*/ ctx[0].authors.map(func_1).join(", ") + "";
    	let t5;
    	let links;
    	let t6;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
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
    			create_component(links.$$.fragment);
    			t6 = space();
    			set_style(div0, "background-image", "url(" + ("images/" + /*pub*/ ctx[0].teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 116, 16, 3473);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 115, 14, 3426);
    			attr_dev(h6, "class", "venue svelte-1j77j5i");
    			add_location(h6, file$6, 121, 14, 3651);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1j77j5i");
    			add_location(div1, file$6, 114, 12, 3365);
    			add_location(h4, file$6, 126, 18, 3874);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 125, 16, 3805);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 128, 16, 3932);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$6, 124, 14, 3768);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 123, 12, 3717);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 113, 10, 3328);
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
    			if (detaching) detach_dev(div4);
    			destroy_component(links);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(113:8) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div9;
    	let sidebar;
    	let t0;
    	let div8;
    	let div7;
    	let div0;
    	let h20;
    	let t1;
    	let span;
    	let t3;
    	let intro;
    	let t4;
    	let div2;
    	let div1;
    	let h21;
    	let t6;
    	let a;
    	let t8;
    	let hr0;
    	let t9;
    	let t10;
    	let div4;
    	let div3;
    	let h22;
    	let t12;
    	let hr1;
    	let t13;
    	let t14;
    	let div6;
    	let div5;
    	let h23;
    	let t16;
    	let hr2;
    	let t17;
    	let t18;
    	let footer;
    	let current;
    	sidebar = new Sidebar({ $$inline: true });
    	intro = new Intro({ $$inline: true });
    	let each_value_2 = { length: 3 };
    	validate_each_argument(each_value_2);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_2[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = pubs;
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = other;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div9 = element("div");
    			create_component(sidebar.$$.fragment);
    			t0 = space();
    			div8 = element("div");
    			div7 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			t1 = text("Hi! You can call me ");
    			span = element("span");
    			span.textContent = "Alex";
    			t3 = space();
    			create_component(intro.$$.fragment);
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
    			create_component(footer.$$.fragment);
    			attr_dev(span, "class", "name");
    			add_location(span, file$6, 47, 43, 1060);
    			attr_dev(h20, "id", "hello");
    			attr_dev(h20, "class", "svelte-1j77j5i");
    			add_location(h20, file$6, 47, 8, 1025);
    			attr_dev(div0, "id", "intro");
    			add_location(div0, file$6, 46, 6, 1000);
    			attr_dev(h21, "class", "header svelte-1j77j5i");
    			add_location(h21, file$6, 52, 10, 1201);
    			attr_dev(a, "class", "right-all");
    			attr_dev(a, "href", "#/news");
    			add_location(a, file$6, 53, 10, 1240);
    			attr_dev(div1, "class", "inline svelte-1j77j5i");
    			add_location(div1, file$6, 51, 8, 1170);
    			add_location(hr0, file$6, 55, 8, 1310);
    			attr_dev(div2, "id", "news");
    			attr_dev(div2, "class", "sect");
    			add_location(div2, file$6, 50, 6, 1133);
    			attr_dev(h22, "class", "header svelte-1j77j5i");
    			add_location(h22, file$6, 67, 10, 1690);
    			attr_dev(div3, "class", "inline svelte-1j77j5i");
    			add_location(div3, file$6, 66, 8, 1659);
    			add_location(hr1, file$6, 70, 8, 1825);
    			attr_dev(div4, "id", "pubs");
    			attr_dev(div4, "class", "sect");
    			add_location(div4, file$6, 65, 6, 1622);
    			attr_dev(h23, "class", "header svelte-1j77j5i");
    			add_location(h23, file$6, 108, 10, 3128);
    			attr_dev(div5, "class", "inline svelte-1j77j5i");
    			add_location(div5, file$6, 107, 8, 3097);
    			add_location(hr2, file$6, 111, 8, 3282);
    			attr_dev(div6, "id", "pubs");
    			attr_dev(div6, "class", "sect");
    			add_location(div6, file$6, 106, 6, 3060);
    			attr_dev(div7, "id", "padded-content");
    			add_location(div7, file$6, 45, 4, 968);
    			attr_dev(div8, "id", "content");
    			attr_dev(div8, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div8, file$6, 44, 2, 914);
    			attr_dev(div9, "class", "pure-g");
    			attr_dev(div9, "id", "main-container");
    			add_location(div9, file$6, 42, 0, 857);
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
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*news*/ 0) {
    				each_value_2 = { length: 3 };
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
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

    			if (dirty & /*pubs*/ 0) {
    				each_value_1 = pubs;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
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

    			if (dirty & /*other*/ 0) {
    				each_value = other;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
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
    		i: function intro$1(local) {
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
    			if (detaching) detach_dev(div9);
    			destroy_component(sidebar);
    			destroy_component(intro);
    			destroy_each(each_blocks_2, detaching);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;
    const func_1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$7($$self, $$props, $$invalidate) {
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Home", $$slots, []);

    	$$self.$capture_state = () => ({
    		link,
    		news,
    		pubs,
    		other,
    		Sidebar,
    		Intro,
    		Footer,
    		Links,
    		onMount
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.23.2 */
    const file$7 = "src/Pubs.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (23:6) {#each pubs as pub}
    function create_each_block$2(ctx) {
    	let div4;
    	let div1;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
    	let a0_href_value;
    	let t0;
    	let h6;
    	let t1_value = /*pub*/ ctx[0].venue + "";
    	let t1;
    	let t2;
    	let div3;
    	let div2;
    	let a1;
    	let h4;
    	let t3_value = /*pub*/ ctx[0].title + "";
    	let t3;
    	let a1_href_value;
    	let t4;
    	let h5;
    	let raw_value = /*pub*/ ctx[0].authors.map(func$1).join(", ") + "";
    	let t5;
    	let p;
    	let t6_value = /*pub*/ ctx[0].desc + "";
    	let t6;
    	let t7;
    	let links;
    	let t8;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
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
    			create_component(links.$$.fragment);
    			t8 = space();
    			if (img.src !== (img_src_value = "images/" + /*pub*/ ctx[0].teaser)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "thumb");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$7, 27, 16, 720);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$7, 26, 14, 673);
    			attr_dev(h6, "class", "venue");
    			add_location(h6, file$7, 29, 14, 817);
    			attr_dev(div0, "class", "thumb");
    			add_location(div0, file$7, 25, 12, 639);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$7, 24, 10, 580);
    			add_location(h4, file$7, 35, 16, 1049);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$7, 34, 14, 982);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$7, 37, 14, 1103);
    			attr_dev(p, "class", "desc");
    			add_location(p, file$7, 47, 14, 1462);
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
    			if (detaching) detach_dev(div4);
    			destroy_component(links);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(23:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div2;
    	let sidebar;
    	let t0;
    	let div1;
    	let div0;
    	let h1;
    	let t2;
    	let hr;
    	let t3;
    	let t4;
    	let footer;
    	let current;
    	sidebar = new Sidebar({ $$inline: true });
    	let each_value = pubs;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(sidebar.$$.fragment);
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
    			create_component(footer.$$.fragment);
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
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*pubs*/ 0) {
    				each_value = pubs;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
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
    			if (detaching) detach_dev(div2);
    			destroy_component(sidebar);
    			destroy_each(each_blocks, detaching);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$8($$self, $$props, $$invalidate) {
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Pubs> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Pubs", $$slots, []);
    	$$self.$capture_state = () => ({ Sidebar, Footer, Links, pubs, onMount });
    	return [];
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pubs",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.23.2 */
    const file$8 = "src/Paper.svelte";

    function create_fragment$9(ctx) {
    	let div5;
    	let a0;
    	let i0;
    	let t0;
    	let h40;
    	let span0;
    	let t2;
    	let span1;
    	let t4;
    	let span2;
    	let t6;
    	let span3;
    	let t8;
    	let hr;
    	let t9;
    	let h1;
    	let t11;
    	let div0;
    	let h3;
    	let raw0_value = /*pub*/ ctx[0].authors.map(func$2).join(", ") + "";
    	let t12;
    	let div3;
    	let div1;
    	let img;
    	let img_src_value;
    	let t13;
    	let div2;
    	let p0;
    	let t15;
    	let h20;
    	let t17;
    	let p1;
    	let t19;
    	let h21;
    	let t21;
    	let a1;
    	let h41;
    	let a1_href_value;
    	let t23;
    	let h50;
    	let raw1_value = /*pub*/ ctx[0].authors.map(func_1$1).join(", ") + "";
    	let t24;
    	let h51;
    	let i1;
    	let t31;
    	let links;
    	let t32;
    	let h22;
    	let t34;
    	let div4;
    	let code;
    	let t36;
    	let footer;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

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
    			h1.textContent = `${/*pub*/ ctx[0].title}`;
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
    			p0.textContent = `${/*pub*/ ctx[0].desc}`;
    			t15 = space();
    			h20 = element("h2");
    			h20.textContent = "Abstract";
    			t17 = space();
    			p1 = element("p");
    			p1.textContent = `${/*pub*/ ctx[0].abstract}`;
    			t19 = space();
    			h21 = element("h2");
    			h21.textContent = "Citation";
    			t21 = space();
    			a1 = element("a");
    			h41 = element("h4");
    			h41.textContent = `${/*pub*/ ctx[0].title}`;
    			t23 = space();
    			h50 = element("h5");
    			t24 = space();
    			h51 = element("h5");
    			i1 = element("i");
    			i1.textContent = `${/*pub*/ ctx[0].venuelong}. ${/*pub*/ ctx[0].location}, ${/*pub*/ ctx[0].year}.`;
    			t31 = space();
    			create_component(links.$$.fragment);
    			t32 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t34 = space();
    			div4 = element("div");
    			code = element("code");
    			code.textContent = `${/*pub*/ ctx[0].bibtex}`;
    			t36 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(i0, "class", "fas fa-home svelte-eaksx");
    			attr_dev(i0, "id", "home");
    			add_location(i0, file$8, 112, 4, 1785);
    			attr_dev(span0, "class", "color svelte-eaksx");
    			add_location(span0, file$8, 114, 6, 1851);
    			attr_dev(span1, "class", "color red svelte-eaksx");
    			add_location(span1, file$8, 115, 6, 1896);
    			attr_dev(span2, "class", "color svelte-eaksx");
    			add_location(span2, file$8, 116, 6, 1938);
    			attr_dev(span3, "class", "color red svelte-eaksx");
    			add_location(span3, file$8, 117, 6, 1983);
    			attr_dev(h40, "id", "home-link");
    			attr_dev(h40, "class", "svelte-eaksx");
    			add_location(h40, file$8, 113, 4, 1825);
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "home svelte-eaksx");
    			add_location(a0, file$8, 111, 2, 1755);
    			add_location(hr, file$8, 120, 2, 2041);
    			attr_dev(h1, "class", "svelte-eaksx");
    			add_location(h1, file$8, 121, 2, 2050);
    			attr_dev(h3, "class", "svelte-eaksx");
    			add_location(h3, file$8, 123, 4, 2093);
    			attr_dev(div0, "id", "info");
    			attr_dev(div0, "class", "svelte-eaksx");
    			add_location(div0, file$8, 122, 2, 2073);
    			if (img.src !== (img_src_value = "images/" + /*pub*/ ctx[0].teaser)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "teaser svelte-eaksx");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$8, 136, 6, 2416);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 135, 4, 2373);
    			attr_dev(p0, "class", "desc svelte-eaksx");
    			add_location(p0, file$8, 139, 6, 2539);
    			attr_dev(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 138, 4, 2496);
    			attr_dev(div3, "class", "flex pure-g svelte-eaksx");
    			add_location(div3, file$8, 134, 2, 2343);
    			attr_dev(h20, "class", "sec-title svelte-eaksx");
    			add_location(h20, file$8, 143, 2, 2593);
    			attr_dev(p1, "class", "svelte-eaksx");
    			add_location(p1, file$8, 144, 2, 2631);
    			attr_dev(h21, "class", "sec-title svelte-eaksx");
    			add_location(h21, file$8, 146, 2, 2656);
    			attr_dev(h41, "class", "svelte-eaksx");
    			add_location(h41, file$8, 148, 4, 2749);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$8, 147, 2, 2694);
    			attr_dev(h50, "class", "svelte-eaksx");
    			add_location(h50, file$8, 151, 2, 2780);
    			add_location(i1, file$8, 163, 4, 3013);
    			attr_dev(h51, "class", "svelte-eaksx");
    			add_location(h51, file$8, 162, 2, 3004);
    			attr_dev(h22, "class", "sec-title svelte-eaksx");
    			add_location(h22, file$8, 167, 2, 3094);
    			attr_dev(code, "class", "bibtex");
    			add_location(code, file$8, 169, 4, 3153);
    			attr_dev(div4, "class", "code svelte-eaksx");
    			add_location(div4, file$8, 168, 2, 3130);
    			attr_dev(div5, "id", "body");
    			attr_dev(div5, "class", "svelte-eaksx");
    			add_location(div5, file$8, 110, 0, 1737);
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
    			append_dev(div5, t15);
    			append_dev(div5, h20);
    			append_dev(div5, t17);
    			append_dev(div5, p1);
    			append_dev(div5, t19);
    			append_dev(div5, h21);
    			append_dev(div5, t21);
    			append_dev(div5, a1);
    			append_dev(a1, h41);
    			append_dev(div5, t23);
    			append_dev(div5, h50);
    			h50.innerHTML = raw1_value;
    			append_dev(div5, t24);
    			append_dev(div5, h51);
    			append_dev(h51, i1);
    			append_dev(div5, t31);
    			mount_component(links, div5, null);
    			append_dev(div5, t32);
    			append_dev(div5, h22);
    			append_dev(div5, t34);
    			append_dev(div5, div4);
    			append_dev(div4, code);
    			append_dev(div5, t36);
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
    			if (detaching) detach_dev(div5);
    			destroy_component(links);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$2 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;
    const func_1$1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$9($$self, $$props, $$invalidate) {
    	let { params = {} } = $$props;
    	let pub = pubs.concat(other).find(e => e.id === params.id);
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = ["params"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Paper> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Paper", $$slots, []);

    	$$self.$set = $$props => {
    		if ("params" in $$props) $$invalidate(1, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		Footer,
    		pubs,
    		other,
    		Links,
    		onMount,
    		params,
    		pub
    	});

    	$$self.$inject_state = $$props => {
    		if ("params" in $$props) $$invalidate(1, params = $$props.params);
    		if ("pub" in $$props) $$invalidate(0, pub = $$props.pub);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pub, params];
    }

    class Paper extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { params: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Paper",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get params() {
    		throw new Error("<Paper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Paper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Cv.svelte generated by Svelte v3.23.2 */
    const file$9 = "src/Cv.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (296:6) {#each pubs as pub}
    function create_each_block_1$1(ctx) {
    	let tr0;
    	let th0;
    	let t0_value = /*pub*/ ctx[0].month + "";
    	let t0;
    	let t1;
    	let t2_value = /*pub*/ ctx[0].year + "";
    	let t2;
    	let t3;
    	let th1;
    	let a;
    	let h5;
    	let t4_value = /*pub*/ ctx[0].title + "";
    	let t4;
    	let a_href_value;
    	let t5;
    	let h6;
    	let raw_value = /*pub*/ ctx[0].authors.map(func$3).join(", ") + "";
    	let t6;
    	let p;
    	let i;
    	let t7_value = /*pub*/ ctx[0].venuelong + "";
    	let t7;
    	let t8;
    	let t9_value = /*pub*/ ctx[0].location + "";
    	let t9;
    	let t10;
    	let t11_value = /*pub*/ ctx[0].year + "";
    	let t11;
    	let t12;
    	let t13;
    	let links;
    	let t14;
    	let tr1;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
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
    			create_component(links.$$.fragment);
    			t14 = space();
    			tr1 = element("tr");
    			attr_dev(th0, "class", "date svelte-1jbn3ss");
    			add_location(th0, file$9, 297, 10, 9354);
    			attr_dev(h5, "class", "svelte-1jbn3ss");
    			add_location(h5, file$9, 300, 14, 9491);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 299, 12, 9426);
    			attr_dev(h6, "class", "authors svelte-1jbn3ss");
    			add_location(h6, file$9, 303, 12, 9542);
    			add_location(i, file$9, 315, 14, 9915);
    			attr_dev(p, "class", "desc svelte-1jbn3ss");
    			add_location(p, file$9, 314, 12, 9884);
    			attr_dev(th1, "class", "svelte-1jbn3ss");
    			add_location(th1, file$9, 298, 10, 9409);
    			attr_dev(tr0, "class", "item svelte-1jbn3ss");
    			add_location(tr0, file$9, 296, 8, 9326);
    			attr_dev(tr1, "class", "buffer svelte-1jbn3ss");
    			add_location(tr1, file$9, 321, 8, 10051);
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
    			if (detaching) detach_dev(tr0);
    			destroy_component(links);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(tr1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(296:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (331:6) {#each other as pub}
    function create_each_block$3(ctx) {
    	let tr0;
    	let th0;
    	let t0_value = /*pub*/ ctx[0].month + "";
    	let t0;
    	let t1;
    	let t2_value = /*pub*/ ctx[0].year + "";
    	let t2;
    	let t3;
    	let th1;
    	let a;
    	let h5;
    	let t4_value = /*pub*/ ctx[0].title + "";
    	let t4;
    	let a_href_value;
    	let t5;
    	let h6;
    	let raw_value = /*pub*/ ctx[0].authors.map(func_1$2).join(", ") + "";
    	let t6;
    	let p;
    	let i;
    	let t7_value = /*pub*/ ctx[0].venuelong + "";
    	let t7;
    	let t8;
    	let t9_value = /*pub*/ ctx[0].location + "";
    	let t9;
    	let t10;
    	let t11_value = /*pub*/ ctx[0].year + "";
    	let t11;
    	let t12;
    	let t13;
    	let links;
    	let t14;
    	let tr1;
    	let current;

    	links = new Links({
    			props: { pub: /*pub*/ ctx[0] },
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
    			create_component(links.$$.fragment);
    			t14 = space();
    			tr1 = element("tr");
    			attr_dev(th0, "class", "date svelte-1jbn3ss");
    			add_location(th0, file$9, 332, 10, 10329);
    			attr_dev(h5, "class", "svelte-1jbn3ss");
    			add_location(h5, file$9, 335, 14, 10466);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 334, 12, 10401);
    			attr_dev(h6, "class", "authors svelte-1jbn3ss");
    			add_location(h6, file$9, 338, 12, 10517);
    			add_location(i, file$9, 350, 14, 10890);
    			attr_dev(p, "class", "desc svelte-1jbn3ss");
    			add_location(p, file$9, 349, 12, 10859);
    			attr_dev(th1, "class", "svelte-1jbn3ss");
    			add_location(th1, file$9, 333, 10, 10384);
    			attr_dev(tr0, "class", "item svelte-1jbn3ss");
    			add_location(tr0, file$9, 331, 8, 10301);
    			attr_dev(tr1, "class", "buffer svelte-1jbn3ss");
    			add_location(tr1, file$9, 356, 8, 11026);
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
    			if (detaching) detach_dev(tr0);
    			destroy_component(links);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(tr1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(331:6) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div17;
    	let main;
    	let table;
    	let tr0;
    	let th0;
    	let t0;
    	let th1;
    	let h3;
    	let span0;
    	let t2;
    	let span1;
    	let t4;
    	let span2;
    	let t6;
    	let span3;
    	let t8;
    	let intro;
    	let t9;
    	let social;
    	let t10;
    	let tr1;
    	let th2;
    	let t11;
    	let th3;
    	let h40;
    	let t13;
    	let tr2;
    	let th4;
    	let t14;
    	let br0;
    	let t15;
    	let t16;
    	let th5;
    	let h50;
    	let t18;
    	let h60;
    	let t20;
    	let p0;
    	let t21;
    	let a0;
    	let t23;
    	let a1;
    	let t25;
    	let div0;
    	let a2;
    	let button0;
    	let i0;
    	let t26;
    	let t27;
    	let tr3;
    	let t28;
    	let tr4;
    	let th6;
    	let t29;
    	let br1;
    	let t30;
    	let t31;
    	let th7;
    	let h51;
    	let t33;
    	let h61;
    	let t35;
    	let p1;
    	let t36;
    	let br2;
    	let t37;
    	let t38;
    	let tr5;
    	let th8;
    	let t40;
    	let th9;
    	let h62;
    	let t42;
    	let p2;
    	let t44;
    	let tr6;
    	let th10;
    	let t45;
    	let th11;
    	let h41;
    	let t47;
    	let tr7;
    	let th12;
    	let t48;
    	let br3;
    	let t49;
    	let t50;
    	let th13;
    	let h52;
    	let t52;
    	let h63;
    	let t54;
    	let p3;
    	let t55;
    	let a3;
    	let t57;
    	let a4;
    	let t59;
    	let div1;
    	let a5;
    	let button1;
    	let i1;
    	let t60;
    	let t61;
    	let tr8;
    	let t62;
    	let tr9;
    	let th14;
    	let t63;
    	let br4;
    	let t64;
    	let t65;
    	let th15;
    	let h53;
    	let t67;
    	let h64;
    	let t69;
    	let p4;
    	let t71;
    	let div2;
    	let button2;
    	let a6;
    	let i2;
    	let t72;
    	let t73;
    	let button3;
    	let t75;
    	let button4;
    	let t77;
    	let button5;
    	let t79;
    	let button6;
    	let t81;
    	let tr10;
    	let t82;
    	let tr11;
    	let th16;
    	let t83;
    	let br5;
    	let t84;
    	let t85;
    	let th17;
    	let h54;
    	let t87;
    	let h65;
    	let t89;
    	let p5;
    	let t91;
    	let div3;
    	let button7;
    	let t93;
    	let button8;
    	let t95;
    	let button9;
    	let t97;
    	let button10;
    	let t99;
    	let tr12;
    	let t100;
    	let tr13;
    	let th18;
    	let t101;
    	let br6;
    	let t102;
    	let t103;
    	let th19;
    	let h55;
    	let t105;
    	let h66;
    	let t107;
    	let p6;
    	let t109;
    	let div4;
    	let button11;
    	let t111;
    	let button12;
    	let t113;
    	let button13;
    	let t115;
    	let tr14;
    	let th20;
    	let t116;
    	let th21;
    	let h42;
    	let t118;
    	let tr15;
    	let th22;
    	let t120;
    	let th23;
    	let h56;
    	let t122;
    	let p7;
    	let t124;
    	let div5;
    	let a7;
    	let button14;
    	let i3;
    	let t125;
    	let t126;
    	let tr16;
    	let t127;
    	let tr17;
    	let th24;
    	let t129;
    	let th25;
    	let h57;
    	let t131;
    	let p8;
    	let t133;
    	let div6;
    	let a8;
    	let button15;
    	let i4;
    	let t134;
    	let t135;
    	let tr18;
    	let t136;
    	let tr19;
    	let th26;
    	let t137;
    	let br7;
    	let t138;
    	let t139;
    	let th27;
    	let h58;
    	let t141;
    	let h67;
    	let t143;
    	let p9;
    	let t145;
    	let div7;
    	let a9;
    	let button16;
    	let i5;
    	let t146;
    	let t147;
    	let tr20;
    	let t148;
    	let tr21;
    	let th28;
    	let t150;
    	let th29;
    	let h59;
    	let t152;
    	let h68;
    	let t154;
    	let p10;
    	let t156;
    	let div8;
    	let a10;
    	let button17;
    	let i6;
    	let t157;
    	let t158;
    	let tr22;
    	let th30;
    	let t159;
    	let th31;
    	let h43;
    	let t161;
    	let t162;
    	let tr23;
    	let th32;
    	let t163;
    	let th33;
    	let h44;
    	let t165;
    	let t166;
    	let tr24;
    	let th34;
    	let t167;
    	let th35;
    	let h45;
    	let t169;
    	let tr25;
    	let th36;
    	let t170;
    	let br8;
    	let t171;
    	let br9;
    	let t172;
    	let t173;
    	let th37;
    	let h510;
    	let t175;
    	let h69;
    	let t177;
    	let p11;
    	let t179;
    	let tr26;
    	let t180;
    	let tr27;
    	let th38;
    	let t182;
    	let th39;
    	let h511;
    	let t184;
    	let h610;
    	let t186;
    	let p12;
    	let t188;
    	let tr28;
    	let th40;
    	let t189;
    	let th41;
    	let h46;
    	let t191;
    	let tr29;
    	let th42;
    	let t192;
    	let br10;
    	let t193;
    	let t194;
    	let th43;
    	let h512;
    	let t196;
    	let h611;
    	let t198;
    	let p13;
    	let t200;
    	let br11;
    	let t201;
    	let tr30;
    	let th44;
    	let t202;
    	let br12;
    	let t203;
    	let t204;
    	let th45;
    	let h513;
    	let t206;
    	let h612;
    	let t208;
    	let p14;
    	let t210;
    	let br13;
    	let t211;
    	let tr31;
    	let th46;
    	let t212;
    	let br14;
    	let t213;
    	let t214;
    	let th47;
    	let h514;
    	let t216;
    	let tr32;
    	let th48;
    	let t217;
    	let th49;
    	let h47;
    	let t219;
    	let tr33;
    	let th50;
    	let t220;
    	let th51;
    	let h515;
    	let t222;
    	let tr34;
    	let th52;
    	let t224;
    	let th53;
    	let h516;
    	let t226;
    	let tr35;
    	let th54;
    	let t228;
    	let th55;
    	let h517;
    	let t230;
    	let br15;
    	let t231;
    	let tr36;
    	let th56;
    	let t232;
    	let th57;
    	let h518;
    	let t234;
    	let tr37;
    	let th58;
    	let t236;
    	let th59;
    	let h519;
    	let t238;
    	let tr38;
    	let th60;
    	let t240;
    	let th61;
    	let h520;
    	let t242;
    	let tr39;
    	let th62;
    	let t244;
    	let th63;
    	let h521;
    	let t246;
    	let tr40;
    	let th64;
    	let t248;
    	let th65;
    	let h522;
    	let t250;
    	let tr41;
    	let th66;
    	let t252;
    	let th67;
    	let h523;
    	let t254;
    	let tr42;
    	let th68;
    	let t255;
    	let th69;
    	let h48;
    	let t257;
    	let tr43;
    	let th70;
    	let t259;
    	let th71;
    	let h524;
    	let a11;
    	let t261;
    	let i7;
    	let t263;
    	let tr44;
    	let th72;
    	let t265;
    	let th73;
    	let h525;
    	let a12;
    	let t267;
    	let i8;
    	let t269;
    	let tr45;
    	let th74;
    	let t271;
    	let th75;
    	let h526;
    	let a13;
    	let t273;
    	let i9;
    	let t275;
    	let tr46;
    	let th76;
    	let t277;
    	let th77;
    	let h527;
    	let a14;
    	let t279;
    	let i10;
    	let t281;
    	let tr47;
    	let th78;
    	let t283;
    	let th79;
    	let h528;
    	let a15;
    	let t285;
    	let i11;
    	let t287;
    	let tr48;
    	let th80;
    	let t289;
    	let th81;
    	let h529;
    	let a16;
    	let t291;
    	let i12;
    	let t293;
    	let tr49;
    	let th82;
    	let t295;
    	let th83;
    	let h530;
    	let a17;
    	let t297;
    	let i13;
    	let t299;
    	let tr50;
    	let th84;
    	let t300;
    	let th85;
    	let h49;
    	let t302;
    	let tr51;
    	let th86;
    	let t304;
    	let th87;
    	let h531;
    	let t306;
    	let p15;
    	let t308;
    	let div9;
    	let a18;
    	let button18;
    	let i14;
    	let t309;
    	let t310;
    	let tr52;
    	let t311;
    	let tr53;
    	let th88;
    	let t313;
    	let th89;
    	let h532;
    	let t315;
    	let h613;
    	let t317;
    	let p16;
    	let t319;
    	let div10;
    	let a19;
    	let button19;
    	let i15;
    	let t320;
    	let t321;
    	let tr54;
    	let t322;
    	let tr55;
    	let th90;
    	let t324;
    	let th91;
    	let h533;
    	let t326;
    	let p17;
    	let t328;
    	let div11;
    	let a20;
    	let button20;
    	let i16;
    	let t329;
    	let t330;
    	let a21;
    	let button21;
    	let i17;
    	let t331;
    	let t332;
    	let tr56;
    	let t333;
    	let tr57;
    	let th92;
    	let t334;
    	let br16;
    	let t335;
    	let t336;
    	let th93;
    	let h534;
    	let t338;
    	let h614;
    	let t340;
    	let p18;
    	let t342;
    	let div12;
    	let a22;
    	let button22;
    	let i18;
    	let t343;
    	let t344;
    	let a23;
    	let button23;
    	let i19;
    	let t345;
    	let t346;
    	let a24;
    	let button24;
    	let i20;
    	let t347;
    	let t348;
    	let tr58;
    	let t349;
    	let tr59;
    	let th94;
    	let t351;
    	let th95;
    	let h535;
    	let t353;
    	let p19;
    	let t355;
    	let div13;
    	let a25;
    	let button25;
    	let i21;
    	let t356;
    	let t357;
    	let a26;
    	let button26;
    	let i22;
    	let t358;
    	let t359;
    	let tr60;
    	let th96;
    	let t360;
    	let th97;
    	let h410;
    	let t362;
    	let tr61;
    	let th98;
    	let t364;
    	let th99;
    	let h536;
    	let t366;
    	let h537;
    	let t368;
    	let a27;
    	let h538;
    	let t370;
    	let tr62;
    	let th100;
    	let t372;
    	let th101;
    	let a28;
    	let h539;
    	let t374;
    	let a29;
    	let h540;
    	let t376;
    	let a30;
    	let h541;
    	let t378;
    	let a31;
    	let h542;
    	let t380;
    	let h543;
    	let t382;
    	let tr63;
    	let th102;
    	let t383;
    	let th103;
    	let h411;
    	let t385;
    	let tr64;
    	let th104;
    	let t386;
    	let th105;
    	let h544;
    	let t388;
    	let div14;
    	let button27;
    	let t390;
    	let button28;
    	let t392;
    	let button29;
    	let t394;
    	let tr65;
    	let t395;
    	let tr66;
    	let th106;
    	let t396;
    	let th107;
    	let h545;
    	let t398;
    	let div15;
    	let button30;
    	let t400;
    	let button31;
    	let t402;
    	let button32;
    	let t404;
    	let button33;
    	let t406;
    	let button34;
    	let t408;
    	let button35;
    	let t410;
    	let button36;
    	let t412;
    	let tr67;
    	let t413;
    	let tr68;
    	let th108;
    	let t414;
    	let th109;
    	let h546;
    	let t416;
    	let div16;
    	let button37;
    	let t418;
    	let button38;
    	let t420;
    	let button39;
    	let t422;
    	let button40;
    	let t424;
    	let button41;
    	let t426;
    	let button42;
    	let t428;
    	let button43;
    	let t430;
    	let button44;
    	let t432;
    	let button45;
    	let t434;
    	let button46;
    	let t436;
    	let button47;
    	let t438;
    	let tr69;
    	let t439;
    	let tr70;
    	let th110;
    	let t440;
    	let th111;
    	let p20;
    	let current;
    	intro = new Intro({ $$inline: true });
    	social = new Social({ props: { home: false }, $$inline: true });
    	let each_value_1 = pubs;
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = other;
    	validate_each_argument(each_value);
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
    			create_component(intro.$$.fragment);
    			t9 = space();
    			create_component(social.$$.fragment);
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
    			t14 = text("August 2019 ");
    			br0 = element("br");
    			t15 = text(" - Present");
    			t16 = space();
    			th5 = element("th");
    			h50 = element("h5");
    			h50.textContent = "PhD in Human-Computer Interaction (HCI)";
    			t18 = space();
    			h60 = element("h6");
    			h60.textContent = "Carnegie Mellon University";
    			t20 = space();
    			p0 = element("p");
    			t21 = text("Advised by\n            ");
    			a0 = element("a");
    			a0.textContent = "Adam Perer";
    			t23 = text("\n            and\n            ");
    			a1 = element("a");
    			a1.textContent = "Jason Hong.";
    			t25 = space();
    			div0 = element("div");
    			a2 = element("a");
    			button0 = element("button");
    			i0 = element("i");
    			t26 = text("\n                Data Interaction Group");
    			t27 = space();
    			tr3 = element("tr");
    			t28 = space();
    			tr4 = element("tr");
    			th6 = element("th");
    			t29 = text("August 2015 ");
    			br1 = element("br");
    			t30 = text(" - May 2019");
    			t31 = space();
    			th7 = element("th");
    			h51 = element("h5");
    			h51.textContent = "B.S. in Computer Science";
    			t33 = space();
    			h61 = element("h6");
    			h61.textContent = "Georgia Institute of Technology";
    			t35 = space();
    			p1 = element("p");
    			t36 = text("Concentration in intelligence and modeling/simulation.\n            ");
    			br2 = element("br");
    			t37 = text("\n            Minor in economics.");
    			t38 = space();
    			tr5 = element("tr");
    			th8 = element("th");
    			th8.textContent = "Fall 2017";
    			t40 = space();
    			th9 = element("th");
    			h62 = element("h6");
    			h62.textContent = "Sciences Po - Paris, France";
    			t42 = space();
    			p2 = element("p");
    			p2.textContent = "Exchange program with a focus on economics and political science.";
    			t44 = space();
    			tr6 = element("tr");
    			th10 = element("th");
    			t45 = space();
    			th11 = element("th");
    			h41 = element("h4");
    			h41.textContent = "Work Experience";
    			t47 = space();
    			tr7 = element("tr");
    			th12 = element("th");
    			t48 = text("May 2020 ");
    			br3 = element("br");
    			t49 = text(" - August 2020");
    			t50 = space();
    			th13 = element("th");
    			h52 = element("h5");
    			h52.textContent = "Microsoft Research";
    			t52 = space();
    			h63 = element("h6");
    			h63.textContent = "Research Intern";
    			t54 = space();
    			p3 = element("p");
    			t55 = text("Worked on behavioral model understanding with\n            ");
    			a3 = element("a");
    			a3.textContent = "Steven Drucker";
    			t57 = text("\n            and\n            ");
    			a4 = element("a");
    			a4.textContent = "Marco Tulio Ribeiro.";
    			t59 = space();
    			div1 = element("div");
    			a5 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t60 = text(" VIDA Group");
    			t61 = space();
    			tr8 = element("tr");
    			t62 = space();
    			tr9 = element("tr");
    			th14 = element("th");
    			t63 = text("May 2018 ");
    			br4 = element("br");
    			t64 = text(" - August 2018");
    			t65 = space();
    			th15 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Google";
    			t67 = space();
    			h64 = element("h6");
    			h64.textContent = "Software Engineering Intern";
    			t69 = space();
    			p4 = element("p");
    			p4.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t71 = space();
    			div2 = element("div");
    			button2 = element("button");
    			a6 = element("a");
    			i2 = element("i");
    			t72 = text("\n                WSJ Article");
    			t73 = space();
    			button3 = element("button");
    			button3.textContent = "Android Auto";
    			t75 = space();
    			button4 = element("button");
    			button4.textContent = "Java";
    			t77 = space();
    			button5 = element("button");
    			button5.textContent = "C++";
    			t79 = space();
    			button6 = element("button");
    			button6.textContent = "Protocol Buffers";
    			t81 = space();
    			tr10 = element("tr");
    			t82 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			t83 = text("May 2017 ");
    			br5 = element("br");
    			t84 = text(" - August 2017");
    			t85 = space();
    			th17 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Google";
    			t87 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t89 = space();
    			p5 = element("p");
    			p5.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
    			t91 = space();
    			div3 = element("div");
    			button7 = element("button");
    			button7.textContent = "Apache Beam/Cloud DataFlow";
    			t93 = space();
    			button8 = element("button");
    			button8.textContent = "Java";
    			t95 = space();
    			button9 = element("button");
    			button9.textContent = "C++";
    			t97 = space();
    			button10 = element("button");
    			button10.textContent = "SQL";
    			t99 = space();
    			tr12 = element("tr");
    			t100 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			t101 = text("May 2016 ");
    			br6 = element("br");
    			t102 = text(" - August 2016");
    			t103 = space();
    			th19 = element("th");
    			h55 = element("h5");
    			h55.textContent = "Google";
    			t105 = space();
    			h66 = element("h6");
    			h66.textContent = "Engineering Practicum Intern";
    			t107 = space();
    			p6 = element("p");
    			p6.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t109 = space();
    			div4 = element("div");
    			button11 = element("button");
    			button11.textContent = "Go";
    			t111 = space();
    			button12 = element("button");
    			button12.textContent = "BigQuery";
    			t113 = space();
    			button13 = element("button");
    			button13.textContent = "JavaScript";
    			t115 = space();
    			tr14 = element("tr");
    			th20 = element("th");
    			t116 = space();
    			th21 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Awards";
    			t118 = space();
    			tr15 = element("tr");
    			th22 = element("th");
    			th22.textContent = "May 2019";
    			t120 = space();
    			th23 = element("th");
    			h56 = element("h5");
    			h56.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t122 = space();
    			p7 = element("p");
    			p7.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t124 = space();
    			div5 = element("div");
    			a7 = element("a");
    			button14 = element("button");
    			i3 = element("i");
    			t125 = text(" Website");
    			t126 = space();
    			tr16 = element("tr");
    			t127 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			th24.textContent = "May 2019";
    			t129 = space();
    			th25 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Love Family Foundation Scholarship";
    			t131 = space();
    			p8 = element("p");
    			p8.textContent = "Co-awarded the $10,000 scholarship for the undergraduate with the\n            most outstanding scholastic record.";
    			t133 = space();
    			div6 = element("div");
    			a8 = element("a");
    			button15 = element("button");
    			i4 = element("i");
    			t134 = text(" Announcement");
    			t135 = space();
    			tr18 = element("tr");
    			t136 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t137 = text("August 2015 ");
    			br7 = element("br");
    			t138 = text(" - May 2019");
    			t139 = space();
    			th27 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Stamps President's Scholar";
    			t141 = space();
    			h67 = element("h6");
    			h67.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t143 = space();
    			p9 = element("p");
    			p9.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 incoming students.";
    			t145 = space();
    			div7 = element("div");
    			a9 = element("a");
    			button16 = element("button");
    			i5 = element("i");
    			t146 = text(" Website");
    			t147 = space();
    			tr20 = element("tr");
    			t148 = space();
    			tr21 = element("tr");
    			th28 = element("th");
    			th28.textContent = "February 3, 2018";
    			t150 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "The Data Open Datathon";
    			t152 = space();
    			h68 = element("h6");
    			h68.textContent = "Correlation One and Citadel Securities";
    			t154 = space();
    			p10 = element("p");
    			p10.textContent = "Placed third and won $2,500 for creating a ML system to predict\n            dangerous road areas.";
    			t156 = space();
    			div8 = element("div");
    			a10 = element("a");
    			button17 = element("button");
    			i6 = element("i");
    			t157 = text(" Press Release");
    			t158 = space();
    			tr22 = element("tr");
    			th30 = element("th");
    			t159 = space();
    			th31 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Refereed Publications";
    			t161 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t162 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t163 = space();
    			th33 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Workshops, Demos, Posters, and Preprints";
    			t165 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t166 = space();
    			tr24 = element("tr");
    			th34 = element("th");
    			t167 = space();
    			th35 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Teaching";
    			t169 = space();
    			tr25 = element("tr");
    			th36 = element("th");
    			t170 = text("Fall 2016 ");
    			br8 = element("br");
    			t171 = text(" Spring 2017 ");
    			br9 = element("br");
    			t172 = text(" Spring 2018");
    			t173 = space();
    			th37 = element("th");
    			h510 = element("h5");
    			h510.textContent = "CS1332 - Data Structures and Algorithms";
    			t175 = space();
    			h69 = element("h6");
    			h69.textContent = "Undergraduate Teaching Assistant @ Georgia Tech";
    			t177 = space();
    			p11 = element("p");
    			p11.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t179 = space();
    			tr26 = element("tr");
    			t180 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Fall 2016";
    			t182 = space();
    			th39 = element("th");
    			h511 = element("h5");
    			h511.textContent = "GT 1000 - First-Year Seminar";
    			t184 = space();
    			h610 = element("h6");
    			h610.textContent = "Team Leader @ Georgia Tech";
    			t186 = space();
    			p12 = element("p");
    			p12.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t188 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			t189 = space();
    			th41 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Mentoring";
    			t191 = space();
    			tr29 = element("tr");
    			th42 = element("th");
    			t192 = text("Spring 2021 ");
    			br10 = element("br");
    			t193 = text(" - Present");
    			t194 = space();
    			th43 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Kazi Jawad";
    			t196 = space();
    			h611 = element("h6");
    			h611.textContent = "B.S. in Statistics and Machine Learning, Carnegie Mellon";
    			t198 = space();
    			p13 = element("p");
    			p13.textContent = "Interactive tagging of images.";
    			t200 = space();
    			br11 = element("br");
    			t201 = space();
    			tr30 = element("tr");
    			th44 = element("th");
    			t202 = text("Spring 2020 ");
    			br12 = element("br");
    			t203 = text(" - Present");
    			t204 = space();
    			th45 = element("th");
    			h513 = element("h5");
    			h513.textContent = "Abraham Druck";
    			t206 = space();
    			h612 = element("h6");
    			h612.textContent = "B.S. in Mathematical Sciences, Carnegie Mellon";
    			t208 = space();
    			p14 = element("p");
    			p14.textContent = "Crowdsourced discovery of ML blind spots for image captioning.";
    			t210 = space();
    			br13 = element("br");
    			t211 = space();
    			tr31 = element("tr");
    			th46 = element("th");
    			t212 = text("Fall 2020 ");
    			br14 = element("br");
    			t213 = text(" Spring 2020");
    			t214 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "CMU AI Mentoring Program";
    			t216 = space();
    			tr32 = element("tr");
    			th48 = element("th");
    			t217 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t219 = space();
    			tr33 = element("tr");
    			th50 = element("th");
    			t220 = space();
    			th51 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Student Volunteer";
    			t222 = space();
    			tr34 = element("tr");
    			th52 = element("th");
    			th52.textContent = "October 2019";
    			t224 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "IEEE Visualization (VIS)";
    			t226 = space();
    			tr35 = element("tr");
    			th54 = element("th");
    			th54.textContent = "January 2019";
    			t228 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t230 = space();
    			br15 = element("br");
    			t231 = space();
    			tr36 = element("tr");
    			th56 = element("th");
    			t232 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Reviewer";
    			t234 = space();
    			tr37 = element("tr");
    			th58 = element("th");
    			th58.textContent = "2021";
    			t236 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "ACM Conference on Computer-Supported Cooperative Work and Social\n            Computing (CSCW)";
    			t238 = space();
    			tr38 = element("tr");
    			th60 = element("th");
    			th60.textContent = "2021";
    			t240 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "ACM Conference on Human Factors in Computing Systems (CHI)";
    			t242 = space();
    			tr39 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2020";
    			t244 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "IEEE Visualization (VIS)";
    			t246 = space();
    			tr40 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2019, 2020";
    			t248 = space();
    			th65 = element("th");
    			h522 = element("h5");
    			h522.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t250 = space();
    			tr41 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2019";
    			t252 = space();
    			th67 = element("th");
    			h523 = element("h5");
    			h523.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t254 = space();
    			tr42 = element("tr");
    			th68 = element("th");
    			t255 = space();
    			th69 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Press";
    			t257 = space();
    			tr43 = element("tr");
    			th70 = element("th");
    			th70.textContent = "2020";
    			t259 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			a11 = element("a");
    			a11.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t261 = text("\n            -\n            ");
    			i7 = element("i");
    			i7.textContent = "CNN";
    			t263 = space();
    			tr44 = element("tr");
    			th72 = element("th");
    			th72.textContent = "2020";
    			t265 = space();
    			th73 = element("th");
    			h525 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t267 = text("\n            -\n            ");
    			i8 = element("i");
    			i8.textContent = "Wired";
    			t269 = space();
    			tr45 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2020";
    			t271 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t273 = text("\n            -\n            ");
    			i9 = element("i");
    			i9.textContent = "Carnegie Mellon";
    			t275 = space();
    			tr46 = element("tr");
    			th76 = element("th");
    			th76.textContent = "2020";
    			t277 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t279 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "Data Stories Podcast";
    			t281 = space();
    			tr47 = element("tr");
    			th78 = element("th");
    			th78.textContent = "2019";
    			t283 = space();
    			th79 = element("th");
    			h528 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t285 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "GT SCS";
    			t287 = space();
    			tr48 = element("tr");
    			th80 = element("th");
    			th80.textContent = "2019";
    			t289 = space();
    			th81 = element("th");
    			h529 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t291 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Georgia Tech";
    			t293 = space();
    			tr49 = element("tr");
    			th82 = element("th");
    			th82.textContent = "2018";
    			t295 = space();
    			th83 = element("th");
    			h530 = element("h5");
    			a17 = element("a");
    			a17.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t297 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "GT SCS";
    			t299 = space();
    			tr50 = element("tr");
    			th84 = element("th");
    			t300 = space();
    			th85 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Projects";
    			t302 = space();
    			tr51 = element("tr");
    			th86 = element("th");
    			th86.textContent = "Spring 2020";
    			t304 = space();
    			th87 = element("th");
    			h531 = element("h5");
    			h531.textContent = "COVIDCast Visualization of COVID Symptoms";
    			t306 = space();
    			p15 = element("p");
    			p15.textContent = "An interactive visualization for multiple indicators of COVID\n            symptoms collected by the CMU Delphi research group.";
    			t308 = space();
    			div9 = element("div");
    			a18 = element("a");
    			button18 = element("button");
    			i14 = element("i");
    			t309 = text(" Website");
    			t310 = space();
    			tr52 = element("tr");
    			t311 = space();
    			tr53 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Fall 2018";
    			t313 = space();
    			th89 = element("th");
    			h532 = element("h5");
    			h532.textContent = "ICLR'19 Reproducibility Challenge";
    			t315 = space();
    			h613 = element("h6");
    			h613.textContent = "Generative Adversarial Models for Learning Private and Fair\n            Representations";
    			t317 = space();
    			p16 = element("p");
    			p16.textContent = "Implemented and reproduced an ICLR'19 submission using GANs to\n            decorrelate sensitive data.";
    			t319 = space();
    			div10 = element("div");
    			a19 = element("a");
    			button19 = element("button");
    			i15 = element("i");
    			t320 = text(" GitHub");
    			t321 = space();
    			tr54 = element("tr");
    			t322 = space();
    			tr55 = element("tr");
    			th90 = element("th");
    			th90.textContent = "Spring 2018";
    			t324 = space();
    			th91 = element("th");
    			h533 = element("h5");
    			h533.textContent = "Georgia Tech Bus System Analysis";
    			t326 = space();
    			p17 = element("p");
    			p17.textContent = "System that combines Google Maps and graph algorithms to enable\n            navigation for GT buses.";
    			t328 = space();
    			div11 = element("div");
    			a20 = element("a");
    			button20 = element("button");
    			i16 = element("i");
    			t329 = text(" Poster");
    			t330 = space();
    			a21 = element("a");
    			button21 = element("button");
    			i17 = element("i");
    			t331 = text(" Class");
    			t332 = space();
    			tr56 = element("tr");
    			t333 = space();
    			tr57 = element("tr");
    			th92 = element("th");
    			t334 = text("September 2015 ");
    			br16 = element("br");
    			t335 = text(" - May 2017");
    			t336 = space();
    			th93 = element("th");
    			h534 = element("h5");
    			h534.textContent = "PROX-1 Satellite";
    			t338 = space();
    			h614 = element("h6");
    			h614.textContent = "Flight Software Lead and Researcher";
    			t340 = space();
    			p18 = element("p");
    			p18.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t342 = space();
    			div12 = element("div");
    			a22 = element("a");
    			button22 = element("button");
    			i18 = element("i");
    			t343 = text(" In space!");
    			t344 = space();
    			a23 = element("a");
    			button23 = element("button");
    			i19 = element("i");
    			t345 = text(" Website");
    			t346 = space();
    			a24 = element("a");
    			button24 = element("button");
    			i20 = element("i");
    			t347 = text(" Press release");
    			t348 = space();
    			tr58 = element("tr");
    			t349 = space();
    			tr59 = element("tr");
    			th94 = element("th");
    			th94.textContent = "Spring 2014";
    			t351 = space();
    			th95 = element("th");
    			h535 = element("h5");
    			h535.textContent = "CTF Resources";
    			t353 = space();
    			p19 = element("p");
    			p19.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1,000 stars on GitHub.";
    			t355 = space();
    			div13 = element("div");
    			a25 = element("a");
    			button25 = element("button");
    			i21 = element("i");
    			t356 = text(" Website");
    			t357 = space();
    			a26 = element("a");
    			button26 = element("button");
    			i22 = element("i");
    			t358 = text(" GitHub");
    			t359 = space();
    			tr60 = element("tr");
    			th96 = element("th");
    			t360 = space();
    			th97 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Selected Classes";
    			t362 = space();
    			tr61 = element("tr");
    			th98 = element("th");
    			th98.textContent = "PhD";
    			t364 = space();
    			th99 = element("th");
    			h536 = element("h5");
    			h536.textContent = "Causality and Machine Learning";
    			t366 = space();
    			h537 = element("h5");
    			h537.textContent = "Human Judgement and Decision Making";
    			t368 = space();
    			a27 = element("a");
    			h538 = element("h5");
    			h538.textContent = "Applied Research Methods";
    			t370 = space();
    			tr62 = element("tr");
    			th100 = element("th");
    			th100.textContent = "B.S.";
    			t372 = space();
    			th101 = element("th");
    			a28 = element("a");
    			h539 = element("h5");
    			h539.textContent = "Deep Learning";
    			t374 = space();
    			a29 = element("a");
    			h540 = element("h5");
    			h540.textContent = "Data and Visual Analytics";
    			t376 = space();
    			a30 = element("a");
    			h541 = element("h5");
    			h541.textContent = "Machine Learning";
    			t378 = space();
    			a31 = element("a");
    			h542 = element("h5");
    			h542.textContent = "Computer Simulation";
    			t380 = space();
    			h543 = element("h5");
    			h543.textContent = "Honors Algorithms";
    			t382 = space();
    			tr63 = element("tr");
    			th102 = element("th");
    			t383 = space();
    			th103 = element("th");
    			h411 = element("h4");
    			h411.textContent = "Skills";
    			t385 = space();
    			tr64 = element("tr");
    			th104 = element("th");
    			t386 = space();
    			th105 = element("th");
    			h544 = element("h5");
    			h544.textContent = "Languages";
    			t388 = space();
    			div14 = element("div");
    			button27 = element("button");
    			button27.textContent = "English - Native";
    			t390 = space();
    			button28 = element("button");
    			button28.textContent = "Spanish - Native";
    			t392 = space();
    			button29 = element("button");
    			button29.textContent = "French - Conversational (B1)";
    			t394 = space();
    			tr65 = element("tr");
    			t395 = space();
    			tr66 = element("tr");
    			th106 = element("th");
    			t396 = space();
    			th107 = element("th");
    			h545 = element("h5");
    			h545.textContent = "Programming Languages";
    			t398 = space();
    			div15 = element("div");
    			button30 = element("button");
    			button30.textContent = "Python";
    			t400 = space();
    			button31 = element("button");
    			button31.textContent = "JavaScript";
    			t402 = space();
    			button32 = element("button");
    			button32.textContent = "TypeScript";
    			t404 = space();
    			button33 = element("button");
    			button33.textContent = "Java";
    			t406 = space();
    			button34 = element("button");
    			button34.textContent = "C/C++";
    			t408 = space();
    			button35 = element("button");
    			button35.textContent = "SQL";
    			t410 = space();
    			button36 = element("button");
    			button36.textContent = "Go";
    			t412 = space();
    			tr67 = element("tr");
    			t413 = space();
    			tr68 = element("tr");
    			th108 = element("th");
    			t414 = space();
    			th109 = element("th");
    			h546 = element("h5");
    			h546.textContent = "Technologies";
    			t416 = space();
    			div16 = element("div");
    			button37 = element("button");
    			button37.textContent = "Machine Learning";
    			t418 = space();
    			button38 = element("button");
    			button38.textContent = "Full Stack Development";
    			t420 = space();
    			button39 = element("button");
    			button39.textContent = "PyTorch";
    			t422 = space();
    			button40 = element("button");
    			button40.textContent = "D3";
    			t424 = space();
    			button41 = element("button");
    			button41.textContent = "Vega";
    			t426 = space();
    			button42 = element("button");
    			button42.textContent = "Svelte";
    			t428 = space();
    			button43 = element("button");
    			button43.textContent = "React";
    			t430 = space();
    			button44 = element("button");
    			button44.textContent = "Jupyter Widgets";
    			t432 = space();
    			button45 = element("button");
    			button45.textContent = "AWS/Azure/Google Cloud";
    			t434 = space();
    			button46 = element("button");
    			button46.textContent = "Cloud Dataflow/MapReduce";
    			t436 = space();
    			button47 = element("button");
    			button47.textContent = "Amazon Mechanical Turk";
    			t438 = space();
    			tr69 = element("tr");
    			t439 = space();
    			tr70 = element("tr");
    			th110 = element("th");
    			t440 = space();
    			th111 = element("th");
    			p20 = element("p");
    			p20.textContent = "Last updated November 5, 2020.";
    			attr_dev(th0, "class", "date svelte-1jbn3ss");
    			add_location(th0, file$9, 19, 8, 493);
    			attr_dev(span0, "class", "color svelte-1jbn3ss");
    			add_location(span0, file$9, 22, 12, 577);
    			attr_dev(span1, "class", "color red svelte-1jbn3ss");
    			add_location(span1, file$9, 23, 12, 628);
    			attr_dev(span2, "class", "color svelte-1jbn3ss");
    			add_location(span2, file$9, 24, 12, 676);
    			attr_dev(span3, "class", "color red svelte-1jbn3ss");
    			add_location(span3, file$9, 25, 12, 727);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-1jbn3ss");
    			add_location(h3, file$9, 21, 10, 550);
    			attr_dev(th1, "class", "intro svelte-1jbn3ss");
    			add_location(th1, file$9, 20, 8, 521);
    			add_location(tr0, file$9, 18, 6, 480);
    			attr_dev(th2, "class", "date svelte-1jbn3ss");
    			add_location(th2, file$9, 34, 8, 907);
    			attr_dev(h40, "class", "header svelte-1jbn3ss");
    			add_location(h40, file$9, 36, 10, 950);
    			attr_dev(th3, "class", "svelte-1jbn3ss");
    			add_location(th3, file$9, 35, 8, 935);
    			add_location(tr1, file$9, 33, 6, 894);
    			add_location(br0, file$9, 40, 37, 1071);
    			attr_dev(th4, "class", "date svelte-1jbn3ss");
    			add_location(th4, file$9, 40, 8, 1042);
    			attr_dev(h50, "class", "svelte-1jbn3ss");
    			add_location(h50, file$9, 42, 10, 1116);
    			attr_dev(h60, "class", "svelte-1jbn3ss");
    			add_location(h60, file$9, 43, 10, 1175);
    			attr_dev(a0, "href", "http://perer.org");
    			add_location(a0, file$9, 46, 12, 1273);
    			attr_dev(a1, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a1, file$9, 48, 12, 1343);
    			attr_dev(p0, "class", "desc svelte-1jbn3ss");
    			add_location(p0, file$9, 44, 10, 1221);
    			attr_dev(i0, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i0, file$9, 53, 16, 1527);
    			attr_dev(button0, "class", "svelte-1jbn3ss");
    			add_location(button0, file$9, 52, 14, 1502);
    			attr_dev(a2, "href", "https://dig.cmu.edu/");
    			add_location(a2, file$9, 51, 12, 1456);
    			attr_dev(div0, "class", "tags svelte-1jbn3ss");
    			add_location(div0, file$9, 50, 10, 1425);
    			attr_dev(th5, "class", "svelte-1jbn3ss");
    			add_location(th5, file$9, 41, 8, 1101);
    			attr_dev(tr2, "class", "item svelte-1jbn3ss");
    			add_location(tr2, file$9, 39, 6, 1016);
    			attr_dev(tr3, "class", "buffer svelte-1jbn3ss");
    			add_location(tr3, file$9, 60, 6, 1683);
    			add_location(br1, file$9, 62, 37, 1766);
    			attr_dev(th6, "class", "date svelte-1jbn3ss");
    			add_location(th6, file$9, 62, 8, 1737);
    			attr_dev(h51, "class", "svelte-1jbn3ss");
    			add_location(h51, file$9, 64, 10, 1812);
    			attr_dev(h61, "class", "svelte-1jbn3ss");
    			add_location(h61, file$9, 65, 10, 1856);
    			add_location(br2, file$9, 68, 12, 2003);
    			attr_dev(p1, "class", "desc svelte-1jbn3ss");
    			add_location(p1, file$9, 66, 10, 1907);
    			attr_dev(th7, "class", "svelte-1jbn3ss");
    			add_location(th7, file$9, 63, 8, 1797);
    			attr_dev(tr4, "class", "item svelte-1jbn3ss");
    			add_location(tr4, file$9, 61, 6, 1711);
    			attr_dev(th8, "class", "date svelte-1jbn3ss");
    			add_location(th8, file$9, 74, 8, 2115);
    			attr_dev(h62, "class", "svelte-1jbn3ss");
    			add_location(h62, file$9, 76, 10, 2170);
    			attr_dev(p2, "class", "desc svelte-1jbn3ss");
    			add_location(p2, file$9, 77, 10, 2217);
    			attr_dev(th9, "class", "svelte-1jbn3ss");
    			add_location(th9, file$9, 75, 8, 2155);
    			attr_dev(tr5, "class", "item svelte-1jbn3ss");
    			add_location(tr5, file$9, 73, 6, 2089);
    			attr_dev(th10, "class", "date svelte-1jbn3ss");
    			add_location(th10, file$9, 84, 8, 2396);
    			attr_dev(h41, "class", "header svelte-1jbn3ss");
    			add_location(h41, file$9, 86, 10, 2439);
    			attr_dev(th11, "class", "svelte-1jbn3ss");
    			add_location(th11, file$9, 85, 8, 2424);
    			add_location(tr6, file$9, 83, 6, 2383);
    			add_location(br3, file$9, 90, 34, 2563);
    			attr_dev(th12, "class", "date svelte-1jbn3ss");
    			add_location(th12, file$9, 90, 8, 2537);
    			attr_dev(h52, "class", "svelte-1jbn3ss");
    			add_location(h52, file$9, 92, 10, 2612);
    			attr_dev(h63, "class", "svelte-1jbn3ss");
    			add_location(h63, file$9, 93, 10, 2650);
    			attr_dev(a3, "href", "https://www.microsoft.com/en-us/research/people/sdrucker/");
    			add_location(a3, file$9, 96, 12, 2772);
    			attr_dev(a4, "href", "https://homes.cs.washington.edu/~marcotcr/");
    			add_location(a4, file$9, 100, 12, 2915);
    			attr_dev(p3, "class", "desc svelte-1jbn3ss");
    			add_location(p3, file$9, 94, 10, 2685);
    			attr_dev(i1, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i1, file$9, 106, 23, 3164);
    			attr_dev(button1, "class", "svelte-1jbn3ss");
    			add_location(button1, file$9, 106, 14, 3155);
    			attr_dev(a5, "href", "https://www.microsoft.com/en-us/research/group/vida/");
    			add_location(a5, file$9, 105, 12, 3077);
    			attr_dev(div1, "class", "tags svelte-1jbn3ss");
    			add_location(div1, file$9, 104, 10, 3046);
    			attr_dev(th13, "class", "svelte-1jbn3ss");
    			add_location(th13, file$9, 91, 8, 2597);
    			attr_dev(tr7, "class", "item svelte-1jbn3ss");
    			add_location(tr7, file$9, 89, 6, 2511);
    			attr_dev(tr8, "class", "buffer svelte-1jbn3ss");
    			add_location(tr8, file$9, 111, 6, 3278);
    			add_location(br4, file$9, 113, 34, 3358);
    			attr_dev(th14, "class", "date svelte-1jbn3ss");
    			add_location(th14, file$9, 113, 8, 3332);
    			attr_dev(h53, "class", "svelte-1jbn3ss");
    			add_location(h53, file$9, 115, 10, 3407);
    			attr_dev(h64, "class", "svelte-1jbn3ss");
    			add_location(h64, file$9, 116, 10, 3433);
    			attr_dev(p4, "class", "desc svelte-1jbn3ss");
    			add_location(p4, file$9, 117, 10, 3480);
    			attr_dev(i2, "class", "far fa-newspaper svelte-1jbn3ss");
    			add_location(i2, file$9, 128, 16, 3925);
    			attr_dev(a6, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n                ");
    			add_location(a6, file$9, 124, 14, 3766);
    			attr_dev(button2, "class", "svelte-1jbn3ss");
    			add_location(button2, file$9, 123, 12, 3743);
    			attr_dev(button3, "class", "svelte-1jbn3ss");
    			add_location(button3, file$9, 132, 12, 4037);
    			attr_dev(button4, "class", "svelte-1jbn3ss");
    			add_location(button4, file$9, 133, 12, 4079);
    			attr_dev(button5, "class", "svelte-1jbn3ss");
    			add_location(button5, file$9, 134, 12, 4113);
    			attr_dev(button6, "class", "svelte-1jbn3ss");
    			add_location(button6, file$9, 135, 12, 4146);
    			attr_dev(div2, "class", "tags svelte-1jbn3ss");
    			add_location(div2, file$9, 122, 10, 3712);
    			attr_dev(th15, "class", "svelte-1jbn3ss");
    			add_location(th15, file$9, 114, 8, 3392);
    			attr_dev(tr9, "class", "item svelte-1jbn3ss");
    			add_location(tr9, file$9, 112, 6, 3306);
    			attr_dev(tr10, "class", "buffer svelte-1jbn3ss");
    			add_location(tr10, file$9, 139, 6, 4229);
    			add_location(br5, file$9, 141, 34, 4309);
    			attr_dev(th16, "class", "date svelte-1jbn3ss");
    			add_location(th16, file$9, 141, 8, 4283);
    			attr_dev(h54, "class", "svelte-1jbn3ss");
    			add_location(h54, file$9, 143, 10, 4358);
    			attr_dev(h65, "class", "svelte-1jbn3ss");
    			add_location(h65, file$9, 144, 10, 4384);
    			attr_dev(p5, "class", "desc svelte-1jbn3ss");
    			add_location(p5, file$9, 145, 10, 4431);
    			attr_dev(button7, "class", "svelte-1jbn3ss");
    			add_location(button7, file$9, 150, 12, 4623);
    			attr_dev(button8, "class", "svelte-1jbn3ss");
    			add_location(button8, file$9, 151, 12, 4679);
    			attr_dev(button9, "class", "svelte-1jbn3ss");
    			add_location(button9, file$9, 152, 12, 4713);
    			attr_dev(button10, "class", "svelte-1jbn3ss");
    			add_location(button10, file$9, 153, 12, 4746);
    			attr_dev(div3, "class", "tags svelte-1jbn3ss");
    			add_location(div3, file$9, 149, 10, 4592);
    			attr_dev(th17, "class", "svelte-1jbn3ss");
    			add_location(th17, file$9, 142, 8, 4343);
    			attr_dev(tr11, "class", "item svelte-1jbn3ss");
    			add_location(tr11, file$9, 140, 6, 4257);
    			attr_dev(tr12, "class", "buffer svelte-1jbn3ss");
    			add_location(tr12, file$9, 157, 6, 4816);
    			add_location(br6, file$9, 159, 34, 4896);
    			attr_dev(th18, "class", "date svelte-1jbn3ss");
    			add_location(th18, file$9, 159, 8, 4870);
    			attr_dev(h55, "class", "svelte-1jbn3ss");
    			add_location(h55, file$9, 161, 10, 4945);
    			attr_dev(h66, "class", "svelte-1jbn3ss");
    			add_location(h66, file$9, 162, 10, 4971);
    			attr_dev(p6, "class", "desc svelte-1jbn3ss");
    			add_location(p6, file$9, 163, 10, 5019);
    			attr_dev(button11, "class", "svelte-1jbn3ss");
    			add_location(button11, file$9, 168, 12, 5204);
    			attr_dev(button12, "class", "svelte-1jbn3ss");
    			add_location(button12, file$9, 169, 12, 5236);
    			attr_dev(button13, "class", "svelte-1jbn3ss");
    			add_location(button13, file$9, 170, 12, 5274);
    			attr_dev(div4, "class", "tags svelte-1jbn3ss");
    			add_location(div4, file$9, 167, 10, 5173);
    			attr_dev(th19, "class", "svelte-1jbn3ss");
    			add_location(th19, file$9, 160, 8, 4930);
    			attr_dev(tr13, "class", "item svelte-1jbn3ss");
    			add_location(tr13, file$9, 158, 6, 4844);
    			attr_dev(th20, "class", "date svelte-1jbn3ss");
    			add_location(th20, file$9, 176, 8, 5386);
    			attr_dev(h42, "class", "header svelte-1jbn3ss");
    			add_location(h42, file$9, 178, 10, 5429);
    			attr_dev(th21, "class", "svelte-1jbn3ss");
    			add_location(th21, file$9, 177, 8, 5414);
    			add_location(tr14, file$9, 175, 6, 5373);
    			attr_dev(th22, "class", "date svelte-1jbn3ss");
    			add_location(th22, file$9, 182, 8, 5518);
    			attr_dev(h56, "class", "svelte-1jbn3ss");
    			add_location(h56, file$9, 184, 10, 5572);
    			attr_dev(p7, "class", "desc svelte-1jbn3ss");
    			add_location(p7, file$9, 187, 10, 5683);
    			attr_dev(i3, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i3, file$9, 193, 23, 5944);
    			attr_dev(button14, "class", "svelte-1jbn3ss");
    			add_location(button14, file$9, 193, 14, 5935);
    			attr_dev(a7, "href", "https://www.nsfgrfp.org/");
    			add_location(a7, file$9, 192, 12, 5885);
    			attr_dev(div5, "class", "tags svelte-1jbn3ss");
    			add_location(div5, file$9, 191, 10, 5854);
    			attr_dev(th23, "class", "svelte-1jbn3ss");
    			add_location(th23, file$9, 183, 8, 5557);
    			attr_dev(tr15, "class", "item svelte-1jbn3ss");
    			add_location(tr15, file$9, 181, 6, 5492);
    			attr_dev(tr16, "class", "buffer svelte-1jbn3ss");
    			add_location(tr16, file$9, 198, 6, 6055);
    			attr_dev(th24, "class", "date svelte-1jbn3ss");
    			add_location(th24, file$9, 200, 8, 6109);
    			attr_dev(h57, "class", "svelte-1jbn3ss");
    			add_location(h57, file$9, 202, 10, 6163);
    			attr_dev(p8, "class", "desc svelte-1jbn3ss");
    			add_location(p8, file$9, 203, 10, 6217);
    			attr_dev(i4, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i4, file$9, 211, 23, 6595);
    			attr_dev(button15, "class", "svelte-1jbn3ss");
    			add_location(button15, file$9, 211, 14, 6586);
    			attr_dev(a8, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a8, file$9, 208, 12, 6416);
    			attr_dev(div6, "class", "tags svelte-1jbn3ss");
    			add_location(div6, file$9, 207, 10, 6385);
    			attr_dev(th25, "class", "svelte-1jbn3ss");
    			add_location(th25, file$9, 201, 8, 6148);
    			attr_dev(tr17, "class", "item svelte-1jbn3ss");
    			add_location(tr17, file$9, 199, 6, 6083);
    			attr_dev(tr18, "class", "buffer svelte-1jbn3ss");
    			add_location(tr18, file$9, 216, 6, 6711);
    			add_location(br7, file$9, 218, 37, 6794);
    			attr_dev(th26, "class", "date svelte-1jbn3ss");
    			add_location(th26, file$9, 218, 8, 6765);
    			attr_dev(h58, "class", "svelte-1jbn3ss");
    			add_location(h58, file$9, 220, 10, 6840);
    			attr_dev(h67, "class", "svelte-1jbn3ss");
    			add_location(h67, file$9, 221, 10, 6886);
    			attr_dev(p9, "class", "desc svelte-1jbn3ss");
    			add_location(p9, file$9, 222, 10, 6962);
    			attr_dev(i5, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i5, file$9, 228, 23, 7217);
    			attr_dev(button16, "class", "svelte-1jbn3ss");
    			add_location(button16, file$9, 228, 14, 7208);
    			attr_dev(a9, "href", "https://stampsps.gatech.edu/");
    			add_location(a9, file$9, 227, 12, 7154);
    			attr_dev(div7, "class", "tags svelte-1jbn3ss");
    			add_location(div7, file$9, 226, 10, 7123);
    			attr_dev(th27, "class", "svelte-1jbn3ss");
    			add_location(th27, file$9, 219, 8, 6825);
    			attr_dev(tr19, "class", "item svelte-1jbn3ss");
    			add_location(tr19, file$9, 217, 6, 6739);
    			attr_dev(tr20, "class", "buffer svelte-1jbn3ss");
    			add_location(tr20, file$9, 233, 6, 7328);
    			attr_dev(th28, "class", "date svelte-1jbn3ss");
    			add_location(th28, file$9, 235, 8, 7382);
    			attr_dev(h59, "class", "svelte-1jbn3ss");
    			add_location(h59, file$9, 237, 10, 7444);
    			attr_dev(h68, "class", "svelte-1jbn3ss");
    			add_location(h68, file$9, 238, 10, 7486);
    			attr_dev(p10, "class", "desc svelte-1jbn3ss");
    			add_location(p10, file$9, 239, 10, 7544);
    			attr_dev(i6, "class", "far fa-newspaper svelte-1jbn3ss");
    			add_location(i6, file$9, 247, 23, 7892);
    			attr_dev(button17, "class", "svelte-1jbn3ss");
    			add_location(button17, file$9, 247, 14, 7883);
    			attr_dev(a10, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a10, file$9, 244, 12, 7727);
    			attr_dev(div8, "class", "tags svelte-1jbn3ss");
    			add_location(div8, file$9, 243, 10, 7696);
    			attr_dev(th29, "class", "svelte-1jbn3ss");
    			add_location(th29, file$9, 236, 8, 7429);
    			attr_dev(tr21, "class", "item svelte-1jbn3ss");
    			add_location(tr21, file$9, 234, 6, 7356);
    			attr_dev(th30, "class", "date svelte-1jbn3ss");
    			add_location(th30, file$9, 290, 8, 9177);
    			attr_dev(h43, "class", "header svelte-1jbn3ss");
    			add_location(h43, file$9, 292, 10, 9220);
    			attr_dev(th31, "class", "svelte-1jbn3ss");
    			add_location(th31, file$9, 291, 8, 9205);
    			add_location(tr22, file$9, 289, 6, 9164);
    			attr_dev(th32, "class", "date svelte-1jbn3ss");
    			add_location(th32, file$9, 325, 8, 10132);
    			attr_dev(h44, "class", "header svelte-1jbn3ss");
    			add_location(h44, file$9, 327, 10, 10175);
    			attr_dev(th33, "class", "svelte-1jbn3ss");
    			add_location(th33, file$9, 326, 8, 10160);
    			add_location(tr23, file$9, 324, 6, 10119);
    			attr_dev(th34, "class", "date svelte-1jbn3ss");
    			add_location(th34, file$9, 360, 8, 11105);
    			attr_dev(h45, "class", "header svelte-1jbn3ss");
    			add_location(h45, file$9, 362, 10, 11148);
    			attr_dev(th35, "class", "svelte-1jbn3ss");
    			add_location(th35, file$9, 361, 8, 11133);
    			add_location(tr24, file$9, 359, 6, 11092);
    			add_location(br8, file$9, 366, 35, 11266);
    			add_location(br9, file$9, 366, 54, 11285);
    			attr_dev(th36, "class", "date svelte-1jbn3ss");
    			add_location(th36, file$9, 366, 8, 11239);
    			attr_dev(h510, "class", "svelte-1jbn3ss");
    			add_location(h510, file$9, 368, 10, 11332);
    			attr_dev(h69, "class", "svelte-1jbn3ss");
    			add_location(h69, file$9, 369, 10, 11391);
    			attr_dev(p11, "class", "desc svelte-1jbn3ss");
    			add_location(p11, file$9, 370, 10, 11458);
    			attr_dev(th37, "class", "svelte-1jbn3ss");
    			add_location(th37, file$9, 367, 8, 11317);
    			attr_dev(tr25, "class", "item svelte-1jbn3ss");
    			add_location(tr25, file$9, 365, 6, 11213);
    			attr_dev(tr26, "class", "buffer svelte-1jbn3ss");
    			add_location(tr26, file$9, 376, 6, 11643);
    			attr_dev(th38, "class", "date svelte-1jbn3ss");
    			add_location(th38, file$9, 378, 8, 11697);
    			attr_dev(h511, "class", "svelte-1jbn3ss");
    			add_location(h511, file$9, 380, 10, 11752);
    			attr_dev(h610, "class", "svelte-1jbn3ss");
    			add_location(h610, file$9, 381, 10, 11800);
    			attr_dev(p12, "class", "desc svelte-1jbn3ss");
    			add_location(p12, file$9, 382, 10, 11846);
    			attr_dev(th39, "class", "svelte-1jbn3ss");
    			add_location(th39, file$9, 379, 8, 11737);
    			attr_dev(tr27, "class", "item svelte-1jbn3ss");
    			add_location(tr27, file$9, 377, 6, 11671);
    			attr_dev(th40, "class", "date svelte-1jbn3ss");
    			add_location(th40, file$9, 390, 8, 12065);
    			attr_dev(h46, "class", "header svelte-1jbn3ss");
    			add_location(h46, file$9, 392, 10, 12108);
    			attr_dev(th41, "class", "svelte-1jbn3ss");
    			add_location(th41, file$9, 391, 8, 12093);
    			add_location(tr28, file$9, 389, 6, 12052);
    			add_location(br10, file$9, 396, 37, 12229);
    			attr_dev(th42, "class", "date svelte-1jbn3ss");
    			add_location(th42, file$9, 396, 8, 12200);
    			attr_dev(h512, "class", "svelte-1jbn3ss");
    			add_location(h512, file$9, 398, 10, 12274);
    			attr_dev(h611, "class", "svelte-1jbn3ss");
    			add_location(h611, file$9, 399, 10, 12304);
    			attr_dev(p13, "class", "desc svelte-1jbn3ss");
    			add_location(p13, file$9, 400, 10, 12380);
    			attr_dev(th43, "class", "svelte-1jbn3ss");
    			add_location(th43, file$9, 397, 8, 12259);
    			attr_dev(tr29, "class", "item svelte-1jbn3ss");
    			add_location(tr29, file$9, 395, 6, 12174);
    			add_location(br11, file$9, 403, 6, 12463);
    			add_location(br12, file$9, 405, 37, 12531);
    			attr_dev(th44, "class", "date svelte-1jbn3ss");
    			add_location(th44, file$9, 405, 8, 12502);
    			attr_dev(h513, "class", "svelte-1jbn3ss");
    			add_location(h513, file$9, 407, 10, 12576);
    			attr_dev(h612, "class", "svelte-1jbn3ss");
    			add_location(h612, file$9, 408, 10, 12609);
    			attr_dev(p14, "class", "desc svelte-1jbn3ss");
    			add_location(p14, file$9, 409, 10, 12675);
    			attr_dev(th45, "class", "svelte-1jbn3ss");
    			add_location(th45, file$9, 406, 8, 12561);
    			attr_dev(tr30, "class", "item svelte-1jbn3ss");
    			add_location(tr30, file$9, 404, 6, 12476);
    			add_location(br13, file$9, 414, 6, 12814);
    			add_location(br14, file$9, 416, 35, 12880);
    			attr_dev(th46, "class", "date svelte-1jbn3ss");
    			add_location(th46, file$9, 416, 8, 12853);
    			attr_dev(h514, "class", "svelte-1jbn3ss");
    			add_location(h514, file$9, 418, 10, 12927);
    			attr_dev(th47, "class", "svelte-1jbn3ss");
    			add_location(th47, file$9, 417, 8, 12912);
    			attr_dev(tr31, "class", "item svelte-1jbn3ss");
    			add_location(tr31, file$9, 415, 6, 12827);
    			attr_dev(th48, "class", "date svelte-1jbn3ss");
    			add_location(th48, file$9, 423, 8, 13029);
    			attr_dev(h47, "class", "header svelte-1jbn3ss");
    			add_location(h47, file$9, 425, 10, 13072);
    			attr_dev(th49, "class", "svelte-1jbn3ss");
    			add_location(th49, file$9, 424, 8, 13057);
    			add_location(tr32, file$9, 422, 6, 13016);
    			attr_dev(th50, "class", "date svelte-1jbn3ss");
    			add_location(th50, file$9, 429, 8, 13162);
    			attr_dev(h515, "class", "svelte-1jbn3ss");
    			add_location(h515, file$9, 431, 10, 13205);
    			attr_dev(th51, "class", "svelte-1jbn3ss");
    			add_location(th51, file$9, 430, 8, 13190);
    			attr_dev(tr33, "class", "item svelte-1jbn3ss");
    			add_location(tr33, file$9, 428, 6, 13136);
    			attr_dev(th52, "class", "date svelte-1jbn3ss");
    			add_location(th52, file$9, 435, 8, 13277);
    			attr_dev(h516, "class", "single svelte-1jbn3ss");
    			add_location(h516, file$9, 437, 10, 13335);
    			attr_dev(th53, "class", "svelte-1jbn3ss");
    			add_location(th53, file$9, 436, 8, 13320);
    			add_location(tr34, file$9, 434, 6, 13264);
    			attr_dev(th54, "class", "date svelte-1jbn3ss");
    			add_location(th54, file$9, 441, 8, 13429);
    			attr_dev(h517, "class", "single svelte-1jbn3ss");
    			add_location(h517, file$9, 443, 10, 13487);
    			attr_dev(th55, "class", "svelte-1jbn3ss");
    			add_location(th55, file$9, 442, 8, 13472);
    			add_location(tr35, file$9, 440, 6, 13416);
    			add_location(br15, file$9, 448, 6, 13621);
    			attr_dev(th56, "class", "date svelte-1jbn3ss");
    			add_location(th56, file$9, 450, 8, 13660);
    			attr_dev(h518, "class", "svelte-1jbn3ss");
    			add_location(h518, file$9, 452, 10, 13703);
    			attr_dev(th57, "class", "svelte-1jbn3ss");
    			add_location(th57, file$9, 451, 8, 13688);
    			attr_dev(tr36, "class", "item svelte-1jbn3ss");
    			add_location(tr36, file$9, 449, 6, 13634);
    			attr_dev(th58, "class", "date svelte-1jbn3ss");
    			add_location(th58, file$9, 456, 8, 13766);
    			attr_dev(h519, "class", "single svelte-1jbn3ss");
    			add_location(h519, file$9, 458, 10, 13816);
    			attr_dev(th59, "class", "svelte-1jbn3ss");
    			add_location(th59, file$9, 457, 8, 13801);
    			add_location(tr37, file$9, 455, 6, 13753);
    			attr_dev(th60, "class", "date svelte-1jbn3ss");
    			add_location(th60, file$9, 465, 8, 14003);
    			attr_dev(h520, "class", "single svelte-1jbn3ss");
    			add_location(h520, file$9, 467, 10, 14053);
    			attr_dev(th61, "class", "svelte-1jbn3ss");
    			add_location(th61, file$9, 466, 8, 14038);
    			add_location(tr38, file$9, 464, 6, 13990);
    			attr_dev(th62, "class", "date svelte-1jbn3ss");
    			add_location(th62, file$9, 473, 8, 14205);
    			attr_dev(h521, "class", "single svelte-1jbn3ss");
    			add_location(h521, file$9, 475, 10, 14255);
    			attr_dev(th63, "class", "svelte-1jbn3ss");
    			add_location(th63, file$9, 474, 8, 14240);
    			add_location(tr39, file$9, 472, 6, 14192);
    			attr_dev(th64, "class", "date svelte-1jbn3ss");
    			add_location(th64, file$9, 479, 8, 14349);
    			attr_dev(h522, "class", "single svelte-1jbn3ss");
    			add_location(h522, file$9, 481, 10, 14405);
    			attr_dev(th65, "class", "svelte-1jbn3ss");
    			add_location(th65, file$9, 480, 8, 14390);
    			add_location(tr40, file$9, 478, 6, 14336);
    			attr_dev(th66, "class", "date svelte-1jbn3ss");
    			add_location(th66, file$9, 487, 8, 14562);
    			attr_dev(h523, "class", "single svelte-1jbn3ss");
    			add_location(h523, file$9, 489, 10, 14612);
    			attr_dev(th67, "class", "svelte-1jbn3ss");
    			add_location(th67, file$9, 488, 8, 14597);
    			add_location(tr41, file$9, 486, 6, 14549);
    			attr_dev(th68, "class", "date svelte-1jbn3ss");
    			add_location(th68, file$9, 496, 8, 14785);
    			attr_dev(h48, "class", "header svelte-1jbn3ss");
    			add_location(h48, file$9, 498, 10, 14828);
    			attr_dev(th69, "class", "svelte-1jbn3ss");
    			add_location(th69, file$9, 497, 8, 14813);
    			add_location(tr42, file$9, 495, 6, 14772);
    			attr_dev(th70, "class", "date svelte-1jbn3ss");
    			add_location(th70, file$9, 502, 8, 14903);
    			attr_dev(a11, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			add_location(a11, file$9, 505, 12, 14991);
    			add_location(i7, file$9, 512, 12, 15309);
    			attr_dev(h524, "class", "single press svelte-1jbn3ss");
    			add_location(h524, file$9, 504, 10, 14953);
    			attr_dev(th71, "class", "svelte-1jbn3ss");
    			add_location(th71, file$9, 503, 8, 14938);
    			add_location(tr43, file$9, 501, 6, 14890);
    			attr_dev(th72, "class", "date svelte-1jbn3ss");
    			add_location(th72, file$9, 517, 8, 15381);
    			attr_dev(a12, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			add_location(a12, file$9, 520, 12, 15469);
    			add_location(i8, file$9, 526, 12, 15715);
    			attr_dev(h525, "class", "single press svelte-1jbn3ss");
    			add_location(h525, file$9, 519, 10, 15431);
    			attr_dev(th73, "class", "svelte-1jbn3ss");
    			add_location(th73, file$9, 518, 8, 15416);
    			add_location(tr44, file$9, 516, 6, 15368);
    			attr_dev(th74, "class", "date svelte-1jbn3ss");
    			add_location(th74, file$9, 531, 8, 15789);
    			attr_dev(a13, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			add_location(a13, file$9, 534, 12, 15877);
    			add_location(i9, file$9, 540, 12, 16114);
    			attr_dev(h526, "class", "single press svelte-1jbn3ss");
    			add_location(h526, file$9, 533, 10, 15839);
    			attr_dev(th75, "class", "svelte-1jbn3ss");
    			add_location(th75, file$9, 532, 8, 15824);
    			add_location(tr45, file$9, 530, 6, 15776);
    			attr_dev(th76, "class", "date svelte-1jbn3ss");
    			add_location(th76, file$9, 545, 8, 16198);
    			attr_dev(a14, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			add_location(a14, file$9, 548, 12, 16286);
    			add_location(i10, file$9, 554, 12, 16512);
    			attr_dev(h527, "class", "single press svelte-1jbn3ss");
    			add_location(h527, file$9, 547, 10, 16248);
    			attr_dev(th77, "class", "svelte-1jbn3ss");
    			add_location(th77, file$9, 546, 8, 16233);
    			add_location(tr46, file$9, 544, 6, 16185);
    			attr_dev(th78, "class", "date svelte-1jbn3ss");
    			add_location(th78, file$9, 559, 8, 16601);
    			attr_dev(a15, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a15, file$9, 562, 12, 16689);
    			add_location(i11, file$9, 568, 12, 16957);
    			attr_dev(h528, "class", "single press svelte-1jbn3ss");
    			add_location(h528, file$9, 561, 10, 16651);
    			attr_dev(th79, "class", "svelte-1jbn3ss");
    			add_location(th79, file$9, 560, 8, 16636);
    			add_location(tr47, file$9, 558, 6, 16588);
    			attr_dev(th80, "class", "date svelte-1jbn3ss");
    			add_location(th80, file$9, 573, 8, 17032);
    			attr_dev(a16, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a16, file$9, 576, 12, 17120);
    			add_location(i12, file$9, 582, 12, 17364);
    			attr_dev(h529, "class", "single press svelte-1jbn3ss");
    			add_location(h529, file$9, 575, 10, 17082);
    			attr_dev(th81, "class", "svelte-1jbn3ss");
    			add_location(th81, file$9, 574, 8, 17067);
    			add_location(tr48, file$9, 572, 6, 17019);
    			attr_dev(th82, "class", "date svelte-1jbn3ss");
    			add_location(th82, file$9, 587, 8, 17445);
    			attr_dev(a17, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a17, file$9, 590, 12, 17533);
    			add_location(i13, file$9, 597, 12, 17820);
    			attr_dev(h530, "class", "single press svelte-1jbn3ss");
    			add_location(h530, file$9, 589, 10, 17495);
    			attr_dev(th83, "class", "svelte-1jbn3ss");
    			add_location(th83, file$9, 588, 8, 17480);
    			add_location(tr49, file$9, 586, 6, 17432);
    			attr_dev(th84, "class", "date svelte-1jbn3ss");
    			add_location(th84, file$9, 603, 8, 17919);
    			attr_dev(h49, "class", "header svelte-1jbn3ss");
    			add_location(h49, file$9, 605, 10, 17962);
    			attr_dev(th85, "class", "svelte-1jbn3ss");
    			add_location(th85, file$9, 604, 8, 17947);
    			add_location(tr50, file$9, 602, 6, 17906);
    			attr_dev(th86, "class", "date svelte-1jbn3ss");
    			add_location(th86, file$9, 609, 8, 18053);
    			attr_dev(h531, "class", "svelte-1jbn3ss");
    			add_location(h531, file$9, 611, 10, 18110);
    			attr_dev(p15, "class", "desc svelte-1jbn3ss");
    			add_location(p15, file$9, 612, 10, 18171);
    			attr_dev(i14, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i14, file$9, 618, 23, 18444);
    			attr_dev(button18, "class", "svelte-1jbn3ss");
    			add_location(button18, file$9, 618, 14, 18435);
    			attr_dev(a18, "href", "https://covidcast.cmu.edu/");
    			add_location(a18, file$9, 617, 12, 18383);
    			attr_dev(div9, "class", "tags svelte-1jbn3ss");
    			add_location(div9, file$9, 616, 10, 18352);
    			attr_dev(th87, "class", "svelte-1jbn3ss");
    			add_location(th87, file$9, 610, 8, 18095);
    			attr_dev(tr51, "class", "item svelte-1jbn3ss");
    			add_location(tr51, file$9, 608, 6, 18027);
    			attr_dev(tr52, "class", "buffer svelte-1jbn3ss");
    			add_location(tr52, file$9, 623, 6, 18555);
    			attr_dev(th88, "class", "date svelte-1jbn3ss");
    			add_location(th88, file$9, 625, 8, 18609);
    			attr_dev(h532, "class", "svelte-1jbn3ss");
    			add_location(h532, file$9, 627, 10, 18664);
    			attr_dev(h613, "class", "svelte-1jbn3ss");
    			add_location(h613, file$9, 628, 10, 18717);
    			attr_dev(p16, "class", "desc svelte-1jbn3ss");
    			add_location(p16, file$9, 632, 10, 18848);
    			attr_dev(i15, "class", "fab fa-github svelte-1jbn3ss");
    			add_location(i15, file$9, 638, 23, 19118);
    			attr_dev(button19, "class", "svelte-1jbn3ss");
    			add_location(button19, file$9, 638, 14, 19109);
    			attr_dev(a19, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a19, file$9, 637, 12, 19036);
    			attr_dev(div10, "class", "tags svelte-1jbn3ss");
    			add_location(div10, file$9, 636, 10, 19005);
    			attr_dev(th89, "class", "svelte-1jbn3ss");
    			add_location(th89, file$9, 626, 8, 18649);
    			attr_dev(tr53, "class", "item svelte-1jbn3ss");
    			add_location(tr53, file$9, 624, 6, 18583);
    			attr_dev(tr54, "class", "buffer svelte-1jbn3ss");
    			add_location(tr54, file$9, 643, 6, 19229);
    			attr_dev(th90, "class", "date svelte-1jbn3ss");
    			add_location(th90, file$9, 645, 8, 19283);
    			attr_dev(h533, "class", "svelte-1jbn3ss");
    			add_location(h533, file$9, 647, 10, 19340);
    			attr_dev(p17, "class", "desc svelte-1jbn3ss");
    			add_location(p17, file$9, 648, 10, 19392);
    			attr_dev(i16, "class", "fas fa-file-pdf svelte-1jbn3ss");
    			add_location(i16, file$9, 654, 23, 19634);
    			attr_dev(button20, "class", "svelte-1jbn3ss");
    			add_location(button20, file$9, 654, 14, 19625);
    			attr_dev(a20, "href", "./gt_bus_analysis.pdf");
    			add_location(a20, file$9, 653, 12, 19578);
    			attr_dev(i17, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i17, file$9, 657, 23, 19791);
    			attr_dev(button21, "class", "svelte-1jbn3ss");
    			add_location(button21, file$9, 657, 14, 19782);
    			attr_dev(a21, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a21, file$9, 656, 12, 19710);
    			attr_dev(div11, "class", "tags svelte-1jbn3ss");
    			add_location(div11, file$9, 652, 10, 19547);
    			attr_dev(th91, "class", "svelte-1jbn3ss");
    			add_location(th91, file$9, 646, 8, 19325);
    			attr_dev(tr55, "class", "item svelte-1jbn3ss");
    			add_location(tr55, file$9, 644, 6, 19257);
    			attr_dev(tr56, "class", "buffer svelte-1jbn3ss");
    			add_location(tr56, file$9, 662, 6, 19900);
    			add_location(br16, file$9, 664, 40, 19986);
    			attr_dev(th92, "class", "date svelte-1jbn3ss");
    			add_location(th92, file$9, 664, 8, 19954);
    			attr_dev(h534, "class", "svelte-1jbn3ss");
    			add_location(h534, file$9, 666, 10, 20032);
    			attr_dev(h614, "class", "svelte-1jbn3ss");
    			add_location(h614, file$9, 667, 10, 20068);
    			attr_dev(p18, "class", "desc svelte-1jbn3ss");
    			add_location(p18, file$9, 668, 10, 20123);
    			attr_dev(i18, "class", "fas fa-rocket svelte-1jbn3ss");
    			add_location(i18, file$9, 676, 23, 20471);
    			attr_dev(button22, "class", "svelte-1jbn3ss");
    			add_location(button22, file$9, 676, 14, 20462);
    			attr_dev(a22, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a22, file$9, 673, 12, 20320);
    			attr_dev(i19, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i19, file$9, 679, 23, 20608);
    			attr_dev(button23, "class", "svelte-1jbn3ss");
    			add_location(button23, file$9, 679, 14, 20599);
    			attr_dev(a23, "href", "http://prox-1.gatech.edu/");
    			add_location(a23, file$9, 678, 12, 20548);
    			attr_dev(i20, "class", "far fa-newspaper svelte-1jbn3ss");
    			add_location(i20, file$9, 684, 23, 20809);
    			attr_dev(button24, "class", "svelte-1jbn3ss");
    			add_location(button24, file$9, 684, 14, 20800);
    			attr_dev(a24, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a24, file$9, 681, 12, 20682);
    			attr_dev(div12, "class", "tags svelte-1jbn3ss");
    			add_location(div12, file$9, 672, 10, 20289);
    			attr_dev(th93, "class", "svelte-1jbn3ss");
    			add_location(th93, file$9, 665, 8, 20017);
    			attr_dev(tr57, "class", "item svelte-1jbn3ss");
    			add_location(tr57, file$9, 663, 6, 19928);
    			attr_dev(tr58, "class", "buffer svelte-1jbn3ss");
    			add_location(tr58, file$9, 689, 6, 20930);
    			attr_dev(th94, "class", "date svelte-1jbn3ss");
    			add_location(th94, file$9, 691, 8, 20984);
    			attr_dev(h535, "class", "svelte-1jbn3ss");
    			add_location(h535, file$9, 693, 10, 21041);
    			attr_dev(p19, "class", "desc svelte-1jbn3ss");
    			add_location(p19, file$9, 694, 10, 21074);
    			attr_dev(i21, "class", "fas fa-globe svelte-1jbn3ss");
    			add_location(i21, file$9, 700, 23, 21331);
    			attr_dev(button25, "class", "svelte-1jbn3ss");
    			add_location(button25, file$9, 700, 14, 21322);
    			attr_dev(a25, "href", "http://ctfs.github.io/resources/");
    			add_location(a25, file$9, 699, 12, 21264);
    			attr_dev(i22, "class", "fab fa-github svelte-1jbn3ss");
    			add_location(i22, file$9, 703, 23, 21473);
    			attr_dev(button26, "class", "svelte-1jbn3ss");
    			add_location(button26, file$9, 703, 14, 21464);
    			attr_dev(a26, "href", "https://github.com/ctfs/resources");
    			add_location(a26, file$9, 702, 12, 21405);
    			attr_dev(div13, "class", "tags svelte-1jbn3ss");
    			add_location(div13, file$9, 698, 10, 21233);
    			attr_dev(th95, "class", "svelte-1jbn3ss");
    			add_location(th95, file$9, 692, 8, 21026);
    			attr_dev(tr59, "class", "item svelte-1jbn3ss");
    			add_location(tr59, file$9, 690, 6, 20958);
    			attr_dev(th96, "class", "date svelte-1jbn3ss");
    			add_location(th96, file$9, 783, 8, 23746);
    			attr_dev(h410, "class", "header svelte-1jbn3ss");
    			add_location(h410, file$9, 785, 10, 23789);
    			attr_dev(th97, "class", "svelte-1jbn3ss");
    			add_location(th97, file$9, 784, 8, 23774);
    			add_location(tr60, file$9, 782, 6, 23733);
    			attr_dev(th98, "class", "date svelte-1jbn3ss");
    			add_location(th98, file$9, 789, 8, 23888);
    			attr_dev(h536, "class", "single svelte-1jbn3ss");
    			add_location(h536, file$9, 791, 10, 23937);
    			attr_dev(h537, "class", "single svelte-1jbn3ss");
    			add_location(h537, file$9, 792, 10, 24002);
    			attr_dev(h538, "class", "single svelte-1jbn3ss");
    			add_location(h538, file$9, 794, 12, 24153);
    			attr_dev(a27, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a27, file$9, 793, 10, 24072);
    			attr_dev(th99, "class", "svelte-1jbn3ss");
    			add_location(th99, file$9, 790, 8, 23922);
    			attr_dev(tr61, "class", "item svelte-1jbn3ss");
    			add_location(tr61, file$9, 788, 6, 23862);
    			attr_dev(th100, "class", "date svelte-1jbn3ss");
    			add_location(th100, file$9, 799, 8, 24275);
    			attr_dev(h539, "class", "single svelte-1jbn3ss");
    			add_location(h539, file$9, 802, 12, 24402);
    			attr_dev(a28, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a28, file$9, 801, 10, 24325);
    			attr_dev(h540, "class", "single svelte-1jbn3ss");
    			add_location(h540, file$9, 805, 12, 24534);
    			attr_dev(a29, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a29, file$9, 804, 10, 24465);
    			attr_dev(h541, "class", "single svelte-1jbn3ss");
    			add_location(h541, file$9, 808, 12, 24686);
    			attr_dev(a30, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a30, file$9, 807, 10, 24609);
    			attr_dev(h542, "class", "single svelte-1jbn3ss");
    			add_location(h542, file$9, 811, 12, 24806);
    			attr_dev(a31, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a31, file$9, 810, 10, 24752);
    			attr_dev(h543, "class", "single svelte-1jbn3ss");
    			add_location(h543, file$9, 813, 10, 24875);
    			attr_dev(th101, "class", "svelte-1jbn3ss");
    			add_location(th101, file$9, 800, 8, 24310);
    			attr_dev(tr62, "class", "item svelte-1jbn3ss");
    			add_location(tr62, file$9, 798, 6, 24249);
    			attr_dev(th102, "class", "date svelte-1jbn3ss");
    			add_location(th102, file$9, 818, 8, 24984);
    			attr_dev(h411, "class", "header svelte-1jbn3ss");
    			add_location(h411, file$9, 820, 10, 25027);
    			attr_dev(th103, "class", "svelte-1jbn3ss");
    			add_location(th103, file$9, 819, 8, 25012);
    			add_location(tr63, file$9, 817, 6, 24971);
    			attr_dev(th104, "class", "date svelte-1jbn3ss");
    			add_location(th104, file$9, 824, 8, 25116);
    			attr_dev(h544, "class", "svelte-1jbn3ss");
    			add_location(h544, file$9, 826, 10, 25159);
    			attr_dev(button27, "class", "svelte-1jbn3ss");
    			add_location(button27, file$9, 828, 12, 25219);
    			attr_dev(button28, "class", "svelte-1jbn3ss");
    			add_location(button28, file$9, 829, 12, 25265);
    			attr_dev(button29, "class", "svelte-1jbn3ss");
    			add_location(button29, file$9, 830, 12, 25311);
    			attr_dev(div14, "class", "tags svelte-1jbn3ss");
    			add_location(div14, file$9, 827, 10, 25188);
    			attr_dev(th105, "class", "svelte-1jbn3ss");
    			add_location(th105, file$9, 825, 8, 25144);
    			attr_dev(tr64, "class", "item svelte-1jbn3ss");
    			add_location(tr64, file$9, 823, 6, 25090);
    			attr_dev(tr65, "class", "buffer svelte-1jbn3ss");
    			add_location(tr65, file$9, 834, 6, 25406);
    			attr_dev(th106, "class", "date svelte-1jbn3ss");
    			add_location(th106, file$9, 836, 8, 25460);
    			attr_dev(h545, "class", "svelte-1jbn3ss");
    			add_location(h545, file$9, 838, 10, 25503);
    			attr_dev(button30, "class", "svelte-1jbn3ss");
    			add_location(button30, file$9, 840, 12, 25575);
    			attr_dev(button31, "class", "svelte-1jbn3ss");
    			add_location(button31, file$9, 841, 12, 25611);
    			attr_dev(button32, "class", "svelte-1jbn3ss");
    			add_location(button32, file$9, 842, 12, 25651);
    			attr_dev(button33, "class", "svelte-1jbn3ss");
    			add_location(button33, file$9, 843, 12, 25691);
    			attr_dev(button34, "class", "svelte-1jbn3ss");
    			add_location(button34, file$9, 844, 12, 25725);
    			attr_dev(button35, "class", "svelte-1jbn3ss");
    			add_location(button35, file$9, 845, 12, 25760);
    			attr_dev(button36, "class", "svelte-1jbn3ss");
    			add_location(button36, file$9, 846, 12, 25793);
    			attr_dev(div15, "class", "tags svelte-1jbn3ss");
    			add_location(div15, file$9, 839, 10, 25544);
    			attr_dev(th107, "class", "svelte-1jbn3ss");
    			add_location(th107, file$9, 837, 8, 25488);
    			attr_dev(tr66, "class", "item svelte-1jbn3ss");
    			add_location(tr66, file$9, 835, 6, 25434);
    			attr_dev(tr67, "class", "buffer svelte-1jbn3ss");
    			add_location(tr67, file$9, 850, 6, 25862);
    			attr_dev(th108, "class", "date svelte-1jbn3ss");
    			add_location(th108, file$9, 852, 8, 25916);
    			attr_dev(h546, "class", "svelte-1jbn3ss");
    			add_location(h546, file$9, 854, 10, 25959);
    			attr_dev(button37, "class", "svelte-1jbn3ss");
    			add_location(button37, file$9, 856, 12, 26022);
    			attr_dev(button38, "class", "svelte-1jbn3ss");
    			add_location(button38, file$9, 857, 12, 26068);
    			attr_dev(button39, "class", "svelte-1jbn3ss");
    			add_location(button39, file$9, 858, 12, 26120);
    			attr_dev(button40, "class", "svelte-1jbn3ss");
    			add_location(button40, file$9, 859, 12, 26157);
    			attr_dev(button41, "class", "svelte-1jbn3ss");
    			add_location(button41, file$9, 860, 12, 26189);
    			attr_dev(button42, "class", "svelte-1jbn3ss");
    			add_location(button42, file$9, 861, 12, 26223);
    			attr_dev(button43, "class", "svelte-1jbn3ss");
    			add_location(button43, file$9, 862, 12, 26259);
    			attr_dev(button44, "class", "svelte-1jbn3ss");
    			add_location(button44, file$9, 863, 12, 26294);
    			attr_dev(button45, "class", "svelte-1jbn3ss");
    			add_location(button45, file$9, 864, 12, 26339);
    			attr_dev(button46, "class", "svelte-1jbn3ss");
    			add_location(button46, file$9, 865, 12, 26391);
    			attr_dev(button47, "class", "svelte-1jbn3ss");
    			add_location(button47, file$9, 866, 12, 26445);
    			attr_dev(div16, "class", "tags svelte-1jbn3ss");
    			add_location(div16, file$9, 855, 10, 25991);
    			attr_dev(th109, "class", "svelte-1jbn3ss");
    			add_location(th109, file$9, 853, 8, 25944);
    			attr_dev(tr68, "class", "item svelte-1jbn3ss");
    			add_location(tr68, file$9, 851, 6, 25890);
    			attr_dev(tr69, "class", "buffer svelte-1jbn3ss");
    			add_location(tr69, file$9, 870, 6, 26534);
    			attr_dev(th110, "class", "date svelte-1jbn3ss");
    			add_location(th110, file$9, 872, 8, 26588);
    			attr_dev(p20, "class", "desc svelte-1jbn3ss");
    			add_location(p20, file$9, 874, 10, 26631);
    			attr_dev(th111, "class", "svelte-1jbn3ss");
    			add_location(th111, file$9, 873, 8, 26616);
    			attr_dev(tr70, "class", "item svelte-1jbn3ss");
    			add_location(tr70, file$9, 871, 6, 26562);
    			attr_dev(table, "class", "svelte-1jbn3ss");
    			add_location(table, file$9, 17, 4, 466);
    			attr_dev(main, "class", "svelte-1jbn3ss");
    			add_location(main, file$9, 16, 2, 455);
    			attr_dev(div17, "id", "container");
    			attr_dev(div17, "class", "svelte-1jbn3ss");
    			add_location(div17, file$9, 15, 0, 432);
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
    			append_dev(th5, t20);
    			append_dev(th5, p0);
    			append_dev(p0, t21);
    			append_dev(p0, a0);
    			append_dev(p0, t23);
    			append_dev(p0, a1);
    			append_dev(th5, t25);
    			append_dev(th5, div0);
    			append_dev(div0, a2);
    			append_dev(a2, button0);
    			append_dev(button0, i0);
    			append_dev(button0, t26);
    			append_dev(table, t27);
    			append_dev(table, tr3);
    			append_dev(table, t28);
    			append_dev(table, tr4);
    			append_dev(tr4, th6);
    			append_dev(th6, t29);
    			append_dev(th6, br1);
    			append_dev(th6, t30);
    			append_dev(tr4, t31);
    			append_dev(tr4, th7);
    			append_dev(th7, h51);
    			append_dev(th7, t33);
    			append_dev(th7, h61);
    			append_dev(th7, t35);
    			append_dev(th7, p1);
    			append_dev(p1, t36);
    			append_dev(p1, br2);
    			append_dev(p1, t37);
    			append_dev(table, t38);
    			append_dev(table, tr5);
    			append_dev(tr5, th8);
    			append_dev(tr5, t40);
    			append_dev(tr5, th9);
    			append_dev(th9, h62);
    			append_dev(th9, t42);
    			append_dev(th9, p2);
    			append_dev(table, t44);
    			append_dev(table, tr6);
    			append_dev(tr6, th10);
    			append_dev(tr6, t45);
    			append_dev(tr6, th11);
    			append_dev(th11, h41);
    			append_dev(table, t47);
    			append_dev(table, tr7);
    			append_dev(tr7, th12);
    			append_dev(th12, t48);
    			append_dev(th12, br3);
    			append_dev(th12, t49);
    			append_dev(tr7, t50);
    			append_dev(tr7, th13);
    			append_dev(th13, h52);
    			append_dev(th13, t52);
    			append_dev(th13, h63);
    			append_dev(th13, t54);
    			append_dev(th13, p3);
    			append_dev(p3, t55);
    			append_dev(p3, a3);
    			append_dev(p3, t57);
    			append_dev(p3, a4);
    			append_dev(th13, t59);
    			append_dev(th13, div1);
    			append_dev(div1, a5);
    			append_dev(a5, button1);
    			append_dev(button1, i1);
    			append_dev(button1, t60);
    			append_dev(table, t61);
    			append_dev(table, tr8);
    			append_dev(table, t62);
    			append_dev(table, tr9);
    			append_dev(tr9, th14);
    			append_dev(th14, t63);
    			append_dev(th14, br4);
    			append_dev(th14, t64);
    			append_dev(tr9, t65);
    			append_dev(tr9, th15);
    			append_dev(th15, h53);
    			append_dev(th15, t67);
    			append_dev(th15, h64);
    			append_dev(th15, t69);
    			append_dev(th15, p4);
    			append_dev(th15, t71);
    			append_dev(th15, div2);
    			append_dev(div2, button2);
    			append_dev(button2, a6);
    			append_dev(a6, i2);
    			append_dev(a6, t72);
    			append_dev(div2, t73);
    			append_dev(div2, button3);
    			append_dev(div2, t75);
    			append_dev(div2, button4);
    			append_dev(div2, t77);
    			append_dev(div2, button5);
    			append_dev(div2, t79);
    			append_dev(div2, button6);
    			append_dev(table, t81);
    			append_dev(table, tr10);
    			append_dev(table, t82);
    			append_dev(table, tr11);
    			append_dev(tr11, th16);
    			append_dev(th16, t83);
    			append_dev(th16, br5);
    			append_dev(th16, t84);
    			append_dev(tr11, t85);
    			append_dev(tr11, th17);
    			append_dev(th17, h54);
    			append_dev(th17, t87);
    			append_dev(th17, h65);
    			append_dev(th17, t89);
    			append_dev(th17, p5);
    			append_dev(th17, t91);
    			append_dev(th17, div3);
    			append_dev(div3, button7);
    			append_dev(div3, t93);
    			append_dev(div3, button8);
    			append_dev(div3, t95);
    			append_dev(div3, button9);
    			append_dev(div3, t97);
    			append_dev(div3, button10);
    			append_dev(table, t99);
    			append_dev(table, tr12);
    			append_dev(table, t100);
    			append_dev(table, tr13);
    			append_dev(tr13, th18);
    			append_dev(th18, t101);
    			append_dev(th18, br6);
    			append_dev(th18, t102);
    			append_dev(tr13, t103);
    			append_dev(tr13, th19);
    			append_dev(th19, h55);
    			append_dev(th19, t105);
    			append_dev(th19, h66);
    			append_dev(th19, t107);
    			append_dev(th19, p6);
    			append_dev(th19, t109);
    			append_dev(th19, div4);
    			append_dev(div4, button11);
    			append_dev(div4, t111);
    			append_dev(div4, button12);
    			append_dev(div4, t113);
    			append_dev(div4, button13);
    			append_dev(table, t115);
    			append_dev(table, tr14);
    			append_dev(tr14, th20);
    			append_dev(tr14, t116);
    			append_dev(tr14, th21);
    			append_dev(th21, h42);
    			append_dev(table, t118);
    			append_dev(table, tr15);
    			append_dev(tr15, th22);
    			append_dev(tr15, t120);
    			append_dev(tr15, th23);
    			append_dev(th23, h56);
    			append_dev(th23, t122);
    			append_dev(th23, p7);
    			append_dev(th23, t124);
    			append_dev(th23, div5);
    			append_dev(div5, a7);
    			append_dev(a7, button14);
    			append_dev(button14, i3);
    			append_dev(button14, t125);
    			append_dev(table, t126);
    			append_dev(table, tr16);
    			append_dev(table, t127);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(tr17, t129);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t131);
    			append_dev(th25, p8);
    			append_dev(th25, t133);
    			append_dev(th25, div6);
    			append_dev(div6, a8);
    			append_dev(a8, button15);
    			append_dev(button15, i4);
    			append_dev(button15, t134);
    			append_dev(table, t135);
    			append_dev(table, tr18);
    			append_dev(table, t136);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(th26, t137);
    			append_dev(th26, br7);
    			append_dev(th26, t138);
    			append_dev(tr19, t139);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t141);
    			append_dev(th27, h67);
    			append_dev(th27, t143);
    			append_dev(th27, p9);
    			append_dev(th27, t145);
    			append_dev(th27, div7);
    			append_dev(div7, a9);
    			append_dev(a9, button16);
    			append_dev(button16, i5);
    			append_dev(button16, t146);
    			append_dev(table, t147);
    			append_dev(table, tr20);
    			append_dev(table, t148);
    			append_dev(table, tr21);
    			append_dev(tr21, th28);
    			append_dev(tr21, t150);
    			append_dev(tr21, th29);
    			append_dev(th29, h59);
    			append_dev(th29, t152);
    			append_dev(th29, h68);
    			append_dev(th29, t154);
    			append_dev(th29, p10);
    			append_dev(th29, t156);
    			append_dev(th29, div8);
    			append_dev(div8, a10);
    			append_dev(a10, button17);
    			append_dev(button17, i6);
    			append_dev(button17, t157);
    			append_dev(table, t158);
    			append_dev(table, tr22);
    			append_dev(tr22, th30);
    			append_dev(tr22, t159);
    			append_dev(tr22, th31);
    			append_dev(th31, h43);
    			append_dev(table, t161);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(table, null);
    			}

    			append_dev(table, t162);
    			append_dev(table, tr23);
    			append_dev(tr23, th32);
    			append_dev(tr23, t163);
    			append_dev(tr23, th33);
    			append_dev(th33, h44);
    			append_dev(table, t165);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t166);
    			append_dev(table, tr24);
    			append_dev(tr24, th34);
    			append_dev(tr24, t167);
    			append_dev(tr24, th35);
    			append_dev(th35, h45);
    			append_dev(table, t169);
    			append_dev(table, tr25);
    			append_dev(tr25, th36);
    			append_dev(th36, t170);
    			append_dev(th36, br8);
    			append_dev(th36, t171);
    			append_dev(th36, br9);
    			append_dev(th36, t172);
    			append_dev(tr25, t173);
    			append_dev(tr25, th37);
    			append_dev(th37, h510);
    			append_dev(th37, t175);
    			append_dev(th37, h69);
    			append_dev(th37, t177);
    			append_dev(th37, p11);
    			append_dev(table, t179);
    			append_dev(table, tr26);
    			append_dev(table, t180);
    			append_dev(table, tr27);
    			append_dev(tr27, th38);
    			append_dev(tr27, t182);
    			append_dev(tr27, th39);
    			append_dev(th39, h511);
    			append_dev(th39, t184);
    			append_dev(th39, h610);
    			append_dev(th39, t186);
    			append_dev(th39, p12);
    			append_dev(table, t188);
    			append_dev(table, tr28);
    			append_dev(tr28, th40);
    			append_dev(tr28, t189);
    			append_dev(tr28, th41);
    			append_dev(th41, h46);
    			append_dev(table, t191);
    			append_dev(table, tr29);
    			append_dev(tr29, th42);
    			append_dev(th42, t192);
    			append_dev(th42, br10);
    			append_dev(th42, t193);
    			append_dev(tr29, t194);
    			append_dev(tr29, th43);
    			append_dev(th43, h512);
    			append_dev(th43, t196);
    			append_dev(th43, h611);
    			append_dev(th43, t198);
    			append_dev(th43, p13);
    			append_dev(table, t200);
    			append_dev(table, br11);
    			append_dev(table, t201);
    			append_dev(table, tr30);
    			append_dev(tr30, th44);
    			append_dev(th44, t202);
    			append_dev(th44, br12);
    			append_dev(th44, t203);
    			append_dev(tr30, t204);
    			append_dev(tr30, th45);
    			append_dev(th45, h513);
    			append_dev(th45, t206);
    			append_dev(th45, h612);
    			append_dev(th45, t208);
    			append_dev(th45, p14);
    			append_dev(table, t210);
    			append_dev(table, br13);
    			append_dev(table, t211);
    			append_dev(table, tr31);
    			append_dev(tr31, th46);
    			append_dev(th46, t212);
    			append_dev(th46, br14);
    			append_dev(th46, t213);
    			append_dev(tr31, t214);
    			append_dev(tr31, th47);
    			append_dev(th47, h514);
    			append_dev(table, t216);
    			append_dev(table, tr32);
    			append_dev(tr32, th48);
    			append_dev(tr32, t217);
    			append_dev(tr32, th49);
    			append_dev(th49, h47);
    			append_dev(table, t219);
    			append_dev(table, tr33);
    			append_dev(tr33, th50);
    			append_dev(tr33, t220);
    			append_dev(tr33, th51);
    			append_dev(th51, h515);
    			append_dev(table, t222);
    			append_dev(table, tr34);
    			append_dev(tr34, th52);
    			append_dev(tr34, t224);
    			append_dev(tr34, th53);
    			append_dev(th53, h516);
    			append_dev(table, t226);
    			append_dev(table, tr35);
    			append_dev(tr35, th54);
    			append_dev(tr35, t228);
    			append_dev(tr35, th55);
    			append_dev(th55, h517);
    			append_dev(table, t230);
    			append_dev(table, br15);
    			append_dev(table, t231);
    			append_dev(table, tr36);
    			append_dev(tr36, th56);
    			append_dev(tr36, t232);
    			append_dev(tr36, th57);
    			append_dev(th57, h518);
    			append_dev(table, t234);
    			append_dev(table, tr37);
    			append_dev(tr37, th58);
    			append_dev(tr37, t236);
    			append_dev(tr37, th59);
    			append_dev(th59, h519);
    			append_dev(table, t238);
    			append_dev(table, tr38);
    			append_dev(tr38, th60);
    			append_dev(tr38, t240);
    			append_dev(tr38, th61);
    			append_dev(th61, h520);
    			append_dev(table, t242);
    			append_dev(table, tr39);
    			append_dev(tr39, th62);
    			append_dev(tr39, t244);
    			append_dev(tr39, th63);
    			append_dev(th63, h521);
    			append_dev(table, t246);
    			append_dev(table, tr40);
    			append_dev(tr40, th64);
    			append_dev(tr40, t248);
    			append_dev(tr40, th65);
    			append_dev(th65, h522);
    			append_dev(table, t250);
    			append_dev(table, tr41);
    			append_dev(tr41, th66);
    			append_dev(tr41, t252);
    			append_dev(tr41, th67);
    			append_dev(th67, h523);
    			append_dev(table, t254);
    			append_dev(table, tr42);
    			append_dev(tr42, th68);
    			append_dev(tr42, t255);
    			append_dev(tr42, th69);
    			append_dev(th69, h48);
    			append_dev(table, t257);
    			append_dev(table, tr43);
    			append_dev(tr43, th70);
    			append_dev(tr43, t259);
    			append_dev(tr43, th71);
    			append_dev(th71, h524);
    			append_dev(h524, a11);
    			append_dev(h524, t261);
    			append_dev(h524, i7);
    			append_dev(table, t263);
    			append_dev(table, tr44);
    			append_dev(tr44, th72);
    			append_dev(tr44, t265);
    			append_dev(tr44, th73);
    			append_dev(th73, h525);
    			append_dev(h525, a12);
    			append_dev(h525, t267);
    			append_dev(h525, i8);
    			append_dev(table, t269);
    			append_dev(table, tr45);
    			append_dev(tr45, th74);
    			append_dev(tr45, t271);
    			append_dev(tr45, th75);
    			append_dev(th75, h526);
    			append_dev(h526, a13);
    			append_dev(h526, t273);
    			append_dev(h526, i9);
    			append_dev(table, t275);
    			append_dev(table, tr46);
    			append_dev(tr46, th76);
    			append_dev(tr46, t277);
    			append_dev(tr46, th77);
    			append_dev(th77, h527);
    			append_dev(h527, a14);
    			append_dev(h527, t279);
    			append_dev(h527, i10);
    			append_dev(table, t281);
    			append_dev(table, tr47);
    			append_dev(tr47, th78);
    			append_dev(tr47, t283);
    			append_dev(tr47, th79);
    			append_dev(th79, h528);
    			append_dev(h528, a15);
    			append_dev(h528, t285);
    			append_dev(h528, i11);
    			append_dev(table, t287);
    			append_dev(table, tr48);
    			append_dev(tr48, th80);
    			append_dev(tr48, t289);
    			append_dev(tr48, th81);
    			append_dev(th81, h529);
    			append_dev(h529, a16);
    			append_dev(h529, t291);
    			append_dev(h529, i12);
    			append_dev(table, t293);
    			append_dev(table, tr49);
    			append_dev(tr49, th82);
    			append_dev(tr49, t295);
    			append_dev(tr49, th83);
    			append_dev(th83, h530);
    			append_dev(h530, a17);
    			append_dev(h530, t297);
    			append_dev(h530, i13);
    			append_dev(table, t299);
    			append_dev(table, tr50);
    			append_dev(tr50, th84);
    			append_dev(tr50, t300);
    			append_dev(tr50, th85);
    			append_dev(th85, h49);
    			append_dev(table, t302);
    			append_dev(table, tr51);
    			append_dev(tr51, th86);
    			append_dev(tr51, t304);
    			append_dev(tr51, th87);
    			append_dev(th87, h531);
    			append_dev(th87, t306);
    			append_dev(th87, p15);
    			append_dev(th87, t308);
    			append_dev(th87, div9);
    			append_dev(div9, a18);
    			append_dev(a18, button18);
    			append_dev(button18, i14);
    			append_dev(button18, t309);
    			append_dev(table, t310);
    			append_dev(table, tr52);
    			append_dev(table, t311);
    			append_dev(table, tr53);
    			append_dev(tr53, th88);
    			append_dev(tr53, t313);
    			append_dev(tr53, th89);
    			append_dev(th89, h532);
    			append_dev(th89, t315);
    			append_dev(th89, h613);
    			append_dev(th89, t317);
    			append_dev(th89, p16);
    			append_dev(th89, t319);
    			append_dev(th89, div10);
    			append_dev(div10, a19);
    			append_dev(a19, button19);
    			append_dev(button19, i15);
    			append_dev(button19, t320);
    			append_dev(table, t321);
    			append_dev(table, tr54);
    			append_dev(table, t322);
    			append_dev(table, tr55);
    			append_dev(tr55, th90);
    			append_dev(tr55, t324);
    			append_dev(tr55, th91);
    			append_dev(th91, h533);
    			append_dev(th91, t326);
    			append_dev(th91, p17);
    			append_dev(th91, t328);
    			append_dev(th91, div11);
    			append_dev(div11, a20);
    			append_dev(a20, button20);
    			append_dev(button20, i16);
    			append_dev(button20, t329);
    			append_dev(div11, t330);
    			append_dev(div11, a21);
    			append_dev(a21, button21);
    			append_dev(button21, i17);
    			append_dev(button21, t331);
    			append_dev(table, t332);
    			append_dev(table, tr56);
    			append_dev(table, t333);
    			append_dev(table, tr57);
    			append_dev(tr57, th92);
    			append_dev(th92, t334);
    			append_dev(th92, br16);
    			append_dev(th92, t335);
    			append_dev(tr57, t336);
    			append_dev(tr57, th93);
    			append_dev(th93, h534);
    			append_dev(th93, t338);
    			append_dev(th93, h614);
    			append_dev(th93, t340);
    			append_dev(th93, p18);
    			append_dev(th93, t342);
    			append_dev(th93, div12);
    			append_dev(div12, a22);
    			append_dev(a22, button22);
    			append_dev(button22, i18);
    			append_dev(button22, t343);
    			append_dev(div12, t344);
    			append_dev(div12, a23);
    			append_dev(a23, button23);
    			append_dev(button23, i19);
    			append_dev(button23, t345);
    			append_dev(div12, t346);
    			append_dev(div12, a24);
    			append_dev(a24, button24);
    			append_dev(button24, i20);
    			append_dev(button24, t347);
    			append_dev(table, t348);
    			append_dev(table, tr58);
    			append_dev(table, t349);
    			append_dev(table, tr59);
    			append_dev(tr59, th94);
    			append_dev(tr59, t351);
    			append_dev(tr59, th95);
    			append_dev(th95, h535);
    			append_dev(th95, t353);
    			append_dev(th95, p19);
    			append_dev(th95, t355);
    			append_dev(th95, div13);
    			append_dev(div13, a25);
    			append_dev(a25, button25);
    			append_dev(button25, i21);
    			append_dev(button25, t356);
    			append_dev(div13, t357);
    			append_dev(div13, a26);
    			append_dev(a26, button26);
    			append_dev(button26, i22);
    			append_dev(button26, t358);
    			append_dev(table, t359);
    			append_dev(table, tr60);
    			append_dev(tr60, th96);
    			append_dev(tr60, t360);
    			append_dev(tr60, th97);
    			append_dev(th97, h410);
    			append_dev(table, t362);
    			append_dev(table, tr61);
    			append_dev(tr61, th98);
    			append_dev(tr61, t364);
    			append_dev(tr61, th99);
    			append_dev(th99, h536);
    			append_dev(th99, t366);
    			append_dev(th99, h537);
    			append_dev(th99, t368);
    			append_dev(th99, a27);
    			append_dev(a27, h538);
    			append_dev(table, t370);
    			append_dev(table, tr62);
    			append_dev(tr62, th100);
    			append_dev(tr62, t372);
    			append_dev(tr62, th101);
    			append_dev(th101, a28);
    			append_dev(a28, h539);
    			append_dev(th101, t374);
    			append_dev(th101, a29);
    			append_dev(a29, h540);
    			append_dev(th101, t376);
    			append_dev(th101, a30);
    			append_dev(a30, h541);
    			append_dev(th101, t378);
    			append_dev(th101, a31);
    			append_dev(a31, h542);
    			append_dev(th101, t380);
    			append_dev(th101, h543);
    			append_dev(table, t382);
    			append_dev(table, tr63);
    			append_dev(tr63, th102);
    			append_dev(tr63, t383);
    			append_dev(tr63, th103);
    			append_dev(th103, h411);
    			append_dev(table, t385);
    			append_dev(table, tr64);
    			append_dev(tr64, th104);
    			append_dev(tr64, t386);
    			append_dev(tr64, th105);
    			append_dev(th105, h544);
    			append_dev(th105, t388);
    			append_dev(th105, div14);
    			append_dev(div14, button27);
    			append_dev(div14, t390);
    			append_dev(div14, button28);
    			append_dev(div14, t392);
    			append_dev(div14, button29);
    			append_dev(table, t394);
    			append_dev(table, tr65);
    			append_dev(table, t395);
    			append_dev(table, tr66);
    			append_dev(tr66, th106);
    			append_dev(tr66, t396);
    			append_dev(tr66, th107);
    			append_dev(th107, h545);
    			append_dev(th107, t398);
    			append_dev(th107, div15);
    			append_dev(div15, button30);
    			append_dev(div15, t400);
    			append_dev(div15, button31);
    			append_dev(div15, t402);
    			append_dev(div15, button32);
    			append_dev(div15, t404);
    			append_dev(div15, button33);
    			append_dev(div15, t406);
    			append_dev(div15, button34);
    			append_dev(div15, t408);
    			append_dev(div15, button35);
    			append_dev(div15, t410);
    			append_dev(div15, button36);
    			append_dev(table, t412);
    			append_dev(table, tr67);
    			append_dev(table, t413);
    			append_dev(table, tr68);
    			append_dev(tr68, th108);
    			append_dev(tr68, t414);
    			append_dev(tr68, th109);
    			append_dev(th109, h546);
    			append_dev(th109, t416);
    			append_dev(th109, div16);
    			append_dev(div16, button37);
    			append_dev(div16, t418);
    			append_dev(div16, button38);
    			append_dev(div16, t420);
    			append_dev(div16, button39);
    			append_dev(div16, t422);
    			append_dev(div16, button40);
    			append_dev(div16, t424);
    			append_dev(div16, button41);
    			append_dev(div16, t426);
    			append_dev(div16, button42);
    			append_dev(div16, t428);
    			append_dev(div16, button43);
    			append_dev(div16, t430);
    			append_dev(div16, button44);
    			append_dev(div16, t432);
    			append_dev(div16, button45);
    			append_dev(div16, t434);
    			append_dev(div16, button46);
    			append_dev(div16, t436);
    			append_dev(div16, button47);
    			append_dev(table, t438);
    			append_dev(table, tr69);
    			append_dev(table, t439);
    			append_dev(table, tr70);
    			append_dev(tr70, th110);
    			append_dev(tr70, t440);
    			append_dev(tr70, th111);
    			append_dev(th111, p20);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*pubs*/ 0) {
    				each_value_1 = pubs;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(table, t162);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*other*/ 0) {
    				each_value = other;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(table, t166);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro$1(local) {
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
    			if (detaching) detach_dev(div17);
    			destroy_component(intro);
    			destroy_component(social);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$3 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;
    const func_1$2 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$a($$self, $$props, $$invalidate) {
    	onMount(() => {
    		const mvp = document.getElementById("viewport");
    		mvp.setAttribute("content", "width=500");
    		window.scrollTo(0, 0);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Cv> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Cv", $$slots, []);

    	$$self.$capture_state = () => ({
    		Intro,
    		Social,
    		Links,
    		pubs,
    		other,
    		onMount
    	});

    	return [];
    }

    class Cv extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cv",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    var routes = {
      "/": Home,
      "/news": News,
      "/pubs": Pubs,
      "/cv": Cv,
      "/paper/:id": Paper,
    };

    /* src/App.svelte generated by Svelte v3.23.2 */

    const { document: document_1 } = globals;
    const file$a = "src/App.svelte";

    function create_fragment$b(ctx) {
    	let meta;
    	let link0;
    	let link1;
    	let link2;
    	let link3;
    	let t;
    	let router;
    	let current;
    	router = new Router({ props: { routes }, $$inline: true });

    	const block = {
    		c: function create() {
    			meta = element("meta");
    			link0 = element("link");
    			link1 = element("link");
    			link2 = element("link");
    			link3 = element("link");
    			t = space();
    			create_component(router.$$.fragment);
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
    			if (detaching) detach_dev(t);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	(function (i, s, o, g, r, a, m) {
    		i["GoogleAnalyticsObject"] = r;

    		(i[r] = i[r] || function () {
    			(i[r].q = i[r].q || []).push(arguments);
    		}, i[r].l = 1 * new Date());

    		(a = s.createElement(o), m = s.getElementsByTagName(o)[0]);
    		a.async = 1;
    		a.src = g;
    		m.parentNode.insertBefore(a, m);
    	})(window, document, "script", "//www.google-analytics.com/analytics.js", "ga");

    	ga("create", "UA-50459890-1", "auto");
    	ga("send", "pageview");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ Router, link, routes, news, pubs });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
