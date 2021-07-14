
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
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
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
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
    function tick() {
        schedule_update();
        return resolved_promise;
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
            set_current_component(null);
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

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
                start_hydrating();
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
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
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
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * @typedef {Object} WrappedComponent Object returned by the `wrap` method
     * @property {SvelteComponent} component - Component to load (this is always asynchronous)
     * @property {RoutePrecondition[]} [conditions] - Route pre-conditions to validate
     * @property {Object} [props] - Optional dictionary of static props
     * @property {Object} [userData] - Optional user data dictionary
     * @property {bool} _sveltesparouter - Internal flag; always set to true
     */

    /**
     * @callback AsyncSvelteComponent
     * @returns {Promise<SvelteComponent>} Returns a Promise that resolves with a Svelte component
     */

    /**
     * @callback RoutePrecondition
     * @param {RouteDetail} detail - Route detail object
     * @returns {boolean|Promise<boolean>} If the callback returns a false-y value, it's interpreted as the precondition failed, so it aborts loading the component (and won't process other pre-condition callbacks)
     */

    /**
     * @typedef {Object} WrapOptions Options object for the call to `wrap`
     * @property {SvelteComponent} [component] - Svelte component to load (this is incompatible with `asyncComponent`)
     * @property {AsyncSvelteComponent} [asyncComponent] - Function that returns a Promise that fulfills with a Svelte component (e.g. `{asyncComponent: () => import('Foo.svelte')}`)
     * @property {SvelteComponent} [loadingComponent] - Svelte component to be displayed while the async route is loading (as a placeholder); when unset or false-y, no component is shown while component
     * @property {object} [loadingParams] - Optional dictionary passed to the `loadingComponent` component as params (for an exported prop called `params`)
     * @property {object} [userData] - Optional object that will be passed to events such as `routeLoading`, `routeLoaded`, `conditionsFailed`
     * @property {object} [props] - Optional key-value dictionary of static props that will be passed to the component. The props are expanded with {...props}, so the key in the dictionary becomes the name of the prop.
     * @property {RoutePrecondition[]|RoutePrecondition} [conditions] - Route pre-conditions to add, which will be executed in order
     */

    /**
     * Wraps a component to enable multiple capabilities:
     * 1. Using dynamically-imported component, with (e.g. `{asyncComponent: () => import('Foo.svelte')}`), which also allows bundlers to do code-splitting.
     * 2. Adding route pre-conditions (e.g. `{conditions: [...]}`)
     * 3. Adding static props that are passed to the component
     * 4. Adding custom userData, which is passed to route events (e.g. route loaded events) or to route pre-conditions (e.g. `{userData: {foo: 'bar}}`)
     * 
     * @param {WrapOptions} args - Arguments object
     * @returns {WrappedComponent} Wrapped component
     */
    function wrap$1(args) {
        if (!args) {
            throw Error('Parameter args is required')
        }

        // We need to have one and only one of component and asyncComponent
        // This does a "XNOR"
        if (!args.component == !args.asyncComponent) {
            throw Error('One and only one of component and asyncComponent is required')
        }

        // If the component is not async, wrap it into a function returning a Promise
        if (args.component) {
            args.asyncComponent = () => Promise.resolve(args.component);
        }

        // Parameter asyncComponent and each item of conditions must be functions
        if (typeof args.asyncComponent != 'function') {
            throw Error('Parameter asyncComponent must be a function')
        }
        if (args.conditions) {
            // Ensure it's an array
            if (!Array.isArray(args.conditions)) {
                args.conditions = [args.conditions];
            }
            for (let i = 0; i < args.conditions.length; i++) {
                if (!args.conditions[i] || typeof args.conditions[i] != 'function') {
                    throw Error('Invalid parameter conditions[' + i + ']')
                }
            }
        }

        // Check if we have a placeholder component
        if (args.loadingComponent) {
            args.asyncComponent.loading = args.loadingComponent;
            args.asyncComponent.loadingParams = args.loadingParams || undefined;
        }

        // Returns an object that contains all the functions to execute too
        // The _sveltesparouter flag is to confirm the object was created by this router
        const obj = {
            component: args.asyncComponent,
            userData: args.userData,
            conditions: (args.conditions && args.conditions.length) ? args.conditions : undefined,
            props: (args.props && Object.keys(args.props).length) ? args.props : {},
            _sveltesparouter: true
        };

        return obj
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
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

    function parse(str, loose) {
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

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.38.3 */

    const { Error: Error_1, Object: Object_1, console: console_1 } = globals;

    // (251:0) {:else}
    function create_else_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

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
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
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
    		id: create_else_block.name,
    		type: "else",
    		source: "(251:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (244:0) {#if componentParams}
    function create_if_block$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

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
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
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
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(244:0) {#if componentParams}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function wrap(component, userData, ...conditions) {
    	// Use the new wrap method and show a deprecation warning
    	// eslint-disable-next-line no-console
    	console.warn("Method `wrap` from `svelte-spa-router` is deprecated and will be removed in a future version. Please use `svelte-spa-router/wrap` instead. See http://bit.ly/svelte-spa-router-upgrading");

    	return wrap$1({ component, userData, conditions });
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

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

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
    const params = writable(undefined);

    async function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	// Note: this will include scroll state in history even when restoreScrollState is false
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	window.location.hash = (location.charAt(0) == "#" ? "" : "#") + location;
    }

    async function pop() {
    	// Execute this code when the current call stack is complete
    	await tick();

    	window.history.back();
    }

    async function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != "/" && location.indexOf("#/") !== 0) {
    		throw Error("Invalid parameter location");
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	const dest = (location.charAt(0) == "#" ? "" : "#") + location;

    	try {
    		const newState = { ...history.state };
    		delete newState["__svelte_spa_router_scrollX"];
    		delete newState["__svelte_spa_router_scrollY"];
    		window.history.replaceState(newState, undefined, dest);
    	} catch(e) {
    		// eslint-disable-next-line no-console
    		console.warn("Caught exception while replacing the current page. If you're running this in the Svelte REPL, please note that the `replace` method might not work in this environment.");
    	}

    	// The method above doesn't trigger the hashchange event, so let's do that manually
    	window.dispatchEvent(new Event("hashchange"));
    }

    function link(node, opts) {
    	opts = linkOpts(opts);

    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != "a") {
    		throw Error("Action \"link\" can only be used with <a> tags");
    	}

    	updateLink(node, opts);

    	return {
    		update(updated) {
    			updated = linkOpts(updated);
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, opts) {
    	let href = opts.href || node.getAttribute("href");

    	// Destination must start with '/' or '#/'
    	if (href && href.charAt(0) == "/") {
    		// Add # to the href attribute
    		href = "#" + href;
    	} else if (!href || href.length < 2 || href.slice(0, 2) != "#/") {
    		throw Error("Invalid value for \"href\" attribute: " + href);
    	}

    	node.setAttribute("href", href);

    	node.addEventListener("click", event => {
    		// Prevent default anchor onclick behaviour
    		event.preventDefault();

    		if (!opts.disabled) {
    			scrollstateHistoryHandler(event.currentTarget.getAttribute("href"));
    		}
    	});
    }

    // Internal function that ensures the argument of the link action is always an object
    function linkOpts(val) {
    	if (val && typeof val == "string") {
    		return { href: val };
    	} else {
    		return val || {};
    	}
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {string} href - Destination
     */
    function scrollstateHistoryHandler(href) {
    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Router", slots, []);
    	let { routes = {} } = $$props;
    	let { prefix = "" } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != "function" && (typeof component != "object" || component._sveltesparouter !== true)) {
    				throw Error("Invalid component object");
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == "string" && (path.length < 1 || path.charAt(0) != "/" && path.charAt(0) != "*") || typeof path == "object" && !(path instanceof RegExp)) {
    				throw Error("Invalid value for \"path\" argument - strings must start with / or *");
    			}

    			const { pattern, keys } = parse(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == "object" && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
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
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == "string") {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || "/";
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || "/";
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
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
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || "") || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {boolean} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	let popStateChanged = null;

    	if (restoreScrollState) {
    		popStateChanged = event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.__svelte_spa_router_scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		};

    		// This is removed in the destroy() invocation below
    		window.addEventListener("popstate", popStateChanged);

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.__svelte_spa_router_scrollX, previousScrollState.__svelte_spa_router_scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	const unsubscribeLoc = loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData,
    				params: match && typeof match == "object" && Object.keys(match).length
    				? match
    				: null
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick("conditionsFailed", detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoading", Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick("routeLoaded", Object.assign({}, detail, {
    						component,
    						name: component.name,
    						params: componentParams
    					}));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == "object" && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoaded", Object.assign({}, detail, {
    				component,
    				name: component.name,
    				params: componentParams
    			})).then(() => {
    				params.set(componentParams);
    			});

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    		params.set(undefined);
    	});

    	onDestroy(() => {
    		unsubscribeLoc();
    		popStateChanged && window.removeEventListener("popstate", popStateChanged);
    	});

    	const writable_props = ["routes", "prefix", "restoreScrollState"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	function routeEvent_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ("routes" in $$props) $$invalidate(3, routes = $$props.routes);
    		if ("prefix" in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ("restoreScrollState" in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		writable,
    		derived,
    		tick,
    		_wrap: wrap$1,
    		wrap,
    		getLocation,
    		loc,
    		location,
    		querystring,
    		params,
    		push,
    		pop,
    		replace,
    		link,
    		updateLink,
    		linkOpts,
    		scrollstateHistoryHandler,
    		onDestroy,
    		createEventDispatcher,
    		afterUpdate,
    		parse,
    		routes,
    		prefix,
    		restoreScrollState,
    		RouteItem,
    		routesList,
    		component,
    		componentParams,
    		props,
    		dispatch,
    		dispatchNextTick,
    		previousScrollState,
    		popStateChanged,
    		lastLoc,
    		componentObj,
    		unsubscribeLoc
    	});

    	$$self.$inject_state = $$props => {
    		if ("routes" in $$props) $$invalidate(3, routes = $$props.routes);
    		if ("prefix" in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ("restoreScrollState" in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    		if ("component" in $$props) $$invalidate(0, component = $$props.component);
    		if ("componentParams" in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    		if ("props" in $$props) $$invalidate(2, props = $$props.props);
    		if ("previousScrollState" in $$props) previousScrollState = $$props.previousScrollState;
    		if ("popStateChanged" in $$props) popStateChanged = $$props.popStateChanged;
    		if ("lastLoc" in $$props) lastLoc = $$props.lastLoc;
    		if ("componentObj" in $$props) componentObj = $$props.componentObj;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? "manual" : "auto";
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get routes() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prefix() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prefix(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScrollState() {
    		throw new Error_1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScrollState(value) {
    		throw new Error_1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Social.svelte generated by Svelte v3.38.3 */

    const file$9 = "src/components/Social.svelte";

    // (6:2) {#if !home}
    function create_if_block_1$1(ctx) {
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
    			add_location(i, file$9, 7, 10, 120);
    			attr_dev(h3, "class", "svelte-1t8evy3");
    			add_location(h3, file$9, 7, 6, 116);
    			attr_dev(a, "href", "https://cabreraalex.com");
    			add_location(a, file$9, 6, 4, 75);
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(6:2) {#if !home}",
    		ctx
    	});

    	return block;
    }

    // (14:2) {#if home}
    function create_if_block$1(ctx) {
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
    			add_location(i0, file$9, 15, 10, 374);
    			attr_dev(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file$9, 15, 6, 370);
    			attr_dev(a0, "href", "https://twitter.com/a_a_cabrera");
    			add_location(a0, file$9, 14, 4, 321);
    			attr_dev(i1, "class", "fab fa-medium-m");
    			add_location(i1, file$9, 18, 10, 511);
    			attr_dev(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file$9, 18, 6, 507);
    			attr_dev(a1, "href", "https://cabreraalex.medium.com/");
    			add_location(a1, file$9, 17, 4, 458);
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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(14:2) {#if home}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
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
    	let if_block0 = !/*home*/ ctx[0] && create_if_block_1$1(ctx);
    	let if_block1 = /*home*/ ctx[0] && create_if_block$1(ctx);

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
    			add_location(i0, file$9, 11, 8, 234);
    			attr_dev(h30, "class", "svelte-1t8evy3");
    			add_location(h30, file$9, 11, 4, 230);
    			attr_dev(a0, "href", "mailto:cabrera@cmu.edu");
    			add_location(a0, file$9, 10, 2, 192);
    			attr_dev(i1, "class", "fab fa-github");
    			add_location(i1, file$9, 22, 8, 632);
    			attr_dev(h31, "class", "svelte-1t8evy3");
    			add_location(h31, file$9, 22, 4, 628);
    			attr_dev(a1, "href", "https://github.com/cabreraalex");
    			add_location(a1, file$9, 21, 2, 582);
    			attr_dev(i2, "class", "fas fa-graduation-cap");
    			add_location(i2, file$9, 25, 8, 773);
    			attr_dev(h32, "class", "svelte-1t8evy3");
    			add_location(h32, file$9, 25, 4, 769);
    			attr_dev(a2, "href", "https://scholar.google.com/citations?user=r89SDm0AAAAJ&hl=en");
    			add_location(a2, file$9, 24, 2, 693);
    			attr_dev(div, "id", "social");
    			add_location(div, file$9, 4, 0, 39);
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
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*home*/ ctx[0]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block$1(ctx);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Social", slots, []);
    	let { home } = $$props;
    	const writable_props = ["home"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Social> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("home" in $$props) $$invalidate(0, home = $$props.home);
    	};

    	$$self.$capture_state = () => ({ home });

    	$$self.$inject_state = $$props => {
    		if ("home" in $$props) $$invalidate(0, home = $$props.home);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [home];
    }

    class Social extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { home: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*home*/ ctx[0] === undefined && !("home" in props)) {
    			console.warn("<Social> was created without expected prop 'home'");
    		}
    	}

    	get home() {
    		throw new Error("<Social>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set home(value) {
    		throw new Error("<Social>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.38.3 */
    const file$8 = "src/components/Sidebar.svelte";

    function create_fragment$9(ctx) {
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
    			add_location(img, file$8, 27, 6, 435);
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$8, 26, 4, 416);
    			attr_dev(span0, "class", "color svelte-ydo7v3");
    			add_location(span0, file$8, 30, 6, 530);
    			add_location(br0, file$8, 31, 6, 575);
    			attr_dev(span1, "class", "color red svelte-ydo7v3");
    			add_location(span1, file$8, 32, 6, 588);
    			attr_dev(span2, "class", "color svelte-ydo7v3");
    			add_location(span2, file$8, 33, 6, 630);
    			add_location(br1, file$8, 34, 6, 669);
    			attr_dev(span3, "class", "color red svelte-ydo7v3");
    			add_location(span3, file$8, 35, 6, 682);
    			attr_dev(h1, "id", "name");
    			attr_dev(h1, "class", "svelte-ydo7v3");
    			add_location(h1, file$8, 29, 4, 509);
    			attr_dev(button0, "class", "cv");
    			add_location(button0, file$8, 38, 21, 779);
    			attr_dev(a1, "href", "/#/cv");
    			add_location(a1, file$8, 38, 4, 762);
    			attr_dev(button1, "class", "cv");
    			add_location(button1, file$8, 39, 23, 844);
    			attr_dev(a2, "href", "/cv.pdf");
    			add_location(a2, file$8, 39, 4, 825);
    			attr_dev(div0, "id", "padded-sidebar");
    			attr_dev(div0, "class", "svelte-ydo7v3");
    			add_location(div0, file$8, 25, 2, 386);
    			attr_dev(div1, "id", "sidebar");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-4");
    			add_location(div1, file$8, 24, 0, 334);
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Sidebar", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Social });
    	return [];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.38.3 */

    const file$7 = "src/components/Footer.svelte";

    function create_fragment$8(ctx) {
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
    			add_location(a, file$7, 3, 4, 100);
    			attr_dev(p, "id", "copyright");
    			add_location(p, file$7, 1, 2, 23);
    			attr_dev(div, "class", "footer svelte-qsjnhq");
    			add_location(div, file$7, 0, 0, 0);
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Footer", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$8.name
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

    /* src/News.svelte generated by Svelte v3.38.3 */
    const file$6 = "src/News.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (23:6) {#each news as n}
    function create_each_block$3(ctx) {
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
    			add_location(p0, file$6, 24, 10, 548);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$6, 25, 10, 610);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$6, 23, 8, 507);
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
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(23:6) {#each news as n}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
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
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
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
    			add_location(h1, file$6, 20, 6, 448);
    			add_location(hr, file$6, 21, 6, 468);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$6, 19, 4, 416);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$6, 18, 2, 362);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$6, 16, 0, 305);
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
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("News", slots, []);
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<News> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Sidebar, Footer, news, onMount });
    	return [];
    }

    class News extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "News",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    var pubs = [
      {
        title:
          "Discovering and Validating AI Errors With Crowdsourced Failure Reports",
        desc:
          "We introduce failure reports, end-user descriptions of how an AI system failed, and show how they can be used to detect systematic AI errors. We also designed and implemented Deblinder, a visual analytics system data scientists can use to explore and validate patterns from failure reports. In a user study, we found that data scientists found consistent failures and that collecting data from those failure areas significantly increased model performance.",
        id: "deblinder",
        teaser: "deblinder.jpg",
        venue: "CSCW'21",
        venuelong:
          "ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)",
        year: "2021",
        month: "October",
        location: "Virtual",
        authors: [
          {
            name: "Ángel Alexander Cabrera",
            website: "https://cabreraalex.com",
          },
          {
            name: "Abraham Druck",
          },
          {
            name: "Jason Hong",
            website: "http://www.cs.cmu.edu/~jasonh/",
          },
          {
            name: "Adam Perer",
            website: "http://perer.org",
          },
        ],
        abstract:
          "AI systems can fail to learn important behaviors, leading to real-world issues like safety concerns and biases. Unfortunately, discovering these systematic failures often requires significant developer attention, from hypothesizing potential edge cases to collecting evidence and validating patterns. To scale and streamlinethis process, we introduce failure reports, end-user descriptions of how or why a model failed, and show how developers can use them to detect AI errors. We also design and implement Deblinder, a visual analytics system for synthesizing failure reports that developers can use to discover and validate systematic failures. In semi-structured interviews and think-aloud studies with 10 AI practitioners, we explore the affordances of the Deblindersystem and the applicability of failure reports in real-world settings. Lastly, we show how collecting additional data from the groups identified by developers can improve model performance.",
        pdf: "",
        bibtex:
          "@article{Cabrera2021Deblinder,address = {New York, NY, USA},author = {Cabrera, Ángel Alexander and Druck, Abraham and Hong, Jason I and Perer, Adam},journal = {Proceedings of the ACM Conference on Computer Supported Cooperative Work, CSCW},publisher = {Association for Computing Machinery},title = {{Discovering and Validating AI Errors With Crowdsourced Failure Reports}},year = {2021}}",
      },
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

    /* src/components/Intro.svelte generated by Svelte v3.38.3 */

    const file$5 = "src/components/Intro.svelte";

    function create_fragment$6(ctx) {
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
    			t13 = text("\n  I've spent time at\n  \n  Apple AI/ML, Microsoft Research and a few summers as a software engineering intern\n  at\n  \n  Google working on Google Maps, Cloud Dataflow, and Android Auto.");
    			attr_dev(a0, "href", "https://hcii.cmu.edu/");
    			add_location(a0, file$5, 2, 2, 34);
    			attr_dev(a1, "href", "http://perer.org");
    			add_location(a1, file$5, 6, 2, 168);
    			attr_dev(a2, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a2, file$5, 8, 2, 218);
    			attr_dev(a3, "href", "https://www.nsfgrfp.org/");
    			add_location(a3, file$5, 12, 2, 500);
    			attr_dev(p0, "class", "svelte-2epx34");
    			add_location(p0, file$5, 0, 0, 0);
    			attr_dev(a4, "href", "https://www.cc.gatech.edu/~dchau/");
    			add_location(a4, file$5, 18, 2, 683);
    			attr_dev(a5, "href", "http://jamiemorgenstern.com/");
    			add_location(a5, file$5, 20, 2, 749);
    			attr_dev(p1, "class", "svelte-2epx34");
    			add_location(p1, file$5, 15, 0, 579);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Intro", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/Links.svelte generated by Svelte v3.38.3 */

    const file$4 = "src/components/Links.svelte";

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
    			add_location(i, file$4, 8, 8, 141);
    			add_location(p, file$4, 9, 8, 179);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 7, 6, 105);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].pdf);
    			add_location(a, file$4, 6, 4, 80);
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
    			add_location(i, file$4, 16, 8, 306);
    			add_location(p, file$4, 17, 8, 342);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 15, 6, 270);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].blog);
    			add_location(a, file$4, 14, 4, 244);
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
    			add_location(i, file$4, 24, 8, 478);
    			add_location(p, file$4, 25, 8, 513);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 23, 6, 442);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].workshop);
    			add_location(a, file$4, 22, 4, 412);
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
    			add_location(i, file$4, 32, 8, 647);
    			add_location(p, file$4, 33, 8, 684);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 31, 6, 611);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].video);
    			add_location(a, file$4, 30, 4, 584);
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
    			add_location(i, file$4, 40, 8, 813);
    			add_location(p, file$4, 41, 8, 848);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 39, 6, 777);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].demo);
    			add_location(a, file$4, 38, 4, 751);
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
    			add_location(i, file$4, 48, 8, 976);
    			add_location(p, file$4, 49, 8, 1012);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 47, 6, 940);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].code);
    			add_location(a, file$4, 46, 4, 914);
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
    		source: "(46:2) {#if pub.code}",
    		ctx
    	});

    	return block;
    }

    // (54:2) {#if pub.slides}
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
    			add_location(i, file$4, 56, 8, 1144);
    			add_location(p, file$4, 57, 8, 1189);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 55, 6, 1108);
    			attr_dev(a, "href", a_href_value = /*pub*/ ctx[0].slides);
    			add_location(a, file$4, 54, 4, 1080);
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
    		source: "(54:2) {#if pub.slides}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
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
    			add_location(i, file$4, 63, 6, 1307);
    			add_location(p, file$4, 64, 6, 1340);
    			attr_dev(button, "class", "entry-link");
    			add_location(button, file$4, 62, 4, 1273);
    			attr_dev(a, "href", a_href_value = "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a, file$4, 61, 2, 1238);
    			attr_dev(div, "class", "buttons");
    			add_location(div, file$4, 4, 0, 38);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Links", slots, []);
    	let { pub } = $$props;
    	const writable_props = ["pub"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Links> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { pub: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Links",
    			options,
    			id: create_fragment$5.name
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

    /* src/Home.svelte generated by Svelte v3.38.3 */
    const file$3 = "src/Home.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
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

    // (28:8) {#each { length: 3 } as _, i}
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
    			add_location(p0, file$3, 29, 12, 970);
    			attr_dev(p1, "class", "item pure-u-1 pure-u-md-4-5");
    			add_location(p1, file$3, 30, 12, 1040);
    			attr_dev(div, "class", "news-item pure-g");
    			add_location(div, file$3, 28, 10, 927);
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
    		source: "(28:8) {#each { length: 3 } as _, i}",
    		ctx
    	});

    	return block;
    }

    // (43:8) {#each pubs as pub}
    function create_each_block_1$1(ctx) {
    	let div5;
    	let div2;
    	let a0;
    	let div0;
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
    	let t4;
    	let p1;
    	let raw_value = /*pub*/ ctx[0].authors.map(func$3).join(", ") + "";
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
    			add_location(div0, file$3, 46, 16, 1577);
    			attr_dev(a0, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$3, 45, 14, 1530);
    			attr_dev(p0, "class", "venue");
    			add_location(p0, file$3, 53, 16, 1793);
    			add_location(div1, file$3, 52, 14, 1771);
    			attr_dev(div2, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-sq6i3r");
    			add_location(div2, file$3, 44, 12, 1469);
    			attr_dev(h4, "class", "paper-title");
    			add_location(h4, file$3, 59, 18, 2015);
    			attr_dev(a1, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a1, file$3, 58, 16, 1966);
    			attr_dev(p1, "class", "authors");
    			add_location(p1, file$3, 61, 16, 2093);
    			attr_dev(div3, "class", "padded");
    			add_location(div3, file$3, 57, 14, 1929);
    			attr_dev(div4, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div4, file$3, 56, 12, 1878);
    			attr_dev(div5, "class", "pure-g pub");
    			add_location(div5, file$3, 43, 10, 1432);
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
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(43:8) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (85:8) {#each other as pub}
    function create_each_block$2(ctx) {
    	let div4;
    	let div1;
    	let a0;
    	let div0;
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
    	let t4;
    	let p1;
    	let raw_value = /*pub*/ ctx[0].authors.map(func_1$2).join(", ") + "";
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
    			add_location(div0, file$3, 88, 16, 3054);
    			attr_dev(a0, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$3, 87, 14, 3007);
    			attr_dev(p0, "class", "venue");
    			add_location(p0, file$3, 94, 14, 3248);
    			attr_dev(div1, "class", "thumb-box pure-u-1 pure-u-md-1-3 svelte-sq6i3r");
    			add_location(div1, file$3, 86, 12, 2946);
    			attr_dev(h4, "class", "paper-title");
    			add_location(h4, file$3, 99, 18, 3449);
    			attr_dev(a1, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a1, file$3, 98, 16, 3400);
    			attr_dev(p1, "class", "author");
    			add_location(p1, file$3, 101, 16, 3527);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$3, 97, 14, 3363);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$3, 96, 12, 3312);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$3, 85, 10, 2909);
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
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(85:8) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
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
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = other;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
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
    			add_location(span, file$3, 18, 43, 615);
    			attr_dev(h20, "id", "hello");
    			attr_dev(h20, "class", "svelte-sq6i3r");
    			add_location(h20, file$3, 18, 8, 580);
    			attr_dev(div0, "id", "intro");
    			add_location(div0, file$3, 17, 6, 555);
    			attr_dev(h21, "class", "header svelte-sq6i3r");
    			add_location(h21, file$3, 23, 10, 756);
    			attr_dev(a, "class", "right-all");
    			attr_dev(a, "href", "#/news");
    			add_location(a, file$3, 24, 13, 798);
    			add_location(p, file$3, 24, 10, 795);
    			attr_dev(div1, "class", "inline svelte-sq6i3r");
    			add_location(div1, file$3, 22, 8, 725);
    			add_location(hr0, file$3, 26, 8, 872);
    			attr_dev(div2, "id", "news");
    			attr_dev(div2, "class", "sect");
    			add_location(div2, file$3, 21, 6, 688);
    			attr_dev(h22, "class", "header svelte-sq6i3r");
    			add_location(h22, file$3, 38, 10, 1252);
    			attr_dev(div3, "class", "inline svelte-sq6i3r");
    			add_location(div3, file$3, 37, 8, 1221);
    			add_location(hr1, file$3, 41, 8, 1387);
    			attr_dev(div4, "id", "pubs");
    			attr_dev(div4, "class", "sect");
    			add_location(div4, file$3, 36, 6, 1184);
    			attr_dev(h23, "class", "header svelte-sq6i3r");
    			add_location(h23, file$3, 80, 10, 2709);
    			attr_dev(div5, "class", "inline svelte-sq6i3r");
    			add_location(div5, file$3, 79, 8, 2678);
    			add_location(hr2, file$3, 83, 8, 2863);
    			attr_dev(div6, "id", "pubs");
    			attr_dev(div6, "class", "sect");
    			add_location(div6, file$3, 78, 6, 2641);
    			attr_dev(div7, "id", "padded-content");
    			add_location(div7, file$3, 16, 4, 523);
    			attr_dev(div8, "id", "content");
    			attr_dev(div8, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div8, file$3, 15, 2, 469);
    			attr_dev(div9, "class", "pure-g");
    			attr_dev(div9, "id", "main-container");
    			add_location(div9, file$3, 13, 0, 412);
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
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
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
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$3 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""} author' href='${p.website}'>${p.name}</a>`;
    const func_1$2 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""} author' href='${p.website}'>${p.name}</a>`;

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Home", slots, []);
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/Pubs.svelte generated by Svelte v3.38.3 */
    const file$2 = "src/Pubs.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (23:6) {#each pubs as pub}
    function create_each_block$1(ctx) {
    	let div4;
    	let div1;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
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
    	let t4;
    	let h5;
    	let raw_value = /*pub*/ ctx[0].authors.map(func$2).join(", ") + "";
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
    			add_location(img, file$2, 27, 16, 720);
    			attr_dev(a0, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			add_location(a0, file$2, 26, 14, 673);
    			attr_dev(h6, "class", "venue");
    			add_location(h6, file$2, 29, 14, 817);
    			attr_dev(div0, "class", "thumb");
    			add_location(div0, file$2, 25, 12, 639);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-3 thumb-box");
    			add_location(div1, file$2, 24, 10, 580);
    			add_location(h4, file$2, 35, 16, 1049);
    			attr_dev(a1, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$2, 34, 14, 982);
    			attr_dev(h5, "class", "authors");
    			add_location(h5, file$2, 37, 14, 1103);
    			attr_dev(p, "class", "desc");
    			add_location(p, file$2, 47, 14, 1462);
    			attr_dev(div2, "class", "padded");
    			add_location(div2, file$2, 33, 12, 947);
    			attr_dev(div3, "class", "pure-u-1 pure-u-md-2-3");
    			add_location(div3, file$2, 32, 10, 898);
    			attr_dev(div4, "class", "pure-g pub");
    			add_location(div4, file$2, 23, 8, 545);
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
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(23:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
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
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
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
    			add_location(h1, file$2, 20, 6, 476);
    			add_location(hr, file$2, 21, 6, 504);
    			attr_dev(div0, "id", "padded-content");
    			add_location(div0, file$2, 19, 4, 444);
    			attr_dev(div1, "id", "content");
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-3-4");
    			add_location(div1, file$2, 18, 2, 390);
    			attr_dev(div2, "class", "pure-g");
    			attr_dev(div2, "id", "main-container");
    			add_location(div2, file$2, 16, 0, 333);
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
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$2 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Pubs", slots, []);
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Pubs> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Sidebar, Footer, Links, pubs, onMount });
    	return [];
    }

    class Pubs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pubs",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/Paper.svelte generated by Svelte v3.38.3 */
    const file$1 = "src/Paper.svelte";

    function create_fragment$2(ctx) {
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
    	let raw0_value = /*pub*/ ctx[0].authors.map(func$1).join(", ") + "";
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
    			add_location(i0, file$1, 14, 4, 411);
    			attr_dev(span0, "class", "color svelte-hez24a");
    			add_location(span0, file$1, 16, 6, 477);
    			attr_dev(span1, "class", "color red svelte-hez24a");
    			add_location(span1, file$1, 17, 6, 522);
    			attr_dev(span2, "class", "color svelte-hez24a");
    			add_location(span2, file$1, 18, 6, 564);
    			attr_dev(span3, "class", "color red svelte-hez24a");
    			add_location(span3, file$1, 19, 6, 609);
    			attr_dev(h40, "id", "home-link");
    			attr_dev(h40, "class", "svelte-hez24a");
    			add_location(h40, file$1, 15, 4, 451);
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "home svelte-hez24a");
    			add_location(a0, file$1, 13, 2, 381);
    			add_location(hr, file$1, 22, 2, 667);
    			attr_dev(h1, "class", "svelte-hez24a");
    			add_location(h1, file$1, 23, 2, 676);
    			attr_dev(h3, "class", "svelte-hez24a");
    			add_location(h3, file$1, 25, 4, 719);
    			attr_dev(div0, "id", "info");
    			attr_dev(div0, "class", "svelte-hez24a");
    			add_location(div0, file$1, 24, 2, 699);
    			if (img.src !== (img_src_value = "images/" + /*pub*/ ctx[0].teaser)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "teaser svelte-hez24a");
    			attr_dev(img, "alt", "teaser");
    			add_location(img, file$1, 38, 6, 1044);
    			attr_dev(div1, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div1, file$1, 37, 4, 1001);
    			attr_dev(p0, "class", "desc svelte-hez24a");
    			add_location(p0, file$1, 41, 6, 1167);
    			attr_dev(div2, "class", "pure-u-1 pure-u-md-1-2");
    			add_location(div2, file$1, 40, 4, 1124);
    			attr_dev(div3, "class", "flex pure-g svelte-hez24a");
    			add_location(div3, file$1, 36, 2, 971);
    			attr_dev(h20, "class", "sec-title svelte-hez24a");
    			add_location(h20, file$1, 45, 2, 1221);
    			attr_dev(p1, "class", "svelte-hez24a");
    			add_location(p1, file$1, 46, 2, 1259);
    			attr_dev(h21, "class", "sec-title svelte-hez24a");
    			add_location(h21, file$1, 48, 2, 1284);
    			attr_dev(h41, "class", "svelte-hez24a");
    			add_location(h41, file$1, 50, 4, 1377);
    			attr_dev(a1, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a1, "class", "paper-title");
    			add_location(a1, file$1, 49, 2, 1322);
    			attr_dev(h50, "class", "svelte-hez24a");
    			add_location(h50, file$1, 53, 2, 1408);
    			add_location(i1, file$1, 65, 4, 1643);
    			attr_dev(h51, "class", "svelte-hez24a");
    			add_location(h51, file$1, 64, 2, 1634);
    			attr_dev(h22, "class", "sec-title svelte-hez24a");
    			add_location(h22, file$1, 69, 2, 1724);
    			attr_dev(code, "class", "bibtex");
    			add_location(code, file$1, 71, 4, 1783);
    			attr_dev(div4, "class", "code svelte-hez24a");
    			add_location(div4, file$1, 70, 2, 1760);
    			attr_dev(div5, "id", "body");
    			attr_dev(div5, "class", "svelte-hez24a");
    			add_location(div5, file$1, 12, 0, 363);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;
    const func_1$1 = p => `<a class='${p.name === "Ángel Alexander Cabrera" ? "me" : ""}' href='${p.website}'>${p.name}</a>`;

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Paper", slots, []);
    	let { params = {} } = $$props;
    	let pub = pubs.concat(other).find(e => e.id === params.id);
    	onMount(() => window.scrollTo(0, 0));
    	const writable_props = ["params"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Paper> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { params: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Paper",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get params() {
    		throw new Error("<Paper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Paper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Cv.svelte generated by Svelte v3.38.3 */
    const file = "src/Cv.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (307:6) {#each pubs as pub}
    function create_each_block_1(ctx) {
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
    	let t5;
    	let h6;
    	let raw_value = /*pub*/ ctx[0].authors.map(func).join(", ") + "";
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
    			attr_dev(th0, "class", "date svelte-spgims");
    			add_location(th0, file, 308, 10, 9667);
    			attr_dev(h5, "class", "svelte-spgims");
    			add_location(h5, file, 311, 14, 9804);
    			attr_dev(a, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file, 310, 12, 9739);
    			attr_dev(h6, "class", "authors svelte-spgims");
    			set_style(h6, "margin-top", "4px");
    			add_location(h6, file, 314, 12, 9855);
    			add_location(i, file, 328, 14, 10320);
    			attr_dev(p, "class", "desc svelte-spgims");
    			add_location(p, file, 327, 12, 10289);
    			attr_dev(th1, "class", "svelte-spgims");
    			add_location(th1, file, 309, 10, 9722);
    			attr_dev(tr0, "class", "item svelte-spgims");
    			add_location(tr0, file, 307, 8, 9639);
    			attr_dev(tr1, "class", "buffer svelte-spgims");
    			add_location(tr1, file, 334, 8, 10456);
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
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(307:6) {#each pubs as pub}",
    		ctx
    	});

    	return block;
    }

    // (344:6) {#each other as pub}
    function create_each_block(ctx) {
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
    	let t5;
    	let h6;
    	let raw_value = /*pub*/ ctx[0].authors.map(func_1).join(", ") + "";
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
    			attr_dev(th0, "class", "date svelte-spgims");
    			add_location(th0, file, 345, 10, 10734);
    			attr_dev(h5, "class", "svelte-spgims");
    			add_location(h5, file, 348, 14, 10871);
    			attr_dev(a, "href", "#/paper/" + /*pub*/ ctx[0].id);
    			attr_dev(a, "class", "paper-title");
    			add_location(a, file, 347, 12, 10806);
    			attr_dev(h6, "class", "authors svelte-spgims");
    			set_style(h6, "margin-top", "4px");
    			add_location(h6, file, 351, 12, 10922);
    			add_location(i, file, 365, 14, 11387);
    			attr_dev(p, "class", "desc svelte-spgims");
    			add_location(p, file, 364, 12, 11356);
    			attr_dev(th1, "class", "svelte-spgims");
    			add_location(th1, file, 346, 10, 10789);
    			attr_dev(tr0, "class", "item svelte-spgims");
    			add_location(tr0, file, 344, 8, 10706);
    			attr_dev(tr1, "class", "buffer svelte-spgims");
    			add_location(tr1, file, 371, 8, 11523);
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
    		id: create_each_block.name,
    		type: "each",
    		source: "(344:6) {#each other as pub}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
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
    	let t161;
    	let th39;
    	let h511;
    	let t163;
    	let h610;
    	let t165;
    	let tr28;
    	let th40;
    	let t166;
    	let br9;
    	let t167;
    	let br10;
    	let t168;
    	let t169;
    	let th41;
    	let h512;
    	let t171;
    	let h611;
    	let t173;
    	let p12;
    	let t175;
    	let tr29;
    	let t176;
    	let tr30;
    	let th42;
    	let t178;
    	let th43;
    	let h513;
    	let t180;
    	let h612;
    	let t182;
    	let p13;
    	let t184;
    	let tr31;
    	let th44;
    	let t185;
    	let th45;
    	let h46;
    	let t187;
    	let tr32;
    	let th46;
    	let t188;
    	let br11;
    	let t189;
    	let t190;
    	let th47;
    	let h514;
    	let t192;
    	let h613;
    	let t194;
    	let p14;
    	let t196;
    	let br12;
    	let t197;
    	let tr33;
    	let th48;
    	let t198;
    	let br13;
    	let t199;
    	let t200;
    	let th49;
    	let h515;
    	let t202;
    	let h614;
    	let t204;
    	let p15;
    	let t206;
    	let br14;
    	let t207;
    	let tr34;
    	let th50;
    	let t208;
    	let br15;
    	let t209;
    	let t210;
    	let th51;
    	let h516;
    	let t212;
    	let tr35;
    	let th52;
    	let t213;
    	let th53;
    	let h47;
    	let t215;
    	let tr36;
    	let th54;
    	let t216;
    	let th55;
    	let h517;
    	let t218;
    	let tr37;
    	let th56;
    	let t220;
    	let th57;
    	let h518;
    	let t222;
    	let tr38;
    	let th58;
    	let t224;
    	let th59;
    	let h519;
    	let t226;
    	let br16;
    	let t227;
    	let tr39;
    	let th60;
    	let t228;
    	let th61;
    	let h520;
    	let t230;
    	let tr40;
    	let th62;
    	let t232;
    	let th63;
    	let h521;
    	let t234;
    	let tr41;
    	let th64;
    	let t236;
    	let th65;
    	let h522;
    	let t238;
    	let tr42;
    	let th66;
    	let t240;
    	let th67;
    	let h523;
    	let t242;
    	let tr43;
    	let th68;
    	let t244;
    	let th69;
    	let h524;
    	let t246;
    	let tr44;
    	let th70;
    	let t248;
    	let th71;
    	let h525;
    	let t250;
    	let tr45;
    	let th72;
    	let t251;
    	let th73;
    	let h48;
    	let t253;
    	let tr46;
    	let th74;
    	let t255;
    	let th75;
    	let h526;
    	let a12;
    	let t257;
    	let i8;
    	let t259;
    	let tr47;
    	let th76;
    	let t261;
    	let th77;
    	let h527;
    	let a13;
    	let t263;
    	let i9;
    	let t265;
    	let tr48;
    	let th78;
    	let t267;
    	let th79;
    	let h528;
    	let a14;
    	let t269;
    	let i10;
    	let t271;
    	let tr49;
    	let th80;
    	let t273;
    	let th81;
    	let h529;
    	let a15;
    	let t275;
    	let i11;
    	let t277;
    	let tr50;
    	let th82;
    	let t279;
    	let th83;
    	let h530;
    	let a16;
    	let t281;
    	let i12;
    	let t283;
    	let tr51;
    	let th84;
    	let t285;
    	let th85;
    	let h531;
    	let a17;
    	let t287;
    	let i13;
    	let t289;
    	let tr52;
    	let th86;
    	let t291;
    	let th87;
    	let h532;
    	let a18;
    	let t293;
    	let i14;
    	let t295;
    	let tr53;
    	let th88;
    	let t297;
    	let th89;
    	let h533;
    	let a19;
    	let t299;
    	let i15;
    	let t301;
    	let tr54;
    	let th90;
    	let t302;
    	let th91;
    	let h49;
    	let t304;
    	let tr55;
    	let th92;
    	let t306;
    	let th93;
    	let h534;
    	let t308;
    	let p16;
    	let t310;
    	let div8;
    	let a20;
    	let button8;
    	let i16;
    	let t311;
    	let t312;
    	let a21;
    	let button9;
    	let i17;
    	let t313;
    	let t314;
    	let tr56;
    	let t315;
    	let tr57;
    	let th94;
    	let t317;
    	let th95;
    	let h535;
    	let t319;
    	let p17;
    	let t321;
    	let div9;
    	let a22;
    	let button10;
    	let i18;
    	let t322;
    	let t323;
    	let a23;
    	let button11;
    	let i19;
    	let t324;
    	let t325;
    	let a24;
    	let button12;
    	let i20;
    	let t326;
    	let t327;
    	let tr58;
    	let t328;
    	let tr59;
    	let th96;
    	let t330;
    	let th97;
    	let h536;
    	let t332;
    	let p18;
    	let t333;
    	let a25;
    	let t335;
    	let t336;
    	let div10;
    	let a27;
    	let button13;
    	let i21;
    	let t337;
    	let t338;
    	let a26;
    	let button14;
    	let i22;
    	let t339;
    	let t340;
    	let tr60;
    	let t341;
    	let tr61;
    	let th98;
    	let t342;
    	let br17;
    	let t343;
    	let t344;
    	let th99;
    	let h537;
    	let t346;
    	let h615;
    	let t348;
    	let p19;
    	let t350;
    	let div11;
    	let a28;
    	let button15;
    	let i23;
    	let t351;
    	let t352;
    	let a29;
    	let button16;
    	let i24;
    	let t353;
    	let t354;
    	let tr62;
    	let t355;
    	let tr63;
    	let th100;
    	let t357;
    	let th101;
    	let h538;
    	let t359;
    	let p20;
    	let t361;
    	let div12;
    	let a30;
    	let button17;
    	let i25;
    	let t362;
    	let t363;
    	let a31;
    	let button18;
    	let i26;
    	let t364;
    	let t365;
    	let tr64;
    	let th102;
    	let t366;
    	let th103;
    	let h410;
    	let t368;
    	let tr65;
    	let th104;
    	let t370;
    	let th105;
    	let h539;
    	let t372;
    	let h540;
    	let t374;
    	let a32;
    	let h541;
    	let t376;
    	let tr66;
    	let th106;
    	let t378;
    	let th107;
    	let a33;
    	let h542;
    	let t380;
    	let a34;
    	let h543;
    	let t382;
    	let a35;
    	let h544;
    	let t384;
    	let a36;
    	let h545;
    	let t386;
    	let h546;
    	let t388;
    	let tr67;
    	let current;
    	intro = new Intro({ $$inline: true });
    	social = new Social({ props: { home: false }, $$inline: true });
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
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
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
    			th38.textContent = "Fall 2021";
    			t161 = space();
    			th39 = element("th");
    			h511 = element("h5");
    			h511.textContent = "05499:C - Data Visualization";
    			t163 = space();
    			h610 = element("h6");
    			h610.textContent = "Graduate Teaching Assistant @ Carnegie Mellon";
    			t165 = space();
    			tr28 = element("tr");
    			th40 = element("th");
    			t166 = text("Fall 2016 ");
    			br9 = element("br");
    			t167 = text(" Spring 2017 ");
    			br10 = element("br");
    			t168 = text(" Spring 2018");
    			t169 = space();
    			th41 = element("th");
    			h512 = element("h5");
    			h512.textContent = "CS1332 - Data Structures and Algorithms";
    			t171 = space();
    			h611 = element("h6");
    			h611.textContent = "Undergraduate Teaching Assistant @ Georgia Tech";
    			t173 = space();
    			p12 = element("p");
    			p12.textContent = "Taught a 1 1/2 hour weekly recitation, graded tests and homework,\n            and helped create assignments.";
    			t175 = space();
    			tr29 = element("tr");
    			t176 = space();
    			tr30 = element("tr");
    			th42 = element("th");
    			th42.textContent = "Fall 2016";
    			t178 = space();
    			th43 = element("th");
    			h513 = element("h5");
    			h513.textContent = "GT 1000 - First-Year Seminar";
    			t180 = space();
    			h612 = element("h6");
    			h612.textContent = "Team Leader @ Georgia Tech";
    			t182 = space();
    			p13 = element("p");
    			p13.textContent = "Designed a class curriculum for incoming first years and helped lead\n            a weekly seminar class.";
    			t184 = space();
    			tr31 = element("tr");
    			th44 = element("th");
    			t185 = space();
    			th45 = element("th");
    			h46 = element("h4");
    			h46.textContent = "Mentoring";
    			t187 = space();
    			tr32 = element("tr");
    			th46 = element("th");
    			t188 = text("Spring 2021 ");
    			br11 = element("br");
    			t189 = text(" - Present");
    			t190 = space();
    			th47 = element("th");
    			h514 = element("h5");
    			h514.textContent = "Kazi Jawad";
    			t192 = space();
    			h613 = element("h6");
    			h613.textContent = "B.S. in Statistics and Machine Learning, Carnegie Mellon";
    			t194 = space();
    			p14 = element("p");
    			p14.textContent = "Interactive tagging of images for AI error validation.";
    			t196 = space();
    			br12 = element("br");
    			t197 = space();
    			tr33 = element("tr");
    			th48 = element("th");
    			t198 = text("Spring 2020 ");
    			br13 = element("br");
    			t199 = text(" - Present");
    			t200 = space();
    			th49 = element("th");
    			h515 = element("h5");
    			h515.textContent = "Abraham Druck";
    			t202 = space();
    			h614 = element("h6");
    			h614.textContent = "B.S. in Mathematical Sciences, Carnegie Mellon";
    			t204 = space();
    			p15 = element("p");
    			p15.textContent = "Crowdsourced discovery of ML blind spots for image captioning.";
    			t206 = space();
    			br14 = element("br");
    			t207 = space();
    			tr34 = element("tr");
    			th50 = element("th");
    			t208 = text("Fall 2020 ");
    			br15 = element("br");
    			t209 = text(" Spring 2020");
    			t210 = space();
    			th51 = element("th");
    			h516 = element("h5");
    			h516.textContent = "CMU AI Mentoring Program";
    			t212 = space();
    			tr35 = element("tr");
    			th52 = element("th");
    			t213 = space();
    			th53 = element("th");
    			h47 = element("h4");
    			h47.textContent = "Service";
    			t215 = space();
    			tr36 = element("tr");
    			th54 = element("th");
    			t216 = space();
    			th55 = element("th");
    			h517 = element("h5");
    			h517.textContent = "Student Volunteer";
    			t218 = space();
    			tr37 = element("tr");
    			th56 = element("th");
    			th56.textContent = "October 2019";
    			t220 = space();
    			th57 = element("th");
    			h518 = element("h5");
    			h518.textContent = "IEEE Visualization (VIS)";
    			t222 = space();
    			tr38 = element("tr");
    			th58 = element("th");
    			th58.textContent = "January 2019";
    			t224 = space();
    			th59 = element("th");
    			h519 = element("h5");
    			h519.textContent = "ACM Fairness, Accountability, and Transparency (FAT*)";
    			t226 = space();
    			br16 = element("br");
    			t227 = space();
    			tr39 = element("tr");
    			th60 = element("th");
    			t228 = space();
    			th61 = element("th");
    			h520 = element("h5");
    			h520.textContent = "Reviewer";
    			t230 = space();
    			tr40 = element("tr");
    			th62 = element("th");
    			th62.textContent = "2019 - 2021";
    			t232 = space();
    			th63 = element("th");
    			h521 = element("h5");
    			h521.textContent = "IEEE Transactions on Visualization and Computer Graphics (TVCG)";
    			t234 = space();
    			tr41 = element("tr");
    			th64 = element("th");
    			th64.textContent = "2020 - 2021";
    			t236 = space();
    			th65 = element("th");
    			h522 = element("h5");
    			h522.textContent = "IEEE Visualization (VIS)";
    			t238 = space();
    			tr42 = element("tr");
    			th66 = element("th");
    			th66.textContent = "2021";
    			t240 = space();
    			th67 = element("th");
    			h523 = element("h5");
    			h523.textContent = "ACM Conference on Computer-Supported Cooperative Work and Social\n            Computing (CSCW)";
    			t242 = space();
    			tr43 = element("tr");
    			th68 = element("th");
    			th68.textContent = "2021";
    			t244 = space();
    			th69 = element("th");
    			h524 = element("h5");
    			h524.textContent = "ACM Conference on Human Factors in Computing Systems (CHI)";
    			t246 = space();
    			tr44 = element("tr");
    			th70 = element("th");
    			th70.textContent = "2019";
    			t248 = space();
    			th71 = element("th");
    			h525 = element("h5");
    			h525.textContent = "ACM Transactions on Interactive Intelligent Systems (TiiS)";
    			t250 = space();
    			tr45 = element("tr");
    			th72 = element("th");
    			t251 = space();
    			th73 = element("th");
    			h48 = element("h4");
    			h48.textContent = "Press & Talks";
    			t253 = space();
    			tr46 = element("tr");
    			th74 = element("th");
    			th74.textContent = "2021";
    			t255 = space();
    			th75 = element("th");
    			h526 = element("h5");
    			a12 = element("a");
    			a12.textContent = "\"Data Science Widgets with Svelte and Jupyter\"";
    			t257 = text("\n            -\n            ");
    			i8 = element("i");
    			i8.textContent = "Svelte Summit 2021";
    			t259 = space();
    			tr47 = element("tr");
    			th76 = element("th");
    			th76.textContent = "2020";
    			t261 = space();
    			th77 = element("th");
    			h527 = element("h5");
    			a13 = element("a");
    			a13.textContent = "\"New forecasting data could help public health officials prepare\n              for what's next in the coronavirus pandemic\"";
    			t263 = text("\n            -\n            ");
    			i9 = element("i");
    			i9.textContent = "CNN";
    			t265 = space();
    			tr48 = element("tr");
    			th78 = element("th");
    			th78.textContent = "2020";
    			t267 = space();
    			th79 = element("th");
    			h528 = element("h5");
    			a14 = element("a");
    			a14.textContent = "\"Facebook and Google Survey Data May Help Map Covid-19's Spread\"";
    			t269 = text("\n            -\n            ");
    			i10 = element("i");
    			i10.textContent = "Wired";
    			t271 = space();
    			tr49 = element("tr");
    			th80 = element("th");
    			th80.textContent = "2020";
    			t273 = space();
    			th81 = element("th");
    			h529 = element("h5");
    			a15 = element("a");
    			a15.textContent = "\"Carnegie Mellon Unveils Five Interactive COVID-19 Maps\"";
    			t275 = text("\n            -\n            ");
    			i11 = element("i");
    			i11.textContent = "Carnegie Mellon";
    			t277 = space();
    			tr50 = element("tr");
    			th82 = element("th");
    			th82.textContent = "2020";
    			t279 = space();
    			th83 = element("th");
    			h530 = element("h5");
    			a16 = element("a");
    			a16.textContent = "\"Visualizing Fairness in Machine Learning\"";
    			t281 = text("\n            -\n            ");
    			i12 = element("i");
    			i12.textContent = "Data Stories Podcast";
    			t283 = space();
    			tr51 = element("tr");
    			th84 = element("th");
    			th84.textContent = "2019";
    			t285 = space();
    			th85 = element("th");
    			h531 = element("h5");
    			a17 = element("a");
    			a17.textContent = "\"Alex Cabrera Wins Love Family Foundation Scholarship\"";
    			t287 = text("\n            -\n            ");
    			i13 = element("i");
    			i13.textContent = "GT SCS";
    			t289 = space();
    			tr52 = element("tr");
    			th86 = element("th");
    			th86.textContent = "2019";
    			t291 = space();
    			th87 = element("th");
    			h532 = element("h5");
    			a18 = element("a");
    			a18.textContent = "\"Georgia Tech Satellite Successfully Launched Into Space \"";
    			t293 = text("\n            -\n            ");
    			i14 = element("i");
    			i14.textContent = "Georgia Tech";
    			t295 = space();
    			tr53 = element("tr");
    			th88 = element("th");
    			th88.textContent = "2018";
    			t297 = space();
    			th89 = element("th");
    			h533 = element("h5");
    			a19 = element("a");
    			a19.textContent = "\"Datathon Challenges Students to Create Solutions to Real-World\n              Problems\"";
    			t299 = text("\n            -\n            ");
    			i15 = element("i");
    			i15.textContent = "GT SCS";
    			t301 = space();
    			tr54 = element("tr");
    			th90 = element("th");
    			t302 = space();
    			th91 = element("th");
    			h49 = element("h4");
    			h49.textContent = "Projects and Open Source";
    			t304 = space();
    			tr55 = element("tr");
    			th92 = element("th");
    			th92.textContent = "Spring 2021";
    			t306 = space();
    			th93 = element("th");
    			h534 = element("h5");
    			h534.textContent = "Svelte + Vega";
    			t308 = space();
    			p16 = element("p");
    			p16.textContent = "A Svelte component for reactively rendering Vega and Vega-Lite\n            visualizations.";
    			t310 = space();
    			div8 = element("div");
    			a20 = element("a");
    			button8 = element("button");
    			i16 = element("i");
    			t311 = text(" GitHub");
    			t312 = space();
    			a21 = element("a");
    			button9 = element("button");
    			i17 = element("i");
    			t313 = text(" Demo");
    			t314 = space();
    			tr56 = element("tr");
    			t315 = space();
    			tr57 = element("tr");
    			th94 = element("th");
    			th94.textContent = "Spring 2021";
    			t317 = space();
    			th95 = element("th");
    			h535 = element("h5");
    			h535.textContent = "Svelte + Jupyter Widgets";
    			t319 = space();
    			p17 = element("p");
    			p17.textContent = "A framework for creating reactive data science widgets using Svelte\n            JS.";
    			t321 = space();
    			div9 = element("div");
    			a22 = element("a");
    			button10 = element("button");
    			i18 = element("i");
    			t322 = text(" Blog");
    			t323 = space();
    			a23 = element("a");
    			button11 = element("button");
    			i19 = element("i");
    			t324 = text(" GitHub");
    			t325 = space();
    			a24 = element("a");
    			button12 = element("button");
    			i20 = element("i");
    			t326 = text(" Video");
    			t327 = space();
    			tr58 = element("tr");
    			t328 = space();
    			tr59 = element("tr");
    			th96 = element("th");
    			th96.textContent = "Spring 2020";
    			t330 = space();
    			th97 = element("th");
    			h536 = element("h5");
    			h536.textContent = "COVIDCast Visualization of COVID-19 Indicators";
    			t332 = space();
    			p18 = element("p");
    			t333 = text("Interactive visualization system of COVID-19 indicators gathered\n            through >20,000,000 surveys on Facebook and Google by ");
    			a25 = element("a");
    			a25.textContent = "CMU Delphi";
    			t335 = text(".");
    			t336 = space();
    			div10 = element("div");
    			a27 = element("a");
    			button13 = element("button");
    			i21 = element("i");
    			t337 = text(" Website");
    			t338 = space();
    			a26 = element("a");
    			button14 = element("button");
    			i22 = element("i");
    			t339 = text(" GitHub");
    			t340 = space();
    			tr60 = element("tr");
    			t341 = space();
    			tr61 = element("tr");
    			th98 = element("th");
    			t342 = text("September 2015 ");
    			br17 = element("br");
    			t343 = text(" - May 2017");
    			t344 = space();
    			th99 = element("th");
    			h537 = element("h5");
    			h537.textContent = "PROX-1 Satellite";
    			t346 = space();
    			h615 = element("h6");
    			h615.textContent = "Flight Software Lead and Researcher";
    			t348 = space();
    			p19 = element("p");
    			p19.textContent = "Led a team of engineers in developing the software for a fully\n            undergraduate-led satellite mission.";
    			t350 = space();
    			div11 = element("div");
    			a28 = element("a");
    			button15 = element("button");
    			i23 = element("i");
    			t351 = text(" In space!");
    			t352 = space();
    			a29 = element("a");
    			button16 = element("button");
    			i24 = element("i");
    			t353 = text(" Press release");
    			t354 = space();
    			tr62 = element("tr");
    			t355 = space();
    			tr63 = element("tr");
    			th100 = element("th");
    			th100.textContent = "Spring 2014";
    			t357 = space();
    			th101 = element("th");
    			h538 = element("h5");
    			h538.textContent = "CTF Resources";
    			t359 = space();
    			p20 = element("p");
    			p20.textContent = "Guide and resources for capture the flag (CTF) competitions with\n            over 1.4k stars on GitHub.";
    			t361 = space();
    			div12 = element("div");
    			a30 = element("a");
    			button17 = element("button");
    			i25 = element("i");
    			t362 = text(" Website");
    			t363 = space();
    			a31 = element("a");
    			button18 = element("button");
    			i26 = element("i");
    			t364 = text(" GitHub");
    			t365 = space();
    			tr64 = element("tr");
    			th102 = element("th");
    			t366 = space();
    			th103 = element("th");
    			h410 = element("h4");
    			h410.textContent = "Selected Classes";
    			t368 = space();
    			tr65 = element("tr");
    			th104 = element("th");
    			th104.textContent = "PhD";
    			t370 = space();
    			th105 = element("th");
    			h539 = element("h5");
    			h539.textContent = "Causality and Machine Learning";
    			t372 = space();
    			h540 = element("h5");
    			h540.textContent = "Human Judgement and Decision Making";
    			t374 = space();
    			a32 = element("a");
    			h541 = element("h5");
    			h541.textContent = "Applied Research Methods";
    			t376 = space();
    			tr66 = element("tr");
    			th106 = element("th");
    			th106.textContent = "B.S.";
    			t378 = space();
    			th107 = element("th");
    			a33 = element("a");
    			h542 = element("h5");
    			h542.textContent = "Deep Learning";
    			t380 = space();
    			a34 = element("a");
    			h543 = element("h5");
    			h543.textContent = "Data and Visual Analytics";
    			t382 = space();
    			a35 = element("a");
    			h544 = element("h5");
    			h544.textContent = "Machine Learning";
    			t384 = space();
    			a36 = element("a");
    			h545 = element("h5");
    			h545.textContent = "Computer Simulation";
    			t386 = space();
    			h546 = element("h5");
    			h546.textContent = "Honors Algorithms";
    			t388 = space();
    			tr67 = element("tr");
    			attr_dev(th0, "class", "date svelte-spgims");
    			add_location(th0, file, 19, 8, 493);
    			attr_dev(span0, "class", "color svelte-spgims");
    			add_location(span0, file, 22, 12, 577);
    			attr_dev(span1, "class", "color red svelte-spgims");
    			add_location(span1, file, 23, 12, 628);
    			attr_dev(span2, "class", "color svelte-spgims");
    			add_location(span2, file, 24, 12, 676);
    			attr_dev(span3, "class", "color red svelte-spgims");
    			add_location(span3, file, 25, 12, 727);
    			attr_dev(h3, "id", "name");
    			attr_dev(h3, "class", "svelte-spgims");
    			add_location(h3, file, 21, 10, 550);
    			attr_dev(th1, "class", "intro svelte-spgims");
    			add_location(th1, file, 20, 8, 521);
    			add_location(tr0, file, 18, 6, 480);
    			attr_dev(th2, "class", "date svelte-spgims");
    			add_location(th2, file, 34, 8, 907);
    			attr_dev(h40, "class", "header svelte-spgims");
    			add_location(h40, file, 36, 10, 950);
    			attr_dev(th3, "class", "svelte-spgims");
    			add_location(th3, file, 35, 8, 935);
    			add_location(tr1, file, 33, 6, 894);
    			add_location(br0, file, 40, 37, 1071);
    			attr_dev(th4, "class", "date svelte-spgims");
    			add_location(th4, file, 40, 8, 1042);
    			attr_dev(h50, "class", "svelte-spgims");
    			add_location(h50, file, 42, 10, 1116);
    			attr_dev(h60, "class", "svelte-spgims");
    			add_location(h60, file, 43, 10, 1175);
    			attr_dev(a0, "href", "http://perer.org");
    			add_location(a0, file, 46, 12, 1273);
    			attr_dev(a1, "href", "http://www.cs.cmu.edu/~jasonh/");
    			add_location(a1, file, 48, 12, 1343);
    			attr_dev(p0, "class", "desc svelte-spgims");
    			add_location(p0, file, 44, 10, 1221);
    			attr_dev(i0, "class", "fas fa-globe svelte-spgims");
    			add_location(i0, file, 53, 16, 1546);
    			attr_dev(button0, "class", "entry-link");
    			add_location(button0, file, 52, 14, 1502);
    			attr_dev(a2, "href", "https://dig.cmu.edu/");
    			add_location(a2, file, 51, 12, 1456);
    			attr_dev(div0, "class", "tags");
    			add_location(div0, file, 50, 10, 1425);
    			attr_dev(th5, "class", "svelte-spgims");
    			add_location(th5, file, 41, 8, 1101);
    			attr_dev(tr2, "class", "item svelte-spgims");
    			add_location(tr2, file, 39, 6, 1016);
    			attr_dev(tr3, "class", "buffer svelte-spgims");
    			add_location(tr3, file, 60, 6, 1702);
    			add_location(br1, file, 62, 37, 1785);
    			attr_dev(th6, "class", "date svelte-spgims");
    			add_location(th6, file, 62, 8, 1756);
    			attr_dev(h51, "class", "svelte-spgims");
    			add_location(h51, file, 64, 10, 1831);
    			attr_dev(h61, "class", "svelte-spgims");
    			add_location(h61, file, 65, 10, 1875);
    			add_location(br2, file, 68, 12, 2022);
    			attr_dev(p1, "class", "desc svelte-spgims");
    			add_location(p1, file, 66, 10, 1926);
    			attr_dev(th7, "class", "svelte-spgims");
    			add_location(th7, file, 63, 8, 1816);
    			attr_dev(tr4, "class", "item svelte-spgims");
    			add_location(tr4, file, 61, 6, 1730);
    			attr_dev(th8, "class", "date svelte-spgims");
    			add_location(th8, file, 74, 8, 2134);
    			attr_dev(h62, "class", "svelte-spgims");
    			add_location(h62, file, 76, 10, 2189);
    			attr_dev(p2, "class", "desc svelte-spgims");
    			add_location(p2, file, 77, 10, 2236);
    			attr_dev(th9, "class", "svelte-spgims");
    			add_location(th9, file, 75, 8, 2174);
    			attr_dev(tr5, "class", "item svelte-spgims");
    			add_location(tr5, file, 73, 6, 2108);
    			attr_dev(th10, "class", "date svelte-spgims");
    			add_location(th10, file, 84, 8, 2415);
    			attr_dev(h41, "class", "header svelte-spgims");
    			add_location(h41, file, 86, 10, 2458);
    			attr_dev(th11, "class", "svelte-spgims");
    			add_location(th11, file, 85, 8, 2443);
    			add_location(tr6, file, 83, 6, 2402);
    			add_location(br3, file, 90, 34, 2582);
    			attr_dev(th12, "class", "date svelte-spgims");
    			add_location(th12, file, 90, 8, 2556);
    			attr_dev(h52, "class", "svelte-spgims");
    			add_location(h52, file, 92, 10, 2627);
    			attr_dev(h63, "class", "svelte-spgims");
    			add_location(h63, file, 93, 10, 2652);
    			attr_dev(p3, "class", "desc svelte-spgims");
    			add_location(p3, file, 94, 10, 2687);
    			attr_dev(i1, "class", "fas fa-globe svelte-spgims");
    			add_location(i1, file, 98, 16, 2882);
    			attr_dev(button1, "class", "entry-link");
    			add_location(button1, file, 97, 14, 2838);
    			attr_dev(a3, "href", "https://machinelearning.apple.com/");
    			add_location(a3, file, 96, 12, 2778);
    			attr_dev(div1, "class", "tags");
    			add_location(div1, file, 95, 10, 2747);
    			attr_dev(th13, "class", "svelte-spgims");
    			add_location(th13, file, 91, 8, 2612);
    			attr_dev(tr7, "class", "item svelte-spgims");
    			add_location(tr7, file, 89, 6, 2530);
    			attr_dev(tr8, "class", "buffer svelte-spgims");
    			add_location(tr8, file, 104, 6, 3011);
    			add_location(br4, file, 106, 34, 3091);
    			attr_dev(th14, "class", "date svelte-spgims");
    			add_location(th14, file, 106, 8, 3065);
    			attr_dev(h53, "class", "svelte-spgims");
    			add_location(h53, file, 108, 10, 3140);
    			attr_dev(h64, "class", "svelte-spgims");
    			add_location(h64, file, 109, 10, 3178);
    			attr_dev(a4, "href", "https://www.microsoft.com/en-us/research/people/sdrucker/");
    			add_location(a4, file, 112, 12, 3300);
    			attr_dev(a5, "href", "https://homes.cs.washington.edu/~marcotcr/");
    			add_location(a5, file, 116, 12, 3443);
    			attr_dev(p4, "class", "desc svelte-spgims");
    			add_location(p4, file, 110, 10, 3213);
    			attr_dev(i2, "class", "fas fa-globe svelte-spgims");
    			add_location(i2, file, 123, 16, 3727);
    			attr_dev(button2, "class", "entry-link");
    			add_location(button2, file, 122, 14, 3683);
    			attr_dev(a6, "href", "https://www.microsoft.com/en-us/research/group/vida/");
    			add_location(a6, file, 121, 12, 3605);
    			attr_dev(div2, "class", "tags");
    			add_location(div2, file, 120, 10, 3574);
    			attr_dev(th15, "class", "svelte-spgims");
    			add_location(th15, file, 107, 8, 3125);
    			attr_dev(tr9, "class", "item svelte-spgims");
    			add_location(tr9, file, 105, 6, 3039);
    			attr_dev(tr10, "class", "buffer svelte-spgims");
    			add_location(tr10, file, 129, 6, 3855);
    			add_location(br5, file, 131, 34, 3935);
    			attr_dev(th16, "class", "date svelte-spgims");
    			add_location(th16, file, 131, 8, 3909);
    			attr_dev(h54, "class", "svelte-spgims");
    			add_location(h54, file, 133, 10, 3984);
    			attr_dev(h65, "class", "svelte-spgims");
    			add_location(h65, file, 134, 10, 4010);
    			attr_dev(p5, "class", "desc svelte-spgims");
    			add_location(p5, file, 135, 10, 4057);
    			attr_dev(i3, "class", "far fa-newspaper svelte-spgims");
    			add_location(i3, file, 146, 16, 4517);
    			attr_dev(button3, "class", "entry-link");
    			add_location(button3, file, 145, 14, 4473);
    			attr_dev(a7, "href", "https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260\n                ");
    			add_location(a7, file, 141, 12, 4320);
    			attr_dev(div3, "class", "tags");
    			add_location(div3, file, 140, 10, 4289);
    			attr_dev(th17, "class", "svelte-spgims");
    			add_location(th17, file, 132, 8, 3969);
    			attr_dev(tr11, "class", "item svelte-spgims");
    			add_location(tr11, file, 130, 6, 3883);
    			attr_dev(tr12, "class", "buffer svelte-spgims");
    			add_location(tr12, file, 153, 6, 4666);
    			add_location(br6, file, 155, 34, 4746);
    			attr_dev(th18, "class", "date svelte-spgims");
    			add_location(th18, file, 155, 8, 4720);
    			attr_dev(h55, "class", "svelte-spgims");
    			add_location(h55, file, 157, 10, 4795);
    			attr_dev(h66, "class", "svelte-spgims");
    			add_location(h66, file, 158, 10, 4821);
    			attr_dev(p6, "class", "desc svelte-spgims");
    			add_location(p6, file, 159, 10, 4868);
    			attr_dev(th19, "class", "svelte-spgims");
    			add_location(th19, file, 156, 8, 4780);
    			attr_dev(tr13, "class", "item svelte-spgims");
    			add_location(tr13, file, 154, 6, 4694);
    			attr_dev(tr14, "class", "buffer svelte-spgims");
    			add_location(tr14, file, 165, 6, 5051);
    			add_location(br7, file, 167, 34, 5131);
    			attr_dev(th20, "class", "date svelte-spgims");
    			add_location(th20, file, 167, 8, 5105);
    			attr_dev(h56, "class", "svelte-spgims");
    			add_location(h56, file, 169, 10, 5180);
    			attr_dev(h67, "class", "svelte-spgims");
    			add_location(h67, file, 170, 10, 5206);
    			attr_dev(p7, "class", "desc svelte-spgims");
    			add_location(p7, file, 171, 10, 5254);
    			attr_dev(th21, "class", "svelte-spgims");
    			add_location(th21, file, 168, 8, 5165);
    			attr_dev(tr15, "class", "item svelte-spgims");
    			add_location(tr15, file, 166, 6, 5079);
    			attr_dev(th22, "class", "date svelte-spgims");
    			add_location(th22, file, 179, 8, 5465);
    			attr_dev(h42, "class", "header svelte-spgims");
    			add_location(h42, file, 181, 10, 5508);
    			attr_dev(th23, "class", "svelte-spgims");
    			add_location(th23, file, 180, 8, 5493);
    			add_location(tr16, file, 178, 6, 5452);
    			attr_dev(th24, "class", "date svelte-spgims");
    			add_location(th24, file, 185, 8, 5597);
    			attr_dev(h57, "class", "svelte-spgims");
    			add_location(h57, file, 187, 10, 5651);
    			attr_dev(p8, "class", "desc svelte-spgims");
    			add_location(p8, file, 190, 10, 5762);
    			attr_dev(i4, "class", "fas fa-globe svelte-spgims");
    			add_location(i4, file, 197, 16, 6058);
    			attr_dev(button4, "class", "entry-link");
    			add_location(button4, file, 196, 14, 6014);
    			attr_dev(a8, "href", "https://www.nsfgrfp.org/");
    			add_location(a8, file, 195, 12, 5964);
    			attr_dev(div4, "class", "tags");
    			add_location(div4, file, 194, 10, 5933);
    			attr_dev(th25, "class", "svelte-spgims");
    			add_location(th25, file, 186, 8, 5636);
    			attr_dev(tr17, "class", "item svelte-spgims");
    			add_location(tr17, file, 184, 6, 5571);
    			attr_dev(tr18, "class", "buffer svelte-spgims");
    			add_location(tr18, file, 203, 6, 6183);
    			attr_dev(th26, "class", "date svelte-spgims");
    			add_location(th26, file, 205, 8, 6237);
    			attr_dev(h58, "class", "svelte-spgims");
    			add_location(h58, file, 207, 10, 6291);
    			attr_dev(p9, "class", "desc svelte-spgims");
    			add_location(p9, file, 208, 10, 6345);
    			attr_dev(i5, "class", "fas fa-globe svelte-spgims");
    			add_location(i5, file, 217, 16, 6758);
    			attr_dev(button5, "class", "entry-link");
    			add_location(button5, file, 216, 14, 6714);
    			attr_dev(a9, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			add_location(a9, file, 213, 12, 6544);
    			attr_dev(div5, "class", "tags");
    			add_location(div5, file, 212, 10, 6513);
    			attr_dev(th27, "class", "svelte-spgims");
    			add_location(th27, file, 206, 8, 6276);
    			attr_dev(tr19, "class", "item svelte-spgims");
    			add_location(tr19, file, 204, 6, 6211);
    			attr_dev(tr20, "class", "buffer svelte-spgims");
    			add_location(tr20, file, 223, 6, 6888);
    			add_location(br8, file, 225, 37, 6971);
    			attr_dev(th28, "class", "date svelte-spgims");
    			add_location(th28, file, 225, 8, 6942);
    			attr_dev(h59, "class", "svelte-spgims");
    			add_location(h59, file, 227, 10, 7017);
    			attr_dev(h68, "class", "svelte-spgims");
    			add_location(h68, file, 228, 10, 7063);
    			attr_dev(p10, "class", "desc svelte-spgims");
    			add_location(p10, file, 229, 10, 7139);
    			attr_dev(i6, "class", "fas fa-globe svelte-spgims");
    			add_location(i6, file, 236, 16, 7429);
    			attr_dev(button6, "class", "entry-link");
    			add_location(button6, file, 235, 14, 7385);
    			attr_dev(a10, "href", "https://stampsps.gatech.edu/");
    			add_location(a10, file, 234, 12, 7331);
    			attr_dev(div6, "class", "tags");
    			add_location(div6, file, 233, 10, 7300);
    			attr_dev(th29, "class", "svelte-spgims");
    			add_location(th29, file, 226, 8, 7002);
    			attr_dev(tr21, "class", "item svelte-spgims");
    			add_location(tr21, file, 224, 6, 6916);
    			attr_dev(tr22, "class", "buffer svelte-spgims");
    			add_location(tr22, file, 242, 6, 7554);
    			attr_dev(th30, "class", "date svelte-spgims");
    			add_location(th30, file, 244, 8, 7608);
    			attr_dev(h510, "class", "svelte-spgims");
    			add_location(h510, file, 246, 10, 7670);
    			attr_dev(h69, "class", "svelte-spgims");
    			add_location(h69, file, 247, 10, 7712);
    			attr_dev(p11, "class", "desc svelte-spgims");
    			add_location(p11, file, 248, 10, 7770);
    			attr_dev(i7, "class", "far fa-newspaper svelte-spgims");
    			add_location(i7, file, 257, 16, 8153);
    			attr_dev(button7, "class", "entry-link");
    			add_location(button7, file, 256, 14, 8109);
    			attr_dev(a11, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			add_location(a11, file, 253, 12, 7953);
    			attr_dev(div7, "class", "tags");
    			add_location(div7, file, 252, 10, 7922);
    			attr_dev(th31, "class", "svelte-spgims");
    			add_location(th31, file, 245, 8, 7655);
    			attr_dev(tr23, "class", "item svelte-spgims");
    			add_location(tr23, file, 243, 6, 7582);
    			attr_dev(th32, "class", "date svelte-spgims");
    			add_location(th32, file, 301, 8, 9490);
    			attr_dev(h43, "class", "header svelte-spgims");
    			add_location(h43, file, 303, 10, 9533);
    			attr_dev(th33, "class", "svelte-spgims");
    			add_location(th33, file, 302, 8, 9518);
    			add_location(tr24, file, 300, 6, 9477);
    			attr_dev(th34, "class", "date svelte-spgims");
    			add_location(th34, file, 338, 8, 10537);
    			attr_dev(h44, "class", "header svelte-spgims");
    			add_location(h44, file, 340, 10, 10580);
    			attr_dev(th35, "class", "svelte-spgims");
    			add_location(th35, file, 339, 8, 10565);
    			add_location(tr25, file, 337, 6, 10524);
    			attr_dev(th36, "class", "date svelte-spgims");
    			add_location(th36, file, 375, 8, 11602);
    			attr_dev(h45, "class", "header svelte-spgims");
    			add_location(h45, file, 377, 10, 11645);
    			attr_dev(th37, "class", "svelte-spgims");
    			add_location(th37, file, 376, 8, 11630);
    			add_location(tr26, file, 374, 6, 11589);
    			attr_dev(th38, "class", "date svelte-spgims");
    			add_location(th38, file, 381, 8, 11736);
    			attr_dev(h511, "class", "svelte-spgims");
    			add_location(h511, file, 383, 10, 11791);
    			attr_dev(h610, "class", "svelte-spgims");
    			add_location(h610, file, 384, 10, 11839);
    			attr_dev(th39, "class", "svelte-spgims");
    			add_location(th39, file, 382, 8, 11776);
    			attr_dev(tr27, "class", "item svelte-spgims");
    			add_location(tr27, file, 380, 6, 11710);
    			add_location(br9, file, 388, 35, 11979);
    			add_location(br10, file, 388, 54, 11998);
    			attr_dev(th40, "class", "date svelte-spgims");
    			add_location(th40, file, 388, 8, 11952);
    			attr_dev(h512, "class", "svelte-spgims");
    			add_location(h512, file, 390, 10, 12045);
    			attr_dev(h611, "class", "svelte-spgims");
    			add_location(h611, file, 391, 10, 12104);
    			attr_dev(p12, "class", "desc svelte-spgims");
    			add_location(p12, file, 392, 10, 12171);
    			attr_dev(th41, "class", "svelte-spgims");
    			add_location(th41, file, 389, 8, 12030);
    			attr_dev(tr28, "class", "item svelte-spgims");
    			add_location(tr28, file, 387, 6, 11926);
    			attr_dev(tr29, "class", "buffer svelte-spgims");
    			add_location(tr29, file, 398, 6, 12356);
    			attr_dev(th42, "class", "date svelte-spgims");
    			add_location(th42, file, 400, 8, 12410);
    			attr_dev(h513, "class", "svelte-spgims");
    			add_location(h513, file, 402, 10, 12465);
    			attr_dev(h612, "class", "svelte-spgims");
    			add_location(h612, file, 403, 10, 12513);
    			attr_dev(p13, "class", "desc svelte-spgims");
    			add_location(p13, file, 404, 10, 12559);
    			attr_dev(th43, "class", "svelte-spgims");
    			add_location(th43, file, 401, 8, 12450);
    			attr_dev(tr30, "class", "item svelte-spgims");
    			add_location(tr30, file, 399, 6, 12384);
    			attr_dev(th44, "class", "date svelte-spgims");
    			add_location(th44, file, 412, 8, 12778);
    			attr_dev(h46, "class", "header svelte-spgims");
    			add_location(h46, file, 414, 10, 12821);
    			attr_dev(th45, "class", "svelte-spgims");
    			add_location(th45, file, 413, 8, 12806);
    			add_location(tr31, file, 411, 6, 12765);
    			add_location(br11, file, 418, 37, 12942);
    			attr_dev(th46, "class", "date svelte-spgims");
    			add_location(th46, file, 418, 8, 12913);
    			attr_dev(h514, "class", "svelte-spgims");
    			add_location(h514, file, 420, 10, 12987);
    			attr_dev(h613, "class", "svelte-spgims");
    			add_location(h613, file, 421, 10, 13017);
    			attr_dev(p14, "class", "desc svelte-spgims");
    			add_location(p14, file, 422, 10, 13093);
    			attr_dev(th47, "class", "svelte-spgims");
    			add_location(th47, file, 419, 8, 12972);
    			attr_dev(tr32, "class", "item svelte-spgims");
    			add_location(tr32, file, 417, 6, 12887);
    			add_location(br12, file, 427, 6, 13224);
    			add_location(br13, file, 429, 37, 13292);
    			attr_dev(th48, "class", "date svelte-spgims");
    			add_location(th48, file, 429, 8, 13263);
    			attr_dev(h515, "class", "svelte-spgims");
    			add_location(h515, file, 431, 10, 13337);
    			attr_dev(h614, "class", "svelte-spgims");
    			add_location(h614, file, 432, 10, 13370);
    			attr_dev(p15, "class", "desc svelte-spgims");
    			add_location(p15, file, 433, 10, 13436);
    			attr_dev(th49, "class", "svelte-spgims");
    			add_location(th49, file, 430, 8, 13322);
    			attr_dev(tr33, "class", "item svelte-spgims");
    			add_location(tr33, file, 428, 6, 13237);
    			add_location(br14, file, 438, 6, 13575);
    			add_location(br15, file, 440, 35, 13641);
    			attr_dev(th50, "class", "date svelte-spgims");
    			add_location(th50, file, 440, 8, 13614);
    			attr_dev(h516, "class", "svelte-spgims");
    			add_location(h516, file, 442, 10, 13688);
    			attr_dev(th51, "class", "svelte-spgims");
    			add_location(th51, file, 441, 8, 13673);
    			attr_dev(tr34, "class", "item svelte-spgims");
    			add_location(tr34, file, 439, 6, 13588);
    			attr_dev(th52, "class", "date svelte-spgims");
    			add_location(th52, file, 447, 8, 13790);
    			attr_dev(h47, "class", "header svelte-spgims");
    			add_location(h47, file, 449, 10, 13833);
    			attr_dev(th53, "class", "svelte-spgims");
    			add_location(th53, file, 448, 8, 13818);
    			add_location(tr35, file, 446, 6, 13777);
    			attr_dev(th54, "class", "date svelte-spgims");
    			add_location(th54, file, 453, 8, 13923);
    			attr_dev(h517, "class", "svelte-spgims");
    			add_location(h517, file, 455, 10, 13966);
    			attr_dev(th55, "class", "svelte-spgims");
    			add_location(th55, file, 454, 8, 13951);
    			attr_dev(tr36, "class", "item svelte-spgims");
    			add_location(tr36, file, 452, 6, 13897);
    			attr_dev(th56, "class", "date svelte-spgims");
    			add_location(th56, file, 459, 8, 14038);
    			attr_dev(h518, "class", "single svelte-spgims");
    			add_location(h518, file, 461, 10, 14096);
    			attr_dev(th57, "class", "svelte-spgims");
    			add_location(th57, file, 460, 8, 14081);
    			add_location(tr37, file, 458, 6, 14025);
    			attr_dev(th58, "class", "date svelte-spgims");
    			add_location(th58, file, 465, 8, 14190);
    			attr_dev(h519, "class", "single svelte-spgims");
    			add_location(h519, file, 467, 10, 14248);
    			attr_dev(th59, "class", "svelte-spgims");
    			add_location(th59, file, 466, 8, 14233);
    			add_location(tr38, file, 464, 6, 14177);
    			add_location(br16, file, 472, 6, 14382);
    			attr_dev(th60, "class", "date svelte-spgims");
    			add_location(th60, file, 474, 8, 14421);
    			attr_dev(h520, "class", "svelte-spgims");
    			add_location(h520, file, 476, 10, 14464);
    			attr_dev(th61, "class", "svelte-spgims");
    			add_location(th61, file, 475, 8, 14449);
    			attr_dev(tr39, "class", "item svelte-spgims");
    			add_location(tr39, file, 473, 6, 14395);
    			attr_dev(th62, "class", "date svelte-spgims");
    			add_location(th62, file, 480, 8, 14527);
    			attr_dev(h521, "class", "single svelte-spgims");
    			add_location(h521, file, 482, 10, 14584);
    			attr_dev(th63, "class", "svelte-spgims");
    			add_location(th63, file, 481, 8, 14569);
    			add_location(tr40, file, 479, 6, 14514);
    			attr_dev(th64, "class", "date svelte-spgims");
    			add_location(th64, file, 488, 8, 14741);
    			attr_dev(h522, "class", "single svelte-spgims");
    			add_location(h522, file, 490, 10, 14798);
    			attr_dev(th65, "class", "svelte-spgims");
    			add_location(th65, file, 489, 8, 14783);
    			add_location(tr41, file, 487, 6, 14728);
    			attr_dev(th66, "class", "date svelte-spgims");
    			add_location(th66, file, 494, 8, 14892);
    			attr_dev(h523, "class", "single svelte-spgims");
    			add_location(h523, file, 496, 10, 14942);
    			attr_dev(th67, "class", "svelte-spgims");
    			add_location(th67, file, 495, 8, 14927);
    			add_location(tr42, file, 493, 6, 14879);
    			attr_dev(th68, "class", "date svelte-spgims");
    			add_location(th68, file, 503, 8, 15129);
    			attr_dev(h524, "class", "single svelte-spgims");
    			add_location(h524, file, 505, 10, 15179);
    			attr_dev(th69, "class", "svelte-spgims");
    			add_location(th69, file, 504, 8, 15164);
    			add_location(tr43, file, 502, 6, 15116);
    			attr_dev(th70, "class", "date svelte-spgims");
    			add_location(th70, file, 511, 8, 15331);
    			attr_dev(h525, "class", "single svelte-spgims");
    			add_location(h525, file, 513, 10, 15381);
    			attr_dev(th71, "class", "svelte-spgims");
    			add_location(th71, file, 512, 8, 15366);
    			add_location(tr44, file, 510, 6, 15318);
    			attr_dev(th72, "class", "date svelte-spgims");
    			add_location(th72, file, 520, 8, 15554);
    			attr_dev(h48, "class", "header svelte-spgims");
    			add_location(h48, file, 522, 10, 15597);
    			attr_dev(th73, "class", "svelte-spgims");
    			add_location(th73, file, 521, 8, 15582);
    			add_location(tr45, file, 519, 6, 15541);
    			attr_dev(th74, "class", "date svelte-spgims");
    			add_location(th74, file, 526, 8, 15680);
    			attr_dev(a12, "href", "https://youtu.be/fnr9XWvjJHw?t=1082");
    			attr_dev(a12, "class", "svelte-spgims");
    			add_location(a12, file, 529, 12, 15768);
    			add_location(i8, file, 533, 12, 15919);
    			attr_dev(h526, "class", "single press svelte-spgims");
    			add_location(h526, file, 528, 10, 15730);
    			attr_dev(th75, "class", "svelte-spgims");
    			add_location(th75, file, 527, 8, 15715);
    			add_location(tr46, file, 525, 6, 15667);
    			attr_dev(th76, "class", "date svelte-spgims");
    			add_location(th76, file, 538, 8, 16006);
    			attr_dev(a13, "href", "https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13");
    			attr_dev(a13, "class", "svelte-spgims");
    			add_location(a13, file, 541, 12, 16094);
    			add_location(i9, file, 548, 12, 16412);
    			attr_dev(h527, "class", "single press svelte-spgims");
    			add_location(h527, file, 540, 10, 16056);
    			attr_dev(th77, "class", "svelte-spgims");
    			add_location(th77, file, 539, 8, 16041);
    			add_location(tr47, file, 537, 6, 15993);
    			attr_dev(th78, "class", "date svelte-spgims");
    			add_location(th78, file, 553, 8, 16484);
    			attr_dev(a14, "href", "https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/");
    			attr_dev(a14, "class", "svelte-spgims");
    			add_location(a14, file, 556, 12, 16572);
    			add_location(i10, file, 562, 12, 16818);
    			attr_dev(h528, "class", "single press svelte-spgims");
    			add_location(h528, file, 555, 10, 16534);
    			attr_dev(th79, "class", "svelte-spgims");
    			add_location(th79, file, 554, 8, 16519);
    			add_location(tr48, file, 552, 6, 16471);
    			attr_dev(th80, "class", "date svelte-spgims");
    			add_location(th80, file, 567, 8, 16892);
    			attr_dev(a15, "href", "https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html");
    			attr_dev(a15, "class", "svelte-spgims");
    			add_location(a15, file, 570, 12, 16980);
    			add_location(i11, file, 576, 12, 17217);
    			attr_dev(h529, "class", "single press svelte-spgims");
    			add_location(h529, file, 569, 10, 16942);
    			attr_dev(th81, "class", "svelte-spgims");
    			add_location(th81, file, 568, 8, 16927);
    			add_location(tr49, file, 566, 6, 16879);
    			attr_dev(th82, "class", "date svelte-spgims");
    			add_location(th82, file, 581, 8, 17301);
    			attr_dev(a16, "href", "https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/");
    			attr_dev(a16, "class", "svelte-spgims");
    			add_location(a16, file, 584, 12, 17389);
    			add_location(i12, file, 590, 12, 17615);
    			attr_dev(h530, "class", "single press svelte-spgims");
    			add_location(h530, file, 583, 10, 17351);
    			attr_dev(th83, "class", "svelte-spgims");
    			add_location(th83, file, 582, 8, 17336);
    			add_location(tr50, file, 580, 6, 17288);
    			attr_dev(th84, "class", "date svelte-spgims");
    			add_location(th84, file, 595, 8, 17704);
    			attr_dev(a17, "href", "https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship");
    			attr_dev(a17, "class", "svelte-spgims");
    			add_location(a17, file, 598, 12, 17792);
    			add_location(i13, file, 604, 12, 18060);
    			attr_dev(h531, "class", "single press svelte-spgims");
    			add_location(h531, file, 597, 10, 17754);
    			attr_dev(th85, "class", "svelte-spgims");
    			add_location(th85, file, 596, 8, 17739);
    			add_location(tr51, file, 594, 6, 17691);
    			attr_dev(th86, "class", "date svelte-spgims");
    			add_location(th86, file, 609, 8, 18135);
    			attr_dev(a18, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			attr_dev(a18, "class", "svelte-spgims");
    			add_location(a18, file, 612, 12, 18223);
    			add_location(i14, file, 618, 12, 18467);
    			attr_dev(h532, "class", "single press svelte-spgims");
    			add_location(h532, file, 611, 10, 18185);
    			attr_dev(th87, "class", "svelte-spgims");
    			add_location(th87, file, 610, 8, 18170);
    			add_location(tr52, file, 608, 6, 18122);
    			attr_dev(th88, "class", "date svelte-spgims");
    			add_location(th88, file, 623, 8, 18548);
    			attr_dev(a19, "href", "https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems");
    			attr_dev(a19, "class", "svelte-spgims");
    			add_location(a19, file, 626, 12, 18636);
    			add_location(i15, file, 633, 12, 18923);
    			attr_dev(h533, "class", "single press svelte-spgims");
    			add_location(h533, file, 625, 10, 18598);
    			attr_dev(th89, "class", "svelte-spgims");
    			add_location(th89, file, 624, 8, 18583);
    			add_location(tr53, file, 622, 6, 18535);
    			attr_dev(th90, "class", "date svelte-spgims");
    			add_location(th90, file, 639, 8, 19022);
    			attr_dev(h49, "class", "header svelte-spgims");
    			add_location(h49, file, 641, 10, 19065);
    			attr_dev(th91, "class", "svelte-spgims");
    			add_location(th91, file, 640, 8, 19050);
    			add_location(tr54, file, 638, 6, 19009);
    			attr_dev(th92, "class", "date svelte-spgims");
    			add_location(th92, file, 645, 8, 19172);
    			attr_dev(h534, "class", "svelte-spgims");
    			add_location(h534, file, 647, 10, 19229);
    			attr_dev(p16, "class", "desc svelte-spgims");
    			add_location(p16, file, 648, 10, 19262);
    			attr_dev(i16, "class", "fab fa-github svelte-spgims");
    			add_location(i16, file, 655, 16, 19543);
    			attr_dev(button8, "class", "entry-link");
    			add_location(button8, file, 654, 14, 19499);
    			attr_dev(a20, "href", "https://github.com/vega/svelte-vega");
    			add_location(a20, file, 653, 12, 19438);
    			attr_dev(i17, "class", "fas fa-globe svelte-spgims");
    			add_location(i17, file, 662, 16, 19798);
    			attr_dev(button9, "class", "entry-link");
    			add_location(button9, file, 661, 14, 19754);
    			attr_dev(a21, "href", "https://vega.github.io/svelte-vega/?path=/story/svelte-vega-vega--demo");
    			add_location(a21, file, 658, 12, 19631);
    			attr_dev(div8, "class", "tags");
    			add_location(div8, file, 652, 10, 19407);
    			attr_dev(th93, "class", "svelte-spgims");
    			add_location(th93, file, 646, 8, 19214);
    			attr_dev(tr55, "class", "item svelte-spgims");
    			add_location(tr55, file, 644, 6, 19146);
    			attr_dev(tr56, "class", "buffer svelte-spgims");
    			add_location(tr56, file, 668, 6, 19920);
    			attr_dev(th94, "class", "date svelte-spgims");
    			add_location(th94, file, 670, 8, 19974);
    			attr_dev(h535, "class", "svelte-spgims");
    			add_location(h535, file, 672, 10, 20031);
    			attr_dev(p17, "class", "desc svelte-spgims");
    			add_location(p17, file, 673, 10, 20075);
    			attr_dev(i18, "class", "fab fa-medium svelte-spgims");
    			add_location(i18, file, 682, 16, 20429);
    			attr_dev(button10, "class", "entry-link");
    			add_location(button10, file, 681, 14, 20385);
    			attr_dev(a22, "href", "https://cabreraalex.medium.com/creating-reactive-jupyter-widgets-with-svelte-ef2fb580c05");
    			add_location(a22, file, 678, 12, 20244);
    			attr_dev(i19, "class", "fab fa-github svelte-spgims");
    			add_location(i19, file, 687, 16, 20642);
    			attr_dev(button11, "class", "entry-link");
    			add_location(button11, file, 686, 14, 20598);
    			attr_dev(a23, "href", "https://github.com/cabreraalex/widget-svelte-cookiecutter");
    			add_location(a23, file, 685, 12, 20515);
    			attr_dev(i20, "class", "fab fa-youtube svelte-spgims");
    			add_location(i20, file, 692, 16, 20835);
    			attr_dev(button12, "class", "entry-link");
    			add_location(button12, file, 691, 14, 20791);
    			attr_dev(a24, "href", "https://youtu.be/fnr9XWvjJHw?t=1082");
    			add_location(a24, file, 690, 12, 20730);
    			attr_dev(div9, "class", "tags");
    			add_location(div9, file, 677, 10, 20213);
    			attr_dev(th95, "class", "svelte-spgims");
    			add_location(th95, file, 671, 8, 20016);
    			attr_dev(tr57, "class", "item svelte-spgims");
    			add_location(tr57, file, 669, 6, 19948);
    			attr_dev(tr58, "class", "buffer svelte-spgims");
    			add_location(tr58, file, 698, 6, 20960);
    			attr_dev(th96, "class", "date svelte-spgims");
    			add_location(th96, file, 700, 8, 21014);
    			attr_dev(h536, "class", "svelte-spgims");
    			add_location(h536, file, 702, 10, 21071);
    			attr_dev(a25, "href", "https://delphi.cmu.edu/");
    			add_location(a25, file, 705, 66, 21297);
    			attr_dev(p18, "class", "desc svelte-spgims");
    			add_location(p18, file, 703, 10, 21137);
    			attr_dev(i21, "class", "fas fa-globe svelte-spgims");
    			add_location(i21, file, 712, 16, 21526);
    			attr_dev(button13, "class", "entry-link");
    			add_location(button13, file, 711, 14, 21482);
    			attr_dev(i22, "class", "fab fa-github svelte-spgims");
    			add_location(i22, file, 716, 18, 21716);
    			attr_dev(button14, "class", "entry-link");
    			add_location(button14, file, 715, 16, 21670);
    			attr_dev(a26, "href", "https://github.com/cmu-delphi/www-covidcast");
    			add_location(a26, file, 714, 14, 21599);
    			attr_dev(a27, "href", "https://covidcast.cmu.edu/");
    			add_location(a27, file, 710, 12, 21430);
    			attr_dev(div10, "class", "tags");
    			add_location(div10, file, 709, 10, 21399);
    			attr_dev(th97, "class", "svelte-spgims");
    			add_location(th97, file, 701, 8, 21056);
    			attr_dev(tr59, "class", "item svelte-spgims");
    			add_location(tr59, file, 699, 6, 20988);
    			attr_dev(tr60, "class", "buffer svelte-spgims");
    			add_location(tr60, file, 745, 6, 22594);
    			add_location(br17, file, 770, 40, 23458);
    			attr_dev(th98, "class", "date svelte-spgims");
    			add_location(th98, file, 770, 8, 23426);
    			attr_dev(h537, "class", "svelte-spgims");
    			add_location(h537, file, 772, 10, 23504);
    			attr_dev(h615, "class", "svelte-spgims");
    			add_location(h615, file, 773, 10, 23540);
    			attr_dev(p19, "class", "desc svelte-spgims");
    			add_location(p19, file, 774, 10, 23595);
    			attr_dev(i23, "class", "fas fa-rocket svelte-spgims");
    			add_location(i23, file, 783, 16, 23978);
    			attr_dev(button15, "class", "entry-link");
    			add_location(button15, file, 782, 14, 23934);
    			attr_dev(a28, "href", "https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space");
    			add_location(a28, file, 779, 12, 23792);
    			attr_dev(i24, "class", "far fa-newspaper svelte-spgims");
    			add_location(i24, file, 790, 16, 24231);
    			attr_dev(button16, "class", "entry-link");
    			add_location(button16, file, 789, 14, 24187);
    			attr_dev(a29, "href", "https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched");
    			add_location(a29, file, 786, 12, 24069);
    			attr_dev(div11, "class", "tags");
    			add_location(div11, file, 778, 10, 23761);
    			attr_dev(th99, "class", "svelte-spgims");
    			add_location(th99, file, 771, 8, 23489);
    			attr_dev(tr61, "class", "item svelte-spgims");
    			add_location(tr61, file, 769, 6, 23400);
    			attr_dev(tr62, "class", "buffer svelte-spgims");
    			add_location(tr62, file, 796, 6, 24366);
    			attr_dev(th100, "class", "date svelte-spgims");
    			add_location(th100, file, 798, 8, 24420);
    			attr_dev(h538, "class", "svelte-spgims");
    			add_location(h538, file, 800, 10, 24477);
    			attr_dev(p20, "class", "desc svelte-spgims");
    			add_location(p20, file, 801, 10, 24510);
    			attr_dev(i25, "class", "fas fa-globe svelte-spgims");
    			add_location(i25, file, 808, 16, 24801);
    			attr_dev(button17, "class", "entry-link");
    			add_location(button17, file, 807, 14, 24757);
    			attr_dev(a30, "href", "http://ctfs.github.io/resources/");
    			add_location(a30, file, 806, 12, 24699);
    			attr_dev(i26, "class", "fab fa-github svelte-spgims");
    			add_location(i26, file, 813, 16, 24992);
    			attr_dev(button18, "class", "entry-link");
    			add_location(button18, file, 812, 14, 24948);
    			attr_dev(a31, "href", "https://github.com/ctfs/resources");
    			add_location(a31, file, 811, 12, 24889);
    			attr_dev(div12, "class", "tags");
    			add_location(div12, file, 805, 10, 24668);
    			attr_dev(th101, "class", "svelte-spgims");
    			add_location(th101, file, 799, 8, 24462);
    			attr_dev(tr63, "class", "item svelte-spgims");
    			add_location(tr63, file, 797, 6, 24394);
    			attr_dev(th102, "class", "date svelte-spgims");
    			add_location(th102, file, 894, 8, 27336);
    			attr_dev(h410, "class", "header svelte-spgims");
    			add_location(h410, file, 896, 10, 27379);
    			attr_dev(th103, "class", "svelte-spgims");
    			add_location(th103, file, 895, 8, 27364);
    			add_location(tr64, file, 893, 6, 27323);
    			attr_dev(th104, "class", "date svelte-spgims");
    			add_location(th104, file, 900, 8, 27478);
    			attr_dev(h539, "class", "single svelte-spgims");
    			add_location(h539, file, 902, 10, 27527);
    			attr_dev(h540, "class", "single svelte-spgims");
    			add_location(h540, file, 903, 10, 27592);
    			attr_dev(h541, "class", "single svelte-spgims");
    			add_location(h541, file, 905, 12, 27743);
    			attr_dev(a32, "href", "https://www.hcii.cmu.edu/courses/applied-research-methods");
    			add_location(a32, file, 904, 10, 27662);
    			attr_dev(th105, "class", "svelte-spgims");
    			add_location(th105, file, 901, 8, 27512);
    			attr_dev(tr65, "class", "item svelte-spgims");
    			add_location(tr65, file, 899, 6, 27452);
    			attr_dev(th106, "class", "date svelte-spgims");
    			add_location(th106, file, 910, 8, 27865);
    			attr_dev(h542, "class", "single svelte-spgims");
    			add_location(h542, file, 913, 12, 27992);
    			attr_dev(a33, "href", "https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/");
    			add_location(a33, file, 912, 10, 27915);
    			attr_dev(h543, "class", "single svelte-spgims");
    			add_location(h543, file, 916, 12, 28124);
    			attr_dev(a34, "href", "http://poloclub.gatech.edu/cse6242/2018spring");
    			add_location(a34, file, 915, 10, 28055);
    			attr_dev(h544, "class", "single svelte-spgims");
    			add_location(h544, file, 919, 12, 28276);
    			attr_dev(a35, "href", "https://www.omscs.gatech.edu/cs-7641-machine-learning");
    			add_location(a35, file, 918, 10, 28199);
    			attr_dev(h545, "class", "single svelte-spgims");
    			add_location(h545, file, 922, 12, 28396);
    			attr_dev(a36, "href", "http://cx4230.gatech.edu/sp17/");
    			add_location(a36, file, 921, 10, 28342);
    			attr_dev(h546, "class", "single svelte-spgims");
    			add_location(h546, file, 924, 10, 28465);
    			attr_dev(th107, "class", "svelte-spgims");
    			add_location(th107, file, 911, 8, 27900);
    			attr_dev(tr66, "class", "item svelte-spgims");
    			add_location(tr66, file, 909, 6, 27839);
    			attr_dev(tr67, "class", "buffer svelte-spgims");
    			add_location(tr67, file, 982, 6, 30536);
    			attr_dev(table, "class", "svelte-spgims");
    			add_location(table, file, 17, 4, 466);
    			attr_dev(main, "class", "svelte-spgims");
    			add_location(main, file, 16, 2, 455);
    			attr_dev(div13, "id", "container");
    			attr_dev(div13, "class", "svelte-spgims");
    			add_location(div13, file, 15, 0, 432);
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
    			append_dev(tr27, t161);
    			append_dev(tr27, th39);
    			append_dev(th39, h511);
    			append_dev(th39, t163);
    			append_dev(th39, h610);
    			append_dev(table, t165);
    			append_dev(table, tr28);
    			append_dev(tr28, th40);
    			append_dev(th40, t166);
    			append_dev(th40, br9);
    			append_dev(th40, t167);
    			append_dev(th40, br10);
    			append_dev(th40, t168);
    			append_dev(tr28, t169);
    			append_dev(tr28, th41);
    			append_dev(th41, h512);
    			append_dev(th41, t171);
    			append_dev(th41, h611);
    			append_dev(th41, t173);
    			append_dev(th41, p12);
    			append_dev(table, t175);
    			append_dev(table, tr29);
    			append_dev(table, t176);
    			append_dev(table, tr30);
    			append_dev(tr30, th42);
    			append_dev(tr30, t178);
    			append_dev(tr30, th43);
    			append_dev(th43, h513);
    			append_dev(th43, t180);
    			append_dev(th43, h612);
    			append_dev(th43, t182);
    			append_dev(th43, p13);
    			append_dev(table, t184);
    			append_dev(table, tr31);
    			append_dev(tr31, th44);
    			append_dev(tr31, t185);
    			append_dev(tr31, th45);
    			append_dev(th45, h46);
    			append_dev(table, t187);
    			append_dev(table, tr32);
    			append_dev(tr32, th46);
    			append_dev(th46, t188);
    			append_dev(th46, br11);
    			append_dev(th46, t189);
    			append_dev(tr32, t190);
    			append_dev(tr32, th47);
    			append_dev(th47, h514);
    			append_dev(th47, t192);
    			append_dev(th47, h613);
    			append_dev(th47, t194);
    			append_dev(th47, p14);
    			append_dev(table, t196);
    			append_dev(table, br12);
    			append_dev(table, t197);
    			append_dev(table, tr33);
    			append_dev(tr33, th48);
    			append_dev(th48, t198);
    			append_dev(th48, br13);
    			append_dev(th48, t199);
    			append_dev(tr33, t200);
    			append_dev(tr33, th49);
    			append_dev(th49, h515);
    			append_dev(th49, t202);
    			append_dev(th49, h614);
    			append_dev(th49, t204);
    			append_dev(th49, p15);
    			append_dev(table, t206);
    			append_dev(table, br14);
    			append_dev(table, t207);
    			append_dev(table, tr34);
    			append_dev(tr34, th50);
    			append_dev(th50, t208);
    			append_dev(th50, br15);
    			append_dev(th50, t209);
    			append_dev(tr34, t210);
    			append_dev(tr34, th51);
    			append_dev(th51, h516);
    			append_dev(table, t212);
    			append_dev(table, tr35);
    			append_dev(tr35, th52);
    			append_dev(tr35, t213);
    			append_dev(tr35, th53);
    			append_dev(th53, h47);
    			append_dev(table, t215);
    			append_dev(table, tr36);
    			append_dev(tr36, th54);
    			append_dev(tr36, t216);
    			append_dev(tr36, th55);
    			append_dev(th55, h517);
    			append_dev(table, t218);
    			append_dev(table, tr37);
    			append_dev(tr37, th56);
    			append_dev(tr37, t220);
    			append_dev(tr37, th57);
    			append_dev(th57, h518);
    			append_dev(table, t222);
    			append_dev(table, tr38);
    			append_dev(tr38, th58);
    			append_dev(tr38, t224);
    			append_dev(tr38, th59);
    			append_dev(th59, h519);
    			append_dev(table, t226);
    			append_dev(table, br16);
    			append_dev(table, t227);
    			append_dev(table, tr39);
    			append_dev(tr39, th60);
    			append_dev(tr39, t228);
    			append_dev(tr39, th61);
    			append_dev(th61, h520);
    			append_dev(table, t230);
    			append_dev(table, tr40);
    			append_dev(tr40, th62);
    			append_dev(tr40, t232);
    			append_dev(tr40, th63);
    			append_dev(th63, h521);
    			append_dev(table, t234);
    			append_dev(table, tr41);
    			append_dev(tr41, th64);
    			append_dev(tr41, t236);
    			append_dev(tr41, th65);
    			append_dev(th65, h522);
    			append_dev(table, t238);
    			append_dev(table, tr42);
    			append_dev(tr42, th66);
    			append_dev(tr42, t240);
    			append_dev(tr42, th67);
    			append_dev(th67, h523);
    			append_dev(table, t242);
    			append_dev(table, tr43);
    			append_dev(tr43, th68);
    			append_dev(tr43, t244);
    			append_dev(tr43, th69);
    			append_dev(th69, h524);
    			append_dev(table, t246);
    			append_dev(table, tr44);
    			append_dev(tr44, th70);
    			append_dev(tr44, t248);
    			append_dev(tr44, th71);
    			append_dev(th71, h525);
    			append_dev(table, t250);
    			append_dev(table, tr45);
    			append_dev(tr45, th72);
    			append_dev(tr45, t251);
    			append_dev(tr45, th73);
    			append_dev(th73, h48);
    			append_dev(table, t253);
    			append_dev(table, tr46);
    			append_dev(tr46, th74);
    			append_dev(tr46, t255);
    			append_dev(tr46, th75);
    			append_dev(th75, h526);
    			append_dev(h526, a12);
    			append_dev(h526, t257);
    			append_dev(h526, i8);
    			append_dev(table, t259);
    			append_dev(table, tr47);
    			append_dev(tr47, th76);
    			append_dev(tr47, t261);
    			append_dev(tr47, th77);
    			append_dev(th77, h527);
    			append_dev(h527, a13);
    			append_dev(h527, t263);
    			append_dev(h527, i9);
    			append_dev(table, t265);
    			append_dev(table, tr48);
    			append_dev(tr48, th78);
    			append_dev(tr48, t267);
    			append_dev(tr48, th79);
    			append_dev(th79, h528);
    			append_dev(h528, a14);
    			append_dev(h528, t269);
    			append_dev(h528, i10);
    			append_dev(table, t271);
    			append_dev(table, tr49);
    			append_dev(tr49, th80);
    			append_dev(tr49, t273);
    			append_dev(tr49, th81);
    			append_dev(th81, h529);
    			append_dev(h529, a15);
    			append_dev(h529, t275);
    			append_dev(h529, i11);
    			append_dev(table, t277);
    			append_dev(table, tr50);
    			append_dev(tr50, th82);
    			append_dev(tr50, t279);
    			append_dev(tr50, th83);
    			append_dev(th83, h530);
    			append_dev(h530, a16);
    			append_dev(h530, t281);
    			append_dev(h530, i12);
    			append_dev(table, t283);
    			append_dev(table, tr51);
    			append_dev(tr51, th84);
    			append_dev(tr51, t285);
    			append_dev(tr51, th85);
    			append_dev(th85, h531);
    			append_dev(h531, a17);
    			append_dev(h531, t287);
    			append_dev(h531, i13);
    			append_dev(table, t289);
    			append_dev(table, tr52);
    			append_dev(tr52, th86);
    			append_dev(tr52, t291);
    			append_dev(tr52, th87);
    			append_dev(th87, h532);
    			append_dev(h532, a18);
    			append_dev(h532, t293);
    			append_dev(h532, i14);
    			append_dev(table, t295);
    			append_dev(table, tr53);
    			append_dev(tr53, th88);
    			append_dev(tr53, t297);
    			append_dev(tr53, th89);
    			append_dev(th89, h533);
    			append_dev(h533, a19);
    			append_dev(h533, t299);
    			append_dev(h533, i15);
    			append_dev(table, t301);
    			append_dev(table, tr54);
    			append_dev(tr54, th90);
    			append_dev(tr54, t302);
    			append_dev(tr54, th91);
    			append_dev(th91, h49);
    			append_dev(table, t304);
    			append_dev(table, tr55);
    			append_dev(tr55, th92);
    			append_dev(tr55, t306);
    			append_dev(tr55, th93);
    			append_dev(th93, h534);
    			append_dev(th93, t308);
    			append_dev(th93, p16);
    			append_dev(th93, t310);
    			append_dev(th93, div8);
    			append_dev(div8, a20);
    			append_dev(a20, button8);
    			append_dev(button8, i16);
    			append_dev(button8, t311);
    			append_dev(div8, t312);
    			append_dev(div8, a21);
    			append_dev(a21, button9);
    			append_dev(button9, i17);
    			append_dev(button9, t313);
    			append_dev(table, t314);
    			append_dev(table, tr56);
    			append_dev(table, t315);
    			append_dev(table, tr57);
    			append_dev(tr57, th94);
    			append_dev(tr57, t317);
    			append_dev(tr57, th95);
    			append_dev(th95, h535);
    			append_dev(th95, t319);
    			append_dev(th95, p17);
    			append_dev(th95, t321);
    			append_dev(th95, div9);
    			append_dev(div9, a22);
    			append_dev(a22, button10);
    			append_dev(button10, i18);
    			append_dev(button10, t322);
    			append_dev(div9, t323);
    			append_dev(div9, a23);
    			append_dev(a23, button11);
    			append_dev(button11, i19);
    			append_dev(button11, t324);
    			append_dev(div9, t325);
    			append_dev(div9, a24);
    			append_dev(a24, button12);
    			append_dev(button12, i20);
    			append_dev(button12, t326);
    			append_dev(table, t327);
    			append_dev(table, tr58);
    			append_dev(table, t328);
    			append_dev(table, tr59);
    			append_dev(tr59, th96);
    			append_dev(tr59, t330);
    			append_dev(tr59, th97);
    			append_dev(th97, h536);
    			append_dev(th97, t332);
    			append_dev(th97, p18);
    			append_dev(p18, t333);
    			append_dev(p18, a25);
    			append_dev(p18, t335);
    			append_dev(th97, t336);
    			append_dev(th97, div10);
    			append_dev(div10, a27);
    			append_dev(a27, button13);
    			append_dev(button13, i21);
    			append_dev(button13, t337);
    			append_dev(a27, t338);
    			append_dev(a27, a26);
    			append_dev(a26, button14);
    			append_dev(button14, i22);
    			append_dev(button14, t339);
    			append_dev(table, t340);
    			append_dev(table, tr60);
    			append_dev(table, t341);
    			append_dev(table, tr61);
    			append_dev(tr61, th98);
    			append_dev(th98, t342);
    			append_dev(th98, br17);
    			append_dev(th98, t343);
    			append_dev(tr61, t344);
    			append_dev(tr61, th99);
    			append_dev(th99, h537);
    			append_dev(th99, t346);
    			append_dev(th99, h615);
    			append_dev(th99, t348);
    			append_dev(th99, p19);
    			append_dev(th99, t350);
    			append_dev(th99, div11);
    			append_dev(div11, a28);
    			append_dev(a28, button15);
    			append_dev(button15, i23);
    			append_dev(button15, t351);
    			append_dev(div11, t352);
    			append_dev(div11, a29);
    			append_dev(a29, button16);
    			append_dev(button16, i24);
    			append_dev(button16, t353);
    			append_dev(table, t354);
    			append_dev(table, tr62);
    			append_dev(table, t355);
    			append_dev(table, tr63);
    			append_dev(tr63, th100);
    			append_dev(tr63, t357);
    			append_dev(tr63, th101);
    			append_dev(th101, h538);
    			append_dev(th101, t359);
    			append_dev(th101, p20);
    			append_dev(th101, t361);
    			append_dev(th101, div12);
    			append_dev(div12, a30);
    			append_dev(a30, button17);
    			append_dev(button17, i25);
    			append_dev(button17, t362);
    			append_dev(div12, t363);
    			append_dev(div12, a31);
    			append_dev(a31, button18);
    			append_dev(button18, i26);
    			append_dev(button18, t364);
    			append_dev(table, t365);
    			append_dev(table, tr64);
    			append_dev(tr64, th102);
    			append_dev(tr64, t366);
    			append_dev(tr64, th103);
    			append_dev(th103, h410);
    			append_dev(table, t368);
    			append_dev(table, tr65);
    			append_dev(tr65, th104);
    			append_dev(tr65, t370);
    			append_dev(tr65, th105);
    			append_dev(th105, h539);
    			append_dev(th105, t372);
    			append_dev(th105, h540);
    			append_dev(th105, t374);
    			append_dev(th105, a32);
    			append_dev(a32, h541);
    			append_dev(table, t376);
    			append_dev(table, tr66);
    			append_dev(tr66, th106);
    			append_dev(tr66, t378);
    			append_dev(tr66, th107);
    			append_dev(th107, a33);
    			append_dev(a33, h542);
    			append_dev(th107, t380);
    			append_dev(th107, a34);
    			append_dev(a34, h543);
    			append_dev(th107, t382);
    			append_dev(th107, a35);
    			append_dev(a35, h544);
    			append_dev(th107, t384);
    			append_dev(th107, a36);
    			append_dev(a36, h545);
    			append_dev(th107, t386);
    			append_dev(th107, h546);
    			append_dev(table, t388);
    			append_dev(table, tr67);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
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
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = p => `<a class='${p.name === "Ángel Alexander Cabrera"
? "me-author-cv"
: "author-cv"}' href='${p.website}'>${p.name}</a>`;

    const func_1 = p => `<a class='${p.name === "Ángel Alexander Cabrera"
? "me-author-cv"
: "author-cv"}' href='${p.website}'>${p.name}</a>`;

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Cv", slots, []);

    	onMount(() => {
    		const mvp = document.getElementById("viewport");
    		mvp.setAttribute("content", "width=500");
    		window.scrollTo(0, 0);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Cv> was created with unknown prop '${key}'`);
    	});

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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cv",
    			options,
    			id: create_fragment$1.name
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

    /* src/App.svelte generated by Svelte v3.38.3 */

    function create_fragment(ctx) {
    	let router;
    	let current;
    	router = new Router({ props: { routes }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
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
    			destroy_component(router, detaching);
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

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

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

    	$$self.$capture_state = () => ({ Router, routes });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
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
