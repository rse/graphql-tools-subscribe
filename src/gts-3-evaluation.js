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

/*  external dependencies  */
import Bluebird from "bluebird"

/*  the API mixin class  */
export default class gtsEvaluation {
    /*  parse the operation string  */
    __opParse (op) {
        let m = op.match(/^(read|create|update|delete):(direct|relation):(one|many|all)$/)
        if (m === null)
            throw new Error(`internal error: invalid operation "${op}"`)
        return { action: m[1], via: m[2], onto: m[3] }
    }

    /*  check whether scope has a particular operation  */
    __recordsContainOp (records, cb) {
        let types = Object.keys(records)
        for (var i = 0; i < types.length; i++) {
            let ops = Object.keys(records[types[i]])
            for (var j = 0; j < ops.length; j++) {
                let op = this.__opParse(ops[j])
                if (cb(op))
                    return true
            }
        }
        return false
    }

    /*  does a new scope outdate an old scope  */
    __scopeOutdated (recordsNew, recordsOld) {

        /*  ==== CASE 1 ====

            "Is an old/previously read OID now (directly) written onto?"  */

        /*  find all OIDs in new scope records which write  */
        let recordsNewWriteOID = {}
        Object.keys(recordsNew).forEach((type) => {
            Object.keys(recordsNew[type]).forEach((op) => {
                let opDetail = this.__opParse(op)
                if (opDetail.action.match(/^(?:update|delete)$/)) {
                    recordsNew[type][op].forEach((oid) => {
                        recordsNewWriteOID[oid] = op
                    })
                }
            })
        })

        /*  for each old scope records which read, ...  */
        let recordsOldTypes = Object.keys(recordsOld)
        for (let i = 0; i < recordsOldTypes.length; i++) {
            let recordsOldType = recordsOldTypes[i]
            let recordsOldOps = Object.keys(recordsOld[recordsOldType])
            for (let j = 0; j < recordsOldOps.length; j++) {
                let recordsOldOp = recordsOldOps[j]
                let recordsOldOpDetail = this.__opParse(recordsOldOp)
                if (recordsOldOpDetail.action === "read") {
                    /*  ...check if any of its OIDs match the write OIDs in the new scope  */
                    let recordsOldOIDs = recordsOld[recordsOldType][recordsOldOp]
                    for (let k = 0; k < recordsOldOIDs.length; k++) {
                        let oid = recordsOldOIDs[k]
                        if (recordsNewWriteOID[oid]) {
                            this.emit("scope-outdated-direct", {
                                type:    recordsOldType,
                                opWrite: recordsNewWriteOID[oid],
                                opRead:  recordsOldOp,
                                oid:     oid
                            })
                            this.emit("debug", "scope-outdated-direct " +
                                `type=${recordsOldType} ` +
                                `opWrite=${recordsNewWriteOID[oid]} ` +
                                `opRead=${recordsOldOp} ` +
                                `oid=${oid}`
                            )
                            return true
                        }
                    }
                }
            }
        }

        /*  ==== CASE 2 ====

            "Has an old/previously read list of OID potentially had to take
            write results into account?". For this we have to know that the
            valid operation combinations are which can occur in practice:

                        ACTION  VIA             ONTO
                        ------- --------------- ------------
            old Scope:  read    direct|relation one|many|all
            new Scope:  create  direct          one
            new Scope:  update  direct          one|many|all
            new Scope:  delete  direct          one|many|all

            So, we have to take into account:
            (create|update|delete):*:* --outdates--> read:*:(many|all)  */

        /*  for each new scope records which write, ...  */
        let recordsNewTypes = Object.keys(recordsNew)
        for (let i = 0; i < recordsNewTypes.length; i++) {
            let recordsNewType = recordsNewTypes[i]
            let recordsNewOps = Object.keys(recordsNew[recordsNewType])
            for (let j = 0; j < recordsNewOps.length; j++) {
                let recordsNewOp = recordsNewOps[j]
                let recordsNewOpDetail = this.__opParse(recordsNewOp)
                if (recordsNewOpDetail.action.match(/^(?:create|update|delete)$/)) {

                    /*  for each old scope records which read, ...  */
                    if (recordsOld[recordsNewType] === undefined)
                        continue
                    let recordsOldOps = Object.keys(recordsOld[recordsNewType])
                    for (let l = 0; l < recordsOldOps.length; l++) {
                        let recordsOldOp = recordsOldOps[l]
                        let recordsOldOpDetail = this.__opParse(recordsOldOp)
                        if (recordsOldOpDetail.action === "read") {

                            /*  check for outdate situation  */
                            if (   recordsOldOpDetail.onto === "many"
                                || recordsOldOpDetail.onto === "all" ) {
                                this.emit("scope-outdated-indirect", {
                                    type:    recordsNewType,
                                    opWrite: recordsNewOp,
                                    opRead:  recordsOldOp
                                })
                                this.emit("debug", "scope-outdated-indirect " +
                                    `type=${recordsNewType} ` +
                                    `opWrite=${recordsNewOp} ` +
                                    `opRead=${recordsOldOp}`
                                )
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
    async __scopeProcess (scope) {
        /*  determine parameters  */
        let sid = scope.sid
        let cid = scope.connection !== null ? scope.connection.cid : `${this.uuid}:none`

        /*  determine whether any write operations exist in the scope records  */
        let hasWriteOps = this.__recordsContainOp(scope.records, (op) =>
            op.action.match(/^(?:create|update|delete)$/))

        /*  queries (scopes without writes)...  */
        if (!hasWriteOps) {
            if (scope.state === "subscribed") {
                /*  ...with subscriptions are remembered  */
                let rec = await this.keyval.get(`sid:${sid},rec`)
                if (rec === undefined)
                    await this.keyval.put(`sid:${sid},rec`, scope.records)
                await this.keyval.put(`sid:${sid},cid:${cid}`, Date.now())
                this.emit("debug", `scope-store-update sid=${sid} cid=${cid}`)
            }
            else {
                /*  ...without subscriptions can be just destroyed
                    (and the processing short-circuited)  */
                scope.destroy()
            }
        }

        /*  mutations (scopes with writes) might outdate queries (scopes with reads)  */
        else {
            /*  iterate over all stored scope records  */
            let keys = await this.keyval.keys("sid:*,rec")
            let sids = keys.map((key) => key.replace(/^sid:(.+?),rec$/, "$1"))
            let outdatedSids = []
            await Bluebird.each(sids, async (otherSid) => {
                let records = await this.keyval.get(`sid:${otherSid},rec`)
                if (records !== undefined)
                    if (this.__scopeOutdated(scope.records, records))
                        outdatedSids.push(otherSid)
            })

            /*  externally publish ids of outdated queries to all instances
                (comes in on all instances via __scopeOutdatedEvent below)  */
            if (outdatedSids.length > 0) {
                this.emit("debug", `scope-outdated-send sids=${outdatedSids.join(",")}`)
                this.pubsub.publish("outdated", outdatedSids)
            }
        }
    }

    /*  process an outdated event  */
    __scopeOutdatedEvent (sids) {
        this.emit("debug", `scope-outdated-receive sids=${sids.join(",")}`)
        this.connections.forEach((conn) => {
            let outdated = {}
            conn.scopes.forEach((scope) => {
                if (sids.indexOf(scope.sid) >= 0) {
                    if (scope.state === "subscribed")
                        outdated[scope.sid] = true
                    else if (scope.state === "paused")
                        scope.outdated = true
                }
            })
            outdated = Object.keys(outdated)
            if (outdated.length > 0) {
                this.emit("debug", `scope-outdated-notify sids=${outdated.join(",")}`)
                conn.notify(outdated)
            }
        })
    }

    /*  destroy a scope  */
    async __scopeDestroy (scope) {
        /*  determine parameters  */
        let sid = scope.sid
        let cid = scope.connection !== null ? scope.connection.cid : `${this.uuid}:none`

        /*  scope records with no more corresponding subscriptions are deleted  */
        await this.keyval.del(`sid:${sid},cid:${cid}`)
        let keys = await this.keyval.keys(`sid:${sid},cid:*`)
        if (keys.length === 0)
            await this.keyval.del(`sid:${sid},rec`)
        this.emit("debug", `scope-store-delete sid=${sid} cid=${cid}`)
    }

    /*  dump current information  */
    async dump () {
        /*  determine information in store  */
        await this.keyval.acquire()
        let info = { sids: {} }
        let keys = await this.keyval.keys("sid:*,cid:*")
        keys.forEach((key) => {
            let sid = key.replace(/^sid:(.+?),cid:.+?$/, "$1")
            let cid = key.replace(/^sid:.+?,cid:(.+?)$/, "$1")
            if (info.sids[sid] === undefined)
                info.sids[sid] = { cids: [], records: [] }
            info.sids[sid].cids.push(cid)
        })
        keys = await this.keyval.keys("sid:*,rec")
        let sids = keys.map((key) => key.replace(/^sid:(.+?),rec$/, "$1"))
        await Bluebird.each(sids, async (sid) => {
            let records = await this.keyval.get(`sid:${sid},rec`)
            info.sids[sid].records.push(records)
        })
        await this.keyval.release()

        /*  dump information  */
        let dump = ""
        Object.keys(info.sids).forEach((sid) => {
            dump += `Scope { sid: ${sid} }\n`
            info.sids[sid].cids.forEach((cid) => {
                dump += `    Connection { cid: ${cid} }\n`
            })
            info.sids[sid].records.forEach((record) => {
                let types = Object.keys(record)
                for (let i = 0; i < types.length; i++) {
                    let type = types[i]
                    let ops = Object.keys(record[type])
                    for (let j = 0; j < ops.length; j++) {
                        let op = ops[j]
                        let oids = record[type][op]
                        for (let k = 0; k < oids.length; k++) {
                            let oid = oids[k]
                            dump += `    Record { type: ${type}, op: ${op}, oid: ${oid} }\n`
                        }
                    }
                }
            })
        })
        return dump
    }

    /*  flush all information  */
    async flush () {
        /*  flush all external storage information  */
        let keys = await this.keyval.keys("sid:*,cid:*")
        await Bluebird.each(keys, async (key) => {
            this.keyval.del(key)
        })
        keys = await this.keyval.keys("sid:*,rec")
        await Bluebird.each(keys, async (key) => {
            this.keyval.del(key)
        })
    }
}

