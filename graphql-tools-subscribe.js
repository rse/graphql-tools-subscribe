/*
**  GraphQL-Tools-Subscribe -- Subscription Framework for GraphQL-Tools
**  Copyright (c) 2016 Ralf S. Engelschall <rse@engelschall.com>
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

import UUID       from "pure-uuid"
import capitalize from "capitalize"

/*  the default in-core handler  */
class GraphQLToolsSubscribeHandlerInCore {
    constructor (gs) {
        this.gs    = gs
        this.store = {}
    }

    /*  add client-specific subscription  */
    onSubscribe (cid, sid) {
        if (!this.store[sid])
            this.store[sid] = {}
        this.store[sid].cid = cid
    }

    /*  list client-specific subscriptions  */
    onSubscriptions (cid, outdated) {
        let sids = Object.keys(this.store)
            .filter((sid) => this.store[sid].cid === cid)
        if (outdated)
            sids = sids.filter((sid) => this.store[sid].outdated)
        return sids
    }

    /*  delete client-specific subscriptions  */
    onUnsubscribe (cid, sid) {
        if (this.store[sid])
            delete this.store[sid]
    }

    /*  receive a new scope  */
    onScope (sid, scope) {
        /*  outdate existing scopes (in case of any write operations)  */
        if (this.gs.scopeHasWriteOp(scope)) {
            Object.keys(this.store).forEach((other) => {
                if (other !== sid && this.store[other].scope)
                    if (this.gs.scopeInvalidated(scope, this.store[other].scope))
                        this.store[other].outdate = true
            })
        }

        /*  store scopes (in case of any read operations)  */
        if (this.gs.scopeHasReadOp(scope)) {
            if (!this.store[sid])
                this.store[sid] = {}
            this.store[sid].scope   = scope
            this.store[sid].outdate = false
        }
    }
}

/*  the API class  */
export default class GraphQLToolsSubscribe {
    constructor (query) {
        this.setQuery(query)
        this.setHandler(GraphQLToolsSubscribeHandlerInCore)
        this.scopeBegin()
    }

    /*  set the GraphQL query string  */
    setQuery (query = "") {
        this.query = query

        /*  generate short subscription id from query  */
        let ns = new UUID(5, "ns:URL", "http://engelschall.com/ns/graphql-tools-subscribe")
        this.sid = (new UUID(5, ns, query)).format()
        return this
    }

    /*  set the storage handler  */
    setHandler (Handler) {
        this.handler = new Handler(this)
        return this
    }

    /*  start scope  */
    scopeBegin () {
        this.scope = {}
        return this
    }

    /*  add entry to scope  */
    scopeAdd (oid, type, action, via, onto) {
        let op = `${action}:${via}:${onto}`
        let regexp = new RegExp("(?:" +
                  "read:direct:(?:one|many|all)" +
            "|" + "read:relation:(?:many|all)" +
            "|" + "create:direct:one" +
            "|" + "update:direct:(?:one|many)" +
            "|" + "delete:direct:one" +
        ")")
        if (!regexp.test(op))
            throw new Error(`[graphql-tools-subscribe]: scopeAdd: ` +
                `invalid argument(s): combination of action+via+onto not allowed`)
        if (this.scope[type] === undefined)
            this.scope[type] = {}
        if (this.scope[type][op] === undefined)
            this.scope[type][op] = []
        this.scope[type][op].push(oid)
        return this
    }

    /*  end scope (successfully)  */
    scopeCommit () {
        this.handler.onScope(this.sid, this.scope)
        this.scope = {}
        return this
    }

    /*  end scope (unsuccessfully)  */
    scopeReject () {
        this.scope = {}
        return this
    }

    /*  parse the operation string  */
    __opParse (op) {
        let m = op.match(/^(read|create|update|delete):(direct|relation):(one|many|all)$/)
        if (m === null)
            throw new Error(`internal error: invalid operation "${op}"`)
        return { action: m[1], via: m[2], onto: m[3] }
    }

    /*  check whether scope has any read operations  */
    scopeHasReadOp (scope) {
        let types = Object.keys(scope)
        for (var i = 0; i < types.length; i++) {
            let ops = Object.keys(scope[types[i]])
            for (var j = 0; j < ops.length; j++) {
                let info = this.__opParse(ops[j])
                if (info.action === "read")
                    return true
            }
        }
        return false
    }

    /*  check whether scope has any write operations  */
    scopeHasWriteOp (scope) {
        let types = Object.keys(scope)
        for (var i = 0; i < types.length; i++) {
            let ops = Object.keys(scope[types[i]])
            for (var j = 0; j < ops.length; j++) {
                let info = this.__opParse(ops[j])
                if (info.action.match(/^(?:create|update|delete)$/))
                    return true
            }
        }
        return false
    }

