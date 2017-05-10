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
import capitalize from "capitalize"

/*  the mixin class  */
export default class gtsFactory {
    /*  the factory methods for resolving "subscribe" (mutation)  */
    makeResolverSubscribeSchema (prefix = "") {
        let name = "subscribe"
        if (prefix !== "")
            name = prefix + capitalize(name)
        return "# Subscribe to the current GraphQL query under the unique client id (CID)\n" +
            "# and retrieve a unique subscription id (SID).\n" +
            `${name}(cid: String!): String!`
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
        return "# Unsubscribe from the GraphQL query, identified by the subscription id (SID),\n" +
            "# under the unique client id (CID).\n" +
            `${name}(cid: String!, sid: String!): String!\n`
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
        return "# Retrieve all subscription ids (SIDs) under the unique client id (CID).\n" +
            `${name}(cid: String!, outdated: Boolean): [String]!\n`
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

