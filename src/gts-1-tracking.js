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
import UUID         from "pure-uuid"
import ObjectHash   from "node-object-hash"
import EventEmitter from "eventemitter3"

/*  create a global instance of the object hasher  */
const ObjectHasher = ObjectHash()

/*  the scope class  */
class Scope extends EventEmitter {
    constructor (api, connection, query, variables, silent = false) {
        super()

        /*  remember API and connection  */
        this.silent     = silent
        this.api        = api
        this.connection = connection

        /*  generate unique subscription id from query and variables */
        const data = ObjectHasher.sort({ query, variables })
        const ns = new UUID(5, "ns:URL", "http://engelschall.com/ns/graphql-query")
        this.sid = (new UUID(5, ns, data)).format()

        /*  initialize recording  */
        this.records = {}
        this.api.emit("scope-create", { sid: this.sid, query, variables })
        if (!this.silent)
            this.api.emit("debug", `scope-create sid=${this.sid} query=${JSON.stringify(query)} ` +
                `variables=${JSON.stringify(variables)}`)
    }

    /*  record an access operation  */
    record (type, oid, action, via, onto) {
        /*  determine and sanity check operation  */
        const op = `${action}:${via}:${onto}`
        const regexp = new RegExp("(?:" +
                  "read:(?:direct|relation):(?:one|many|all)" +
            "|" + "create:direct:one" +
            "|" + "update:direct:(?:one|many|all)" +
            "|" + "delete:direct:(?:one|many|all)" +
        ")")
        if (!regexp.test(op))
            throw new Error("invalid argument(s): combination of action+via+onto not allowed")

        /*  store record  */
        if (this.records[type] === undefined)
            this.records[type] = {}
        if (this.records[type][op] === undefined)
            this.records[type][op] = []
        if (this.records[type][op].indexOf(oid) < 0)
            this.records[type][op].push(oid)
        this.api.emit("scope-record", { sid: this.sid, type, op, oid })
        if (!this.silent)
            this.api.emit("debug", `scope-record sid=${this.sid} type=${type} op=${op} oid=${oid}`)
    }

    /*  pass-through operations to connection  */
    commit  () {
        this.emit("commit",  this)
        this.api.emit("scope-commit", { sid: this.sid })
        if (!this.silent)
            this.api.emit("debug", `scope-commit sid=${this.sid}`)
    }
    reject  () {
        this.emit("reject",  this)
        this.api.emit("scope-reject", { sid: this.sid })
        if (!this.silent)
            this.api.emit("debug", `scope-reject sid=${this.sid}`)
    }
    destroy () {
        this.emit("destroy", this)
        this.api.emit("scope-destroy", { sid: this.sid })
        if (!this.silent)
            this.api.emit("debug", `scope-destroy sid=${this.sid}`)
    }
}

/*  the connection class  */
class Connection extends EventEmitter {
    constructor (api, cid, notify) {
        super()

        /*  remember api  */
        this.api = api

        /*  remember connection id and client notification method  */
        this.cid    = cid
        this.notify = notify

        /*  initialize scopes set  */
        this.scopes = new Set()
        this.api.emit("connection-create", { cid: this.cid })
        if (!this.silent)
            this.api.emit("debug", `connection-create cid=${this.cid}`)
    }

    /*  create a new scope for the connection  */
    scope (query, variables) {
        const scope = new Scope(this.api, this, query, variables)
        this.scopes.add(scope)
        scope.on("commit", () => {
            this.emit("scopeProcess", scope)
            /*  keep the scope attached to the connection and destroy
                it only on unsubscription or destroying the connection  */
        })
        scope.on("reject", () => {
            scope.destroy()
        })
        scope.on("destroy", () => {
            this.scopes.delete(scope)
            this.emit("scopeDestroy", scope)
        })
        return scope
    }

    /*  destroy connection  */
    destroy () {
        this.scopes.forEach((scope) => {
            scope.destroy()
        })
        this.emit("destroy", this)
        this.api.emit("connection-destroy", { cid: this.cid })
        if (!this.silent)
            this.api.emit("debug", `connection-destroy cid=${this.cid}`)
    }
}

/*  the API mixin class  */
export default class gtsTracking {
    constructor () {
        this.connections = new Set()
    }

    /*  create new connection  */
    connection (cid, notify) {
        const connection = new Connection(this, cid, notify)
        this.connections.add(connection)
        connection.on("destroy", () => {
            this.connections.delete(connection)
        })
        connection.on("scopeDestroy", (scope) => {
            this.scopeDestroy(scope)
        })
        connection.on("scopeProcess", (scope) => {
            this.scopeProcess(scope)
        })
        return connection
    }

    /*  record internal scope (without any connections)  */
    scopeRecord (...args) {
        let scope = new Scope(this, null, "<internal>", {}, true)
        scope.record(...args)
        this.scopeProcess(scope)
    }
}

