import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/pricing.ts
/** Price table (元 / 百万 tokens). Off-peak = half of peak. */
const PRICING = {
	"deepseek-v4-flash": {
		cacheHit: {
			offpeak: .05,
			peak: .1
		},
		input: {
			offpeak: 1.5,
			peak: 3
		},
		output: {
			offpeak: 4.5,
			peak: 9
		}
	},
	"deepseek-v4-pro": {
		cacheHit: {
			offpeak: .15,
			peak: .3
		},
		input: {
			offpeak: 4.5,
			peak: 9
		},
		output: {
			offpeak: 13.5,
			peak: 27
		}
	}
};
/** Fallback pricing for unknown model ids. */
const DEFAULT_MODEL = "deepseek-v4-pro";
const BEIJING_OFFSET_MS$1 = 288e5;
/** Whether `ms` falls in a Beijing peak window. */
function isPeak(ms) {
	const hour = new Date(ms + BEIJING_OFFSET_MS$1).getUTCHours();
	return hour >= 9 && hour < 12 || hour >= 14 && hour < 18;
}
/** Resolve a model id to a pricing row, defaulting to `deepseek-v4-pro`. */
function pricingFor(model) {
	if (model != null && model !== "") {
		if (model.includes("flash")) return PRICING["deepseek-v4-flash"];
		if (model.includes("pro")) return PRICING["deepseek-v4-pro"];
		const exact = PRICING[model];
		if (exact !== void 0) return exact;
	}
	return PRICING[DEFAULT_MODEL];
}
/** Cost in yuan for one model call's token counters at a timestamp. */
function costFor(model, counters, timeMs) {
	const pricing = pricingFor(model);
	const peak = isPeak(timeMs);
	const inputPrice = peak ? pricing.input.peak : pricing.input.offpeak;
	const cachePrice = peak ? pricing.cacheHit.peak : pricing.cacheHit.offpeak;
	const outputPrice = peak ? pricing.output.peak : pricing.output.offpeak;
	return (counters.input * inputPrice + counters.cacheHit * cachePrice + counters.output * outputPrice) / 1e6;
}
//#endregion
//#region src/index.ts
/**
* DeepSeek usage/cost — Host half.
*
* A Typert Remote service (`usageCost`) that aggregates `assistant/message`
* session events into token buckets and billed cost, with a 3-hour TTL cache
* plus stale-while-revalidate. The Client reaches it through the generated
* `@frostgao/dsh-usage-cost/remote` contribution.
*
* @module @frostgao/dsh-usage-cost
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Cache freshness window (3 hours). */
const TTL_MS = 108e5;
/** Revalidate in the background once a cached entry is this old. */
const SWR_MS = TTL_MS / 2;
const HOUR_MS = 36e5;
const DAY_MS = 24 * HOUR_MS;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;
function emptyAccumulator() {
	return {
		input: 0,
		cacheHit: 0,
		output: 0,
		cost: 0
	};
}
function addAccumulator(target, input, cacheHit, output, cost) {
	target.input += input;
	target.cacheHit += cacheHit;
	target.output += output;
	target.cost += cost;
}
/** Beijing (UTC+8) midnight epoch ms for the day containing `ms`. */
function beijingDayStart(ms) {
	const shifted = ms + BEIJING_OFFSET_MS;
	const date = new Date(shifted);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - BEIJING_OFFSET_MS;
}
/** Resolve a request's inclusive [from, to) window. */
function resolveRange(request) {
	const now = Date.now();
	switch (request.range) {
		case "24h": return {
			from: now - DAY_MS,
			to: now
		};
		case "1w": {
			const start = beijingDayStart(now);
			return {
				from: start - 6 * DAY_MS,
				to: start + DAY_MS
			};
		}
		case "1m": {
			const start = beijingDayStart(now);
			return {
				from: start - 29 * DAY_MS,
				to: start + DAY_MS
			};
		}
		case "custom": {
			const fallbackFrom = now - DAY_MS;
			const from = request.from ?? fallbackFrom;
			const to = request.to ?? now;
			return from <= to ? {
				from,
				to
			} : {
				from: to,
				to: from
			};
		}
		default: {
			const start = beijingDayStart(now);
			return {
				from: start,
				to: start + DAY_MS
			};
		}
	}
}
function formatHour(ms) {
	const hour = new Date(ms + BEIJING_OFFSET_MS).getUTCHours();
	return `${String(hour)}:00`;
}
function formatDay(ms) {
	const date = new Date(ms + BEIJING_OFFSET_MS);
	return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}
