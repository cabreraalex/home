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
    	let a;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text("© 2019 Ángel Alexander Cabrera - Made with\n    ");
    			a = element("a");
    			a.textContent = "Svelte";
    			attr_dev(a, "href", "https://svelte.dev");
    			add_location(a, file$2, 3, 4, 100);
    			attr_dev(p, "id", "copyright");
    			add_location(p, file$2, 1, 2, 23);
    			attr_dev(div, "class", "footer svelte-qsjnhq");
    			add_location(div, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, a);
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
        date: "May 17, 2021",
        news: "First week at &#127822;!",
      },
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
    	let a3;
    	let t8;
    	let p1;
    	let t9;
    	let a4;
    	let t11;
    	let a5;
    	let t13;

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
    			t6 = text("\n  My research focus is broadly human-centered data science, specifically in applying\n  techniques from HCI and visualization to help people better understand and improve\n  their machine learning models. I am supported by a\n  ");
    			a3 = element("a");
    			a3.textContent = "NSF Graduate Research Fellowship.";
    			t8 = space();
    			p1 = element("p");
    			t9 = text("Before CMU, I graduated with a B.S. in Computer Science from Georgia Tech\n  where I worked with\n  ");
    			a4 = element("a");
    			a4.textContent = "Polo Chau";
    			t11 = text("\n  and\n  ");
    			a5 = element("a");
    			a5.textContent = "Jamie Morgenstern.";
    			t13 = text("\n  I've spent time at\n  \n  Microsoft Research and a few summers as a software engineering intern at\n  \n  Google working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr_dev(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 2, 2, 34);
    			attr_dev(a1, "href", "http://perer.org");
    			add_location(a1, file$4, 6, 2, 168);
    			attr_dev(a2, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a2, file$4, 8, 2, 218);
    			attr_dev(a3, "href", "https://www.nsfgrfp.org/");
    			add_location(a3, file$4, 12, 2, 500);
    			attr_dev(p0, "class", "svelte-14gdzu3");
    			add_location(p0, file$4, 0, 0, 0);
    			attr_dev(a4, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a4, file$4, 18, 2, 683);
    			attr_dev(a5, "href", "http://jamiemorgenstern.com/");
    			add_location(a5, file$4, 20, 2, 749);
    			attr_dev(p1, "class", "svelte-14gdzu3");
    			add_location(p1, file$4, 15, 0, 579);
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
    			append_dev(p1, a4);
    			append_dev(p1, t11);
    			append_dev(p1, a5);
    			append_dev(p1, t13);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t8);
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

    // (6:2) {#if pub.pdf}
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
    			add_location(i, file$5, 8, 8, 141);
    			add_location(p, file$5, 9, 8, 179);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 7, 6, 105);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].pdf);
    			add_location(a, file$5, 6, 4, 80);
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
    		source: "(6:2) {#if pub.pdf}",
    		ctx
    	});

    	return block;
    }

    // (14:2) {#if pub.blog}
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
    			add_location(i, file$5, 16, 8, 306);
    			add_location(p, file$5, 17, 8, 342);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 15, 6, 270);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].blog);
    			add_location(a, file$5, 14, 4, 244);
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
    		source: "(14:2) {#if pub.blog}",
    		ctx
    	});

    	return block;
    }

    // (22:2) {#if pub.workshop}
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
    			add_location(i, file$5, 24, 8, 478);
    			add_location(p, file$5, 25, 8, 513);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 23, 6, 442);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].workshop);
    			add_location(a, file$5, 22, 4, 412);
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
    		source: "(22:2) {#if pub.workshop}",
    		ctx
    	});

    	return block;
    }

    // (30:2) {#if pub.video}
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
    			add_location(i, file$5, 32, 8, 647);
    			add_location(p, file$5, 33, 8, 684);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 31, 6, 611);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].video);
    			add_location(a, file$5, 30, 4, 584);
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
    		source: "(30:2) {#if pub.video}",
    		ctx
    	});

    	return block;
    }

    // (38:2) {#if pub.demo}
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
    			add_location(i, file$5, 40, 8, 813);
    			add_location(p, file$5, 41, 8, 848);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 39, 6, 777);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].demo);
    			add_location(a, file$5, 38, 4, 751);
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
    		source: "(38:2) {#if pub.demo}",
    		ctx
    	});

    	return block;
    }

    // (46:2) {#if pub.code}
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
    			add_location(i, file$5, 48, 8, 976);
    			add_location(p, file$5, 49, 8, 1012);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 47, 6, 940);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].code);
    			add_location(a, file$5, 46, 4, 914);
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
    		source: "(46:2) {#if pub.code}",
    		ctx
    	});

    	return block;
    }

    // (54:2) {#if pub.slides}
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
    			add_location(i, file$5, 56, 8, 1144);
    			add_location(p, file$5, 57, 8, 1189);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 55, 6, 1108);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].slides);
    			add_location(a, file$5, 54, 4, 1080);
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
    		source: "(54:2) {#if pub.slides}",
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
    			add_location(i, file$5, 63, 6, 1307);
    			add_location(p, file$5, 64, 6, 1340);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$5, 62, 4, 1273);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a, file$5, 61, 2, 1238);
    			attr_dev(div, "class", "buttons");
    			add_location(div, file$5, 4, 0, 38);
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

    // (29:8) {#each { length: 3 } as _, i}
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
    			add_location(p0, file$6, 30, 12, 1014);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 31, 12, 1084);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$6, 29, 10, 971);
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
    		source: "(29:8) {#each { length: 3 } as _, i}",
    		ctx
    	});

    	return block;
    }

    // (44:8) {#each pubs as pub}
    function create_each_block_1(ctx) {
    	let div5;
    	let div2;
    	let a0;
    	let div0;
    	let a0_href_value;
    	let t0;
    	let div1;
    	let p0;
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
    	let p1;
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
    			p0 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			div4 = element("div");
    			div3 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			p1 = element("p");
    			t5 = space();
    			create_component(links.$$.fragment);
    			t6 = space();
    			set_style(div0, "background-image", "url(" + ("images/" + /*pub*/ ctx[0].teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 47, 16, 1621);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 46, 14, 1574);
    			attr_dev(p0, "class", "venue");
    			add_location(p0, file$6, 54, 16, 1837);
    			add_location(div1, file$6, 53, 14, 1815);
    			attr_dev(div2, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-sq6i3r");
    			add_location(div2, file$6, 45, 12, 1513);
    			attr_dev(h4, "class", "paper-title");
    			add_location(h4, file$6, 60, 18, 2059);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a1, file$6, 59, 16, 2010);
    			attr_dev(p1, "class", "authors");
    			add_location(p1, file$6, 62, 16, 2137);
    			attr_dev(div3, "class", "padded");
    			add_location(div3, file$6, 58, 14, 1973);
    			attr_dev(div4, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div4, file$6, 57, 12, 1922);
    			attr_dev(div5, "class", "pure-g pub");
    			add_location(div5, file$6, 44, 10, 1476);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			append_dev(div2, a0);
    			append_dev(a0, div0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, p0);
    			append_dev(p0, t1);
    			append_dev(div5, t2);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, a1);
    			append_dev(a1, h4);
    			append_dev(h4, t3);
    			append_dev(div3, t4);
    			append_dev(div3, p1);
    			p1.innerHTML = raw_value;
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
    		source: "(44:8) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (86:8) {#each other as pub}
    function create_each_block$1(ctx) {
    	let div4;
    	let div1;
    	let a0;
    	let div0;
    	let a0_href_value;
    	let t0;
    	let p0;
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
    	let p1;
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
    			p0 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			a1 = element("a");
    			h4 = element("h4");
    			t3 = text(t3_value);
    			t4 = space();
    			p1 = element("p");
    			t5 = space();
    			create_component(links.$$.fragment);
    			t6 = space();
    			set_style(div0, "background-image", "url(" + ("images/" + /*pub*/ ctx[0].teaser) + ")");
    			attr_dev(div0, "class", "thumb");
    			attr_dev(div0, "alt", "teaser");
    			add_location(div0, file$6, 89, 16, 3098);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 88, 14, 3051);
    			attr_dev(p0, "class", "venue");
    			add_location(p0, file$6, 95, 14, 3292);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-sq6i3r");
    			add_location(div1, file$6, 87, 12, 2990);
    			attr_dev(h4, "class", "paper-title");
    			add_location(h4, file$6, 100, 18, 3493);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a1, file$6, 99, 16, 3444);
    			attr_dev(p1, "class", "author");
    			add_location(p1, file$6, 102, 16, 3571);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$6, 98, 14, 3407);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 97, 12, 3356);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 86, 10, 2953);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div1);
    			append_dev(div1, a0);
    			append_dev(a0, div0);
    			append_dev(div1, t0);
    			append_dev(div1, p0);
    			append_dev(p0, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, a1);
    			append_dev(a1, h4);
    			append_dev(h4, t3);
    			append_dev(div2, t4);
    			append_dev(div2, p1);
    			p1.innerHTML = raw_value;
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
    		source: "(86:8) {#each other as pub}",
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
    	let p;
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
    			p = element("p");
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
    			add_location(span, file$6, 19, 43, 659);
    			attr_dev(h20, "id", "hello");
    			attr_dev(h20, "class", "svelte-sq6i3r");
    			add_location(h20, file$6, 19, 8, 624);
    			attr_dev(div0, "id", "intro");
    			add_location(div0, file$6, 18, 6, 599);
    			attr_dev(h21, "class", "header svelte-sq6i3r");
    			add_location(h21, file$6, 24, 10, 800);
    			attr_dev(a, "class", "right-all");
    			attr_dev(a, "href", "#/news");
    			add_location(a, file$6, 25, 13, 842);
    			add_location(p, file$6, 25, 10, 839);
    			attr_dev(div1, "class", "inline svelte-sq6i3r");
    			add_location(div1, file$6, 23, 8, 769);
    			add_location(hr0, file$6, 27, 8, 916);
    			attr_dev(div2, "id", "news");
    			attr_dev(div2, "class", "sect");
    			add_location(div2, file$6, 22, 6, 732);
    			attr_dev(h22, "class", "header svelte-sq6i3r");
    			add_location(h22, file$6, 39, 10, 1296);
    			attr_dev(div3, "class", "inline svelte-sq6i3r");
    			add_location(div3, file$6, 38, 8, 1265);
    			add_location(hr1, file$6, 42, 8, 1431);
    			attr_dev(div4, "id", "pubs");
    			attr_dev(div4, "class", "sect");
    			add_location(div4, file$6, 37, 6, 1228);
    			attr_dev(h23, "class", "header svelte-sq6i3r");
    			add_location(h23, file$6, 81, 10, 2753);
    			attr_dev(div5, "class", "inline svelte-sq6i3r");
    			add_location(div5, file$6, 80, 8, 2722);
    			add_location(hr2, file$6, 84, 8, 2907);
    			attr_dev(div6, "id", "pubs");
    			attr_dev(div6, "class", "sect");
    			add_location(div6, file$6, 79, 6, 2685);
    			attr_dev(div7, "id", "padded-content");
    			add_location(div7, file$6, 17, 4, 567);
    			attr_dev(div8, "id", "content");
    			attr_dev(div8, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div8, file$6, 16, 2, 513);
    			attr_dev(div9, "class", "pure-g");
    			attr_dev(div9, "id", "main-container");
    			add_location(div9, file$6, 14, 0, 456);
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
    			append_dev(div1, p);
    			append_dev(p, a);
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

    const func = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""} author' href='${p.website}'>${p.name}</a>`;
    const func_1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""} author' href='${p.website}'>${p.name}</a>`;

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
    			attr_dev(i0, "class", "fas fa-home svelte-hez24a");
    			attr_dev(i0, "id", "home");
    			add_location(i0, file$8, 14, 4, 411);
    			attr_dev(span0, "class", "color svelte-hez24a");
    			add_location(span0, file$8, 16, 6, 477);
    			attr_dev(span1, "class", "color red svelte-hez24a");
    			add_location(span1, file$8, 17, 6, 522);
    			attr_dev(span2, "class", "color svelte-hez24a");
    			add_location(span2, file$8, 18, 6, 564);
    			attr_dev(span3, "class", "color red svelte-hez24a");
    			add_location(span3, file$8, 19, 6, 609);
    			attr_dev(h40, "id", "home-link");
    			attr_dev(h40, "class", "svelte-hez24a");
    			add_location(h40, file$8, 15, 4, 451);
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "home svelte-hez24a");
    			add_location(a0, file$8, 13, 2, 381);
    			add_location(hr, file$8, 22, 2, 667);
    			attr_dev(h1, "class", "svelte-hez24a");
    			add_location(h1, file$8, 23, 2, 676);
    			attr_dev(h3, "class", "svelte-hez24a");
    			add_location(h3, file$8, 25, 4, 719);
    			attr_dev(div0, "id", "info");
    			attr_dev(div0, "class", "svelte-hez24a");
    			add_location(div0, file$8, 24, 2, 699);
    			if (img.src !== (img_src_value = "images/" + /*pub*/ ctx[0].teaser)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "teaser svelte-hez24a");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$8, 38, 6, 1044);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$8, 37, 4, 1001);
    			attr_dev(p0, "class", "desc svelte-hez24a");
    			add_location(p0, file$8, 41, 6, 1167);
    			attr_dev(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$8, 40, 4, 1124);
    			attr_dev(div3, "class", "flex pure-g svelte-hez24a");
    			add_location(div3, file$8, 36, 2, 971);
    			attr_dev(h20, "class", "sec-title svelte-hez24a");
    			add_location(h20, file$8, 45, 2, 1221);
    			attr_dev(p1, "class", "svelte-hez24a");
    			add_location(p1, file$8, 46, 2, 1259);
    			attr_dev(h21, "class", "sec-title svelte-hez24a");
    			add_location(h21, file$8, 48, 2, 1284);
    			attr_dev(h41, "class", "svelte-hez24a");
    			add_location(h41, file$8, 50, 4, 1377);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$8, 49, 2, 1322);
    			attr_dev(h50, "class", "svelte-hez24a");
    			add_location(h50, file$8, 53, 2, 1408);
    			add_location(i1, file$8, 65, 4, 1643);
    			attr_dev(h51, "class", "svelte-hez24a");
    			add_location(h51, file$8, 64, 2, 1634);
    			attr_dev(h22, "class", "sec-title svelte-hez24a");
    			add_location(h22, file$8, 69, 2, 1724);
    			attr_dev(code, "class", "bibtex");
    			add_location(code, file$8, 71, 4, 1783);
    			attr_dev(div4, "class", "code svelte-hez24a");
    			add_location(div4, file$8, 70, 2, 1760);
    			attr_dev(div5, "id", "body");
    			attr_dev(div5, "class", "svelte-hez24a");
    			add_location(div5, file$8, 12, 0, 363);
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

    // (307:6) {#each pubs as pub}
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
    			attr_dev(th0, "class", "date svelte-1v7h9f9");
    			add_location(th0, file$9, 308, 10, 9667);
    			attr_dev(h5, "class", "svelte-1v7h9f9");
    			add_location(h5, file$9, 311, 14, 9804);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 310, 12, 9739);
    			attr_dev(h6, "class", "authors svelte-1v7h9f9");
    			add_location(h6, file$9, 314, 12, 9855);
    			add_location(i, file$9, 326, 14, 10228);
    			attr_dev(p, "class", "desc svelte-1v7h9f9");
    			add_location(p, file$9, 325, 12, 10197);
    			attr_dev(th1, "class", "svelte-1v7h9f9");
    			add_location(th1, file$9, 309, 10, 9722);
    			attr_dev(tr0, "class", "item svelte-1v7h9f9");
    			add_location(tr0, file$9, 307, 8, 9639);
    			attr_dev(tr1, "class", "buffer svelte-1v7h9f9");
    			add_location(tr1, file$9, 332, 8, 10364);
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
    		source: "(307:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (342:6) {#each other as pub}
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
    			attr_dev(th0, "class", "date svelte-1v7h9f9");
    			add_location(th0, file$9, 343, 10, 10642);
    			attr_dev(h5, "class", "svelte-1v7h9f9");
    			add_location(h5, file$9, 346, 14, 10779);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 345, 12, 10714);
    			attr_dev(h6, "class", "authors svelte-1v7h9f9");
    			add_location(h6, file$9, 349, 12, 10830);
    			add_location(i, file$9, 361, 14, 11203);
    			attr_dev(p, "class", "desc svelte-1v7h9f9");
    			add_location(p, file$9, 360, 12, 11172);
    			attr_dev(th1, "class", "svelte-1v7h9f9");
    			add_location(th1, file$9, 344, 10, 10697);
    			attr_dev(tr0, "class", "item svelte-1v7h9f9");
    			add_location(tr0, file$9, 342, 8, 10614);
    			attr_dev(tr1, "class", "buffer svelte-1v7h9f9");
    			add_location(tr1, file$9, 367, 8, 11339);
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
    		source: "(342:6) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div13;
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
    	let t56;
    	let div1;
    	let a3;
    	let button1;
    	let i1;
    	let t57;
    	let t58;
    	let tr8;
    	let t59;
    	let tr9;
    	let th14;
    	let t60;
    	let br4;
    	let t61;
    	let t62;
    	let th15;
    	let h53;
    	let t64;
    	let h64;
    	let t66;
    	let p4;
    	let t67;
    	let a4;
    	let t69;
    	let a5;
    	let t71;
    	let div2;
    	let a6;
    	let button2;
    	let i2;
    	let t72;
    	let t73;
    	let tr10;
    	let t74;
    	let tr11;
    	let th16;
    	let t75;
    	let br5;
    	let t76;
    	let t77;
    	let th17;
    	let h54;
    	let t79;
    	let h65;
    	let t81;
    	let p5;
    	let t83;
    	let div3;
    	let a7;
    	let button3;
    	let i3;
    	let t84;
    	let t85;
    	let tr12;
    	let t86;
    	let tr13;
    	let th18;
    	let t87;
    	let br6;
    	let t88;
    	let t89;
    	let th19;
    	let h55;
    	let t91;
    	let h66;
    	let t93;
    	let p6;
    	let t95;
    	let tr14;
    	let t96;
    	let tr15;
    	let th20;
    	let t97;
    	let br7;
    	let t98;
    	let t99;
    	let th21;
    	let h56;
    	let t101;
    	let h67;
    	let t103;
    	let p7;
    	let t105;
    	let tr16;
    	let th22;
    	let t106;
    	let th23;
    	let h42;
    	let t108;
    	let tr17;
    	let th24;
    	let t110;
    	let th25;
    	let h57;
    	let t112;
    	let p8;
    	let t114;
    	let div4;
    	let a8;
    	let button4;
    	let i4;
    	let t115;
    	let t116;
    	let tr18;
    	let t117;
    	let tr19;
    	let th26;
    	let t119;
    	let th27;
    	let h58;
    	let t121;
    	let p9;
    	let t123;
    	let div5;
    	let a9;
    	let button5;
    	let i5;
    	let t124;
    	let t125;
    	let tr20;
    	let t126;
    	let tr21;
    	let th28;
    	let t127;
    	let br8;
    	let t128;
    	let t129;
    	let th29;
    	let h59;
    	let t131;
    	let h68;
    	let t133;
    	let p10;
    	let t135;
    	let div6;
    	let a10;
    	let button6;
    	let i6;
    	let t136;
    	let t137;
    	let tr22;
    	let t138;
    	let tr23;
    	let th30;
    	let t140;
    	let th31;
    	let h510;
    	let t142;
    	let h69;
    	let t144;
    	let p11;
    	let t146;
    	let div7;
    	let a11;
    	let button7;
    	let i7;
    	let t147;
    	let t148;
    	let tr24;
    	let th32;
    	let t149;
    	let th33;
    	let h43;
    	let t151;
    	let t152;
    	let tr25;
    	let th34;
    	let t153;
    	let th35;
    	let h44;
    	let t155;
    	let t156;
    	let tr26;
    	let th36;
    	let t157;
    	let th37;
    	let h45;
    	let t159;
    	let tr27;
    	let th38;
    	let t160;
    	let br9;
    	let t161;
    	let br10;
    	let t162;
    	let t163;
    	let th39;
    	let h511;
    	let t165;
    	let h610;
    	let t167;
    	let p12;
    	let t169;
    	let tr28;
    	let t170;
    	let tr29;
    	let th40;
    	let t172;
    	let th41;
    	let h512;
    	let t174;
    	let h611;
    	let t176;
    	let p13;
    	let t178;
    	let tr30;
    	let th42;
    	let t179;
    	let th43;
    	let h46;
    	let t181;
    	let tr31;
    	let th44;
    	let t182;
    	let br11;
    	let t183;
    	let t184;
    	let th45;
    	let h513;
    	let t186;
    	let h612;
    	let t188;
    	let p14;
    	let t190;
    	let br12;
    	let t191;
    	let tr32;
    	let th46;
    	let t192;
    	let br13;
    	let t193;
    	let t194;
    	let th47;
    	let h514;
    	let t196;
    	let h613;
    	let t198;
    	let p15;
    	let t200;
    	let br14;
    	let t201;
    	let tr33;
    	let th48;
    	let t202;
    	let br15;
    	let t203;
    	let t204;
    	let th49;
    	let h515;
    	let t206;
    	let tr34;
    	let th50;
    	let t207;
    	let th51;
    	let h47;
    	let t209;
    	let tr35;
    	let th52;
    	let t210;
    	let th53;
    	let h516;
    	let t212;
    	let tr36;
    	let th54;
    	let t214;
    	let th55;
    	let h517;
    	let t216;
    	let tr37;
    	let th56;
    	let t218;
    	let th57;
    	let h518;
    	let t220;
    	let br16;
    	let t221;
    	let tr38;
    	let th58;
    	let t222;
    	let th59;
    	let h519;
    	let t224;
    	let tr39;
    	let th60;
    	let t226;
    	let th61;
    	let h520;
    	let t228;
    	let tr40;
    	let th62;
    	let t230;
    	let th63;
    	let h521;
    	let t232;
    	let tr41;
    	let th64;
    	let t234;
    	let th65;
    	let h522;
    	let t236;
    	let tr42;
    	let th66;
    	let t238;
    	let th67;
    	let h523;
    	let t240;
    	let tr43;
    	let th68;
    	let t242;
    	let th69;
    	let h524;
    	let t244;
    	let tr44;
    	let th70;
    	let t245;
    	let th71;
    	let h48;
    	let t247;
    	let tr45;
    	let th72;
    	let t249;
    	let th73;
    	let h525;
    	let a12;
    	let t251;
    	let i8;
    	let t253;
    	let tr46;
    	let th74;
    	let t255;
    	let th75;
    	let h526;
    	let a13;
    	let t257;
    	let i9;
    	let t259;
    	let tr47;
    	let th76;
    	let t261;
    	let th77;
    	let h527;
    	let a14;
    	let t263;
    	let i10;
    	let t265;
    	let tr48;
    	let th78;
    	let t267;
    	let th79;
    	let h528;
    	let a15;
    	let t269;
    	let i11;
    	let t271;
    	let tr49;
    	let th80;
    	let t273;
    	let th81;
    	let h529;
    	let a16;
    	let t275;
    	let i12;
    	let t277;
    	let tr50;
    	let th82;
    	let t279;
    	let th83;
    	let h530;
    	let a17;
    	let t281;
    	let i13;
    	let t283;
    	let tr51;
    	let th84;
    	let t285;
    	let th85;
    	let h531;
    	let a18;
    	let t287;
    	let i14;
    	let t289;
    	let tr52;
    	let th86;
    	let t290;
    	let th87;
    	let h49;
    	let t292;
    	let tr53;
    	let th88;
    	let t294;
    	let th89;
    	let h532;
    	let t296;
    	let p16;
    	let t298;
    	let div8;
    	let a19;
    	let button8;
    	let i15;
    	let t299;
    	let t300;
    	let a20;
    	let button9;
    	let i16;
    	let t301;
    	let t302;
    	let tr54;
    	let t303;
    	let tr55;
    	let th90;
    	let t305;
    	let th91;
    	let h533;
    	let t307;
    	let p17;
    	let t309;
    	let div9;
    	let a21;
    	let button10;
    	let i17;
    	let t310;
    	let t311;
    	let a22;
    	let button11;
    	let i18;
    	let t312;
    	let t313;
    	let a23;
    	let button12;
    	let i19;
    	let t314;
    	let t315;
    	let tr56;
    	let t316;
    	let tr57;
    	let th92;
    	let t318;
    	let th93;
    	let h534;
    	let t320;
    	let p18;
    	let t321;
    	let a24;
    	let t323;
    	let t324;
    	let div10;
    	let a26;
    	let button13;
    	let i20;
    	let t325;
    	let t326;
    	let a25;
    	let button14;
    	let i21;
    	let t327;
    	let t328;
    	let tr58;
    	let t329;
    	let tr59;
    	let th94;
    	let t330;
    	let br17;
    	let t331;
    	let t332;
    	let th95;
    	let h535;
    	let t334;
    	let h614;
    	let t336;
    	let p19;
    	let t338;
    	let div11;
    	let a27;
    	let button15;
    	let i22;
    	let t339;
    	let t340;
    	let a28;
    	let button16;
    	let i23;
    	let t341;
    	let t342;
    	let tr60;
    	let t343;
    	let tr61;
    	let th96;
    	let t345;
    	let th97;
    	let h536;
    	let t347;
    	let p20;
    	let t349;
    	let div12;
    	let a29;
    	let button17;
    	let i24;
    	let t350;
    	let t351;
    	let a30;
    	let button18;
    	let i25;
    	let t352;
    	let t353;
    	let tr62;
    	let th98;
    	let t354;
    	let th99;
    	let h410;
    	let t356;
    	let tr63;
    	let th100;
    	let t358;
    	let th101;
    	let h537;
    	let t360;
    	let h538;
    	let t362;
    	let a31;
    	let h539;
    	let t364;
    	let tr64;
    	let th102;
    	let t366;
    	let th103;
    	let a32;
    	let h540;
    	let t368;
    	let a33;
    	let h541;
    	let t370;
    	let a34;
    	let h542;
    	let t372;
    	let a35;
    	let h543;
    	let t374;
    	let h544;
    	let t376;
    	let tr65;
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
    			div13 = element("div");
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
    			t48 = text("May 2021 ");
    			br3 = element("br");
    			t49 = text(" - Present");
    			t50 = space();
    			th13 = element("th");
    			h52 = element("h5");
    			h52.textContent = "Apple";
    			t52 = space();
    			h63 = element("h6");
    			h63.textContent = "Research Intern";
    			t54 = space();
    			p3 = element("p");
    			p3.textContent = "Design + Visualization Group.";
    			t56 = space();
    			div1 = element("div");
    			a3 = element("a");
    			button1 = element("button");
    			i1 = element("i");
    			t57 = text(" Apple AI/ML");
    			t58 = space();
    			tr8 = element("tr");
    			t59 = space();
    			tr9 = element("tr");
    			th14 = element("th");
    			t60 = text("May 2020 ");
    			br4 = element("br");
    			t61 = text(" - August 2020");
    			t62 = space();
    			th15 = element("th");
    			h53 = element("h5");
    			h53.textContent = "Microsoft Research";
    			t64 = space();
    			h64 = element("h6");
    			h64.textContent = "Research Intern";
    			t66 = space();
    			p4 = element("p");
    			t67 = text("Worked on behavioral model understanding with\n            ");
    			a4 = element("a");
    			a4.textContent = "Steven Drucker";
    			t69 = text("\n            and\n            ");
    			a5 = element("a");
    			a5.textContent = "Marco Tulio Ribeiro.";
    			t71 = space();
    			div2 = element("div");
    			a6 = element("a");
    			button2 = element("button");
    			i2 = element("i");
    			t72 = text(" VIDA Group");
    			t73 = space();
    			tr10 = element("tr");
    			t74 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			t75 = text("May 2018 ");
    			br5 = element("br");
    			t76 = text(" - August 2018");
    			t77 = space();
    			th17 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Google";
    			t79 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t81 = space();
    			p5 = element("p");
    			p5.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t83 = space();
    			div3 = element("div");
    			a7 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t84 = text("\n                WSJ Article");
    			t85 = space();
    			tr12 = element("tr");
    			t86 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			t87 = text("May 2017 ");
    			br6 = element("br");
    			t88 = text(" - August 2017");
    			t89 = space();
    			th19 = element("th");
    			h55 = element("h5");
    			h55.textContent = "Google";
    			t91 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t93 = space();
    			p6 = element("p");
    			p6.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
    			t95 = space();
    			tr14 = element("tr");
    			t96 = space();
    			tr15 = element("tr");
    			th20 = element("th");
    			t97 = text("May 2016 ");
    			br7 = element("br");
    			t98 = text(" - August 2016");
    			t99 = space();
    			th21 = element("th");
    			h56 = element("h5");
    			h56.textContent = "Google";
    			t101 = space();
    			h67 = element("h6");
    			h67.textContent = "Engineering Practicum Intern";
    			t103 = space();
    			p7 = element("p");
    			p7.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t105 = space();
    			tr16 = element("tr");
    			th22 = element("th");
    			t106 = space();
    			th23 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Awards";
    			t108 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			th24.textContent = "May 2019";
    			t110 = space();
    			th25 = element("th");
    			h57 = element("h5");
    			h57.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t112 = space();
    			p8 = element("p");
    			p8.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t114 = space();
    			div4 = element("div");
    			a8 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t115 = text(" Website");
    			t116 = space();
    			tr18 = element("tr");
    			t117 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			th26.textContent = "May 2019";
    			t119 = space();
    			th27 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Love Family Foundation Scholarship";
    			t121 = space();
    			p9 = element("p");
    			p9.textContent = "Co-awarded the $10,000 scholarship for the undergraduate with the\n            most outstanding scholastic record.";
    			t123 = space();
    			div5 = element("div");
    			a9 = element("a");
    			button5 = element("button");
    			i5 = element("i");
    			t124 = text(" Announcement");
    			t125 = space();
    			tr20 = element("tr");
    			t126 = space();
    			tr21 = element("tr");
    			th28 = element("th");
    			t127 = text("August 2015 ");
    			br8 = element("br");
    			t128 = text(" - May 2019");
    			t129 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Stamps President's Scholar";
    			t131 = space();
    			h68 = element("h6");
    			h68.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t133 = space();
    			p10 = element("p");
    			p10.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 incoming students.";
    			t135 = space();
    			div6 = element("div");
    			a10 = element("a");
    			button6 = element("button");
    			i6 = element("i");
    			t136 = text(" Website");
    			t137 = space();
    			tr22 = element("tr");
    			t138 = space();
    			tr23 = element("tr");
    			th30 = element("th");
    			th30.textContent = "February 3, 2018";
    			t140 = space();
    			th31 = element("th");
    			h510 = element("h5");
    			h510.textContent = "The Data Open Datathon";
    			t142 = space();
    			h69 = element("h6");
    			h69.textContent = "Correlation One and Citadel Securities";
    			t144 = space();
    			p11 = element("p");
    			p11.textContent = "Placed third and won $2,500 for creating a ML system to predict\n            dangerous road areas.";
    			t146 = space();
    			div7 = element("div");
    			a11 = element("a");
    			button7 = element("button");
    			i7 = element("i");
    			t147 = text(" Press Release");
    			t148 = space();
    			tr24 = element("tr");
    			th32 = element("th");
    			t149 = space();
    			th33 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Refereed Publications";
    			t151 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t152 = space();
    			tr25 = element("tr");
    			th34 = element("th");
    			t153 = space();
    			th35 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Workshops, Demos, Posters, and Preprints";
    			t155 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t156 = space();
    			tr26 = element("tr");
    			th36 = element("th");
    			t157 = space();
    			th37 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Teaching";
    			t159 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			t160 = text("Fall 2016 ");
    			br9 = element("br");
    			t161 = text(" Spring 2017 ");
    			br10 = element("br");
    			t162 = text(" Spring 2018");
    			t163 = space();
    			th39 = element("th");
    			h511 = element("h5");
    			h511.textContent = "CS1332 - Data Structures and Algorithms";
    			t165 = space();
    			h610 = element("h6");
    			h610.textContent = "Undergraduate Teaching Assistant @ Georgia Tech";
    			t167 = space();
    			p12 = element("p");
    			p12.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t169 = space();
    			tr28 = element("tr");
    			t170 = space();
    			tr29 = element("tr");
    			th40 = element("th");
    			th40.textContent = "Fall 2016";
    			t172 = space();
    			th41 = element("th");
    			h512 = element("h5");
    			h512.textContent = "GT 1000 - First-Year Seminar";
    			t174 = space();
    			h611 = element("h6");
    			h611.textContent = "Team Leader @ Georgia Tech";
    			t176 = space();
    			p13 = element("p");
    			p13.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t178 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			t179 = space();
    			th43 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Mentoring";
    			t181 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			t182 = text("Spring 2021 ");
    			br11 = element("br");
    			t183 = text(" - Present");
    			t184 = space();
    			th45 = element("th");
    			h513 = element("h5");
    			h513.textContent = "Kazi Jawad";
    			t186 = space();
    			h612 = element("h6");
    			h612.textContent = "B.S. in Statistics and Machine Learning, Carnegie Mellon";
    			t188 = space();
    			p14 = element("p");
    			p14.textContent = "Interactive tagging of images.";
    			t190 = space();
    			br12 = element("br");
    			t191 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			t192 = text("Spring 2020 ");
    			br13 = element("br");
    			t193 = text(" - Present");
    			t194 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Abraham Druck";
    			t196 = space();
    			h613 = element("h6");
    			h613.textContent = "B.S. in Mathematical Sciences, Carnegie Mellon";
    			t198 = space();
    			p15 = element("p");
    			p15.textContent = "Crowdsourced discovery of ML blind spots for image captioning.";
    			t200 = space();
    			br14 = element("br");
    			t201 = space();
    			tr33 = element("tr");
    			th48 = element("th");
    			t202 = text("Fall 2020 ");
    			br15 = element("br");
    			t203 = text(" Spring 2020");
    			t204 = space();
    			th49 = element("th");
    			h515 = element("h5");
    			h515.textContent = "CMU AI Mentoring Program";
    			t206 = space();
    			tr34 = element("tr");
    			th50 = element("th");
    			t207 = space();
    			th51 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t209 = space();
    			tr35 = element("tr");
    			th52 = element("th");
    			t210 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "Student Volunteer";
    			t212 = space();
    			tr36 = element("tr");
    			th54 = element("th");
    			th54.textContent = "October 2019";
    			t214 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "IEEE Visualization (VIS)";
    			t216 = space();
    			tr37 = element("tr");
    			th56 = element("th");
    			th56.textContent = "January 2019";
    			t218 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t220 = space();
    			br16 = element("br");
    			t221 = space();
    			tr38 = element("tr");
    			th58 = element("th");
    			t222 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "Reviewer";
    			t224 = space();
    			tr39 = element("tr");
    			th60 = element("th");
    			th60.textContent = "2019 - 2021";
    			t226 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t228 = space();
    			tr40 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2020 - 2021";
    			t230 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "IEEE Visualization (VIS)";
    			t232 = space();
    			tr41 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2021";
    			t234 = space();
    			th65 = element("th");
    			h522 = element("h5");
    			h522.textContent = "ACM Conference on Computer-Supported Cooperative Work and Social\n            Computing (CSCW)";
    			t236 = space();
    			tr42 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2021";
    			t238 = space();
    			th67 = element("th");
    			h523 = element("h5");
    			h523.textContent = "ACM Conference on Human Factors in Computing Systems (CHI)";
    			t240 = space();
    			tr43 = element("tr");
    			th68 = element("th");
    			th68.textContent = "2019";
    			t242 = space();
    			th69 = element("th");
    			h524 = element("h5");
    			h524.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t244 = space();
    			tr44 = element("tr");
    			th70 = element("th");
    			t245 = space();
    			th71 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Press";
    			t247 = space();
    			tr45 = element("tr");
    			th72 = element("th");
    			th72.textContent = "2020";
    			t249 = space();
    			th73 = element("th");
    			h525 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t251 = text("\n            -\n            ");
    			i8 = element("i");
    			i8.textContent = "CNN";
    			t253 = space();
    			tr46 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2020";
    			t255 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t257 = text("\n            -\n            ");
    			i9 = element("i");
    			i9.textContent = "Wired";
    			t259 = space();
    			tr47 = element("tr");
    			th76 = element("th");
    			th76.textContent = "2020";
    			t261 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t263 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "Carnegie Mellon";
    			t265 = space();
    			tr48 = element("tr");
    			th78 = element("th");
    			th78.textContent = "2020";
    			t267 = space();
    			th79 = element("th");
    			h528 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t269 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "Data Stories Podcast";
    			t271 = space();
    			tr49 = element("tr");
    			th80 = element("th");
    			th80.textContent = "2019";
    			t273 = space();
    			th81 = element("th");
    			h529 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t275 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "GT SCS";
    			t277 = space();
    			tr50 = element("tr");
    			th82 = element("th");
    			th82.textContent = "2019";
    			t279 = space();
    			th83 = element("th");
    			h530 = element("h5");
    			a17 = element("a");
    			a17.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t281 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "Georgia Tech";
    			t283 = space();
    			tr51 = element("tr");
    			th84 = element("th");
    			th84.textContent = "2018";
    			t285 = space();
    			th85 = element("th");
    			h531 = element("h5");
    			a18 = element("a");
    			a18.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t287 = text("\n            -\n            ");
    			i14 = element("i");
    			i14.textContent = "GT SCS";
    			t289 = space();
    			tr52 = element("tr");
    			th86 = element("th");
    			t290 = space();
    			th87 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Projects and Open Source";
    			t292 = space();
    			tr53 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Spring 2021";
    			t294 = space();
    			th89 = element("th");
    			h532 = element("h5");
    			h532.textContent = "Svelte + Vega";
    			t296 = space();
    			p16 = element("p");
    			p16.textContent = "A Svelte component for reactively rendering Vega and Vega-Lite\n            visualizations.";
    			t298 = space();
    			div8 = element("div");
    			a19 = element("a");
    			button8 = element("button");
    			i15 = element("i");
    			t299 = text(" GitHub");
    			t300 = space();
    			a20 = element("a");
    			button9 = element("button");
    			i16 = element("i");
    			t301 = text(" Demo");
    			t302 = space();
    			tr54 = element("tr");
    			t303 = space();
    			tr55 = element("tr");
    			th90 = element("th");
    			th90.textContent = "Spring 2021";
    			t305 = space();
    			th91 = element("th");
    			h533 = element("h5");
    			h533.textContent = "Svelte + Jupyter Widgets";
    			t307 = space();
    			p17 = element("p");
    			p17.textContent = "A framework for creating reactive data science widgets using Svelte\n            JS.";
    			t309 = space();
    			div9 = element("div");
    			a21 = element("a");
    			button10 = element("button");
    			i17 = element("i");
    			t310 = text(" Blog");
    			t311 = space();
    			a22 = element("a");
    			button11 = element("button");
    			i18 = element("i");
    			t312 = text(" GitHub");
    			t313 = space();
    			a23 = element("a");
    			button12 = element("button");
    			i19 = element("i");
    			t314 = text(" Video");
    			t315 = space();
    			tr56 = element("tr");
    			t316 = space();
    			tr57 = element("tr");
    			th92 = element("th");
    			th92.textContent = "Spring 2020";
    			t318 = space();
    			th93 = element("th");
    			h534 = element("h5");
    			h534.textContent = "COVIDCast Visualization of COVID-19 Indicators";
    			t320 = space();
    			p18 = element("p");
    			t321 = text("Interactive visualization system of COVID-19 indicators gathered\n            through >20,000,000 surveys on Facebook and Google by ");
    			a24 = element("a");
    			a24.textContent = "CMU Delphi";
    			t323 = text(".");
    			t324 = space();
    			div10 = element("div");
    			a26 = element("a");
    			button13 = element("button");
    			i20 = element("i");
    			t325 = text(" Website");
    			t326 = space();
    			a25 = element("a");
    			button14 = element("button");
    			i21 = element("i");
    			t327 = text(" GitHub");
    			t328 = space();
    			tr58 = element("tr");
    			t329 = space();
    			tr59 = element("tr");
    			th94 = element("th");
    			t330 = text("September 2015 ");
    			br17 = element("br");
    			t331 = text(" - May 2017");
    			t332 = space();
    			th95 = element("th");
    			h535 = element("h5");
    			h535.textContent = "PROX-1 Satellite";
    			t334 = space();
    			h614 = element("h6");
    			h614.textContent = "Flight Software Lead and Researcher";
    			t336 = space();
    			p19 = element("p");
    			p19.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t338 = space();
    			div11 = element("div");
    			a27 = element("a");
    			button15 = element("button");
    			i22 = element("i");
    			t339 = text(" In space!");
    			t340 = space();
    			a28 = element("a");
    			button16 = element("button");
    			i23 = element("i");
    			t341 = text(" Press release");
    			t342 = space();
    			tr60 = element("tr");
    			t343 = space();
    			tr61 = element("tr");
    			th96 = element("th");
    			th96.textContent = "Spring 2014";
    			t345 = space();
    			th97 = element("th");
    			h536 = element("h5");
    			h536.textContent = "CTF Resources";
    			t347 = space();
    			p20 = element("p");
    			p20.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1.4k stars on GitHub.";
    			t349 = space();
    			div12 = element("div");
    			a29 = element("a");
    			button17 = element("button");
    			i24 = element("i");
    			t350 = text(" Website");
    			t351 = space();
    			a30 = element("a");
    			button18 = element("button");
    			i25 = element("i");
    			t352 = text(" GitHub");
    			t353 = space();
    			tr62 = element("tr");
    			th98 = element("th");
    			t354 = space();
    			th99 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Selected Classes";
    			t356 = space();
    			tr63 = element("tr");
    			th100 = element("th");
    			th100.textContent = "PhD";
    			t358 = space();
    			th101 = element("th");
    			h537 = element("h5");
    			h537.textContent = "Causality and Machine Learning";
    			t360 = space();
    			h538 = element("h5");
    			h538.textContent = "Human Judgement and Decision Making";
    			t362 = space();
    			a31 = element("a");
    			h539 = element("h5");
    			h539.textContent = "Applied Research Methods";
    			t364 = space();
    			tr64 = element("tr");
    			th102 = element("th");
    			th102.textContent = "B.S.";
    			t366 = space();
    			th103 = element("th");
    			a32 = element("a");
    			h540 = element("h5");
    			h540.textContent = "Deep Learning";
    			t368 = space();
    			a33 = element("a");
    			h541 = element("h5");
    			h541.textContent = "Data and Visual Analytics";
    			t370 = space();
    			a34 = element("a");
    			h542 = element("h5");
    			h542.textContent = "Machine Learning";
    			t372 = space();
    			a35 = element("a");
    			h543 = element("h5");
    			h543.textContent = "Computer Simulation";
    			t374 = space();
    			h544 = element("h5");
    			h544.textContent = "Honors Algorithms";
    			t376 = space();
    			tr65 = element("tr");
    			attr_dev(th0, "class", "date svelte-1v7h9f9");
    			add_location(th0, file$9, 19, 8, 493);
    			attr_dev(span0, "class", "color svelte-1v7h9f9");
    			add_location(span0, file$9, 22, 12, 577);
    			attr_dev(span1, "class", "color red svelte-1v7h9f9");
    			add_location(span1, file$9, 23, 12, 628);
    			attr_dev(span2, "class", "color svelte-1v7h9f9");
    			add_location(span2, file$9, 24, 12, 676);
    			attr_dev(span3, "class", "color red svelte-1v7h9f9");
    			add_location(span3, file$9, 25, 12, 727);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-1v7h9f9");
    			add_location(h3, file$9, 21, 10, 550);
    			attr_dev(th1, "class", "intro svelte-1v7h9f9");
    			add_location(th1, file$9, 20, 8, 521);
    			add_location(tr0, file$9, 18, 6, 480);
    			attr_dev(th2, "class", "date svelte-1v7h9f9");
    			add_location(th2, file$9, 34, 8, 907);
    			attr_dev(h40, "class", "header svelte-1v7h9f9");
    			add_location(h40, file$9, 36, 10, 950);
    			attr_dev(th3, "class", "svelte-1v7h9f9");
    			add_location(th3, file$9, 35, 8, 935);
    			add_location(tr1, file$9, 33, 6, 894);
    			add_location(br0, file$9, 40, 37, 1071);
    			attr_dev(th4, "class", "date svelte-1v7h9f9");
    			add_location(th4, file$9, 40, 8, 1042);
    			attr_dev(h50, "class", "svelte-1v7h9f9");
    			add_location(h50, file$9, 42, 10, 1116);
    			attr_dev(h60, "class", "svelte-1v7h9f9");
    			add_location(h60, file$9, 43, 10, 1175);
    			attr_dev(a0, "href", "http://perer.org");
    			add_location(a0, file$9, 46, 12, 1273);
    			attr_dev(a1, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a1, file$9, 48, 12, 1343);
    			attr_dev(p0, "class", "desc svelte-1v7h9f9");
    			add_location(p0, file$9, 44, 10, 1221);
    			attr_dev(i0, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i0, file$9, 53, 16, 1546);
    			attr_dev(button0, "class", "entry-link");
    			add_location(button0, file$9, 52, 14, 1502);
    			attr_dev(a2, "href", "https://dig.cmu.edu/");
    			add_location(a2, file$9, 51, 12, 1456);
    			attr_dev(div0, "class", "tags");
    			add_location(div0, file$9, 50, 10, 1425);
    			attr_dev(th5, "class", "svelte-1v7h9f9");
    			add_location(th5, file$9, 41, 8, 1101);
    			attr_dev(tr2, "class", "item svelte-1v7h9f9");
    			add_location(tr2, file$9, 39, 6, 1016);
    			attr_dev(tr3, "class", "buffer svelte-1v7h9f9");
    			add_location(tr3, file$9, 60, 6, 1702);
    			add_location(br1, file$9, 62, 37, 1785);
    			attr_dev(th6, "class", "date svelte-1v7h9f9");
    			add_location(th6, file$9, 62, 8, 1756);
    			attr_dev(h51, "class", "svelte-1v7h9f9");
    			add_location(h51, file$9, 64, 10, 1831);
    			attr_dev(h61, "class", "svelte-1v7h9f9");
    			add_location(h61, file$9, 65, 10, 1875);
    			add_location(br2, file$9, 68, 12, 2022);
    			attr_dev(p1, "class", "desc svelte-1v7h9f9");
    			add_location(p1, file$9, 66, 10, 1926);
    			attr_dev(th7, "class", "svelte-1v7h9f9");
    			add_location(th7, file$9, 63, 8, 1816);
    			attr_dev(tr4, "class", "item svelte-1v7h9f9");
    			add_location(tr4, file$9, 61, 6, 1730);
    			attr_dev(th8, "class", "date svelte-1v7h9f9");
    			add_location(th8, file$9, 74, 8, 2134);
    			attr_dev(h62, "class", "svelte-1v7h9f9");
    			add_location(h62, file$9, 76, 10, 2189);
    			attr_dev(p2, "class", "desc svelte-1v7h9f9");
    			add_location(p2, file$9, 77, 10, 2236);
    			attr_dev(th9, "class", "svelte-1v7h9f9");
    			add_location(th9, file$9, 75, 8, 2174);
    			attr_dev(tr5, "class", "item svelte-1v7h9f9");
    			add_location(tr5, file$9, 73, 6, 2108);
    			attr_dev(th10, "class", "date svelte-1v7h9f9");
    			add_location(th10, file$9, 84, 8, 2415);
    			attr_dev(h41, "class", "header svelte-1v7h9f9");
    			add_location(h41, file$9, 86, 10, 2458);
    			attr_dev(th11, "class", "svelte-1v7h9f9");
    			add_location(th11, file$9, 85, 8, 2443);
    			add_location(tr6, file$9, 83, 6, 2402);
    			add_location(br3, file$9, 90, 34, 2582);
    			attr_dev(th12, "class", "date svelte-1v7h9f9");
    			add_location(th12, file$9, 90, 8, 2556);
    			attr_dev(h52, "class", "svelte-1v7h9f9");
    			add_location(h52, file$9, 92, 10, 2627);
    			attr_dev(h63, "class", "svelte-1v7h9f9");
    			add_location(h63, file$9, 93, 10, 2652);
    			attr_dev(p3, "class", "desc svelte-1v7h9f9");
    			add_location(p3, file$9, 94, 10, 2687);
    			attr_dev(i1, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i1, file$9, 98, 16, 2882);
    			attr_dev(button1, "class", "entry-link");
    			add_location(button1, file$9, 97, 14, 2838);
    			attr_dev(a3, "href", "https://machinelearning.apple.com/");
    			add_location(a3, file$9, 96, 12, 2778);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file$9, 95, 10, 2747);
    			attr_dev(th13, "class", "svelte-1v7h9f9");
    			add_location(th13, file$9, 91, 8, 2612);
    			attr_dev(tr7, "class", "item svelte-1v7h9f9");
    			add_location(tr7, file$9, 89, 6, 2530);
    			attr_dev(tr8, "class", "buffer svelte-1v7h9f9");
    			add_location(tr8, file$9, 104, 6, 3011);
    			add_location(br4, file$9, 106, 34, 3091);
    			attr_dev(th14, "class", "date svelte-1v7h9f9");
    			add_location(th14, file$9, 106, 8, 3065);
    			attr_dev(h53, "class", "svelte-1v7h9f9");
    			add_location(h53, file$9, 108, 10, 3140);
    			attr_dev(h64, "class", "svelte-1v7h9f9");
    			add_location(h64, file$9, 109, 10, 3178);
    			attr_dev(a4, "href", "https://www.microsoft.com/en-us/research/people/sdrucker/");
    			add_location(a4, file$9, 112, 12, 3300);
    			attr_dev(a5, "href", "https://homes.cs.washington.edu/~marcotcr/");
    			add_location(a5, file$9, 116, 12, 3443);
    			attr_dev(p4, "class", "desc svelte-1v7h9f9");
    			add_location(p4, file$9, 110, 10, 3213);
    			attr_dev(i2, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i2, file$9, 123, 16, 3727);
    			attr_dev(button2, "class", "entry-link");
    			add_location(button2, file$9, 122, 14, 3683);
    			attr_dev(a6, "href", "https://www.microsoft.com/en-us/research/group/vida/");
    			add_location(a6, file$9, 121, 12, 3605);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file$9, 120, 10, 3574);
    			attr_dev(th15, "class", "svelte-1v7h9f9");
    			add_location(th15, file$9, 107, 8, 3125);
    			attr_dev(tr9, "class", "item svelte-1v7h9f9");
    			add_location(tr9, file$9, 105, 6, 3039);
    			attr_dev(tr10, "class", "buffer svelte-1v7h9f9");
    			add_location(tr10, file$9, 129, 6, 3855);
    			add_location(br5, file$9, 131, 34, 3935);
    			attr_dev(th16, "class", "date svelte-1v7h9f9");
    			add_location(th16, file$9, 131, 8, 3909);
    			attr_dev(h54, "class", "svelte-1v7h9f9");
    			add_location(h54, file$9, 133, 10, 3984);
    			attr_dev(h65, "class", "svelte-1v7h9f9");
    			add_location(h65, file$9, 134, 10, 4010);
    			attr_dev(p5, "class", "desc svelte-1v7h9f9");
    			add_location(p5, file$9, 135, 10, 4057);
    			attr_dev(i3, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i3, file$9, 146, 16, 4517);
    			attr_dev(button3, "class", "entry-link");
    			add_location(button3, file$9, 145, 14, 4473);
    			attr_dev(a7, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n                ");
    			add_location(a7, file$9, 141, 12, 4320);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file$9, 140, 10, 4289);
    			attr_dev(th17, "class", "svelte-1v7h9f9");
    			add_location(th17, file$9, 132, 8, 3969);
    			attr_dev(tr11, "class", "item svelte-1v7h9f9");
    			add_location(tr11, file$9, 130, 6, 3883);
    			attr_dev(tr12, "class", "buffer svelte-1v7h9f9");
    			add_location(tr12, file$9, 153, 6, 4666);
    			add_location(br6, file$9, 155, 34, 4746);
    			attr_dev(th18, "class", "date svelte-1v7h9f9");
    			add_location(th18, file$9, 155, 8, 4720);
    			attr_dev(h55, "class", "svelte-1v7h9f9");
    			add_location(h55, file$9, 157, 10, 4795);
    			attr_dev(h66, "class", "svelte-1v7h9f9");
    			add_location(h66, file$9, 158, 10, 4821);
    			attr_dev(p6, "class", "desc svelte-1v7h9f9");
    			add_location(p6, file$9, 159, 10, 4868);
    			attr_dev(th19, "class", "svelte-1v7h9f9");
    			add_location(th19, file$9, 156, 8, 4780);
    			attr_dev(tr13, "class", "item svelte-1v7h9f9");
    			add_location(tr13, file$9, 154, 6, 4694);
    			attr_dev(tr14, "class", "buffer svelte-1v7h9f9");
    			add_location(tr14, file$9, 165, 6, 5051);
    			add_location(br7, file$9, 167, 34, 5131);
    			attr_dev(th20, "class", "date svelte-1v7h9f9");
    			add_location(th20, file$9, 167, 8, 5105);
    			attr_dev(h56, "class", "svelte-1v7h9f9");
    			add_location(h56, file$9, 169, 10, 5180);
    			attr_dev(h67, "class", "svelte-1v7h9f9");
    			add_location(h67, file$9, 170, 10, 5206);
    			attr_dev(p7, "class", "desc svelte-1v7h9f9");
    			add_location(p7, file$9, 171, 10, 5254);
    			attr_dev(th21, "class", "svelte-1v7h9f9");
    			add_location(th21, file$9, 168, 8, 5165);
    			attr_dev(tr15, "class", "item svelte-1v7h9f9");
    			add_location(tr15, file$9, 166, 6, 5079);
    			attr_dev(th22, "class", "date svelte-1v7h9f9");
    			add_location(th22, file$9, 179, 8, 5465);
    			attr_dev(h42, "class", "header svelte-1v7h9f9");
    			add_location(h42, file$9, 181, 10, 5508);
    			attr_dev(th23, "class", "svelte-1v7h9f9");
    			add_location(th23, file$9, 180, 8, 5493);
    			add_location(tr16, file$9, 178, 6, 5452);
    			attr_dev(th24, "class", "date svelte-1v7h9f9");
    			add_location(th24, file$9, 185, 8, 5597);
    			attr_dev(h57, "class", "svelte-1v7h9f9");
    			add_location(h57, file$9, 187, 10, 5651);
    			attr_dev(p8, "class", "desc svelte-1v7h9f9");
    			add_location(p8, file$9, 190, 10, 5762);
    			attr_dev(i4, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i4, file$9, 197, 16, 6058);
    			attr_dev(button4, "class", "entry-link");
    			add_location(button4, file$9, 196, 14, 6014);
    			attr_dev(a8, "href", "https://www.nsfgrfp.org/");
    			add_location(a8, file$9, 195, 12, 5964);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file$9, 194, 10, 5933);
    			attr_dev(th25, "class", "svelte-1v7h9f9");
    			add_location(th25, file$9, 186, 8, 5636);
    			attr_dev(tr17, "class", "item svelte-1v7h9f9");
    			add_location(tr17, file$9, 184, 6, 5571);
    			attr_dev(tr18, "class", "buffer svelte-1v7h9f9");
    			add_location(tr18, file$9, 203, 6, 6183);
    			attr_dev(th26, "class", "date svelte-1v7h9f9");
    			add_location(th26, file$9, 205, 8, 6237);
    			attr_dev(h58, "class", "svelte-1v7h9f9");
    			add_location(h58, file$9, 207, 10, 6291);
    			attr_dev(p9, "class", "desc svelte-1v7h9f9");
    			add_location(p9, file$9, 208, 10, 6345);
    			attr_dev(i5, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i5, file$9, 217, 16, 6758);
    			attr_dev(button5, "class", "entry-link");
    			add_location(button5, file$9, 216, 14, 6714);
    			attr_dev(a9, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a9, file$9, 213, 12, 6544);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file$9, 212, 10, 6513);
    			attr_dev(th27, "class", "svelte-1v7h9f9");
    			add_location(th27, file$9, 206, 8, 6276);
    			attr_dev(tr19, "class", "item svelte-1v7h9f9");
    			add_location(tr19, file$9, 204, 6, 6211);
    			attr_dev(tr20, "class", "buffer svelte-1v7h9f9");
    			add_location(tr20, file$9, 223, 6, 6888);
    			add_location(br8, file$9, 225, 37, 6971);
    			attr_dev(th28, "class", "date svelte-1v7h9f9");
    			add_location(th28, file$9, 225, 8, 6942);
    			attr_dev(h59, "class", "svelte-1v7h9f9");
    			add_location(h59, file$9, 227, 10, 7017);
    			attr_dev(h68, "class", "svelte-1v7h9f9");
    			add_location(h68, file$9, 228, 10, 7063);
    			attr_dev(p10, "class", "desc svelte-1v7h9f9");
    			add_location(p10, file$9, 229, 10, 7139);
    			attr_dev(i6, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i6, file$9, 236, 16, 7429);
    			attr_dev(button6, "class", "entry-link");
    			add_location(button6, file$9, 235, 14, 7385);
    			attr_dev(a10, "href", "https://stampsps.gatech.edu/");
    			add_location(a10, file$9, 234, 12, 7331);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file$9, 233, 10, 7300);
    			attr_dev(th29, "class", "svelte-1v7h9f9");
    			add_location(th29, file$9, 226, 8, 7002);
    			attr_dev(tr21, "class", "item svelte-1v7h9f9");
    			add_location(tr21, file$9, 224, 6, 6916);
    			attr_dev(tr22, "class", "buffer svelte-1v7h9f9");
    			add_location(tr22, file$9, 242, 6, 7554);
    			attr_dev(th30, "class", "date svelte-1v7h9f9");
    			add_location(th30, file$9, 244, 8, 7608);
    			attr_dev(h510, "class", "svelte-1v7h9f9");
    			add_location(h510, file$9, 246, 10, 7670);
    			attr_dev(h69, "class", "svelte-1v7h9f9");
    			add_location(h69, file$9, 247, 10, 7712);
    			attr_dev(p11, "class", "desc svelte-1v7h9f9");
    			add_location(p11, file$9, 248, 10, 7770);
    			attr_dev(i7, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i7, file$9, 257, 16, 8153);
    			attr_dev(button7, "class", "entry-link");
    			add_location(button7, file$9, 256, 14, 8109);
    			attr_dev(a11, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a11, file$9, 253, 12, 7953);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file$9, 252, 10, 7922);
    			attr_dev(th31, "class", "svelte-1v7h9f9");
    			add_location(th31, file$9, 245, 8, 7655);
    			attr_dev(tr23, "class", "item svelte-1v7h9f9");
    			add_location(tr23, file$9, 243, 6, 7582);
    			attr_dev(th32, "class", "date svelte-1v7h9f9");
    			add_location(th32, file$9, 301, 8, 9490);
    			attr_dev(h43, "class", "header svelte-1v7h9f9");
    			add_location(h43, file$9, 303, 10, 9533);
    			attr_dev(th33, "class", "svelte-1v7h9f9");
    			add_location(th33, file$9, 302, 8, 9518);
    			add_location(tr24, file$9, 300, 6, 9477);
    			attr_dev(th34, "class", "date svelte-1v7h9f9");
    			add_location(th34, file$9, 336, 8, 10445);
    			attr_dev(h44, "class", "header svelte-1v7h9f9");
    			add_location(h44, file$9, 338, 10, 10488);
    			attr_dev(th35, "class", "svelte-1v7h9f9");
    			add_location(th35, file$9, 337, 8, 10473);
    			add_location(tr25, file$9, 335, 6, 10432);
    			attr_dev(th36, "class", "date svelte-1v7h9f9");
    			add_location(th36, file$9, 371, 8, 11418);
    			attr_dev(h45, "class", "header svelte-1v7h9f9");
    			add_location(h45, file$9, 373, 10, 11461);
    			attr_dev(th37, "class", "svelte-1v7h9f9");
    			add_location(th37, file$9, 372, 8, 11446);
    			add_location(tr26, file$9, 370, 6, 11405);
    			add_location(br9, file$9, 377, 35, 11579);
    			add_location(br10, file$9, 377, 54, 11598);
    			attr_dev(th38, "class", "date svelte-1v7h9f9");
    			add_location(th38, file$9, 377, 8, 11552);
    			attr_dev(h511, "class", "svelte-1v7h9f9");
    			add_location(h511, file$9, 379, 10, 11645);
    			attr_dev(h610, "class", "svelte-1v7h9f9");
    			add_location(h610, file$9, 380, 10, 11704);
    			attr_dev(p12, "class", "desc svelte-1v7h9f9");
    			add_location(p12, file$9, 381, 10, 11771);
    			attr_dev(th39, "class", "svelte-1v7h9f9");
    			add_location(th39, file$9, 378, 8, 11630);
    			attr_dev(tr27, "class", "item svelte-1v7h9f9");
    			add_location(tr27, file$9, 376, 6, 11526);
    			attr_dev(tr28, "class", "buffer svelte-1v7h9f9");
    			add_location(tr28, file$9, 387, 6, 11956);
    			attr_dev(th40, "class", "date svelte-1v7h9f9");
    			add_location(th40, file$9, 389, 8, 12010);
    			attr_dev(h512, "class", "svelte-1v7h9f9");
    			add_location(h512, file$9, 391, 10, 12065);
    			attr_dev(h611, "class", "svelte-1v7h9f9");
    			add_location(h611, file$9, 392, 10, 12113);
    			attr_dev(p13, "class", "desc svelte-1v7h9f9");
    			add_location(p13, file$9, 393, 10, 12159);
    			attr_dev(th41, "class", "svelte-1v7h9f9");
    			add_location(th41, file$9, 390, 8, 12050);
    			attr_dev(tr29, "class", "item svelte-1v7h9f9");
    			add_location(tr29, file$9, 388, 6, 11984);
    			attr_dev(th42, "class", "date svelte-1v7h9f9");
    			add_location(th42, file$9, 401, 8, 12378);
    			attr_dev(h46, "class", "header svelte-1v7h9f9");
    			add_location(h46, file$9, 403, 10, 12421);
    			attr_dev(th43, "class", "svelte-1v7h9f9");
    			add_location(th43, file$9, 402, 8, 12406);
    			add_location(tr30, file$9, 400, 6, 12365);
    			add_location(br11, file$9, 407, 37, 12542);
    			attr_dev(th44, "class", "date svelte-1v7h9f9");
    			add_location(th44, file$9, 407, 8, 12513);
    			attr_dev(h513, "class", "svelte-1v7h9f9");
    			add_location(h513, file$9, 409, 10, 12587);
    			attr_dev(h612, "class", "svelte-1v7h9f9");
    			add_location(h612, file$9, 410, 10, 12617);
    			attr_dev(p14, "class", "desc svelte-1v7h9f9");
    			add_location(p14, file$9, 411, 10, 12693);
    			attr_dev(th45, "class", "svelte-1v7h9f9");
    			add_location(th45, file$9, 408, 8, 12572);
    			attr_dev(tr31, "class", "item svelte-1v7h9f9");
    			add_location(tr31, file$9, 406, 6, 12487);
    			add_location(br12, file$9, 414, 6, 12776);
    			add_location(br13, file$9, 416, 37, 12844);
    			attr_dev(th46, "class", "date svelte-1v7h9f9");
    			add_location(th46, file$9, 416, 8, 12815);
    			attr_dev(h514, "class", "svelte-1v7h9f9");
    			add_location(h514, file$9, 418, 10, 12889);
    			attr_dev(h613, "class", "svelte-1v7h9f9");
    			add_location(h613, file$9, 419, 10, 12922);
    			attr_dev(p15, "class", "desc svelte-1v7h9f9");
    			add_location(p15, file$9, 420, 10, 12988);
    			attr_dev(th47, "class", "svelte-1v7h9f9");
    			add_location(th47, file$9, 417, 8, 12874);
    			attr_dev(tr32, "class", "item svelte-1v7h9f9");
    			add_location(tr32, file$9, 415, 6, 12789);
    			add_location(br14, file$9, 425, 6, 13127);
    			add_location(br15, file$9, 427, 35, 13193);
    			attr_dev(th48, "class", "date svelte-1v7h9f9");
    			add_location(th48, file$9, 427, 8, 13166);
    			attr_dev(h515, "class", "svelte-1v7h9f9");
    			add_location(h515, file$9, 429, 10, 13240);
    			attr_dev(th49, "class", "svelte-1v7h9f9");
    			add_location(th49, file$9, 428, 8, 13225);
    			attr_dev(tr33, "class", "item svelte-1v7h9f9");
    			add_location(tr33, file$9, 426, 6, 13140);
    			attr_dev(th50, "class", "date svelte-1v7h9f9");
    			add_location(th50, file$9, 434, 8, 13342);
    			attr_dev(h47, "class", "header svelte-1v7h9f9");
    			add_location(h47, file$9, 436, 10, 13385);
    			attr_dev(th51, "class", "svelte-1v7h9f9");
    			add_location(th51, file$9, 435, 8, 13370);
    			add_location(tr34, file$9, 433, 6, 13329);
    			attr_dev(th52, "class", "date svelte-1v7h9f9");
    			add_location(th52, file$9, 440, 8, 13475);
    			attr_dev(h516, "class", "svelte-1v7h9f9");
    			add_location(h516, file$9, 442, 10, 13518);
    			attr_dev(th53, "class", "svelte-1v7h9f9");
    			add_location(th53, file$9, 441, 8, 13503);
    			attr_dev(tr35, "class", "item svelte-1v7h9f9");
    			add_location(tr35, file$9, 439, 6, 13449);
    			attr_dev(th54, "class", "date svelte-1v7h9f9");
    			add_location(th54, file$9, 446, 8, 13590);
    			attr_dev(h517, "class", "single svelte-1v7h9f9");
    			add_location(h517, file$9, 448, 10, 13648);
    			attr_dev(th55, "class", "svelte-1v7h9f9");
    			add_location(th55, file$9, 447, 8, 13633);
    			add_location(tr36, file$9, 445, 6, 13577);
    			attr_dev(th56, "class", "date svelte-1v7h9f9");
    			add_location(th56, file$9, 452, 8, 13742);
    			attr_dev(h518, "class", "single svelte-1v7h9f9");
    			add_location(h518, file$9, 454, 10, 13800);
    			attr_dev(th57, "class", "svelte-1v7h9f9");
    			add_location(th57, file$9, 453, 8, 13785);
    			add_location(tr37, file$9, 451, 6, 13729);
    			add_location(br16, file$9, 459, 6, 13934);
    			attr_dev(th58, "class", "date svelte-1v7h9f9");
    			add_location(th58, file$9, 461, 8, 13973);
    			attr_dev(h519, "class", "svelte-1v7h9f9");
    			add_location(h519, file$9, 463, 10, 14016);
    			attr_dev(th59, "class", "svelte-1v7h9f9");
    			add_location(th59, file$9, 462, 8, 14001);
    			attr_dev(tr38, "class", "item svelte-1v7h9f9");
    			add_location(tr38, file$9, 460, 6, 13947);
    			attr_dev(th60, "class", "date svelte-1v7h9f9");
    			add_location(th60, file$9, 467, 8, 14079);
    			attr_dev(h520, "class", "single svelte-1v7h9f9");
    			add_location(h520, file$9, 469, 10, 14136);
    			attr_dev(th61, "class", "svelte-1v7h9f9");
    			add_location(th61, file$9, 468, 8, 14121);
    			add_location(tr39, file$9, 466, 6, 14066);
    			attr_dev(th62, "class", "date svelte-1v7h9f9");
    			add_location(th62, file$9, 475, 8, 14293);
    			attr_dev(h521, "class", "single svelte-1v7h9f9");
    			add_location(h521, file$9, 477, 10, 14350);
    			attr_dev(th63, "class", "svelte-1v7h9f9");
    			add_location(th63, file$9, 476, 8, 14335);
    			add_location(tr40, file$9, 474, 6, 14280);
    			attr_dev(th64, "class", "date svelte-1v7h9f9");
    			add_location(th64, file$9, 481, 8, 14444);
    			attr_dev(h522, "class", "single svelte-1v7h9f9");
    			add_location(h522, file$9, 483, 10, 14494);
    			attr_dev(th65, "class", "svelte-1v7h9f9");
    			add_location(th65, file$9, 482, 8, 14479);
    			add_location(tr41, file$9, 480, 6, 14431);
    			attr_dev(th66, "class", "date svelte-1v7h9f9");
    			add_location(th66, file$9, 490, 8, 14681);
    			attr_dev(h523, "class", "single svelte-1v7h9f9");
    			add_location(h523, file$9, 492, 10, 14731);
    			attr_dev(th67, "class", "svelte-1v7h9f9");
    			add_location(th67, file$9, 491, 8, 14716);
    			add_location(tr42, file$9, 489, 6, 14668);
    			attr_dev(th68, "class", "date svelte-1v7h9f9");
    			add_location(th68, file$9, 498, 8, 14883);
    			attr_dev(h524, "class", "single svelte-1v7h9f9");
    			add_location(h524, file$9, 500, 10, 14933);
    			attr_dev(th69, "class", "svelte-1v7h9f9");
    			add_location(th69, file$9, 499, 8, 14918);
    			add_location(tr43, file$9, 497, 6, 14870);
    			attr_dev(th70, "class", "date svelte-1v7h9f9");
    			add_location(th70, file$9, 507, 8, 15106);
    			attr_dev(h48, "class", "header svelte-1v7h9f9");
    			add_location(h48, file$9, 509, 10, 15149);
    			attr_dev(th71, "class", "svelte-1v7h9f9");
    			add_location(th71, file$9, 508, 8, 15134);
    			add_location(tr44, file$9, 506, 6, 15093);
    			attr_dev(th72, "class", "date svelte-1v7h9f9");
    			add_location(th72, file$9, 513, 8, 15224);
    			attr_dev(a12, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			attr_dev(a12, "class", "svelte-1v7h9f9");
    			add_location(a12, file$9, 516, 12, 15312);
    			add_location(i8, file$9, 523, 12, 15630);
    			attr_dev(h525, "class", "single press svelte-1v7h9f9");
    			add_location(h525, file$9, 515, 10, 15274);
    			attr_dev(th73, "class", "svelte-1v7h9f9");
    			add_location(th73, file$9, 514, 8, 15259);
    			add_location(tr45, file$9, 512, 6, 15211);
    			attr_dev(th74, "class", "date svelte-1v7h9f9");
    			add_location(th74, file$9, 528, 8, 15702);
    			attr_dev(a13, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			attr_dev(a13, "class", "svelte-1v7h9f9");
    			add_location(a13, file$9, 531, 12, 15790);
    			add_location(i9, file$9, 537, 12, 16036);
    			attr_dev(h526, "class", "single press svelte-1v7h9f9");
    			add_location(h526, file$9, 530, 10, 15752);
    			attr_dev(th75, "class", "svelte-1v7h9f9");
    			add_location(th75, file$9, 529, 8, 15737);
    			add_location(tr46, file$9, 527, 6, 15689);
    			attr_dev(th76, "class", "date svelte-1v7h9f9");
    			add_location(th76, file$9, 542, 8, 16110);
    			attr_dev(a14, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			attr_dev(a14, "class", "svelte-1v7h9f9");
    			add_location(a14, file$9, 545, 12, 16198);
    			add_location(i10, file$9, 551, 12, 16435);
    			attr_dev(h527, "class", "single press svelte-1v7h9f9");
    			add_location(h527, file$9, 544, 10, 16160);
    			attr_dev(th77, "class", "svelte-1v7h9f9");
    			add_location(th77, file$9, 543, 8, 16145);
    			add_location(tr47, file$9, 541, 6, 16097);
    			attr_dev(th78, "class", "date svelte-1v7h9f9");
    			add_location(th78, file$9, 556, 8, 16519);
    			attr_dev(a15, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			attr_dev(a15, "class", "svelte-1v7h9f9");
    			add_location(a15, file$9, 559, 12, 16607);
    			add_location(i11, file$9, 565, 12, 16833);
    			attr_dev(h528, "class", "single press svelte-1v7h9f9");
    			add_location(h528, file$9, 558, 10, 16569);
    			attr_dev(th79, "class", "svelte-1v7h9f9");
    			add_location(th79, file$9, 557, 8, 16554);
    			add_location(tr48, file$9, 555, 6, 16506);
    			attr_dev(th80, "class", "date svelte-1v7h9f9");
    			add_location(th80, file$9, 570, 8, 16922);
    			attr_dev(a16, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			attr_dev(a16, "class", "svelte-1v7h9f9");
    			add_location(a16, file$9, 573, 12, 17010);
    			add_location(i12, file$9, 579, 12, 17278);
    			attr_dev(h529, "class", "single press svelte-1v7h9f9");
    			add_location(h529, file$9, 572, 10, 16972);
    			attr_dev(th81, "class", "svelte-1v7h9f9");
    			add_location(th81, file$9, 571, 8, 16957);
    			add_location(tr49, file$9, 569, 6, 16909);
    			attr_dev(th82, "class", "date svelte-1v7h9f9");
    			add_location(th82, file$9, 584, 8, 17353);
    			attr_dev(a17, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			attr_dev(a17, "class", "svelte-1v7h9f9");
    			add_location(a17, file$9, 587, 12, 17441);
    			add_location(i13, file$9, 593, 12, 17685);
    			attr_dev(h530, "class", "single press svelte-1v7h9f9");
    			add_location(h530, file$9, 586, 10, 17403);
    			attr_dev(th83, "class", "svelte-1v7h9f9");
    			add_location(th83, file$9, 585, 8, 17388);
    			add_location(tr50, file$9, 583, 6, 17340);
    			attr_dev(th84, "class", "date svelte-1v7h9f9");
    			add_location(th84, file$9, 598, 8, 17766);
    			attr_dev(a18, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			attr_dev(a18, "class", "svelte-1v7h9f9");
    			add_location(a18, file$9, 601, 12, 17854);
    			add_location(i14, file$9, 608, 12, 18141);
    			attr_dev(h531, "class", "single press svelte-1v7h9f9");
    			add_location(h531, file$9, 600, 10, 17816);
    			attr_dev(th85, "class", "svelte-1v7h9f9");
    			add_location(th85, file$9, 599, 8, 17801);
    			add_location(tr51, file$9, 597, 6, 17753);
    			attr_dev(th86, "class", "date svelte-1v7h9f9");
    			add_location(th86, file$9, 614, 8, 18240);
    			attr_dev(h49, "class", "header svelte-1v7h9f9");
    			add_location(h49, file$9, 616, 10, 18283);
    			attr_dev(th87, "class", "svelte-1v7h9f9");
    			add_location(th87, file$9, 615, 8, 18268);
    			add_location(tr52, file$9, 613, 6, 18227);
    			attr_dev(th88, "class", "date svelte-1v7h9f9");
    			add_location(th88, file$9, 620, 8, 18390);
    			attr_dev(h532, "class", "svelte-1v7h9f9");
    			add_location(h532, file$9, 622, 10, 18447);
    			attr_dev(p16, "class", "desc svelte-1v7h9f9");
    			add_location(p16, file$9, 623, 10, 18480);
    			attr_dev(i15, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i15, file$9, 630, 16, 18761);
    			attr_dev(button8, "class", "entry-link");
    			add_location(button8, file$9, 629, 14, 18717);
    			attr_dev(a19, "href", "https://github.com/vega/svelte-vega");
    			add_location(a19, file$9, 628, 12, 18656);
    			attr_dev(i16, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i16, file$9, 637, 16, 19016);
    			attr_dev(button9, "class", "entry-link");
    			add_location(button9, file$9, 636, 14, 18972);
    			attr_dev(a20, "href", "https://vega.github.io/svelte-vega/?path=/story/svelte-vega-vega--demo");
    			add_location(a20, file$9, 633, 12, 18849);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file$9, 627, 10, 18625);
    			attr_dev(th89, "class", "svelte-1v7h9f9");
    			add_location(th89, file$9, 621, 8, 18432);
    			attr_dev(tr53, "class", "item svelte-1v7h9f9");
    			add_location(tr53, file$9, 619, 6, 18364);
    			attr_dev(tr54, "class", "buffer svelte-1v7h9f9");
    			add_location(tr54, file$9, 643, 6, 19138);
    			attr_dev(th90, "class", "date svelte-1v7h9f9");
    			add_location(th90, file$9, 645, 8, 19192);
    			attr_dev(h533, "class", "svelte-1v7h9f9");
    			add_location(h533, file$9, 647, 10, 19249);
    			attr_dev(p17, "class", "desc svelte-1v7h9f9");
    			add_location(p17, file$9, 648, 10, 19293);
    			attr_dev(i17, "class", "fab fa-medium svelte-1v7h9f9");
    			add_location(i17, file$9, 657, 16, 19647);
    			attr_dev(button10, "class", "entry-link");
    			add_location(button10, file$9, 656, 14, 19603);
    			attr_dev(a21, "href", "https://cabreraalex.medium.com/creating-reactive-jupyter-widgets-with-svelte-ef2fb580c05");
    			add_location(a21, file$9, 653, 12, 19462);
    			attr_dev(i18, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i18, file$9, 662, 16, 19860);
    			attr_dev(button11, "class", "entry-link");
    			add_location(button11, file$9, 661, 14, 19816);
    			attr_dev(a22, "href", "https://github.com/cabreraalex/widget-svelte-cookiecutter");
    			add_location(a22, file$9, 660, 12, 19733);
    			attr_dev(i19, "class", "fab fa-youtube svelte-1v7h9f9");
    			add_location(i19, file$9, 667, 16, 20053);
    			attr_dev(button12, "class", "entry-link");
    			add_location(button12, file$9, 666, 14, 20009);
    			attr_dev(a23, "href", "https://youtu.be/fnr9XWvjJHw?t=1082");
    			add_location(a23, file$9, 665, 12, 19948);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file$9, 652, 10, 19431);
    			attr_dev(th91, "class", "svelte-1v7h9f9");
    			add_location(th91, file$9, 646, 8, 19234);
    			attr_dev(tr55, "class", "item svelte-1v7h9f9");
    			add_location(tr55, file$9, 644, 6, 19166);
    			attr_dev(tr56, "class", "buffer svelte-1v7h9f9");
    			add_location(tr56, file$9, 673, 6, 20178);
    			attr_dev(th92, "class", "date svelte-1v7h9f9");
    			add_location(th92, file$9, 675, 8, 20232);
    			attr_dev(h534, "class", "svelte-1v7h9f9");
    			add_location(h534, file$9, 677, 10, 20289);
    			attr_dev(a24, "href", "https://delphi.cmu.edu/");
    			add_location(a24, file$9, 680, 66, 20515);
    			attr_dev(p18, "class", "desc svelte-1v7h9f9");
    			add_location(p18, file$9, 678, 10, 20355);
    			attr_dev(i20, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i20, file$9, 687, 16, 20744);
    			attr_dev(button13, "class", "entry-link");
    			add_location(button13, file$9, 686, 14, 20700);
    			attr_dev(i21, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i21, file$9, 691, 18, 20934);
    			attr_dev(button14, "class", "entry-link");
    			add_location(button14, file$9, 690, 16, 20888);
    			attr_dev(a25, "href", "https://github.com/cmu-delphi/www-covidcast");
    			add_location(a25, file$9, 689, 14, 20817);
    			attr_dev(a26, "href", "https://covidcast.cmu.edu/");
    			add_location(a26, file$9, 685, 12, 20648);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file$9, 684, 10, 20617);
    			attr_dev(th93, "class", "svelte-1v7h9f9");
    			add_location(th93, file$9, 676, 8, 20274);
    			attr_dev(tr57, "class", "item svelte-1v7h9f9");
    			add_location(tr57, file$9, 674, 6, 20206);
    			attr_dev(tr58, "class", "buffer svelte-1v7h9f9");
    			add_location(tr58, file$9, 720, 6, 21812);
    			add_location(br17, file$9, 745, 40, 22676);
    			attr_dev(th94, "class", "date svelte-1v7h9f9");
    			add_location(th94, file$9, 745, 8, 22644);
    			attr_dev(h535, "class", "svelte-1v7h9f9");
    			add_location(h535, file$9, 747, 10, 22722);
    			attr_dev(h614, "class", "svelte-1v7h9f9");
    			add_location(h614, file$9, 748, 10, 22758);
    			attr_dev(p19, "class", "desc svelte-1v7h9f9");
    			add_location(p19, file$9, 749, 10, 22813);
    			attr_dev(i22, "class", "fas fa-rocket svelte-1v7h9f9");
    			add_location(i22, file$9, 758, 16, 23196);
    			attr_dev(button15, "class", "entry-link");
    			add_location(button15, file$9, 757, 14, 23152);
    			attr_dev(a27, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a27, file$9, 754, 12, 23010);
    			attr_dev(i23, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i23, file$9, 765, 16, 23449);
    			attr_dev(button16, "class", "entry-link");
    			add_location(button16, file$9, 764, 14, 23405);
    			attr_dev(a28, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a28, file$9, 761, 12, 23287);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file$9, 753, 10, 22979);
    			attr_dev(th95, "class", "svelte-1v7h9f9");
    			add_location(th95, file$9, 746, 8, 22707);
    			attr_dev(tr59, "class", "item svelte-1v7h9f9");
    			add_location(tr59, file$9, 744, 6, 22618);
    			attr_dev(tr60, "class", "buffer svelte-1v7h9f9");
    			add_location(tr60, file$9, 771, 6, 23584);
    			attr_dev(th96, "class", "date svelte-1v7h9f9");
    			add_location(th96, file$9, 773, 8, 23638);
    			attr_dev(h536, "class", "svelte-1v7h9f9");
    			add_location(h536, file$9, 775, 10, 23695);
    			attr_dev(p20, "class", "desc svelte-1v7h9f9");
    			add_location(p20, file$9, 776, 10, 23728);
    			attr_dev(i24, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i24, file$9, 783, 16, 24019);
    			attr_dev(button17, "class", "entry-link");
    			add_location(button17, file$9, 782, 14, 23975);
    			attr_dev(a29, "href", "http://ctfs.github.io/resources/");
    			add_location(a29, file$9, 781, 12, 23917);
    			attr_dev(i25, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i25, file$9, 788, 16, 24210);
    			attr_dev(button18, "class", "entry-link");
    			add_location(button18, file$9, 787, 14, 24166);
    			attr_dev(a30, "href", "https://github.com/ctfs/resources");
    			add_location(a30, file$9, 786, 12, 24107);
    			attr_dev(div12, "class", "tags");
    			add_location(div12, file$9, 780, 10, 23886);
    			attr_dev(th97, "class", "svelte-1v7h9f9");
    			add_location(th97, file$9, 774, 8, 23680);
    			attr_dev(tr61, "class", "item svelte-1v7h9f9");
    			add_location(tr61, file$9, 772, 6, 23612);
    			attr_dev(th98, "class", "date svelte-1v7h9f9");
    			add_location(th98, file$9, 869, 8, 26554);
    			attr_dev(h410, "class", "header svelte-1v7h9f9");
    			add_location(h410, file$9, 871, 10, 26597);
    			attr_dev(th99, "class", "svelte-1v7h9f9");
    			add_location(th99, file$9, 870, 8, 26582);
    			add_location(tr62, file$9, 868, 6, 26541);
    			attr_dev(th100, "class", "date svelte-1v7h9f9");
    			add_location(th100, file$9, 875, 8, 26696);
    			attr_dev(h537, "class", "single svelte-1v7h9f9");
    			add_location(h537, file$9, 877, 10, 26745);
    			attr_dev(h538, "class", "single svelte-1v7h9f9");
    			add_location(h538, file$9, 878, 10, 26810);
    			attr_dev(h539, "class", "single svelte-1v7h9f9");
    			add_location(h539, file$9, 880, 12, 26961);
    			attr_dev(a31, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a31, file$9, 879, 10, 26880);
    			attr_dev(th101, "class", "svelte-1v7h9f9");
    			add_location(th101, file$9, 876, 8, 26730);
    			attr_dev(tr63, "class", "item svelte-1v7h9f9");
    			add_location(tr63, file$9, 874, 6, 26670);
    			attr_dev(th102, "class", "date svelte-1v7h9f9");
    			add_location(th102, file$9, 885, 8, 27083);
    			attr_dev(h540, "class", "single svelte-1v7h9f9");
    			add_location(h540, file$9, 888, 12, 27210);
    			attr_dev(a32, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a32, file$9, 887, 10, 27133);
    			attr_dev(h541, "class", "single svelte-1v7h9f9");
    			add_location(h541, file$9, 891, 12, 27342);
    			attr_dev(a33, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a33, file$9, 890, 10, 27273);
    			attr_dev(h542, "class", "single svelte-1v7h9f9");
    			add_location(h542, file$9, 894, 12, 27494);
    			attr_dev(a34, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a34, file$9, 893, 10, 27417);
    			attr_dev(h543, "class", "single svelte-1v7h9f9");
    			add_location(h543, file$9, 897, 12, 27614);
    			attr_dev(a35, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a35, file$9, 896, 10, 27560);
    			attr_dev(h544, "class", "single svelte-1v7h9f9");
    			add_location(h544, file$9, 899, 10, 27683);
    			attr_dev(th103, "class", "svelte-1v7h9f9");
    			add_location(th103, file$9, 886, 8, 27118);
    			attr_dev(tr64, "class", "item svelte-1v7h9f9");
    			add_location(tr64, file$9, 884, 6, 27057);
    			attr_dev(tr65, "class", "buffer svelte-1v7h9f9");
    			add_location(tr65, file$9, 957, 6, 29754);
    			attr_dev(table, "class", "svelte-1v7h9f9");
    			add_location(table, file$9, 17, 4, 466);
    			attr_dev(main, "class", "svelte-1v7h9f9");
    			add_location(main, file$9, 16, 2, 455);
    			attr_dev(div13, "id", "container");
    			attr_dev(div13, "class", "svelte-1v7h9f9");
    			add_location(div13, file$9, 15, 0, 432);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div13, anchor);
    			append_dev(div13, main);
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
    			append_dev(th13, t56);
    			append_dev(th13, div1);
    			append_dev(div1, a3);
    			append_dev(a3, button1);
    			append_dev(button1, i1);
    			append_dev(button1, t57);
    			append_dev(table, t58);
    			append_dev(table, tr8);
    			append_dev(table, t59);
    			append_dev(table, tr9);
    			append_dev(tr9, th14);
    			append_dev(th14, t60);
    			append_dev(th14, br4);
    			append_dev(th14, t61);
    			append_dev(tr9, t62);
    			append_dev(tr9, th15);
    			append_dev(th15, h53);
    			append_dev(th15, t64);
    			append_dev(th15, h64);
    			append_dev(th15, t66);
    			append_dev(th15, p4);
    			append_dev(p4, t67);
    			append_dev(p4, a4);
    			append_dev(p4, t69);
    			append_dev(p4, a5);
    			append_dev(th15, t71);
    			append_dev(th15, div2);
    			append_dev(div2, a6);
    			append_dev(a6, button2);
    			append_dev(button2, i2);
    			append_dev(button2, t72);
    			append_dev(table, t73);
    			append_dev(table, tr10);
    			append_dev(table, t74);
    			append_dev(table, tr11);
    			append_dev(tr11, th16);
    			append_dev(th16, t75);
    			append_dev(th16, br5);
    			append_dev(th16, t76);
    			append_dev(tr11, t77);
    			append_dev(tr11, th17);
    			append_dev(th17, h54);
    			append_dev(th17, t79);
    			append_dev(th17, h65);
    			append_dev(th17, t81);
    			append_dev(th17, p5);
    			append_dev(th17, t83);
    			append_dev(th17, div3);
    			append_dev(div3, a7);
    			append_dev(a7, button3);
    			append_dev(button3, i3);
    			append_dev(button3, t84);
    			append_dev(table, t85);
    			append_dev(table, tr12);
    			append_dev(table, t86);
    			append_dev(table, tr13);
    			append_dev(tr13, th18);
    			append_dev(th18, t87);
    			append_dev(th18, br6);
    			append_dev(th18, t88);
    			append_dev(tr13, t89);
    			append_dev(tr13, th19);
    			append_dev(th19, h55);
    			append_dev(th19, t91);
    			append_dev(th19, h66);
    			append_dev(th19, t93);
    			append_dev(th19, p6);
    			append_dev(table, t95);
    			append_dev(table, tr14);
    			append_dev(table, t96);
    			append_dev(table, tr15);
    			append_dev(tr15, th20);
    			append_dev(th20, t97);
    			append_dev(th20, br7);
    			append_dev(th20, t98);
    			append_dev(tr15, t99);
    			append_dev(tr15, th21);
    			append_dev(th21, h56);
    			append_dev(th21, t101);
    			append_dev(th21, h67);
    			append_dev(th21, t103);
    			append_dev(th21, p7);
    			append_dev(table, t105);
    			append_dev(table, tr16);
    			append_dev(tr16, th22);
    			append_dev(tr16, t106);
    			append_dev(tr16, th23);
    			append_dev(th23, h42);
    			append_dev(table, t108);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(tr17, t110);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t112);
    			append_dev(th25, p8);
    			append_dev(th25, t114);
    			append_dev(th25, div4);
    			append_dev(div4, a8);
    			append_dev(a8, button4);
    			append_dev(button4, i4);
    			append_dev(button4, t115);
    			append_dev(table, t116);
    			append_dev(table, tr18);
    			append_dev(table, t117);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(tr19, t119);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t121);
    			append_dev(th27, p9);
    			append_dev(th27, t123);
    			append_dev(th27, div5);
    			append_dev(div5, a9);
    			append_dev(a9, button5);
    			append_dev(button5, i5);
    			append_dev(button5, t124);
    			append_dev(table, t125);
    			append_dev(table, tr20);
    			append_dev(table, t126);
    			append_dev(table, tr21);
    			append_dev(tr21, th28);
    			append_dev(th28, t127);
    			append_dev(th28, br8);
    			append_dev(th28, t128);
    			append_dev(tr21, t129);
    			append_dev(tr21, th29);
    			append_dev(th29, h59);
    			append_dev(th29, t131);
    			append_dev(th29, h68);
    			append_dev(th29, t133);
    			append_dev(th29, p10);
    			append_dev(th29, t135);
    			append_dev(th29, div6);
    			append_dev(div6, a10);
    			append_dev(a10, button6);
    			append_dev(button6, i6);
    			append_dev(button6, t136);
    			append_dev(table, t137);
    			append_dev(table, tr22);
    			append_dev(table, t138);
    			append_dev(table, tr23);
    			append_dev(tr23, th30);
    			append_dev(tr23, t140);
    			append_dev(tr23, th31);
    			append_dev(th31, h510);
    			append_dev(th31, t142);
    			append_dev(th31, h69);
    			append_dev(th31, t144);
    			append_dev(th31, p11);
    			append_dev(th31, t146);
    			append_dev(th31, div7);
    			append_dev(div7, a11);
    			append_dev(a11, button7);
    			append_dev(button7, i7);
    			append_dev(button7, t147);
    			append_dev(table, t148);
    			append_dev(table, tr24);
    			append_dev(tr24, th32);
    			append_dev(tr24, t149);
    			append_dev(tr24, th33);
    			append_dev(th33, h43);
    			append_dev(table, t151);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(table, null);
    			}

    			append_dev(table, t152);
    			append_dev(table, tr25);
    			append_dev(tr25, th34);
    			append_dev(tr25, t153);
    			append_dev(tr25, th35);
    			append_dev(th35, h44);
    			append_dev(table, t155);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t156);
    			append_dev(table, tr26);
    			append_dev(tr26, th36);
    			append_dev(tr26, t157);
    			append_dev(tr26, th37);
    			append_dev(th37, h45);
    			append_dev(table, t159);
    			append_dev(table, tr27);
    			append_dev(tr27, th38);
    			append_dev(th38, t160);
    			append_dev(th38, br9);
    			append_dev(th38, t161);
    			append_dev(th38, br10);
    			append_dev(th38, t162);
    			append_dev(tr27, t163);
    			append_dev(tr27, th39);
    			append_dev(th39, h511);
    			append_dev(th39, t165);
    			append_dev(th39, h610);
    			append_dev(th39, t167);
    			append_dev(th39, p12);
    			append_dev(table, t169);
    			append_dev(table, tr28);
    			append_dev(table, t170);
    			append_dev(table, tr29);
    			append_dev(tr29, th40);
    			append_dev(tr29, t172);
    			append_dev(tr29, th41);
    			append_dev(th41, h512);
    			append_dev(th41, t174);
    			append_dev(th41, h611);
    			append_dev(th41, t176);
    			append_dev(th41, p13);
    			append_dev(table, t178);
    			append_dev(table, tr30);
    			append_dev(tr30, th42);
    			append_dev(tr30, t179);
    			append_dev(tr30, th43);
    			append_dev(th43, h46);
    			append_dev(table, t181);
    			append_dev(table, tr31);
    			append_dev(tr31, th44);
    			append_dev(th44, t182);
    			append_dev(th44, br11);
    			append_dev(th44, t183);
    			append_dev(tr31, t184);
    			append_dev(tr31, th45);
    			append_dev(th45, h513);
    			append_dev(th45, t186);
    			append_dev(th45, h612);
    			append_dev(th45, t188);
    			append_dev(th45, p14);
    			append_dev(table, t190);
    			append_dev(table, br12);
    			append_dev(table, t191);
    			append_dev(table, tr32);
    			append_dev(tr32, th46);
    			append_dev(th46, t192);
    			append_dev(th46, br13);
    			append_dev(th46, t193);
    			append_dev(tr32, t194);
    			append_dev(tr32, th47);
    			append_dev(th47, h514);
    			append_dev(th47, t196);
    			append_dev(th47, h613);
    			append_dev(th47, t198);
    			append_dev(th47, p15);
    			append_dev(table, t200);
    			append_dev(table, br14);
    			append_dev(table, t201);
    			append_dev(table, tr33);
    			append_dev(tr33, th48);
    			append_dev(th48, t202);
    			append_dev(th48, br15);
    			append_dev(th48, t203);
    			append_dev(tr33, t204);
    			append_dev(tr33, th49);
    			append_dev(th49, h515);
    			append_dev(table, t206);
    			append_dev(table, tr34);
    			append_dev(tr34, th50);
    			append_dev(tr34, t207);
    			append_dev(tr34, th51);
    			append_dev(th51, h47);
    			append_dev(table, t209);
    			append_dev(table, tr35);
    			append_dev(tr35, th52);
    			append_dev(tr35, t210);
    			append_dev(tr35, th53);
    			append_dev(th53, h516);
    			append_dev(table, t212);
    			append_dev(table, tr36);
    			append_dev(tr36, th54);
    			append_dev(tr36, t214);
    			append_dev(tr36, th55);
    			append_dev(th55, h517);
    			append_dev(table, t216);
    			append_dev(table, tr37);
    			append_dev(tr37, th56);
    			append_dev(tr37, t218);
    			append_dev(tr37, th57);
    			append_dev(th57, h518);
    			append_dev(table, t220);
    			append_dev(table, br16);
    			append_dev(table, t221);
    			append_dev(table, tr38);
    			append_dev(tr38, th58);
    			append_dev(tr38, t222);
    			append_dev(tr38, th59);
    			append_dev(th59, h519);
    			append_dev(table, t224);
    			append_dev(table, tr39);
    			append_dev(tr39, th60);
    			append_dev(tr39, t226);
    			append_dev(tr39, th61);
    			append_dev(th61, h520);
    			append_dev(table, t228);
    			append_dev(table, tr40);
    			append_dev(tr40, th62);
    			append_dev(tr40, t230);
    			append_dev(tr40, th63);
    			append_dev(th63, h521);
    			append_dev(table, t232);
    			append_dev(table, tr41);
    			append_dev(tr41, th64);
    			append_dev(tr41, t234);
    			append_dev(tr41, th65);
    			append_dev(th65, h522);
    			append_dev(table, t236);
    			append_dev(table, tr42);
    			append_dev(tr42, th66);
    			append_dev(tr42, t238);
    			append_dev(tr42, th67);
    			append_dev(th67, h523);
    			append_dev(table, t240);
    			append_dev(table, tr43);
    			append_dev(tr43, th68);
    			append_dev(tr43, t242);
    			append_dev(tr43, th69);
    			append_dev(th69, h524);
    			append_dev(table, t244);
    			append_dev(table, tr44);
    			append_dev(tr44, th70);
    			append_dev(tr44, t245);
    			append_dev(tr44, th71);
    			append_dev(th71, h48);
    			append_dev(table, t247);
    			append_dev(table, tr45);
    			append_dev(tr45, th72);
    			append_dev(tr45, t249);
    			append_dev(tr45, th73);
    			append_dev(th73, h525);
    			append_dev(h525, a12);
    			append_dev(h525, t251);
    			append_dev(h525, i8);
    			append_dev(table, t253);
    			append_dev(table, tr46);
    			append_dev(tr46, th74);
    			append_dev(tr46, t255);
    			append_dev(tr46, th75);
    			append_dev(th75, h526);
    			append_dev(h526, a13);
    			append_dev(h526, t257);
    			append_dev(h526, i9);
    			append_dev(table, t259);
    			append_dev(table, tr47);
    			append_dev(tr47, th76);
    			append_dev(tr47, t261);
    			append_dev(tr47, th77);
    			append_dev(th77, h527);
    			append_dev(h527, a14);
    			append_dev(h527, t263);
    			append_dev(h527, i10);
    			append_dev(table, t265);
    			append_dev(table, tr48);
    			append_dev(tr48, th78);
    			append_dev(tr48, t267);
    			append_dev(tr48, th79);
    			append_dev(th79, h528);
    			append_dev(h528, a15);
    			append_dev(h528, t269);
    			append_dev(h528, i11);
    			append_dev(table, t271);
    			append_dev(table, tr49);
    			append_dev(tr49, th80);
    			append_dev(tr49, t273);
    			append_dev(tr49, th81);
    			append_dev(th81, h529);
    			append_dev(h529, a16);
    			append_dev(h529, t275);
    			append_dev(h529, i12);
    			append_dev(table, t277);
    			append_dev(table, tr50);
    			append_dev(tr50, th82);
    			append_dev(tr50, t279);
    			append_dev(tr50, th83);
    			append_dev(th83, h530);
    			append_dev(h530, a17);
    			append_dev(h530, t281);
    			append_dev(h530, i13);
    			append_dev(table, t283);
    			append_dev(table, tr51);
    			append_dev(tr51, th84);
    			append_dev(tr51, t285);
    			append_dev(tr51, th85);
    			append_dev(th85, h531);
    			append_dev(h531, a18);
    			append_dev(h531, t287);
    			append_dev(h531, i14);
    			append_dev(table, t289);
    			append_dev(table, tr52);
    			append_dev(tr52, th86);
    			append_dev(tr52, t290);
    			append_dev(tr52, th87);
    			append_dev(th87, h49);
    			append_dev(table, t292);
    			append_dev(table, tr53);
    			append_dev(tr53, th88);
    			append_dev(tr53, t294);
    			append_dev(tr53, th89);
    			append_dev(th89, h532);
    			append_dev(th89, t296);
    			append_dev(th89, p16);
    			append_dev(th89, t298);
    			append_dev(th89, div8);
    			append_dev(div8, a19);
    			append_dev(a19, button8);
    			append_dev(button8, i15);
    			append_dev(button8, t299);
    			append_dev(div8, t300);
    			append_dev(div8, a20);
    			append_dev(a20, button9);
    			append_dev(button9, i16);
    			append_dev(button9, t301);
    			append_dev(table, t302);
    			append_dev(table, tr54);
    			append_dev(table, t303);
    			append_dev(table, tr55);
    			append_dev(tr55, th90);
    			append_dev(tr55, t305);
    			append_dev(tr55, th91);
    			append_dev(th91, h533);
    			append_dev(th91, t307);
    			append_dev(th91, p17);
    			append_dev(th91, t309);
    			append_dev(th91, div9);
    			append_dev(div9, a21);
    			append_dev(a21, button10);
    			append_dev(button10, i17);
    			append_dev(button10, t310);
    			append_dev(div9, t311);
    			append_dev(div9, a22);
    			append_dev(a22, button11);
    			append_dev(button11, i18);
    			append_dev(button11, t312);
    			append_dev(div9, t313);
    			append_dev(div9, a23);
    			append_dev(a23, button12);
    			append_dev(button12, i19);
    			append_dev(button12, t314);
    			append_dev(table, t315);
    			append_dev(table, tr56);
    			append_dev(table, t316);
    			append_dev(table, tr57);
    			append_dev(tr57, th92);
    			append_dev(tr57, t318);
    			append_dev(tr57, th93);
    			append_dev(th93, h534);
    			append_dev(th93, t320);
    			append_dev(th93, p18);
    			append_dev(p18, t321);
    			append_dev(p18, a24);
    			append_dev(p18, t323);
    			append_dev(th93, t324);
    			append_dev(th93, div10);
    			append_dev(div10, a26);
    			append_dev(a26, button13);
    			append_dev(button13, i20);
    			append_dev(button13, t325);
    			append_dev(a26, t326);
    			append_dev(a26, a25);
    			append_dev(a25, button14);
    			append_dev(button14, i21);
    			append_dev(button14, t327);
    			append_dev(table, t328);
    			append_dev(table, tr58);
    			append_dev(table, t329);
    			append_dev(table, tr59);
    			append_dev(tr59, th94);
    			append_dev(th94, t330);
    			append_dev(th94, br17);
    			append_dev(th94, t331);
    			append_dev(tr59, t332);
    			append_dev(tr59, th95);
    			append_dev(th95, h535);
    			append_dev(th95, t334);
    			append_dev(th95, h614);
    			append_dev(th95, t336);
    			append_dev(th95, p19);
    			append_dev(th95, t338);
    			append_dev(th95, div11);
    			append_dev(div11, a27);
    			append_dev(a27, button15);
    			append_dev(button15, i22);
    			append_dev(button15, t339);
    			append_dev(div11, t340);
    			append_dev(div11, a28);
    			append_dev(a28, button16);
    			append_dev(button16, i23);
    			append_dev(button16, t341);
    			append_dev(table, t342);
    			append_dev(table, tr60);
    			append_dev(table, t343);
    			append_dev(table, tr61);
    			append_dev(tr61, th96);
    			append_dev(tr61, t345);
    			append_dev(tr61, th97);
    			append_dev(th97, h536);
    			append_dev(th97, t347);
    			append_dev(th97, p20);
    			append_dev(th97, t349);
    			append_dev(th97, div12);
    			append_dev(div12, a29);
    			append_dev(a29, button17);
    			append_dev(button17, i24);
    			append_dev(button17, t350);
    			append_dev(div12, t351);
    			append_dev(div12, a30);
    			append_dev(a30, button18);
    			append_dev(button18, i25);
    			append_dev(button18, t352);
    			append_dev(table, t353);
    			append_dev(table, tr62);
    			append_dev(tr62, th98);
    			append_dev(tr62, t354);
    			append_dev(tr62, th99);
    			append_dev(th99, h410);
    			append_dev(table, t356);
    			append_dev(table, tr63);
    			append_dev(tr63, th100);
    			append_dev(tr63, t358);
    			append_dev(tr63, th101);
    			append_dev(th101, h537);
    			append_dev(th101, t360);
    			append_dev(th101, h538);
    			append_dev(th101, t362);
    			append_dev(th101, a31);
    			append_dev(a31, h539);
    			append_dev(table, t364);
    			append_dev(table, tr64);
    			append_dev(tr64, th102);
    			append_dev(tr64, t366);
    			append_dev(tr64, th103);
    			append_dev(th103, a32);
    			append_dev(a32, h540);
    			append_dev(th103, t368);
    			append_dev(th103, a33);
    			append_dev(a33, h541);
    			append_dev(th103, t370);
    			append_dev(th103, a34);
    			append_dev(a34, h542);
    			append_dev(th103, t372);
    			append_dev(th103, a35);
    			append_dev(a35, h543);
    			append_dev(th103, t374);
    			append_dev(th103, h544);
    			append_dev(table, t376);
    			append_dev(table, tr65);
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
    						each_blocks_1[i].m(table, t152);
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
    						each_blocks[i].m(table, t156);
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
    			if (detaching) detach_dev(div13);
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
