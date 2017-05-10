
GraphQL-Tools-Subscribe
=======================

[HERE BE DRAGONS -- EARLY ADOPTERS ONLY]

Subscription Framework for GraphQL-Tools

<p/>
<img src="https://nodei.co/npm/graphql-tools-subscribe.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/graphql-tools-subscribe.png" alt=""/>

About
-----

This Node.js module provides a subscription framework for [GraphQL
Tools](https://github.com/apollostack/graphql-tools) or plain
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

[STILL TO BE DOCUMENTED, SEE SOURCE CODE AND USAGE EXAMPLE BELOW IN THE MEANTIME]

Usage Example
-------------

See [sample script](tst/gts.js)

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

License
-------

Copyright (c) 2016-2017 Ralf S. Engelschall (http://engelschall.com/)

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

