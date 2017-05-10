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

/* eslint no-console: off */

import co                    from "co"
import * as GraphQL          from "graphql"
import * as GraphQLTools     from "graphql-tools"
import GraphQLToolsSubscribe from ".."

/*  create a new GraphQL-Tools-Subscribe context  */
var gts = new GraphQLToolsSubscribe()

/*  configure an in-core handler (actually the default one)  */
gts.setHandler(class subscriptionHandler {
    constructor (gs) {
        this.gs    = gs
        this.store = {}
    }
    onSubscribe (cid, sid) {
        if (!this.store[sid])
            this.store[sid] = {}
        this.store[sid].cid = cid
    }
    onSubscriptions (cid, outdated) {
        let sids = Object.keys(this.store)
            .filter((sid) => this.store[sid].cid === cid)
        if (outdated)
            sids = sids.filter((sid) => this.store[sid].outdated)
        return sids
    }
    onUnsubscribe (cid, sid) {
        if (this.store[sid])
            delete this.store[sid]
    }
    onScope (sid, scope) {
        if (this.gs.scopeHasWriteOp(scope)) {
            Object.keys(this.store).forEach((other) => {
                if (other !== sid && this.store[other].scope)
                    if (this.gs.scopeInvalidated(scope, this.store[other].scope))
                        this.store[other].outdated = true
            })
        }
        if (this.gs.scopeHasReadOp(scope)) {
            if (!this.store[sid])
                this.store[sid] = {}
            this.store[sid].scope   = scope
            this.store[sid].outdated = false
        }
    }
})

/*  define a GraphQL schema  */
let definition = `
    schema {
        query:    RootQuery
        mutation: RootMutation
    }
    type RootQuery {
        ${gts.makeResolverSubscriptionsSchema()}
        ${gts.makeResolverSubscribeSchema()}
        ${gts.makeResolverUnsubscribeSchema()}

        ShoppingCard(id: ID): [ShoppingCard]!
        Item(id: ID): [Item]!
    }
    type RootMutation {
        createShoppingCard(id: ID!, items: [ID]): ShoppingCard
        updateShoppingCard(id: ID!, items: [ID]!): ShoppingCard
        deleteShoppingCard(id: ID!): ID

        createItem(id: ID!, title: String): Item
        updateItem(id: ID!, title: String!): Item
        deleteItem(id: ID!): ID
    }
    type ShoppingCard {
        id: ID
        items: [Item]!
    }
    type Item {
        id: ID
        title: String
    }
`

/*  define GraphQL resolvers  */
let resolvers = {
    RootQuery: {
        subscribe:     gts.makeResolverSubscribeFunction(),
        unsubscribe:   gts.makeResolverUnsubscribeFunction(),
        subscriptions: gts.makeResolverSubscriptionsFunction(),
        ShoppingCard: (root, args, ctx /*, info */) => {
            let result
            if (args.id) {
                result = ctx.shoppingCards.filter((sc) => sc.id === args.id)
                if (result.length > 0)
                    ctx.gts.scopeAdd(result[0].id, "ShoppingCard", "read", "direct", "one")
            }
            else {
                result = ctx.shoppingCards
                result.forEach((sc) => {
                    ctx.gts.scopeAdd(sc.id, "ShoppingCard", "read", "direct", "all")
                })
            }
            return result
        },
        Item: (root, args, ctx /*, info */) => {
            let result
            if (args.id) {
                result = ctx.items.filter((item) => item.id === args.id)
                if (result.length > 0)
                    ctx.gts.scopeAdd(result[0].id, "Item", "read", "direct", "one")
            }
            else {
                result = ctx.items
                result.forEach((item) => {
                    ctx.gts.scopeAdd(item.id, "Item", "read", "direct", "all")
                })
            }
            return result
        }
    },
    RootMutation: {
        createShoppingCard: (root, args, ctx /*, info */) => {
            let obj = { id: args.id, items: args.items ? args.items : [] }
            ctx.shoppingCards.push(obj)
            ctx.gts.scopeAdd(obj.id, "ShoppingCard", "create", "direct", "one")
            return obj
        },
        updateShoppingCard: (root, args, ctx /*, info */) => {
            let obj = ctx.shoppingCards.find((sc) => sc.id === args.id)
            obj.items = args.items
            ctx.gts.scopeAdd(obj.id, "ShoppingCard", "update", "direct", "one")
            return obj
        },
        deleteShoppingCard: (root, args, ctx /*, info */) => {
            let idx = ctx.shoppingCards.findIndex((sc) => sc.id === args.id)
            ctx.shoppingCards.splice(idx, 1)
            ctx.gts.scopeAdd(args.id, "ShoppingCard", "delete", "direct", "one")
            return args.id
        },
        createItem: (root, args, ctx /*, info */) => {
            let obj = { id: args.id, title: args.title }
            ctx.items.push(obj)
            ctx.gts.scopeAdd(obj.id, "Item", "create", "direct", "one")
            return obj
        },
        updateItem: (root, args, ctx /*, info */) => {
            let obj = ctx.items.find((item) => item.id === args.id)
            obj.title = args.title
            ctx.gts.scopeAdd(obj.id, "Item", "update", "direct", "one")
            return obj
        },
        deleteItem: (root, args, ctx /*, info */) => {
            let idx = ctx.items.findIndex((item) => item.id === args.id)
            ctx.items.splice(idx, 1)
            ctx.gts.scopeAdd(args.id, "Item", "delete", "direct", "one")
            return args.id
        }
    },
    ShoppingCard: {
        items: (shoppingCard, args, ctx /*, info */) => {
            return shoppingCard.items.map((id) => {
                let obj = ctx.items.find((item) => item.id === id)
                ctx.gts.scopeAdd(obj.id, "Item", "read", "relation", "all")
                return obj
            })
        }
    }
}

