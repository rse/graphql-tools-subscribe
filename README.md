
GraphQL-Tools-Subscribe
=======================

Subscription Framework for GraphQL-Tools

<p/>
<img src="https://nodei.co/npm/graphql-tools-subscribe.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/graphql-tools-subscribe.png" alt=""/>

About
-----

This Node.js module provides a subscription framework for
[GraphQL Tools](https://github.com/apollostack/graphql-tools) or plain
[GraphQL.js](https://github.com/graphql/graphql-js) which allows
GraphQL clients to subscribe on their query and find out whether their
previously subscribed queries should be refetched. The framework is
designed to allow an arbitrary subscription persistence handling and
this way let GraphQL servers to perform additional tasks like publishing
the subscription ids of outdated queries (usually by means of a parallel
WebSocket connection).

Installation
------------

```shell
$ npm install graphql-tools-subscribe
```

Application Programming Interface (API)
---------------------------------------

See the [TypeScript type definition of the GraphQL-Tools-Subscribe API](src/gts.d.ts) for details.

Usage Example
-------------

```js
import GTS from "graphql-tools-subscribe"
```

```js
let gts = new GTS({ pubsub: "spm", keyval: "spm" })
gts.open()
let gtsConn = gts.connection("dummy", (sids) => {
    console.log("OUTDATED", sids)
})
gts.on("debug", (msg) => {
    console.log("DEBUG", msg)
})
[...]

let Foo = {}
[...]

let definition = `
    schema {
        query:    Root
        mutation: Root
    }
    type Root {
        ${gts.schemaSubscription()}
        [...]
    }
    type _Subscription {
        ${gts.schemaSubscriptions()}
        ${gts.schemaSubscribe()}
        ${gts.schemaUnsubscribe()}
        ${gts.schemaPause()}
        ${gts.schemaResume()}
    }
    [...]
}
let resolvers = {
    Root: {
        _Subscription: gts.resolverSubscription()
    },
    _Subscription: {
        subscribe:     gts.resolverSubscribe(),
        unsubscribe:   gts.resolverUnsubscribe(),
        subscriptions: gts.resolverSubscriptions(),
        pause:         gts.resolverPause(),
        resume:        gts.resolverResume()
    },
    Foo: {
        get: (obj, args, ctx, info) => {
            let key = args.key
            let val = Foo[key]
            ctx.scope.record({
                op: "read", arity: "one",
                dstType: "Foo", dstIds: [ "Foo" ], dstAttrs: [ key ]
            })
            return val
        },
        set: (obj, args, ctx, info) => {
            let key = args.key
            let val = args.val
            foo[key] = val
            ctx.scope.record({
                op: "update", arity: "one",
                dstType: "Foo", dstIds: [ "Foo" ], dstAttrs: [ key ]
            })
            return null
        },
        [...]
    }
    [...]
}
let schema = GraphQLTools.makeExecutableSchema({
    typeDefs: [ definition ],
    resolvers: resolvers
})

[...]
[...]((query, variables) => {
    let scope = gtsConn.scope(query, variables)
    ctx.scope = scope
    await GraphQL.graphql(schema, query, null, ctx, variables).then((result) => {
        scope.commit()
        [...]
    }).catch((result) => {
        scope.reject()
        [...]
    })
})
```

For a real example, see [sample script](sample/sample.js)

See Also
--------

- [Specification: GraphQL Subscriptions](https://github.com/facebook/graphql/pull/267/files)
- [Article: GraphQL Subscriptions](https://dev-blog.apollodata.com/the-next-step-for-realtime-data-in-graphql-b564b72eb07b)
- [Article: GraphQL Subscriptions in Apollo Client](https://dev-blog.apollodata.com/graphql-subscriptions-in-apollo-client-9a2457f015fb)
- [Article: GraphQL Subscriptions in GraphiQL](https://dev-blog.apollodata.com/how-to-use-subscriptions-in-graphiql-1d6ab8dbd74b)
- [Article: GraphQL Subscriptions Proposal](https://dev-blog.apollodata.com/a-proposal-for-graphql-subscriptions-1d89b1934c18)
- [Documentation: Apollo Client, GraphQL Subscriptions](http://dev.apollodata.com/react/subscriptions.html)
- [Documentation: GraphQL Tools, GraphQL Subscriptions](http://dev.apollodata.com/tools/graphql-subscriptions/index.html)
- [Module: Apollo Client, GraphQL Subscriptions](https://github.com/apollographql/graphql-subscriptions)
- [Module: Apollo Client, GraphQL Transport WebSocket](https://github.com/apollographql/subscriptions-transport-ws)

Assumptions
-----------

It is assumed that you define the GraphQL
scalar type `UUID` and `Void` with the help of
[GraphQL-Tools-Types](https://github.com/rse/graphql-tools-types):

```js
import GraphQLToolsTypes from "graphql-tools-types"
...
let definition = `
    scalar Void
    scalar UUID
    ...
`
let resolvers = {
    Void:     GraphQLToolsTypes.Void({ name: "Void" }),
    UUID:     GraphQLToolsTypes.UUID({ name: "UUID", storage: "string" }),
    ...
}
```

License
-------

Copyright (c) 2016-2018 Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

