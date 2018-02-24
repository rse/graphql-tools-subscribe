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
export default class gtsSubscription {
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
                throw new Error("subscribe: only allowed on WebSocket connection")

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

            /*  add to record  */
            await this.keyval.acquire()
            await this.keyval.put(`sid:${sid},cid:${cid}`, "subscribed")
            await this.keyval.release()

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

            /*  delete from record  */
            await this.keyval.acquire()
            let subscription = await this.keyval.get(`sid:${sid},cid:${cid}`)
            if (subscription === undefined) {
                await this.keyval.release()
                throw new Error(`no such subscription "${sid}"`)
            }
            await this.keyval.del(`cid:${cid},sid:${sid}`)
            await this.keyval.release()

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
            await this.keyval.acquire()
            let keys = await this.keyval.keys(`sid:*,cid:${cid}`)
            let sids = keys.map((key) => key.replace(/^sid:(.+?),cid:.+$/, "$1"))
            await this.keyval.release()

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

            /*  determine subscriptions  */
            await this.keyval.acquire()
            let subscription = await this.keyval.get(`sid:${sid},cid:${cid}`)
            if (subscription === undefined) {
                await this.keyval.release()
                throw new Error(`no such subscription "${sid}"`)
            }
            else if (subscription === "paused") {
                await this.keyval.release()
                throw new Error(`subscription "${sid}" already paused`)
            }
            await this.keyval.put(`sid:${sid},cid:${cid}`, "paused")
            await this.keyval.release()

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

            /*  determine subscriptions  */
            await this.keyval.acquire()
            let subscription = await this.keyval.get(`sid:${sid},cid:${cid}`)
            if (subscription === undefined) {
                await this.keyval.release()
                throw new Error(`no such subscription "${sid}"`)
            }
            else if (subscription !== "paused") {
                await this.keyval.release()
                throw new Error(`subscription "${sid}" not paused`)
            }
            await this.keyval.put(`sid:${sid},cid:${cid}`, "subscribed")
            await this.keyval.release()

            /*  return no result  */
            return {}
        }
    }
}

