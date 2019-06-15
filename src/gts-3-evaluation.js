/*
**  GraphQL-Tools-Subscribe -- Subscription Framework for GraphQL-Tools
**  Copyright (c) 2016-2019 Dr. Ralf S. Engelschall <rse@engelschall.com>
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
import Ducky    from "ducky"
import Bluebird from "bluebird"

/*  the API mixin class  */
export default class gtsEvaluation {
    /*  stringify a scope record  */
    __recordStringify (rec) {
        let str = ""
        if (rec.srcType !== null && rec.srcId !== null && rec.srcAttr !== null)
            str += `${rec.srcType}#${rec.srcId}.${rec.srcAttr}->`
        str += `${rec.op}(${rec.arity})->`
        str += `${rec.dstType}#{${rec.dstIds.join(",")}}.{${rec.dstAttrs.join(",")}}`
        return str
    }

    /*  unstringify a scope record  */
    __recordUnstringify (str) {
        let m = str.match(/^(?:(.+?)#(.+?)\.(.+?)->)?(.+?)\((.+?)\)->(.+?)#\{(.*?)\}\.\{(.+?)\}$/)
        if (m === null)
            throw new Error(`invalid record string "${str}" (failed to parse)`)
        return {
            srcType:  m[1] || null,
            srcId:    m[2] || null,
            srcAttr:  m[3] || null,
            op:       m[4],
            arity:    m[5],
            dstType:  m[6],
            dstIds:   m[7].split(","),
            dstAttrs: m[8].split(",")
        }
    }

    /*  serialize a list of records  */
    __recordsSerialize (records) {
        return records.map((record) => {
            return this.__recordStringify(record)
        })
    }

    /*  unserialize a list of records  */
    __recordsUnserialize (records) {
        let result = null
        if (Ducky.validate(records, "[ string* ]")) {
            try {
                result = records.map((record) => {
                    return this.__recordUnstringify(record)
                })
            }
            catch (ex) {
                /* ignore */
                result = null
            }
        }
        return result
    }

    /*  does a new scope (with mutation/write) outdate an old scope (with query/read only)  */
    __scopeOutdated (recordsNew, recordsOld) {
        /*  check if two lists overlap  */
        const overlap = (list1, list2) => {
            if (list1.length === 0 || list2.length === 0)
                return false
            if (list1.length === 1 && list1[0] === "*")
                return true
            if (list2.length === 1 && list2[0] === "*")
                return true
            let index = {}
            list1.forEach((x) => { index[x] = true })
            let overlap = list2.filter((x) => index[x])
            return overlap.length > 0
        }

        /*  iterate over all new and old records...  */
        for (let i = 0; i < recordsNew.length; i++) {
            let recNew = recordsNew[i]
            for (let j = 0; j < recordsOld.length; j++) {
                let recOld = recordsOld[j]
                let outdated = false

                /*
                 *  CASE 1: modified entity (of arbitrary direct access)
                 *  old/query:    [*#{*}.*->]read(*)->Item#{1}.{id,name}
                 *  new/mutation: [*#{*}.*->]update/delete(*)->Item#{1}.{name}
                 */
                if ((recNew.op === "update" || recNew.op === "delete")
                    &&         recOld.dstType === recNew.dstType
                    && overlap(recOld.dstIds,     recNew.dstIds)
                    && overlap(recOld.dstAttrs,   recNew.dstAttrs))
                    outdated = true

                /*
                 *  CASE 2: modified entity list (of relationship traversal)
                 *  old/query     Card#1.items->read(*)->Item#{2}.{id,name}
                 *  new/mutation: [*#{*}.*->]update(*)->Card#{1}.{items}
                 */
                else if (recNew.op === "update"
                    &&           recOld.srcType !== null
                    &&           recOld.srcType === recNew.dstType
                    && overlap([ recOld.srcId ],    recNew.dstIds)
                    && overlap([ recOld.srcAttr ],  recNew.dstAttrs))
                    outdated = true

                /*
                 *  CASE 3: modified entity list (of direct query)
                 *  old/query     [*#{*}.*->]read(many/all)->Item#{*}.{id,name}
                 *  new/mutation: [*#{*}.*->]create/update/delete(*)->Item#{*}.{name}
                 */
                else if ((recNew.op === "create" || recNew.op === "update" || recNew.op === "delete")
                    &&        (recOld.arity === "many" || recOld.arity === "all")
                    &&         recOld.dstType === recNew.dstType
                    && overlap(recOld.dstAttrs,   recNew.dstAttrs))
                    outdated = true

                /*  report outdate combination  */
                if (outdated) {
                    this.emit("scope-outdated", { old: recordsOld[j], new: recordsNew[i] })
                    let recOld = this.__recordStringify(recordsOld[j])
                    let recNew = this.__recordStringify(recordsNew[i])
                    this.emit("debug", `scope-outdated old=${recOld} new=${recNew}`)
                    return true
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

        /*  filter out write records in the scope  */
        let recordsWrite = scope.records.filter((record) => {
            return record.op.match(/^(?:create|update|delete)$/)
        })

        /*  queries (scopes without writes)...  */
        if (recordsWrite.length === 0) {
            if (scope.state === "subscribed") {
                /*  ...with subscriptions are remembered  */
                let rec = await this.keyval.get(`sid:${sid},cid:${cid}`)
                let recNew = this.__recordsSerialize(scope.records)
                if (rec === undefined || rec !== recNew) {
                    await this.keyval.put(`sid:${sid},cid:${cid}`, recNew)
                    this.emit("debug", `scope-store-update sid=${sid} cid=${cid}`)
                }
            }
            else {
                /*  ...without subscriptions can be just destroyed
                    (and the processing short-circuited)  */
                scope.destroy()
            }
        }

        /*  mutations (scopes with writes) might outdate queries (scopes with reads)  */
        else {
            /*  determine all stored scope records  */
            let sids = {}
            let keys = await this.keyval.keys("sid:*,cid:*")
            keys.forEach((key) => {
                let [ , sid, cid ] = key.match(/^sid:(.+?),cid:(.+)$/)
                if (sids[sid] === undefined)
                    sids[sid] = []
                sids[sid].push(cid)
            })

            /*  iterate over all SIDs...  */
            let outdatedSids = {}
            let checked = {}
            await Bluebird.each(Object.keys(sids), async (sid) => {
                /*  check just once  */
                if (outdatedSids[sid])
                    return

                /*  iterate over all (associated) CIDs...  */
                await Bluebird.each(sids[sid], async (cid) => {
                    /*  check just once  */
                    if (outdatedSids[sid])
                        return

                    /*  fetch scope records value  */
                    let value = await this.keyval.get(`sid:${sid},cid:${cid}`)
                    if (value !== undefined && !checked[value]) {
                        let recordsRead = this.__recordsUnserialize(value)
                        if (recordsRead === null)
                            await this.keyval.del(`sid:${sid},cid:${cid}`)
                        else {
                            /*  check whether writes outdate reads  */
                            if (this.__scopeOutdated(recordsWrite, recordsRead))
                                outdatedSids[sid] = true

                            /*  remember that these scope records were already checked  */
                            checked[value] = true
                        }
                    }
                })
            })
            outdatedSids = Object.keys(outdatedSids)

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

        /*  delete scope record  */
        await this.keyval.del(`sid:${sid},cid:${cid}`)
        this.emit("debug", `scope-store-delete sid=${sid} cid=${cid}`)
    }

    /*  dump current information  */
    async dump () {
        /*  determine information in store  */
        await this.keyval.acquire()
        let info = { sids: {} }
        let keys = await this.keyval.keys("sid:*,cid:*")
        await Bluebird.each(keys, async (key) => {
            let sid = key.replace(/^sid:(.+?),cid:.+?$/, "$1")
            let cid = key.replace(/^sid:.+?,cid:(.+?)$/, "$1")
            if (info.sids[sid] === undefined)
                info.sids[sid] = { cids: [], records: [] }
            info.sids[sid].cids.push(cid)
            let value = await this.keyval.get(key)
            let records = this.__recordsUnserialize(value)
            if (records === null)
                await this.keyval.del(key)
            else
                info.sids[sid].records = info.sids[sid].records.concat(records)
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
                let rec = this.__recordStringify(record)
                dump += `    Record { rec: ${rec} }\n`
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
    }
}