/** Plan the time axis: today/24h by hour, week/month by day, custom by span. */
function planBuckets(range, from, to) {
	const duration = to - from;
	if (range === "1d" || range === "24h") {
		const count = 24;
		const labels = [];
		for (let i = 0; i < count; i++) labels.push(formatHour(from + i * HOUR_MS));
		return {
			kind: "hour",
			count,
			size: HOUR_MS,
			labels
		};
	}
	if (range === "1w" || range === "1m") {
		const count = range === "1w" ? 7 : 30;
		const labels = [];
		for (let i = 0; i < count; i++) labels.push(formatDay(from + i * DAY_MS));
		return {
			kind: "day",
			count,
			size: DAY_MS,
			labels
		};
	}
	const hourly = duration <= 48 * HOUR_MS;
	const rawCount = Math.ceil(duration / (hourly ? HOUR_MS : DAY_MS));
	const count = Math.min(120, Math.max(1, rawCount));
	const size = duration / count;
	const labels = [];
	for (let i = 0; i < count; i++) labels.push(hourly ? formatHour(from + i * size) : formatDay(from + i * size));
	return {
		kind: hourly ? "hour" : "day",
		count,
		size,
		labels
	};
}
function bucketIndex(time, from, plan) {
	const index = Math.floor((time - from) / plan.size);
	return Math.max(0, Math.min(plan.count - 1, index));
}
/** Extract the token counters that participate in billing. */
function countersOf(usage) {
	return {
		input: usage?.inputTokens ?? 0,
		cacheHit: usage?.cacheReadTokens ?? 0,
		output: usage?.outputTokens ?? 0
	};
}
/** Model short name for one assistant/message event. */
function modelOf(event) {
	const data = event.data;
	return data.message?.source?.model ?? data.provenance?.model ?? "";
}
/** Fold a readable session title from its first user message. */
function sessionTitle(events, header) {
	for (const event of events) {
		if (event.type !== "user/message") continue;
		const text = contentText(event.data.content);
		if (text !== "") return truncate(text, 60);
	}
	return truncate(String(header.id ?? ""), 20) || "会话";
}
function contentText(content) {
	if (!Array.isArray(content)) return "";
	return content.map((block) => {
		if (block !== null && typeof block === "object" && typeof block.text === "string") return block.text;
		return "";
	}).filter(Boolean).join(" ").trim();
}
function truncate(text, max) {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
/**
* Aggregate usage/cost across the live-preferred session corpus.
* @typert service usageCost
*/
let UsageCostService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _usage_decorators;
	let _usageSession_decorators;
	return class UsageCostService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_usage_decorators = [Remote("usage")];
			_usageSession_decorators = [Remote("usageSession")];
			__esDecorate(this, null, _usage_decorators, {
				kind: "method",
				name: "usage",
				static: false,
				private: false,
				access: {
					has: (obj) => "usage" in obj,
					get: (obj) => obj.usage
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _usageSession_decorators, {
				kind: "method",
				name: "usageSession",
				static: false,
				private: false,
				access: {
					has: (obj) => "usageSession" in obj,
					get: (obj) => obj.usageSession
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["sessionQuery"];
		cache = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map());
		inflight = /* @__PURE__ */ new Map();
		constructor(ctx) {
			super(ctx, "usageCost");
		}
		/**
		* Aggregate usage/cost for a preset or custom range.
		* @param request - range selector, optional model filter, and cache controls.
		* @returns totals, time buckets, per-session breakdown, and observed models.
		*/
		async usage(request) {
			if (request.custom === true || request.refresh === true) {
				const data = await this.compute(request);
				if (request.custom !== true) this.cache.set(this.cacheKey(request), {
					at: Date.now(),
					data
				});
				return data;
			}
			const key = this.cacheKey(request);
			const cached = this.cache.get(key);
			if (cached !== void 0 && Date.now() - cached.at < TTL_MS) {
				if (Date.now() - cached.at >= SWR_MS) this.revalidate(key, request);
				return cached.data;
			}
			const pending = this.inflight.get(key);
			if (pending !== void 0) return pending;
			const task = this.compute(request);
			this.inflight.set(key, task);
			try {
				const data = await task;
				this.cache.set(key, {
					at: Date.now(),
					data
				});
				return data;
			} finally {
				this.inflight.delete(key);
			}
		}
		/**
		* Exact total cost for one session.
		* @param request - the session to total.
		* @returns the billed tokens and cost for that session's assistant messages.
		*/
		async usageSession(request) {
			const snapshot = await this.ctx.sessionQuery.readSession(request.sessionId);
			const total = emptyAccumulator();
			for (const event of snapshot.events) {
				if (event.type !== "assistant/message") continue;
				const data = event.data;
				if (data.usage === void 0) continue;
				const counters = countersOf(data.usage);
				const cost = costFor(modelOf(event), counters, event.time);
				addAccumulator(total, counters.input, counters.cacheHit, counters.output, cost);
			}
			return {
				cost: total.cost,
				input: total.input,
				cacheHit: total.cacheHit,
				output: total.output
			};
		}
		cacheKey(request) {
			return `${request.range}\u0000${request.model ?? ""}`;
		}
		async revalidate(key, request) {
			if (this.inflight.has(key)) return;
			const task = this.compute(request);
			this.inflight.set(key, task);
			try {
				const data = await task;
				this.cache.set(key, {
					at: Date.now(),
					data
				});
			} finally {
				this.inflight.delete(key);
			}
		}
		async compute(request) {
			const range = resolveRange(request);
			const plan = planBuckets(request.range, range.from, range.to);
			const totals = emptyAccumulator();
			const buckets = Array.from({ length: plan.count }, () => emptyAccumulator());
			const perSession = /* @__PURE__ */ new Map();
			const models = /* @__PURE__ */ new Set();
			const records = await this.ctx.sessionQuery.listSessions();
			for (const record of records) {
				let snapshot;
				try {
					snapshot = await this.ctx.sessionQuery.readSession(record.header.id);
				} catch {
					continue;
				}
				const sessionTotal = emptyAccumulator();
				for (const event of snapshot.events) {
					if (event.type !== "assistant/message") continue;
					if (event.time < range.from || event.time >= range.to) continue;
					const model = modelOf(event);
					if (model !== "") models.add(model);
					if (request.model !== void 0 && request.model !== "" && model !== request.model) continue;
					const data = event.data;
					if (data.usage === void 0) continue;
					const counters = countersOf(data.usage);
					const cost = costFor(model, counters, event.time);
					addAccumulator(totals, counters.input, counters.cacheHit, counters.output, cost);
					addAccumulator(buckets[bucketIndex(event.time, range.from, plan)], counters.input, counters.cacheHit, counters.output, cost);
					addAccumulator(sessionTotal, counters.input, counters.cacheHit, counters.output, cost);
				}
				if (sessionTotal.input > 0 || sessionTotal.cacheHit > 0 || sessionTotal.output > 0 || sessionTotal.cost > 0) perSession.set(String(record.header.id), {
					title: sessionTitle(snapshot.events, snapshot.session),
					...sessionTotal
				});
			}
			const values = buckets.map((bucket) => ({
				input: bucket.input,
				cacheHit: bucket.cacheHit,
				output: bucket.output,
				cost: bucket.cost
			}));
			const bucketResult = {
				kind: plan.kind,
				labels: plan.labels,
				values
			};
			return {
				totals: {
					input: totals.input,
					cacheHit: totals.cacheHit,
					output: totals.output,
					cost: totals.cost
				},
				buckets: bucketResult,
				perSession: [...perSession.entries()].map(([id, entry]) => ({
					id,
					title: entry.title,
					cost: entry.cost,
					input: entry.input,
					cacheHit: entry.cacheHit,
					output: entry.output
				})).sort((left, right) => right.cost - left.cost),
				models: [...models].sort()
			};
		}
	};
})();
//#endregion
export { UsageCostService, UsageCostService as default };