/*  create a GraphQL resolver context  */
let ctx = {
    gts,
    shoppingCards: [
        { id: "sc1", items: [ "i11", "i12" ] },
        { id: "sc2", items: [ "i21", "i22" ] }
    ],
    items: [
        { id: "i11", title: "Item 1.1" },
        { id: "i12", title: "Item 1.2" },
        { id: "i21", title: "Item 2.1" },
        { id: "i22", title: "Item 2.2" }
    ]
}

/*  build the GraphQL resolver object  */
let schema = GraphQLTools.makeExecutableSchema({
    typeDefs: [ definition ],
    resolvers: resolvers
})

/*  helper function for performing GraphQL queries  */
const makeQuery = (query, variables) => {
    console.log("----------------------------------------------------------------------")
    console.log("QUERY:\n" + query.replace(/^\s+/, "").replace(/\s+$/, ""))
    ctx.gts.setQuery(query)
    ctx.gts.scopeBegin()
    return GraphQL.graphql(schema, query, null, ctx, variables).then((result) => {
        ctx.gts.scopeCommit()
        console.log("RESULT: OK\n" + require("util").inspect(result, { depth: null }))
    }).catch((result) => {
        ctx.gts.scopeReject()
        console.log("RESULT: ERROR:\n" + result)
    })
}

/*  finally perform some GraphQL queries  */
co(function * () {
    yield (makeQuery(`
        query {
            subscribe(cid: "c1")
            subscriptions(cid: "c1")
            ShoppingCard(id: "sc1") { id, items { id, title } }
        }
    `, {}))
    yield (makeQuery(`
        mutation {
            i31: createItem(id: "i31", title: "Item 3.1") { id }
            i32: createItem(id: "i32", title: "Item 3.2") { id }
            createShoppingCard(id: "sc3", items: [ "i31", "i32" ]) {
                id, items { id, title }
            }
        }
    `, {}))
    yield (makeQuery(`
        query {
            s1: subscriptions(cid: "c1")
            s2: subscriptions(cid: "c1", outdated: true)
        }
    `, {}))
    yield (makeQuery(`
        mutation {
            updateItem(id: "i11", title: "Updated Title") {
                id
            }
        }
    `, {}))
    yield (makeQuery(`
        query {
            s1: subscriptions(cid: "c1")
            s2: subscriptions(cid: "c1", outdated: true)
        }
    `, {}))
    yield (makeQuery(`
        query {
            subscribe(cid: "c1")
            subscriptions(cid: "c1")
            ShoppingCard(id: "sc1") { id, items { id, title } }
        }
    `, {}))
    yield (makeQuery(`
        query {
            s1: subscriptions(cid: "c1")
            s2: subscriptions(cid: "c1", outdated: true)
        }
    `, {}))
}).catch((err) => {
    console.log("ERROR", err)
})

