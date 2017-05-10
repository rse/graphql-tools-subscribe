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

/*  the default in-core handler  */
export default class gtsHandler {
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

