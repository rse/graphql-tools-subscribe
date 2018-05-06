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

        /*  Open the service.
            This instanciates the internal pubsub/keyval mechanism.  */
        public open(): Promise<GTS>

        /*  Close the processing.
            This drops the internal pubsub/keyva mechanism.  */
        public close(): Promise<GTS>

        /*  Create a logical connection, identified by the Connection Id (CID) **cid**, and
            provide callback to get notified of outdated Subscription Ids (SIDs) **sids**.
            The **cid** usually is a unique identier of the underlying network connection.
            In the **notify** callback, the application usually notifies the peer over the
            underlying network connection about the outdated subscriptions (which usually
            in turn refetches the corresponding GraphQL queries).  */
        public connection(cid: string, notify: (sids: string[]) => void): Connection

        /*  Create a new internal scope without a corresponding connection and record a change.
            Use this for application internal (non-client triggered) GraphQL mutations.
            The parameters are the same as for `Scope#record()`. */
        public record(type: string, oid: string, action: string, via: string, onto: string): void

        /*  Generate the GraphQL schema entries and resolver functions  */
        public schemaSubscription(): string
        public resolverSubscription(): Resolver
        public schemaSubscribe(): string
        public resolverSubscribe(): Resolver
        public schemaUnsubscribe(): string
        public resolverUnsubscribe(): Resolver
        public schemaSubscriptions(): string
        public resolverSubscriptions(): Resolver
        public schemaPause(): string
        public resolverPause(): Resolver
        public schemaResume(): string
        public resolverResume(): Resolver

        /*  Dump a textual description of the current connection/subscription/record information  */
        public dump(): string
    }

    /*  a GraphQL resolver  */
    type Resolver = (obj: any, args: any, ctx: any, info: any) => any

    /*  The logical connection  */
    interface Connection {
        /*  Create a new tracking scope and attach it to the connection.
            Notice: it is required that you pass-through this scope to all
            GraphQL resolvers in the context object under field `scope`!  */
        public scope(query: string, variables?: object): Scope

        /*  Destroy connection (and all its attached scopes)  */
        public destroy(): void
    }

    /*  The tracking scope  */
    interface Scope {
        /*  Record a data mode access.
            The **type** is a domain-specific type of the object the access happened onto.
            The **oid** is a domain-specific identifier of the object the access happended onto.
            The **action** is one of the CRUD operations: `read`, `create`, `update` or `delete`.
            The **via** is the way the object was approached: `direct` or via a `relation`.
            The **onto** is the way the object was approached: `one`, `many` or `all`.
            Not all combinations are valid. The valid combinations for `action:via:onto` are:
                - read:(direct|relation):(one|many|all)
                - create:direct:one
                - update:direct:(one|many|all)
                - delete:direct:(one|many|all)  */
        public record(type: string, oid: string, action: string, via: string, onto: string): void

        /*  Commit scope  */
        public commit(): void

        /*  Reject scope  */
        public reject(): void

        /*  Destroy scope  */
        public destroy(): void
    }

    const gts: GTS
    export = gts
}

