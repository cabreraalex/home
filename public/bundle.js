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

    // (291:6) {#each pubs as pub}
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
    			add_location(th0, file$9, 292, 10, 9158);
    			attr_dev(h5, "class", "svelte-1v7h9f9");
    			add_location(h5, file$9, 295, 14, 9295);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 294, 12, 9230);
    			attr_dev(h6, "class", "authors svelte-1v7h9f9");
    			add_location(h6, file$9, 298, 12, 9346);
    			add_location(i, file$9, 310, 14, 9719);
    			attr_dev(p, "class", "desc svelte-1v7h9f9");
    			add_location(p, file$9, 309, 12, 9688);
    			attr_dev(th1, "class", "svelte-1v7h9f9");
    			add_location(th1, file$9, 293, 10, 9213);
    			attr_dev(tr0, "class", "item svelte-1v7h9f9");
    			add_location(tr0, file$9, 291, 8, 9130);
    			attr_dev(tr1, "class", "buffer svelte-1v7h9f9");
    			add_location(tr1, file$9, 316, 8, 9855);
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
    		source: "(291:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (326:6) {#each other as pub}
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
    			add_location(th0, file$9, 327, 10, 10133);
    			attr_dev(h5, "class", "svelte-1v7h9f9");
    			add_location(h5, file$9, 330, 14, 10270);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file$9, 329, 12, 10205);
    			attr_dev(h6, "class", "authors svelte-1v7h9f9");
    			add_location(h6, file$9, 333, 12, 10321);
    			add_location(i, file$9, 345, 14, 10694);
    			attr_dev(p, "class", "desc svelte-1v7h9f9");
    			add_location(p, file$9, 344, 12, 10663);
    			attr_dev(th1, "class", "svelte-1v7h9f9");
    			add_location(th1, file$9, 328, 10, 10188);
    			attr_dev(tr0, "class", "item svelte-1v7h9f9");
    			add_location(tr0, file$9, 326, 8, 10105);
    			attr_dev(tr1, "class", "buffer svelte-1v7h9f9");
    			add_location(tr1, file$9, 351, 8, 10830);
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
    		source: "(326:6) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div12;
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
    	let tr12;
    	let t84;
    	let tr13;
    	let th18;
    	let t85;
    	let br6;
    	let t86;
    	let t87;
    	let th19;
    	let h55;
    	let t89;
    	let h66;
    	let t91;
    	let p6;
    	let t93;
    	let tr14;
    	let th20;
    	let t94;
    	let th21;
    	let h42;
    	let t96;
    	let tr15;
    	let th22;
    	let t98;
    	let th23;
    	let h56;
    	let t100;
    	let p7;
    	let t102;
    	let div3;
    	let a7;
    	let button3;
    	let i3;
    	let t103;
    	let t104;
    	let tr16;
    	let t105;
    	let tr17;
    	let th24;
    	let t107;
    	let th25;
    	let h57;
    	let t109;
    	let p8;
    	let t111;
    	let div4;
    	let a8;
    	let button4;
    	let i4;
    	let t112;
    	let t113;
    	let tr18;
    	let t114;
    	let tr19;
    	let th26;
    	let t115;
    	let br7;
    	let t116;
    	let t117;
    	let th27;
    	let h58;
    	let t119;
    	let h67;
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
    	let t128;
    	let th29;
    	let h59;
    	let t130;
    	let h68;
    	let t132;
    	let p10;
    	let t134;
    	let div6;
    	let a10;
    	let button6;
    	let i6;
    	let t135;
    	let t136;
    	let tr22;
    	let th30;
    	let t137;
    	let th31;
    	let h43;
    	let t139;
    	let t140;
    	let tr23;
    	let th32;
    	let t141;
    	let th33;
    	let h44;
    	let t143;
    	let t144;
    	let tr24;
    	let th34;
    	let t145;
    	let th35;
    	let h45;
    	let t147;
    	let tr25;
    	let th36;
    	let t148;
    	let br8;
    	let t149;
    	let br9;
    	let t150;
    	let t151;
    	let th37;
    	let h510;
    	let t153;
    	let h69;
    	let t155;
    	let p11;
    	let t157;
    	let tr26;
    	let t158;
    	let tr27;
    	let th38;
    	let t160;
    	let th39;
    	let h511;
    	let t162;
    	let h610;
    	let t164;
    	let p12;
    	let t166;
    	let tr28;
    	let th40;
    	let t167;
    	let th41;
    	let h46;
    	let t169;
    	let tr29;
    	let th42;
    	let t170;
    	let br10;
    	let t171;
    	let t172;
    	let th43;
    	let h512;
    	let t174;
    	let h611;
    	let t176;
    	let p13;
    	let t178;
    	let br11;
    	let t179;
    	let tr30;
    	let th44;
    	let t180;
    	let br12;
    	let t181;
    	let t182;
    	let th45;
    	let h513;
    	let t184;
    	let h612;
    	let t186;
    	let p14;
    	let t188;
    	let br13;
    	let t189;
    	let tr31;
    	let th46;
    	let t190;
    	let br14;
    	let t191;
    	let t192;
    	let th47;
    	let h514;
    	let t194;
    	let tr32;
    	let th48;
    	let t195;
    	let th49;
    	let h47;
    	let t197;
    	let tr33;
    	let th50;
    	let t198;
    	let th51;
    	let h515;
    	let t200;
    	let tr34;
    	let th52;
    	let t202;
    	let th53;
    	let h516;
    	let t204;
    	let tr35;
    	let th54;
    	let t206;
    	let th55;
    	let h517;
    	let t208;
    	let br15;
    	let t209;
    	let tr36;
    	let th56;
    	let t210;
    	let th57;
    	let h518;
    	let t212;
    	let tr37;
    	let th58;
    	let t214;
    	let th59;
    	let h519;
    	let t216;
    	let tr38;
    	let th60;
    	let t218;
    	let th61;
    	let h520;
    	let t220;
    	let tr39;
    	let th62;
    	let t222;
    	let th63;
    	let h521;
    	let t224;
    	let tr40;
    	let th64;
    	let t226;
    	let th65;
    	let h522;
    	let t228;
    	let tr41;
    	let th66;
    	let t230;
    	let th67;
    	let h523;
    	let t232;
    	let tr42;
    	let th68;
    	let t233;
    	let th69;
    	let h48;
    	let t235;
    	let tr43;
    	let th70;
    	let t237;
    	let th71;
    	let h524;
    	let a11;
    	let t239;
    	let i7;
    	let t241;
    	let tr44;
    	let th72;
    	let t243;
    	let th73;
    	let h525;
    	let a12;
    	let t245;
    	let i8;
    	let t247;
    	let tr45;
    	let th74;
    	let t249;
    	let th75;
    	let h526;
    	let a13;
    	let t251;
    	let i9;
    	let t253;
    	let tr46;
    	let th76;
    	let t255;
    	let th77;
    	let h527;
    	let a14;
    	let t257;
    	let i10;
    	let t259;
    	let tr47;
    	let th78;
    	let t261;
    	let th79;
    	let h528;
    	let a15;
    	let t263;
    	let i11;
    	let t265;
    	let tr48;
    	let th80;
    	let t267;
    	let th81;
    	let h529;
    	let a16;
    	let t269;
    	let i12;
    	let t271;
    	let tr49;
    	let th82;
    	let t273;
    	let th83;
    	let h530;
    	let a17;
    	let t275;
    	let i13;
    	let t277;
    	let tr50;
    	let th84;
    	let t278;
    	let th85;
    	let h49;
    	let t280;
    	let tr51;
    	let th86;
    	let t282;
    	let th87;
    	let h531;
    	let t284;
    	let p15;
    	let t286;
    	let div7;
    	let a18;
    	let button7;
    	let i14;
    	let t287;
    	let t288;
    	let a19;
    	let button8;
    	let i15;
    	let t289;
    	let t290;
    	let a20;
    	let button9;
    	let i16;
    	let t291;
    	let t292;
    	let tr52;
    	let t293;
    	let tr53;
    	let th88;
    	let t295;
    	let th89;
    	let h532;
    	let t297;
    	let p16;
    	let t299;
    	let div8;
    	let a21;
    	let button10;
    	let i17;
    	let t300;
    	let t301;
    	let tr54;
    	let t302;
    	let tr55;
    	let th90;
    	let t304;
    	let th91;
    	let h533;
    	let t306;
    	let h613;
    	let t308;
    	let p17;
    	let t310;
    	let div9;
    	let a22;
    	let button11;
    	let i18;
    	let t311;
    	let t312;
    	let tr56;
    	let t313;
    	let tr57;
    	let th92;
    	let t314;
    	let br16;
    	let t315;
    	let t316;
    	let th93;
    	let h534;
    	let t318;
    	let h614;
    	let t320;
    	let p18;
    	let t322;
    	let div10;
    	let a23;
    	let button12;
    	let i19;
    	let t323;
    	let t324;
    	let a24;
    	let button13;
    	let i20;
    	let t325;
    	let t326;
    	let tr58;
    	let t327;
    	let tr59;
    	let th94;
    	let t329;
    	let th95;
    	let h535;
    	let t331;
    	let p19;
    	let t333;
    	let div11;
    	let a25;
    	let button14;
    	let i21;
    	let t334;
    	let t335;
    	let a26;
    	let button15;
    	let i22;
    	let t336;
    	let t337;
    	let tr60;
    	let th96;
    	let t338;
    	let th97;
    	let h410;
    	let t340;
    	let tr61;
    	let th98;
    	let t342;
    	let th99;
    	let h536;
    	let t344;
    	let h537;
    	let t346;
    	let a27;
    	let h538;
    	let t348;
    	let tr62;
    	let th100;
    	let t350;
    	let th101;
    	let a28;
    	let h539;
    	let t352;
    	let a29;
    	let h540;
    	let t354;
    	let a30;
    	let h541;
    	let t356;
    	let a31;
    	let h542;
    	let t358;
    	let h543;
    	let t360;
    	let tr63;
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
    			div12 = element("div");
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
    			a6 = element("a");
    			button2 = element("button");
    			i2 = element("i");
    			t72 = text("\n                WSJ Article");
    			t73 = space();
    			tr10 = element("tr");
    			t74 = space();
    			tr11 = element("tr");
    			th16 = element("th");
    			t75 = text("May 2017 ");
    			br5 = element("br");
    			t76 = text(" - August 2017");
    			t77 = space();
    			th17 = element("th");
    			h54 = element("h5");
    			h54.textContent = "Google";
    			t79 = space();
    			h65 = element("h6");
    			h65.textContent = "Software Engineering Intern";
    			t81 = space();
    			p5 = element("p");
    			p5.textContent = "Created an anomaly detection and trend analysis system for Google's\n            data processing pipelines.";
    			t83 = space();
    			tr12 = element("tr");
    			t84 = space();
    			tr13 = element("tr");
    			th18 = element("th");
    			t85 = text("May 2016 ");
    			br6 = element("br");
    			t86 = text(" - August 2016");
    			t87 = space();
    			th19 = element("th");
    			h55 = element("h5");
    			h55.textContent = "Google";
    			t89 = space();
    			h66 = element("h6");
    			h66.textContent = "Engineering Practicum Intern";
    			t91 = space();
    			p6 = element("p");
    			p6.textContent = "Built an analytics platform for monitoring and catching erroneous\n            edits to Google Maps.";
    			t93 = space();
    			tr14 = element("tr");
    			th20 = element("th");
    			t94 = space();
    			th21 = element("th");
    			h42 = element("h4");
    			h42.textContent = "Awards";
    			t96 = space();
    			tr15 = element("tr");
    			th22 = element("th");
    			th22.textContent = "May 2019";
    			t98 = space();
    			th23 = element("th");
    			h56 = element("h5");
    			h56.textContent = "National Science Foundation Graduate Research Fellowship (NSF GRFP)";
    			t100 = space();
    			p7 = element("p");
    			p7.textContent = "Three-year graduate fellowship for independent research. Full\n            tuition with an annual stipend of $34,000.";
    			t102 = space();
    			div3 = element("div");
    			a7 = element("a");
    			button3 = element("button");
    			i3 = element("i");
    			t103 = text(" Website");
    			t104 = space();
    			tr16 = element("tr");
    			t105 = space();
    			tr17 = element("tr");
    			th24 = element("th");
    			th24.textContent = "May 2019";
    			t107 = space();
    			th25 = element("th");
    			h57 = element("h5");
    			h57.textContent = "Love Family Foundation Scholarship";
    			t109 = space();
    			p8 = element("p");
    			p8.textContent = "Co-awarded the $10,000 scholarship for the undergraduate with the\n            most outstanding scholastic record.";
    			t111 = space();
    			div4 = element("div");
    			a8 = element("a");
    			button4 = element("button");
    			i4 = element("i");
    			t112 = text(" Announcement");
    			t113 = space();
    			tr18 = element("tr");
    			t114 = space();
    			tr19 = element("tr");
    			th26 = element("th");
    			t115 = text("August 2015 ");
    			br7 = element("br");
    			t116 = text(" - May 2019");
    			t117 = space();
    			th27 = element("th");
    			h58 = element("h5");
    			h58.textContent = "Stamps President's Scholar";
    			t119 = space();
    			h67 = element("h6");
    			h67.textContent = "Georgia Tech and the Stamps Family Charitable Foundation";
    			t121 = space();
    			p9 = element("p");
    			p9.textContent = "Full ride scholarship with $15,000 in extracurricular funding\n            awarded to 10 incoming students.";
    			t123 = space();
    			div5 = element("div");
    			a9 = element("a");
    			button5 = element("button");
    			i5 = element("i");
    			t124 = text(" Website");
    			t125 = space();
    			tr20 = element("tr");
    			t126 = space();
    			tr21 = element("tr");
    			th28 = element("th");
    			th28.textContent = "February 3, 2018";
    			t128 = space();
    			th29 = element("th");
    			h59 = element("h5");
    			h59.textContent = "The Data Open Datathon";
    			t130 = space();
    			h68 = element("h6");
    			h68.textContent = "Correlation One and Citadel Securities";
    			t132 = space();
    			p10 = element("p");
    			p10.textContent = "Placed third and won $2,500 for creating a ML system to predict\n            dangerous road areas.";
    			t134 = space();
    			div6 = element("div");
    			a10 = element("a");
    			button6 = element("button");
    			i6 = element("i");
    			t135 = text(" Press Release");
    			t136 = space();
    			tr22 = element("tr");
    			th30 = element("th");
    			t137 = space();
    			th31 = element("th");
    			h43 = element("h4");
    			h43.textContent = "Refereed Publications";
    			t139 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t140 = space();
    			tr23 = element("tr");
    			th32 = element("th");
    			t141 = space();
    			th33 = element("th");
    			h44 = element("h4");
    			h44.textContent = "Workshops, Demos, Posters, and Preprints";
    			t143 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t144 = space();
    			tr24 = element("tr");
    			th34 = element("th");
    			t145 = space();
    			th35 = element("th");
    			h45 = element("h4");
    			h45.textContent = "Teaching";
    			t147 = space();
    			tr25 = element("tr");
    			th36 = element("th");
    			t148 = text("Fall 2016 ");
    			br8 = element("br");
    			t149 = text(" Spring 2017 ");
    			br9 = element("br");
    			t150 = text(" Spring 2018");
    			t151 = space();
    			th37 = element("th");
    			h510 = element("h5");
    			h510.textContent = "CS1332 - Data Structures and Algorithms";
    			t153 = space();
    			h69 = element("h6");
    			h69.textContent = "Undergraduate Teaching Assistant @ Georgia Tech";
    			t155 = space();
    			p11 = element("p");
    			p11.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t157 = space();
    			tr26 = element("tr");
    			t158 = space();
    			tr27 = element("tr");
    			th38 = element("th");
    			th38.textContent = "Fall 2016";
    			t160 = space();
    			th39 = element("th");
    			h511 = element("h5");
    			h511.textContent = "GT 1000 - First-Year Seminar";
    			t162 = space();
    			h610 = element("h6");
    			h610.textContent = "Team Leader @ Georgia Tech";
    			t164 = space();
    			p12 = element("p");
    			p12.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t166 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			t167 = space();
    			th41 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Mentoring";
    			t169 = space();
    			tr29 = element("tr");
    			th42 = element("th");
    			t170 = text("Spring 2021 ");
    			br10 = element("br");
    			t171 = text(" - Present");
    			t172 = space();
    			th43 = element("th");
    			h512 = element("h5");
    			h512.textContent = "Kazi Jawad";
    			t174 = space();
    			h611 = element("h6");
    			h611.textContent = "B.S. in Statistics and Machine Learning, Carnegie Mellon";
    			t176 = space();
    			p13 = element("p");
    			p13.textContent = "Interactive tagging of images.";
    			t178 = space();
    			br11 = element("br");
    			t179 = space();
    			tr30 = element("tr");
    			th44 = element("th");
    			t180 = text("Spring 2020 ");
    			br12 = element("br");
    			t181 = text(" - Present");
    			t182 = space();
    			th45 = element("th");
    			h513 = element("h5");
    			h513.textContent = "Abraham Druck";
    			t184 = space();
    			h612 = element("h6");
    			h612.textContent = "B.S. in Mathematical Sciences, Carnegie Mellon";
    			t186 = space();
    			p14 = element("p");
    			p14.textContent = "Crowdsourced discovery of ML blind spots for image captioning.";
    			t188 = space();
    			br13 = element("br");
    			t189 = space();
    			tr31 = element("tr");
    			th46 = element("th");
    			t190 = text("Fall 2020 ");
    			br14 = element("br");
    			t191 = text(" Spring 2020");
    			t192 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "CMU AI Mentoring Program";
    			t194 = space();
    			tr32 = element("tr");
    			th48 = element("th");
    			t195 = space();
    			th49 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t197 = space();
    			tr33 = element("tr");
    			th50 = element("th");
    			t198 = space();
    			th51 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Student Volunteer";
    			t200 = space();
    			tr34 = element("tr");
    			th52 = element("th");
    			th52.textContent = "October 2019";
    			t202 = space();
    			th53 = element("th");
    			h516 = element("h5");
    			h516.textContent = "IEEE Visualization (VIS)";
    			t204 = space();
    			tr35 = element("tr");
    			th54 = element("th");
    			th54.textContent = "January 2019";
    			t206 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t208 = space();
    			br15 = element("br");
    			t209 = space();
    			tr36 = element("tr");
    			th56 = element("th");
    			t210 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "Reviewer";
    			t212 = space();
    			tr37 = element("tr");
    			th58 = element("th");
    			th58.textContent = "2019 - 2021";
    			t214 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t216 = space();
    			tr38 = element("tr");
    			th60 = element("th");
    			th60.textContent = "2020 - 2021";
    			t218 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "IEEE Visualization (VIS)";
    			t220 = space();
    			tr39 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2021";
    			t222 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "ACM Conference on Computer-Supported Cooperative Work and Social\n            Computing (CSCW)";
    			t224 = space();
    			tr40 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2021";
    			t226 = space();
    			th65 = element("th");
    			h522 = element("h5");
    			h522.textContent = "ACM Conference on Human Factors in Computing Systems (CHI)";
    			t228 = space();
    			tr41 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2019";
    			t230 = space();
    			th67 = element("th");
    			h523 = element("h5");
    			h523.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t232 = space();
    			tr42 = element("tr");
    			th68 = element("th");
    			t233 = space();
    			th69 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Press";
    			t235 = space();
    			tr43 = element("tr");
    			th70 = element("th");
    			th70.textContent = "2020";
    			t237 = space();
    			th71 = element("th");
    			h524 = element("h5");
    			a11 = element("a");
    			a11.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t239 = text("\n            -\n            ");
    			i7 = element("i");
    			i7.textContent = "CNN";
    			t241 = space();
    			tr44 = element("tr");
    			th72 = element("th");
    			th72.textContent = "2020";
    			t243 = space();
    			th73 = element("th");
    			h525 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t245 = text("\n            -\n            ");
    			i8 = element("i");
    			i8.textContent = "Wired";
    			t247 = space();
    			tr45 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2020";
    			t249 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t251 = text("\n            -\n            ");
    			i9 = element("i");
    			i9.textContent = "Carnegie Mellon";
    			t253 = space();
    			tr46 = element("tr");
    			th76 = element("th");
    			th76.textContent = "2020";
    			t255 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t257 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "Data Stories Podcast";
    			t259 = space();
    			tr47 = element("tr");
    			th78 = element("th");
    			th78.textContent = "2019";
    			t261 = space();
    			th79 = element("th");
    			h528 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t263 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "GT SCS";
    			t265 = space();
    			tr48 = element("tr");
    			th80 = element("th");
    			th80.textContent = "2019";
    			t267 = space();
    			th81 = element("th");
    			h529 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t269 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Georgia Tech";
    			t271 = space();
    			tr49 = element("tr");
    			th82 = element("th");
    			th82.textContent = "2018";
    			t273 = space();
    			th83 = element("th");
    			h530 = element("h5");
    			a17 = element("a");
    			a17.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t275 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "GT SCS";
    			t277 = space();
    			tr50 = element("tr");
    			th84 = element("th");
    			t278 = space();
    			th85 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Projects";
    			t280 = space();
    			tr51 = element("tr");
    			th86 = element("th");
    			th86.textContent = "Spring 2021";
    			t282 = space();
    			th87 = element("th");
    			h531 = element("h5");
    			h531.textContent = "Svelte + Jupyter Widgets";
    			t284 = space();
    			p15 = element("p");
    			p15.textContent = "A framework for creating reactive data science widgets using Svelte\n            JS.";
    			t286 = space();
    			div7 = element("div");
    			a18 = element("a");
    			button7 = element("button");
    			i14 = element("i");
    			t287 = text(" Blog");
    			t288 = space();
    			a19 = element("a");
    			button8 = element("button");
    			i15 = element("i");
    			t289 = text(" GitHub");
    			t290 = space();
    			a20 = element("a");
    			button9 = element("button");
    			i16 = element("i");
    			t291 = text(" Video");
    			t292 = space();
    			tr52 = element("tr");
    			t293 = space();
    			tr53 = element("tr");
    			th88 = element("th");
    			th88.textContent = "Spring 2020";
    			t295 = space();
    			th89 = element("th");
    			h532 = element("h5");
    			h532.textContent = "COVIDCast Visualization of COVID Symptoms";
    			t297 = space();
    			p16 = element("p");
    			p16.textContent = "An interactive visualization for multiple indicators of COVID\n            symptoms collected by the CMU Delphi research group.";
    			t299 = space();
    			div8 = element("div");
    			a21 = element("a");
    			button10 = element("button");
    			i17 = element("i");
    			t300 = text(" Website");
    			t301 = space();
    			tr54 = element("tr");
    			t302 = space();
    			tr55 = element("tr");
    			th90 = element("th");
    			th90.textContent = "Fall 2018";
    			t304 = space();
    			th91 = element("th");
    			h533 = element("h5");
    			h533.textContent = "ICLR'19 Reproducibility Challenge";
    			t306 = space();
    			h613 = element("h6");
    			h613.textContent = "Generative Adversarial Models for Learning Private and Fair\n            Representations";
    			t308 = space();
    			p17 = element("p");
    			p17.textContent = "Implemented and reproduced an ICLR'19 submission using GANs to\n            decorrelate sensitive data.";
    			t310 = space();
    			div9 = element("div");
    			a22 = element("a");
    			button11 = element("button");
    			i18 = element("i");
    			t311 = text(" GitHub");
    			t312 = space();
    			tr56 = element("tr");
    			t313 = space();
    			tr57 = element("tr");
    			th92 = element("th");
    			t314 = text("September 2015 ");
    			br16 = element("br");
    			t315 = text(" - May 2017");
    			t316 = space();
    			th93 = element("th");
    			h534 = element("h5");
    			h534.textContent = "PROX-1 Satellite";
    			t318 = space();
    			h614 = element("h6");
    			h614.textContent = "Flight Software Lead and Researcher";
    			t320 = space();
    			p18 = element("p");
    			p18.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t322 = space();
    			div10 = element("div");
    			a23 = element("a");
    			button12 = element("button");
    			i19 = element("i");
    			t323 = text(" In space!");
    			t324 = space();
    			a24 = element("a");
    			button13 = element("button");
    			i20 = element("i");
    			t325 = text(" Press release");
    			t326 = space();
    			tr58 = element("tr");
    			t327 = space();
    			tr59 = element("tr");
    			th94 = element("th");
    			th94.textContent = "Spring 2014";
    			t329 = space();
    			th95 = element("th");
    			h535 = element("h5");
    			h535.textContent = "CTF Resources";
    			t331 = space();
    			p19 = element("p");
    			p19.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1,000 stars on GitHub.";
    			t333 = space();
    			div11 = element("div");
    			a25 = element("a");
    			button14 = element("button");
    			i21 = element("i");
    			t334 = text(" Website");
    			t335 = space();
    			a26 = element("a");
    			button15 = element("button");
    			i22 = element("i");
    			t336 = text(" GitHub");
    			t337 = space();
    			tr60 = element("tr");
    			th96 = element("th");
    			t338 = space();
    			th97 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Selected Classes";
    			t340 = space();
    			tr61 = element("tr");
    			th98 = element("th");
    			th98.textContent = "PhD";
    			t342 = space();
    			th99 = element("th");
    			h536 = element("h5");
    			h536.textContent = "Causality and Machine Learning";
    			t344 = space();
    			h537 = element("h5");
    			h537.textContent = "Human Judgement and Decision Making";
    			t346 = space();
    			a27 = element("a");
    			h538 = element("h5");
    			h538.textContent = "Applied Research Methods";
    			t348 = space();
    			tr62 = element("tr");
    			th100 = element("th");
    			th100.textContent = "B.S.";
    			t350 = space();
    			th101 = element("th");
    			a28 = element("a");
    			h539 = element("h5");
    			h539.textContent = "Deep Learning";
    			t352 = space();
    			a29 = element("a");
    			h540 = element("h5");
    			h540.textContent = "Data and Visual Analytics";
    			t354 = space();
    			a30 = element("a");
    			h541 = element("h5");
    			h541.textContent = "Machine Learning";
    			t356 = space();
    			a31 = element("a");
    			h542 = element("h5");
    			h542.textContent = "Computer Simulation";
    			t358 = space();
    			h543 = element("h5");
    			h543.textContent = "Honors Algorithms";
    			t360 = space();
    			tr63 = element("tr");
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
    			add_location(h52, file$9, 92, 10, 2631);
    			attr_dev(h63, "class", "svelte-1v7h9f9");
    			add_location(h63, file$9, 93, 10, 2669);
    			attr_dev(a3, "href", "https://www.microsoft.com/en-us/research/people/sdrucker/");
    			add_location(a3, file$9, 96, 12, 2791);
    			attr_dev(a4, "href", "https://homes.cs.washington.edu/~marcotcr/");
    			add_location(a4, file$9, 100, 12, 2934);
    			attr_dev(p3, "class", "desc svelte-1v7h9f9");
    			add_location(p3, file$9, 94, 10, 2704);
    			attr_dev(i1, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i1, file$9, 107, 16, 3218);
    			attr_dev(button1, "class", "entry-link");
    			add_location(button1, file$9, 106, 14, 3174);
    			attr_dev(a5, "href", "https://www.microsoft.com/en-us/research/group/vida/");
    			add_location(a5, file$9, 105, 12, 3096);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file$9, 104, 10, 3065);
    			attr_dev(th13, "class", "svelte-1v7h9f9");
    			add_location(th13, file$9, 91, 8, 2616);
    			attr_dev(tr7, "class", "item svelte-1v7h9f9");
    			add_location(tr7, file$9, 89, 6, 2530);
    			attr_dev(tr8, "class", "buffer svelte-1v7h9f9");
    			add_location(tr8, file$9, 113, 6, 3346);
    			add_location(br4, file$9, 115, 34, 3426);
    			attr_dev(th14, "class", "date svelte-1v7h9f9");
    			add_location(th14, file$9, 115, 8, 3400);
    			attr_dev(h53, "class", "svelte-1v7h9f9");
    			add_location(h53, file$9, 117, 10, 3475);
    			attr_dev(h64, "class", "svelte-1v7h9f9");
    			add_location(h64, file$9, 118, 10, 3501);
    			attr_dev(p4, "class", "desc svelte-1v7h9f9");
    			add_location(p4, file$9, 119, 10, 3548);
    			attr_dev(i2, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i2, file$9, 130, 16, 4008);
    			attr_dev(button2, "class", "entry-link");
    			add_location(button2, file$9, 129, 14, 3964);
    			attr_dev(a6, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n                ");
    			add_location(a6, file$9, 125, 12, 3811);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file$9, 124, 10, 3780);
    			attr_dev(th15, "class", "svelte-1v7h9f9");
    			add_location(th15, file$9, 116, 8, 3460);
    			attr_dev(tr9, "class", "item svelte-1v7h9f9");
    			add_location(tr9, file$9, 114, 6, 3374);
    			attr_dev(tr10, "class", "buffer svelte-1v7h9f9");
    			add_location(tr10, file$9, 137, 6, 4157);
    			add_location(br5, file$9, 139, 34, 4237);
    			attr_dev(th16, "class", "date svelte-1v7h9f9");
    			add_location(th16, file$9, 139, 8, 4211);
    			attr_dev(h54, "class", "svelte-1v7h9f9");
    			add_location(h54, file$9, 141, 10, 4286);
    			attr_dev(h65, "class", "svelte-1v7h9f9");
    			add_location(h65, file$9, 142, 10, 4312);
    			attr_dev(p5, "class", "desc svelte-1v7h9f9");
    			add_location(p5, file$9, 143, 10, 4359);
    			attr_dev(th17, "class", "svelte-1v7h9f9");
    			add_location(th17, file$9, 140, 8, 4271);
    			attr_dev(tr11, "class", "item svelte-1v7h9f9");
    			add_location(tr11, file$9, 138, 6, 4185);
    			attr_dev(tr12, "class", "buffer svelte-1v7h9f9");
    			add_location(tr12, file$9, 149, 6, 4542);
    			add_location(br6, file$9, 151, 34, 4622);
    			attr_dev(th18, "class", "date svelte-1v7h9f9");
    			add_location(th18, file$9, 151, 8, 4596);
    			attr_dev(h55, "class", "svelte-1v7h9f9");
    			add_location(h55, file$9, 153, 10, 4671);
    			attr_dev(h66, "class", "svelte-1v7h9f9");
    			add_location(h66, file$9, 154, 10, 4697);
    			attr_dev(p6, "class", "desc svelte-1v7h9f9");
    			add_location(p6, file$9, 155, 10, 4745);
    			attr_dev(th19, "class", "svelte-1v7h9f9");
    			add_location(th19, file$9, 152, 8, 4656);
    			attr_dev(tr13, "class", "item svelte-1v7h9f9");
    			add_location(tr13, file$9, 150, 6, 4570);
    			attr_dev(th20, "class", "date svelte-1v7h9f9");
    			add_location(th20, file$9, 163, 8, 4956);
    			attr_dev(h42, "class", "header svelte-1v7h9f9");
    			add_location(h42, file$9, 165, 10, 4999);
    			attr_dev(th21, "class", "svelte-1v7h9f9");
    			add_location(th21, file$9, 164, 8, 4984);
    			add_location(tr14, file$9, 162, 6, 4943);
    			attr_dev(th22, "class", "date svelte-1v7h9f9");
    			add_location(th22, file$9, 169, 8, 5088);
    			attr_dev(h56, "class", "svelte-1v7h9f9");
    			add_location(h56, file$9, 171, 10, 5142);
    			attr_dev(p7, "class", "desc svelte-1v7h9f9");
    			add_location(p7, file$9, 174, 10, 5253);
    			attr_dev(i3, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i3, file$9, 181, 16, 5549);
    			attr_dev(button3, "class", "entry-link");
    			add_location(button3, file$9, 180, 14, 5505);
    			attr_dev(a7, "href", "https://www.nsfgrfp.org/");
    			add_location(a7, file$9, 179, 12, 5455);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file$9, 178, 10, 5424);
    			attr_dev(th23, "class", "svelte-1v7h9f9");
    			add_location(th23, file$9, 170, 8, 5127);
    			attr_dev(tr15, "class", "item svelte-1v7h9f9");
    			add_location(tr15, file$9, 168, 6, 5062);
    			attr_dev(tr16, "class", "buffer svelte-1v7h9f9");
    			add_location(tr16, file$9, 187, 6, 5674);
    			attr_dev(th24, "class", "date svelte-1v7h9f9");
    			add_location(th24, file$9, 189, 8, 5728);
    			attr_dev(h57, "class", "svelte-1v7h9f9");
    			add_location(h57, file$9, 191, 10, 5782);
    			attr_dev(p8, "class", "desc svelte-1v7h9f9");
    			add_location(p8, file$9, 192, 10, 5836);
    			attr_dev(i4, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i4, file$9, 201, 16, 6249);
    			attr_dev(button4, "class", "entry-link");
    			add_location(button4, file$9, 200, 14, 6205);
    			attr_dev(a8, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a8, file$9, 197, 12, 6035);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file$9, 196, 10, 6004);
    			attr_dev(th25, "class", "svelte-1v7h9f9");
    			add_location(th25, file$9, 190, 8, 5767);
    			attr_dev(tr17, "class", "item svelte-1v7h9f9");
    			add_location(tr17, file$9, 188, 6, 5702);
    			attr_dev(tr18, "class", "buffer svelte-1v7h9f9");
    			add_location(tr18, file$9, 207, 6, 6379);
    			add_location(br7, file$9, 209, 37, 6462);
    			attr_dev(th26, "class", "date svelte-1v7h9f9");
    			add_location(th26, file$9, 209, 8, 6433);
    			attr_dev(h58, "class", "svelte-1v7h9f9");
    			add_location(h58, file$9, 211, 10, 6508);
    			attr_dev(h67, "class", "svelte-1v7h9f9");
    			add_location(h67, file$9, 212, 10, 6554);
    			attr_dev(p9, "class", "desc svelte-1v7h9f9");
    			add_location(p9, file$9, 213, 10, 6630);
    			attr_dev(i5, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i5, file$9, 220, 16, 6920);
    			attr_dev(button5, "class", "entry-link");
    			add_location(button5, file$9, 219, 14, 6876);
    			attr_dev(a9, "href", "https://stampsps.gatech.edu/");
    			add_location(a9, file$9, 218, 12, 6822);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file$9, 217, 10, 6791);
    			attr_dev(th27, "class", "svelte-1v7h9f9");
    			add_location(th27, file$9, 210, 8, 6493);
    			attr_dev(tr19, "class", "item svelte-1v7h9f9");
    			add_location(tr19, file$9, 208, 6, 6407);
    			attr_dev(tr20, "class", "buffer svelte-1v7h9f9");
    			add_location(tr20, file$9, 226, 6, 7045);
    			attr_dev(th28, "class", "date svelte-1v7h9f9");
    			add_location(th28, file$9, 228, 8, 7099);
    			attr_dev(h59, "class", "svelte-1v7h9f9");
    			add_location(h59, file$9, 230, 10, 7161);
    			attr_dev(h68, "class", "svelte-1v7h9f9");
    			add_location(h68, file$9, 231, 10, 7203);
    			attr_dev(p10, "class", "desc svelte-1v7h9f9");
    			add_location(p10, file$9, 232, 10, 7261);
    			attr_dev(i6, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i6, file$9, 241, 16, 7644);
    			attr_dev(button6, "class", "entry-link");
    			add_location(button6, file$9, 240, 14, 7600);
    			attr_dev(a10, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a10, file$9, 237, 12, 7444);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file$9, 236, 10, 7413);
    			attr_dev(th29, "class", "svelte-1v7h9f9");
    			add_location(th29, file$9, 229, 8, 7146);
    			attr_dev(tr21, "class", "item svelte-1v7h9f9");
    			add_location(tr21, file$9, 227, 6, 7073);
    			attr_dev(th30, "class", "date svelte-1v7h9f9");
    			add_location(th30, file$9, 285, 8, 8981);
    			attr_dev(h43, "class", "header svelte-1v7h9f9");
    			add_location(h43, file$9, 287, 10, 9024);
    			attr_dev(th31, "class", "svelte-1v7h9f9");
    			add_location(th31, file$9, 286, 8, 9009);
    			add_location(tr22, file$9, 284, 6, 8968);
    			attr_dev(th32, "class", "date svelte-1v7h9f9");
    			add_location(th32, file$9, 320, 8, 9936);
    			attr_dev(h44, "class", "header svelte-1v7h9f9");
    			add_location(h44, file$9, 322, 10, 9979);
    			attr_dev(th33, "class", "svelte-1v7h9f9");
    			add_location(th33, file$9, 321, 8, 9964);
    			add_location(tr23, file$9, 319, 6, 9923);
    			attr_dev(th34, "class", "date svelte-1v7h9f9");
    			add_location(th34, file$9, 355, 8, 10909);
    			attr_dev(h45, "class", "header svelte-1v7h9f9");
    			add_location(h45, file$9, 357, 10, 10952);
    			attr_dev(th35, "class", "svelte-1v7h9f9");
    			add_location(th35, file$9, 356, 8, 10937);
    			add_location(tr24, file$9, 354, 6, 10896);
    			add_location(br8, file$9, 361, 35, 11070);
    			add_location(br9, file$9, 361, 54, 11089);
    			attr_dev(th36, "class", "date svelte-1v7h9f9");
    			add_location(th36, file$9, 361, 8, 11043);
    			attr_dev(h510, "class", "svelte-1v7h9f9");
    			add_location(h510, file$9, 363, 10, 11136);
    			attr_dev(h69, "class", "svelte-1v7h9f9");
    			add_location(h69, file$9, 364, 10, 11195);
    			attr_dev(p11, "class", "desc svelte-1v7h9f9");
    			add_location(p11, file$9, 365, 10, 11262);
    			attr_dev(th37, "class", "svelte-1v7h9f9");
    			add_location(th37, file$9, 362, 8, 11121);
    			attr_dev(tr25, "class", "item svelte-1v7h9f9");
    			add_location(tr25, file$9, 360, 6, 11017);
    			attr_dev(tr26, "class", "buffer svelte-1v7h9f9");
    			add_location(tr26, file$9, 371, 6, 11447);
    			attr_dev(th38, "class", "date svelte-1v7h9f9");
    			add_location(th38, file$9, 373, 8, 11501);
    			attr_dev(h511, "class", "svelte-1v7h9f9");
    			add_location(h511, file$9, 375, 10, 11556);
    			attr_dev(h610, "class", "svelte-1v7h9f9");
    			add_location(h610, file$9, 376, 10, 11604);
    			attr_dev(p12, "class", "desc svelte-1v7h9f9");
    			add_location(p12, file$9, 377, 10, 11650);
    			attr_dev(th39, "class", "svelte-1v7h9f9");
    			add_location(th39, file$9, 374, 8, 11541);
    			attr_dev(tr27, "class", "item svelte-1v7h9f9");
    			add_location(tr27, file$9, 372, 6, 11475);
    			attr_dev(th40, "class", "date svelte-1v7h9f9");
    			add_location(th40, file$9, 385, 8, 11869);
    			attr_dev(h46, "class", "header svelte-1v7h9f9");
    			add_location(h46, file$9, 387, 10, 11912);
    			attr_dev(th41, "class", "svelte-1v7h9f9");
    			add_location(th41, file$9, 386, 8, 11897);
    			add_location(tr28, file$9, 384, 6, 11856);
    			add_location(br10, file$9, 391, 37, 12033);
    			attr_dev(th42, "class", "date svelte-1v7h9f9");
    			add_location(th42, file$9, 391, 8, 12004);
    			attr_dev(h512, "class", "svelte-1v7h9f9");
    			add_location(h512, file$9, 393, 10, 12078);
    			attr_dev(h611, "class", "svelte-1v7h9f9");
    			add_location(h611, file$9, 394, 10, 12108);
    			attr_dev(p13, "class", "desc svelte-1v7h9f9");
    			add_location(p13, file$9, 395, 10, 12184);
    			attr_dev(th43, "class", "svelte-1v7h9f9");
    			add_location(th43, file$9, 392, 8, 12063);
    			attr_dev(tr29, "class", "item svelte-1v7h9f9");
    			add_location(tr29, file$9, 390, 6, 11978);
    			add_location(br11, file$9, 398, 6, 12267);
    			add_location(br12, file$9, 400, 37, 12335);
    			attr_dev(th44, "class", "date svelte-1v7h9f9");
    			add_location(th44, file$9, 400, 8, 12306);
    			attr_dev(h513, "class", "svelte-1v7h9f9");
    			add_location(h513, file$9, 402, 10, 12380);
    			attr_dev(h612, "class", "svelte-1v7h9f9");
    			add_location(h612, file$9, 403, 10, 12413);
    			attr_dev(p14, "class", "desc svelte-1v7h9f9");
    			add_location(p14, file$9, 404, 10, 12479);
    			attr_dev(th45, "class", "svelte-1v7h9f9");
    			add_location(th45, file$9, 401, 8, 12365);
    			attr_dev(tr30, "class", "item svelte-1v7h9f9");
    			add_location(tr30, file$9, 399, 6, 12280);
    			add_location(br13, file$9, 409, 6, 12618);
    			add_location(br14, file$9, 411, 35, 12684);
    			attr_dev(th46, "class", "date svelte-1v7h9f9");
    			add_location(th46, file$9, 411, 8, 12657);
    			attr_dev(h514, "class", "svelte-1v7h9f9");
    			add_location(h514, file$9, 413, 10, 12731);
    			attr_dev(th47, "class", "svelte-1v7h9f9");
    			add_location(th47, file$9, 412, 8, 12716);
    			attr_dev(tr31, "class", "item svelte-1v7h9f9");
    			add_location(tr31, file$9, 410, 6, 12631);
    			attr_dev(th48, "class", "date svelte-1v7h9f9");
    			add_location(th48, file$9, 418, 8, 12833);
    			attr_dev(h47, "class", "header svelte-1v7h9f9");
    			add_location(h47, file$9, 420, 10, 12876);
    			attr_dev(th49, "class", "svelte-1v7h9f9");
    			add_location(th49, file$9, 419, 8, 12861);
    			add_location(tr32, file$9, 417, 6, 12820);
    			attr_dev(th50, "class", "date svelte-1v7h9f9");
    			add_location(th50, file$9, 424, 8, 12966);
    			attr_dev(h515, "class", "svelte-1v7h9f9");
    			add_location(h515, file$9, 426, 10, 13009);
    			attr_dev(th51, "class", "svelte-1v7h9f9");
    			add_location(th51, file$9, 425, 8, 12994);
    			attr_dev(tr33, "class", "item svelte-1v7h9f9");
    			add_location(tr33, file$9, 423, 6, 12940);
    			attr_dev(th52, "class", "date svelte-1v7h9f9");
    			add_location(th52, file$9, 430, 8, 13081);
    			attr_dev(h516, "class", "single svelte-1v7h9f9");
    			add_location(h516, file$9, 432, 10, 13139);
    			attr_dev(th53, "class", "svelte-1v7h9f9");
    			add_location(th53, file$9, 431, 8, 13124);
    			add_location(tr34, file$9, 429, 6, 13068);
    			attr_dev(th54, "class", "date svelte-1v7h9f9");
    			add_location(th54, file$9, 436, 8, 13233);
    			attr_dev(h517, "class", "single svelte-1v7h9f9");
    			add_location(h517, file$9, 438, 10, 13291);
    			attr_dev(th55, "class", "svelte-1v7h9f9");
    			add_location(th55, file$9, 437, 8, 13276);
    			add_location(tr35, file$9, 435, 6, 13220);
    			add_location(br15, file$9, 443, 6, 13425);
    			attr_dev(th56, "class", "date svelte-1v7h9f9");
    			add_location(th56, file$9, 445, 8, 13464);
    			attr_dev(h518, "class", "svelte-1v7h9f9");
    			add_location(h518, file$9, 447, 10, 13507);
    			attr_dev(th57, "class", "svelte-1v7h9f9");
    			add_location(th57, file$9, 446, 8, 13492);
    			attr_dev(tr36, "class", "item svelte-1v7h9f9");
    			add_location(tr36, file$9, 444, 6, 13438);
    			attr_dev(th58, "class", "date svelte-1v7h9f9");
    			add_location(th58, file$9, 451, 8, 13570);
    			attr_dev(h519, "class", "single svelte-1v7h9f9");
    			add_location(h519, file$9, 453, 10, 13627);
    			attr_dev(th59, "class", "svelte-1v7h9f9");
    			add_location(th59, file$9, 452, 8, 13612);
    			add_location(tr37, file$9, 450, 6, 13557);
    			attr_dev(th60, "class", "date svelte-1v7h9f9");
    			add_location(th60, file$9, 459, 8, 13784);
    			attr_dev(h520, "class", "single svelte-1v7h9f9");
    			add_location(h520, file$9, 461, 10, 13841);
    			attr_dev(th61, "class", "svelte-1v7h9f9");
    			add_location(th61, file$9, 460, 8, 13826);
    			add_location(tr38, file$9, 458, 6, 13771);
    			attr_dev(th62, "class", "date svelte-1v7h9f9");
    			add_location(th62, file$9, 465, 8, 13935);
    			attr_dev(h521, "class", "single svelte-1v7h9f9");
    			add_location(h521, file$9, 467, 10, 13985);
    			attr_dev(th63, "class", "svelte-1v7h9f9");
    			add_location(th63, file$9, 466, 8, 13970);
    			add_location(tr39, file$9, 464, 6, 13922);
    			attr_dev(th64, "class", "date svelte-1v7h9f9");
    			add_location(th64, file$9, 474, 8, 14172);
    			attr_dev(h522, "class", "single svelte-1v7h9f9");
    			add_location(h522, file$9, 476, 10, 14222);
    			attr_dev(th65, "class", "svelte-1v7h9f9");
    			add_location(th65, file$9, 475, 8, 14207);
    			add_location(tr40, file$9, 473, 6, 14159);
    			attr_dev(th66, "class", "date svelte-1v7h9f9");
    			add_location(th66, file$9, 482, 8, 14374);
    			attr_dev(h523, "class", "single svelte-1v7h9f9");
    			add_location(h523, file$9, 484, 10, 14424);
    			attr_dev(th67, "class", "svelte-1v7h9f9");
    			add_location(th67, file$9, 483, 8, 14409);
    			add_location(tr41, file$9, 481, 6, 14361);
    			attr_dev(th68, "class", "date svelte-1v7h9f9");
    			add_location(th68, file$9, 491, 8, 14597);
    			attr_dev(h48, "class", "header svelte-1v7h9f9");
    			add_location(h48, file$9, 493, 10, 14640);
    			attr_dev(th69, "class", "svelte-1v7h9f9");
    			add_location(th69, file$9, 492, 8, 14625);
    			add_location(tr42, file$9, 490, 6, 14584);
    			attr_dev(th70, "class", "date svelte-1v7h9f9");
    			add_location(th70, file$9, 497, 8, 14715);
    			attr_dev(a11, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			attr_dev(a11, "class", "svelte-1v7h9f9");
    			add_location(a11, file$9, 500, 12, 14803);
    			add_location(i7, file$9, 507, 12, 15121);
    			attr_dev(h524, "class", "single press svelte-1v7h9f9");
    			add_location(h524, file$9, 499, 10, 14765);
    			attr_dev(th71, "class", "svelte-1v7h9f9");
    			add_location(th71, file$9, 498, 8, 14750);
    			add_location(tr43, file$9, 496, 6, 14702);
    			attr_dev(th72, "class", "date svelte-1v7h9f9");
    			add_location(th72, file$9, 512, 8, 15193);
    			attr_dev(a12, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			attr_dev(a12, "class", "svelte-1v7h9f9");
    			add_location(a12, file$9, 515, 12, 15281);
    			add_location(i8, file$9, 521, 12, 15527);
    			attr_dev(h525, "class", "single press svelte-1v7h9f9");
    			add_location(h525, file$9, 514, 10, 15243);
    			attr_dev(th73, "class", "svelte-1v7h9f9");
    			add_location(th73, file$9, 513, 8, 15228);
    			add_location(tr44, file$9, 511, 6, 15180);
    			attr_dev(th74, "class", "date svelte-1v7h9f9");
    			add_location(th74, file$9, 526, 8, 15601);
    			attr_dev(a13, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			attr_dev(a13, "class", "svelte-1v7h9f9");
    			add_location(a13, file$9, 529, 12, 15689);
    			add_location(i9, file$9, 535, 12, 15926);
    			attr_dev(h526, "class", "single press svelte-1v7h9f9");
    			add_location(h526, file$9, 528, 10, 15651);
    			attr_dev(th75, "class", "svelte-1v7h9f9");
    			add_location(th75, file$9, 527, 8, 15636);
    			add_location(tr45, file$9, 525, 6, 15588);
    			attr_dev(th76, "class", "date svelte-1v7h9f9");
    			add_location(th76, file$9, 540, 8, 16010);
    			attr_dev(a14, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			attr_dev(a14, "class", "svelte-1v7h9f9");
    			add_location(a14, file$9, 543, 12, 16098);
    			add_location(i10, file$9, 549, 12, 16324);
    			attr_dev(h527, "class", "single press svelte-1v7h9f9");
    			add_location(h527, file$9, 542, 10, 16060);
    			attr_dev(th77, "class", "svelte-1v7h9f9");
    			add_location(th77, file$9, 541, 8, 16045);
    			add_location(tr46, file$9, 539, 6, 15997);
    			attr_dev(th78, "class", "date svelte-1v7h9f9");
    			add_location(th78, file$9, 554, 8, 16413);
    			attr_dev(a15, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			attr_dev(a15, "class", "svelte-1v7h9f9");
    			add_location(a15, file$9, 557, 12, 16501);
    			add_location(i11, file$9, 563, 12, 16769);
    			attr_dev(h528, "class", "single press svelte-1v7h9f9");
    			add_location(h528, file$9, 556, 10, 16463);
    			attr_dev(th79, "class", "svelte-1v7h9f9");
    			add_location(th79, file$9, 555, 8, 16448);
    			add_location(tr47, file$9, 553, 6, 16400);
    			attr_dev(th80, "class", "date svelte-1v7h9f9");
    			add_location(th80, file$9, 568, 8, 16844);
    			attr_dev(a16, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			attr_dev(a16, "class", "svelte-1v7h9f9");
    			add_location(a16, file$9, 571, 12, 16932);
    			add_location(i12, file$9, 577, 12, 17176);
    			attr_dev(h529, "class", "single press svelte-1v7h9f9");
    			add_location(h529, file$9, 570, 10, 16894);
    			attr_dev(th81, "class", "svelte-1v7h9f9");
    			add_location(th81, file$9, 569, 8, 16879);
    			add_location(tr48, file$9, 567, 6, 16831);
    			attr_dev(th82, "class", "date svelte-1v7h9f9");
    			add_location(th82, file$9, 582, 8, 17257);
    			attr_dev(a17, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			attr_dev(a17, "class", "svelte-1v7h9f9");
    			add_location(a17, file$9, 585, 12, 17345);
    			add_location(i13, file$9, 592, 12, 17632);
    			attr_dev(h530, "class", "single press svelte-1v7h9f9");
    			add_location(h530, file$9, 584, 10, 17307);
    			attr_dev(th83, "class", "svelte-1v7h9f9");
    			add_location(th83, file$9, 583, 8, 17292);
    			add_location(tr49, file$9, 581, 6, 17244);
    			attr_dev(th84, "class", "date svelte-1v7h9f9");
    			add_location(th84, file$9, 598, 8, 17731);
    			attr_dev(h49, "class", "header svelte-1v7h9f9");
    			add_location(h49, file$9, 600, 10, 17774);
    			attr_dev(th85, "class", "svelte-1v7h9f9");
    			add_location(th85, file$9, 599, 8, 17759);
    			add_location(tr50, file$9, 597, 6, 17718);
    			attr_dev(th86, "class", "date svelte-1v7h9f9");
    			add_location(th86, file$9, 604, 8, 17865);
    			attr_dev(h531, "class", "svelte-1v7h9f9");
    			add_location(h531, file$9, 606, 10, 17922);
    			attr_dev(p15, "class", "desc svelte-1v7h9f9");
    			add_location(p15, file$9, 607, 10, 17966);
    			attr_dev(i14, "class", "fab fa-medium svelte-1v7h9f9");
    			add_location(i14, file$9, 616, 16, 18320);
    			attr_dev(button7, "class", "entry-link");
    			add_location(button7, file$9, 615, 14, 18276);
    			attr_dev(a18, "href", "https://cabreraalex.medium.com/creating-reactive-jupyter-widgets-with-svelte-ef2fb580c05");
    			add_location(a18, file$9, 612, 12, 18135);
    			attr_dev(i15, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i15, file$9, 621, 16, 18533);
    			attr_dev(button8, "class", "entry-link");
    			add_location(button8, file$9, 620, 14, 18489);
    			attr_dev(a19, "href", "https://github.com/cabreraalex/widget-svelte-cookiecutter");
    			add_location(a19, file$9, 619, 12, 18406);
    			attr_dev(i16, "class", "fab fa-youtube svelte-1v7h9f9");
    			add_location(i16, file$9, 626, 16, 18726);
    			attr_dev(button9, "class", "entry-link");
    			add_location(button9, file$9, 625, 14, 18682);
    			attr_dev(a20, "href", "https://youtu.be/fnr9XWvjJHw?t=1082");
    			add_location(a20, file$9, 624, 12, 18621);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file$9, 611, 10, 18104);
    			attr_dev(th87, "class", "svelte-1v7h9f9");
    			add_location(th87, file$9, 605, 8, 17907);
    			attr_dev(tr51, "class", "item svelte-1v7h9f9");
    			add_location(tr51, file$9, 603, 6, 17839);
    			attr_dev(tr52, "class", "buffer svelte-1v7h9f9");
    			add_location(tr52, file$9, 632, 6, 18851);
    			attr_dev(th88, "class", "date svelte-1v7h9f9");
    			add_location(th88, file$9, 634, 8, 18905);
    			attr_dev(h532, "class", "svelte-1v7h9f9");
    			add_location(h532, file$9, 636, 10, 18962);
    			attr_dev(p16, "class", "desc svelte-1v7h9f9");
    			add_location(p16, file$9, 637, 10, 19023);
    			attr_dev(i17, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i17, file$9, 644, 16, 19331);
    			attr_dev(button10, "class", "entry-link");
    			add_location(button10, file$9, 643, 14, 19287);
    			attr_dev(a21, "href", "https://covidcast.cmu.edu/");
    			add_location(a21, file$9, 642, 12, 19235);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file$9, 641, 10, 19204);
    			attr_dev(th89, "class", "svelte-1v7h9f9");
    			add_location(th89, file$9, 635, 8, 18947);
    			attr_dev(tr53, "class", "item svelte-1v7h9f9");
    			add_location(tr53, file$9, 633, 6, 18879);
    			attr_dev(tr54, "class", "buffer svelte-1v7h9f9");
    			add_location(tr54, file$9, 650, 6, 19456);
    			attr_dev(th90, "class", "date svelte-1v7h9f9");
    			add_location(th90, file$9, 652, 8, 19510);
    			attr_dev(h533, "class", "svelte-1v7h9f9");
    			add_location(h533, file$9, 654, 10, 19565);
    			attr_dev(h613, "class", "svelte-1v7h9f9");
    			add_location(h613, file$9, 655, 10, 19618);
    			attr_dev(p17, "class", "desc svelte-1v7h9f9");
    			add_location(p17, file$9, 659, 10, 19749);
    			attr_dev(i18, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i18, file$9, 666, 16, 20054);
    			attr_dev(button11, "class", "entry-link");
    			add_location(button11, file$9, 665, 14, 20010);
    			attr_dev(a22, "href", "https://github.com/cabreraalex/private-fair-GAN");
    			add_location(a22, file$9, 664, 12, 19937);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file$9, 663, 10, 19906);
    			attr_dev(th91, "class", "svelte-1v7h9f9");
    			add_location(th91, file$9, 653, 8, 19550);
    			attr_dev(tr55, "class", "item svelte-1v7h9f9");
    			add_location(tr55, file$9, 651, 6, 19484);
    			attr_dev(tr56, "class", "buffer svelte-1v7h9f9");
    			add_location(tr56, file$9, 672, 6, 20179);
    			add_location(br16, file$9, 697, 40, 21043);
    			attr_dev(th92, "class", "date svelte-1v7h9f9");
    			add_location(th92, file$9, 697, 8, 21011);
    			attr_dev(h534, "class", "svelte-1v7h9f9");
    			add_location(h534, file$9, 699, 10, 21089);
    			attr_dev(h614, "class", "svelte-1v7h9f9");
    			add_location(h614, file$9, 700, 10, 21125);
    			attr_dev(p18, "class", "desc svelte-1v7h9f9");
    			add_location(p18, file$9, 701, 10, 21180);
    			attr_dev(i19, "class", "fas fa-rocket svelte-1v7h9f9");
    			add_location(i19, file$9, 710, 16, 21563);
    			attr_dev(button12, "class", "entry-link");
    			add_location(button12, file$9, 709, 14, 21519);
    			attr_dev(a23, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a23, file$9, 706, 12, 21377);
    			attr_dev(i20, "class", "far fa-newspaper svelte-1v7h9f9");
    			add_location(i20, file$9, 717, 16, 21816);
    			attr_dev(button13, "class", "entry-link");
    			add_location(button13, file$9, 716, 14, 21772);
    			attr_dev(a24, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a24, file$9, 713, 12, 21654);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file$9, 705, 10, 21346);
    			attr_dev(th93, "class", "svelte-1v7h9f9");
    			add_location(th93, file$9, 698, 8, 21074);
    			attr_dev(tr57, "class", "item svelte-1v7h9f9");
    			add_location(tr57, file$9, 696, 6, 20985);
    			attr_dev(tr58, "class", "buffer svelte-1v7h9f9");
    			add_location(tr58, file$9, 723, 6, 21951);
    			attr_dev(th94, "class", "date svelte-1v7h9f9");
    			add_location(th94, file$9, 725, 8, 22005);
    			attr_dev(h535, "class", "svelte-1v7h9f9");
    			add_location(h535, file$9, 727, 10, 22062);
    			attr_dev(p19, "class", "desc svelte-1v7h9f9");
    			add_location(p19, file$9, 728, 10, 22095);
    			attr_dev(i21, "class", "fas fa-globe svelte-1v7h9f9");
    			add_location(i21, file$9, 735, 16, 22387);
    			attr_dev(button14, "class", "entry-link");
    			add_location(button14, file$9, 734, 14, 22343);
    			attr_dev(a25, "href", "http://ctfs.github.io/resources/");
    			add_location(a25, file$9, 733, 12, 22285);
    			attr_dev(i22, "class", "fab fa-github svelte-1v7h9f9");
    			add_location(i22, file$9, 740, 16, 22578);
    			attr_dev(button15, "class", "entry-link");
    			add_location(button15, file$9, 739, 14, 22534);
    			attr_dev(a26, "href", "https://github.com/ctfs/resources");
    			add_location(a26, file$9, 738, 12, 22475);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file$9, 732, 10, 22254);
    			attr_dev(th95, "class", "svelte-1v7h9f9");
    			add_location(th95, file$9, 726, 8, 22047);
    			attr_dev(tr59, "class", "item svelte-1v7h9f9");
    			add_location(tr59, file$9, 724, 6, 21979);
    			attr_dev(th96, "class", "date svelte-1v7h9f9");
    			add_location(th96, file$9, 821, 8, 24922);
    			attr_dev(h410, "class", "header svelte-1v7h9f9");
    			add_location(h410, file$9, 823, 10, 24965);
    			attr_dev(th97, "class", "svelte-1v7h9f9");
    			add_location(th97, file$9, 822, 8, 24950);
    			add_location(tr60, file$9, 820, 6, 24909);
    			attr_dev(th98, "class", "date svelte-1v7h9f9");
    			add_location(th98, file$9, 827, 8, 25064);
    			attr_dev(h536, "class", "single svelte-1v7h9f9");
    			add_location(h536, file$9, 829, 10, 25113);
    			attr_dev(h537, "class", "single svelte-1v7h9f9");
    			add_location(h537, file$9, 830, 10, 25178);
    			attr_dev(h538, "class", "single svelte-1v7h9f9");
    			add_location(h538, file$9, 832, 12, 25329);
    			attr_dev(a27, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a27, file$9, 831, 10, 25248);
    			attr_dev(th99, "class", "svelte-1v7h9f9");
    			add_location(th99, file$9, 828, 8, 25098);
    			attr_dev(tr61, "class", "item svelte-1v7h9f9");
    			add_location(tr61, file$9, 826, 6, 25038);
    			attr_dev(th100, "class", "date svelte-1v7h9f9");
    			add_location(th100, file$9, 837, 8, 25451);
    			attr_dev(h539, "class", "single svelte-1v7h9f9");
    			add_location(h539, file$9, 840, 12, 25578);
    			attr_dev(a28, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a28, file$9, 839, 10, 25501);
    			attr_dev(h540, "class", "single svelte-1v7h9f9");
    			add_location(h540, file$9, 843, 12, 25710);
    			attr_dev(a29, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a29, file$9, 842, 10, 25641);
    			attr_dev(h541, "class", "single svelte-1v7h9f9");
    			add_location(h541, file$9, 846, 12, 25862);
    			attr_dev(a30, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a30, file$9, 845, 10, 25785);
    			attr_dev(h542, "class", "single svelte-1v7h9f9");
    			add_location(h542, file$9, 849, 12, 25982);
    			attr_dev(a31, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a31, file$9, 848, 10, 25928);
    			attr_dev(h543, "class", "single svelte-1v7h9f9");
    			add_location(h543, file$9, 851, 10, 26051);
    			attr_dev(th101, "class", "svelte-1v7h9f9");
    			add_location(th101, file$9, 838, 8, 25486);
    			attr_dev(tr62, "class", "item svelte-1v7h9f9");
    			add_location(tr62, file$9, 836, 6, 25425);
    			attr_dev(tr63, "class", "buffer svelte-1v7h9f9");
    			add_location(tr63, file$9, 909, 6, 28122);
    			attr_dev(table, "class", "svelte-1v7h9f9");
    			add_location(table, file$9, 17, 4, 466);
    			attr_dev(main, "class", "svelte-1v7h9f9");
    			add_location(main, file$9, 16, 2, 455);
    			attr_dev(div12, "id", "container");
    			attr_dev(div12, "class", "svelte-1v7h9f9");
    			add_location(div12, file$9, 15, 0, 432);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div12, anchor);
    			append_dev(div12, main);
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
    			append_dev(table, t83);
    			append_dev(table, tr12);
    			append_dev(table, t84);
    			append_dev(table, tr13);
    			append_dev(tr13, th18);
    			append_dev(th18, t85);
    			append_dev(th18, br6);
    			append_dev(th18, t86);
    			append_dev(tr13, t87);
    			append_dev(tr13, th19);
    			append_dev(th19, h55);
    			append_dev(th19, t89);
    			append_dev(th19, h66);
    			append_dev(th19, t91);
    			append_dev(th19, p6);
    			append_dev(table, t93);
    			append_dev(table, tr14);
    			append_dev(tr14, th20);
    			append_dev(tr14, t94);
    			append_dev(tr14, th21);
    			append_dev(th21, h42);
    			append_dev(table, t96);
    			append_dev(table, tr15);
    			append_dev(tr15, th22);
    			append_dev(tr15, t98);
    			append_dev(tr15, th23);
    			append_dev(th23, h56);
    			append_dev(th23, t100);
    			append_dev(th23, p7);
    			append_dev(th23, t102);
    			append_dev(th23, div3);
    			append_dev(div3, a7);
    			append_dev(a7, button3);
    			append_dev(button3, i3);
    			append_dev(button3, t103);
    			append_dev(table, t104);
    			append_dev(table, tr16);
    			append_dev(table, t105);
    			append_dev(table, tr17);
    			append_dev(tr17, th24);
    			append_dev(tr17, t107);
    			append_dev(tr17, th25);
    			append_dev(th25, h57);
    			append_dev(th25, t109);
    			append_dev(th25, p8);
    			append_dev(th25, t111);
    			append_dev(th25, div4);
    			append_dev(div4, a8);
    			append_dev(a8, button4);
    			append_dev(button4, i4);
    			append_dev(button4, t112);
    			append_dev(table, t113);
    			append_dev(table, tr18);
    			append_dev(table, t114);
    			append_dev(table, tr19);
    			append_dev(tr19, th26);
    			append_dev(th26, t115);
    			append_dev(th26, br7);
    			append_dev(th26, t116);
    			append_dev(tr19, t117);
    			append_dev(tr19, th27);
    			append_dev(th27, h58);
    			append_dev(th27, t119);
    			append_dev(th27, h67);
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
    			append_dev(tr21, t128);
    			append_dev(tr21, th29);
    			append_dev(th29, h59);
    			append_dev(th29, t130);
    			append_dev(th29, h68);
    			append_dev(th29, t132);
    			append_dev(th29, p10);
    			append_dev(th29, t134);
    			append_dev(th29, div6);
    			append_dev(div6, a10);
    			append_dev(a10, button6);
    			append_dev(button6, i6);
    			append_dev(button6, t135);
    			append_dev(table, t136);
    			append_dev(table, tr22);
    			append_dev(tr22, th30);
    			append_dev(tr22, t137);
    			append_dev(tr22, th31);
    			append_dev(th31, h43);
    			append_dev(table, t139);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(table, null);
    			}

    			append_dev(table, t140);
    			append_dev(table, tr23);
    			append_dev(tr23, th32);
    			append_dev(tr23, t141);
    			append_dev(tr23, th33);
    			append_dev(th33, h44);
    			append_dev(table, t143);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append_dev(table, t144);
    			append_dev(table, tr24);
    			append_dev(tr24, th34);
    			append_dev(tr24, t145);
    			append_dev(tr24, th35);
    			append_dev(th35, h45);
    			append_dev(table, t147);
    			append_dev(table, tr25);
    			append_dev(tr25, th36);
    			append_dev(th36, t148);
    			append_dev(th36, br8);
    			append_dev(th36, t149);
    			append_dev(th36, br9);
    			append_dev(th36, t150);
    			append_dev(tr25, t151);
    			append_dev(tr25, th37);
    			append_dev(th37, h510);
    			append_dev(th37, t153);
    			append_dev(th37, h69);
    			append_dev(th37, t155);
    			append_dev(th37, p11);
    			append_dev(table, t157);
    			append_dev(table, tr26);
    			append_dev(table, t158);
    			append_dev(table, tr27);
    			append_dev(tr27, th38);
    			append_dev(tr27, t160);
    			append_dev(tr27, th39);
    			append_dev(th39, h511);
    			append_dev(th39, t162);
    			append_dev(th39, h610);
    			append_dev(th39, t164);
    			append_dev(th39, p12);
    			append_dev(table, t166);
    			append_dev(table, tr28);
    			append_dev(tr28, th40);
    			append_dev(tr28, t167);
    			append_dev(tr28, th41);
    			append_dev(th41, h46);
    			append_dev(table, t169);
    			append_dev(table, tr29);
    			append_dev(tr29, th42);
    			append_dev(th42, t170);
    			append_dev(th42, br10);
    			append_dev(th42, t171);
    			append_dev(tr29, t172);
    			append_dev(tr29, th43);
    			append_dev(th43, h512);
    			append_dev(th43, t174);
    			append_dev(th43, h611);
    			append_dev(th43, t176);
    			append_dev(th43, p13);
    			append_dev(table, t178);
    			append_dev(table, br11);
    			append_dev(table, t179);
    			append_dev(table, tr30);
    			append_dev(tr30, th44);
    			append_dev(th44, t180);
    			append_dev(th44, br12);
    			append_dev(th44, t181);
    			append_dev(tr30, t182);
    			append_dev(tr30, th45);
    			append_dev(th45, h513);
    			append_dev(th45, t184);
    			append_dev(th45, h612);
    			append_dev(th45, t186);
    			append_dev(th45, p14);
    			append_dev(table, t188);
    			append_dev(table, br13);
    			append_dev(table, t189);
    			append_dev(table, tr31);
    			append_dev(tr31, th46);
    			append_dev(th46, t190);
    			append_dev(th46, br14);
    			append_dev(th46, t191);
    			append_dev(tr31, t192);
    			append_dev(tr31, th47);
    			append_dev(th47, h514);
    			append_dev(table, t194);
    			append_dev(table, tr32);
    			append_dev(tr32, th48);
    			append_dev(tr32, t195);
    			append_dev(tr32, th49);
    			append_dev(th49, h47);
    			append_dev(table, t197);
    			append_dev(table, tr33);
    			append_dev(tr33, th50);
    			append_dev(tr33, t198);
    			append_dev(tr33, th51);
    			append_dev(th51, h515);
    			append_dev(table, t200);
    			append_dev(table, tr34);
    			append_dev(tr34, th52);
    			append_dev(tr34, t202);
    			append_dev(tr34, th53);
    			append_dev(th53, h516);
    			append_dev(table, t204);
    			append_dev(table, tr35);
    			append_dev(tr35, th54);
    			append_dev(tr35, t206);
    			append_dev(tr35, th55);
    			append_dev(th55, h517);
    			append_dev(table, t208);
    			append_dev(table, br15);
    			append_dev(table, t209);
    			append_dev(table, tr36);
    			append_dev(tr36, th56);
    			append_dev(tr36, t210);
    			append_dev(tr36, th57);
    			append_dev(th57, h518);
    			append_dev(table, t212);
    			append_dev(table, tr37);
    			append_dev(tr37, th58);
    			append_dev(tr37, t214);
    			append_dev(tr37, th59);
    			append_dev(th59, h519);
    			append_dev(table, t216);
    			append_dev(table, tr38);
    			append_dev(tr38, th60);
    			append_dev(tr38, t218);
    			append_dev(tr38, th61);
    			append_dev(th61, h520);
    			append_dev(table, t220);
    			append_dev(table, tr39);
    			append_dev(tr39, th62);
    			append_dev(tr39, t222);
    			append_dev(tr39, th63);
    			append_dev(th63, h521);
    			append_dev(table, t224);
    			append_dev(table, tr40);
    			append_dev(tr40, th64);
    			append_dev(tr40, t226);
    			append_dev(tr40, th65);
    			append_dev(th65, h522);
    			append_dev(table, t228);
    			append_dev(table, tr41);
    			append_dev(tr41, th66);
    			append_dev(tr41, t230);
    			append_dev(tr41, th67);
    			append_dev(th67, h523);
    			append_dev(table, t232);
    			append_dev(table, tr42);
    			append_dev(tr42, th68);
    			append_dev(tr42, t233);
    			append_dev(tr42, th69);
    			append_dev(th69, h48);
    			append_dev(table, t235);
    			append_dev(table, tr43);
    			append_dev(tr43, th70);
    			append_dev(tr43, t237);
    			append_dev(tr43, th71);
    			append_dev(th71, h524);
    			append_dev(h524, a11);
    			append_dev(h524, t239);
    			append_dev(h524, i7);
    			append_dev(table, t241);
    			append_dev(table, tr44);
    			append_dev(tr44, th72);
    			append_dev(tr44, t243);
    			append_dev(tr44, th73);
    			append_dev(th73, h525);
    			append_dev(h525, a12);
    			append_dev(h525, t245);
    			append_dev(h525, i8);
    			append_dev(table, t247);
    			append_dev(table, tr45);
    			append_dev(tr45, th74);
    			append_dev(tr45, t249);
    			append_dev(tr45, th75);
    			append_dev(th75, h526);
    			append_dev(h526, a13);
    			append_dev(h526, t251);
    			append_dev(h526, i9);
    			append_dev(table, t253);
    			append_dev(table, tr46);
    			append_dev(tr46, th76);
    			append_dev(tr46, t255);
    			append_dev(tr46, th77);
    			append_dev(th77, h527);
    			append_dev(h527, a14);
    			append_dev(h527, t257);
    			append_dev(h527, i10);
    			append_dev(table, t259);
    			append_dev(table, tr47);
    			append_dev(tr47, th78);
    			append_dev(tr47, t261);
    			append_dev(tr47, th79);
    			append_dev(th79, h528);
    			append_dev(h528, a15);
    			append_dev(h528, t263);
    			append_dev(h528, i11);
    			append_dev(table, t265);
    			append_dev(table, tr48);
    			append_dev(tr48, th80);
    			append_dev(tr48, t267);
    			append_dev(tr48, th81);
    			append_dev(th81, h529);
    			append_dev(h529, a16);
    			append_dev(h529, t269);
    			append_dev(h529, i12);
    			append_dev(table, t271);
    			append_dev(table, tr49);
    			append_dev(tr49, th82);
    			append_dev(tr49, t273);
    			append_dev(tr49, th83);
    			append_dev(th83, h530);
    			append_dev(h530, a17);
    			append_dev(h530, t275);
    			append_dev(h530, i13);
    			append_dev(table, t277);
    			append_dev(table, tr50);
    			append_dev(tr50, th84);
    			append_dev(tr50, t278);
    			append_dev(tr50, th85);
    			append_dev(th85, h49);
    			append_dev(table, t280);
    			append_dev(table, tr51);
    			append_dev(tr51, th86);
    			append_dev(tr51, t282);
    			append_dev(tr51, th87);
    			append_dev(th87, h531);
    			append_dev(th87, t284);
    			append_dev(th87, p15);
    			append_dev(th87, t286);
    			append_dev(th87, div7);
    			append_dev(div7, a18);
    			append_dev(a18, button7);
    			append_dev(button7, i14);
    			append_dev(button7, t287);
    			append_dev(div7, t288);
    			append_dev(div7, a19);
    			append_dev(a19, button8);
    			append_dev(button8, i15);
    			append_dev(button8, t289);
    			append_dev(div7, t290);
    			append_dev(div7, a20);
    			append_dev(a20, button9);
    			append_dev(button9, i16);
    			append_dev(button9, t291);
    			append_dev(table, t292);
    			append_dev(table, tr52);
    			append_dev(table, t293);
    			append_dev(table, tr53);
    			append_dev(tr53, th88);
    			append_dev(tr53, t295);
    			append_dev(tr53, th89);
    			append_dev(th89, h532);
    			append_dev(th89, t297);
    			append_dev(th89, p16);
    			append_dev(th89, t299);
    			append_dev(th89, div8);
    			append_dev(div8, a21);
    			append_dev(a21, button10);
    			append_dev(button10, i17);
    			append_dev(button10, t300);
    			append_dev(table, t301);
    			append_dev(table, tr54);
    			append_dev(table, t302);
    			append_dev(table, tr55);
    			append_dev(tr55, th90);
    			append_dev(tr55, t304);
    			append_dev(tr55, th91);
    			append_dev(th91, h533);
    			append_dev(th91, t306);
    			append_dev(th91, h613);
    			append_dev(th91, t308);
    			append_dev(th91, p17);
    			append_dev(th91, t310);
    			append_dev(th91, div9);
    			append_dev(div9, a22);
    			append_dev(a22, button11);
    			append_dev(button11, i18);
    			append_dev(button11, t311);
    			append_dev(table, t312);
    			append_dev(table, tr56);
    			append_dev(table, t313);
    			append_dev(table, tr57);
    			append_dev(tr57, th92);
    			append_dev(th92, t314);
    			append_dev(th92, br16);
    			append_dev(th92, t315);
    			append_dev(tr57, t316);
    			append_dev(tr57, th93);
    			append_dev(th93, h534);
    			append_dev(th93, t318);
    			append_dev(th93, h614);
    			append_dev(th93, t320);
    			append_dev(th93, p18);
    			append_dev(th93, t322);
    			append_dev(th93, div10);
    			append_dev(div10, a23);
    			append_dev(a23, button12);
    			append_dev(button12, i19);
    			append_dev(button12, t323);
    			append_dev(div10, t324);
    			append_dev(div10, a24);
    			append_dev(a24, button13);
    			append_dev(button13, i20);
    			append_dev(button13, t325);
    			append_dev(table, t326);
    			append_dev(table, tr58);
    			append_dev(table, t327);
    			append_dev(table, tr59);
    			append_dev(tr59, th94);
    			append_dev(tr59, t329);
    			append_dev(tr59, th95);
    			append_dev(th95, h535);
    			append_dev(th95, t331);
    			append_dev(th95, p19);
    			append_dev(th95, t333);
    			append_dev(th95, div11);
    			append_dev(div11, a25);
    			append_dev(a25, button14);
    			append_dev(button14, i21);
    			append_dev(button14, t334);
    			append_dev(div11, t335);
    			append_dev(div11, a26);
    			append_dev(a26, button15);
    			append_dev(button15, i22);
    			append_dev(button15, t336);
    			append_dev(table, t337);
    			append_dev(table, tr60);
    			append_dev(tr60, th96);
    			append_dev(tr60, t338);
    			append_dev(tr60, th97);
    			append_dev(th97, h410);
    			append_dev(table, t340);
    			append_dev(table, tr61);
    			append_dev(tr61, th98);
    			append_dev(tr61, t342);
    			append_dev(tr61, th99);
    			append_dev(th99, h536);
    			append_dev(th99, t344);
    			append_dev(th99, h537);
    			append_dev(th99, t346);
    			append_dev(th99, a27);
    			append_dev(a27, h538);
    			append_dev(table, t348);
    			append_dev(table, tr62);
    			append_dev(tr62, th100);
    			append_dev(tr62, t350);
    			append_dev(tr62, th101);
    			append_dev(th101, a28);
    			append_dev(a28, h539);
    			append_dev(th101, t352);
    			append_dev(th101, a29);
    			append_dev(a29, h540);
    			append_dev(th101, t354);
    			append_dev(th101, a30);
    			append_dev(a30, h541);
    			append_dev(th101, t356);
    			append_dev(th101, a31);
    			append_dev(a31, h542);
    			append_dev(th101, t358);
    			append_dev(th101, h543);
    			append_dev(table, t360);
    			append_dev(table, tr63);
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
    						each_blocks_1[i].m(table, t140);
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
    						each_blocks[i].m(table, t144);
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
    			if (detaching) detach_dev(div12);
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
