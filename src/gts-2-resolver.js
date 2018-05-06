/*
**  GraphQL-Tools-Subscribe -- Subscription Framework for GraphQL-Tools
**  Copyright (c) 2016-2018 Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*  the API mixin class  */
export default class gtsResolver {
    /*  the factory methods for resolving "Subscription" root type  */
    schemaSubscription () {
        return "" +
            "#   Access the GraphQL Subscription service.\n" +
            "_Subscription: _Subscription"
    }
    resolverSubscription () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("_Subscription: only allowed on WebSocket connection")

            /*  provide a wrapper object containing the unique connection id  */
            return {
                cid: ctx.scope.connection !== null ? ctx.scope.connection.cid : "<none>"
            }
        }
    }

    /*  the factory methods for resolving "subscribe" (mutation)  */
    schemaSubscribe () {
        return "" +
            "#   Subscribe to the current GraphQL query\n" +
            "#   and retrieve its unique subscription id (SID).\n" +
            "subscribe: UUID!"
    }
    resolverSubscribe () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("subscribe: only allowed on WebSocket connection")
            if (info && info.operation && info.operation.operation !== "query")
                throw new Error("subscribe: only allowed in GraphQL \"query\" operation")

            /*  determine parameters  */
            let cid = obj.cid
            let sid = ctx.scope.sid

            /*  enable subscription  */
            if (ctx.scope.state !== "unsubscribed")
                throw new Error("subscribe: failed to subscribe to GraphQL query, " +
                    `because it is in state "${ctx.scope.state}" (but expected "unsubscribed")`)
            ctx.scope.state = "subscribed"

            /*  drop an event about the subscription  */
            ctx.scope.api.emit("scope-subscribe", { sid: sid, cid: cid })
            ctx.scope.api.emit("debug", `scope-subscribe sid=${sid} cid=${cid}`)

            /*  return result  */
            return sid
        }
    }

    /*  the factory methods for resolving "unsubscribe" (mutation)  */
    schemaUnsubscribe (prefix = "") {
        return "" +
            "#   Unsubscribe from the GraphQL query\n" +
            "#   identified by the unique subscription id (SID).\n" +
            "unsubscribe(sid: UUID!): Void\n"
    }
    resolverUnsubscribe () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("unsubscribe: only allowed on WebSocket connection")
            if (info && info.operation && info.operation.operation !== "mutation")
                throw new Error("unsubscribe: only allowed in GraphQL \"mutation\" operation")

            /*  determine parameters  */
            let cid = obj.cid
            let sid = args.sid

            /*  disable subscription  */
            let found = false
            let conn = ctx.scope.connection
            conn.scopes.forEach((scope) => {
                if (scope.sid !== sid)
                    return
                if (scope.state === "unsubscribed")
                    throw new Error("unsubscribe: failed to unsubscribe from GraphQL query, " +
                        "because it is already in state \"unsubscribed\"")
                scope.destroy()
                found = true
            })
            if (!found)
                throw new Error(`unsubscribe: no such GraphQL query subscription "${sid}" found`)

            /*  drop an event about the unsubscription  */
            ctx.scope.api.emit("scope-unsubscribe", { sid: sid, cid: cid })
            ctx.scope.api.emit("debug", `scope-unsubscribe sid=${sid} cid=${cid}`)

            /*  return no result  */
            return {}
        }
    }

    /*  the factory methods for resolving "subscriptions" (query)  */
    schemaSubscriptions (prefix = "") {
        return "" +
            "#   Retrieve all (or just the outdated) active subscription ids (SIDs).\n" +
            "subscriptions: [UUID]!\n"
    }
    resolverSubscriptions () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("subscription: only allowed on WebSocket connection")

            /*  determine parameters  */
            let cid = obj.cid

            /*  determine subscriptions  */
            let sids = []
            let conn = ctx.scope.connection
            conn.scopes.forEach((scope) => {
                if (scope.state === "subscribed")
                    sids.push(scope.sid)
            })

            /*  drop an event about the subscriptions  */
            ctx.scope.api.emit("scope-subscriptions", { sids: sids, cid: cid })
            ctx.scope.api.emit("debug", `scope-subscriptions sids=${sids.join(",")} cid=${cid}`)

            /*  return result  */
            return sids
        }
    }

    /*  the factory methods for resolving "pause" (mutation)  */
    schemaPause (prefix = "") {
        return "" +
            "#   Pause active subscription,\n" +
            "#   identified by the unique subscription id (SID).\n" +
            "pause(sid: UUID!): Void\n"
    }
    resolverPause () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("pause: only allowed on WebSocket connection")
            if (info && info.operation && info.operation.operation !== "mutation")
                throw new Error("pause: only allowed in GraphQL \"mutation\" operation")

            /*  determine parameters  */
            let cid = obj.cid
            let sid = args.sid

            /*  pause subscription  */
            let found = false
            let conn = ctx.scope.connection
            conn.scopes.forEach((scope) => {
                if (scope.sid !== sid)
                    return
                if (scope.state !== "subscribed")
                    throw new Error("pause: failed to pause GraphQL query subscription, " +
                        `because it is in state "${scope.state}" (but expected "subscribed")`)
                scope.state = "paused"
                found = true
            })
            if (!found)
                throw new Error(`pause: no such GraphQL query subscription "${sid}" found`)

            /*  drop an event about the pausing  */
            ctx.scope.api.emit("scope-pause", { sid: sid, cid: cid })
            ctx.scope.api.emit("debug", `scope-pause sid=${sid} cid=${cid}`)

            /*  return no result  */
            return {}
        }
    }

    /*  the factory methods for resolving "resume" (mutation)  */
    schemaResume (prefix = "") {
        return "" +
            "#   Resume active subscription,\n" +
            "#   identified by the unique subscription id (SID).\n" +
            "resume(sid: UUID!): Void\n"
    }
    resolverResume () {
        return async (obj, args, ctx, info) => {
            /*  sanity check usage  */
            if (!ctx.scope)
                throw new Error("resume: only allowed on WebSocket connection")
            if (info && info.operation && info.operation.operation !== "mutation")
                throw new Error("resume: only allowed in GraphQL \"mutation\" operation")

            /*  determine parameters  */
            let cid = obj.cid
            let sid = args.sid

            /*  resume subscription  */
            let found = false
            let conn = ctx.scope.connection
            conn.scopes.forEach((scope) => {
                if (scope.sid !== sid)
                    return
                if (scope.state !== "paused")
                    throw new Error("resume: failed to resume GraphQL query subscription, " +
                        `because it is in state "${scope.state}" (but expected "paused")`)
                scope.state = "subscribed"
                if (scope.outdated) {
                    scope.outdated = false
                    setTimeout(() => this.__scopeOutdatedEvent([ scope.id ]), 0)
                }
                found = true
            })
            if (!found)
                throw new Error(`resume: no such GraphQL query subscription "${sid}" found`)

            /*  drop an event about the resuming  */
            ctx.scope.api.emit("scope-resume", { sid: sid, cid: cid })
            ctx.scope.api.emit("debug", `scope-resume sid=${sid} cid=${cid}`)

            /*  return no result  */
            return {}
        }
    }
}

