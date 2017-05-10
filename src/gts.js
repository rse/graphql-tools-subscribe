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

/*  internal dependencies  */
import gtsBase                 from "./gts-1-base"
import gtsRecord               from "./gts-2-record"
import gtsCheck                from "./gts-3-check"
import gtsFactory              from "./gts-4-factory"

/*  the API class  */
class GraphQLToolsSubscribe extends aggregation(gtsBase, gtsRecord, gtsCheck, gtsFactory) {
    constructor (query, options = {}) {
        super(query, options)
    }
}

/*  export the traditional way for interoperability reasons
    (as Babel would export an object with a 'default' field)  */
module.exports = GraphQLToolsSubscribe

