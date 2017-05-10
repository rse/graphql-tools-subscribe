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

/*  the mixin class  */
export default class gtsRecord {
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
            throw new Error("[graphql-tools-subscribe]: scopeAdd: " +
                "invalid argument(s): combination of action+via+onto not allowed")
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
}

