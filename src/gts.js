/*
**  GraphQL-Tools-Subscribe -- Subscription Framework for GraphQL-Tools
**  Copyright (c) 2016-2019 Ralf S. Engelschall <rse@engelschall.com>
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
import EventEmitter            from "eventemitter3"
import PubSub                  from "ipc-pubsub"
import KeyVal                  from "ipc-keyval"
import UUID                    from "pure-uuid"

/*  internal dependencies  */
import gtsTracking             from "./gts-1-tracking"
import gtsResolver             from "./gts-2-resolver"
import gtsEvaluation           from "./gts-3-evaluation"

/*  the API class  */
class GraphQLToolsSubscribe extends aggregation(
    gtsTracking,
    gtsResolver,
    gtsEvaluation
) {
    /*  the class constructor  */
    constructor (options = {}) {
        super()
        this.options = Object.assign({
            pubsub: "spm",
            keyval: "spm"
        }, options)
        this.keyval = new KeyVal(this.options.keyval)
        this.pubsub = new PubSub(this.options.pubsub)
        this.subscription = null
        this.emitter = new EventEmitter()
        this.uuid = (new UUID(1)).format()
    }

    /*  provide event listening  */
    on (name, handler) {
        this.emitter.on(name, handler)
        return () => {
            this.emitter.removeListener(name, handler)
        }
    }

    /*  provide event emitting  */
    emit (name, ...args) {
        this.emitter.emit(name, ...args)
        return this
    }

    /*  open service  */
    async open () {
        await this.keyval.open()
        await this.pubsub.open()
        this.subscription = await this.pubsub.subscribe("outdated", (sids) => {
            this.__scopeOutdatedEvent(sids)
        })
        return this
    }

    /*  close service  */
    async close () {
        this.subscription.unsubscribe()
        this.subscription = null
        await this.keyval.close()
        await this.pubsub.close()
        return this
    }
}

/*  export the traditional way for interoperability reasons
    (as Babel would export an object with a 'default' field)  */
module.exports = GraphQLToolsSubscribe

