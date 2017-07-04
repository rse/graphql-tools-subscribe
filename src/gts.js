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
import aggregation             from "aggregation/es6"
import PubSub                  from "ipc-pubsub"
import KeyVal                  from "ipc-keyval"

/*  internal dependencies  */
import gtsTracking             from "./gts-1-tracking"
import gtsSubscription         from "./gts-2-subscription"
import gtsEvaluation           from "./gts-3-evaluation"

/*  the API class  */
class GraphQLToolsSubscribe extends aggregation(
    gtsTracking,
    gtsSubscription,
    gtsEvaluation
) {
    /*  the class constructor  */
    constructor (options = {}) {
        super(options)
        this.options = Object.assign({
            pubsub: "spm",
            keyval: "spm"
        }, options)
        this.keyval = new KeyVal(this.options.keyval)
        this.pubsub = new PubSub(this.options.pubsub)
        this.unsubscribe = null
    }

    /*  open service  */
    async open () {
        await this.keyval.open()
        await this.pubsub.open()
        this.unsubscribe = await this.pubsub.subscribe("outdated", (sids) => {
            this.scopeOutdatedEvent(sids)
        })
    }

    /*  close service  */
    async close () {
        await this.keyval.close()
        await this.pubsub.close()
        this.unsubscribe()
        this.unsubscribe = null
    }

    /*  version information  */
    version () {
        return { major: 0, minor: 9, micro: 4, date: 20170510 }
    }
}

/*  export the traditional way for interoperability reasons
    (as Babel would export an object with a 'default' field)  */
module.exports = GraphQLToolsSubscribe

