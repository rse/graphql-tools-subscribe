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
import GraphQLToolsTypes     from "graphql-tools-types"
import GraphQLToolsSubscribe from ".."

/*  create a new GraphQL-Tools-Subscribe context  */
let gts = new GraphQLToolsSubscribe({
    pubsub: "spm",
    keyval: "spm"
})
let gtsConn = gts.connection("dummy", (sids) => {
    console.log("OUTDATED", sids)
})

/*  define a GraphQL schema  */
let definition = `
    schema {
        query:    RootQuery
        mutation: RootMutation
    }
    scalar UUID
    scalar Void
    type RootQuery {
        ShoppingCard(id: ID): [ShoppingCard]!
        Item(id: ID): [Item]!
        ${gts.schemaSubscription()}
    }
    type Subscription {
        ${gts.schemaSubscriptions()}
        ${gts.schemaSubscribe()}
        ${gts.schemaUnsubscribe()}
        ${gts.schemaPause()}
        ${gts.schemaResume()}
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
    UUID: GraphQLToolsTypes.UUID({ name: "UUID", storage: "string" }),
    Void: GraphQLToolsTypes.Void({ name: "Void" }),
    RootQuery: {
        ShoppingCard: (root, args, ctx /*, info */) => {
            let result
            if (args.id) {
                result = ctx.shoppingCards.filter((sc) => sc.id === args.id)
                if (result.length > 0)
                    ctx.scope.record("ShoppingCard", result[0].id, "read", "direct", "one")
            }
            else {
                result = ctx.shoppingCards
                result.forEach((sc) => {
                    ctx.scope.record("ShoppingCard", sc.id, "read", "direct", "all")
                })
            }
            return result
        },
        Item: (root, args, ctx /*, info */) => {
            let result
            if (args.id) {
                result = ctx.items.filter((item) => item.id === args.id)
                if (result.length > 0)
                    ctx.scope.record("Item", result[0].id, "read", "direct", "one")
            }
            else {
                result = ctx.items
                result.forEach((item) => {
                    ctx.gts.scopeAdd("Item", item.id, "read", "direct", "all")
                })
            }
            return result
        },
        Subscription: gts.resolverSubscription()
    },
    Subscription: {
        subscribe:     gts.resolverSubscribe(),
        unsubscribe:   gts.resolverUnsubscribe(),
        subscriptions: gts.resolverSubscriptions(),
        pause:         gts.resolverPause(),
        resume:        gts.resolverResume()
    },
    RootMutation: {
        createShoppingCard: (root, args, ctx /*, info */) => {
            let obj = { id: args.id, items: args.items ? args.items : [] }
            ctx.shoppingCards.push(obj)
            ctx.scope.record("ShoppingCard", obj.id, "create", "direct", "one")
            return obj
        },
        updateShoppingCard: (root, args, ctx /*, info */) => {
            let obj = ctx.shoppingCards.find((sc) => sc.id === args.id)
            obj.items = args.items
            ctx.scope.record("ShoppingCard", obj.id, "update", "direct", "one")
            return obj
        },
        deleteShoppingCard: (root, args, ctx /*, info */) => {
            let idx = ctx.shoppingCards.findIndex((sc) => sc.id === args.id)
            ctx.shoppingCards.splice(idx, 1)
            ctx.scope.record("ShoppingCard", args.id, "delete", "direct", "one")
            return args.id
        },
        createItem: (root, args, ctx /*, info */) => {
            let obj = { id: args.id, title: args.title }
            ctx.items.push(obj)
            ctx.scope.record("Item", obj.id, "create", "direct", "one")
            return obj
        },
        updateItem: (root, args, ctx /*, info */) => {
            let obj = ctx.items.find((item) => item.id === args.id)
            obj.title = args.title
            ctx.scope.record("Item", obj.id, "update", "direct", "one")
            return obj
        },
        deleteItem: (root, args, ctx /*, info */) => {
            let idx = ctx.items.findIndex((item) => item.id === args.id)
            ctx.items.splice(idx, 1)
            ctx.scope.record("Item", args.id, "delete", "direct", "one")
            return args.id
        }
    },
    ShoppingCard: {
        items: (shoppingCard, args, ctx /*, info */) => {
            return shoppingCard.items.map((id) => {
                let obj = ctx.items.find((item) => item.id === id)
                ctx.scope.record("Item", obj.id, "read", "relation", "all")
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
    console.log("QUERY:\n" + query.replace(/^s+/, "").replace(/(?:\s|\n)+/g, " ").replace(/\s+$/, ""))
    let scope = gtsConn.scope(query)
    ctx.scope = scope
    return GraphQL.graphql(schema, query, null, ctx, variables).then((result) => {
        scope.commit()
        console.log("RESULT: OK\n" + require("util").inspect(result, { depth: null }))
    }).catch((result) => {
        scope.reject()
        console.log("RESULT: ERROR:\n" + result)
    })
}

/*  finally perform some GraphQL queries  */
co(function * () {
    yield (makeQuery(`
        query {
            Subscription { subscribe }
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
            Subscription { subscriptions }
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
            Subscription { subscriptions }
        }
    `, {}))
    yield (makeQuery(`
        query {
            Subscription { subscribe }
            Subscription { subscriptions }
            ShoppingCard(id: "sc1") { id, items { id, title } }
        }
    `, {}))
    yield (makeQuery(`
        query {
            Subscription { subscriptions }
        }
    `, {}))
}).catch((err) => {
    console.log("ERROR", err)
})

