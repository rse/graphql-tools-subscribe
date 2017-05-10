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
import UUID        from "pure-uuid"

/*  internal dependencies  */
import gtsHandler  from "./gts-5-handler"

/*  the mixin class  */
export default class gtsBase {
    /*  the convenient constructor  */
    constructor (query, options = {}) {
        this.setQuery(query)
        this.setHandler(gtsHandler)
        this.scopeBegin()
    }

    /*  version information  */
    version () {
        return { major: 0, minor: 9, micro: 4, date: 20170510 }
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
}

