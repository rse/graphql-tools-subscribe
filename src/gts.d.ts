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

declare module "graphql-tools-subscribe" {
    /*  The primary API class of GraphQL-Tools-Subscribe.  */
    class GTS {
        /*  Construct a new GraphQL-IO Server instance.  */
        public constructor(options?: {
            /*  The **pubsub** has to be a valid [ipc-pubsub](http://npmjs.com/ipc-pubsub) URL.
                By default it is `spm` (singe-process-model) and could also be
                `mpm` (multi-process-model) or `rpm+<type>//...` (remote-process-model).
                Use the `mpm` variant if you are using the Node.js `cluster` facility.
                Use the `rpm` variant if you are using the Node.js `cluster`
                and/or different server nodes.  */
            pubsub: string,

            /*  The **keyval** has to be a valid [ipc-keyval](http://npmjs.com/ipc-keyval) URL.
                By default it is `spm` (singe-process-model) and could also be
                `mpm` (multi-process-model) or `rpm+<type>//...` (remote-process-model).
                Use the `mpm` variant if you are using the Node.js `cluster` facility.
                Use the `rpm` variant if you are using the Node.js `cluster`
                and/or different server nodes.  */
            keyval: string
        })

        /*  Listen to an event **eventName** and let the callback **handler** be asynchronously
            called for every emitted event. Known events are
            `debug` (handler argument: `msg: string`)
            Returns a function to remove the handler again. */
        public on(eventName: string, handler: (eventData: any) => void): () => void

        /*  Latch into a hook **hookName** and let the callback **handler** be synchronously
            called for every hook processing. Returns a function to remove the handler again.
            Known hooks are:
            - `server-configure`
              (processing type: "promise", handler argument:
              `server: GraphQLIOServer`)  */
        public at(hookName: string, handler: (...args: any[]) => any): () => void

        /*  Open the processing.
            This instanciates the internal network connections.  */
        public open(): Promise<GTS>

        /*  Close the processing.
            This drops the internal network connections.  */
        public close(): Promise<GTS>
    }

    const gts: GTS
    export = gts
}

