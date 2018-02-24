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

const ObjectHasher = ObjectHash()

/*  the scope class  */
class Scope extends EventEmitter {
    constructor (connection, query, variables) {
        super()

        /*  remember connection  */
        this.connection = connection

        /*  generate unique subscription id from query and variables */
        const data = ObjectHasher.sort({ query, variables })
        const ns = new UUID(5, "ns:URL", "http://engelschall.com/ns/graphql-tools-subscribe")
        this.sid = (new UUID(5, ns, data)).format()

        /*  initialize recording  */
        this.records = {}
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
        this.records[type][op].push(oid)
    }

    /*  pass-through operations to connection  */
    commit  () { this.emit("commit",  this) }
    reject  () { this.emit("reject",  this) }
    destroy () { this.emit("destroy", this) }
}

/*  the connection class  */
class Connection extends EventEmitter {
    constructor (cid, notify) {
        super()

        /*  remember connection id and client notification method  */
        this.cid    = cid
        this.notify = notify

        /*  initialize scopes set  */
        this.scopes = new Set()
    }

    /*  create a new scope for the connection  */
    scope (query, variables) {
        const scope = new Scope(this, query, variables)
        this.scopes.add(scope)
        scope.on("destroy", () => {
            this.scopes.delete(scope)
            this.emit("scopeDestroy", scope)
        })
        scope.on("commit", () => {
            this.emit("scopeProcess", scope)
        })
        scope.on("reject", () => {
            scope.destroy()
        })
        return scope
    }

    /*  destroy connection  */
    destroy () {
        this.scopes.forEach((scope) => {
            scope.destroy()
        })
        this.emit("destroy", this)
    }
}

/*  the API mixin class  */
export default class gtsTracking {
    constructor () {
        this.connections = new Set()
    }

    /*  create new connection  */
    connection (cid, notify) {
        const connection = new Connection(cid, notify)
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
        let scope = new Scope(null, "<internal>", {})
        scope.record(...args)
        this.scopeProcess(scope)
    }
}

