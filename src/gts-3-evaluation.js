/*
**  GraphQL-Tools-Subscribe -- Subscription Framework for GraphQL-Tools
**  Copyright (c) 2016-2017 Ralf S. Engelschall <rse@engelschall.com>
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

/*  external dependencies  */
import Promise from "bluebird"

/*  the API mixin class  */
export default class gtsEvaluation {
    /*  parse the operation string  */
    __opParse (op) {
        let m = op.match(/^(read|create|update|delete):(direct|relation):(one|many|all)$/)
        if (m === null)
            throw new Error(`internal error: invalid operation "${op}"`)
        return { action: m[1], via: m[2], onto: m[3] }
    }

    /*  check whether scope has any read operations  */
    scopeHasReadOp (scope) {
        let types = Object.keys(scope.recods)
        for (var i = 0; i < types.length; i++) {
            let ops = Object.keys(scope.records[types[i]])
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
        let types = Object.keys(scope.records)
        for (var i = 0; i < types.length; i++) {
            let ops = Object.keys(scope.records[types[i]])
            for (var j = 0; j < ops.length; j++) {
                let info = this.__opParse(ops[j])
                if (info.action.match(/^(?:create|update|delete)$/))
                    return true
            }
        }
        return false
    }

    /*  does a new scope outdate an old scope  */
    scopeOutdated (newScope, oldScope) {
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

    /*  process a committed scope  */
    async scopeProcess (scope) {
        /*  determine parameters  */
        let sid = scope.sid
        let cid = scope.connection !== null ? scope.connection.cid : "<none>"

        /*  determine whether any write operations exist in the scope  */
        let hasWriteOps = this.scopeHasWriteOp(scope)

        /*  determine whether there is a subscription for the scope  */
        let hasSubscription = await this.keyval.get(`sid:${sid},cid:${cid}`)

        /*  queries (scopes without writes)...  */
        if (!hasWriteOps) {
            if (hasSubscription) {
                /*  ...with subscriptions are remembered  */
                await this.keyval.acquire()
                let rec = await this.keyval.get(`sid:${sid},rec`)
                if (rec === undefined)
                    await this.keyval.put(`sid:${sid},rec`, scope.records)
                await this.keyval.release()
            }
            else {
                /*  ...without subscriptions can be just destroyed
                    (and the processing short-circuited)  */
                scope.destroy()
                return
            }
        }

        /*  mutations (scopes with writes) might outdate queries (scopes with reads)  */
        if (hasWriteOps) {
            /*  iterate over all stored scopes  */
            await this.keyval.acquire()
            let keys = await this.keyval.keys("sid:*,rec")
            let sids = keys.map((key) => key.replace(/^sid:(.+?),rec$/, "$1"))
            let outdatedSids = []
            await Promise.each(sids, async (otherSid) => {
                if (otherSid === sid)
                    return
                let records = await this.keyval.get(`sid:${otherSid},rec`)
                if (this.scopeOutdated(scope.records, records))
                    outdatedSids.push(otherSid)
            })
            await this.keyval.release()
            if (outdatedSids.length > 0)
                this.pubsub.publish("outdated", outdatedSids)
        }
    }

    /*  process an outdated event  */
    scopeOutdatedEvent (sids) {
        this.connections.forEach((conn) => {
            let outdated = {}
            conn.scopes.forEach((scope) => {
                if (sids.indexOf(scope.sid) >= 0)
                    outdated[scope.sid] = true
            })
            outdated = Object.keys(outdated)
            if (outdated.length > 0)
                conn.notify(outdated)
        })
    }

    /*  destroy a scope  */
    async scopeDestroy (scope) {
        let sid = scope.sid

        /*  scope records with no more corresponding subscriptions are deleted  */
        await this.keyval.acquire()
        let keys = await this.keyval.keys(`sid:${sid},cid:*`)
        let cids = keys.map((key) => key.replace(/^sid:.+?,cid:(.+)$/, "$1"))
        if (cids.length === 0)
            await this.keyval.del(`sid:${sid},rec`)
        await this.keyval.release()
    }
}