    /*  does a new scope outdate an old scope  */
    scopeInvalidated (newScope, oldScope) {
        /*  case 1: "Is an old read OID now written onto?"  */
        let newScopeWriteOID = {}
        Object.keys(newScope).forEach((type) => {
            Object.keys(newScope[type]).forEach((op) => {
                let opDetail = this.__opParse(op)
                if (opDetail.action.match(/^(?:update|delete)$/))
                    newScope[type][op].forEach((oid) => { newScopeWriteOID[oid] = true })
            })
        })
        let oldScopeTypes = Object.keys(oldScope)
        for (let i = 0; i < oldScopeTypes.length; i++) {
            let oldScopeType = oldScopeTypes[i]

            let oldScopeOps = Object.keys(oldScope[oldScopeType])
            for (let j = 0; j < oldScopeOps.length; j++) {
                let oldScopeOp = oldScopeOps[j]

                let oldScopeOpDetail = this.__opParse(oldScopeOp)
                if (oldScopeOpDetail.action === "read") {

                    let oldScopeOIDs = oldScope[oldScopeType][oldScopeOp]
                    for (let k = 0; k < oldScopeOIDs.length; k++) {
                        let oid = oldScopeOIDs[k]
                        if (newScopeWriteOID[oid])
                            return true
                    }
                }
            }
        }

        /*  case 2: "could an old read potentially had taken write results into account?"
            For this we have to know that the valid operation combinations are:

                        ACTION  VIA      ONTO
                        ------- -------- ------------
            old Scope:  read    direct   one|many|all
            old Scope   read    relation many|all
            new Scope:  create  direct   one
            new Scope:  update  direct   one|many
            new Scope:  delete  direct   one           */

        /*  for each new scope which writes...  */
        let newScopeTypes = Object.keys(newScope)
        for (let i = 0; i < newScopeTypes.length; i++) {
            let newScopeType = newScopeTypes[i]

            let newScopeOps = Object.keys(newScope[newScopeType])
            for (let j = 0; j < newScopeOps.length; j++) {
                let newScopeOp = newScopeOps[j]

                let newScopeOpDetail = this.__opParse(newScopeOp)
                if (newScopeOpDetail.action.match(/^(?:create|update|delete)$/)) {

                    /*  for each old scope which read...  */
                    if (oldScope[newScopeType] !== undefined) {

                        let oldScopeOps = Object.keys(oldScope[newScopeType])
                        for (let l = 0; l < oldScopeOps.length; l++) {
                            let oldScopeOp = oldScopeOps[l]

                            let oldScopeOpDetail = this.__opParse(oldScopeOp)
                            if (oldScopeOpDetail.action === "read") {

                                /*  check combinations which outdate old scope  */
                                let newOp = newScopeOpDetail
                                let oldOp = oldScopeOpDetail
                                if (   newOp.action === "create"
                                    && oldOp.via === "direct"
                                    && (oldOp.onto === "many" || oldOp.onto === "all"))
                                    return true
                                else if (   newOp.action === "update"
                                         && newOp.onto === "many"
                                         && oldOp.via === "direct"
                                         && (oldOp.onto === "many" || oldOp.onto === "all"))
                                    return true

                                else if (   newOp.action === "delete"
                                         && oldOp.via === "direct"
                                         && (oldOp.onto === "many" || oldOp.onto === "all"))
                                    return true
                            }
                        }
                    }
                }
            }
        }

        /*  ...else the scope is still valid (not outdated)  */
        return false
    }

    /*  the factory methods for resolving "subscribe" (mutation)  */
    makeResolverSubscribeSchema (prefix = "") {
        let name = "subscribe"
        if (prefix !== "")
            name = prefix + capitalize(name)
        return `${name}(cid: String!): String!`
    }
    makeResolverSubscribeFunction () {
        return (obj, args /*, ctx, info */) => {
            let cid = args.cid
            this.handler.onSubscribe(cid, this.sid)
            return this.sid
        }
    }

    /*  the factory methods for resolving "unsubscribe" (mutation)  */
    makeResolverUnsubscribeSchema (prefix = "") {
        let name = "unsubscribe"
        if (prefix !== "")
            name = prefix + capitalize(name)
        return `${name}(cid: String!, sid: String!): String!`
    }
    makeResolverUnsubscribeFunction () {
        return (obj, args /*, ctx, info */) => {
            let cid = args.cid
            let sid = args.sid
            this.handler.onUnsubscribe(cid, sid)
            return sid
        }
    }

    /*  the factory methods for resolving "subscription" (query)  */
    makeResolverSubscriptionsSchema (prefix = "") {
        let name = "subscriptions"
        if (prefix !== "")
            name = prefix + capitalize(name)
        return `${name}(cid: String!, outdated: Boolean): [String]!`
    }
    makeResolverSubscriptionsFunction () {
        return (obj, args /*, ctx, info */) => {
            let cid = args.cid
            let outdated = args.outdated || false
            let sids = this.handler.onSubscriptions(cid, outdated)
            return sids
        }
    }
}

