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

    const file = "src/components/Social.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let a0;
    	let h30;
    	let i0;
    	let t0;
    	let t1;
    	let a1;
    	let h31;
    	let i1;
    	let t2;
    	let t3;
    	let a2;
    	let h32;
    	let i2;
    	let t4;
    	let t5;
    	let a3;
    	let h33;
    	let i3;
    	let t6;
    	let t7;
    	let a4;
    	let h34;
    	let i4;
    	let t8;

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
    			if (detaching) detach_dev(div);
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

    function instance$1($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Social> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Social", $$slots, []);
    	return [];
    }

    class Social extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social",
    			options,
    			id: create_fragment$1.name
    		});
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
    	social = new Social({ $$inline: true });

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
    			add_location(button0, file$1, 39, 6, 773);
    			attr_dev(a1, "href", "/#/cv");
    			add_location(a1, file$1, 38, 4, 750);
    			attr_dev(button1, "class", "cv");
    			add_location(button1, file$1, 42, 6, 848);
    			attr_dev(a2, "href", "/cv.pdf");
    			add_location(a2, file$1, 41, 4, 823);
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
        venue: "IEEE VIS'19",
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
    	let p1;
    	let t7;
    	let b0;
    	let t9;
    	let b1;
    	let t11;
    	let b2;
    	let t13;
    	let a3;
    	let t15;
    	let p2;
    	let t16;
    	let a4;
    	let t18;
    	let a5;
    	let t20;
    	let img0;
    	let img0_src_value;
    	let t21;
    	let img1;
    	let img1_src_value;
    	let t22;

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
    			t6 = space();
    			p1 = element("p");
    			t7 = text("My research focus is broadly\n  ");
    			b0 = element("b");
    			b0.textContent = "human-centered AI,";
    			t9 = text("\n  specifically in applying techniques from\n  ");
    			b1 = element("b");
    			b1.textContent = "HCI";
    			t11 = text("\n  and\n  ");
    			b2 = element("b");
    			b2.textContent = "visualization";
    			t13 = text("\n  to help people develop machine learning models that are better aligned with\n  human values. I am supported by a\n  ");
    			a3 = element("a");
    			a3.textContent = "NSF Graduate Research Fellowship.";
    			t15 = space();
    			p2 = element("p");
    			t16 = text("Before CMU, I graduated with a B.S. in Computer Science from Georgia Tech,\n  where I worked with\n  ");
    			a4 = element("a");
    			a4.textContent = "Polo Chau";
    			t18 = text("\n  and\n  ");
    			a5 = element("a");
    			a5.textContent = "Jamie Morgenstern.";
    			t20 = text("\n  I've spent time at\n  ");
    			img0 = element("img");
    			t21 = text("\n  Microsoft Research and a few summers as a software engineering intern at\n  ");
    			img1 = element("img");
    			t22 = text("\n  Google working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr_dev(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$4, 14, 2, 166);
    			attr_dev(a1, "href", "http://perer.org");
    			add_location(a1, file$4, 18, 2, 300);
    			attr_dev(a2, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a2, file$4, 20, 2, 350);
    			attr_dev(p0, "class", "svelte-1071h7w");
    			add_location(p0, file$4, 12, 0, 132);
    			add_location(b0, file$4, 25, 2, 450);
    			add_location(b1, file$4, 27, 2, 521);
    			add_location(b2, file$4, 29, 2, 540);
    			attr_dev(a3, "href", "https://www.nsfgrfp.org/");
    			add_location(a3, file$4, 32, 2, 677);
    			attr_dev(p1, "class", "svelte-1071h7w");
    			add_location(p1, file$4, 23, 0, 413);
    			attr_dev(a4, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a4, file$4, 38, 2, 861);
    			attr_dev(a5, "href", "http://jamiemorgenstern.com/");
    			add_location(a5, file$4, 40, 2, 927);
    			set_style(img0, "width", "16px");
    			set_style(img0, "padding-left", "5px");
    			set_style(img0, "margin-bottom", "-2px");
    			if (img0.src !== (img0_src_value = "/images/microsoft.svg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "microsoft");
    			add_location(img0, file$4, 42, 2, 1012);
    			set_style(img1, "width", "16px");
    			set_style(img1, "padding-left", "5px");
    			set_style(img1, "margin-bottom", "-2px");
    			if (img1.src !== (img1_src_value = "/images/google.svg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "google");
    			add_location(img1, file$4, 47, 2, 1213);
    			attr_dev(p2, "class", "svelte-1071h7w");
    			add_location(p2, file$4, 35, 0, 756);
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
    			insert_dev(target, t6, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t7);
    			append_dev(p1, b0);
    			append_dev(p1, t9);
    			append_dev(p1, b1);
    			append_dev(p1, t11);
    			append_dev(p1, b2);
    			append_dev(p1, t13);
    			append_dev(p1, a3);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t16);
    			append_dev(p2, a4);
    			append_dev(p2, t18);
    			append_dev(p2, a5);
    			append_dev(p2, t20);
    			append_dev(p2, img0);
    			append_dev(p2, t21);
    			append_dev(p2, img1);
    			append_dev(p2, t22);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(p2);
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
    function create_if_block_1(ctx) {
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
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(61:2) {#if pub.code}",
    		ctx
    	});

    	return block;
    }

    // (69:2) {#if pub.slides}
    function create_if_block(ctx) {
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
    		id: create_if_block.name,
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
    	let if_block5 = /*pub*/ ctx[0].code && create_if_block_1(ctx);
    	let if_block6 = /*pub*/ ctx[0].slides && create_if_block(ctx);

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
    					if_block5 = create_if_block_1(ctx);
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
    					if_block6 = create_if_block(ctx);
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

    // (58:8) {#each { length: 3 } as _, i}
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
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(58:8) {#each { length: 3 } as _, i}",
    		ctx
    	});

    	return block;
    }

    // (73:8) {#each pubs as pub}
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
    			add_location(div0, file$6, 76, 16, 2001);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 75, 14, 1954);
    			attr_dev(h6, "class", "venue svelte-1h5ckrj");
    			add_location(h6, file$6, 82, 16, 2201);
    			add_location(div1, file$6, 81, 14, 2179);
    			attr_dev(div2, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1h5ckrj");
    			add_location(div2, file$6, 74, 12, 1893);
    			add_location(h4, file$6, 88, 18, 2445);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
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
    			if (detaching) detach_dev(div5);
    			destroy_component(links);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(73:8) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (114:8) {#each other as pub}
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
    			add_location(div0, file$6, 117, 16, 3457);
    			attr_dev(a0, "href", a0_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$6, 116, 14, 3410);
    			attr_dev(h6, "class", "venue svelte-1h5ckrj");
    			add_location(h6, file$6, 122, 14, 3635);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-1h5ckrj");
    			add_location(div1, file$6, 115, 12, 3349);
    			add_location(h4, file$6, 127, 18, 3858);
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$6, 126, 16, 3789);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$6, 129, 16, 3916);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$6, 125, 14, 3752);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$6, 124, 12, 3701);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$6, 114, 10, 3312);
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
    		source: "(114:8) {#each other as pub}",
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
    			t1 = text("Hi! You can call me\n          ");
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
    			add_location(h23, file$6, 109, 10, 3112);
    			attr_dev(div5, "class", "inline svelte-1h5ckrj");
    			add_location(div5, file$6, 108, 8, 3081);
    			add_location(hr2, file$6, 112, 8, 3266);
    			attr_dev(div6, "id", "pubs");
    			attr_dev(div6, "class", "sect");
    			add_location(div6, file$6, 107, 6, 3044);
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
    	let t30;
    	let links;
    	let t31;
    	let h22;
    	let t33;
    	let div4;
    	let code;
    	let t35;
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
    			i1.textContent = `${/*pub*/ ctx[0].venuelong}. ${/*pub*/ ctx[0].location}, ${/*pub*/ ctx[0].year}`;
    			t30 = space();
    			create_component(links.$$.fragment);
    			t31 = space();
    			h22 = element("h2");
    			h22.textContent = "BibTex";
    			t33 = space();
    			div4 = element("div");
    			code = element("code");
    			code.textContent = `${/*pub*/ ctx[0].bibtex}`;
    			t35 = space();
    			create_component(footer.$$.fragment);
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
    			if (img.src !== (img_src_value = "images/" + /*pub*/ ctx[0].teaser)) attr_dev(img, "src", img_src_value);
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
    			attr_dev(a1, "href", a1_href_value = "#/paper/" + /*pub*/ ctx[0].id);
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
    			append_dev(div5, t30);
    			mount_component(links, div5, null);
    			append_dev(div5, t31);
    			append_dev(div5, h22);
    			append_dev(div5, t33);
    			append_dev(div5, div4);
    			append_dev(div4, code);
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

    const func$2 = p => "<a class='press' href='" + p.website + "'>" + p.name + "</a>";
    const func_1$1 = p => "<a class='press' href='" + p.website + "'>" + p.name + "</a>";

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

    // (476:6) {#each pubs as pub}
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
    			attr_dev(th0, "class", "date svelte-1avpu9u");
    			add_location(th0, file$9, 477, 10, 11888);
    			attr_dev(h5, "class", "svelte-1avpu9u");
    			add_location(h5, file$9, 480, 14, 12025);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 479, 12, 11960);
    			attr_dev(h6, "class", "authors svelte-1avpu9u");
    			add_location(h6, file$9, 483, 12, 12076);
    			add_location(i, file$9, 495, 14, 12447);
    			attr_dev(p, "class", "desc svelte-1avpu9u");
    			add_location(p, file$9, 494, 12, 12416);
    			attr_dev(th1, "class", "svelte-1avpu9u");
    			add_location(th1, file$9, 478, 10, 11943);
    			attr_dev(tr0, "class", "item svelte-1avpu9u");
    			add_location(tr0, file$9, 476, 8, 11860);
    			attr_dev(tr1, "class", "buffer svelte-1avpu9u");
    			add_location(tr1, file$9, 501, 8, 12583);
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
    		source: "(476:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (511:6) {#each other as pub}
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
    			attr_dev(th0, "class", "date svelte-1avpu9u");
    			add_location(th0, file$9, 512, 10, 12861);
    			attr_dev(h5, "class", "svelte-1avpu9u");
    			add_location(h5, file$9, 515, 14, 12998);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 514, 12, 12933);
    			attr_dev(h6, "class", "authors svelte-1avpu9u");
    			add_location(h6, file$9, 518, 12, 13049);
    			add_location(i, file$9, 530, 14, 13420);
    			attr_dev(p, "class", "desc svelte-1avpu9u");
    			add_location(p, file$9, 529, 12, 13389);
    			attr_dev(th1, "class", "svelte-1avpu9u");
    			add_location(th1, file$9, 513, 10, 12916);
    			attr_dev(tr0, "class", "item svelte-1avpu9u");
    			add_location(tr0, file$9, 511, 8, 12833);
    			attr_dev(tr1, "class", "buffer svelte-1avpu9u");
    			add_location(tr1, file$9, 536, 8, 13556);
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
    		source: "(511:6) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div18;
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
    	let tr3;
    	let t21;
    	let tr4;
    	let th6;
    	let t22;
    	let br1;
    	let t23;
    	let t24;
    	let th7;
    	let h51;
    	let t26;
    	let h61;
    	let t28;
    	let p0;
    	let t29;
    	let br2;
    	let t30;
    	let t31;
    	let tr5;
    	let th8;
    	let t33;
    	let th9;
    	let h62;
    	let t35;
    	let p1;
    	let t37;
    	let tr6;
    	let th10;
    	let t38;
    	let th11;
    	let h41;
    	let t40;
    	let tr7;
    	let th12;
    	let t42;
    	let th13;
    	let h52;
    	let t44;
    	let p2;
    	let t46;
    	let div0;
    	let a0;
    	let button0;
    	let i0;
    	let t47;
    	let t48;
    	let tr8;
    	let t49;
    	let tr9;
    	let th14;
    	let t51;
    	let th15;
    	let h53;
    	let t53;
    	let p3;
    	let t55;
    	let div1;
    	let a1;
    	let button1;
    	let i1;
    	let t56;
    	let t57;
    	let tr10;
    	let t58;
    	let tr11;
    	let th16;
    	let t59;
    	let br3;
    	let t60;
    	let t61;
    	let th17;
    	let h54;
    	let t63;
    	let h63;
    	let t65;
    	let p4;
    	let t67;
    	let div2;
    	let a2;
    	let button2;
    	let i2;
    	let t68;
    	let t69;
    	let tr12;
    	let t70;
    	let tr13;
    	let th18;
    	let t72;
    	let th19;
    	let h55;
    	let t74;
    	let h64;
    	let t76;
    	let p5;
    	let t78;
    	let div3;
    	let a3;
    	let button3;
    	let i3;
    	let t79;
    	let t80;
    	let tr14;
    	let th20;
    	let t81;
    	let th21;
    	let h42;
    	let t83;
    	let tr15;
    	let th22;
    	let t84;
    	let br4;
    	let t85;
    	let t86;
    	let th23;
    	let h56;
    	let t88;
    	let h65;
    	let t90;
    	let p6;
    	let t91;
    	let a4;
    	let t93;
    	let div4;
    	let a5;
    	let button4;
    	let i4;
    	let t94;
    	let t95;
    	let tr16;
    	let t96;
    	let tr17;
    	let th24;
    	let t97;
    	let br5;
    	let t98;
    	let t99;
    	let th25;
    	let h57;
    	let t101;
    	let h66;
    	let t103;
    	let p7;
    	let t105;
    	let div5;
    	let button5;
    	let a6;
    	let i5;
    	let t106;
    	let t107;
    	let button6;
    	let t109;
    	let button7;
    	let t111;
    	let button8;
    	let t113;
    	let button9;
    	let t115;
    	let tr18;
    	let t116;
    	let tr19;
    	let th26;
    	let t117;
    	let br6;
    	let t118;
    	let t119;
    	let th27;
    	let h58;
    	let t121;
    	let h67;
    	let t123;
    	let p8;
    	let t125;
    	let div6;
    	let button10;
    	let t127;
    	let button11;
    	let t129;
    	let button12;
    	let t131;
    	let button13;
    	let t133;
    	let tr20;
    	let t134;
    	let tr21;
    	let th28;
    	let t135;
    	let br7;
    	let t136;
    	let t137;
    	let th29;
    	let h59;
    	let t139;
    	let h68;
    	let t141;
    	let p9;
    	let t143;
    	let div7;
    	let button14;
    	let t145;
    	let button15;
    	let t147;
    	let button16;
    	let t149;
    	let tr22;
    	let th30;
    	let t150;
    	let th31;
    	let h43;
    	let t152;
    	let tr23;
    	let th32;
    	let t153;
    	let br8;
    	let t154;
    	let t155;
    	let th33;
    	let h510;
    	let t157;
    	let h69;
    	let t159;
    	let div8;
    	let a7;
    	let button17;
    	let i6;
    	let t160;
    	let t161;
    	let tr24;
    	let t162;
    	let tr25;
    	let th34;
    	let t163;
    	let br9;
    	let t164;
    	let t165;
    	let th35;
    	let h511;
    	let t167;
    	let h610;
    	let t169;
    	let div9;
    	let a8;
    	let button18;
    	let i7;
    	let t170;
    	let t171;
    	let tr26;
    	let t172;
    	let tr27;
    	let th36;
    	let t173;
    	let br10;
    	let t174;
    	let t175;
    	let th37;
    	let h512;
    	let t177;
    	let h611;
    	let t179;
    	let p10;
    	let t181;
    	let div10;
    	let a9;
    	let button19;
    	let i8;
    	let t182;
    	let t183;
    	let a10;
    	let button20;
    	let i9;
    	let t184;
    	let t185;
    	let a11;
    	let button21;
    	let i10;
    	let t186;
    	let t187;
    	let tr28;
    	let th38;
    	let t188;
    	let th39;
    	let h44;
    	let t190;
    	let t191;
    	let tr29;
    	let th40;
    	let t192;
    	let th41;
    	let h45;
    	let t194;
    	let t195;
    	let tr30;
    	let th42;
    	let t196;
    	let th43;
    	let h46;
    	let t198;
    	let tr31;
    	let th44;
    	let t199;
    	let br11;
    	let t200;
    	let br12;
    	let t201;
    	let t202;
    	let th45;
    	let h513;
    	let t204;
    	let h612;
    	let t206;
    	let p11;
    	let t208;
    	let tr32;
    	let t209;
    	let tr33;
    	let th46;
    	let t211;
    	let th47;
    	let h514;
    	let t213;
    	let h613;
    	let t215;
    	let p12;
    	let t217;
    	let tr34;
    	let th48;
    	let t218;
    	let th49;
    	let h47;
    	let t220;
    	let tr35;
    	let th50;
    	let t221;
    	let br13;
    	let t222;
    	let t223;
    	let th51;
    	let h515;
    	let t225;
    	let h614;
    	let t227;
    	let p13;
    	let t229;
    	let br14;
    	let t230;
    	let tr36;
    	let th52;
    	let t232;
    	let th53;
    	let h516;
    	let t234;
    	let tr37;
    	let th54;
    	let t235;
    	let th55;
    	let h48;
    	let t237;
    	let tr38;
    	let th56;
    	let t238;
    	let th57;
    	let h517;
    	let t240;
    	let tr39;
    	let th58;
    	let t242;
    	let th59;
    	let h518;
    	let t244;
    	let tr40;
    	let th60;
    	let t246;
    	let th61;
    	let h519;
    	let t248;
    	let br15;
    	let t249;
    	let tr41;
    	let th62;
    	let t250;
    	let th63;
    	let h520;
    	let t252;
    	let tr42;
    	let th64;
    	let t254;
    	let th65;
    	let h521;
    	let t256;
    	let tr43;
    	let th66;
    	let t258;
    	let th67;
    	let h522;
    	let t260;
    	let tr44;
    	let th68;
    	let t262;
    	let th69;
    	let h523;
    	let t264;
    	let tr45;
    	let th70;
    	let t265;
    	let th71;
    	let h49;
    	let t267;
    	let tr46;
    	let th72;
    	let t269;
    	let th73;
    	let h524;
    	let a12;
    	let t271;
    	let i11;
    	let t273;
    	let tr47;
    	let th74;
    	let t275;
    	let th75;
    	let h525;
    	let a13;
    	let t277;
    	let i12;
    	let t279;
    	let tr48;
    	let th76;
    	let t281;
    	let th77;
    	let h526;
    	let a14;
    	let t283;
    	let i13;
    	let t285;
    	let tr49;
    	let th78;
    	let t287;
    	let th79;
    	let h527;
    	let a15;
    	let t289;
    	let i14;
    	let t291;
    	let tr50;
    	let th80;
    	let t293;
    	let th81;
    	let h528;
    	let a16;
    	let t295;
    	let i15;
    	let t297;
    	let tr51;
    	let th82;
    	let t299;
    	let th83;
    	let h529;
    	let a17;
    	let t301;
    	let i16;
    	let t303;
    	let tr52;
    	let th84;
    	let t305;
    	let th85;
    	let h530;
    	let a18;
    	let t307;
    	let i17;
    	let t309;
    	let tr53;
    	let th86;
    	let t310;
    	let th87;
    	let h410;
    	let t312;
    	let tr54;
    	let th88;
    	let t314;
    	let th89;
    	let h531;
    	let t316;
    	let p14;
    	let t318;
    	let div11;
    	let a19;
    	let button22;
    	let i18;
    	let t319;
    	let t320;
    	let tr55;
    	let t321;
    	let tr56;
    	let th90;
    	let t323;
    	let th91;
    	let h532;
    	let t325;
    	let h615;
    	let t327;
    	let p15;
    	let t329;
    	let div12;
    	let a20;
    	let button23;
    	let i19;
    	let t330;
    	let t331;
    	let tr57;
    	let t332;
    	let tr58;
    	let th92;
    	let t334;
    	let th93;
    	let h533;
    	let t336;
    	let p16;
    	let t338;
    	let div13;
    	let a21;
    	let button24;
    	let i20;
    	let t339;
    	let t340;
    	let a22;
    	let button25;
    	let i21;
    	let t341;
    	let t342;
    	let tr59;
    	let t343;
    	let tr60;
    	let th94;
    	let t345;
    	let th95;
    	let h534;
    	let t347;
    	let p17;
    	let t349;
    	let div14;
    	let a23;
    	let button26;
    	let i22;
    	let t350;
    	let t351;
    	let a24;
    	let button27;
    	let i23;
    	let t352;
    	let t353;
    	let tr61;
    	let th96;
    	let t354;
    	let th97;
    	let h411;
    	let t356;
    	let tr62;
    	let th98;
    	let t358;
    	let th99;
    	let h535;
    	let t360;
    	let a25;
    	let h536;
    	let t362;
    	let tr63;
    	let th100;
    	let t364;
    	let th101;
    	let a26;
    	let h537;
    	let t366;
    	let a27;
    	let h538;
    	let t368;
    	let a28;
    	let h539;
    	let t370;
    	let a29;
    	let h540;
    	let t372;
    	let h541;
    	let t374;
    	let tr64;
    	let th102;
    	let t375;
    	let th103;
    	let h412;
    	let t377;
    	let tr65;
    	let th104;
    	let t378;
    	let th105;
    	let h542;
    	let t380;
    	let div15;
    	let button28;
    	let t382;
    	let button29;
    	let t384;
    	let button30;
    	let t386;
    	let tr66;
    	let t387;
    	let tr67;
    	let th106;
    	let t388;
    	let th107;
    	let h543;
    	let t390;
    	let div16;
    	let button31;
    	let t392;
    	let button32;
    	let t394;
    	let button33;
    	let t396;
    	let button34;
    	let t398;
    	let button35;
    	let t400;
    	let button36;
    	let t402;
    	let button37;
    	let t404;
    	let tr68;
    	let t405;
    	let tr69;
    	let th108;
    	let t406;
    	let th109;
    	let h544;
    	let t408;
    	let div17;
    	let button38;
    	let t410;
    	let button39;
    	let t412;
    	let button40;
    	let t414;
    	let button41;
    	let t416;
    	let button42;
    	let t418;
    	let button43;
    	let t420;
    	let button44;
    	let t422;
    	let button45;
    	let t424;
    	let button46;
    	let t426;
    	let button47;
    	let t428;
    	let button48;
    	let t430;
    	let tr70;
    	let t431;
    	let tr71;
    	let th110;
    	let t432;
    	let th111;
    	let p18;
    	let current;
    	intro = new Intro({ $$inline: true });
    	social = new Social({ $$inline: true });
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
    			t84 = text("May 2020\n          ");
    			br4 = element("br");
    			t85 = text("\n          - August 2020");
    			t86 = space();
    			th23 = element("th");
    			h56 = element("h5");
    			h56.textContent = "Microsoft Research";
    			t88 = space();
    			h65 = element("h6");
    			h65.textContent = "Research Intern";
    			t90 = space();
    			p6 = element("p");
    			t91 = text("Conducted research on behavioral model comparison at the VIDA group\n            with\n            ");
    			a4 = element("a");
    			a4.textContent = "Steven Drucker.";
    			t93 = space();
    			div4 = element("div");
    			a5 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t94 = text("\n                VIDA Group");
    			t95 = space();
    			tr16 = element("tr");
    			t96 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			t97 = text("May 2018\n          ");
    			br5 = element("br");
    			t98 = text("\n          - August 2018");
    			t99 = space();
    			th25 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Google";
    			t101 = space();
    			h66 = element("h6");
    			h66.textContent = "Software Engineering Intern";
    			t103 = space();
    			p7 = element("p");
    			p7.textContent = "Researched and prototyped improvements for automated driver\n            assistance systems and hyperlocal weather prediction for the next\n            generation of Android Auto.";
    			t105 = space();
    			div5 = element("div");
    			button5 = element("button");
    			a6 = element("a");
    			i5 = element("i");
    			t106 = text("\n                WSJ Article");
    			t107 = space();
    			button6 = element("button");
    			button6.textContent = "Android Auto";
    			t109 = space();
    			button7 = element("button");
    			button7.textContent = "Java";
    			t111 = space();
    			button8 = element("button");
    			button8.textContent = "C++";
    			t113 = space();
    			button9 = element("button");
    			button9.textContent = "Protocol Buffers";
    			t115 = space();
    			tr18 = element("tr");
    			t116 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t117 = text("May 2017\n          ");
    			br6 = element("br");
    			t118 = text("\n          - August 2017");
    			t119 = space();
    			th27 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Google";
    			t121 = space();
    			h67 = element("h6");
    			h67.textContent = "Software Engineering Intern";
    			t123 = space();
    			p8 = element("p");
    			p8.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
    			t125 = space();
    			div6 = element("div");
    			button10 = element("button");
    			button10.textContent = "Apache Beam/Cloud DataFlow";
    			t127 = space();
    			button11 = element("button");
    			button11.textContent = "Java";
    			t129 = space();
    			button12 = element("button");
    			button12.textContent = "C++";
    			t131 = space();
    			button13 = element("button");
    			button13.textContent = "SQL";
    			t133 = space();
    			tr20 = element("tr");
    			t134 = space();
    			tr21 = element("tr");
    			th28 = element("th");
    			t135 = text("May 2016\n          ");
    			br7 = element("br");
    			t136 = text("\n          - August 2016");
    			t137 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "Google";
    			t139 = space();
    			h68 = element("h6");
    			h68.textContent = "Engineering Practicum Intern";
    			t141 = space();
    			p9 = element("p");
    			p9.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t143 = space();
    			div7 = element("div");
    			button14 = element("button");
    			button14.textContent = "Go";
    			t145 = space();
    			button15 = element("button");
    			button15.textContent = "BigQuery";
    			t147 = space();
    			button16 = element("button");
    			button16.textContent = "JavaScript";
    			t149 = space();
    			tr22 = element("tr");
    			th30 = element("th");
    			t150 = space();
    			th31 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Academic Research Experience";
    			t152 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t153 = text("August 2019\n          ");
    			br8 = element("br");
    			t154 = text("\n          - Present");
    			t155 = space();
    			th33 = element("th");
    			h510 = element("h5");
    			h510.textContent = "Carnegie Mellon Human Computer Interaction Institute (HCII)";
    			t157 = space();
    			h69 = element("h6");
    			h69.textContent = "Graduate Research Assistant";
    			t159 = space();
    			div8 = element("div");
    			a7 = element("a");
    			button17 = element("button");
    			i6 = element("i");
    			t160 = text("\n                CMU Data Interaction Group");
    			t161 = space();
    			tr24 = element("tr");
    			t162 = space();
    			tr25 = element("tr");
    			th34 = element("th");
    			t163 = text("January 2018\n          ");
    			br9 = element("br");
    			t164 = text("\n          - May 2019");
    			t165 = space();
    			th35 = element("th");
    			h511 = element("h5");
    			h511.textContent = "Polo Club of Data Science";
    			t167 = space();
    			h610 = element("h6");
    			h610.textContent = "Undergraduate Research Assistant";
    			t169 = space();
    			div9 = element("div");
    			a8 = element("a");
    			button18 = element("button");
    			i7 = element("i");
    			t170 = text("\n                Polo Club");
    			t171 = space();
    			tr26 = element("tr");
    			t172 = space();
    			tr27 = element("tr");
    			th36 = element("th");
    			t173 = text("September 2015\n          ");
    			br10 = element("br");
    			t174 = text("\n          - May 2017");
    			t175 = space();
    			th37 = element("th");
    			h512 = element("h5");
    			h512.textContent = "PROX-1 Satellite";
    			t177 = space();
    			h611 = element("h6");
    			h611.textContent = "Flight Software Lead and Researcher";
    			t179 = space();
    			p10 = element("p");
    			p10.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t181 = space();
    			div10 = element("div");
    			a9 = element("a");
    			button19 = element("button");
    			i8 = element("i");
    			t182 = text("\n                In space!");
    			t183 = space();
    			a10 = element("a");
    			button20 = element("button");
    			i9 = element("i");
    			t184 = text("\n                Website");
    			t185 = space();
    			a11 = element("a");
    			button21 = element("button");
    			i10 = element("i");
    			t186 = text("\n                Press release");
    			t187 = space();
    			tr28 = element("tr");
    			th38 = element("th");
    			t188 = space();
    			th39 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Refereed Publications";
    			t190 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t191 = space();
    			tr29 = element("tr");
    			th40 = element("th");
    			t192 = space();
    			th41 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Workshops, Demos, Posters, and Preprints";
    			t194 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t195 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			t196 = space();
    			th43 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Teaching";
    			t198 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			t199 = text("Fall 2016\n          ");
    			br11 = element("br");
    			t200 = text("\n          Spring 2017\n          ");
    			br12 = element("br");
    			t201 = text("\n          Spring 2018");
    			t202 = space();
    			th45 = element("th");
    			h513 = element("h5");
    			h513.textContent = "CS1332 - Data Structures and Algorithms";
    			t204 = space();
    			h612 = element("h6");
    			h612.textContent = "Undergraduate Teaching Assistant @ Georgia Tech";
    			t206 = space();
    			p11 = element("p");
    			p11.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t208 = space();
    			tr32 = element("tr");
    			t209 = space();
    			tr33 = element("tr");
    			th46 = element("th");
    			th46.textContent = "Fall 2016";
    			t211 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "GT 1000 - First-Year Seminar";
    			t213 = space();
    			h613 = element("h6");
    			h613.textContent = "Team Leader @ Georgia Tech";
    			t215 = space();
    			p12 = element("p");
    			p12.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t217 = space();
    			tr34 = element("tr");
    			th48 = element("th");
    			t218 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Mentoring";
    			t220 = space();
    			tr35 = element("tr");
    			th50 = element("th");
    			t221 = text("Spring 2020\n          ");
    			br13 = element("br");
    			t222 = text("\n          - Present");
    			t223 = space();
    			th51 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Abraham Druck";
    			t225 = space();
    			h614 = element("h6");
    			h614.textContent = "B.S. in Mathematical Sciences, Carnegie Mellon";
    			t227 = space();
    			p13 = element("p");
    			p13.textContent = "Crowdsourced discovery of ML blind spots for image captioning.";
    			t229 = space();
    			br14 = element("br");
    			t230 = space();
    			tr36 = element("tr");
    			th52 = element("th");
    			th52.textContent = "Fall 2020";
    			t232 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "CMU AI Mentoring Program";
    			t234 = space();
    			tr37 = element("tr");
    			th54 = element("th");
    			t235 = space();
    			th55 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Service";
    			t237 = space();
    			tr38 = element("tr");
    			th56 = element("th");
    			t238 = space();
    			th57 = element("th");
    			h517 = element("h5");
    			h517.textContent = "Student Volunteer";
    			t240 = space();
    			tr39 = element("tr");
    			th58 = element("th");
    			th58.textContent = "October 2019";
    			t242 = space();
    			th59 = element("th");
    			h518 = element("h5");
    			h518.textContent = "IEEE Visualization (VIS)";
    			t244 = space();
    			tr40 = element("tr");
    			th60 = element("th");
    			th60.textContent = "January 2019";
    			t246 = space();
    			th61 = element("th");
    			h519 = element("h5");
    			h519.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t248 = space();
    			br15 = element("br");
    			t249 = space();
    			tr41 = element("tr");
    			th62 = element("th");
    			t250 = space();
    			th63 = element("th");
    			h520 = element("h5");
    			h520.textContent = "Reviewer";
    			t252 = space();
    			tr42 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2020";
    			t254 = space();
    			th65 = element("th");
    			h521 = element("h5");
    			h521.textContent = "IEEE Visualization (VIS)";
    			t256 = space();
    			tr43 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2019, 2020";
    			t258 = space();
    			th67 = element("th");
    			h522 = element("h5");
    			h522.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t260 = space();
    			tr44 = element("tr");
    			th68 = element("th");
    			th68.textContent = "2019";
    			t262 = space();
    			th69 = element("th");
    			h523 = element("h5");
    			h523.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t264 = space();
    			tr45 = element("tr");
    			th70 = element("th");
    			t265 = space();
    			th71 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Press";
    			t267 = space();
    			tr46 = element("tr");
    			th72 = element("th");
    			th72.textContent = "2020";
    			t269 = space();
    			th73 = element("th");
    			h524 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t271 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "CNN";
    			t273 = space();
    			tr47 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2020";
    			t275 = space();
    			th75 = element("th");
    			h525 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t277 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Wired";
    			t279 = space();
    			tr48 = element("tr");
    			th76 = element("th");
    			th76.textContent = "2020";
    			t281 = space();
    			th77 = element("th");
    			h526 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t283 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "Carnegie Mellon";
    			t285 = space();
    			tr49 = element("tr");
    			th78 = element("th");
    			th78.textContent = "2020";
    			t287 = space();
    			th79 = element("th");
    			h527 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t289 = text("\n            -\n            ");
    			i14 = element("i");
    			i14.textContent = "Data Stories Podcast";
    			t291 = space();
    			tr50 = element("tr");
    			th80 = element("th");
    			th80.textContent = "2019";
    			t293 = space();
    			th81 = element("th");
    			h528 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t295 = text("\n            -\n            ");
    			i15 = element("i");
    			i15.textContent = "GT SCS";
    			t297 = space();
    			tr51 = element("tr");
    			th82 = element("th");
    			th82.textContent = "2019";
    			t299 = space();
    			th83 = element("th");
    			h529 = element("h5");
    			a17 = element("a");
    			a17.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t301 = text("\n            -\n            ");
    			i16 = element("i");
    			i16.textContent = "Georgia Tech";
    			t303 = space();
    			tr52 = element("tr");
    			th84 = element("th");
    			th84.textContent = "2018";
    			t305 = space();
    			th85 = element("th");
    			h530 = element("h5");
    			a18 = element("a");
    			a18.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t307 = text("\n            -\n            ");
    			i17 = element("i");
    			i17.textContent = "GT SCS";
    			t309 = space();
    			tr53 = element("tr");
    			th86 = element("th");
    			t310 = space();
    			th87 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Projects";
    			t312 = space();
    			tr54 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Spring 2020";
    			t314 = space();
    			th89 = element("th");
    			h531 = element("h5");
    			h531.textContent = "COVIDcast Visualization of COVID Symptoms";
    			t316 = space();
    			p14 = element("p");
    			p14.textContent = "An interactive visualization for multiple indicators of COVID\n            symptoms collected by the CMU Delphi research group.";
    			t318 = space();
    			div11 = element("div");
    			a19 = element("a");
    			button22 = element("button");
    			i18 = element("i");
    			t319 = text("\n                Website");
    			t320 = space();
    			tr55 = element("tr");
    			t321 = space();
    			tr56 = element("tr");
    			th90 = element("th");
    			th90.textContent = "Fall 2018";
    			t323 = space();
    			th91 = element("th");
    			h532 = element("h5");
    			h532.textContent = "ICLR'19 Reproducibility Challenge";
    			t325 = space();
    			h615 = element("h6");
    			h615.textContent = "Generative Adversarial Models for Learning Private and Fair\n            Representations";
    			t327 = space();
    			p15 = element("p");
    			p15.textContent = "Implemented and reproduced an ICLR'19 submission using GANs to\n            decorrelate sensitive data.";
    			t329 = space();
    			div12 = element("div");
    			a20 = element("a");
    			button23 = element("button");
    			i19 = element("i");
    			t330 = text("\n                GitHub");
    			t331 = space();
    			tr57 = element("tr");
    			t332 = space();
    			tr58 = element("tr");
    			th92 = element("th");
    			th92.textContent = "Spring 2018";
    			t334 = space();
    			th93 = element("th");
    			h533 = element("h5");
    			h533.textContent = "Georgia Tech Bus System Analysis";
    			t336 = space();
    			p16 = element("p");
    			p16.textContent = "System that combines Google Maps and graph algorithms to enable\n            navigation for GT buses.";
    			t338 = space();
    			div13 = element("div");
    			a21 = element("a");
    			button24 = element("button");
    			i20 = element("i");
    			t339 = text("\n                Poster");
    			t340 = space();
    			a22 = element("a");
    			button25 = element("button");
    			i21 = element("i");
    			t341 = text("\n                Class");
    			t342 = space();
    			tr59 = element("tr");
    			t343 = space();
    			tr60 = element("tr");
    			th94 = element("th");
    			th94.textContent = "Spring 2014";
    			t345 = space();
    			th95 = element("th");
    			h534 = element("h5");
    			h534.textContent = "CTF Resources";
    			t347 = space();
    			p17 = element("p");
    			p17.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1,000 stars on GitHub.";
    			t349 = space();
    			div14 = element("div");
    			a23 = element("a");
    			button26 = element("button");
    			i22 = element("i");
    			t350 = text("\n                Website");
    			t351 = space();
    			a24 = element("a");
    			button27 = element("button");
    			i23 = element("i");
    			t352 = text("\n                GitHub");
    			t353 = space();
    			tr61 = element("tr");
    			th96 = element("th");
    			t354 = space();
    			th97 = element("th");
    			h411 = element("h4");
    			h411.textContent = "Selected Classes";
    			t356 = space();
    			tr62 = element("tr");
    			th98 = element("th");
    			th98.textContent = "PhD";
    			t358 = space();
    			th99 = element("th");
    			h535 = element("h5");
    			h535.textContent = "Human Judgement and Decision Making";
    			t360 = space();
    			a25 = element("a");
    			h536 = element("h5");
    			h536.textContent = "Applied Research Methods";
    			t362 = space();
    			tr63 = element("tr");
    			th100 = element("th");
    			th100.textContent = "B.S.";
    			t364 = space();
    			th101 = element("th");
    			a26 = element("a");
    			h537 = element("h5");
    			h537.textContent = "Deep Learning";
    			t366 = space();
    			a27 = element("a");
    			h538 = element("h5");
    			h538.textContent = "Data and Visual Analytics";
    			t368 = space();
    			a28 = element("a");
    			h539 = element("h5");
    			h539.textContent = "Machine Learning";
    			t370 = space();
    			a29 = element("a");
    			h540 = element("h5");
    			h540.textContent = "Computer Simulation";
    			t372 = space();
    			h541 = element("h5");
    			h541.textContent = "Honors Algorithms";
    			t374 = space();
    			tr64 = element("tr");
    			th102 = element("th");
    			t375 = space();
    			th103 = element("th");
    			h412 = element("h4");
    			h412.textContent = "Skills";
    			t377 = space();
    			tr65 = element("tr");
    			th104 = element("th");
    			t378 = space();
    			th105 = element("th");
    			h542 = element("h5");
    			h542.textContent = "Languages";
    			t380 = space();
    			div15 = element("div");
    			button28 = element("button");
    			button28.textContent = "English - Native";
    			t382 = space();
    			button29 = element("button");
    			button29.textContent = "Spanish - Native";
    			t384 = space();
    			button30 = element("button");
    			button30.textContent = "French - Conversational (B1)";
    			t386 = space();
    			tr66 = element("tr");
    			t387 = space();
    			tr67 = element("tr");
    			th106 = element("th");
    			t388 = space();
    			th107 = element("th");
    			h543 = element("h5");
    			h543.textContent = "Programming Languages";
    			t390 = space();
    			div16 = element("div");
    			button31 = element("button");
    			button31.textContent = "Python";
    			t392 = space();
    			button32 = element("button");
    			button32.textContent = "JavaScript";
    			t394 = space();
    			button33 = element("button");
    			button33.textContent = "TypeScript";
    			t396 = space();
    			button34 = element("button");
    			button34.textContent = "Java";
    			t398 = space();
    			button35 = element("button");
    			button35.textContent = "C/C++";
    			t400 = space();
    			button36 = element("button");
    			button36.textContent = "SQL";
    			t402 = space();
    			button37 = element("button");
    			button37.textContent = "Go";
    			t404 = space();
    			tr68 = element("tr");
    			t405 = space();
    			tr69 = element("tr");
    			th108 = element("th");
    			t406 = space();
    			th109 = element("th");
    			h544 = element("h5");
    			h544.textContent = "Technologies";
    			t408 = space();
    			div17 = element("div");
    			button38 = element("button");
    			button38.textContent = "Machine Learning";
    			t410 = space();
    			button39 = element("button");
    			button39.textContent = "Full Stack Development";
    			t412 = space();
    			button40 = element("button");
    			button40.textContent = "PyTorch";
    			t414 = space();
    			button41 = element("button");
    			button41.textContent = "D3";
    			t416 = space();
    			button42 = element("button");
    			button42.textContent = "Vega";
    			t418 = space();
    			button43 = element("button");
    			button43.textContent = "Svelte";
    			t420 = space();
    			button44 = element("button");
    			button44.textContent = "React";
    			t422 = space();
    			button45 = element("button");
    			button45.textContent = "Jupyter Widgets";
    			t424 = space();
    			button46 = element("button");
    			button46.textContent = "AWS/Azure/Google Cloud";
    			t426 = space();
    			button47 = element("button");
    			button47.textContent = "Cloud Dataflow/MapReduce";
    			t428 = space();
    			button48 = element("button");
    			button48.textContent = "Amazon Mechanical Turk";
    			t430 = space();
    			tr70 = element("tr");
    			t431 = space();
    			tr71 = element("tr");
    			th110 = element("th");
    			t432 = space();
    			th111 = element("th");
    			p18 = element("p");
    			p18.textContent = "Last updated August 9, 2020.";
    			attr_dev(th0, "class", "date svelte-1avpu9u");
    			add_location(th0, file$9, 127, 8, 1802);
    			attr_dev(span0, "class", "color svelte-1avpu9u");
    			add_location(span0, file$9, 130, 12, 1886);
    			attr_dev(span1, "class", "color red svelte-1avpu9u");
    			add_location(span1, file$9, 131, 12, 1937);
    			attr_dev(span2, "class", "color svelte-1avpu9u");
    			add_location(span2, file$9, 132, 12, 1985);
    			attr_dev(span3, "class", "color red svelte-1avpu9u");
    			add_location(span3, file$9, 133, 12, 2036);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-1avpu9u");
    			add_location(h3, file$9, 129, 10, 1859);
    			attr_dev(th1, "class", "intro svelte-1avpu9u");
    			add_location(th1, file$9, 128, 8, 1830);
    			add_location(tr0, file$9, 126, 6, 1789);
    			attr_dev(th2, "class", "date svelte-1avpu9u");
    			add_location(th2, file$9, 143, 8, 2204);
    			attr_dev(h40, "class", "header svelte-1avpu9u");
    			add_location(h40, file$9, 145, 10, 2247);
    			attr_dev(th3, "class", "svelte-1avpu9u");
    			add_location(th3, file$9, 144, 8, 2232);
    			add_location(tr1, file$9, 142, 6, 2191);
    			add_location(br0, file$9, 151, 10, 2389);
    			attr_dev(th4, "class", "date svelte-1avpu9u");
    			add_location(th4, file$9, 149, 8, 2339);
    			attr_dev(h50, "class", "svelte-1avpu9u");
    			add_location(h50, file$9, 155, 10, 2453);
    			attr_dev(h60, "class", "svelte-1avpu9u");
    			add_location(h60, file$9, 156, 10, 2512);
    			attr_dev(th5, "class", "svelte-1avpu9u");
    			add_location(th5, file$9, 154, 8, 2438);
    			attr_dev(tr2, "class", "item svelte-1avpu9u");
    			add_location(tr2, file$9, 148, 6, 2313);
    			attr_dev(tr3, "class", "buffer svelte-1avpu9u");
    			add_location(tr3, file$9, 159, 6, 2580);
    			add_location(br1, file$9, 163, 10, 2684);
    			attr_dev(th6, "class", "date svelte-1avpu9u");
    			add_location(th6, file$9, 161, 8, 2634);
    			attr_dev(h51, "class", "svelte-1avpu9u");
    			add_location(h51, file$9, 167, 10, 2749);
    			attr_dev(h61, "class", "svelte-1avpu9u");
    			add_location(h61, file$9, 168, 10, 2793);
    			add_location(br2, file$9, 171, 12, 2940);
    			attr_dev(p0, "class", "desc svelte-1avpu9u");
    			add_location(p0, file$9, 169, 10, 2844);
    			attr_dev(th7, "class", "svelte-1avpu9u");
    			add_location(th7, file$9, 166, 8, 2734);
    			attr_dev(tr4, "class", "item svelte-1avpu9u");
    			add_location(tr4, file$9, 160, 6, 2608);
    			attr_dev(th8, "class", "date svelte-1avpu9u");
    			add_location(th8, file$9, 177, 8, 3052);
    			attr_dev(h62, "class", "svelte-1avpu9u");
    			add_location(h62, file$9, 179, 10, 3107);
    			attr_dev(p1, "class", "desc svelte-1avpu9u");
    			add_location(p1, file$9, 180, 10, 3154);
    			attr_dev(th9, "class", "svelte-1avpu9u");
    			add_location(th9, file$9, 178, 8, 3092);
    			attr_dev(tr5, "class", "item svelte-1avpu9u");
    			add_location(tr5, file$9, 176, 6, 3026);
    			attr_dev(th10, "class", "date svelte-1avpu9u");
    			add_location(th10, file$9, 187, 8, 3331);
    			attr_dev(h41, "class", "header svelte-1avpu9u");
    			add_location(h41, file$9, 189, 10, 3374);
    			attr_dev(th11, "class", "svelte-1avpu9u");
    			add_location(th11, file$9, 188, 8, 3359);
    			add_location(tr6, file$9, 186, 6, 3318);
    			attr_dev(th12, "class", "date svelte-1avpu9u");
    			add_location(th12, file$9, 193, 8, 3479);
    			attr_dev(h52, "class", "svelte-1avpu9u");
    			add_location(h52, file$9, 195, 10, 3533);
    			attr_dev(p2, "class", "desc svelte-1avpu9u");
    			add_location(p2, file$9, 198, 10, 3644);
    			attr_dev(i0, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i0, file$9, 205, 16, 3921);
    			add_location(button0, file$9, 204, 14, 3896);
    			attr_dev(a0, "href", "https://www.nsfgrfp.org/");
    			add_location(a0, file$9, 203, 12, 3846);
    			attr_dev(div0, "class", "tags");
    			add_location(div0, file$9, 202, 10, 3815);
    			attr_dev(th13, "class", "svelte-1avpu9u");
    			add_location(th13, file$9, 194, 8, 3518);
    			attr_dev(tr7, "class", "item svelte-1avpu9u");
    			add_location(tr7, file$9, 192, 6, 3453);
    			attr_dev(tr8, "class", "buffer svelte-1avpu9u");
    			add_location(tr8, file$9, 212, 6, 4062);
    			attr_dev(th14, "class", "date svelte-1avpu9u");
    			add_location(th14, file$9, 214, 8, 4116);
    			attr_dev(h53, "class", "svelte-1avpu9u");
    			add_location(h53, file$9, 216, 10, 4170);
    			attr_dev(p3, "class", "desc svelte-1avpu9u");
    			add_location(p3, file$9, 217, 10, 4224);
    			attr_dev(i1, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i1, file$9, 225, 16, 4605);
    			add_location(button1, file$9, 224, 14, 4580);
    			attr_dev(a1, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a1, file$9, 222, 12, 4423);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file$9, 221, 10, 4392);
    			attr_dev(th15, "class", "svelte-1avpu9u");
    			add_location(th15, file$9, 215, 8, 4155);
    			attr_dev(tr9, "class", "item svelte-1avpu9u");
    			add_location(tr9, file$9, 213, 6, 4090);
    			attr_dev(tr10, "class", "buffer svelte-1avpu9u");
    			add_location(tr10, file$9, 232, 6, 4751);
    			add_location(br3, file$9, 236, 10, 4855);
    			attr_dev(th16, "class", "date svelte-1avpu9u");
    			add_location(th16, file$9, 234, 8, 4805);
    			attr_dev(h54, "class", "svelte-1avpu9u");
    			add_location(h54, file$9, 240, 10, 4920);
    			attr_dev(h63, "class", "svelte-1avpu9u");
    			add_location(h63, file$9, 241, 10, 4966);
    			attr_dev(p4, "class", "desc svelte-1avpu9u");
    			add_location(p4, file$9, 242, 10, 5042);
    			attr_dev(i2, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i2, file$9, 249, 16, 5324);
    			add_location(button2, file$9, 248, 14, 5299);
    			attr_dev(a2, "href", "https://stampsps.gatech.edu/");
    			add_location(a2, file$9, 247, 12, 5245);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file$9, 246, 10, 5214);
    			attr_dev(th17, "class", "svelte-1avpu9u");
    			add_location(th17, file$9, 239, 8, 4905);
    			attr_dev(tr11, "class", "item svelte-1avpu9u");
    			add_location(tr11, file$9, 233, 6, 4779);
    			attr_dev(tr12, "class", "buffer svelte-1avpu9u");
    			add_location(tr12, file$9, 256, 6, 5465);
    			attr_dev(th18, "class", "date svelte-1avpu9u");
    			add_location(th18, file$9, 258, 8, 5519);
    			attr_dev(h55, "class", "svelte-1avpu9u");
    			add_location(h55, file$9, 260, 10, 5581);
    			attr_dev(h64, "class", "svelte-1avpu9u");
    			add_location(h64, file$9, 261, 10, 5623);
    			attr_dev(p5, "class", "desc svelte-1avpu9u");
    			add_location(p5, file$9, 262, 10, 5681);
    			attr_dev(i3, "class", "far fa-newspaper svelte-1avpu9u");
    			add_location(i3, file$9, 270, 16, 6032);
    			add_location(button3, file$9, 269, 14, 6007);
    			attr_dev(a3, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a3, file$9, 267, 12, 5864);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file$9, 266, 10, 5833);
    			attr_dev(th19, "class", "svelte-1avpu9u");
    			add_location(th19, file$9, 259, 8, 5566);
    			attr_dev(tr13, "class", "item svelte-1avpu9u");
    			add_location(tr13, file$9, 257, 6, 5493);
    			attr_dev(th20, "class", "date svelte-1avpu9u");
    			add_location(th20, file$9, 279, 8, 6220);
    			attr_dev(h42, "class", "header svelte-1avpu9u");
    			add_location(h42, file$9, 281, 10, 6263);
    			attr_dev(th21, "class", "svelte-1avpu9u");
    			add_location(th21, file$9, 280, 8, 6248);
    			add_location(tr14, file$9, 278, 6, 6207);
    			add_location(br4, file$9, 287, 10, 6412);
    			attr_dev(th22, "class", "date svelte-1avpu9u");
    			add_location(th22, file$9, 285, 8, 6365);
    			attr_dev(h56, "class", "svelte-1avpu9u");
    			add_location(h56, file$9, 291, 10, 6480);
    			attr_dev(h65, "class", "svelte-1avpu9u");
    			add_location(h65, file$9, 292, 10, 6518);
    			attr_dev(a4, "href", "https://www.microsoft.com/en-us/research/people/sdrucker/");
    			add_location(a4, file$9, 296, 12, 6679);
    			attr_dev(p6, "class", "desc svelte-1avpu9u");
    			add_location(p6, file$9, 293, 10, 6553);
    			attr_dev(i4, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i4, file$9, 303, 16, 6954);
    			add_location(button4, file$9, 302, 14, 6929);
    			attr_dev(a5, "href", "https://www.microsoft.com/en-us/research/group/vida/");
    			add_location(a5, file$9, 301, 12, 6851);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file$9, 300, 10, 6820);
    			attr_dev(th23, "class", "svelte-1avpu9u");
    			add_location(th23, file$9, 290, 8, 6465);
    			attr_dev(tr15, "class", "item svelte-1avpu9u");
    			add_location(tr15, file$9, 284, 6, 6339);
    			attr_dev(tr16, "class", "buffer svelte-1avpu9u");
    			add_location(tr16, file$9, 310, 6, 7098);
    			add_location(br5, file$9, 314, 10, 7199);
    			attr_dev(th24, "class", "date svelte-1avpu9u");
    			add_location(th24, file$9, 312, 8, 7152);
    			attr_dev(h57, "class", "svelte-1avpu9u");
    			add_location(h57, file$9, 318, 10, 7267);
    			attr_dev(h66, "class", "svelte-1avpu9u");
    			add_location(h66, file$9, 319, 10, 7293);
    			attr_dev(p7, "class", "desc svelte-1avpu9u");
    			add_location(p7, file$9, 320, 10, 7340);
    			attr_dev(i5, "class", "far fa-newspaper svelte-1avpu9u");
    			add_location(i5, file$9, 330, 16, 7770);
    			attr_dev(a6, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n                ");
    			add_location(a6, file$9, 327, 14, 7626);
    			add_location(button5, file$9, 326, 12, 7603);
    			add_location(button6, file$9, 334, 12, 7882);
    			add_location(button7, file$9, 335, 12, 7924);
    			add_location(button8, file$9, 336, 12, 7958);
    			add_location(button9, file$9, 337, 12, 7991);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file$9, 325, 10, 7572);
    			attr_dev(th25, "class", "svelte-1avpu9u");
    			add_location(th25, file$9, 317, 8, 7252);
    			attr_dev(tr17, "class", "item svelte-1avpu9u");
    			add_location(tr17, file$9, 311, 6, 7126);
    			attr_dev(tr18, "class", "buffer svelte-1avpu9u");
    			add_location(tr18, file$9, 341, 6, 8074);
    			add_location(br6, file$9, 345, 10, 8175);
    			attr_dev(th26, "class", "date svelte-1avpu9u");
    			add_location(th26, file$9, 343, 8, 8128);
    			attr_dev(h58, "class", "svelte-1avpu9u");
    			add_location(h58, file$9, 349, 10, 8243);
    			attr_dev(h67, "class", "svelte-1avpu9u");
    			add_location(h67, file$9, 350, 10, 8269);
    			attr_dev(p8, "class", "desc svelte-1avpu9u");
    			add_location(p8, file$9, 351, 10, 8316);
    			add_location(button10, file$9, 356, 12, 8508);
    			add_location(button11, file$9, 357, 12, 8564);
    			add_location(button12, file$9, 358, 12, 8598);
    			add_location(button13, file$9, 359, 12, 8631);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file$9, 355, 10, 8477);
    			attr_dev(th27, "class", "svelte-1avpu9u");
    			add_location(th27, file$9, 348, 8, 8228);
    			attr_dev(tr19, "class", "item svelte-1avpu9u");
    			add_location(tr19, file$9, 342, 6, 8102);
    			attr_dev(tr20, "class", "buffer svelte-1avpu9u");
    			add_location(tr20, file$9, 363, 6, 8701);
    			add_location(br7, file$9, 367, 10, 8802);
    			attr_dev(th28, "class", "date svelte-1avpu9u");
    			add_location(th28, file$9, 365, 8, 8755);
    			attr_dev(h59, "class", "svelte-1avpu9u");
    			add_location(h59, file$9, 371, 10, 8870);
    			attr_dev(h68, "class", "svelte-1avpu9u");
    			add_location(h68, file$9, 372, 10, 8896);
    			attr_dev(p9, "class", "desc svelte-1avpu9u");
    			add_location(p9, file$9, 373, 10, 8944);
    			add_location(button14, file$9, 378, 12, 9129);
    			add_location(button15, file$9, 379, 12, 9161);
    			add_location(button16, file$9, 380, 12, 9199);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file$9, 377, 10, 9098);
    			attr_dev(th29, "class", "svelte-1avpu9u");
    			add_location(th29, file$9, 370, 8, 8855);
    			attr_dev(tr21, "class", "item svelte-1avpu9u");
    			add_location(tr21, file$9, 364, 6, 8729);
    			attr_dev(th30, "class", "date svelte-1avpu9u");
    			add_location(th30, file$9, 386, 8, 9313);
    			attr_dev(h43, "class", "header svelte-1avpu9u");
    			add_location(h43, file$9, 388, 10, 9356);
    			attr_dev(th31, "class", "svelte-1avpu9u");
    			add_location(th31, file$9, 387, 8, 9341);
    			add_location(tr22, file$9, 385, 6, 9300);
    			add_location(br8, file$9, 394, 10, 9517);
    			attr_dev(th32, "class", "date svelte-1avpu9u");
    			add_location(th32, file$9, 392, 8, 9467);
    			attr_dev(h510, "class", "svelte-1avpu9u");
    			add_location(h510, file$9, 398, 10, 9581);
    			attr_dev(h69, "class", "svelte-1avpu9u");
    			add_location(h69, file$9, 399, 10, 9660);
    			attr_dev(i6, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i6, file$9, 403, 16, 9809);
    			add_location(button17, file$9, 402, 14, 9784);
    			attr_dev(a7, "href", "https://dig.cmu.edu/");
    			add_location(a7, file$9, 401, 12, 9738);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file$9, 400, 10, 9707);
    			attr_dev(th33, "class", "svelte-1avpu9u");
    			add_location(th33, file$9, 397, 8, 9566);
    			attr_dev(tr23, "class", "item svelte-1avpu9u");
    			add_location(tr23, file$9, 391, 6, 9441);
    			attr_dev(tr24, "class", "buffer svelte-1avpu9u");
    			add_location(tr24, file$9, 410, 6, 9969);
    			add_location(br9, file$9, 414, 10, 10074);
    			attr_dev(th34, "class", "date svelte-1avpu9u");
    			add_location(th34, file$9, 412, 8, 10023);
    			attr_dev(h511, "class", "svelte-1avpu9u");
    			add_location(h511, file$9, 418, 10, 10139);
    			attr_dev(h610, "class", "svelte-1avpu9u");
    			add_location(h610, file$9, 419, 10, 10184);
    			attr_dev(i7, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i7, file$9, 423, 16, 10345);
    			add_location(button18, file$9, 422, 14, 10320);
    			attr_dev(a8, "href", "https://poloclub.github.io/");
    			add_location(a8, file$9, 421, 12, 10267);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file$9, 420, 10, 10236);
    			attr_dev(th35, "class", "svelte-1avpu9u");
    			add_location(th35, file$9, 417, 8, 10124);
    			attr_dev(tr25, "class", "item svelte-1avpu9u");
    			add_location(tr25, file$9, 411, 6, 9997);
    			attr_dev(tr26, "class", "buffer svelte-1avpu9u");
    			add_location(tr26, file$9, 430, 6, 10488);
    			add_location(br10, file$9, 434, 10, 10595);
    			attr_dev(th36, "class", "date svelte-1avpu9u");
    			add_location(th36, file$9, 432, 8, 10542);
    			attr_dev(h512, "class", "svelte-1avpu9u");
    			add_location(h512, file$9, 438, 10, 10660);
    			attr_dev(h611, "class", "svelte-1avpu9u");
    			add_location(h611, file$9, 439, 10, 10696);
    			attr_dev(p10, "class", "desc svelte-1avpu9u");
    			add_location(p10, file$9, 440, 10, 10751);
    			attr_dev(i8, "class", "fas fa-rocket svelte-1avpu9u");
    			add_location(i8, file$9, 448, 16, 11102);
    			add_location(button19, file$9, 447, 14, 11077);
    			attr_dev(a9, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a9, file$9, 445, 12, 10948);
    			attr_dev(i9, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i9, file$9, 454, 16, 11285);
    			add_location(button20, file$9, 453, 14, 11260);
    			attr_dev(a10, "href", "http://prox-1.gatech.edu/");
    			add_location(a10, file$9, 452, 12, 11209);
    			attr_dev(i10, "class", "far fa-newspaper svelte-1avpu9u");
    			add_location(i10, file$9, 461, 16, 11519);
    			add_location(button21, file$9, 460, 14, 11494);
    			attr_dev(a11, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a11, file$9, 458, 12, 11389);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file$9, 444, 10, 10917);
    			attr_dev(th37, "class", "svelte-1avpu9u");
    			add_location(th37, file$9, 437, 8, 10645);
    			attr_dev(tr27, "class", "item svelte-1avpu9u");
    			add_location(tr27, file$9, 431, 6, 10516);
    			attr_dev(th38, "class", "date svelte-1avpu9u");
    			add_location(th38, file$9, 470, 8, 11711);
    			attr_dev(h44, "class", "header svelte-1avpu9u");
    			add_location(h44, file$9, 472, 10, 11754);
    			attr_dev(th39, "class", "svelte-1avpu9u");
    			add_location(th39, file$9, 471, 8, 11739);
    			add_location(tr28, file$9, 469, 6, 11698);
    			attr_dev(th40, "class", "date svelte-1avpu9u");
    			add_location(th40, file$9, 505, 8, 12664);
    			attr_dev(h45, "class", "header svelte-1avpu9u");
    			add_location(h45, file$9, 507, 10, 12707);
    			attr_dev(th41, "class", "svelte-1avpu9u");
    			add_location(th41, file$9, 506, 8, 12692);
    			add_location(tr29, file$9, 504, 6, 12651);
    			attr_dev(th42, "class", "date svelte-1avpu9u");
    			add_location(th42, file$9, 540, 8, 13635);
    			attr_dev(h46, "class", "header svelte-1avpu9u");
    			add_location(h46, file$9, 542, 10, 13678);
    			attr_dev(th43, "class", "svelte-1avpu9u");
    			add_location(th43, file$9, 541, 8, 13663);
    			add_location(tr30, file$9, 539, 6, 13622);
    			add_location(br11, file$9, 548, 10, 13817);
    			add_location(br12, file$9, 550, 10, 13856);
    			attr_dev(th44, "class", "date svelte-1avpu9u");
    			add_location(th44, file$9, 546, 8, 13769);
    			attr_dev(h513, "class", "svelte-1avpu9u");
    			add_location(h513, file$9, 554, 10, 13922);
    			attr_dev(h612, "class", "svelte-1avpu9u");
    			add_location(h612, file$9, 555, 10, 13981);
    			attr_dev(p11, "class", "desc svelte-1avpu9u");
    			add_location(p11, file$9, 556, 10, 14048);
    			attr_dev(th45, "class", "svelte-1avpu9u");
    			add_location(th45, file$9, 553, 8, 13907);
    			attr_dev(tr31, "class", "item svelte-1avpu9u");
    			add_location(tr31, file$9, 545, 6, 13743);
    			attr_dev(tr32, "class", "buffer svelte-1avpu9u");
    			add_location(tr32, file$9, 562, 6, 14233);
    			attr_dev(th46, "class", "date svelte-1avpu9u");
    			add_location(th46, file$9, 564, 8, 14287);
    			attr_dev(h514, "class", "svelte-1avpu9u");
    			add_location(h514, file$9, 566, 10, 14342);
    			attr_dev(h613, "class", "svelte-1avpu9u");
    			add_location(h613, file$9, 567, 10, 14390);
    			attr_dev(p12, "class", "desc svelte-1avpu9u");
    			add_location(p12, file$9, 568, 10, 14436);
    			attr_dev(th47, "class", "svelte-1avpu9u");
    			add_location(th47, file$9, 565, 8, 14327);
    			attr_dev(tr33, "class", "item svelte-1avpu9u");
    			add_location(tr33, file$9, 563, 6, 14261);
    			attr_dev(th48, "class", "date svelte-1avpu9u");
    			add_location(th48, file$9, 576, 8, 14655);
    			attr_dev(h47, "class", "header svelte-1avpu9u");
    			add_location(h47, file$9, 578, 10, 14698);
    			attr_dev(th49, "class", "svelte-1avpu9u");
    			add_location(th49, file$9, 577, 8, 14683);
    			add_location(tr34, file$9, 575, 6, 14642);
    			add_location(br13, file$9, 584, 10, 14840);
    			attr_dev(th50, "class", "date svelte-1avpu9u");
    			add_location(th50, file$9, 582, 8, 14790);
    			attr_dev(h515, "class", "svelte-1avpu9u");
    			add_location(h515, file$9, 588, 10, 14904);
    			attr_dev(h614, "class", "svelte-1avpu9u");
    			add_location(h614, file$9, 589, 10, 14937);
    			attr_dev(p13, "class", "desc svelte-1avpu9u");
    			add_location(p13, file$9, 590, 10, 15003);
    			attr_dev(th51, "class", "svelte-1avpu9u");
    			add_location(th51, file$9, 587, 8, 14889);
    			attr_dev(tr35, "class", "item svelte-1avpu9u");
    			add_location(tr35, file$9, 581, 6, 14764);
    			add_location(br14, file$9, 595, 6, 15142);
    			attr_dev(th52, "class", "date svelte-1avpu9u");
    			add_location(th52, file$9, 597, 8, 15181);
    			attr_dev(h516, "class", "svelte-1avpu9u");
    			add_location(h516, file$9, 599, 10, 15236);
    			attr_dev(th53, "class", "svelte-1avpu9u");
    			add_location(th53, file$9, 598, 8, 15221);
    			attr_dev(tr36, "class", "item svelte-1avpu9u");
    			add_location(tr36, file$9, 596, 6, 15155);
    			attr_dev(th54, "class", "date svelte-1avpu9u");
    			add_location(th54, file$9, 604, 8, 15338);
    			attr_dev(h48, "class", "header svelte-1avpu9u");
    			add_location(h48, file$9, 606, 10, 15381);
    			attr_dev(th55, "class", "svelte-1avpu9u");
    			add_location(th55, file$9, 605, 8, 15366);
    			add_location(tr37, file$9, 603, 6, 15325);
    			attr_dev(th56, "class", "date svelte-1avpu9u");
    			add_location(th56, file$9, 610, 8, 15471);
    			attr_dev(h517, "class", "svelte-1avpu9u");
    			add_location(h517, file$9, 612, 10, 15514);
    			attr_dev(th57, "class", "svelte-1avpu9u");
    			add_location(th57, file$9, 611, 8, 15499);
    			attr_dev(tr38, "class", "item svelte-1avpu9u");
    			add_location(tr38, file$9, 609, 6, 15445);
    			attr_dev(th58, "class", "date svelte-1avpu9u");
    			add_location(th58, file$9, 616, 8, 15586);
    			attr_dev(h518, "class", "single svelte-1avpu9u");
    			add_location(h518, file$9, 618, 10, 15644);
    			attr_dev(th59, "class", "svelte-1avpu9u");
    			add_location(th59, file$9, 617, 8, 15629);
    			add_location(tr39, file$9, 615, 6, 15573);
    			attr_dev(th60, "class", "date svelte-1avpu9u");
    			add_location(th60, file$9, 622, 8, 15738);
    			attr_dev(h519, "class", "single svelte-1avpu9u");
    			add_location(h519, file$9, 624, 10, 15796);
    			attr_dev(th61, "class", "svelte-1avpu9u");
    			add_location(th61, file$9, 623, 8, 15781);
    			add_location(tr40, file$9, 621, 6, 15725);
    			add_location(br15, file$9, 629, 6, 15930);
    			attr_dev(th62, "class", "date svelte-1avpu9u");
    			add_location(th62, file$9, 631, 8, 15969);
    			attr_dev(h520, "class", "svelte-1avpu9u");
    			add_location(h520, file$9, 633, 10, 16012);
    			attr_dev(th63, "class", "svelte-1avpu9u");
    			add_location(th63, file$9, 632, 8, 15997);
    			attr_dev(tr41, "class", "item svelte-1avpu9u");
    			add_location(tr41, file$9, 630, 6, 15943);
    			attr_dev(th64, "class", "date svelte-1avpu9u");
    			add_location(th64, file$9, 637, 8, 16075);
    			attr_dev(h521, "class", "single svelte-1avpu9u");
    			add_location(h521, file$9, 639, 10, 16125);
    			attr_dev(th65, "class", "svelte-1avpu9u");
    			add_location(th65, file$9, 638, 8, 16110);
    			add_location(tr42, file$9, 636, 6, 16062);
    			attr_dev(th66, "class", "date svelte-1avpu9u");
    			add_location(th66, file$9, 643, 8, 16219);
    			attr_dev(h522, "class", "single svelte-1avpu9u");
    			add_location(h522, file$9, 645, 10, 16275);
    			attr_dev(th67, "class", "svelte-1avpu9u");
    			add_location(th67, file$9, 644, 8, 16260);
    			add_location(tr43, file$9, 642, 6, 16206);
    			attr_dev(th68, "class", "date svelte-1avpu9u");
    			add_location(th68, file$9, 651, 8, 16432);
    			attr_dev(h523, "class", "single svelte-1avpu9u");
    			add_location(h523, file$9, 653, 10, 16482);
    			attr_dev(th69, "class", "svelte-1avpu9u");
    			add_location(th69, file$9, 652, 8, 16467);
    			add_location(tr44, file$9, 650, 6, 16419);
    			attr_dev(th70, "class", "date svelte-1avpu9u");
    			add_location(th70, file$9, 660, 8, 16655);
    			attr_dev(h49, "class", "header svelte-1avpu9u");
    			add_location(h49, file$9, 662, 10, 16698);
    			attr_dev(th71, "class", "svelte-1avpu9u");
    			add_location(th71, file$9, 661, 8, 16683);
    			add_location(tr45, file$9, 659, 6, 16642);
    			attr_dev(th72, "class", "date svelte-1avpu9u");
    			add_location(th72, file$9, 666, 8, 16773);
    			attr_dev(a12, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			add_location(a12, file$9, 669, 12, 16861);
    			add_location(i11, file$9, 675, 12, 17166);
    			attr_dev(h524, "class", "single press svelte-1avpu9u");
    			add_location(h524, file$9, 668, 10, 16823);
    			attr_dev(th73, "class", "svelte-1avpu9u");
    			add_location(th73, file$9, 667, 8, 16808);
    			add_location(tr46, file$9, 665, 6, 16760);
    			attr_dev(th74, "class", "date svelte-1avpu9u");
    			add_location(th74, file$9, 680, 8, 17238);
    			attr_dev(a13, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			add_location(a13, file$9, 683, 12, 17326);
    			add_location(i12, file$9, 688, 12, 17559);
    			attr_dev(h525, "class", "single press svelte-1avpu9u");
    			add_location(h525, file$9, 682, 10, 17288);
    			attr_dev(th75, "class", "svelte-1avpu9u");
    			add_location(th75, file$9, 681, 8, 17273);
    			add_location(tr47, file$9, 679, 6, 17225);
    			attr_dev(th76, "class", "date svelte-1avpu9u");
    			add_location(th76, file$9, 693, 8, 17633);
    			attr_dev(a14, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			add_location(a14, file$9, 696, 12, 17721);
    			add_location(i13, file$9, 701, 12, 17945);
    			attr_dev(h526, "class", "single press svelte-1avpu9u");
    			add_location(h526, file$9, 695, 10, 17683);
    			attr_dev(th77, "class", "svelte-1avpu9u");
    			add_location(th77, file$9, 694, 8, 17668);
    			add_location(tr48, file$9, 692, 6, 17620);
    			attr_dev(th78, "class", "date svelte-1avpu9u");
    			add_location(th78, file$9, 706, 8, 18029);
    			attr_dev(a15, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			add_location(a15, file$9, 709, 12, 18117);
    			add_location(i14, file$9, 714, 12, 18330);
    			attr_dev(h527, "class", "single press svelte-1avpu9u");
    			add_location(h527, file$9, 708, 10, 18079);
    			attr_dev(th79, "class", "svelte-1avpu9u");
    			add_location(th79, file$9, 707, 8, 18064);
    			add_location(tr49, file$9, 705, 6, 18016);
    			attr_dev(th80, "class", "date svelte-1avpu9u");
    			add_location(th80, file$9, 719, 8, 18419);
    			attr_dev(a16, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a16, file$9, 722, 12, 18507);
    			add_location(i15, file$9, 727, 12, 18762);
    			attr_dev(h528, "class", "single press svelte-1avpu9u");
    			add_location(h528, file$9, 721, 10, 18469);
    			attr_dev(th81, "class", "svelte-1avpu9u");
    			add_location(th81, file$9, 720, 8, 18454);
    			add_location(tr50, file$9, 718, 6, 18406);
    			attr_dev(th82, "class", "date svelte-1avpu9u");
    			add_location(th82, file$9, 732, 8, 18837);
    			attr_dev(a17, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a17, file$9, 735, 12, 18925);
    			add_location(i16, file$9, 740, 12, 19156);
    			attr_dev(h529, "class", "single press svelte-1avpu9u");
    			add_location(h529, file$9, 734, 10, 18887);
    			attr_dev(th83, "class", "svelte-1avpu9u");
    			add_location(th83, file$9, 733, 8, 18872);
    			add_location(tr51, file$9, 731, 6, 18824);
    			attr_dev(th84, "class", "date svelte-1avpu9u");
    			add_location(th84, file$9, 745, 8, 19237);
    			attr_dev(a18, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a18, file$9, 748, 12, 19325);
    			add_location(i17, file$9, 754, 12, 19599);
    			attr_dev(h530, "class", "single press svelte-1avpu9u");
    			add_location(h530, file$9, 747, 10, 19287);
    			attr_dev(th85, "class", "svelte-1avpu9u");
    			add_location(th85, file$9, 746, 8, 19272);
    			add_location(tr52, file$9, 744, 6, 19224);
    			attr_dev(th86, "class", "date svelte-1avpu9u");
    			add_location(th86, file$9, 760, 8, 19698);
    			attr_dev(h410, "class", "header svelte-1avpu9u");
    			add_location(h410, file$9, 762, 10, 19741);
    			attr_dev(th87, "class", "svelte-1avpu9u");
    			add_location(th87, file$9, 761, 8, 19726);
    			add_location(tr53, file$9, 759, 6, 19685);
    			attr_dev(th88, "class", "date svelte-1avpu9u");
    			add_location(th88, file$9, 766, 8, 19832);
    			attr_dev(h531, "class", "svelte-1avpu9u");
    			add_location(h531, file$9, 768, 10, 19889);
    			attr_dev(p14, "class", "desc svelte-1avpu9u");
    			add_location(p14, file$9, 769, 10, 19950);
    			attr_dev(i18, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i18, file$9, 776, 16, 20239);
    			add_location(button22, file$9, 775, 14, 20214);
    			attr_dev(a19, "href", "https://covidcast.cmu.edu/");
    			add_location(a19, file$9, 774, 12, 20162);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file$9, 773, 10, 20131);
    			attr_dev(th89, "class", "svelte-1avpu9u");
    			add_location(th89, file$9, 767, 8, 19874);
    			attr_dev(tr54, "class", "item svelte-1avpu9u");
    			add_location(tr54, file$9, 765, 6, 19806);
    			attr_dev(tr55, "class", "buffer svelte-1avpu9u");
    			add_location(tr55, file$9, 783, 6, 20380);
    			attr_dev(th90, "class", "date svelte-1avpu9u");
    			add_location(th90, file$9, 785, 8, 20434);
    			attr_dev(h532, "class", "svelte-1avpu9u");
    			add_location(h532, file$9, 787, 10, 20489);
    			attr_dev(h615, "class", "svelte-1avpu9u");
    			add_location(h615, file$9, 788, 10, 20542);
    			attr_dev(p15, "class", "desc svelte-1avpu9u");
    			add_location(p15, file$9, 792, 10, 20673);
    			attr_dev(i19, "class", "fab fa-github svelte-1avpu9u");
    			add_location(i19, file$9, 799, 16, 20959);
    			add_location(button23, file$9, 798, 14, 20934);
    			attr_dev(a20, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a20, file$9, 797, 12, 20861);
    			attr_dev(div12, "class", "tags");
    			add_location(div12, file$9, 796, 10, 20830);
    			attr_dev(th91, "class", "svelte-1avpu9u");
    			add_location(th91, file$9, 786, 8, 20474);
    			attr_dev(tr56, "class", "item svelte-1avpu9u");
    			add_location(tr56, file$9, 784, 6, 20408);
    			attr_dev(tr57, "class", "buffer svelte-1avpu9u");
    			add_location(tr57, file$9, 806, 6, 21100);
    			attr_dev(th92, "class", "date svelte-1avpu9u");
    			add_location(th92, file$9, 808, 8, 21154);
    			attr_dev(h533, "class", "svelte-1avpu9u");
    			add_location(h533, file$9, 810, 10, 21211);
    			attr_dev(p16, "class", "desc svelte-1avpu9u");
    			add_location(p16, file$9, 811, 10, 21263);
    			attr_dev(i20, "class", "fas fa-file-pdf svelte-1avpu9u");
    			add_location(i20, file$9, 818, 16, 21521);
    			add_location(button24, file$9, 817, 14, 21496);
    			attr_dev(a21, "href", "./gt_bus_analysis.pdf");
    			add_location(a21, file$9, 816, 12, 21449);
    			attr_dev(i21, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i21, file$9, 824, 16, 21724);
    			add_location(button25, file$9, 823, 14, 21699);
    			attr_dev(a22, "href", "http://poloclub.gatech.edu/cse6242/2018spring/");
    			add_location(a22, file$9, 822, 12, 21627);
    			attr_dev(div13, "class", "tags");
    			add_location(div13, file$9, 815, 10, 21418);
    			attr_dev(th93, "class", "svelte-1avpu9u");
    			add_location(th93, file$9, 809, 8, 21196);
    			attr_dev(tr58, "class", "item svelte-1avpu9u");
    			add_location(tr58, file$9, 807, 6, 21128);
    			attr_dev(tr59, "class", "buffer svelte-1avpu9u");
    			add_location(tr59, file$9, 831, 6, 21863);
    			attr_dev(th94, "class", "date svelte-1avpu9u");
    			add_location(th94, file$9, 833, 8, 21917);
    			attr_dev(h534, "class", "svelte-1avpu9u");
    			add_location(h534, file$9, 835, 10, 21974);
    			attr_dev(p17, "class", "desc svelte-1avpu9u");
    			add_location(p17, file$9, 836, 10, 22007);
    			attr_dev(i22, "class", "fas fa-globe svelte-1avpu9u");
    			add_location(i22, file$9, 843, 16, 22280);
    			add_location(button26, file$9, 842, 14, 22255);
    			attr_dev(a23, "href", "http://ctfs.github.io/resources/");
    			add_location(a23, file$9, 841, 12, 22197);
    			attr_dev(i23, "class", "fab fa-github svelte-1avpu9u");
    			add_location(i23, file$9, 849, 16, 22468);
    			add_location(button27, file$9, 848, 14, 22443);
    			attr_dev(a24, "href", "https://github.com/ctfs/resources");
    			add_location(a24, file$9, 847, 12, 22384);
    			attr_dev(div14, "class", "tags");
    			add_location(div14, file$9, 840, 10, 22166);
    			attr_dev(th95, "class", "svelte-1avpu9u");
    			add_location(th95, file$9, 834, 8, 21959);
    			attr_dev(tr60, "class", "item svelte-1avpu9u");
    			add_location(tr60, file$9, 832, 6, 21891);
    			attr_dev(th96, "class", "date svelte-1avpu9u");
    			add_location(th96, file$9, 931, 8, 24771);
    			attr_dev(h411, "class", "header svelte-1avpu9u");
    			add_location(h411, file$9, 933, 10, 24814);
    			attr_dev(th97, "class", "svelte-1avpu9u");
    			add_location(th97, file$9, 932, 8, 24799);
    			add_location(tr61, file$9, 930, 6, 24758);
    			attr_dev(th98, "class", "date svelte-1avpu9u");
    			add_location(th98, file$9, 937, 8, 24913);
    			attr_dev(h535, "class", "single svelte-1avpu9u");
    			add_location(h535, file$9, 939, 10, 24962);
    			attr_dev(h536, "class", "single svelte-1avpu9u");
    			add_location(h536, file$9, 941, 12, 25113);
    			attr_dev(a25, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a25, file$9, 940, 10, 25032);
    			attr_dev(th99, "class", "svelte-1avpu9u");
    			add_location(th99, file$9, 938, 8, 24947);
    			attr_dev(tr62, "class", "item svelte-1avpu9u");
    			add_location(tr62, file$9, 936, 6, 24887);
    			attr_dev(th100, "class", "date svelte-1avpu9u");
    			add_location(th100, file$9, 946, 8, 25235);
    			attr_dev(h537, "class", "single svelte-1avpu9u");
    			add_location(h537, file$9, 949, 12, 25362);
    			attr_dev(a26, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a26, file$9, 948, 10, 25285);
    			attr_dev(h538, "class", "single svelte-1avpu9u");
    			add_location(h538, file$9, 952, 12, 25494);
    			attr_dev(a27, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a27, file$9, 951, 10, 25425);
    			attr_dev(h539, "class", "single svelte-1avpu9u");
    			add_location(h539, file$9, 955, 12, 25646);
    			attr_dev(a28, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a28, file$9, 954, 10, 25569);
    			attr_dev(h540, "class", "single svelte-1avpu9u");
    			add_location(h540, file$9, 958, 12, 25766);
    			attr_dev(a29, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a29, file$9, 957, 10, 25712);
    			attr_dev(h541, "class", "single svelte-1avpu9u");
    			add_location(h541, file$9, 960, 10, 25835);
    			attr_dev(th101, "class", "svelte-1avpu9u");
    			add_location(th101, file$9, 947, 8, 25270);
    			attr_dev(tr63, "class", "item svelte-1avpu9u");
    			add_location(tr63, file$9, 945, 6, 25209);
    			attr_dev(th102, "class", "date svelte-1avpu9u");
    			add_location(th102, file$9, 965, 8, 25944);
    			attr_dev(h412, "class", "header svelte-1avpu9u");
    			add_location(h412, file$9, 967, 10, 25987);
    			attr_dev(th103, "class", "svelte-1avpu9u");
    			add_location(th103, file$9, 966, 8, 25972);
    			add_location(tr64, file$9, 964, 6, 25931);
    			attr_dev(th104, "class", "date svelte-1avpu9u");
    			add_location(th104, file$9, 971, 8, 26076);
    			attr_dev(h542, "class", "svelte-1avpu9u");
    			add_location(h542, file$9, 973, 10, 26119);
    			add_location(button28, file$9, 975, 12, 26179);
    			add_location(button29, file$9, 976, 12, 26225);
    			add_location(button30, file$9, 977, 12, 26271);
    			attr_dev(div15, "class", "tags");
    			add_location(div15, file$9, 974, 10, 26148);
    			attr_dev(th105, "class", "svelte-1avpu9u");
    			add_location(th105, file$9, 972, 8, 26104);
    			attr_dev(tr65, "class", "item svelte-1avpu9u");
    			add_location(tr65, file$9, 970, 6, 26050);
    			attr_dev(tr66, "class", "buffer svelte-1avpu9u");
    			add_location(tr66, file$9, 981, 6, 26366);
    			attr_dev(th106, "class", "date svelte-1avpu9u");
    			add_location(th106, file$9, 983, 8, 26420);
    			attr_dev(h543, "class", "svelte-1avpu9u");
    			add_location(h543, file$9, 985, 10, 26463);
    			add_location(button31, file$9, 987, 12, 26535);
    			add_location(button32, file$9, 988, 12, 26571);
    			add_location(button33, file$9, 989, 12, 26611);
    			add_location(button34, file$9, 990, 12, 26651);
    			add_location(button35, file$9, 991, 12, 26685);
    			add_location(button36, file$9, 992, 12, 26720);
    			add_location(button37, file$9, 993, 12, 26753);
    			attr_dev(div16, "class", "tags");
    			add_location(div16, file$9, 986, 10, 26504);
    			attr_dev(th107, "class", "svelte-1avpu9u");
    			add_location(th107, file$9, 984, 8, 26448);
    			attr_dev(tr67, "class", "item svelte-1avpu9u");
    			add_location(tr67, file$9, 982, 6, 26394);
    			attr_dev(tr68, "class", "buffer svelte-1avpu9u");
    			add_location(tr68, file$9, 997, 6, 26822);
    			attr_dev(th108, "class", "date svelte-1avpu9u");
    			add_location(th108, file$9, 999, 8, 26876);
    			attr_dev(h544, "class", "svelte-1avpu9u");
    			add_location(h544, file$9, 1001, 10, 26919);
    			add_location(button38, file$9, 1003, 12, 26982);
    			add_location(button39, file$9, 1004, 12, 27028);
    			add_location(button40, file$9, 1005, 12, 27080);
    			add_location(button41, file$9, 1006, 12, 27117);
    			add_location(button42, file$9, 1007, 12, 27149);
    			add_location(button43, file$9, 1008, 12, 27183);
    			add_location(button44, file$9, 1009, 12, 27219);
    			add_location(button45, file$9, 1010, 12, 27254);
    			add_location(button46, file$9, 1011, 12, 27299);
    			add_location(button47, file$9, 1012, 12, 27351);
    			add_location(button48, file$9, 1013, 12, 27405);
    			attr_dev(div17, "class", "tags");
    			add_location(div17, file$9, 1002, 10, 26951);
    			attr_dev(th109, "class", "svelte-1avpu9u");
    			add_location(th109, file$9, 1000, 8, 26904);
    			attr_dev(tr69, "class", "item svelte-1avpu9u");
    			add_location(tr69, file$9, 998, 6, 26850);
    			attr_dev(tr70, "class", "buffer svelte-1avpu9u");
    			add_location(tr70, file$9, 1017, 6, 27494);
    			attr_dev(th110, "class", "date svelte-1avpu9u");
    			add_location(th110, file$9, 1019, 8, 27548);
    			attr_dev(p18, "class", "desc svelte-1avpu9u");
    			add_location(p18, file$9, 1021, 10, 27591);
    			attr_dev(th111, "class", "svelte-1avpu9u");
    			add_location(th111, file$9, 1020, 8, 27576);
    			attr_dev(tr71, "class", "item svelte-1avpu9u");
    			add_location(tr71, file$9, 1018, 6, 27522);
    			attr_dev(table, "class", "svelte-1avpu9u");
    			add_location(table, file$9, 125, 4, 1775);
    			attr_dev(main, "class", "svelte-1avpu9u");
    			add_location(main, file$9, 124, 2, 1764);
    			attr_dev(div18, "id", "container");
    			attr_dev(div18, "class", "svelte-1avpu9u");
    			add_location(div18, file$9, 123, 0, 1741);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div18, anchor);
    			append_dev(div18, main);
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
    			append_dev(p6, t91);
    			append_dev(p6, a4);
    			append_dev(th23, t93);
    			append_dev(th23, div4);
    			append_dev(div4, a5);
    			append_dev(a5, button4);
    			append_dev(button4, i4);
    			append_dev(button4, t94);
    			append_dev(table, t95);
    			append_dev(table, tr16);
    			append_dev(table, t96);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(th24, t97);
    			append_dev(th24, br5);
    			append_dev(th24, t98);
    			append_dev(tr17, t99);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t101);
    			append_dev(th25, h66);
    			append_dev(th25, t103);
    			append_dev(th25, p7);
    			append_dev(th25, t105);
    			append_dev(th25, div5);
    			append_dev(div5, button5);
    			append_dev(button5, a6);
    			append_dev(a6, i5);
    			append_dev(a6, t106);
    			append_dev(div5, t107);
    			append_dev(div5, button6);
    			append_dev(div5, t109);
    			append_dev(div5, button7);
    			append_dev(div5, t111);
    			append_dev(div5, button8);
    			append_dev(div5, t113);
    			append_dev(div5, button9);
    			append_dev(table, t115);
    			append_dev(table, tr18);
    			append_dev(table, t116);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(th26, t117);
    			append_dev(th26, br6);
    			append_dev(th26, t118);
    			append_dev(tr19, t119);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t121);
    			append_dev(th27, h67);
    			append_dev(th27, t123);
    			append_dev(th27, p8);
    			append_dev(th27, t125);
    			append_dev(th27, div6);
    			append_dev(div6, button10);
    			append_dev(div6, t127);
    			append_dev(div6, button11);
    			append_dev(div6, t129);
    			append_dev(div6, button12);
    			append_dev(div6, t131);
    			append_dev(div6, button13);
    			append_dev(table, t133);
    			append_dev(table, tr20);
    			append_dev(table, t134);
    			append_dev(table, tr21);
    			append_dev(tr21, th28);
    			append_dev(th28, t135);
    			append_dev(th28, br7);
    			append_dev(th28, t136);
    			append_dev(tr21, t137);
    			append_dev(tr21, th29);
    			append_dev(th29, h59);
    			append_dev(th29, t139);
    			append_dev(th29, h68);
    			append_dev(th29, t141);
    			append_dev(th29, p9);
    			append_dev(th29, t143);
    			append_dev(th29, div7);
    			append_dev(div7, button14);
    			append_dev(div7, t145);
    			append_dev(div7, button15);
    			append_dev(div7, t147);
    			append_dev(div7, button16);
    			append_dev(table, t149);
    			append_dev(table, tr22);
    			append_dev(tr22, th30);
    			append_dev(tr22, t150);
    			append_dev(tr22, th31);
    			append_dev(th31, h43);
    			append_dev(table, t152);
    			append_dev(table, tr23);
    			append_dev(tr23, th32);
    			append_dev(th32, t153);
    			append_dev(th32, br8);
    			append_dev(th32, t154);
    			append_dev(tr23, t155);
    			append_dev(tr23, th33);
    			append_dev(th33, h510);
    			append_dev(th33, t157);
    			append_dev(th33, h69);
    			append_dev(th33, t159);
    			append_dev(th33, div8);
    			append_dev(div8, a7);
    			append_dev(a7, button17);
    			append_dev(button17, i6);
    			append_dev(button17, t160);
    			append_dev(table, t161);
    			append_dev(table, tr24);
    			append_dev(table, t162);
    			append_dev(table, tr25);
    			append_dev(tr25, th34);
    			append_dev(th34, t163);
    			append_dev(th34, br9);
    			append_dev(th34, t164);
    			append_dev(tr25, t165);
    			append_dev(tr25, th35);
    			append_dev(th35, h511);
    			append_dev(th35, t167);
    			append_dev(th35, h610);
    			append_dev(th35, t169);
    			append_dev(th35, div9);
    			append_dev(div9, a8);
    			append_dev(a8, button18);
    			append_dev(button18, i7);
    			append_dev(button18, t170);
    			append_dev(table, t171);
    			append_dev(table, tr26);
    			append_dev(table, t172);
    			append_dev(table, tr27);
    			append_dev(tr27, th36);
    			append_dev(th36, t173);
    			append_dev(th36, br10);
    			append_dev(th36, t174);
    			append_dev(tr27, t175);
    			append_dev(tr27, th37);
    			append_dev(th37, h512);
    			append_dev(th37, t177);
    			append_dev(th37, h611);
    			append_dev(th37, t179);
    			append_dev(th37, p10);
    			append_dev(th37, t181);
    			append_dev(th37, div10);
    			append_dev(div10, a9);
    			append_dev(a9, button19);
    			append_dev(button19, i8);
    			append_dev(button19, t182);
    			append_dev(div10, t183);
    			append_dev(div10, a10);
    			append_dev(a10, button20);
    			append_dev(button20, i9);
    			append_dev(button20, t184);
    			append_dev(div10, t185);
    			append_dev(div10, a11);
    			append_dev(a11, button21);
    			append_dev(button21, i10);
    			append_dev(button21, t186);
    			append_dev(table, t187);
    			append_dev(table, tr28);
    			append_dev(tr28, th38);
    			append_dev(tr28, t188);
    			append_dev(tr28, th39);
    			append_dev(th39, h44);
    			append_dev(table, t190);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(table, null);
    			}

    			append_dev(table, t191);
    			append_dev(table, tr29);
    			append_dev(tr29, th40);
    			append_dev(tr29, t192);
    			append_dev(tr29, th41);
    			append_dev(th41, h45);
    			append_dev(table, t194);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t195);
    			append_dev(table, tr30);
    			append_dev(tr30, th42);
    			append_dev(tr30, t196);
    			append_dev(tr30, th43);
    			append_dev(th43, h46);
    			append_dev(table, t198);
    			append_dev(table, tr31);
    			append_dev(tr31, th44);
    			append_dev(th44, t199);
    			append_dev(th44, br11);
    			append_dev(th44, t200);
    			append_dev(th44, br12);
    			append_dev(th44, t201);
    			append_dev(tr31, t202);
    			append_dev(tr31, th45);
    			append_dev(th45, h513);
    			append_dev(th45, t204);
    			append_dev(th45, h612);
    			append_dev(th45, t206);
    			append_dev(th45, p11);
    			append_dev(table, t208);
    			append_dev(table, tr32);
    			append_dev(table, t209);
    			append_dev(table, tr33);
    			append_dev(tr33, th46);
    			append_dev(tr33, t211);
    			append_dev(tr33, th47);
    			append_dev(th47, h514);
    			append_dev(th47, t213);
    			append_dev(th47, h613);
    			append_dev(th47, t215);
    			append_dev(th47, p12);
    			append_dev(table, t217);
    			append_dev(table, tr34);
    			append_dev(tr34, th48);
    			append_dev(tr34, t218);
    			append_dev(tr34, th49);
    			append_dev(th49, h47);
    			append_dev(table, t220);
    			append_dev(table, tr35);
    			append_dev(tr35, th50);
    			append_dev(th50, t221);
    			append_dev(th50, br13);
    			append_dev(th50, t222);
    			append_dev(tr35, t223);
    			append_dev(tr35, th51);
    			append_dev(th51, h515);
    			append_dev(th51, t225);
    			append_dev(th51, h614);
    			append_dev(th51, t227);
    			append_dev(th51, p13);
    			append_dev(table, t229);
    			append_dev(table, br14);
    			append_dev(table, t230);
    			append_dev(table, tr36);
    			append_dev(tr36, th52);
    			append_dev(tr36, t232);
    			append_dev(tr36, th53);
    			append_dev(th53, h516);
    			append_dev(table, t234);
    			append_dev(table, tr37);
    			append_dev(tr37, th54);
    			append_dev(tr37, t235);
    			append_dev(tr37, th55);
    			append_dev(th55, h48);
    			append_dev(table, t237);
    			append_dev(table, tr38);
    			append_dev(tr38, th56);
    			append_dev(tr38, t238);
    			append_dev(tr38, th57);
    			append_dev(th57, h517);
    			append_dev(table, t240);
    			append_dev(table, tr39);
    			append_dev(tr39, th58);
    			append_dev(tr39, t242);
    			append_dev(tr39, th59);
    			append_dev(th59, h518);
    			append_dev(table, t244);
    			append_dev(table, tr40);
    			append_dev(tr40, th60);
    			append_dev(tr40, t246);
    			append_dev(tr40, th61);
    			append_dev(th61, h519);
    			append_dev(table, t248);
    			append_dev(table, br15);
    			append_dev(table, t249);
    			append_dev(table, tr41);
    			append_dev(tr41, th62);
    			append_dev(tr41, t250);
    			append_dev(tr41, th63);
    			append_dev(th63, h520);
    			append_dev(table, t252);
    			append_dev(table, tr42);
    			append_dev(tr42, th64);
    			append_dev(tr42, t254);
    			append_dev(tr42, th65);
    			append_dev(th65, h521);
    			append_dev(table, t256);
    			append_dev(table, tr43);
    			append_dev(tr43, th66);
    			append_dev(tr43, t258);
    			append_dev(tr43, th67);
    			append_dev(th67, h522);
    			append_dev(table, t260);
    			append_dev(table, tr44);
    			append_dev(tr44, th68);
    			append_dev(tr44, t262);
    			append_dev(tr44, th69);
    			append_dev(th69, h523);
    			append_dev(table, t264);
    			append_dev(table, tr45);
    			append_dev(tr45, th70);
    			append_dev(tr45, t265);
    			append_dev(tr45, th71);
    			append_dev(th71, h49);
    			append_dev(table, t267);
    			append_dev(table, tr46);
    			append_dev(tr46, th72);
    			append_dev(tr46, t269);
    			append_dev(tr46, th73);
    			append_dev(th73, h524);
    			append_dev(h524, a12);
    			append_dev(h524, t271);
    			append_dev(h524, i11);
    			append_dev(table, t273);
    			append_dev(table, tr47);
    			append_dev(tr47, th74);
    			append_dev(tr47, t275);
    			append_dev(tr47, th75);
    			append_dev(th75, h525);
    			append_dev(h525, a13);
    			append_dev(h525, t277);
    			append_dev(h525, i12);
    			append_dev(table, t279);
    			append_dev(table, tr48);
    			append_dev(tr48, th76);
    			append_dev(tr48, t281);
    			append_dev(tr48, th77);
    			append_dev(th77, h526);
    			append_dev(h526, a14);
    			append_dev(h526, t283);
    			append_dev(h526, i13);
    			append_dev(table, t285);
    			append_dev(table, tr49);
    			append_dev(tr49, th78);
    			append_dev(tr49, t287);
    			append_dev(tr49, th79);
    			append_dev(th79, h527);
    			append_dev(h527, a15);
    			append_dev(h527, t289);
    			append_dev(h527, i14);
    			append_dev(table, t291);
    			append_dev(table, tr50);
    			append_dev(tr50, th80);
    			append_dev(tr50, t293);
    			append_dev(tr50, th81);
    			append_dev(th81, h528);
    			append_dev(h528, a16);
    			append_dev(h528, t295);
    			append_dev(h528, i15);
    			append_dev(table, t297);
    			append_dev(table, tr51);
    			append_dev(tr51, th82);
    			append_dev(tr51, t299);
    			append_dev(tr51, th83);
    			append_dev(th83, h529);
    			append_dev(h529, a17);
    			append_dev(h529, t301);
    			append_dev(h529, i16);
    			append_dev(table, t303);
    			append_dev(table, tr52);
    			append_dev(tr52, th84);
    			append_dev(tr52, t305);
    			append_dev(tr52, th85);
    			append_dev(th85, h530);
    			append_dev(h530, a18);
    			append_dev(h530, t307);
    			append_dev(h530, i17);
    			append_dev(table, t309);
    			append_dev(table, tr53);
    			append_dev(tr53, th86);
    			append_dev(tr53, t310);
    			append_dev(tr53, th87);
    			append_dev(th87, h410);
    			append_dev(table, t312);
    			append_dev(table, tr54);
    			append_dev(tr54, th88);
    			append_dev(tr54, t314);
    			append_dev(tr54, th89);
    			append_dev(th89, h531);
    			append_dev(th89, t316);
    			append_dev(th89, p14);
    			append_dev(th89, t318);
    			append_dev(th89, div11);
    			append_dev(div11, a19);
    			append_dev(a19, button22);
    			append_dev(button22, i18);
    			append_dev(button22, t319);
    			append_dev(table, t320);
    			append_dev(table, tr55);
    			append_dev(table, t321);
    			append_dev(table, tr56);
    			append_dev(tr56, th90);
    			append_dev(tr56, t323);
    			append_dev(tr56, th91);
    			append_dev(th91, h532);
    			append_dev(th91, t325);
    			append_dev(th91, h615);
    			append_dev(th91, t327);
    			append_dev(th91, p15);
    			append_dev(th91, t329);
    			append_dev(th91, div12);
    			append_dev(div12, a20);
    			append_dev(a20, button23);
    			append_dev(button23, i19);
    			append_dev(button23, t330);
    			append_dev(table, t331);
    			append_dev(table, tr57);
    			append_dev(table, t332);
    			append_dev(table, tr58);
    			append_dev(tr58, th92);
    			append_dev(tr58, t334);
    			append_dev(tr58, th93);
    			append_dev(th93, h533);
    			append_dev(th93, t336);
    			append_dev(th93, p16);
    			append_dev(th93, t338);
    			append_dev(th93, div13);
    			append_dev(div13, a21);
    			append_dev(a21, button24);
    			append_dev(button24, i20);
    			append_dev(button24, t339);
    			append_dev(div13, t340);
    			append_dev(div13, a22);
    			append_dev(a22, button25);
    			append_dev(button25, i21);
    			append_dev(button25, t341);
    			append_dev(table, t342);
    			append_dev(table, tr59);
    			append_dev(table, t343);
    			append_dev(table, tr60);
    			append_dev(tr60, th94);
    			append_dev(tr60, t345);
    			append_dev(tr60, th95);
    			append_dev(th95, h534);
    			append_dev(th95, t347);
    			append_dev(th95, p17);
    			append_dev(th95, t349);
    			append_dev(th95, div14);
    			append_dev(div14, a23);
    			append_dev(a23, button26);
    			append_dev(button26, i22);
    			append_dev(button26, t350);
    			append_dev(div14, t351);
    			append_dev(div14, a24);
    			append_dev(a24, button27);
    			append_dev(button27, i23);
    			append_dev(button27, t352);
    			append_dev(table, t353);
    			append_dev(table, tr61);
    			append_dev(tr61, th96);
    			append_dev(tr61, t354);
    			append_dev(tr61, th97);
    			append_dev(th97, h411);
    			append_dev(table, t356);
    			append_dev(table, tr62);
    			append_dev(tr62, th98);
    			append_dev(tr62, t358);
    			append_dev(tr62, th99);
    			append_dev(th99, h535);
    			append_dev(th99, t360);
    			append_dev(th99, a25);
    			append_dev(a25, h536);
    			append_dev(table, t362);
    			append_dev(table, tr63);
    			append_dev(tr63, th100);
    			append_dev(tr63, t364);
    			append_dev(tr63, th101);
    			append_dev(th101, a26);
    			append_dev(a26, h537);
    			append_dev(th101, t366);
    			append_dev(th101, a27);
    			append_dev(a27, h538);
    			append_dev(th101, t368);
    			append_dev(th101, a28);
    			append_dev(a28, h539);
    			append_dev(th101, t370);
    			append_dev(th101, a29);
    			append_dev(a29, h540);
    			append_dev(th101, t372);
    			append_dev(th101, h541);
    			append_dev(table, t374);
    			append_dev(table, tr64);
    			append_dev(tr64, th102);
    			append_dev(tr64, t375);
    			append_dev(tr64, th103);
    			append_dev(th103, h412);
    			append_dev(table, t377);
    			append_dev(table, tr65);
    			append_dev(tr65, th104);
    			append_dev(tr65, t378);
    			append_dev(tr65, th105);
    			append_dev(th105, h542);
    			append_dev(th105, t380);
    			append_dev(th105, div15);
    			append_dev(div15, button28);
    			append_dev(div15, t382);
    			append_dev(div15, button29);
    			append_dev(div15, t384);
    			append_dev(div15, button30);
    			append_dev(table, t386);
    			append_dev(table, tr66);
    			append_dev(table, t387);
    			append_dev(table, tr67);
    			append_dev(tr67, th106);
    			append_dev(tr67, t388);
    			append_dev(tr67, th107);
    			append_dev(th107, h543);
    			append_dev(th107, t390);
    			append_dev(th107, div16);
    			append_dev(div16, button31);
    			append_dev(div16, t392);
    			append_dev(div16, button32);
    			append_dev(div16, t394);
    			append_dev(div16, button33);
    			append_dev(div16, t396);
    			append_dev(div16, button34);
    			append_dev(div16, t398);
    			append_dev(div16, button35);
    			append_dev(div16, t400);
    			append_dev(div16, button36);
    			append_dev(div16, t402);
    			append_dev(div16, button37);
    			append_dev(table, t404);
    			append_dev(table, tr68);
    			append_dev(table, t405);
    			append_dev(table, tr69);
    			append_dev(tr69, th108);
    			append_dev(tr69, t406);
    			append_dev(tr69, th109);
    			append_dev(th109, h544);
    			append_dev(th109, t408);
    			append_dev(th109, div17);
    			append_dev(div17, button38);
    			append_dev(div17, t410);
    			append_dev(div17, button39);
    			append_dev(div17, t412);
    			append_dev(div17, button40);
    			append_dev(div17, t414);
    			append_dev(div17, button41);
    			append_dev(div17, t416);
    			append_dev(div17, button42);
    			append_dev(div17, t418);
    			append_dev(div17, button43);
    			append_dev(div17, t420);
    			append_dev(div17, button44);
    			append_dev(div17, t422);
    			append_dev(div17, button45);
    			append_dev(div17, t424);
    			append_dev(div17, button46);
    			append_dev(div17, t426);
    			append_dev(div17, button47);
    			append_dev(div17, t428);
    			append_dev(div17, button48);
    			append_dev(table, t430);
    			append_dev(table, tr70);
    			append_dev(table, t431);
    			append_dev(table, tr71);
    			append_dev(tr71, th110);
    			append_dev(tr71, t432);
    			append_dev(tr71, th111);
    			append_dev(th111, p18);
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
    						each_blocks_1[i].m(table, t191);
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
    						each_blocks[i].m(table, t195);
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
    			if (detaching) detach_dev(div18);
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
    	onMount(() => window.scrollTo(0, 0));
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
